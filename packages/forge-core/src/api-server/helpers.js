import { okResponse, errResponse, forgeRequestId } from '../integration/bridge.js';

// ---- Constants ----

/** Public GET endpoints that don't require authentication */
export const PUBLIC_GET = [
  '/api/status', '/api/goals', '/api/pool/status',
  '/api/pool/queue', '/api/pool/locks',
  '/api/gateway/health', '/api/gateway/providers',
  '/api/metrics', '/api/config', '/api/plugins', '/api/resilience', '/api/tracing',
];

/** MIME types for static file serving */
export const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---- Utility Functions ----

/**
 * JSON.stringify with circular-reference protection.
 *
 * When an object graph contains cycles (e.g. back-references from internal
 * state objects such as EventEmitter-based managers, BudgetTracker, ForgeConfig,
 * etc.), plain JSON.stringify throws "TypeError: Converting circular structure
 * to JSON" which manifests as "Maximum call stack size exceeded".
 *
 * This helper tracks visited objects and replaces back-references with the
 * string "[Circular]" so serialization always succeeds.
 *
 * @param {*} data - Value to serialize.
 * @param {number|string} [indent] - Optional indentation (passed to JSON.stringify).
 * @returns {string}
 */
export function safeStringify(data, indent) {
  const seen = new WeakSet();
  return JSON.stringify(data, function (_key, value) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, indent);
}

/**
 * Read and parse request body with size limit.
 *
 * @param {import('node:http').IncomingMessage} req - HTTP request object.
 * @param {number} maxBodySize - Maximum body size in bytes.
 * @returns {Promise<object>} Parsed JSON body.
 */
export async function readBody(req, maxBodySize) {
  return new Promise((resolve, reject) => {
    let data = '';
    let overflow = false;
    req.on('data', chunk => {
      data += chunk;
      if (data.length > maxBodySize) {
        overflow = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (overflow) {
        const err = new Error('Request body too large');
        err.status = 413;
        return reject(err);
      }
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

/**
 * Send a JSON response with optional envelope wrapping.
 *
 * @param {import('node:http').ServerResponse} res - HTTP response object.
 * @param {number} status - HTTP status code.
 * @param {*} data - Response data.
 * @param {boolean} envelope - Whether to wrap in standard envelope format.
 */
export function jsonResponse(res, status, data, envelope) {
  let body;
  if (envelope && status >= 200 && status < 400) {
    body = safeStringify(okResponse(data, { requestId: forgeRequestId() }));
  } else if (envelope && status >= 400) {
    const code = data?.error || data?.code || 'forge_error';
    const message = typeof data?.error === 'string' ? data.error : (data?.message || 'Unknown error');
    body = safeStringify(errResponse(code, message, { category: status >= 500 ? 'internal' : 'validation' }));
  } else {
    body = safeStringify(data);
  }
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---- Authentication Helper ----

/**
 * Authenticate a request using the auth adapter or fallback to API key.
 *
 * @param {import('node:http').IncomingMessage} req - HTTP request.
 * @param {object} authAdapter - ForgeAuthAdapter instance.
 * @param {object|null} userMgr - UserManager instance (may be null).
 * @returns {object|null} Authenticated user or null.
 */
export function authenticate(req, authAdapter, userMgr) {
  // Use the ForgeAuthAdapter for unified auth (gateway or standalone)
  if (authAdapter) {
    const result = authAdapter.authenticate(req);
    if (result.authenticated) return result.identity;
  }

  // Fallback to Forge's own auth (if adapter didn't handle it)
  const key = req.headers['x-api-key'] ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7)
      : null);
  if (!key) return null;
  const found = userMgr?.getUserByApiKey(key);
  if (found) userMgr?.updateLastActive(found.id);
  return found;
}

// ---- Knowledge Helper ----

/**
 * List knowledge entries via the KnowledgeBase search API.
 *
 * KnowledgeBase does not expose a direct list method, so we perform a
 * broad search with a low similarity threshold to retrieve all entries
 * matching the optional category filter.
 *
 * @param {object} knowledge - KnowledgeBase instance.
 * @param {object|null} user - Authenticated user (may be null).
 * @param {string} [category] - Optional category filter.
 * @param {string|number} [limit] - Maximum entries to return.
 * @returns {Array<object>}
 */
export function listKnowledge(knowledge, user, category, limit) {
  if (!knowledge) return [];
  return knowledge.search('*', {
    category: category || undefined,
    limit: Number(limit) || 50,
    threshold: 0,
  });
}

/**
 * Build the API handler context object.
 *
 * Factory that closes over readBody / listKnowledge so the caller does not
 * need to import them directly. The returned object is passed to handleAPI
 * on every request.
 *
 * @param {object} deps - Dependencies.
 * @param {object} deps.forge - Forge instance.
 * @param {object|null} deps.userMgr - UserManager instance.
 * @param {object|null} deps.agentPool - AgentPoolManager instance.
 * @param {object|null} deps.knowledge - KnowledgeBase instance.
 * @param {object} deps.transfer - GoalTransfer instance.
 * @param {object|null} deps.gateway - GatewayBridge instance.
 * @param {object|null} deps.config - ForgeConfig instance.
 * @param {boolean} deps.envelope - Envelope mode flag.
 * @param {Function} deps.broadcastFn - Broadcast function bound to the live client set.
 * @returns {ApiHandlerContext}
 */
export function buildApiContext({ forge, userMgr, agentPool, knowledge, transfer, gateway, config, envelope, broadcastFn }) {
  return {
    forge,
    userMgr,
    agentPool,
    knowledge,
    transfer,
    gateway,
    config,
    envelope,
    jsonFn: jsonResponse,
    readBodyFn: readBody,
    broadcastFn,
    listKnowledgeFn: listKnowledge,
  };
}
