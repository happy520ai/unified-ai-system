/**
 * Tracing Module — Distributed tracing with Spans for Forge execution.
 *
 * Components:
 *   1. TraceContext  — AsyncLocalStorage-based context propagation
 *   2. Span          — A single traced operation with timing, attributes, events
 *   3. TraceManager  — Span lifecycle management, storage, and querying
 *
 * Hierarchy:  goal → task/worker → llm_call / verification
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

// ── Trace Context (AsyncLocalStorage propagation) ─────────────────────────

const traceStorage = new AsyncLocalStorage();

/**
 * Run a function within a trace context. All downstream calls can retrieve
 * the traceId and parentSpanId via getTraceContext() without parameter passing.
 *
 * @param {string} traceId — root trace ID (usually goalId)
 * @param {string|null} parentSpanId — parent span ID
 * @param {Function} fn — async function to execute
 * @returns {Promise<*>} result of fn()
 */
export function runWithTrace(traceId, parentSpanId, fn) {
  return traceStorage.run({ traceId, parentSpanId }, fn);
}

/**
 * Get the current trace context (traceId and parentSpanId).
 * @returns {{ traceId: string|null, parentSpanId: string|null }}
 */
export function getTraceContext() {
  return traceStorage.getStore() || { traceId: null, parentSpanId: null };
}

// ── Span ──────────────────────────────────────────────────────────────────

/**
 * A single traced operation.
 *
 * Each span has:
 *   - A unique ID
 *   - A trace ID (for correlation across the hierarchy)
 *   - An optional parent span ID
 *   - An operation name (e.g. 'goal_execution', 'llm_call')
 *   - Start/end timestamps + duration
 *   - Arbitrary key-value attributes
 *   - Timestamped events (logs)
 *   - A status ('running' | 'ok' | 'error' | 'timeout')
 */
export class Span {
  id;
  traceId;
  parentSpanId;
  operationName;
  service;
  startTime;
  endTime = null;
  durationMs = null;
  status = 'running';
  attributes = {};
  events = [];
  goalId;
  taskId;

  constructor({ traceId, parentSpanId, operationName, service, goalId, taskId, attributes }) {
    this.id = `span-${randomUUID().slice(0, 12)}`;
    this.traceId = traceId;
    this.parentSpanId = parentSpanId || null;
    this.operationName = operationName;
    this.service = service || 'forge-core';
    this.startTime = new Date().toISOString();
    this.goalId = goalId || null;
    this.taskId = taskId || null;
    if (attributes) Object.assign(this.attributes, attributes);
  }

  /**
   * Set an attribute on this span.
   * @param {string} key
   * @param {*} value
   * @returns {Span} this (for chaining)
   */
  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  /**
   * Add a timestamped event (log entry) to this span.
   * @param {string} name
   * @param {object} [attributes]
   * @returns {Span} this
   */
  addEvent(name, attributes = null) {
    this.events.push({
      timestamp: new Date().toISOString(),
      name,
      attributes: attributes || {},
    });
    return this;
  }

  /**
   * End this span, recording duration and final status.
   * @param {'ok'|'error'|'timeout'} [status='ok']
   * @param {object} [finalAttributes] — merged into attributes before ending
   */
  end(status = 'ok', finalAttributes = null) {
    if (this.endTime) return; // already ended
    this.endTime = new Date().toISOString();
    this.durationMs = new Date(this.endTime) - new Date(this.startTime);
    this.status = status;
    if (finalAttributes) Object.assign(this.attributes, finalAttributes);
  }

  /**
   * Serialize to a plain object.
   */
  toJSON() {
    return {
      id: this.id,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      operationName: this.operationName,
      service: this.service,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.durationMs,
      status: this.status,
      attributes: this.attributes,
      events: this.events,
      goalId: this.goalId,
      taskId: this.taskId,
    };
  }
}

// ── Trace Manager ─────────────────────────────────────────────────────────

/**
 * Manages span lifecycle, in-memory storage, and querying.
 *
 * Usage:
 *   const tm = new TraceManager({ maxSpans: 10000 });
 *   const span = tm.startSpan({ traceId: goalId, operationName: 'goal_execution' });
 *   ...
 *   tm.endSpan(span.id, 'ok');
 */
export class TraceManager extends EventEmitter {
  #spans = new Map();       // spanId → Span
  #traces = new Map();      // traceId → Set<spanId>
  #maxSpans;
  #maxSpansPerTrace;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxSpans=10000] — maximum spans kept in memory
   * @param {number} [opts.maxSpansPerTrace=500] — maximum spans per trace
   */
  constructor(opts = {}) {
    super();
    this.#maxSpans = opts.maxSpans ?? 10000;
    this.#maxSpansPerTrace = opts.maxSpansPerTrace ?? 500;
  }

