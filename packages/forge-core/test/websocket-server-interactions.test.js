import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import net from 'node:net';

// ---------------------------------------------------------------------------
// Helpers for server interaction tests
// ---------------------------------------------------------------------------

/** Build a masked client→server WebSocket frame (RFC 6455). */
function makeClientFrame(text) {
  const payload = Buffer.from(text, 'utf-8');
  const mask = Buffer.from([0x37, 0x52, 0x1a, 0x7e]);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];

  let header;
  const len = payload.length;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, mask, masked]);
}

/** Parse an unmasked server→client frame. */
function parseServerFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0F;
  if (opcode === 0x08) return { type: 'close' };
  let payloadLen = buf[1] & 0x7F;
  let offset = 2;
  if (payloadLen === 126) { payloadLen = buf.readUInt16BE(2); offset = 4; }
  else if (payloadLen === 127) { payloadLen = Number(buf.readBigUInt64BE(2)); offset = 10; }
  if (buf.length < offset + payloadLen) return null;
  const payload = buf.slice(offset, offset + payloadLen).toString('utf-8');
  return { type: opcode === 0x01 ? 'text' : 'unknown', data: payload };
}

/** Accumulate TCP chunks and yield parsed frames. */
function createFrameReader() {
  let buf = Buffer.alloc(0);
  const frames = [];
  return {
    push(chunk) {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const f = parseServerFrame(buf);
        if (!f) break;
        let payloadLen = buf[1] & 0x7F;
        let hdrLen = 2;
        if (payloadLen === 126) { hdrLen = 4; }
        else if (payloadLen === 127) { hdrLen = 10; }
        const totalLen = hdrLen + (payloadLen === 126 ? buf.readUInt16BE(2) : payloadLen === 127 ? Number(buf.readBigUInt64BE(2)) : payloadLen);
        if (buf.length < totalLen) break;
        frames.push(f);
        buf = buf.slice(totalLen);
      }
    },
    get frames() { return frames; },
    clear() { frames.length = 0; },
  };
}

