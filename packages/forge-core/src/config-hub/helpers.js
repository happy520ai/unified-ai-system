/**
 * Helpers for UnifiedConfigHub -- constants, pure utility functions,
 * and pre-registered core schemas.
 *
 * @module config-hub/helpers
 */

// -- Constants ----------------------------------------------------------------

/** Default environment variable prefix. */
export const DEFAULT_ENV_PREFIX = 'FORGE_';

/** Double-underscore separator between module and key in env var names. */
export const ENV_MODULE_SEP = '__';

/** Supported schema property types. */
export const VALID_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array']);

// -- Pure utility functions ---------------------------------------------------

/**
 * Convert a SNAKE_CASE or snake_case string to camelCase.
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Coerce a raw string value to the target type declared in the schema.
 * @param {string} raw -- raw string value (e.g. from process.env)
 * @param {string} type -- target type ('string' | 'number' | 'boolean' | 'object' | 'array')
 * @returns {*}
 */
export function coerceType(raw, type) {
  if (raw === undefined || raw === null) return undefined;

  switch (type) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case 'boolean':
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      return raw;
    case 'object':
    case 'array':
      try { return JSON.parse(raw); } catch { return raw; }
    case 'string':
    default:
      return String(raw);
  }
}

/**
 * Deep-clone a plain value via JSON round-trip.
 * @param {*} value
 * @returns {*}
 */
