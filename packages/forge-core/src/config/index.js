/**
 * ForgeConfig — centralized configuration with YAML file, environment
 * variable overrides, and hot-reload support.
 *
 * Config values are resolved once at load time and can be refreshed by
 * calling reload().  File watching is optional (enable with watch()).
 *
 * Priority:  env vars  >  forge.config.yaml  >  built-in defaults
 */

import { readFileSync } from 'node:fs';
import { watch as fsWatch } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

// ── Built-in defaults (used when file/env are absent) ─────────────────────

const DEFAULTS = {
  pool: {
    maxConcurrent: 4, maxGoals: 3,
    enableCodeIntel: true, enableVerification: true, enableAutoVerify: true,
    maxVerifyRetries: 2, verifyMaxTier: 2,
    shutdownTimeout: 30000, goalCleanupDelay: 5000,
  },
  budget: {
    maxTokens: 500_000, maxCost: 10.0, maxMinutes: 120,
    warningThreshold: 0.8, criticalThreshold: 0.95,
  },
  server: {
    port: 4500, corsOrigin: '*', snapshotInterval: 5000, version: '0.4.0',
  },
  llm: {
    provider: 'xiaomi', model: 'mimo-v2.5-pro',
    temperature: 0.2, maxTokens: 4096,
    gatewayUrl: 'http://127.0.0.1:3100',
  },
  worker: {
    temperature: 0.1, maxTokensMutate: 32768, maxTokensRead: 8192,
    retryAttempts: 3, retryDelay: 2000, bashTimeout: 60000,
    maxFileSize: 50000, fileSliceLimit: 8000,
  },
  verification: {
    maxTier: 5, typescriptTimeout: 120000, eslintTimeout: 60000,
    eslintMaxWarnings: 50, testTimeout: 120000,
    integrationTimeout: 180000, npmAuditTimeout: 60000,
  },
  metrics: { seriesWindow: 1_800_000, maxRecords: 5000 },
  priority: {
    explore: 100, plan: 90, implement: 70, refactor: 60,
    test: 50, verify: 40, review: 30, debug: 20,
  },
};

// ── Environment variable mapping ──────────────────────────────────────────

const ENV_MAP = {
  FORGE_POOL_MAX_CONCURRENT:  'pool.maxConcurrent',
  FORGE_POOL_MAX_GOALS:       'pool.maxGoals',
  FORGE_POOL_AUTO_VERIFY:     'pool.enableAutoVerify',
  FORGE_MAX_CONCURRENT:       'pool.maxConcurrent',
  FORGE_MAX_TOKENS:           'budget.maxTokens',
  FORGE_MAX_COST:             'budget.maxCost',
  FORGE_MAX_MINUTES:          'budget.maxMinutes',
  FORGE_CODE_INTEL:           'pool.enableCodeIntel',
  FORGE_SERVER_PORT:          'server.port',
  FORGE_CORS_ORIGIN:          'server.corsOrigin',
  FORGE_SNAPSHOT_INTERVAL:    'server.snapshotInterval',
  FORGE_LLM_PROVIDER:        'llm.provider',
  FORGE_LLM_MODEL:           'llm.model',
  FORGE_LLM_TEMPERATURE:     'llm.temperature',
  FORGE_LLM_MAX_TOKENS:      'llm.maxTokens',
  FORGE_GATEWAY_URL:         'llm.gatewayUrl',
  FORGE_WORKER_TEMPERATURE:  'worker.temperature',
  FORGE_WORKER_BASH_TIMEOUT: 'worker.bashTimeout',
  FORGE_VERIFY_MAX_TIER:     'verification.maxTier',
  FORGE_METRICS_WINDOW:      'metrics.seriesWindow',
  FORGE_METRICS_MAX_RECORDS: 'metrics.maxRecords',
};

// ── Simple YAML parser ───────────────────────────────────────────────────

/**
 * Parse a flat or one-level-nested YAML string into an object.
 *
 * Supports:
 *   - `#` comments
 *   - `key: value` pairs
 *   - One level of nesting via indentation
 *   - Automatic type coercion (numbers, booleans)
 *   - Quoted strings (single and double)
 */
function parseSimpleYaml(text) {
  const result = {};
  let section = null;

  for (const raw of text.split('\n')) {
    const stripped = raw.replace(/#.*$/, '').trimEnd();
    if (stripped.trim() === '') continue;

    const indent = stripped.length - stripped.trimStart().length;
    const line = stripped.trim();

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)/);
    if (!kv) continue;

    const [, key, rawVal] = kv;

    if (indent === 0 && (rawVal === '' || rawVal === undefined)) {
      // Section header
      section = key;
      if (!result[section]) result[section] = {};
      continue;
    }

    const value = coerceValue(rawVal.trim());

    if (indent > 0 && section) {
      result[section][key] = value;
    } else {
      section = null;
      result[key] = value;
    }
  }

  return result;
}