  /**
   * Start a new span. Automatically uses AsyncLocalStorage context if
   * traceId/parentSpanId are not provided.
   *
   * @param {object} opts
   * @param {string} [opts.traceId] — trace ID (auto from context if omitted)
   * @param {string} [opts.parentSpanId] — parent span ID (auto from context if omitted)
   * @param {string} opts.operationName — e.g. 'goal_execution', 'llm_call'
   * @param {string} [opts.service] — service name (default 'forge-core')
   * @param {string} [opts.goalId]
   * @param {string} [opts.taskId]
   * @param {object} [opts.attributes] — initial attributes
   * @returns {Span}
   */
  startSpan(opts = {}) {
    const ctx = getTraceContext();
    const traceId = opts.traceId || ctx.traceId || `trace-${randomUUID().slice(0, 12)}`;
    const parentSpanId = opts.parentSpanId ?? ctx.parentSpanId ?? null;

    // Enforce per-trace span limit
    const traceSpans = this.#traces.get(traceId);
    if (traceSpans && traceSpans.size >= this.#maxSpansPerTrace) {
      // Return a no-op span to avoid memory blowup
      const noop = new Span({ traceId, parentSpanId, operationName: opts.operationName || 'noop' });
      noop.setAttribute('_dropped', true);
      noop.end('ok');
      return noop;
    }

    const span = new Span({
      traceId,
      parentSpanId,
      operationName: opts.operationName || 'unknown',
      service: opts.service,
      goalId: opts.goalId,
      taskId: opts.taskId,
      attributes: opts.attributes,
    });

    this.#spans.set(span.id, span);

    if (!this.#traces.has(traceId)) {
      this.#traces.set(traceId, new Set());
    }
    this.#traces.get(traceId).add(span.id);

    // Evict oldest spans if over global limit
    this.#evictIfNeeded();

    this.emit('span-started', span.toJSON());
    return span;
  }

  /**
   * End a span by ID.
   * @param {string} spanId
   * @param {'ok'|'error'|'timeout'} [status='ok']
   * @param {object} [finalAttributes]
   * @returns {Span|null} the ended span, or null if not found
   */
  endSpan(spanId, status = 'ok', finalAttributes = null) {
    const span = this.#spans.get(spanId);
    if (!span) return null;
    span.end(status, finalAttributes);
    this.emit('span-ended', span.toJSON());
    return span;
  }

  /**
   * Get a span by ID.
   * @param {string} spanId
   * @returns {Span|null}
   */
  getSpan(spanId) {
    return this.#spans.get(spanId) || null;
  }

  /**
   * Get all spans for a trace ID.
   * @param {string} traceId
   * @returns {Span[]}
   */
  getSpansForTrace(traceId) {
    const ids = this.#traces.get(traceId);
    if (!ids) return [];
    return [...ids].map(id => this.#spans.get(id)).filter(Boolean);
  }

  /**
   * Get all spans for a goal ID.
   * @param {string} goalId
   * @returns {Span[]}
   */
  getSpansForGoal(goalId) {
    const result = [];
    for (const span of this.#spans.values()) {
      if (span.goalId === goalId || span.traceId === goalId) {
        result.push(span);
      }
    }
    return result;
  }

  /**
   * Build a hierarchical span tree for a trace.
   * @param {string} traceId
   * @returns {{ traceId, rootSpans: object[], totalSpans: number, totalDuration: number }}
   */
  getSpanTree(traceId) {
    const spans = this.getSpansForTrace(traceId);
    if (spans.length === 0) return { traceId, rootSpans: [], totalSpans: 0, totalDuration: 0 };

    const byId = new Map();
    const children = new Map();

    for (const s of spans) {
      const j = s.toJSON();
      j.children = [];
      byId.set(s.id, j);
      const pKey = s.parentSpanId || '__root__';
      if (!children.has(pKey)) children.set(pKey, []);
      children.get(pKey).push(j);
    }

    // Wire children to parents
    for (const [, node] of byId) {
      const kids = children.get(node.id) || [];
      // Sort children by start time
      kids.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      node.children = kids;
    }

    const rootSpans = children.get('__root__') || [];
    rootSpans.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    const totalDuration = spans.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    return {
      traceId,
      rootSpans,
      totalSpans: spans.length,
      totalDuration,
    };
  }

  /**
   * Get a summary of all active traces.
   */
  getStatus() {
    const activeTraces = new Map();
    for (const [traceId, spanIds] of this.#traces) {
      const spanArr = [...spanIds].map(id => this.#spans.get(id)).filter(Boolean);
      const running = spanArr.filter(s => s.status === 'running').length;
      const completed = spanArr.filter(s => s.status === 'ok').length;
      const errors = spanArr.filter(s => s.status === 'error' || s.status === 'timeout').length;
      const ops = {};
      for (const s of spanArr) {
        ops[s.operationName] = (ops[s.operationName] || 0) + 1;
      }
      activeTraces.set(traceId, {
        traceId,
        totalSpans: spanArr.length,
        running,
        completed,
        errors,
        operations: ops,
      });
    }

    return {
      totalTraces: this.#traces.size,
      totalSpans: this.#spans.size,
      maxSpans: this.#maxSpans,
      traces: Object.fromEntries(activeTraces),
    };
  }

  /**
   * Clear all spans (for testing or memory management).
   */
  clear() {
    this.#spans.clear();
    this.#traces.clear();
  }

  /**
   * Remove a specific trace and all its spans.
   * @param {string} traceId
   */
  removeTrace(traceId) {
    const ids = this.#traces.get(traceId);
    if (ids) {
      for (const id of ids) this.#spans.delete(id);
      this.#traces.delete(traceId);
    }
  }

  // ── Private ──

  #evictIfNeeded() {
    if (this.#spans.size <= this.#maxSpans) return;

    // Find oldest completed spans and remove them
    const completed = [];
    for (const [id, span] of this.#spans) {
      if (span.status !== 'running') {
        completed.push({ id, startTime: span.startTime });
      }
    }
    completed.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    const toRemove = Math.min(completed.length, Math.floor(this.#maxSpans * 0.2));
    for (let i = 0; i < toRemove; i++) {
      const span = this.#spans.get(completed[i].id);
      if (span) {
        this.#spans.delete(completed[i].id);
        const traceSpans = this.#traces.get(span.traceId);
        if (traceSpans) {
          traceSpans.delete(completed[i].id);
          if (traceSpans.size === 0) this.#traces.delete(span.traceId);
        }
      }
    }
  }
}
