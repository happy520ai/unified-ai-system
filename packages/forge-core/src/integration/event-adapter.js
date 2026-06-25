/**
 * Forge Event Adapter — bridges Forge's internal events to the gateway's
 * GatewayEventBus for unified observability.
 *
 * When integrated, Forge lifecycle events (goal submitted, task completed,
 * verification passed, etc.) are emitted on the gateway event bus,
 * making them visible to other subsystems (monitoring, audit, dashboards).
 *
 * Forge can also subscribe to gateway events (provider errors, routing changes)
 * to trigger resilience actions (circuit breaker, provider fallback).
 */

/**
 * Event type mapping: Forge internal events → gateway event bus events.
 */
const FORGE_EVENT_MAP = {
  // Goal lifecycle
  goal_submitted:    'forge:goal:submitted',
  goal_started:      'forge:goal:started',
  goal_completed:    'forge:goal:completed',
  goal_failed:       'forge:goal:failed',
  goal_cancelled:    'forge:goal:cancelled',

  // Task lifecycle
  task_started:      'forge:task:started',
  task_completed:    'forge:task:completed',
  task_failed:       'forge:task:failed',

  // Verification
  verification_started: 'forge:verify:started',
  verification_passed:  'forge:verify:passed',
  verification_failed:  'forge:verify:failed',

  // Resilience
  circuit_breaker_opened:   'forge:resilience:cb:opened',
  circuit_breaker_closed:   'forge:resilience:cb:closed',
  circuit_breaker_halfopen: 'forge:resilience:cb:halfopen',
};

/**
 * Gateway events that Forge should subscribe to.
 */
const GATEWAY_SUBSCRIPTIONS = [
  'provider:error',
  'provider:timeout',
  'provider:circuit_open',
  'routing:mode_changed',
];

export class ForgeEventAdapter {
  /** @type {object|null} Gateway event bus */
  #eventBus;

  /** @type {object|null} Agent pool manager (event source) */
  #agentPool;

  /** @type {Function[]} Cleanup functions */
  #cleanups = [];

  /** @type {number} Events forwarded count */
  #forwarded = 0;

  /**
   * @param {object} options
   * @param {object} [options.eventBus] - Gateway's GatewayEventBus instance
   * @param {object} [options.agentPool] - Forge's AgentPoolManager instance
   */
  constructor({ eventBus, agentPool } = {}) {
    this.#eventBus = eventBus || null;
    this.#agentPool = agentPool || null;
  }

  /**
   * Start forwarding events from Forge to the gateway event bus.
   * Also subscribes Forge to relevant gateway events.
   */
  start() {
    if (!this.#agentPool || !this.#eventBus) return;

    // Forward Forge events to gateway event bus
    for (const [forgeEvent, gatewayEvent] of Object.entries(FORGE_EVENT_MAP)) {
      const handler = (data) => {
        this.#forwarded++;
        try {
          this.#eventBus.emit(gatewayEvent, {
            ...data,
            source: 'forge',
            forgeEvent,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          // Don't let event forwarding errors break Forge
          console.error(`[forge:event-adapter] Failed to forward ${forgeEvent}:`, err.message);
        }
      };

      this.#agentPool.on(forgeEvent, handler);
      this.#cleanups.push(() => this.#agentPool.off(forgeEvent, handler));
    }

    // Subscribe Forge to gateway events for resilience
    this.#subscribeToGatewayEvents();
  }

  /**
   * Stop forwarding events and clean up listeners.
   */
  stop() {
    for (const cleanup of this.#cleanups) {
      try { cleanup(); } catch { /* best-effort: cleanup must not throw */ }
    }
    this.#cleanups = [];
  }

  /**
   * Subscribe Forge to relevant gateway events.
   * When the gateway reports provider errors, Forge's resilience module
   * can react (e.g., open circuit breakers for that provider).
   */
  #subscribeToGatewayEvents() {
    if (!this.#eventBus?.on) return;

    for (const event of GATEWAY_SUBSCRIPTIONS) {
      const handler = (data) => {
        try {
          this.#handleGatewayEvent(event, data);
        } catch (err) {
          console.error(`[forge:event-adapter] Error handling gateway event ${event}:`, err.message);
        }
      };

      this.#eventBus.on(event, handler);
      this.#cleanups.push(() => {
        try { this.#eventBus.off(event, handler); } catch { /* best-effort: unregister must not throw */ }
      });
    }
  }

  /**
   * Handle an incoming gateway event.
   * Routes provider errors to Forge's resilience module.
   */
  #handleGatewayEvent(event, data) {
    if (!this.#agentPool) return;

    switch (event) {
      case 'provider:error':
      case 'provider:timeout': {
        // Notify Forge's circuit breaker about the provider failure
        const cb = this.#agentPool.getCircuitBreaker?.();
        if (cb) {
          const providerId = data?.providerId || data?.provider || 'unknown';
          cb.recordFailure(providerId);
        }
        break;
      }
      case 'provider:circuit_open': {
        // Gateway already opened a circuit — sync Forge's circuit breaker
        const cb = this.#agentPool.getCircuitBreaker?.();
        if (cb) {
          const providerId = data?.providerId || data?.provider || 'unknown';
          cb.forceOpen(providerId);
        }
        break;
      }
      case 'routing:mode_changed': {
        // Routing mode changed — log for observability
        console.log(`[forge:event-adapter] Gateway routing mode changed: ${data?.mode || 'unknown'}`);
        break;
      }
    }
  }

  /**
   * Get adapter status for dashboard.
   * @returns {object}
   */
  getStatus() {
    return {
      active: this.#cleanups.length > 0,
      eventsForwarded: this.#forwarded,
      subscribedGatewayEvents: GATEWAY_SUBSCRIPTIONS,
      forgeEventMap: Object.keys(FORGE_EVENT_MAP),
      eventBusConnected: !!this.#eventBus,
      agentPoolConnected: !!this.#agentPool,
    };
  }
}

/**
 * Get the event type mapping for external reference.
 * @returns {object}
 */
export function getForgeEventMap() {
  return { ...FORGE_EVENT_MAP };
}
