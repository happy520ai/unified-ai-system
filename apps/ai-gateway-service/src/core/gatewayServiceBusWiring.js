/**
 * Gateway Service Bus — Event bus wiring & constants
 *
 * Extracted from gatewayServiceBus.js to keep the main orchestrator
 * under the 500-line limit.  Contains the cross-service event wiring
 * logic and shared validation constants.
 *
 * @module core/gatewayServiceBusWiring
 */

/** Valid service name pattern: alphanumeric with camelCase */
export const VALID_SERVICE_NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

/** Set of known/expected service names to prevent arbitrary injection */
export const KNOWN_SERVICE_NAMES = new Set([
  "knowledgeRAG", "taskQueue", "commandPalette", "providerOnboarding",
  "knowledgeEnrichment", "godReviewExecutor", "tianshuPlanner",
  "neuronExecutor", "liveSkillRegistry", "selfEvolutionPipeline",
]);

/**
 * Wire up event bus listeners to create cross-service data flows.
 *
 * Each listener uses getService() at call-time (not wire-time) so
 * that late-arriving or optional services are handled gracefully.
 *
 * @param {import("./eventBus.js").GatewayEventBus} bus
 * @param {Function} getService — (name: string) => service instance | null
 * @param {{ response: import("./lruCache.js").LRUCache, provider: import("./lruCache.js").LRUCache, knowledge: import("./lruCache.js").LRUCache }} caches
 * @param {typeof import("./eventBus.js").EVENTS} EVENTS
 */
