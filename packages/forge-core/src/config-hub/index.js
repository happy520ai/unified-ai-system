/**
 * UnifiedConfigHub -- centralized configuration manager for all Forge modules.
 *
 * Resolution priority (highest first):
 *   1. Environment variables   (FORGE_MODULE__KEY=value)
 *   2. Runtime overrides        (set() / setMany() / loadFromFile())
 *   3. Schema defaults          (registered via registerSchema())
 *
 * Environment variable mapping:
 *   FORGE_MEMORY__HOT_MAX_ENTRIES=1000 -> { memory: { hotMaxEntries: 1000 } }
 *   Double underscore separates module name from key; snake_case -> camelCase.
 *
 * @module config-hub
 */

import { readFile } from 'node:fs/promises';
import {
  DEFAULT_ENV_PREFIX,
  ENV_MODULE_SEP,
  toCamelCase,
  coerceType,
  deepClone,
  deepMerge,
  setNested,
  getNested,
  CORE_SCHEMAS,
} from './helpers.js';

// =============================================================================
//  UnifiedConfigHub
// =============================================================================

export class UnifiedConfigHub {
  /** @type {Map<string, object>} Registered schemas keyed by module name. */
  #schemas = new Map();

  /** @type {Map<string, object>} Runtime overrides keyed by module name. */
  #overrides = new Map();

  /** @type {Map<string, object>} Resolved environment variable values keyed by module name. */
  #envValues = new Map();

  /** @type {Map<string, Array<{ key: string, envVar: string }>>} Env var mappings per module. */
  #envMappings = new Map();

  /** @type {Map<string, Array<function>>} Change subscribers keyed by module name. */
  #subscribers = new Map();

  /** @type {string} Environment variable prefix. */
  #envPrefix;

  /** @type {boolean} Whether strict validation rejects unknown keys. */
  #strictValidation;

  /** @type {object} Global defaults supplied at construction time. */
  #globalDefaults;

  /**
   * @param {object} [opts]
   * @param {object} [opts.defaults={}] -- global defaults applied to every module
   * @param {string} [opts.envPrefix='FORGE_'] -- environment variable prefix
   * @param {boolean} [opts.strictValidation=false] -- reject unknown keys in validation
   */
  constructor(opts = {}) {
    this.#globalDefaults = opts.defaults ?? {};
    this.#envPrefix = opts.envPrefix ?? DEFAULT_ENV_PREFIX;
    this.#strictValidation = opts.strictValidation ?? false;

    // Pre-register core module schemas
    for (const [name, schema] of Object.entries(CORE_SCHEMAS)) {
      this.registerSchema(name, schema);
    }
  }

  // ---------------------------------------------------------------------------
  //  Schema registration
  // ---------------------------------------------------------------------------

