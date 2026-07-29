/**
 * HTTP Connection Pool
 * Reuses HTTP agents for provider connections to reduce latency.
 */

import { Agent, request as httpRequest } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";

const pools = new Map();
const DEFAULT_MAX_SOCKETS = 10;
const DEFAULT_MAX_FREE_SOCKETS = 5;
const DEFAULT_KEEP_ALIVE_TIMEOUT = 30_000;
const DEFAULT_REQUEST_TIMEOUT = 60_000;
const AGENT_TTL_MS = 10 * 60 * 1000;

const evictionTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, agent] of pools) {
    if (agent._lastUsed && now - agent._lastUsed > AGENT_TTL_MS) {
      agent.destroy();
      pools.delete(key);
    }
  }
}, 60_000);
evictionTimer.unref?.();

/**
 * Get or create an HTTP(S) agent for a given base URL.
 * @param {string} baseUrl
 * @param {Object} options
 * @returns {Agent}
 */
export function getOrCreateAgent(baseUrl, options = {}) {
  if (!baseUrl) return undefined;

  let key;
  try {
    key = new URL(baseUrl).origin;
  } catch {
    return undefined;
  }
  let agent = pools.get(key);

  if (!agent) {
    const isHttps = key.startsWith("https");
    const AgentClass = isHttps ? HttpsAgent : Agent;

    agent = new AgentClass({
      keepAlive: true,
      keepAliveMsecs: options.keepAliveMsecs ?? DEFAULT_KEEP_ALIVE_TIMEOUT,
      maxSockets: options.maxSockets ?? DEFAULT_MAX_SOCKETS,
      maxFreeSockets: options.maxFreeSockets ?? DEFAULT_MAX_FREE_SOCKETS,
      timeout: options.timeout ?? DEFAULT_REQUEST_TIMEOUT,
    });

    pools.set(key, agent);
  }

  agent._lastUsed = Date.now();
  return agent;
}

/**
 * Describe whether a request can use the pooled HTTP adapter.
 */
export function createFetchRequestAdapter(url, fetchOptions = {}, agent) {
  if (!agent) {
    return { useNativeFetch: true, fetchOptions };
  }

  return {
    useNativeFetch: false,
    url,
    options: fetchOptions,
    agent,
  };
}

function createAbortError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function collectResponseBody(response) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    response.once("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    response.once("error", reject);
  });
}

function createResponseFacade(response) {
  let bodyTextPromise;
  return {
    status: response.statusCode ?? 0,
    statusText: response.statusMessage ?? "",
    headers: response.headers,
    ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
    body: response,
    text() {
      bodyTextPromise ??= collectResponseBody(response);
      return bodyTextPromise;
    },
    async json() {
      return JSON.parse(await this.text());
    },
  };
}

/**
 * Send an HTTP request through a pooled node:http(s) agent.
 */
export function fetchWithAgent(url, options = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    return Promise.reject(error);
  }

  const {
    method = "GET",
    headers = {},
    body,
    agent,
    signal,
    timeout = DEFAULT_REQUEST_TIMEOUT,
  } = options;

  if (signal?.aborted) {
    return Promise.reject(createAbortError("Request aborted before dispatch."));
  }

  return new Promise((resolve, reject) => {
    const requestFn = parsedUrl.protocol === "https:" ? httpsRequest : httpRequest;
    let request;

    const cleanupAbortListener = () => {
      signal?.removeEventListener("abort", abortRequest);
    };
    const abortRequest = () => {
      request?.destroy(createAbortError("Request aborted."));
    };

    request = requestFn({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method,
      headers,
      agent,
      timeout,
    }, (response) => {
      response.once("close", cleanupAbortListener);
      resolve(createResponseFacade(response));
    });

    request.once("error", (error) => {
      cleanupAbortListener();
      reject(error);
    });
    request.once("timeout", () => {
      request.destroy(createAbortError(`Request timed out after ${timeout}ms.`));
    });
    signal?.addEventListener("abort", abortRequest, { once: true });

    if (body !== undefined && body !== null) {
      request.write(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    }
    request.end();
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