export function wireServiceBusEvents(bus, getService, caches, EVENTS) {
  // ── Chat completion -> Task Queue ─────────────────────────────────
  // When a chat execution completes and carries a taskId, mark the
  // corresponding task as complete so the workforce layer stays in sync.
  bus.on(
    EVENTS.CHAT_EXECUTION_COMPLETED,
    (payload) => {
      if (!payload || !payload.taskId) return;
      const taskQueue = getService("taskQueue");
      if (taskQueue && typeof taskQueue.completeTask === "function") {
        taskQueue.completeTask(payload.taskId, payload).catch((err) => { console.warn("[serviceBus] taskQueue.completeTask failed:", err?.message); });
      }
    },
    { priority: 30, label: "serviceBus:chatComplete→taskQueue" }
  );

  // ── Knowledge ingested -> Cache invalidation + Enrichment ─────────
  bus.on(
    EVENTS.KNOWLEDGE_INGESTED,
    (payload) => {
      // Invalidate the knowledge cache so subsequent queries see fresh data.
      caches.knowledge.clear();

      // Trigger the enrichment pipeline if available.
      const enrichment = getService("knowledgeEnrichment");
      if (
        enrichment &&
        typeof enrichment.processNewKnowledge === "function"
      ) {
        enrichment.processNewKnowledge(payload).catch((err) => { console.warn("[serviceBus] enrichment.processNewKnowledge failed:", err?.message); });
      } else if (enrichment && typeof enrichment.process === "function") {
        enrichment.process(payload).catch((err) => { console.warn("[serviceBus] enrichment.process failed:", err?.message); });
      }
    },
    { priority: 20, label: "serviceBus:knowledgeIngested→enrichment" }
  );

  // ── Provider health changed -> Cache invalidation ─────────────────
  bus.on(
    EVENTS.PROVIDER_HEALTH_CHANGED,
    () => {
      caches.provider.clear();
    },
    { priority: 10, label: "serviceBus:providerHealth→cacheInvalidation" }
  );

  // ── Provider circuit breaker open -> Cache invalidation + alert ───
  bus.on(
    EVENTS.PROVIDER_CIRCUIT_OPEN,
    (payload) => {
      caches.provider.clear();

      // Notify self-evolution pipeline so it can adapt routing.
      const evolution = getService("selfEvolutionPipeline");
      if (evolution && typeof evolution.onProviderCircuitOpen === "function") {
        evolution.onProviderCircuitOpen(payload).catch((err) => { console.warn("[serviceBus] evolution.onProviderCircuitOpen failed:", err?.message); });
      }
    },
    { priority: 15, label: "serviceBus:circuitOpen→cacheAndEvolution" }
  );

  // ── Provider circuit breaker closed -> Refresh ────────────────────
  bus.on(
    EVENTS.PROVIDER_CIRCUIT_CLOSED,
    () => {
      caches.provider.clear();
    },
    { priority: 15, label: "serviceBus:circuitClosed→cacheRefresh" }
  );

  // ── Provider onboarded -> Refresh provider cache ──────────────────
  bus.on(
    EVENTS.PROVIDER_ONBOARDED,
    () => {
      caches.provider.clear();
    },
    { priority: 20, label: "serviceBus:providerOnboarded→cacheRefresh" }
  );

  // ── Neuron events -> Neuron executor passthrough ──────────────────
  bus.on(
    EVENTS.NEURON_BEFORE_CHAT,
    (payload) => {
      const neuronExec = getService("neuronExecutor");
      if (neuronExec && typeof neuronExec.onBeforeChat === "function") {
        neuronExec.onBeforeChat(payload);
      }
    },
    { priority: 40, label: "serviceBus:neuronBeforeChat→executor" }
  );

  bus.on(
    EVENTS.NEURON_AFTER_MODEL,
    (payload) => {
      const neuronExec = getService("neuronExecutor");
      if (neuronExec && typeof neuronExec.onAfterModel === "function") {
        neuronExec.onAfterModel(payload);
      }
    },
    { priority: 40, label: "serviceBus:neuronAfterModel→executor" }
  );

  // ── Chat evidence captured -> God Review Cell ─────────────────────
  bus.on(
    EVENTS.CHAT_EVIDENCE_CAPTURED,
    (payload) => {
      const godReview = getService("godReviewExecutor");
      if (godReview && typeof godReview.reviewEvidence === "function") {
        godReview.reviewEvidence(payload).catch((err) => { console.warn("[serviceBus] godReview.reviewEvidence failed:", err?.message); });
      } else if (godReview && typeof godReview.execute === "function") {
        godReview.execute({ type: "evidence", payload }).catch((err) => { console.warn("[serviceBus] godReview.execute failed:", err?.message); });
      }
    },
    { priority: 50, label: "serviceBus:evidence→godReview" }
  );

  // ── Chat intent classified -> Tianshu Planner ─────────────────────
  bus.on(
    EVENTS.CHAT_INTENT_CLASSIFIED,
    (payload) => {
      const planner = getService("tianshuPlanner");
      if (planner && typeof planner.onIntentClassified === "function") {
        planner.onIntentClassified(payload).catch((err) => { console.warn("[serviceBus] planner.onIntentClassified failed:", err?.message); });
      } else if (planner && typeof planner.plan === "function") {
        planner.plan({ type: "intent", payload }).catch((err) => { console.warn("[serviceBus] planner.plan failed:", err?.message); });
      }
    },
    { priority: 45, label: "serviceBus:intent→tianshuPlanner" }
  );

  // ── Task failed -> Record failure evidence ────────────────────────
  bus.on(
    EVENTS.TASK_FAILED,
    (payload) => {
      const godReview = getService("godReviewExecutor");
      if (godReview && typeof godReview.recordTaskFailure === "function") {
        godReview.recordTaskFailure(payload).catch((err) => { console.warn("[serviceBus] godReview.recordTaskFailure failed:", err?.message); });
      }
    },
    { priority: 50, label: "serviceBus:taskFailed→godReview" }
  );

  // ── Request completed -> Live Skill Registry ──────────────────────
  bus.on(
    EVENTS.REQUEST_COMPLETED,
    (payload) => {
      const skillRegistry = getService("liveSkillRegistry");
      if (
        skillRegistry &&
        typeof skillRegistry.onRequestCompleted === "function"
      ) {
        skillRegistry.onRequestCompleted(payload);
      }
    },
    { priority: 60, label: "serviceBus:requestDone→skillRegistry" }
  );

  // ── Chat model selected -> Command Palette tracking ───────────────
  bus.on(
    EVENTS.CHAT_MODEL_SELECTED,
    (payload) => {
      const palette = getService("commandPalette");
      if (palette && typeof palette.onModelSelected === "function") {
        palette.onModelSelected(payload);
      }
    },
    { priority: 55, label: "serviceBus:modelSelected→commandPalette" }
  );

  // ── System initialized -> Aggregate metrics snapshot ──────────────
  bus.on(
    EVENTS.SERVICE_INITIALIZED,
    (payload) => {
      // Emit aggregate cache stats onto the bus for observability.
      const stats = {
        responseCache: caches.response.getStats(),
        providerCache: caches.provider.getStats(),
        knowledgeCache: caches.knowledge.getStats(),
        serviceCount: payload.serviceCount,
        durationMs: payload.durationMs,
        errorCount: payload.errors ? payload.errors.length : 0,
      };
      // Fire async to avoid re-entrancy during the same fire() call.
      bus.fireAsync("system:metrics_snapshot", stats);
    },
    { priority: 90, label: "serviceBus:initMetrics→observability" }
  );
}