function coerceValue(str) {
  if (str === '' || str === '~' || str === 'null') return null;
  if (str === 'true' || str === 'True' || str === 'TRUE') return true;
  if (str === 'false' || str === 'False' || str === 'FALSE') return false;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

// ── Deep merge helper ────────────────────────────────────────────────────

function deepMerge(target, source) {
  const out = {};
  // Deep-clone all target keys first (avoids shared references with DEFAULTS)
  for (const [k, v] of Object.entries(target)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(v, {});
    } else {
      out[k] = v;
    }
  }
  // Merge source on top
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) &&
        typeof target[k] === 'object' && target[k] !== null) {
      out[k] = deepMerge(target[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── ForgeConfig class ────────────────────────────────────────────────────

export class ForgeConfig extends EventEmitter {
  #config = {};
  #filePath;
  #watcher = null;
  #lastModified = 0;

  /**
   * @param {object} [opts]
   * @param {string} [opts.configPath] — path to forge.config.yaml
   * @param {string} [opts.projectRoot] — project root (used to resolve default path)
   * @param {boolean} [opts.autoLoad=true] — load config immediately
   */
  constructor({ configPath, projectRoot, autoLoad = true } = {}) {
    super();
    this.#filePath = configPath
      || (projectRoot ? join(projectRoot, 'forge.config.yaml') : null);

    if (autoLoad) this.load();
  }

  // ── Core API ──────────────────────────────────────────────────────────

  /**
   * Load (or reload) configuration from file + env vars.
   *
   * @returns {object} the resolved config object
   */
  load() {
    let fileConfig = {};
    if (this.#filePath) {
      try {
        const text = readFileSync(this.#filePath, 'utf-8');
        fileConfig = parseSimpleYaml(text);
      } catch {
        // File doesn't exist or is unreadable — use defaults only
      }
    }

    // Merge: defaults ← file ← env
    this.#config = deepMerge(DEFAULTS, fileConfig);
    this.#applyEnvOverrides();

    return this.#config;
  }

  /**
   * Reload from file and emit 'change' if values differ.
   */
  reload() {
    const prev = JSON.stringify(this.#config);
    this.load();
    const next = JSON.stringify(this.#config);
    if (prev !== next) {
      this.emit('change', this.#config);
    }
  }

  /**
   * Start watching the config file for changes.
   *
   * @param {number} [debounceMs=500] — debounce interval
   */
  watch(debounceMs = 500) {
    if (this.#watcher || !this.#filePath) return;
    let timer = null;
    this.#watcher = fsWatch(this.#filePath, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        this.reload();
        timer = null;
      }, debounceMs);
    });
  }

  /** Stop watching the config file. */
  unwatch() {
    if (this.#watcher) {
      this.#watcher.close();
      this.#watcher = null;
    }
  }

  // ── Section getters ───────────────────────────────────────────────────

  /** Full resolved config. */
  get all() { return this.#config; }

  get pool() { return this.#config.pool || DEFAULTS.pool; }
  get budget() { return this.#config.budget || DEFAULTS.budget; }
  get server() { return this.#config.server || DEFAULTS.server; }
  get llm() { return this.#config.llm || DEFAULTS.llm; }
  get worker() { return this.#config.worker || DEFAULTS.worker; }
  get verification() { return this.#config.verification || DEFAULTS.verification; }
  get metrics() { return this.#config.metrics || DEFAULTS.metrics; }
  get priority() { return this.#config.priority || DEFAULTS.priority; }

  /**
   * Get a single value by dot-path (e.g., 'pool.maxConcurrent').
   *
   * @param {string} path
   * @param {*} [fallback]
   * @returns {*}
   */
  get(path, fallback) {
    const parts = path.split('.');
    let obj = this.#config;
    for (const p of parts) {
      if (obj == null || typeof obj !== 'object') return fallback;
      obj = obj[p];
    }
    return obj !== undefined ? obj : fallback;
  }

  /**
   * Set a value at runtime (does NOT persist to file).
   * Emits 'change' if the new value differs from the old value.
   *
   * @param {string} path — dot-path
   * @param {*} value
   */
  set(path, value) {
    this.#setAt(path, value, true);
  }

  /**
   * Return a serializable summary of the current configuration.
   * Hides sensitive values (API keys, etc.).
   */
  getStatus() {
    return {
      source: this.#filePath || 'defaults',
      sections: Object.keys(this.#config),
      pool: this.pool,
      budget: this.budget,
      server: { ...this.server, corsOrigin: this.server.corsOrigin },
      llm: { ...this.llm, gatewayUrl: this.llm.gatewayUrl },
      worker: this.worker,
      verification: this.verification,
      metrics: this.metrics,
      priority: this.priority,
      watching: !!this.#watcher,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  /**
   * Internal setter with optional event suppression.
   * Used by load() to apply env overrides without emitting spurious events.
   */
  #setAt(path, value, emit = true) {
    const parts = path.split('.');
    let obj = this.#config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]];
    }
    const key = parts[parts.length - 1];
    const old = obj[key];
    obj[key] = value;
    if (emit && old !== value) {
      this.emit('change', this.#config);
    }
  }

  #applyEnvOverrides() {
    for (const [envKey, configPath] of Object.entries(ENV_MAP)) {
      const raw = process.env[envKey];
      if (raw === undefined) continue;

      const value = coerceValue(raw);
      this.#setAt(configPath, value, false);   // suppress events during load
    }
  }
}
