/**
 * Canonical event name constants used across the gateway.
 *
 * Naming convention: "domain:action" in snake_case.
 * Always reference these constants rather than raw strings to prevent
 * typos and enable IDE auto-complete.
 *
 * @readonly
 */
export const EVENTS = Object.freeze({
  // ── Request lifecycle ──────────────────────────────────────────────────
  /** Fired when the gateway receives an inbound request */
  REQUEST_RECEIVED: "request:received",
  /** Fired after a request has been fully processed and a response sent */
  REQUEST_COMPLETED: "request:completed",
  /** Fired when request processing fails unrecoverably */
  REQUEST_FAILED: "request:failed",

  // ── Chat pipeline ──────────────────────────────────────────────────────
  /** Fired after the user's intent has been classified */
  CHAT_INTENT_CLASSIFIED: "chat:intent_classified",
  /** Fired after contextual data (history, knowledge) has been attached */
  CHAT_CONTEXT_ENRICHED: "chat:context_enriched",
  /** Fired once the routing layer has selected a target model */
  CHAT_MODEL_SELECTED: "chat:model_selected",
  /** Fired when the chosen model begins generating a response */
  CHAT_EXECUTION_STARTED: "chat:execution_started",
  /** Fired when model generation completes (success or failure) */
  CHAT_EXECUTION_COMPLETED: "chat:execution_completed",
  /** Fired after the response passes quality/safety verification */
  CHAT_RESPONSE_VERIFIED: "chat:response_verified",
  /** Fired when evidence (sources, citations) has been captured */
  CHAT_EVIDENCE_CAPTURED: "chat:evidence_captured",

  // ── Neuron lifecycle ───────────────────────────────────────────────────
  /** Fired before a neuron intercepts an outgoing chat request */
  NEURON_BEFORE_CHAT: "neuron:before_chat",
  /** Fired when a neuron participates in routing decisions */
  NEURON_ON_ROUTING: "neuron:on_routing",
  /** Fired after the model returns, before the neuron sees the response */
  NEURON_AFTER_MODEL: "neuron:after_model",
  /** Fired just before the final response is sent to the client */
  NEURON_BEFORE_RESPONSE: "neuron:before_response",

  // ── Knowledge ──────────────────────────────────────────────────────────
  /** Fired when a knowledge/RAG query is executed */
  KNOWLEDGE_QUERY: "knowledge:query",
  /** Fired after new knowledge has been ingested into the store */
  KNOWLEDGE_INGESTED: "knowledge:ingested",
  /** Fired when the enrichment pipeline processes knowledge */
  KNOWLEDGE_ENRICHED: "knowledge:enriched",

  // ── Provider ───────────────────────────────────────────────────────────
  /** Fired when a provider's health status changes (healthy/degraded/down) */
  PROVIDER_HEALTH_CHANGED: "provider:health_changed",
  /** Fired when a new provider is successfully onboarded */
  PROVIDER_ONBOARDED: "provider:onboarded",
  /** Fired when a provider's circuit breaker opens (failures exceed threshold) */
  PROVIDER_CIRCUIT_OPEN: "provider:circuit_open",
  /** Fired when a provider's circuit breaker resets to closed */
  PROVIDER_CIRCUIT_CLOSED: "provider:circuit_closed",

  // ── Workforce ──────────────────────────────────────────────────────────
  /** Fired when a new task is placed on the work queue */
  TASK_ENQUEUED: "task:enqueued",
  /** Fired when a queued task completes successfully */
  TASK_COMPLETED: "task:completed",
  /** Fired when a queued task fails */
  TASK_FAILED: "task:failed",

  // ── System ─────────────────────────────────────────────────────────────
  /** Fired once after all services have been eagerly initialized */
  SERVICE_INITIALIZED: "service:initialized",
  /** Fired on LRU cache hit */
  CACHE_HIT: "cache:hit",
  /** Fired on LRU cache miss */
  CACHE_MISS: "cache:miss",
  /** Fired when an entry is evicted from an LRU cache */
  CACHE_EVICTED: "cache:evicted",
});
