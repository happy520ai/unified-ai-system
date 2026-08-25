import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { resolveSafeOutboundUrl } from "./outboundUrlPolicy.ts";
import { safeOutboundFetch } from "./safeOutboundFetch.ts";

function createRawResponse(status = 200, body = "ok", headers = {}) {
  return {
    status,
    statusText: status === 200 ? "OK" : "Redirect",
    headers,
    body: Readable.from([Buffer.from(body)]),
  };
}

function createDependencies(lookupRecords = [{ address: "93.184.216.34", family: 4 }]) {
  const lookup = vi.fn(async () => lookupRecords);
  const request = vi.fn(async () => createRawResponse());
  const agent = { destroy: vi.fn() };
  return {
    lookup,
    request,
    agent,
    dependencies: {
      resolveOutboundUrl: (url: unknown) => resolveSafeOutboundUrl(url, { lookup }),
      request,
      createAgent: () => agent,
    },
  };
}

describe("safe outbound request boundary", () => {
  it.each([
    "http://2130706433/",
    "http://0x7f000001/",
    "http://[::ffff:127.0.0.1]/",
    "http://metadata.tencentyun.com/",
    "http://user:password@example.com/",
  ])("rejects alternate internal or credential-bearing URL %s", async (url) => {
    const { dependencies, request } = createDependencies();
    await expect(safeOutboundFetch(url, {}, dependencies)).rejects.toMatchObject({
      code: "OUTBOUND_URL_BLOCKED",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects a hostname when any DNS result is private", async () => {
    const { dependencies, request } = createDependencies([
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ]);
    await expect(safeOutboundFetch("https://rebind.example/path", {}, dependencies)).rejects.toMatchObject({
      code: "OUTBOUND_URL_BLOCKED",
      reason: "dns_resolved_to_non_public_address",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("pins the validated DNS lookup into the actual request", async () => {
    const { dependencies, request } = createDependencies();
    const response = await safeOutboundFetch("https://example.com/path", { method: "POST" }, dependencies);
    expect(await response.text()).toBe("ok");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1].lookup).toBeTypeOf("function");
    expect(request.mock.calls[0][1].agent).toBeDefined();
  });

  it("never follows redirects or forwards headers to a second destination", async () => {
    const { dependencies, request, agent } = createDependencies();
    request.mockResolvedValueOnce(createRawResponse(302, "", { location: "http://169.254.169.254/latest/meta-data" }));
    await expect(safeOutboundFetch("https://example.com/start", {
      headers: { authorization: "Bearer secret-must-not-move" },
    }, dependencies)).rejects.toMatchObject({
      code: "OUTBOUND_URL_BLOCKED",
      reason: "redirect_forbidden",
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(agent.destroy).toHaveBeenCalled();
  });
});