/** Create mock dependencies for ForgeServer. */
function createMocks() {
  const agentPool = new EventEmitter();
  agentPool.getStatus = () => ({
    activeWorkers: 2,
    utilization: 50,
    queueLength: 1,
    goals: [{ goalId: 'g1', goal: 'test goal', totalTasks: 3, completedTasks: 1 }],
    queue: [{ goalId: 'g2', goal: 'queued goal', priority: 'normal' }],
    fileLocks: { 'src/app.js': 'g1' },
    budget: { tokensUsed: 5000, costIncurred: 0.5, minutesElapsed: 5, budget: { maxTokens: 2000000, maxCost: 50, maxMinutes: 120 } },
    maxGoals: 3,
    maxConcurrent: 4,
    workers: [{ type: 'implement', task: 'write code', startedAt: new Date().toISOString() }],
    verification: { enabled: true, autoVerify: true, total: 5, passed: 4, failed: 1, retried: 1, retryQueue: 0 },
  });
  agentPool.getMetrics = () => ({
    tasks: { total: 10, completed: 8, failed: 2, successRate: 0.8, avgDurationMs: 1500, p50DurationMs: 1200, p95DurationMs: 3000 },
    throughput: { perMinute: 2, perMinuteRate: 2 },
  });

  const forge = {
    listGoals: () => [
      { id: 'g1', goal: 'test goal', status: 'running' },
      { id: 'g2', goal: 'queued goal', status: 'pending' },
    ],
    store: { logEvent: () => {} },
  };

  return { forge, agentPool, userMgr: null, knowledge: null, transfer: null, gateway: null };
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

let ForgeServer;

before(async () => {
  const srvMod = await import('../src/api-server/index.js');
  ForgeServer = srvMod.ForgeServer;
});

// ===========================================================================
// ForgeServer WebSocket interaction tests
// ===========================================================================

describe('ForgeServer WebSocket Interactions', () => {
  it('should handle client ping and respond with pong', async () => {
    const mocks = createMocks();
    const srv = new ForgeServer({ ...mocks, port: 0 });
    const http = srv.start();
    await new Promise((resolve) => {
      if (http.listening) resolve();
      else http.once('listening', resolve);
    });
    const p = http.address().port;

    const socket = net.createConnection({ port: p });
    const reader = createFrameReader();
    let handshakeDone = false;

    const pongMsg = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for pong')), 5000);
      socket.on('data', (chunk) => {
        if (!handshakeDone) {
          const str = chunk.toString();
          if (str.indexOf('\r\n\r\n') >= 0) {
            handshakeDone = true;
            const headerEnd = chunk.indexOf('\r\n\r\n') + 4;
            if (chunk.length > headerEnd) reader.push(chunk.slice(headerEnd));
          }
        } else {
          reader.push(chunk);
        }
        for (const f of reader.frames) {
          try {
            const msg = JSON.parse(f.data);
            if (msg.type === 'pong') {
              clearTimeout(timeout);
              resolve(msg);
              return;
            }
          } catch { /* best-effort cleanup */ }
        }
      });
      socket.on('error', reject);

      const wsKey = createHash('sha1').update(Date.now().toString() + 'c').digest('base64');
      socket.write([
        'GET / HTTP/1.1',
        'Host: localhost:' + p,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + wsKey,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n'));

      setTimeout(() => {
        socket.write(makeClientFrame(JSON.stringify({ type: 'ping' })));
      }, 300);
    });

    assert.strictEqual(pongMsg.type, 'pong');
    assert.ok(pongMsg.timestamp);

    socket.destroy();
    srv.stop();
  });

  it('should respond to refresh_scheduler with scheduler_update', async () => {
    const mocks = createMocks();
    const srv = new ForgeServer({ ...mocks, port: 0 });
    const http = srv.start();
    await new Promise((resolve) => {
      if (http.listening) resolve();
      else http.once('listening', resolve);
    });
    const p = http.address().port;

    const socket = net.createConnection({ port: p });
    const reader = createFrameReader();
    let handshakeDone = false;

    const schedulerMsg = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for scheduler_update')), 5000);
      socket.on('data', (chunk) => {
        if (!handshakeDone) {
          const str = chunk.toString();
          if (str.indexOf('\r\n\r\n') >= 0) {
            handshakeDone = true;
            const headerEnd = chunk.indexOf('\r\n\r\n') + 4;
            if (chunk.length > headerEnd) reader.push(chunk.slice(headerEnd));
          }
        } else {
          reader.push(chunk);
        }
        for (const f of reader.frames) {
          try {
            const msg = JSON.parse(f.data);
            if (msg.type === 'scheduler_update') {
              clearTimeout(timeout);
              resolve(msg);
              return;
            }
          } catch { /* best-effort cleanup */ }
        }
      });
      socket.on('error', reject);

      const wsKey = createHash('sha1').update(Date.now().toString() + 'd').digest('base64');
      socket.write([
        'GET / HTTP/1.1',
        'Host: localhost:' + p,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + wsKey,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n'));

      setTimeout(() => {
        socket.write(makeClientFrame(JSON.stringify({ type: 'refresh_scheduler' })));
      }, 300);
    });

    assert.strictEqual(schedulerMsg.type, 'scheduler_update');
    assert.ok(schedulerMsg.data);
    assert.strictEqual(schedulerMsg.data.activeWorkers, 2);
    assert.ok(schedulerMsg.data.verification);

    socket.destroy();
    srv.stop();
  });

  it('should send periodic snapshots when WS clients are connected', async () => {
    const mocks = createMocks();
    const srv = new ForgeServer({ ...mocks, port: 0 });
    const http = srv.start();
    await new Promise((resolve) => {
      if (http.listening) resolve();
      else http.once('listening', resolve);
    });
    const p = http.address().port;

    const socket = net.createConnection({ port: p });
    const reader = createFrameReader();
    let handshakeDone = false;

    const snapshotMsg = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for snapshot (20s)')), 20000);
      socket.on('data', (chunk) => {
        if (!handshakeDone) {
          const str = chunk.toString();
          if (str.indexOf('\r\n\r\n') >= 0) {
            handshakeDone = true;
            const headerEnd = chunk.indexOf('\r\n\r\n') + 4;
            if (chunk.length > headerEnd) reader.push(chunk.slice(headerEnd));
          }
        } else {
          reader.push(chunk);
        }
        for (const f of reader.frames) {
          try {
            const msg = JSON.parse(f.data);
            if (msg.type === 'snapshot') {
              clearTimeout(timeout);
              resolve(msg);
              return;
            }
          } catch { /* best-effort cleanup */ }
        }
      });
      socket.on('error', reject);

      const wsKey = createHash('sha1').update(Date.now().toString() + 'e').digest('base64');
      socket.write([
        'GET / HTTP/1.1',
        'Host: localhost:' + p,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + wsKey,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n'));
    });

    assert.strictEqual(snapshotMsg.type, 'snapshot');
    assert.ok(snapshotMsg.pool);
    assert.ok(snapshotMsg.stats);
    assert.ok(snapshotMsg.uptime > 0);
    assert.ok(snapshotMsg.timestamp);
    assert.ok(Array.isArray(snapshotMsg.pool.goals));
    assert.ok(Array.isArray(snapshotMsg.pool.queue));
    assert.strictEqual(snapshotMsg.stats.activeGoals, 1);
    assert.strictEqual(snapshotMsg.stats.runningTasks, 2);

    socket.destroy();
    srv.stop();
  });

  it('should clean up WS client on socket close', async () => {
    const mocks = createMocks();
    const srv = new ForgeServer({ ...mocks, port: 0 });
    const http = srv.start();
    await new Promise((resolve) => {
      if (http.listening) resolve();
      else http.once('listening', resolve);
    });
    const p = http.address().port;

    const socket = net.createConnection({ port: p });
    let connected = false;

    await new Promise((resolve, reject) => {
      socket.on('data', (chunk) => {
        const str = chunk.toString();
        if (str.includes('101 Switching Protocols')) connected = true;
      });

      const wsKey = createHash('sha1').update(Date.now().toString() + 'g').digest('base64');
      socket.write([
        'GET / HTTP/1.1',
        'Host: localhost:' + p,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + wsKey,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n'));

      setTimeout(() => {
        assert.ok(connected, 'Should have connected');
        socket.destroy();
        setTimeout(resolve, 200);
      }, 300);
    });

    mocks.agentPool.emit('task_started', { taskId: 'after-close' });
    await new Promise(r => setTimeout(r, 100));

    srv.stop();
  });
});
