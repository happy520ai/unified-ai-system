/**
 * Gateway Service Bus — Pure helper functions
 *
 * Extracted from gatewayServiceBus.js to keep the main orchestrator
 * under the 500-line limit.  Contains service resolution, initialization,
 * shutdown, and status formatting helpers.
 *
 * @module core/serviceBusHelpers
 */

import { VALID_SERVICE_NAME } from "./gatewayServiceBusWiring.js";

// =============================================================================
// Service resolution
// =============================================================================

/**
 * Capitalize the first letter of a string (for factory/class name lookup).
 *
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Heuristic to detect whether a function is a class constructor
 * (PascalCase name and prototype has own properties beyond constructor).
 *
 * @param {Function} fn
 * @returns {boolean}
 */
export function isClassLike(fn) {
  if (typeof fn !== "function") return false;
  const name = fn.name || "";
  if (name.length > 0 && name[0] !== name[0].toUpperCase()) return false;
  const protoKeys = Object.getOwnPropertyNames(fn.prototype || {});
  return protoKeys.length > 1;
}

/**
 * Safely try to instantiate a class with no arguments.
 *
 * @param {Function} Cls
 * @returns {* | null}
 */
export function tryInstantiate(Cls) {
  try {
    return new Cls();
  } catch (_) {
    return null;
  }
}

/**
 * Resolve a service instance from a dynamically-imported module.
 *
 * Resolution order:
 *   1. module.default — standard ESM default export
 *   2. module.createXxx() — factory function
 *   3. module.getXxx() — singleton accessor
 *   4. new module.XxxClass() — named class constructor
 *   5. module itself — fallback for object-literal modules
 *
 * @param {string} name — service name
 * @param {Function} importFn — zero-arg function returning a dynamic import Promise
 * @returns {Promise<{ instance: * | null, loadTimeMs: number, validationError?: Error }>}
 */
