import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { createRouteRateLimiter } from "./routeRateLimiter.js";

type TestResponse = ServerResponse<IncomingMessage> & {
  body: string;
  headers: Map<string, string>;
};

function response(): TestResponse {
  const headers = new Map<string, string>();
  const result = {
    body: "",
    headers,
    statusCode: 200,
    setHeader(name: string, value: unknown) { headers.set(name.toLowerCase(), String(value)); },
    writeHead(statusCode: number, headers: Record<string, unknown> = {}) {
      result.statusCode = statusCode;
      for (const [name, value] of Object.entries(headers)) result.setHeader(name, String(value));
    },
    end(body = "") { result.body = body; },
  } as unknown as TestResponse;
  return result;
}

function request(method: string, url: string): IncomingMessage {
  return {
    method,
    url,
    headers: { host: "gateway.test" },
    socket: { remoteAddress: "10.20.30.40" },
  } as unknown as IncomingMessage;
}

describe("Agent Governance route rate-limit aliases", () => {
  it("shares one policy-create bucket between compatibility and canonical POST paths", async () => {
    const limiter = createRouteRateLimiter({
      whitelist: [],
      globalMaxRequests: 100,
      routeLimits: { "/v1/policies/create": { windowMs: 60_000, maxRequests: 1 } },
    });
    try {
      const compatibility = response();
      expect(limiter.apply(request("POST", "/v1/policies/create"), compatibility)).toBeNull();
      expect(compatibility.headers.get("x-ratelimit-route")).toBe("/v1/policies/create");

      const canonical = response();
      expect(limiter.apply(request("POST", "/v1/policies"), canonical)).toBe(canonical);
      expect(canonical.statusCode).toBe(429);
      expect(canonical.headers.get("x-ratelimit-route")).toBe("/v1/policies/create");

      const read = response();
      expect(limiter.apply(request("GET", "/v1/policies"), read)).toBeNull();
      expect(read.headers.has("x-ratelimit-route")).toBe(false);
    } finally {
      await limiter.close();
    }
  });
});
