import { describe, it, expect } from "vitest";
import { getOrCreateAgent, getPoolStats, destroyAllPools } from "./connectionPool.js";

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
});
