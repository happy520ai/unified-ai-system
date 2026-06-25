import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('LiveStream', () => {
  let LiveStream, StreamEvent;

  before(async () => {
    const mod = await import('../src/live-stream/index.js');
    LiveStream = mod.LiveStream;
    StreamEvent = mod.StreamEvent;
  });

  it('should export StreamEvent enum with all values', () => {
    assert.equal(StreamEvent.TASK_START, 'task_start');
    assert.equal(StreamEvent.FILE_READ, 'file_read');
    assert.equal(StreamEvent.FILE_WRITE, 'file_write');
    assert.equal(StreamEvent.LLM_CALL_START, 'llm_call_start');
    assert.equal(StreamEvent.LLM_CALL_END, 'llm_call_end');
    assert.equal(StreamEvent.ACTION_EXECUTE, 'action_execute');
    assert.equal(StreamEvent.TOOL_CALL, 'tool_call');
    assert.equal(StreamEvent.ERROR, 'error');
    assert.equal(StreamEvent.TASK_COMPLETE, 'task_complete');
    assert.equal(StreamEvent.TASK_FAIL, 'task_fail');
  });

  it('should freeze StreamEvent enum', () => {
    assert.ok(Object.isFrozen(StreamEvent));
  });

  it('should create instance with default options', () => {
    const stream = new LiveStream();
    assert.ok(stream instanceof LiveStream);
  });

  it('should create instance with custom options', () => {
    const stream = new LiveStream({
      maxHistory: 2000,
      maxSubscribers: 50,
      broadcastTimeout: 10000,
    });
    assert.ok(stream instanceof LiveStream);
  });

  it('should emit event and store in history', () => {
    const stream = new LiveStream();
    stream.emit({
      type: StreamEvent.TASK_START,
      taskId: 'task-1',
      data: { taskName: 'test task' },
    });
    const history = stream.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].type, StreamEvent.TASK_START);
    assert.equal(history[0].taskId, 'task-1');
  });

  it('should auto-generate event id and timestamp', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    const history = stream.getHistory();
    assert.ok(history[0].id);
    assert.ok(history[0].id.startsWith('evt-'));
    assert.ok(typeof history[0].timestamp === 'number');
  });

  it('should evict oldest events when maxHistory exceeded', () => {
    const stream = new LiveStream({ maxHistory: 3 });
    for (let i = 0; i < 5; i++) {
      stream.emit({ type: StreamEvent.FILE_READ, data: { index: i } });
    }
    const history = stream.getHistory();
    assert.equal(history.length, 3);
  });

  it('should subscribe and receive events', async () => {
    const stream = new LiveStream();
    const received = [];
    stream.subscribe((evt) => received.push(evt));
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(received.length, 1);
  });

  it('should filter subscriber by taskId', async () => {
    const stream = new LiveStream();
    const received = [];
    stream.subscribe((evt) => received.push(evt), { taskId: 'task-1' });
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-2' });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(received.length, 1);
    assert.equal(received[0].taskId, 'task-1');
  });

  it('should filter subscriber by eventTypes', async () => {
    const stream = new LiveStream();
    const received = [];
    stream.subscribe((evt) => received.push(evt), {
      eventTypes: [StreamEvent.ERROR],
    });
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.ERROR, taskId: 'task-1' });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(received.length, 1);
    assert.equal(received[0].type, StreamEvent.ERROR);
  });

  it('should unsubscribe correctly', async () => {
    const stream = new LiveStream();
    const received = [];
    const unsub = stream.subscribe((evt) => received.push(evt));
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(received.length, 1);
    unsub();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-2' });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(received.length, 1, 'Should not receive events after unsubscribe');
  });

  it('should evict oldest subscriber when maxSubscribers exceeded', () => {
    const stream = new LiveStream({ maxSubscribers: 2 });
    stream.subscribe(() => {});
    stream.subscribe(() => {});
    stream.subscribe(() => {});
    const stats = stream.getStats();
    assert.equal(stats.activeSubscribers, 2);
  });

  it('should track active tasks', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.FILE_READ, taskId: 'task-1' });
    const active = stream.getActiveTasks();
    assert.equal(active.length, 1);
    assert.equal(active[0].taskId, 'task-1');
    assert.equal(active[0].eventCount, 2);
  });

  it('should remove task from active on TASK_COMPLETE', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.TASK_COMPLETE, taskId: 'task-1' });
    const active = stream.getActiveTasks();
    assert.equal(active.length, 0);
  });

  it('should remove task from active on TASK_FAIL', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.TASK_FAIL, taskId: 'task-1' });
    const active = stream.getActiveTasks();
    assert.equal(active.length, 0);
  });

  it('should return event statistics', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.FILE_READ, taskId: 'task-1' });
    const stats = stream.getStats();
    assert.equal(stats.totalEvents, 2);
    assert.equal(stats.byType[StreamEvent.TASK_START], 1);
    assert.equal(stats.byType[StreamEvent.FILE_READ], 1);
    assert.equal(stats.activeTasks, 1);
  });

  it('should broadcast array of events', () => {
    const stream = new LiveStream();
    const events = [
      { type: StreamEvent.TASK_START, taskId: 'task-1' },
      { type: StreamEvent.FILE_READ, taskId: 'task-1' },
      { type: StreamEvent.FILE_WRITE, taskId: 'task-1' },
    ];
    const result = stream.broadcast(events);
    assert.equal(result.delivered, 3);
    assert.equal(result.failed, 0);
    const history = stream.getHistory();
    assert.equal(history.length, 3);
  });

  it('should filter history by taskId', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-2' });
    const history = stream.getHistory({ taskId: 'task-1' });
    assert.equal(history.length, 1);
    assert.equal(history[0].taskId, 'task-1');
  });

  it('should filter history by eventTypes', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.emit({ type: StreamEvent.ERROR, taskId: 'task-1' });
    const history = stream.getHistory({ eventTypes: [StreamEvent.ERROR] });
    assert.equal(history.length, 1);
    assert.equal(history[0].type, StreamEvent.ERROR);
  });

  it('should filter history by timestamp', () => {
    const stream = new LiveStream();
    const now = Date.now();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1', timestamp: now - 1000 });
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-2', timestamp: now });
    const history = stream.getHistory({ after: now - 500 });
    assert.equal(history.length, 1);
    assert.equal(history[0].taskId, 'task-2');
  });

  it('should limit history results', () => {
    const stream = new LiveStream();
    for (let i = 0; i < 10; i++) {
      stream.emit({ type: StreamEvent.FILE_READ, data: { index: i } });
    }
    const history = stream.getHistory({ limit: 3 });
    assert.equal(history.length, 3);
  });

  it('should reconstruct timeline with paired events', () => {
    const stream = new LiveStream();
    const now = Date.now();
    stream.emit({
      type: StreamEvent.LLM_CALL_START,
      taskId: 'task-1',
      timestamp: now,
      data: { model: 'gpt-4' },
    });
    stream.emit({
      type: StreamEvent.LLM_CALL_END,
      taskId: 'task-1',
      timestamp: now + 1000,
      data: { model: 'gpt-4', tokens: 100 },
    });
    const timeline = stream.getTimeline('task-1');
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].duration, 1000);
    assert.ok(timeline[0].summary.includes('LLM call started'));
  });

  it('should handle unmatched start events in timeline', () => {
    const stream = new LiveStream();
    stream.emit({
      type: StreamEvent.LLM_CALL_START,
      taskId: 'task-1',
      data: { model: 'gpt-4' },
    });
    const timeline = stream.getTimeline('task-1');
    assert.equal(timeline.length, 1);
    assert.ok(timeline[0].summary.includes('incomplete'));
  });

  it('should return empty timeline for unknown task', () => {
    const stream = new LiveStream();
    const timeline = stream.getTimeline('unknown-task');
    assert.equal(timeline.length, 0);
  });

  it('should clear history and stats', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    stream.clear();
    const stats = stream.getStats();
    assert.equal(stats.totalEvents, 0);
    assert.equal(stats.activeTasks, 0);
    const history = stream.getHistory();
    assert.equal(history.length, 0);
  });

  it('should return status snapshot', () => {
    const stream = new LiveStream();
    stream.emit({ type: StreamEvent.TASK_START, taskId: 'task-1' });
    const status = stream.getStatus();
    assert.equal(status.events, 1);
    assert.equal(status.subscribers, 0);
    assert.equal(status.activeTasks, 1);
  });
});
