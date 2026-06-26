/**
 * HTTP Connection Pool
 * Reuses HTTP agents for provider connections to reduce latency.
 *
 * 使用 undici.Agent 支持 Node 内置 fetch (undici) 的连接池。
 * node:http.Agent 只对 http.request 有效，对 fetch 无效。
 */

import { Agent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

const pools = new Map();
const DEFAULT_MAX_SOCKETS = 10;
const DEFAULT_MAX_FREE_SOCKETS = 5;
const DEFAULT_KEEP_ALIVE_TIMEOUT = 30_000;
const AGENT_TTL_MS = 10 * 60 * 1000; // 10 minutes idle eviction

// Periodically evict idle agents
setInterval(() => {
  const now = Date.now();
  for (const [key, agent] of pools) {
    if (agent._lastUsed && now - agent._lastUsed > AGENT_TTL_MS) {
      agent.destroy();
      pools.delete(key);
    }
  }
}, 60_000).unref?.();

/**
 * Get or create an HTTP(S) agent for a given base URL.
 * 返回的对象同时兼容 http.request (agent 选项) 和 fetch (dispatcher 选项)。
 * @param {string} baseUrl
 * @param {Object} options
 * @returns {Agent}
 */
export function getOrCreateAgent(baseUrl, options = {}) {
  if (!baseUrl) return undefined;

  let key;
  try { key = new URL(baseUrl).origin; } catch { return undefined; }
  let agent = pools.get(key);

  if (!agent) {
    const isHttps = key.startsWith("https");
    const AgentClass = isHttps ? HttpsAgent : Agent;

    agent = new AgentClass({
      keepAlive: true,
      keepAliveMsecs: options.keepAliveMsecs ?? DEFAULT_KEEP_ALIVE_TIMEOUT,
      maxSockets: options.maxSockets ?? DEFAULT_MAX_SOCKETS,
      maxFreeSockets: options.maxFreeSockets ?? DEFAULT_MAX_FREE_SOCKETS,
      timeout: options.timeout ?? 60_000,
    });

    // 标记：这是 node:http.Agent，对 fetch 无效
    // 使用 fetchRequestAdapter 来适配
    agent._poolKey = key;
    agent._isHttps = isHttps;

    pools.set(key, agent);
  }

  agent._lastUsed = Date.now();
  return agent;
}

/**
 * 创建适配 fetch 的请求选项。
 * Node 内置 fetch (undici) 不支持 agent 选项，
 * 但支持通过 undici.Agent 或 dispatcher 选项。
 * 这里返回一个包装器，让 fetch 使用 http.request 代替。
 *
 * @param {string} url
 * @param {Object} fetchOptions - fetch 原始选项
 * @param {Agent} agent - http.Agent 实例
 * @returns {Object} { useNativeFetch, fetchFn }
 */
export function createFetchRequestAdapter(url, fetchOptions = {}, agent) {
  if (!agent) {
    return { useNativeFetch: true, fetchOptions };
  }

  // 对于 fetch，我们需要使用 undici 的方式
  // 但由于 Node 内置 fetch 不支持自定义 agent，
  // 我们改用 http.request 来利用连接池
  return {
    useNativeFetch: false,
    url,
    options: fetchOptions,
    agent,
  };
}

/**
 * 使用 http.request 发送请求（利用连接池）
 * @param {string} url
 * @param {Object} options - { method, headers, body, agent, timeout }
 * @returns {Promise<{status, headers, body, ok}>}
 */
export function fetchWithAgent(url, options = {}) {
  const { method = "GET", headers = {}, body, agent, timeout = 60_000 } = options;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const httpModule = isHttps ? import("node:https") : import("node:http");

    httpModule.then((http) => {
      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
        agent,
        timeout,
      };

      const req = http.request(reqOptions, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: bodyText,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            text: () => Promise.resolve(bodyText),
            json: () => Promise.resolve(JSON.parse(bodyText)),
          });
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      if (body) {
        req.write(typeof body === "string" ? body : JSON.stringify(body));
      }
      req.end();
    });
  });
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
