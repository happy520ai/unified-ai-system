/**
 * Gateway Event Bus — Zero-latency inter-service communication
 *
 * Design principles:
 * - Synchronous fire for critical path events (no Promise overhead)
 * - Async fire-and-forget for non-critical events (logging, metrics)
 * - Bounded listener count per event to prevent memory leaks
 * - Priority-based listener ordering (lower number = higher priority)
 *
 * @module core/eventBus
 */

import { EVENTS } from "./eventConstants.js";

/** @type {number} Hard cap on listeners per event to prevent runaway registrations */
const MAX_LISTENERS_PER_EVENT = 50;

/** @type {number} Maximum events retained in the debug history ring buffer */
const MAX_EVENT_HISTORY = 500;

/**
 * High-performance synchronous event bus for the AI gateway.
 *
 * @example
 *   const bus = getEventBus();
 *   bus.on(EVENTS.REQUEST_RECEIVED, (payload) => {
 *     console.log("Request arrived:", payload.requestId);
 *   }, { priority: 10, label: "request-logger" });
 *
 *   // Synchronous — all handlers run before the next line executes
 *   const results = bus.fire(EVENTS.REQUEST_RECEIVED, { requestId: "abc" });
 */
export class GatewayEventBus {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxHistory=500] — max events kept in history
   */
  constructor(options = {}) {
    /** @type {Map<string, Array<{ fn: Function, priority: number, once: boolean, label: string, _wrapperRef?: Function }>>} */
    this.listeners = new Map();
    /** @type {Array<{ event: string, payload: *, timestamp: number, listenerCount: number }>} */
    this.history = [];
    /** @type {number} */
    this.maxHistory = options.maxHistory || MAX_EVENT_HISTORY;
    /** @type {{ totalFired: number, totalListeners: number }} */
    this.metrics = { totalFired: 0, totalListeners: 0 };
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a listener for an event.
   * @param {string}   event    — Event name (use EVENTS constants)
   * @param {Function} fn       — Handler function; receives the payload
   * @param {Object}   [options]
   * @param {number}   [options.priority=50]  — 0 (highest) to 100 (lowest)
   * @param {boolean}  [options.once=false]   — auto-remove after first call
   * @param {string}   [options.label=""]     — human-readable label for debugging
   * @returns {GatewayEventBus} this (for chaining)
   */
  on(event, fn, options = {}) {
    if (typeof fn !== "function") {
      throw new TypeError(
        `[EventBus] on("${event}"): handler must be a function, received ${typeof fn}`
      );
    }

    const priority = Math.max(0, Math.min(100, options.priority ?? 50));
    const once = options.once ?? false;
    const label = options.label || fn.name || "anonymous";

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const arr = this.listeners.get(event);

    if (arr.length >= MAX_LISTENERS_PER_EVENT) {
      throw new Error(
        `[EventBus] Listener cap reached for "${event}" (${MAX_LISTENERS_PER_EVENT}). ` +
          `Remove unused listeners or increase MAX_LISTENERS_PER_EVENT.`
      );
    }

    for (let i = 0; i < arr.length; i++) {
      if (arr[i].fn === fn) return this;
    }

    const entry = { fn, priority, once, label };

    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid].priority <= priority) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, entry);

    return this;
  }

  /**
   * Register a one-time listener — automatically removed after first invocation.
   * @param {string}   event    — Event name
   * @param {Function} fn       — Handler function
   * @param {Object}   [options] — Same options as on() (once is forced true)
   * @returns {GatewayEventBus} this
   */
  once(event, fn, options = {}) {
    if (typeof fn !== "function") {
      throw new TypeError(
        `[EventBus] once("${event}"): handler must be a function, received ${typeof fn}`
      );
    }

    const priority = Math.max(0, Math.min(100, options.priority ?? 50));
    const label = options.label || fn.name || "anonymous";

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const arr = this.listeners.get(event);

    if (arr.length >= MAX_LISTENERS_PER_EVENT) {
      throw new Error(
        `[EventBus] Listener cap reached for "${event}" (${MAX_LISTENERS_PER_EVENT}).`
      );
    }

    const self = this;
    const wrapper = function _onceWrapper(payload) {
      self._removeEntry(event, wrapper);
      return fn(payload);
    };
    wrapper._originalFn = fn;

    const entry = { fn: wrapper, priority, once: true, label, _wrapperRef: fn };

    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid].priority <= priority) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, entry);

    return this;
  }

  /**
   * Remove a listener by its original function reference.
   * @param {string}   event — Event name
   * @param {Function} fn    — The original handler function passed to on()/once()
   * @returns {boolean} true if a listener was found and removed
   */
  off(event, fn) {
    const arr = this.listeners.get(event);
    if (!arr) return false;

    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      if (entry.fn === fn || entry._wrapperRef === fn) {
        arr.splice(i, 1);
        if (arr.length === 0) this.listeners.delete(event);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Firing
  // ---------------------------------------------------------------------------

  /**
   * Fire an event synchronously — for critical path events.
   * @param {string} event   — Event name
   * @param {*}      [payload] — Arbitrary data passed to each handler
   * @returns {Array<*>} Array of handler return values (may include Error instances)
   */
  fire(event, payload) {
    this.metrics.totalFired++;

    const arr = this.listeners.get(event);
    const snapshot = arr ? arr.slice() : [];

    if (this.history.length >= this.maxHistory) {
      this.history.shift();
    }
    this.history.push({
      event,
      payload,
      timestamp: performance.now(),
      listenerCount: snapshot.length,
    });

    const results = [];

    for (let i = 0; i < snapshot.length; i++) {
      const entry = snapshot[i];

      if (entry.once) {
        this._removeEntry(event, entry.fn);
      }

      try {
        results.push(entry.fn(payload));
      } catch (err) {
        results.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    return results;
  }

  /**
   * Fire an event asynchronously — fire-and-forget for non-critical events.
   * @param {string} event   — Event name
   * @param {*}      [payload] — Arbitrary data passed to each handler
   * @returns {void}
   */
  fireAsync(event, payload) {
    this.metrics.totalFired++;

    const arr = this.listeners.get(event);
    const snapshot = arr ? arr.slice() : [];

    if (this.history.length >= this.maxHistory) {
      this.history.shift();
    }
    this.history.push({
      event,
      payload,
      timestamp: performance.now(),
      listenerCount: snapshot.length,
    });

    for (let i = 0; i < snapshot.length; i++) {
      const entry = snapshot[i];

      if (entry.once) {
        this._removeEntry(event, entry.fn);
      }

      queueMicrotask(() => {
        try {
          const result = entry.fn(payload);
          if (result != null && typeof result.then === "function") {
            result.catch((err) => {
              this._emitError(event, entry.label, err);
            });
          }
        } catch (err) {
          this._emitError(event, entry.label, err);
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  /**
   * Get event history — the last N events fired on this bus.
   * @param {Object}   [filter]
   * @param {string}   [filter.event]  — only return entries matching this event name
   * @param {Function} [filter.filter] — predicate receiving each history entry
   * @param {number}   [filter.limit]  — cap the number of returned entries
   * @returns {Array<{ event: string, payload: *, timestamp: number, listenerCount: number }>}
   */
  getHistory(filter) {
    if (!filter) return this.history.slice();

    let result = this.history;

    if (filter.event) {
      result = result.filter((h) => h.event === filter.event);
    }
    if (typeof filter.filter === "function") {
      result = result.filter(filter.filter);
    }
    if (typeof filter.limit === "number" && filter.limit > 0) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * Get aggregate metrics about this event bus.
   * @returns {{ totalFired: number, totalListeners: number, historyLength: number, maxHistory: number, events: string[], listenerCounts: Record<string, number> }}
   */
  getMetrics() {
    let totalListeners = 0;
    const listenerCounts = {};

    for (const [event, arr] of this.listeners) {
      totalListeners += arr.length;
      listenerCounts[event] = arr.length;
    }

    return {
      totalFired: this.metrics.totalFired,
      totalListeners,
      historyLength: this.history.length,
      maxHistory: this.maxHistory,
      events: Array.from(this.listeners.keys()),
      listenerCounts,
    };
  }

  /**
   * Remove all listeners and clear history.
   * @returns {void}
   */
  reset() {
    this.listeners.clear();
    this.history = [];
    this.metrics = { totalFired: 0, totalListeners: 0 };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** @private */
  _removeEntry(event, fn) {
    const arr = this.listeners.get(event);
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].fn === fn) {
        arr.splice(i, 1);
        if (arr.length === 0) this.listeners.delete(event);
        return;
      }
    }
  }

  /** @private */
  _emitError(sourceEvent, label, err) {
    const errorEvent = "event:error";
    if (sourceEvent === errorEvent) return;
    const errorArr = this.listeners.get(errorEvent);
    if (!errorArr) return;
    const errorPayload = { sourceEvent, label, error: err };
    for (const entry of errorArr.slice()) {
      try {
        entry.fn(errorPayload);
      } catch (_) {
        // Swallow — error channel must never throw.
      }
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

/** @type {GatewayEventBus | null} */
let _instance = null;

/**
 * Get (or lazily create) the global singleton event bus.
 * @returns {GatewayEventBus}
 */
export function getEventBus() {
  if (!_instance) _instance = new GatewayEventBus();
  return _instance;
}

// Re-export EVENTS for backward compatibility
export { EVENTS };

export default getEventBus;
