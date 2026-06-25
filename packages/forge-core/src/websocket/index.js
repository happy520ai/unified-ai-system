/**
 * WebSocket message handler for bidirectional communication.
 * Handles incoming messages from Web Console clients.
 */
export class WebSocketHandler {
  #handlers = new Map();

  /**
   * Register a message handler.
   *
   * @param {string} type - Message type to listen for.
   * @param {(socket: import('node:net').Socket, msg: object) => void} handler
   */
  on(type, handler) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, []);
    this.#handlers.get(type).push(handler);
  }

  /**
   * Remove a specific handler for a message type.
   *
   * @param {string} type - Message type.
   * @param {Function} handler - The handler function to remove.
   */
  off(type, handler) {
    const handlers = this.#handlers.get(type);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  }

  /**
   * Process an incoming WebSocket message.
   *
   * Expects a decoded UTF-8 string. Parses it as JSON and dispatches to
   * any registered handlers for the message `type` field.
   *
   * @param {import('node:net').Socket} socket - The sender's socket.
   * @param {string} rawMessage - The decoded message string.
   */
  handleMessage(socket, rawMessage) {
    try {
      const msg = JSON.parse(rawMessage);
      const handlers = this.#handlers.get(msg.type) || [];
      for (const handler of handlers) {
        handler(socket, msg);
      }
    } catch (err) {
      console.error('[forge:ws] Invalid message:', err.message);
    }
  }

  /**
   * Convenience method: parse a raw buffer from the socket and, if it
   * contains a text frame, dispatch it through handleMessage.
   *
   * @param {import('node:net').Socket} socket - The sender's socket.
   * @param {Buffer} buffer - Raw bytes received from the socket.
   * @returns {{ type: string, data?: string } | null} The parsed frame, or null if incomplete.
   */
  receiveFrame(socket, buffer) {
    const frame = WebSocketHandler.parseFrame(buffer);
    if (!frame) return null;
    if (frame.type === 'text' && frame.data != null) {
      this.handleMessage(socket, frame.data);
    }
    return frame;
  }

  /**
   * Parse a WebSocket frame (simplified, text-only).
   *
   * Handles the RFC 6455 base framing protocol for text and close frames.
   * Masked payloads (required for client-to-server frames) are unmasked
   * in place.
   *
   * @param {Buffer} buffer - Raw bytes from the socket.
   * @returns {{ type: 'text', data: string } | { type: 'close' } | null}
   *   Parsed frame object, or null if the buffer is too short.
   */
  static parseFrame(buffer) {
    if (buffer.length < 2) return null;

    const opcode = buffer[0] & 0x0F;
    if (opcode === 0x08) return { type: 'close' }; // Close frame

    const masked = (buffer[1] & 0x80) !== 0;
    let payloadLen = buffer[1] & 0x7F;
    let offset = 2;

    if (payloadLen === 126) {
      if (buffer.length < 4) return null;
      payloadLen = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLen === 127) {
      if (buffer.length < 10) return null;
      payloadLen = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }

    let mask = null;
    if (masked) {
      if (buffer.length < offset + 4) return null;
      mask = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length < offset + payloadLen) return null;

    const payload = buffer.slice(offset, offset + payloadLen);
    if (mask) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
    }

    return { type: 'text', data: payload.toString('utf-8') };
  }
}
