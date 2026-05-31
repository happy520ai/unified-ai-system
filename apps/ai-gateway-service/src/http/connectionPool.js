/**
 * HTTP Connection Pool
 * Reuses HTTP agents for provider connections to reduce latency.
 */

import { Agent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

const pools = new Map();
const DEFAULT_MAX_SOCKETS = 10;
const DEFAULT_MAX_FREE_SOCKETS = 5;
const DEFAULT_KEEP_ALIVE_TIMEOUT = 30_000;

/**
 * Get or create an HTTP(S) agent for a given base URL.
 * @param {string} baseUrl
 * @param {Object} options
 * @returns {Agent}
 */
export function getOrCreateAgent(baseUrl, options = {}) {
  if (!baseUrl) return undefined;

  const key = new URL(baseUrl).origin;
  let agent = pools.get(key);

  if (!agent) {
    const isHttps = key.startsWith("https");
    const AgentClass = isHttps ? HttpsAgent : Agent;

    agent = new AgentClass({
      keepAlive: true,
      keepAliveMsecs: options.keepAliveMsecs ?? DEFAULT_KEEP_ALIVE_TIMEOUT,
      maxSockets: options.maxSockets ?? DEFAULT_MAX_SOCKETS,
      maxFreeSockets: options.maxFreeSockets ?? DEFAULT_MAX_FREE_SOCKETS,
    });

    pools.set(key, agent);
  }

  return agent;
}

/**
 * Get pool stats for monitoring.
 */
export function getPoolStats() {
  const stats = {};
  for (const [key, agent] of pools) {
    stats[key] = {
      sockets: Object.keys(agent.sockets || {}).length,
      freeSockets: Object.keys(agent.freeSockets || {}).length,
      requests: Object.keys(agent.requests || {}).length,
    };
  }
  return stats;
}

/**
 * Destroy all pooled agents (for graceful shutdown).
 */
export function destroyAllPools() {
  for (const [key, agent] of pools) {
    agent.destroy();
    pools.delete(key);
  }
}
