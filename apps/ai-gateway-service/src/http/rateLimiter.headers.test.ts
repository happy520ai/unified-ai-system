import { describe, expect, it } from "vitest";
import { createRateLimiter, RATE_LIMIT_RESPONSE_HEADERS } from "./rateLimiter.js";

type MockResponse = {
  body: string;
  headers: Map<string, string>;
  statusCode: number;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(body?: string): void;
};

function createMockResponse(): MockResponse {
  return {
    body: "",
    headers: new Map(),
    statusCode: 200,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    },
    end(body = "") {
      this.body = body;
    },
  };
}

function createRequest(ip: string) {
  return { socket: { remoteAddress: ip } };
}

describe("rate limiter HTTP contract", () => {
  it("exposes generic and OpenAI-compatible request quota headers", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, whitelist: [] });
    const response = createMockResponse();

    expect(limiter.apply(createRequest("10.0.0.10"), response)).toBeNull();
    expect(response.headers.get("x-ratelimit-limit")).toBe("2");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("1");
    expect(response.headers.get("x-ratelimit-window")).toBe("60s");
    expect(response.headers.get("x-ratelimit-reset")).toMatch(/^\d+$/);
    expect(response.headers.get("x-ratelimit-limit-requests")).toBe("2");
    expect(response.headers.get("x-ratelimit-remaining-requests")).toBe("1");
    expect(response.headers.get("x-ratelimit-reset-requests")).toMatch(/^\d+s$/);
    for (const headerName of Object.values(RATE_LIMIT_RESPONSE_HEADERS)) {
      if (headerName !== RATE_LIMIT_RESPONSE_HEADERS.retryAfter) {
        expect(response.headers.has(headerName.toLowerCase())).toBe(true);
      }
    }

    limiter.close();
  });

  it("returns a structured 429 response with retry timing", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, whitelist: [] });
    limiter.apply(createRequest("10.0.0.11"), createMockResponse());
    const response = createMockResponse();

    expect(limiter.apply(createRequest("10.0.0.11"), response)).toBe(response);
    expect(response.statusCode).toBe(429);
    expect(response.headers.get("retry-after")).toMatch(/^[1-9]\d*$/);
    expect(response.headers.get("x-ratelimit-remaining-requests")).toBe("0");
    expect(JSON.parse(response.body)?.error?.code).toBe("RATE_LIMITED");

    limiter.close();
  });
});
