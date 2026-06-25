import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getOrCreateAgent, getPoolStats, destroyAllPools } from "./connectionPool.js";

describe("connection-pool", () => {
  it("creates agent for HTTPS URL", () => {
    const agent = getOrCreateAgent("https://api.openai.com/v1");
    assert.ok(agent !== undefined);
    assert.equal(agent.keepAlive, true);
    destroyAllPools();
  });

  it("creates agent for HTTP URL", () => {
    const agent = getOrCreateAgent("http://localhost:3100");
    assert.ok(agent !== undefined);
    destroyAllPools();
  });

  it("returns undefined for empty URL", () => {
    const agent = getOrCreateAgent("");
    assert.equal(agent, undefined);
  });

  it("reuses agent for same origin", () => {
    const agent1 = getOrCreateAgent("https://api.openai.com/v1/chat");
    const agent2 = getOrCreateAgent("https://api.openai.com/v1/models");
    assert.equal(agent1, agent2);
    destroyAllPools();
  });

  it("creates different agents for different origins", () => {
    const agent1 = getOrCreateAgent("https://api.openai.com/v1");
    const agent2 = getOrCreateAgent("https://api.anthropic.com/v1");
    assert.notEqual(agent1, agent2);
    destroyAllPools();
  });

  it("returns pool stats", () => {
    getOrCreateAgent("https://api.test.com");
    const stats = getPoolStats();
    assert.ok(stats["https://api.test.com"] !== undefined);
    destroyAllPools();
  });

  it("destroys all pools", () => {
    getOrCreateAgent("https://api.test1.com");
    getOrCreateAgent("https://api.test2.com");
    destroyAllPools();
    const stats = getPoolStats();
    assert.equal(Object.keys(stats).length, 0);
  });
});
