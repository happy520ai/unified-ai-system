/**
 * LiveStream — real-time execution streaming for worker progress.
 *
 * Pushes worker progress events to subscribers (WebSocket clients, loggers,
 * dashboards).  Events are stored in a ring buffer so recent history is always
 * available, and each subscriber receives a filtered, buffered view of the
 * event stream.
 *
 * Key design points:
 *   - **Ring buffer** for global event history (bounded memory).
 *   - **Per-subscriber filtering** by taskId, goalId, and event types.
 *   - **Backpressure** — when a subscriber's buffer is full the oldest events
 *     are silently dropped, keeping the subscriber responsive.
 *   - **Timeline reconstruction** — paired events (e.g. llm_call_start /
 *     llm_call_end) are merged into a single timeline entry with duration.
 *
 * Usage:
 *   const stream = new LiveStream({ maxHistory: 2000 });
 *   const unsub = stream.subscribe((evt) => ws.send(JSON.stringify(evt)), {
 *     taskId: 'task-42',
 *     eventTypes: [StreamEvent.LLM_CALL_START, StreamEvent.LLM_CALL_END],
 *   });
 *   stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-42', data: { taskName: 'fix bug' } });
 *   // later...
 *   unsub();
 */

import { StreamEvent, PAIRED_EVENTS, matchesFilters, findStartType, summarizeEvent } from './eventHelpers.js';

export { StreamEvent };

/** Event types that terminate a task stream. */
const TERMINAL_EVENTS = new Set([
  StreamEvent.TASK_COMPLETE,
  StreamEvent.TASK_FAIL,
]);

// ── Helper: generate a short unique id ────────────────────────────────────────

/**
 * Generate a short random identifier.
 * @param {string} [prefix='sub'] — optional prefix
 * @returns {string}
 */
function uid(prefix = 'sub') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── LiveStream class ──────────────────────────────────────────────────────────

/**
 * @typedef {object} StreamEntry
 * @property {string} id — unique event identifier
 * @property {string} type — one of StreamEvent
 * @property {string} [taskId] — task this event belongs to
 * @property {string} [goalId] — goal this event belongs to
 * @property {object} [data] — event-specific payload
 * @property {number} timestamp — epoch ms when the event was emitted
 */

/**
 * @typedef {object} Subscriber
 * @property {string} id — unique subscriber identifier
 * @property {Function} callback — function(event) invoked for each matching event
 * @property {object} filters — filter options
 * @property {string} [filters.taskId] — only receive events for this task
 * @property {string} [filters.goalId] — only receive events for this goal
 * @property {string[]} [filters.eventTypes] — only receive events of these types
 * @property {number} bufferSize — max events buffered before oldest are dropped
 * @property {object[]} buffer — personal event buffer (backpressure managed)
 */

/**
 * @typedef {object} ActiveTaskInfo
 * @property {string} taskId
 * @property {string} [goalId]
 * @property {number} startedAt — epoch ms of the task_start event
 * @property {number} lastEvent — epoch ms of the most recent event
 * @property {number} eventCount — total events emitted for this task
 */

/**
 * @typedef {object} TimelineEntry
 * @property {number} timestamp — epoch ms
 * @property {string} type — event type
 * @property {string} summary — human-readable one-liner
 * @property {number} [duration] — duration in ms (only for paired events)
 */

export class LiveStream {
  /** @type {StreamEntry[]} ring buffer of all events */
  #history = [];

  /** @type {number} max events stored globally */
  #maxHistory;

  /** @type {Map<string, Subscriber>} active subscribers */
  #subscribers = new Map();

  /** @type {number} max concurrent subscribers */
  #maxSubscribers;

  /** @type {number} timeout in ms for broadcast delivery to a single subscriber */
  #broadcastTimeout;

  /**
   * @type {Map<string, ActiveTaskInfo>} tasks that have started but not yet
   * reached a terminal event
   */
  #activeTasks = new Map();

  /** @type {number} total events emitted (lifetime, not just in buffer) */
  #totalEvents = 0;

