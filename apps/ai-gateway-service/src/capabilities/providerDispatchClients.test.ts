import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";

import { describe, expect, it } from "vitest";

import { callGateway as callGodReviewGateway } from "./godReviewCellExecutor-gateway.js";
import { callGateway as callTianshuGateway } from "./tianshuPlannerStorage.js";
import { callGatewayAI as callNeurogenesisGateway } from "./aiNeurogenesisCompilerHelpers.js";
import { resolveGatewayOutboundUrl } from "../security/gatewayOutboundUrlPolicy.ts";

async function listen(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function close(server: ReturnType<typeof createServer>) {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

describe("legacy capability gateway clients", () => {
  it("pins exact loopback gateway names and still rejects other private targets", async () => {
    await expect(resolveGatewayOutboundUrl("http://localhost:3100/chat/auto"))
      .resolves.toMatchObject({
        hostname: "localhost",
        addresses: [{ address: "127.0.0.1", family: 4 }],
      });
    await expect(resolveGatewayOutboundUrl("http://169.254.169.254/latest/meta-data"))
      .rejects.toMatchObject({
        code: "OUTBOUND_URL_BLOCKED",
        reason: "blocked_hostname_or_literal",
      });
  });

  it("sends a provider-only key and enterprise authentication from Tianshu", async () => {
    let observed: { headers: IncomingMessage["headers"]; body: string } | undefined;
    const { server, baseUrl } = await listen(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      observed = { headers: request.headers, body };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: "planned" } }] }));
    });

    try {
      await expect(callTianshuGateway(
        baseUrl,
        "planner-model",
        [{ role: "user", content: "plan" }],
        { gatewayAuthToken: "tianshu-gateway-token" },
      )).resolves.toBe("planned");
      expect(observed?.headers.authorization).toBe("Bearer tianshu-gateway-token");
      expect(observed?.headers["provider-dispatch-key"]).toMatch(/^tianshu-[A-Za-z0-9-]+$/u);
      expect(observed?.headers["idempotency-key"]).toBeUndefined();
      expect(observed?.body).not.toContain("tianshu-gateway-token");
    } finally {
      await close(server);
    }
  });

  it("routes neurogenesis through the core gateway with dispatch identity", async () => {
    let observed: { url?: string; headers: IncomingMessage["headers"]; body: string } | undefined;
    const { server, baseUrl } = await listen(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      observed = { url: request.url, headers: request.headers, body };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        success: true,
        data: { outputText: "compiled" },
      }));
    });

    try {
      await expect(callNeurogenesisGateway("compile", "standard", {
        gatewayUrl: baseUrl,
        gatewayAuthToken: "neurogenesis-gateway-token",
      })).resolves.toEqual({ success: true, content: "compiled" });
      expect(observed?.url).toBe("/chat/auto");
      expect(observed?.headers.authorization).toBe("Bearer neurogenesis-gateway-token");
      expect(observed?.headers["provider-dispatch-key"])
        .toMatch(/^local-capability-[A-Za-z0-9-]+$/u);
      expect(observed?.body).not.toContain("neurogenesis-gateway-token");
    } finally {
      await close(server);
    }
  });

  it("reuses one dispatch key across GodReview's bounded HTTP retry", async () => {
    const observedKeys: Array<string | undefined> = [];
    const observedAuth: Array<string | undefined> = [];
    let attempts = 0;
    const { server, baseUrl } = await listen(async (request, response) => {
      attempts += 1;
      const dispatchKey = request.headers["provider-dispatch-key"];
      observedKeys.push(typeof dispatchKey === "string" ? dispatchKey : undefined);
      observedAuth.push(request.headers.authorization);
      for await (const _chunk of request) {
        // Drain the request before writing a response.
      }
      if (attempts === 1) {
        response.writeHead(503, { "content-type": "text/plain" });
        response.end("retryable");
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ content: "reviewed", model: "review-model" }));
    });

    try {
      await expect(callGodReviewGateway(
        baseUrl,
        [{ role: "user", content: "review" }],
        {
          purpose: "provider-dispatch-test",
          gatewayAuthToken: "review-gateway-token",
        },
      )).resolves.toMatchObject({ content: "reviewed", model: "review-model" });
      expect(attempts).toBe(2);
      expect(new Set(observedKeys).size).toBe(1);
      expect(observedKeys[0]).toMatch(/^god-review-[A-Za-z0-9-]+$/u);
      expect(observedAuth).toEqual([
        "Bearer review-gateway-token",
        "Bearer review-gateway-token",
      ]);
    } finally {
      await close(server);
    }
  });
});
