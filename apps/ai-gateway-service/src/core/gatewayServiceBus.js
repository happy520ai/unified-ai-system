/**
 * Gateway Service Bus — Central service orchestrator
 *
 * Eagerly initializes ALL services at startup to eliminate first-request
 * latency.  Provides a unified interface for accessing any service in
 * the gateway through O(1) Map lookups.
 *
 * Startup phases:
 *   Phase 1 — Core services (knowledge RAG, task queue, command palette,
 *             provider onboarding).  These are loaded in parallel.
 *   Phase 2 — Capability services (God Review Cell, Tianshu Planner,
 *             Neuron Runtime, Live Skill Registry, Self Evolution).
 *             Loaded in parallel after Phase 1 so they can reference
 *             core services.
 *   Phase 3 — Knowledge enrichment pipeline.  Loaded last because it
 *             depends on the knowledge RAG service from Phase 1.
 *
 * After all modules are resolved, init() is called on every service
 * that exposes one (awaited in parallel), and the event bus is wired
 * so that cross-service events flow automatically.
 *
 * @module core/gatewayServiceBus
 */

import { getEventBus, EVENTS } from "./eventBus.js";
import {
  LRUCache,
  createResponseCache,
  createProviderCache,
  createKnowledgeCache,
} from "./lruCache.js";
import { wireServiceBusEvents } from "./gatewayServiceBusWiring.js";
import {
  resolveServiceInstance,
  collectPhaseErrors,
  initializeServices,
  shutdownServices,
  buildStatus,
} from "./serviceBusHelpers.js";

// =============================================================================
// GatewayServiceBus
// =============================================================================

export class GatewayServiceBus {
  constructor() {
    /**
     * Registered services keyed by name.
     * @type {Map<string, { instance: *, initialized: boolean, initError: Error|null, loadTimeMs: number }>}
     */
    this.services = new Map();

    /** @type {import("./eventBus.js").GatewayEventBus} */
    this.eventBus = getEventBus();

    /**
     * Pre-configured cache instances keyed by purpose.
     * @type {{ response: LRUCache, provider: LRUCache, knowledge: LRUCache }}
     */
    this.caches = {
      response: createResponseCache(),
      provider: createProviderCache(),
      knowledge: createKnowledgeCache(),
    };

    /** @type {boolean} */
    this.initialized = false;

    /**
     * Errors collected during service loading and initialization.
     * @type {Array<{ service: string, phase: string, error: Error }>}
     */
    this.initErrors = [];

    /** @type {number} performance.now() timestamp when initialize() was called */
    this.initStartTime = 0;

    /**
     * Tracks which services have completed init().
     * @type {Set<string>}
     * @private
     */
    this._initializedServices = new Set();
  }

  // ---------------------------------------------------------------------------
  // Startup
  // ---------------------------------------------------------------------------

  /**
   * Initialize ALL services eagerly — called once at startup.
   *
   * Each phase loads its services in parallel via Promise.allSettled so
   * that one failing module cannot block the others.  After all phases
   * complete, init() is called on every successfully-loaded service,
   * and the event bus is wired for cross-service communication.
   *
   * @returns {Promise<{ serviceCount: number, durationMs: number, errors: Array }>}
   */
  async initialize() {
    this.initStartTime = performance.now();

    // ── Phase 1: Core services (parallel) ───────────────────────────────
    const phase1 = await Promise.allSettled([
      this._loadService(
        "knowledgeRAG",
        () => import("../knowledge/personalKnowledgeRAG.js")
      ),
      this._loadService(
        "taskQueue",
        () => import("../workforce/taskQueueManager.js")
      ),
      this._loadService(
        "commandPalette",
        () => import("../automation/commandPaletteService.js")
      ),
      this._loadService(
        "providerOnboarding",
        () => import("../providers/providerOnboardingService.js")
      ),
    ]);
    this.initErrors.push(...collectPhaseErrors("phase1", phase1));

    // ── Phase 2: Capability services (parallel, after phase 1) ──────────
    const phase2 = await Promise.allSettled([
      this._loadService(
        "godReviewExecutor",
        () => import("../capabilities/godReviewCellExecutor.js")
      ),
      this._loadService(
        "tianshuPlanner",
        () => import("../capabilities/tianshuPlannerExecutor.js")
      ),
      this._loadService(
        "neuronExecutor",
        () => import("../capabilities/neuronRuntimeExecutor.js")
      ),
      this._loadService(
        "liveSkillRegistry",
        () => import("../capabilities/liveSkillRegistry.js")
      ),
      this._loadService(
        "selfEvolutionPipeline",
        () => import("../capabilities/selfEvolutionPipeline.js")
      ),
    ]);
    this.initErrors.push(...collectPhaseErrors("phase2", phase2));

    // ── Phase 3: Knowledge enrichment (depends on knowledgeRAG) ─────────
    await this._loadService(
      "knowledgeEnrichment",
      () => import("../knowledge/knowledgeEnrichmentPipeline.js")
    ).catch((err) => {
      this.initErrors.push({
        service: "knowledgeEnrichment",
        phase: "phase3",
        error: err,
      });
    });

    // ── Initialize loaded services ──────────────────────────────────────
    await initializeServices(
      this.services,
      this._initializedServices,
      this.initErrors
    );

    // ── Wire up event bus connections between services ──────────────────
    this._wireEventBus();

    // ── Done ────────────────────────────────────────────────────────────
    this.initialized = true;
    const durationMs = Math.round(performance.now() - this.initStartTime);

    this.eventBus.fire(EVENTS.SERVICE_INITIALIZED, {
      serviceCount: this.services.size,
      durationMs,
      errors: this.initErrors,
    });

    return {
      serviceCount: this.services.size,
      durationMs,
      errors: this.initErrors,
    };
  }

