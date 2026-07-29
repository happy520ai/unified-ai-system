import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import {
  getOrCreateAgent,
  getPoolStats,
  destroyAllPools,
  fetchWithAgent,
} from "./connectionPool.js";

describe("connection-pool", () => {
  it("creates agent for HTTPS URL", () => {
    const agent = getOrCreateAgent("https://api.openai.com/v1");
    expect(agent).toBeDefined();
    expect(agent.keepAlive).toBe(true);
    destroyAllPools();
  });

  it("creates agent for HTTP URL", () => {
    const agent = getOrCreateAgent("http://localhost:3100");
    expect(agent).toBeDefined();
    destroyAllPools();
  });

  it("returns undefined for empty URL", () => {
    const agent = getOrCreateAgent("");
    expect(agent).toBeUndefined();
  });

  it("returns undefined for a malformed URL", () => {
    expect(getOrCreateAgent("not a URL")).toBeUndefined();
  });

  it("reuses agent for same origin", () => {
    const agent1 = getOrCreateAgent("https://api.openai.com/v1/chat");
    const agent2 = getOrCreateAgent("https://api.openai.com/v1/models");
    expect(agent1).toBe(agent2);
    destroyAllPools();
  });

  it("creates different agents for different origins", () => {
    const agent1 = getOrCreateAgent("https://api.openai.com/v1");
    const agent2 = getOrCreateAgent("https://api.anthropic.com/v1");
    expect(agent1).not.toBe(agent2);
    destroyAllPools();
  });

  it("returns pool stats", () => {
    getOrCreateAgent("https://api.test.com");
    const stats = getPoolStats();
    expect(stats["https://api.test.com"]).toBeDefined();
    destroyAllPools();
  });

  it("destroys all pools", () => {
    getOrCreateAgent("https://api.test2.com");
    destroyAllPools();
    const stats = getPoolStats();
    expect(Object.keys(stats).length).toBe(0);
  });

  it("sends requests through a pooled agent", async () => {
    const server = createServer((request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ method: request.method, ok: true }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const response = await fetchWithAgent(`${baseUrl}/health`, {
        agent: getOrCreateAgent(baseUrl),
        timeout: 1_000,
      });

      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({ method: "GET", ok: true });
    } finally {
      destroyAllPools();
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
