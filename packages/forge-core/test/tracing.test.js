import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let runWithTrace, getTraceContext, Span, TraceManager;

before(async () => {
  const mod = await import('../src/tracing/index.js');
  runWithTrace = mod.runWithTrace;
  getTraceContext = mod.getTraceContext;
  Span = mod.Span;
  TraceManager = mod.TraceManager;
});

describe('Tracing', { concurrency: 1 }, () => {

  // ── Span ──────────────────────────────────────────────────────────────

  describe('Span', () => {
    it('should create a span with required fields', () => {
      const span = new Span({
        traceId: 'trace-1',
        operationName: 'test-op',
      });
      assert.ok(span.id.startsWith('span-'));
      assert.strictEqual(span.traceId, 'trace-1');
      assert.strictEqual(span.parentSpanId, null);
      assert.strictEqual(span.operationName, 'test-op');
      assert.strictEqual(span.service, 'forge-core');
      assert.strictEqual(span.status, 'running');
      assert.ok(span.startTime);
      assert.strictEqual(span.endTime, null);
      assert.strictEqual(span.durationMs, null);
    });

    it('should accept optional fields', () => {
      const span = new Span({
        traceId: 'trace-2',
        parentSpanId: 'parent-1',
        operationName: 'child-op',
        service: 'custom-service',
        goalId: 'g-1',
        taskId: 't-1',
        attributes: { key: 'value' },
      });
      assert.strictEqual(span.parentSpanId, 'parent-1');
      assert.strictEqual(span.service, 'custom-service');
      assert.strictEqual(span.goalId, 'g-1');
      assert.strictEqual(span.taskId, 't-1');
      assert.strictEqual(span.attributes.key, 'value');
    });

    it('should set attribute and support chaining', () => {
      const span = new Span({ traceId: 't', operationName: 'op' });
      const result = span.setAttribute('foo', 'bar');
      assert.strictEqual(result, span);
      assert.strictEqual(span.attributes.foo, 'bar');
    });

    it('should add events', () => {
      const span = new Span({ traceId: 't', operationName: 'op' });
      span.addEvent('event-1', { detail: 'x' });
      assert.strictEqual(span.events.length, 1);
      assert.strictEqual(span.events[0].name, 'event-1');
      assert.strictEqual(span.events[0].attributes.detail, 'x');
      assert.ok(span.events[0].timestamp);
    });

    it('should add event with empty attributes by default', () => {
      const span = new Span({ traceId: 't', operationName: 'op' });
      span.addEvent('simple-event');
      assert.deepStrictEqual(span.events[0].attributes, {});
    });

    it('should end span with ok status', async () => {
      const span = new Span({ traceId: 't', operationName: 'op' });
      // Small delay to ensure measurable duration
      await new Promise(r => setTimeout(r, 10));
      span.end('ok');
      assert.strictEqual(span.status, 'ok');
      assert.ok(span.endTime);
      assert.ok(span.durationMs >= 0);
    });

    it('should end span with error status and final attributes', () => {
      const span = new Span({ traceId: 't', operationName: 'op' });
      span.end('error', { 'error.message': 'something failed' });
      assert.strictEqual(span.status, 'error');
      assert.strictEqual(span.attributes['error.message'], 'something failed');
    });

    it('should not end twice', () => {
      const span = new Span({ traceId: 't', operationName: 'op' });
      span.end('ok');
      const firstEnd = span.endTime;
      span.end('error');
      assert.strictEqual(span.endTime, firstEnd);
      assert.strictEqual(span.status, 'ok'); // unchanged
    });

    it('should serialize to JSON', () => {
      const span = new Span({
        traceId: 'trace-json',
        operationName: 'json-op',
        goalId: 'g-1',
      });
      span.setAttribute('k', 'v');
      span.addEvent('evt');
      span.end('ok');

      const json = span.toJSON();
      assert.strictEqual(json.traceId, 'trace-json');
      assert.strictEqual(json.operationName, 'json-op');
      assert.strictEqual(json.goalId, 'g-1');
      assert.strictEqual(json.attributes.k, 'v');
      assert.strictEqual(json.events.length, 1);
      assert.strictEqual(json.status, 'ok');
      assert.ok(json.durationMs >= 0);
    });
  });

  // ── TraceContext (AsyncLocalStorage) ──────────────────────────────────

  describe('TraceContext', () => {
    it('should return null context outside of runWithTrace', () => {
      const ctx = getTraceContext();
      assert.strictEqual(ctx.traceId, null);
      assert.strictEqual(ctx.parentSpanId, null);
    });

    it('should propagate context inside runWithTrace', async () => {
      await runWithTrace('trace-abc', 'span-parent', async () => {
        const ctx = getTraceContext();
        assert.strictEqual(ctx.traceId, 'trace-abc');
        assert.strictEqual(ctx.parentSpanId, 'span-parent');
      });
    });

    it('should propagate context through nested async calls', async () => {
      await runWithTrace('trace-nested', 'span-1', async () => {
        async function inner() {
          const ctx = getTraceContext();
          assert.strictEqual(ctx.traceId, 'trace-nested');
          assert.strictEqual(ctx.parentSpanId, 'span-1');
        }
        await inner();
      });
    });

    it('should isolate different trace contexts', async () => {
      const results = [];
      const p1 = runWithTrace('trace-A', 'span-A', async () => {
        await new Promise(r => setTimeout(r, 20));
        results.push(getTraceContext());
      });
      const p2 = runWithTrace('trace-B', 'span-B', async () => {
        await new Promise(r => setTimeout(r, 10));
        results.push(getTraceContext());
      });
      await Promise.all([p1, p2]);

      // Both contexts should be independent
      const a = results.find(r => r.traceId === 'trace-A');
      const b = results.find(r => r.traceId === 'trace-B');
      assert.ok(a);
      assert.ok(b);
      assert.strictEqual(a.parentSpanId, 'span-A');
      assert.strictEqual(b.parentSpanId, 'span-B');
    });

    it('should return the result of the wrapped function', async () => {
      const result = await runWithTrace('t', null, async () => 42);
      assert.strictEqual(result, 42);
    });

    it('should propagate errors from the wrapped function', async () => {
      await assert.rejects(
        () => runWithTrace('t', null, async () => { throw new Error('boom'); }),
        /boom/
      );
    });

    it('should restore previous context after runWithTrace', async () => {
      await runWithTrace('outer', null, async () => {
        assert.strictEqual(getTraceContext().traceId, 'outer');
        await runWithTrace('inner', null, async () => {
          assert.strictEqual(getTraceContext().traceId, 'inner');
        });
        assert.strictEqual(getTraceContext().traceId, 'outer');
      });
    });
  });

  // ── TraceManager ──────────────────────────────────────────────────────

  describe('TraceManager', () => {
    it('should export TraceManager class', () => {
      assert.ok(TraceManager);
    });

    it('should create an empty instance', () => {
      const tm = new TraceManager();
      const status = tm.getStatus();
      assert.strictEqual(status.totalTraces, 0);
      assert.strictEqual(status.totalSpans, 0);
    });

    it('should start and retrieve a span', () => {
      const tm = new TraceManager();
      const span = tm.startSpan({ traceId: 't1', operationName: 'op1' });
      const retrieved = tm.getSpan(span.id);
      assert.strictEqual(retrieved, span);
    });

    it('should return null for unknown span', () => {
      const tm = new TraceManager();
      assert.strictEqual(tm.getSpan('nonexistent'), null);
    });

    it('should track spans by trace ID', () => {
      const tm = new TraceManager();
      tm.startSpan({ traceId: 't1', operationName: 'op1' });
      tm.startSpan({ traceId: 't1', operationName: 'op2' });
      tm.startSpan({ traceId: 't2', operationName: 'op3' });

      const t1Spans = tm.getSpansForTrace('t1');
      assert.strictEqual(t1Spans.length, 2);

      const t2Spans = tm.getSpansForTrace('t2');
      assert.strictEqual(t2Spans.length, 1);
    });

    it('should return empty array for unknown trace', () => {
      const tm = new TraceManager();
      assert.deepStrictEqual(tm.getSpansForTrace('unknown'), []);
    });

    it('should end a span by ID', () => {
      const tm = new TraceManager();
      const span = tm.startSpan({ traceId: 't1', operationName: 'op1' });
      const ended = tm.endSpan(span.id, 'ok', { key: 'val' });
      assert.strictEqual(ended.status, 'ok');
      assert.strictEqual(ended.attributes.key, 'val');
      assert.ok(ended.endTime);
    });

    it('should return null when ending unknown span', () => {
      const tm = new TraceManager();
      assert.strictEqual(tm.endSpan('nope'), null);
    });

    it('should auto-generate traceId if not provided', async () => {
      const tm = new TraceManager();
      // Without any context, traceId is auto-generated
      const span = tm.startSpan({ operationName: 'auto' });
      assert.ok(span.traceId.startsWith('trace-'));
    });

    it('should pick up traceId from AsyncLocalStorage context', async () => {
      const tm = new TraceManager();
      await runWithTrace('ctx-trace', 'ctx-parent', async () => {
        const span = tm.startSpan({ operationName: 'from-ctx' });
        assert.strictEqual(span.traceId, 'ctx-trace');
        assert.strictEqual(span.parentSpanId, 'ctx-parent');
      });
    });

    it('should build a span tree', () => {
      const tm = new TraceManager();
      const root = tm.startSpan({ traceId: 'tree', operationName: 'root' });
      const child1 = tm.startSpan({ traceId: 'tree', parentSpanId: root.id, operationName: 'child1' });
      const child2 = tm.startSpan({ traceId: 'tree', parentSpanId: root.id, operationName: 'child2' });
      const grandchild = tm.startSpan({ traceId: 'tree', parentSpanId: child1.id, operationName: 'grandchild' });

      tm.endSpan(root.id);
      tm.endSpan(child1.id);
      tm.endSpan(child2.id);
      tm.endSpan(grandchild.id);

      const tree = tm.getSpanTree('tree');
      assert.strictEqual(tree.totalSpans, 4);
      assert.strictEqual(tree.rootSpans.length, 1);
      assert.strictEqual(tree.rootSpans[0].operationName, 'root');
      assert.strictEqual(tree.rootSpans[0].children.length, 2);

      // Find child1 in tree
      const c1 = tree.rootSpans[0].children.find(c => c.operationName === 'child1');
      assert.ok(c1);
      assert.strictEqual(c1.children.length, 1);
      assert.strictEqual(c1.children[0].operationName, 'grandchild');
    });

    it('should return empty tree for unknown trace', () => {
      const tm = new TraceManager();
      const tree = tm.getSpanTree('nope');
      assert.strictEqual(tree.totalSpans, 0);
      assert.deepStrictEqual(tree.rootSpans, []);
    });

    it('should get spans for goal', () => {
      const tm = new TraceManager();
      tm.startSpan({ traceId: 'g-1', operationName: 'goal', goalId: 'g-1' });
      tm.startSpan({ traceId: 'g-1', operationName: 'task', goalId: 'g-1', taskId: 't-1' });
      tm.startSpan({ traceId: 'other', operationName: 'other', goalId: 'other' });

      const spans = tm.getSpansForGoal('g-1');
      assert.strictEqual(spans.length, 2);
    });

    it('should emit span-started event', (_, done) => {
      const tm = new TraceManager();
      tm.on('span-started', (data) => {
        assert.strictEqual(data.operationName, 'evented');
        done();
      });
      tm.startSpan({ traceId: 't', operationName: 'evented' });
    });

    it('should emit span-ended event', (_, done) => {
      const tm = new TraceManager();
      const span = tm.startSpan({ traceId: 't', operationName: 'end-event' });
      tm.on('span-ended', (data) => {
        assert.strictEqual(data.operationName, 'end-event');
        assert.strictEqual(data.status, 'ok');
        done();
      });
      tm.endSpan(span.id);
    });

    it('should enforce maxSpansPerTrace limit', () => {
      const tm = new TraceManager({ maxSpansPerTrace: 5 });
      const allSpans = [];
      for (let i = 0; i < 10; i++) {
        allSpans.push(tm.startSpan({ traceId: 'limited', operationName: `op-${i}` }));
      }
      // Only first 5 should be stored in the trace
      const spans = tm.getSpansForTrace('limited');
      assert.strictEqual(spans.length, 5);
      // Later spans should be noop (dropped)
      assert.strictEqual(allSpans[5].attributes._dropped, true);
      assert.strictEqual(allSpans[9].attributes._dropped, true);
    });

    it('should evict oldest completed spans when maxSpans exceeded', () => {
      const tm = new TraceManager({ maxSpans: 5 });

      // Create and complete 5 spans
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const s = tm.startSpan({ traceId: `t${i}`, operationName: `op-${i}` });
        s.end('ok');
        ids.push(s.id);
      }
      assert.strictEqual(tm.getStatus().totalSpans, 5);

      // Adding one more should trigger eviction
      tm.startSpan({ traceId: 't-new', operationName: 'new-op' });
      assert.ok(tm.getStatus().totalSpans <= 5);
    });

    it('should clear all spans', () => {
      const tm = new TraceManager();
      tm.startSpan({ traceId: 'a', operationName: 'op1' });
      tm.startSpan({ traceId: 'b', operationName: 'op2' });
      assert.strictEqual(tm.getStatus().totalSpans, 2);

      tm.clear();
      assert.strictEqual(tm.getStatus().totalTraces, 0);
      assert.strictEqual(tm.getStatus().totalSpans, 0);
    });

    it('should remove a specific trace', () => {
      const tm = new TraceManager();
      tm.startSpan({ traceId: 'keep', operationName: 'op1' });
      tm.startSpan({ traceId: 'remove', operationName: 'op2' });
      tm.startSpan({ traceId: 'remove', operationName: 'op3' });

      tm.removeTrace('remove');
      assert.strictEqual(tm.getSpansForTrace('remove').length, 0);
      assert.strictEqual(tm.getSpansForTrace('keep').length, 1);
    });

    it('should produce correct getStatus summary', () => {
      const tm = new TraceManager();
      const s1 = tm.startSpan({ traceId: 't1', operationName: 'goal' });
      const s2 = tm.startSpan({ traceId: 't1', operationName: 'task' });
      tm.endSpan(s1.id, 'ok');
      // s2 still running

      const status = tm.getStatus();
      assert.strictEqual(status.totalTraces, 1);
      assert.strictEqual(status.totalSpans, 2);
      assert.strictEqual(status.traces.t1.completed, 1);
      assert.strictEqual(status.traces.t1.running, 1);
      assert.strictEqual(status.traces.t1.errors, 0);
      assert.deepStrictEqual(status.traces.t1.operations, { goal: 1, task: 1 });
    });

    it('should handle noop span from exceeded limit gracefully', () => {
      const tm = new TraceManager({ maxSpansPerTrace: 1 });
      const real = tm.startSpan({ traceId: 'x', operationName: 'real' });
      const noop = tm.startSpan({ traceId: 'x', operationName: 'excess' });
      assert.strictEqual(noop.attributes._dropped, true);
      assert.strictEqual(noop.status, 'ok'); // already ended
    });
  });
});