  /** @type {Record<string, number>} lifetime count per event type */
  #eventsByType = {};

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxHistory=1000] — max events in global ring buffer
   * @param {number} [opts.maxSubscribers=100] — max concurrent subscribers
   * @param {number} [opts.broadcastTimeout=5000] — timeout per subscriber callback in ms
   */
  constructor(opts = {}) {
    this.#maxHistory = Math.max(1, Math.floor(opts.maxHistory ?? 1000));
    this.#maxSubscribers = Math.max(1, Math.floor(opts.maxSubscribers ?? 100));
    this.#broadcastTimeout = opts.broadcastTimeout ?? 5000;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Emit a progress event into the stream.
   *
   * The event is appended to the global ring buffer, dispatched to all matching
   * subscribers, and used to update active-task tracking.
   *
   * @param {object} event
   * @param {string} event.type — one of StreamEvent
   * @param {string} [event.taskId] — associated task identifier
   * @param {string} [event.goalId] — associated goal identifier
   * @param {object} [event.data] — event-specific payload
   * @param {number} [event.timestamp] — epoch ms (auto-set if omitted)
   */
  emit(event) {
    const entry = {
      id: uid('evt'),
      type: event.type,
      taskId: event.taskId ?? undefined,
      goalId: event.goalId ?? undefined,
      data: event.data ?? {},
      timestamp: event.timestamp ?? Date.now(),
    };

    // Global ring buffer append
    this.#history.push(entry);
    if (this.#history.length > this.#maxHistory) {
      this.#history.shift();
    }

    // Lifetime counters
    this.#totalEvents++;
    this.#eventsByType[entry.type] = (this.#eventsByType[entry.type] ?? 0) + 1;

    // Active-task tracking
    this.#updateActiveTask(entry);

    // Broadcast to all matching subscribers via microtask scheduling
    this.#dispatchToSubscribers(entry);
  }

  /**
   * Subscribe to stream events.
   *
   * Returns an unsubscribe function.  The callback is invoked synchronously
   * for each matching event.
   *
   * @param {Function} callback — function(event) called for each matching event
   * @param {object} [opts]
   * @param {string} [opts.taskId] — only receive events for this task
   * @param {string} [opts.goalId] — only receive events for this goal
   * @param {string[]} [opts.eventTypes] — only receive these event types
   * @param {number} [opts.bufferSize=50] — max buffered events before backpressure
   * @returns {Function} unsubscribe function
   */
  subscribe(callback, opts = {}) {
    if (this.#subscribers.size >= this.#maxSubscribers) {
      // Evict the oldest subscriber to make room
      const oldestId = this.#subscribers.keys().next().value;
      this.#subscribers.delete(oldestId);
    }

    const id = uid('sub');
    const bufferSize = Math.max(1, Math.floor(opts.bufferSize ?? 50));

    /** @type {Subscriber} */
    const sub = {
      id,
      callback,
      filters: {
        taskId: opts.taskId ?? undefined,
        goalId: opts.goalId ?? undefined,
        eventTypes: opts.eventTypes ?? undefined,
      },
      bufferSize,
      buffer: [],
    };

    this.#subscribers.set(id, sub);

    // Return unsubscribe function
    return () => {
      this.#subscribers.delete(id);
    };
  }

  /**
   * Get event history with optional filtering.
   *
   * @param {object} [opts]
   * @param {string} [opts.taskId] — filter to this task
   * @param {string} [opts.goalId] — filter to this goal
   * @param {string[]} [opts.eventTypes] — filter to these types
   * @param {number} [opts.after] — only events after this epoch ms timestamp
   * @param {number} [opts.limit] — max number of events to return
   * @returns {StreamEntry[]}
   */
  getHistory(opts = {}) {
    let events = this.#history;

    if (opts.taskId) {
      events = events.filter((e) => e.taskId === opts.taskId);
    }
    if (opts.goalId) {
      events = events.filter((e) => e.goalId === opts.goalId);
    }
    if (opts.eventTypes && opts.eventTypes.length > 0) {
      const typeSet = new Set(opts.eventTypes);
      events = events.filter((e) => typeSet.has(e.type));
    }
    if (opts.after != null) {
      events = events.filter((e) => e.timestamp > opts.after);
    }
    if (opts.limit != null && opts.limit > 0) {
      events = events.slice(-opts.limit);
    }

    return events;
  }

  /**
   * Get currently active tasks (started but not yet completed/failed).
   *
   * @returns {ActiveTaskInfo[]}
   */
  getActiveTasks() {
    return [...this.#activeTasks.values()];
  }

  /**
   * Get event statistics.
   *
   * @returns {{
   *   totalEvents: number,
   *   byType: Record<string, number>,
   *   activeSubscribers: number,
   *   activeTasks: number,
   * }}
   */
  getStats() {
    return {
      totalEvents: this.#totalEvents,
      byType: { ...this.#eventsByType },
      activeSubscribers: this.#subscribers.size,
      activeTasks: this.#activeTasks.size,
    };
  }

  /**
   * Broadcast an array of events in batch mode.
   *
   * Each event is processed through the normal emit path.  Returns delivery
   * counts — an event is considered "delivered" if it matched at least one
   * subscriber, and "failed" if any subscriber callback threw.
   *
   * @param {object[]} events — array of event objects (same shape as emit)
   * @returns {{ delivered: number, failed: number }}
   */
  broadcast(events) {
    let delivered = 0;
    let failed = 0;

    for (const event of events) {
      try {
        this.emit(event);
        delivered++;
      } catch {
        failed++;
      }
    }

    return { delivered, failed };
  }

  /**
   * Reconstruct an execution timeline for a specific task.
   *
   * Paired events (e.g. llm_call_start / llm_call_end) are merged into a
   * single entry with a computed duration.
   *
   * @param {string} taskId — the task to build a timeline for
   * @returns {TimelineEntry[]}
   */
  getTimeline(taskId) {
    const events = this.#history.filter((e) => e.taskId === taskId);
    if (events.length === 0) return [];

    /** @type {TimelineEntry[]} */
    const timeline = [];

    /** Track pending "start" events waiting for their "end" counterpart */
    const pending = new Map();

    for (const evt of events) {
      // Check if this event is the "end" of a known pair
      const startType = findStartType(evt.type);
      if (startType && pending.has(startType)) {
        const startEvt = pending.get(startType);
        pending.delete(startType);
        timeline.push({
          timestamp: startEvt.timestamp,
          type: startType,
          summary: summarizeEvent(startEvt),
          duration: evt.timestamp - startEvt.timestamp,
        });
        continue;
      }

      // Check if this event is a "start" of a known pair
      if (PAIRED_EVENTS[evt.type]) {
        pending.set(evt.type, evt);
        continue;
      }

      // Regular (unpaired) event
      timeline.push({
        timestamp: evt.timestamp,
        type: evt.type,
        summary: summarizeEvent(evt),
      });
    }

    // Flush any unmatched start events (they never received an end)
    for (const [type, evt] of pending) {
      timeline.push({
        timestamp: evt.timestamp,
        type,
        summary: summarizeEvent(evt) + ' (incomplete)',
      });
    }

    // Sort by timestamp for correct ordering
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return timeline;
  }

  /**
   * Clear all event history, active task tracking, and lifetime statistics.
   */
  clear() {
    this.#history = [];
    this.#activeTasks.clear();
    this.#totalEvents = 0;
    this.#eventsByType = {};
  }

  /**
   * Quick status snapshot — useful for health-check endpoints.
   *
   * @returns {{ events: number, subscribers: number, activeTasks: number }}
   */
  getStatus() {
    return {
      events: this.#totalEvents,
      subscribers: this.#subscribers.size,
      activeTasks: this.#activeTasks.size,
    };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Update active-task tracking when a new event arrives.
   *
   * @param {StreamEntry} entry
   */
  #updateActiveTask(entry) {
    if (!entry.taskId) return;

    if (entry.type === StreamEvent.TASK_START) {
      this.#activeTasks.set(entry.taskId, {
        taskId: entry.taskId,
        goalId: entry.goalId,
        startedAt: entry.timestamp,
        lastEvent: entry.timestamp,
        eventCount: 1,
      });
      return;
    }

    const task = this.#activeTasks.get(entry.taskId);
    if (task) {
      task.lastEvent = entry.timestamp;
      task.eventCount++;

      // Remove from active on terminal events
      if (TERMINAL_EVENTS.has(entry.type)) {
        this.#activeTasks.delete(entry.taskId);
      }
    }
  }

  /**
   * Dispatch an event to all subscribers whose filters match.
   *
   * Uses microtask scheduling (queueMicrotask) so the emitter is never
   * blocked by slow subscriber callbacks.
   *
   * @param {StreamEntry} entry
   */
  #dispatchToSubscribers(entry) {
    for (const sub of this.#subscribers.values()) {
      if (!matchesFilters(entry, sub.filters)) continue;

      // Push to subscriber's personal buffer with backpressure
      sub.buffer.push(entry);
      if (sub.buffer.length > sub.bufferSize) {
        sub.buffer.shift(); // drop oldest
      }

      // Deliver via microtask to avoid blocking the emitter
      queueMicrotask(() => {
        try {
          sub.callback(entry);
        } catch {
          // Subscriber callback threw — silently ignore
        }
      });
    }
  }
}
