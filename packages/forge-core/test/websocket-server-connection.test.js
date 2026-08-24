import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { request } from 'node:http';
import net from 'node:net';

// ---------------------------------------------------------------------------
// Helpers for server connection tests
// ---------------------------------------------------------------------------

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

  const authAdapter = {
    authorize: () => ({
      allowed: true,
      identity: { userId: 'test-operator', role: 'developer', permissions: ['dashboard:read'] },
      permission: 'dashboard:read',
    }),
    resolvePermission: () => 'dashboard:read',
  };

  return { forge, agentPool, userMgr: null, knowledge: null, transfer: null, gateway: null, authAdapter };
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
// ForgeServer WebSocket connection and broadcast tests
// ===========================================================================

describe('ForgeServer WebSocket Connection', () => {
  let server, httpServer, port;

  before(async () => {
    const mocks = createMocks();
    server = new ForgeServer({ ...mocks, port: 0 });
    httpServer = server.start();
    await new Promise((resolve) => {
      if (httpServer.listening) resolve();
      else httpServer.once('listening', resolve);
    });
    port = httpServer.address().port;
  });

  after(() => {
    server.stop();
  });

  it('should accept WebSocket upgrade and send connected message', async () => {
    assert.strictEqual(httpServer.address().address, '127.0.0.1');
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const reader = createFrameReader();

    const connectedMsg = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for connected frame')), 5000);
      socket.on('data', (chunk) => {
        const str = chunk.toString();
        const frameStart = str.indexOf('\r\n\r\n');
        if (frameStart >= 0) {
          const headerEnd = chunk.indexOf('\r\n\r\n') + 4;
          const frameData = chunk.slice(headerEnd);
          if (frameData.length > 0) reader.push(frameData);
        } else {
          reader.push(chunk);
        }
        if (reader.frames.length > 0) {
          clearTimeout(timeout);
          const msg = JSON.parse(reader.frames[0].data);
          resolve(msg);
        }
      });
      socket.on('error', reject);

      const wsKey = createHash('sha1').update(Date.now().toString() + 'a').digest('base64');
      const req = [
        'GET / HTTP/1.1',
        'Host: localhost:' + port,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + wsKey,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n');
      socket.write(req);
    });

    assert.strictEqual(connectedMsg.type, 'connected');
    assert.ok(connectedMsg.status);
    assert.strictEqual(connectedMsg.status.activeWorkers, 2);
    assert.ok(connectedMsg.timestamp);
    socket.destroy();
  });

  it('should broadcast agent pool events to WS clients', async () => {
    const mocks = createMocks();
    const srv = new ForgeServer({ ...mocks, port: 0 });
    const http = srv.start();
    await new Promise((resolve) => {
      if (http.listening) resolve();
      else http.once('listening', resolve);
    });
    const p = http.address().port;

    const socket = net.createConnection({ port: p, host: '127.0.0.1' });
    const reader = createFrameReader();
    let handshakeDone = false;

    const taskEvent = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for task_started')), 5000);
      socket.on('data', (chunk) => {
        if (!handshakeDone) {
          const str = chunk.toString();
          const frameStart = str.indexOf('\r\n\r\n');
          if (frameStart >= 0) {
            handshakeDone = true;
            const headerEnd = chunk.indexOf('\r\n\r\n') + 4;
            const frameData = chunk.slice(headerEnd);
            if (frameData.length > 0) reader.push(frameData);
          }
        } else {
          reader.push(chunk);
        }
        for (const f of reader.frames) {
          try {
            const msg = JSON.parse(f.data);
            if (msg.type === 'task_started') {
              clearTimeout(timeout);
              resolve(msg);
              return;
            }
          } catch { /* best-effort cleanup */ }
        }
      });
      socket.on('error', reject);

      const wsKey = createHash('sha1').update(Date.now().toString() + 'b').digest('base64');
      const req = [
        'GET / HTTP/1.1',
        'Host: localhost:' + p,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + wsKey,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n');
      socket.write(req);

      setTimeout(() => {
        mocks.agentPool.emit('task_started', { taskId: 't-42', task: 'build UI' });
      }, 300);
    });

    assert.strictEqual(taskEvent.type, 'task_started');
    assert.strictEqual(taskEvent.taskId, 't-42');
    assert.strictEqual(taskEvent.task, 'build UI');

    socket.destroy();
    srv.stop();
  });

  it('should broadcast verification events', async () => {
    const mocks = createMocks();
    const srv = new ForgeServer({ ...mocks, port: 0 });
    const http = srv.start();
    await new Promise((resolve) => {
      if (http.listening) resolve();
      else http.once('listening', resolve);
    });
    const p = http.address().port;

    const socket = net.createConnection({ port: p, host: '127.0.0.1' });
    const reader = createFrameReader();
    let handshakeDone = false;

    const verifyMsg = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for verification_failed')), 5000);
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
            if (msg.type === 'verification_failed') {
              clearTimeout(timeout);
              resolve(msg);
              return;
            }
          } catch { /* best-effort cleanup */ }
        }
      });
      socket.on('error', reject);

      const wsKey = createHash('sha1').update(Date.now().toString() + 'f').digest('base64');
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
        mocks.agentPool.emit('verification_failed', { taskId: 't-99', failures: 3 });
      }, 300);
    });

    assert.strictEqual(verifyMsg.type, 'verification_failed');
    assert.strictEqual(verifyMsg.taskId, 't-99');
    assert.strictEqual(verifyMsg.failures, 3);

    socket.destroy();
    srv.stop();
  });

  it('rejects anonymous HTTP API and WebSocket access', async () => {
    const mocks = createMocks();
    const deniedAuthAdapter = {
      authorize: (_req, permission) => ({
        allowed: false,
        identity: null,
        permission,
        error: { statusCode: 401, code: 'auth_required', message: 'Authentication required' },
      }),
      resolvePermission: () => 'dashboard:read',
    };
    const srv = new ForgeServer({ ...mocks, authAdapter: deniedAuthAdapter, port: 0 });
    const http = srv.start();
    await new Promise((resolve) => http.once('listening', resolve));
    const p = http.address().port;

    const apiStatus = await new Promise((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: p, path: '/api/goals' }, (res) => {
        res.resume();
        res.once('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(apiStatus, 401);

    const upgradeResponse = await new Promise((resolve, reject) => {
      const socket = net.createConnection({ port: p, host: '127.0.0.1' });
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for WebSocket rejection')), 5000);
      socket.on('data', (chunk) => {
        clearTimeout(timeout);
        resolve(chunk.toString('utf8'));
        socket.destroy();
      });
      socket.on('error', reject);
      const wsKey = createHash('sha1').update(Date.now().toString() + 'denied').digest('base64');
      socket.write([
        'GET / HTTP/1.1',
        `Host: 127.0.0.1:${p}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${wsKey}`,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n'));
    });
    assert.match(upgradeResponse, /^HTTP\/1\.1 401 /);
    assert.doesNotMatch(upgradeResponse, /101 Switching Protocols/);
    srv.stop();
  });
});
