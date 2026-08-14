import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { fetchWithAgent } from "../http/connectionPool.js";
import { createPinnedLookup, resolveSafeOutboundUrl } from "./outboundUrlPolicy.ts";

const publicLookup = async () => [{ address: "8.8.8.8", family: 4 }];

describe("outbound URL security policy", () => {
  it.each([
    "http://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://[::ffff:127.0.0.1]",
    "file:///etc/passwd",
  ])("blocks private, alternate-notation, and unsupported targets: %s", async (url) => {
    await expect(resolveSafeOutboundUrl(url, { lookup: publicLookup })).rejects.toMatchObject({
      code: "OUTBOUND_URL_BLOCKED",
    });
  });

  it("blocks DNS rebinding and mixed public-private answers", async () => {
    await expect(resolveSafeOutboundUrl("https://provider.example", {
      lookup: async () => [{ address: "169.254.169.254", family: 4 }],
    })).rejects.toMatchObject({ reason: "dns_resolved_to_non_public_address" });
    await expect(resolveSafeOutboundUrl("https://provider.example", {
      lookup: async () => [
        { address: "8.8.8.8", family: 4 },
        { address: "10.0.0.8", family: 4 },
      ],
    })).rejects.toMatchObject({ reason: "dns_resolved_to_non_public_address" });
  });

  it("pins validated DNS results into the connection lookup", async () => {
    let resolverCalls = 0;
    const destination = await resolveSafeOutboundUrl("https://provider.example/v1", {
      lookup: async () => {
        resolverCalls += 1;
        return [{ address: "8.8.8.8", family: 4 }];
      },
    });
    const pinned = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      destination.lookup("provider.example", {}, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address: String(address), family: Number(family) });
      });
    });
    expect(pinned).toEqual({ address: "8.8.8.8", family: 4 });
    expect(resolverCalls).toBe(1);
  });

  it("does not follow redirects in the pinned HTTP client", async () => {
    let redirectedRequests = 0;
    const target = createServer((_request, response) => {
      redirectedRequests += 1;
      response.end("unexpected");
    });
    const redirector = createServer((_request, response) => {
      const targetAddress = target.address();
      response.writeHead(302, {
        location: `http://127.0.0.1:${typeof targetAddress === "object" && targetAddress ? targetAddress.port : 0}/metadata`,
      });
      response.end();
    });
    await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", resolve));
    await new Promise<void>((resolve) => redirector.listen(0, "127.0.0.1", resolve));
    const redirectAddress = redirector.address();
    try {
      const response = await fetchWithAgent(
        `http://public-provider.test:${typeof redirectAddress === "object" && redirectAddress ? redirectAddress.port : 0}/start`,
        {
          lookup: createPinnedLookup([{ address: "127.0.0.1", family: 4 }]),
          timeout: 1_000,
        },
      );
      expect(response.status).toBe(302);
      expect(redirectedRequests).toBe(0);
    } finally {
      await Promise.all([
        new Promise<void>((resolve, reject) => redirector.close((error) => error ? reject(error) : resolve())),
        new Promise<void>((resolve, reject) => target.close((error) => error ? reject(error) : resolve())),
      ]);
    }
  });
});