  /**
   * Register a module's configuration schema.
   * @param {string} moduleName -- unique module identifier
   * @param {object} schema
   * @param {object} schema.properties -- property descriptors
   * @param {string[]} [schema.required=[]] -- list of required property names
   *
   * Property descriptor fields:
   *   - type: 'string' | 'number' | 'boolean' | 'object' | 'array'
   *   - default: default value
   *   - description: human-readable description
   *   - env: optional explicit env var suffix (e.g. 'MEMORY__HOT_MAX_ENTRIES')
   *   - validate: optional custom validation function (value) => string|null
   *   - min / max: optional numeric range constraints
   */
  registerSchema(moduleName, schema) {
    this.#schemas.set(moduleName, {
      properties: schema.properties ?? {},
      required: schema.required ?? [],
    });
  }

  // ---------------------------------------------------------------------------
  //  Config resolution
  // ---------------------------------------------------------------------------

  /**
   * Get the resolved configuration for a module.
   * Resolution order (highest priority first): env overrides > runtime overrides > schema defaults.
   * @param {string} moduleName
   * @returns {object} merged configuration object
   */
  get(moduleName) {
    const schema = this.#schemas.get(moduleName);
    if (!schema) {
      return deepClone(this.#overrides.get(moduleName) ?? {});
    }

    // Layer 1: schema defaults
    const defaults = {};
    for (const [key, desc] of Object.entries(schema.properties)) {
      if (desc.default !== undefined) {
        defaults[key] = deepClone(desc.default);
      }
    }

    // Layer 2: runtime overrides
    const overrides = this.#overrides.get(moduleName) ?? {};

    // Layer 3: environment variable values
    const envVals = this.#envValues.get(moduleName) ?? {};

    return deepMerge(deepMerge(defaults, overrides), envVals);
  }

  // ---------------------------------------------------------------------------
  //  Setters
  // ---------------------------------------------------------------------------

  /**
   * Set a configuration override for a module.
   * @param {string} moduleName
   * @param {string} key -- property name (supports dot-separated nested paths)
   * @param {*} value
   * @returns {boolean} true if the value changed
   */
  set(moduleName, key, value) {
    if (!this.#overrides.has(moduleName)) {
      this.#overrides.set(moduleName, {});
    }

    const bag = this.#overrides.get(moduleName);
    const oldValue = key.includes('.') ? getNested(bag, key) : bag[key];
    const changed = oldValue !== value;

    if (key.includes('.')) {
      setNested(bag, key, value);
    } else {
      bag[key] = value;
    }

    if (changed) {
      this.#notifySubscribers(moduleName);
    }

    return changed;
  }

  /**
   * Set multiple configuration overrides at once for a module.
   * @param {string} moduleName
   * @param {object} overrides -- key-value pairs to set
   */
  setMany(moduleName, overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      this.set(moduleName, key, value);
    }
  }

  /** Reset a module's configuration to its schema defaults (remove overrides). */
  reset(moduleName) {
    if (this.#overrides.has(moduleName)) {
      this.#overrides.delete(moduleName);
      this.#notifySubscribers(moduleName);
    }
  }

  // ---------------------------------------------------------------------------
  //  File / env loading
  // ---------------------------------------------------------------------------

  /**
   * Load configuration overrides from a JSON file.
   * Top-level keys are module names, values are override objects.
   * @param {string} filePath
   * @returns {Promise<{ loaded: number, modules: string[] }>}
   */
  async loadFromFile(filePath) {
    let loaded = 0;
    const modules = [];

    try {
      const raw = await readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);

      for (const [moduleName, overrides] of Object.entries(data)) {
        if (typeof overrides === 'object' && overrides !== null) {
          this.setMany(moduleName, overrides);
          modules.push(moduleName);
          loaded += Object.keys(overrides).length;
        }
      }
    } catch {
      // File does not exist or is corrupt -- no-op
    }

    return { loaded, modules };
  }

  /**
   * Load configuration overrides from environment variables.
   * Scans process.env for variables matching {prefix}{MODULE}__{KEY}.
   * @returns {{ loaded: number, mappings: Array<{ module: string, key: string, envVar: string }> }}
   */
  loadFromEnv() {
    let loaded = 0;
    const mappings = [];
    const env = typeof process !== 'undefined' ? process.env ?? {} : {};

    for (const [envVar, rawValue] of Object.entries(env)) {
      if (!envVar.startsWith(this.#envPrefix)) continue;

      const suffix = envVar.slice(this.#envPrefix.length);
      const sepIdx = suffix.indexOf(ENV_MODULE_SEP);
      if (sepIdx === -1) continue;

      const moduleName = suffix.slice(0, sepIdx).toLowerCase();
      const rawKey = suffix.slice(sepIdx + ENV_MODULE_SEP.length);
      const key = toCamelCase(rawKey);

      const schema = this.#schemas.get(moduleName);
      const propDesc = schema?.properties?.[key];
      const type = propDesc?.type ?? 'string';
      const value = coerceType(rawValue, type);

      if (!this.#envValues.has(moduleName)) {
        this.#envValues.set(moduleName, {});
      }
      this.#envValues.get(moduleName)[key] = value;

      if (!this.#envMappings.has(moduleName)) {
        this.#envMappings.set(moduleName, []);
      }
      this.#envMappings.get(moduleName).push({ key, envVar });

      mappings.push({ module: moduleName, key, envVar });
      loaded++;

      this.#notifySubscribers(moduleName);
    }

    return { loaded, mappings };
  }

  // ---------------------------------------------------------------------------
  //  Validation
  // ---------------------------------------------------------------------------

  /** Validate all registered module configs against their schemas. */
  validate() {
    const errors = [];
    for (const moduleName of this.#schemas.keys()) {
      const result = this.validateModule(moduleName);
      errors.push(...result.errors);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a specific module's resolved config against its schema.
   * Checks: required fields, type correctness, numeric range, custom validate, unknown keys (strict).
   * @param {string} moduleName
   * @returns {{ valid: boolean, errors: Array<{ module: string, key: string, message: string }> }}
   */
  validateModule(moduleName) {
    const errors = [];
    const schema = this.#schemas.get(moduleName);
    if (!schema) return { valid: true, errors };

    const config = this.get(moduleName);
    const properties = schema.properties;

    // Required field validation
    for (const key of schema.required) {
      if (config[key] === undefined || config[key] === null) {
        errors.push({ module: moduleName, key, message: `Required field "${key}" is missing` });
      }
    }

    // Type and constraint validation
    for (const [key, desc] of Object.entries(properties)) {
      const value = config[key];
      if (value === undefined || value === null) continue;

      if (desc.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== desc.type) {
          errors.push({
            module: moduleName, key,
            message: `Expected type "${desc.type}" but got "${actualType}"`,
          });
          continue;
        }
      }

      if (desc.type === 'number' && typeof value === 'number') {
        if (desc.min !== undefined && value < desc.min) {
          errors.push({ module: moduleName, key, message: `Value ${value} is below minimum ${desc.min}` });
        }
        if (desc.max !== undefined && value > desc.max) {
          errors.push({ module: moduleName, key, message: `Value ${value} exceeds maximum ${desc.max}` });
        }
      }

      if (typeof desc.validate === 'function') {
        const msg = desc.validate(value);
        if (msg) errors.push({ module: moduleName, key, message: msg });
      }
    }

    // Strict mode: reject unknown keys
    if (this.#strictValidation) {
      const knownKeys = new Set(Object.keys(properties));
      for (const key of Object.keys(config)) {
        if (!knownKeys.has(key)) {
          errors.push({ module: moduleName, key, message: `Unknown configuration key in strict mode` });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ---------------------------------------------------------------------------
  //  Export / Import
  // ---------------------------------------------------------------------------

  /** Get a flat map of all resolved configuration values (for debugging / export). */
  export() {
    const result = {};
    for (const moduleName of this.#schemas.keys()) {
      result[moduleName] = this.get(moduleName);
    }
    for (const moduleName of this.#overrides.keys()) {
      if (!result[moduleName]) result[moduleName] = this.get(moduleName);
    }
    return result;
  }

  /**
   * Import configuration from a flat map (inverse of export).
   * @param {Object<string, object>} configMap
   * @returns {{ imported: number, modules: string[] }}
   */
  import(configMap) {
    let imported = 0;
    const modules = [];
    for (const [moduleName, overrides] of Object.entries(configMap)) {
      if (typeof overrides !== 'object' || overrides === null) continue;
      this.setMany(moduleName, overrides);
      modules.push(moduleName);
      imported += Object.keys(overrides).length;
    }
    return { imported, modules };
  }

  // ---------------------------------------------------------------------------
  //  Change subscriptions (hot-reload support)
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to configuration changes for a specific module.
   * @param {string} moduleName
   * @param {function} callback -- (moduleName, config) => void
   * @returns {function} unsubscribe function
   */
  onChange(moduleName, callback) {
    if (!this.#subscribers.has(moduleName)) {
      this.#subscribers.set(moduleName, []);
    }
    this.#subscribers.get(moduleName).push(callback);

    return () => {
      const subs = this.#subscribers.get(moduleName);
      if (!subs) return;
      const idx = subs.indexOf(callback);
      if (idx !== -1) subs.splice(idx, 1);
    };
  }

  // ---------------------------------------------------------------------------
  //  Introspection
  // ---------------------------------------------------------------------------

  /** Get all registered module names. */
  listModules() {
    return [...this.#schemas.keys()];
  }

  /** Get the schema for a specific module. */
  getSchema(moduleName) {
    const schema = this.#schemas.get(moduleName);
    return schema ? deepClone(schema) : null;
  }

  /** Get a summary of the current configuration status. */
  getStatus() {
    let overrideCount = 0;
    for (const bag of this.#overrides.values()) {
      overrideCount += Object.keys(bag).length;
    }
    let envCount = 0;
    for (const m of this.#envMappings.values()) {
      envCount += m.length;
    }
    return {
      modules: this.listModules(),
      schemas: this.#schemas.size,
      overrides: overrideCount,
      envMappings: envCount,
    };
  }

  // ---------------------------------------------------------------------------
  //  Lifecycle
  // ---------------------------------------------------------------------------

  /** Clear all runtime overrides and environment variable values. Schemas preserved. */
  clearOverrides() {
    const affectedModules = new Set([
      ...this.#overrides.keys(),
      ...this.#envValues.keys(),
    ]);
    this.#overrides.clear();
    this.#envValues.clear();
    this.#envMappings.clear();
    for (const moduleName of affectedModules) {
      this.#notifySubscribers(moduleName);
    }
  }

  /** Clear everything: schemas, overrides, env values, and subscribers. */
  clear() {
    this.#schemas.clear();
    this.#overrides.clear();
    this.#envValues.clear();
    this.#envMappings.clear();
    this.#subscribers.clear();
  }

  // ===========================================================================
  //  Private helpers
  // ===========================================================================

  /** Notify all subscribers that a module's configuration has changed. */
  #notifySubscribers(moduleName) {
    const subs = this.#subscribers.get(moduleName);
    if (!subs || subs.length === 0) return;

    const config = this.get(moduleName);
    for (const cb of subs) {
      try {
        cb(moduleName, config);
      } catch {
        // Subscriber callback errors are silently ignored to prevent cascading failures
      }
    }
  }
}