  // ---------------------------------------------------------------------------
  // Service loading (delegates to resolveServiceInstance)
  // ---------------------------------------------------------------------------

  /**
   * Dynamically import a service module and register it.
   *
   * @param {string}   name      — service name used as the Map key
   * @param {Function} importFn  — zero-arg function returning a dynamic import Promise
   * @returns {Promise<void>}
   * @private
   */
  async _loadService(name, importFn) {
    const result = await resolveServiceInstance(name, importFn);

    if (result.validationError) {
      this.initErrors.push({
        service: name,
        phase: "validation",
        error: result.validationError,
      });
      return;
    }

    if (result.importError) {
      this.initErrors.push({
        service: name,
        phase: "import",
        error: result.importError,
      });
      return;
    }

    this.services.set(name, {
      instance: result.instance,
      initialized: false,
      initError: null,
      loadTimeMs: result.loadTimeMs,
    });
  }

  // ---------------------------------------------------------------------------
  // Event bus wiring (delegates to wireServiceBusEvents)
  // ---------------------------------------------------------------------------

  /**
   * Wire up event bus listeners to create cross-service data flows.
   * @private
   */
  _wireEventBus() {
    wireServiceBusEvents(
      this.eventBus,
      (name) => this.getService(name),
      this.caches,
      EVENTS
    );
  }

  // ---------------------------------------------------------------------------
  // Service access
  // ---------------------------------------------------------------------------

  /**
   * Get a service instance by name — O(1) Map lookup, no import overhead.
   *
   * @param {string} name — service name (e.g. "knowledgeRAG", "taskQueue")
   * @returns {* | null}
   */
  getService(name) {
    const entry = this.services.get(name);
    if (!entry) return null;
    return entry.instance;
  }

  /**
   * Check if a service is available and loaded.
   *
   * @param {string} name
   * @returns {boolean}
   */
  hasService(name) {
    const entry = this.services.get(name);
    return entry != null && entry.instance != null;
  }

  /**
   * Get a pre-configured cache instance.
   *
   * @param {"response" | "provider" | "knowledge"} name
   * @returns {LRUCache | undefined}
   */
  getCache(name) {
    return this.caches[name];
  }

  /**
   * Get the shared event bus instance.
   *
   * @returns {import("./eventBus.js").GatewayEventBus}
   */
  getEventBus() {
    return this.eventBus;
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  /**
   * Get the current initialization status of the service bus.
   *
   * @returns {{
   *   initialized: boolean,
   *   serviceCount: number,
   *   services: Record<string, { loaded: boolean, initialized: boolean, initError: string|null, loadTimeMs: number }>,
   *   caches: Record<string, Object>,
   *   initErrors: Array<{ service: string, phase: string, error: string }>,
   * }}
   */
  getStatus() {
    return buildStatus(
      this.initialized,
      this.services,
      this.caches,
      this.initErrors
    );
  }

  /**
   * List all registered service names.
   *
   * @returns {string[]}
   */
  listServices() {
    return Array.from(this.services.keys());
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  /**
   * Graceful shutdown — calls shutdown() on every service that supports
   * it, clears all caches, and resets the event bus.
   *
   * @returns {Promise<{ shutDown: string[], errors: Array<{ service: string, error: string }> }>}
   */
  async shutdown() {
    const result = await shutdownServices(this.services);

    // Clear caches.
    this.caches.response.clear();
    this.caches.provider.clear();
    this.caches.knowledge.clear();

    // Reset the event bus so no stale listeners remain.
    this.eventBus.reset();

    this.initialized = false;

    return result;
  }
}

// =============================================================================
// Singleton
// =============================================================================

/** @type {GatewayServiceBus | null} */
let _instance = null;

/**
 * Get (or lazily create) the global singleton service bus.
 *
 * @returns {GatewayServiceBus}
 */
export function getServiceBus() {
  if (!_instance) _instance = new GatewayServiceBus();
  return _instance;
}

export default getServiceBus;