export function deepClone(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Deep-merge two plain objects.  Source values override target values.
 * Nested objects are merged recursively; arrays and primitives are replaced.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
export function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (
      v !== null && typeof v === 'object' && !Array.isArray(v) &&
      out[k] !== null && typeof out[k] === 'object' && !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Set a value at a dot-separated path inside a nested object (mutates in place).
 * @param {object} obj
 * @param {string} path
 * @param {*} value
 */
export function setNested(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Get a value at a dot-separated path inside a nested object.
 * @param {object} obj
 * @param {string} path
 * @returns {*}
 */
export function getNested(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

// =============================================================================
//  Pre-registered core schemas
// =============================================================================

/**
 * Built-in schemas for core Forge modules.
 * @type {Object<string, object>}
 */
export const CORE_SCHEMAS = {
  pool: {
    properties: {
      maxConcurrent:      { type: 'number',  default: 4,     description: 'Max concurrent workers' },
      maxGoals:           { type: 'number',  default: 3,     description: 'Max concurrent goals' },
      enableCodeIntel:    { type: 'boolean', default: true,  description: 'Enable code intelligence' },
      enableVerification: { type: 'boolean', default: true,  description: 'Enable verification pipeline' },
      enableAutoVerify:   { type: 'boolean', default: true,  description: 'Auto-verify after code changes' },
      maxVerifyRetries:   { type: 'number',  default: 2,     description: 'Max verification retries' },
      verifyMaxTier:       { type: 'number',  default: 2,     description: 'Max verification tier' },
      shutdownTimeout:    { type: 'number',  default: 30000, description: 'Shutdown timeout (ms)' },
      goalCleanupDelay:   { type: 'number',  default: 5000,  description: 'Delay before goal cleanup (ms)' },
    },
    required: ['maxConcurrent'],
  },

  budget: {
    properties: {
      maxTokens:          { type: 'number', default: 500_000, description: 'Max tokens per session' },
      maxCost:            { type: 'number', default: 10.0,    description: 'Max cost (USD)' },
      maxMinutes:         { type: 'number', default: 120,     description: 'Max wall-clock minutes' },
      warningThreshold:   { type: 'number', default: 0.8,     description: 'Warning threshold (0-1)' },
      criticalThreshold:  { type: 'number', default: 0.95,    description: 'Critical threshold (0-1)' },
    },
    required: ['maxTokens', 'maxCost'],
  },

  server: {
    properties: {
      port:             { type: 'number', default: 4500,   description: 'HTTP server port' },
      corsOrigin:       { type: 'string', default: '*',    description: 'CORS origin header' },
      snapshotInterval: { type: 'number', default: 5000,   description: 'Snapshot interval (ms)' },
      version:          { type: 'string', default: '0.4.0', description: 'Server version' },
    },
    required: ['port'],
  },

  llm: {
    properties: {
      provider:    { type: 'string', default: 'xiaomi',             description: 'LLM provider name' },
      model:       { type: 'string', default: 'mimo-v2.5-pro',      description: 'Default model id' },
      temperature: { type: 'number', default: 0.2,                  description: 'Sampling temperature' },
      maxTokens:   { type: 'number', default: 4096,                 description: 'Max tokens per request' },
      gatewayUrl:  { type: 'string', default: 'http://127.0.0.1:3100', description: 'AI gateway URL' },
    },
    required: ['provider', 'model'],
  },

  worker: {
    properties: {
      temperature:     { type: 'number', default: 0.1,   description: 'Worker sampling temperature' },
      maxTokensMutate: { type: 'number', default: 32768, description: 'Max tokens for mutations' },
      maxTokensRead:   { type: 'number', default: 8192,  description: 'Max tokens for reads' },
      retryAttempts:   { type: 'number', default: 3,     description: 'LLM retry attempts' },
      retryDelay:      { type: 'number', default: 2000,  description: 'LLM retry delay (ms)' },
      bashTimeout:     { type: 'number', default: 60000, description: 'Bash command timeout (ms)' },
      maxFileSize:     { type: 'number', default: 50000, description: 'Max file size (bytes)' },
      fileSliceLimit:  { type: 'number', default: 8000,  description: 'File slice limit (chars)' },
    },
    required: [],
  },

  verification: {
    properties: {
      maxTier:            { type: 'number', default: 5,      description: 'Max verification tier' },
      typescriptTimeout:  { type: 'number', default: 120000, description: 'TypeScript check timeout (ms)' },
      eslintTimeout:      { type: 'number', default: 60000,  description: 'ESLint timeout (ms)' },
      eslintMaxWarnings:  { type: 'number', default: 50,     description: 'Max ESLint warnings allowed' },
      testTimeout:        { type: 'number', default: 120000, description: 'Test runner timeout (ms)' },
      integrationTimeout: { type: 'number', default: 180000, description: 'Integration test timeout (ms)' },
      npmAuditTimeout:    { type: 'number', default: 60000,  description: 'npm audit timeout (ms)' },
    },
    required: [],
  },

  metrics: {
    properties: {
      seriesWindow: { type: 'number', default: 1_800_000, description: 'Time-series window (ms)' },
      maxRecords:   { type: 'number', default: 5000,      description: 'Max metric records' },
    },
    required: [],
  },

  memory: {
    properties: {
      hotMaxEntries:   { type: 'number', default: 500,   description: 'Hot tier ring buffer size' },
      hotTokenBudget:  { type: 'number', default: 32000, description: 'Hot tier token budget' },
      warmMaxEntries:  { type: 'number', default: 1000,  description: 'Warm tier max entries' },
      coldMaxEntries:  { type: 'number', default: 10000, description: 'Cold tier max entries' },
      defaultTTL:      { type: 'number', default: 0,     description: 'Default hot entry TTL (ms, 0=none)' },
      persistencePath: { type: 'string', default: '.forge/memory.json', description: 'Cold tier persistence path' },
    },
    required: [],
  },

  cost: {
    properties: {
      trackPerGoal:    { type: 'boolean', default: true,  description: 'Track costs per goal' },
      trackPerTask:    { type: 'boolean', default: true,  description: 'Track costs per task' },
      maxRecords:      { type: 'number', default: 10000,  description: 'Max cost records' },
      currency:        { type: 'string', default: 'USD',  description: 'Currency code' },
    },
    required: [],
  },

  scaling: {
    properties: {
      minWorkers:          { type: 'number', default: 1,    description: 'Min worker count' },
      maxWorkers:          { type: 'number', default: 16,   description: 'Max worker count' },
      currentWorkers:      { type: 'number', default: 4,    description: 'Initial worker count' },
      scaleUpThreshold:    { type: 'number', default: 0.8,  description: 'Scale-up utilization threshold' },
      scaleDownThreshold:  { type: 'number', default: 0.3,  description: 'Scale-down utilization threshold' },
      cooldownMs:          { type: 'number', default: 60000, description: 'Cooldown between scaling events (ms)' },
      sampleWindow:        { type: 'number', default: 20,   description: 'Recent samples for trend analysis' },
      scaleUpFactor:       { type: 'number', default: 1.5,  description: 'Scale-up multiplier' },
      scaleDownFactor:     { type: 'number', default: 0.7,  description: 'Scale-down multiplier' },
    },
    required: ['minWorkers', 'maxWorkers'],
  },

  errors: {
    properties: {
      maxPatterns:     { type: 'number', default: 200,  description: 'Max error patterns' },
      minOccurrences:  { type: 'number', default: 2,    description: 'Min occurrences for a pattern' },
      decayHalfLife:   { type: 'number', default: 168,  description: 'Confidence decay half-life (hours)' },
      maxInstructions: { type: 'number', default: 10,   description: 'Max instructions in prompt block' },
      maxRawErrors:    { type: 'number', default: 1000, description: 'Max raw error records' },
    },
    required: [],
  },

  prompts: {
    properties: {
      maxVersionsPerRole: { type: 'number', default: 50,   description: 'Max prompt versions per role' },
      enableHistory:      { type: 'boolean', default: true, description: 'Track prompt version history' },
    },
    required: [],
  },

  cache: {
    properties: {
      ttlMs:      { type: 'number',  default: 300000, description: 'Cache entry TTL (ms)' },
      maxEntries: { type: 'number',  default: 200,    description: 'Max cached entries' },
      enabled:    { type: 'boolean', default: true,    description: 'Enable LLM response cache' },
    },
    required: [],
  },

  priority: {
    properties: {
      explore:   { type: 'number', default: 100, description: 'Explore task priority' },
      plan:      { type: 'number', default: 90,  description: 'Plan task priority' },
      implement: { type: 'number', default: 70,  description: 'Implement task priority' },
      refactor:  { type: 'number', default: 60,  description: 'Refactor task priority' },
      test:      { type: 'number', default: 50,  description: 'Test task priority' },
      verify:    { type: 'number', default: 40,  description: 'Verify task priority' },
      review:    { type: 'number', default: 30,  description: 'Review task priority' },
      debug:     { type: 'number', default: 20,  description: 'Debug task priority' },
    },
    required: [],
  },
};