export async function resolveServiceInstance(name, importFn) {
  // Validate service name to prevent injection
  if (!VALID_SERVICE_NAME.test(name)) {
    return {
      instance: null,
      loadTimeMs: 0,
      validationError: new Error(
        `Invalid service name: "${name}". Must match ${VALID_SERVICE_NAME}.`
      ),
    };
  }

  const start = performance.now();

  let mod;
  try {
    mod = await importFn();
  } catch (err) {
    return {
      instance: null,
      loadTimeMs: Math.round(performance.now() - start),
      importError: err,
    };
  }

  let instance = null;

  // Strategy 1: default export
  if (mod.default != null) {
    instance =
      typeof mod.default === "function" && isClassLike(mod.default)
        ? tryInstantiate(mod.default)
        : mod.default;
  }

  // Strategy 2: factory function matching the service name
  if (instance === null) {
    const factoryName = `create${capitalize(name)}`;
    if (typeof mod[factoryName] === "function") {
      try {
        instance = mod[factoryName]();
      } catch (_) {
        /* try next strategy */
      }
    }
  }

  // Strategy 3: singleton accessor
  if (instance === null) {
    const getterName = `get${capitalize(name)}`;
    if (typeof mod[getterName] === "function") {
      try {
        instance = mod[getterName]();
      } catch (_) {
        /* try next strategy */
      }
    }
  }

  // Strategy 4: named class — try PascalCase version of the name
  if (instance === null) {
    const className = capitalize(name);
    if (typeof mod[className] === "function") {
      instance = tryInstantiate(mod[className]);
    }
  }

  // Strategy 4b: try common export names
  if (instance === null) {
    const commonNames = [
      "Service", "Manager", "Executor", "Registry", "Pipeline", "Engine",
    ];
    for (const suffix of commonNames) {
      const candidate = mod[capitalize(name) + suffix];
      if (typeof candidate === "function") {
        instance = tryInstantiate(candidate);
        if (instance !== null) break;
      }
    }
  }

  // Strategy 5: module itself (plain object export)
  if (instance === null && mod !== null && typeof mod === "object") {
    const hasMethods = Object.values(mod).some(
      (v) => typeof v === "function"
    );
    if (hasMethods) {
      instance = mod;
    }
  }

  const loadTimeMs = Math.round(performance.now() - start);
  return { instance, loadTimeMs };
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Collect rejected promises from a Promise.allSettled result array.
 *
 * @param {string} phase
 * @param {Array<PromiseSettledResult<*>>} results
 * @returns {Array<{ service: string, phase: string, error: * }>}
 */
export function collectPhaseErrors(phase, results) {
  const errors = [];
  for (const result of results) {
    if (result.status === "rejected") {
      errors.push({ service: "unknown", phase, error: result.reason });
    }
  }
  return errors;
}

/**
 * Call init() on every loaded service that exposes one.
 *
 * All init() calls run in parallel via Promise.allSettled.  Services
 * without an init() method are marked as initialized immediately.
 *
 * @param {Map} services
 * @param {Set<string>} initializedServices
 * @param {Array} initErrors
 * @returns {Promise<void>}
 */
export async function initializeServices(services, initializedServices, initErrors) {
  const initPromises = [];

  for (const [name, entry] of services) {
    if (entry.instance === null) continue;

    if (typeof entry.instance.init === "function") {
      const p = (async () => {
        const start = performance.now();
        try {
          await entry.instance.init();
          entry.initialized = true;
          initializedServices.add(name);
        } catch (err) {
          entry.initError = err;
          initErrors.push({ service: name, phase: "init", error: err });
        }
        return { name, durationMs: Math.round(performance.now() - start) };
      })();
      initPromises.push(p);
    } else {
      entry.initialized = true;
      initializedServices.add(name);
    }
  }

  if (initPromises.length > 0) {
    await Promise.allSettled(initPromises);
  }
}

// =============================================================================
// Shutdown
// =============================================================================

/** Per-service shutdown timeout in milliseconds. */
const SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * Graceful shutdown — calls shutdown() on every service that supports
 * it, with a 5-second timeout per service to prevent hanging.
 *
 * @param {Map} services
 * @returns {Promise<{ shutDown: string[], errors: Array<{ service: string, error: string }> }>}
 */
export async function shutdownServices(services) {
  const shutDown = [];
  const errors = [];
  const shutdownPromises = [];

  for (const [name, entry] of services) {
    if (
      entry.instance !== null &&
      typeof entry.instance.shutdown === "function"
    ) {
      const p = (async () => {
        try {
          await Promise.race([
            entry.instance.shutdown(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("shutdown timeout")),
                SHUTDOWN_TIMEOUT_MS
              )
            ),
          ]);
          shutDown.push(name);
        } catch (err) {
          errors.push({
            service: name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
      shutdownPromises.push(p);
    }
  }

  if (shutdownPromises.length > 0) {
    await Promise.allSettled(shutdownPromises);
  }

  return { shutDown, errors };
}

// =============================================================================
// Status formatting
// =============================================================================

/**
 * Build the status snapshot for the service bus.
 *
 * @param {boolean} initialized
 * @param {Map} services
 * @param {{ response: import("./lruCache.js").LRUCache, provider: import("./lruCache.js").LRUCache, knowledge: import("./lruCache.js").LRUCache }} caches
 * @param {Array<{ service: string, phase: string, error: Error }>} initErrors
 * @returns {Object}
 */
export function buildStatus(initialized, services, caches, initErrors) {
  const servicesStatus = {};
  for (const [name, entry] of services) {
    servicesStatus[name] = {
      loaded: entry.instance !== null,
      initialized: entry.initialized,
      initError: entry.initError ? entry.initError.message : null,
      loadTimeMs: entry.loadTimeMs,
    };
  }

  return {
    initialized,
    serviceCount: services.size,
    services: servicesStatus,
    caches: {
      response: caches.response.getStats(),
      provider: caches.provider.getStats(),
      knowledge: caches.knowledge.getStats(),
    },
    initErrors: initErrors.map((e) => ({
      service: e.service,
      phase: e.phase,
      error: e.error ? e.error.message : String(e.error),
    })),
  };
}
