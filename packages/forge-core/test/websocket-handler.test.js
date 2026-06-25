import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers for frame parsing
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
    header[0] = 0x81;           // FIN + text
    header[1] = 0x80 | len;     // MASK + length
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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

let WebSocketHandler;

before(async () => {
  const wsMod = await import('../src/websocket/index.js');
  WebSocketHandler = wsMod.WebSocketHandler;
});

// ===========================================================================
// WebSocketHandler unit tests
// ===========================================================================

describe('WebSocketHandler', () => {
  it('should export WebSocketHandler class', () => {
    assert.ok(WebSocketHandler);
    assert.strictEqual(typeof WebSocketHandler, 'function');
  });

  it('should parse a masked text frame', () => {
    const text = 'hello';
    const frame = makeClientFrame(text);
    const parsed = WebSocketHandler.parseFrame(frame);
    assert.ok(parsed);
    assert.strictEqual(parsed.type, 'text');
    assert.strictEqual(parsed.data, text);
  });

  it('should parse a close frame', () => {
    const closeFrame = Buffer.from([0x88, 0x80, 0x00, 0x00, 0x00, 0x00]);
    const parsed = WebSocketHandler.parseFrame(closeFrame);
    assert.ok(parsed);
    assert.strictEqual(parsed.type, 'close');
  });

  it('should return null for incomplete buffer', () => {
    const result = WebSocketHandler.parseFrame(Buffer.from([0x81]));
    assert.strictEqual(result, null);
  });

  it('should dispatch messages via handleMessage', () => {
    const handler = new WebSocketHandler();
    let received = null;
    handler.on('test_msg', (sock, msg) => { received = msg; });
    handler.handleMessage(null, JSON.stringify({ type: 'test_msg', data: 42 }));
    assert.ok(received);
    assert.strictEqual(received.data, 42);
  });

  it('should support on/off for handler registration', () => {
    const handler = new WebSocketHandler();
    let count = 0;
    const fn = () => { count++; };
    handler.on('evt', fn);
    handler.handleMessage(null, JSON.stringify({ type: 'evt' }));
    assert.strictEqual(count, 1);
    handler.off('evt', fn);
    handler.handleMessage(null, JSON.stringify({ type: 'evt' }));
    assert.strictEqual(count, 1); // no longer increments
  });

  it('should handle invalid JSON gracefully', () => {
    const handler = new WebSocketHandler();
    // Should not throw
    handler.handleMessage(null, 'not-valid-json{{{');
  });

  it('receiveFrame should parse and dispatch text frames', () => {
    const handler = new WebSocketHandler();
    let received = null;
    handler.on('hello', (sock, msg) => { received = msg; });

    const frame = makeClientFrame(JSON.stringify({ type: 'hello', value: 'world' }));
    const result = handler.receiveFrame('mockSocket', frame);
    assert.ok(result);
    assert.strictEqual(result.type, 'text');
    assert.ok(received);
    assert.strictEqual(received.value, 'world');
  });

  it('should parse a frame with payload length >= 126', () => {
    // Create a payload of exactly 126 chars
    const text = 'x'.repeat(126);
    const frame = makeClientFrame(text);
    const parsed = WebSocketHandler.parseFrame(frame);
    assert.ok(parsed);
    assert.strictEqual(parsed.type, 'text');
    assert.strictEqual(parsed.data.length, 126);
    assert.strictEqual(parsed.data, text);
  });
});
