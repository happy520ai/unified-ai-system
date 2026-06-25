/**
 * Multimodal Client Tests
 *
 * Tests the multimodal client API surface:
 *   - generateImage (URL + b64_json + quality/style options + error handling)
 *   - generateEmbedding (single + batch + empty input)
 *   - synthesizeSpeech (audio buffer + empty text)
 *   - transcribeAudio (buffer + null audio)
 *   - generateVideo (URL response + empty prompt)
 *   - checkGatewayHealth (healthy + unhealthy)
 *   - MultimodalError export and construction
 *   - Gateway URL management (set/get/trailing slash/validation)
 *   - Retry behavior (500 retry + exhausted retries)
 *   - Per-request timeout (AbortController signal)
 *
 * All HTTP calls are mocked via global fetch override — no real provider calls.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ── Test helpers ────────────────────────────────────────────────────────────

let originalFetch;

/**
 * Create a mock fetch that returns canned responses based on URL patterns.
 * For binary responses (audio), returns arrayBuffer.
 */
function createMockFetch(routes = {}) {
  const calls = [];
  const fetchFn = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        const result = typeof handler === 'function' ? handler(url, opts) : handler;
        if (result.binary) {
          return {
            ok: result.ok !== false,
            status: result.status || 200,
            arrayBuffer: async () => result.binary,
            json: async () => ({}),
            text: async () => '',
          };
        }
        return {
          ok: result.ok !== false,
          status: result.status || 200,
          json: async () => result.json || result.body || {},
          text: async () => result.text || JSON.stringify(result.json || result.body || {}),
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => 'Not Found' };
  };
  fetchFn.calls = calls;
  return fetchFn;
}

// ── Multimodal Client Tests ─────────────────────────────────────────────────

describe('Multimodal Client', () => {
  let multimodalmMod;

  before(async () => {
    originalFetch = globalThis.fetch;
    multimodalmMod = await import('../src/multimodal-client/index.js');
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  describe('generateImage', () => {
    it('should generate an image with URL response', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/images/generations': {
          json: {
            data: [
              { url: 'https://example.com/generated-image.png', revised_prompt: 'A beautiful sunset' },
            ],
            model: 'dall-e-3',
            provider: 'openai',
          },
        },
      });

      const result = await multimodalmMod.generateImage('A beautiful sunset over mountains', {
        model: 'dall-e-3',
        size: '1024x1024',
      });

      assert.ok(result);
      assert.equal(result.images.length, 1);
      assert.equal(result.images[0].url, 'https://example.com/generated-image.png');
      assert.equal(result.images[0].revisedPrompt, 'A beautiful sunset');
      assert.equal(result.model, 'dall-e-3');
      assert.equal(result.provider, 'openai');
    });

    it('should generate an image with b64_json response', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/images/generations': {
          json: {
            data: [
              { b64_json: 'aGVsbG8td29ybGQ=' },
            ],
            model: 'gpt-image-1',
          },
        },
      });

      const result = await multimodalmMod.generateImage('A test image', {
        model: 'gpt-image-1',
        responseFormat: 'b64_json',
      });

      assert.equal(result.images.length, 1);
      assert.equal(result.images[0].b64Json, 'aGVsbG8td29ybGQ=');
    });

    it('should throw on empty prompt', async () => {
      await assert.rejects(
        () => multimodalmMod.generateImage(''),
        /prompt is required/
      );
    });

    it('should throw on gateway error', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/images/generations': {
          ok: false,
          status: 500,
          text: 'Internal Server Error',
        },
      });

      await assert.rejects(
        () => multimodalmMod.generateImage('test'),
        /500|failed|error/i
      );
    });

    it('should pass quality and style options', async () => {
      let capturedBody = null;
      globalThis.fetch = createMockFetch({
        '/v1/images/generations': (url, opts) => {
          capturedBody = JSON.parse(opts.body);
          return {
            json: { data: [{ url: 'https://example.com/hd.png' }], model: 'dall-e-3' },
          };
        },
      });

      await multimodalmMod.generateImage('A high quality image', {
        quality: 'hd',
        style: 'vivid',
        n: 2,
      });

      assert.equal(capturedBody.quality, 'hd');
      assert.equal(capturedBody.style, 'vivid');
      assert.equal(capturedBody.n, 2);
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings for single text', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/embeddings': {
          json: {
            data: [
              { embedding: [0.1, 0.2, 0.3, 0.4, 0.5], index: 0 },
            ],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 5, total_tokens: 5 },
          },
        },
      });

      const result = await multimodalmMod.generateEmbedding('Hello world');

      assert.equal(result.embeddings.length, 1);
      assert.deepEqual(result.embeddings[0], [0.1, 0.2, 0.3, 0.4, 0.5]);
      assert.equal(result.model, 'text-embedding-3-small');
      assert.equal(result.usage.inputTokens, 5);
    });

    it('should generate embeddings for multiple texts', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/embeddings': {
          json: {
            data: [
              { embedding: [0.1, 0.2], index: 0 },
              { embedding: [0.3, 0.4], index: 1 },
              { embedding: [0.5, 0.6], index: 2 },
            ],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 15, total_tokens: 15 },
          },
        },
      });

      const result = await multimodalmMod.generateEmbedding(['text one', 'text two', 'text three']);

      assert.equal(result.embeddings.length, 3);
      assert.deepEqual(result.embeddings[1], [0.3, 0.4]);
    });

    it('should throw on empty input', async () => {
      await assert.rejects(
        () => multimodalmMod.generateEmbedding(''),
        /input is required/
      );
    });
  });

  describe('synthesizeSpeech', () => {
    it('should synthesize speech and return audio buffer info', async () => {
      const fakeAudioBytes = Buffer.alloc(1024, 0xAB);
      globalThis.fetch = createMockFetch({
        '/v1/audio/speech': {
          binary: fakeAudioBytes.buffer.slice(fakeAudioBytes.byteOffset, fakeAudioBytes.byteOffset + fakeAudioBytes.byteLength),
        },
      });

      const result = await multimodalmMod.synthesizeSpeech('Hello, this is a test.', {
        voice: 'nova',
        model: 'tts-1-hd',
        format: 'mp3',
      });

      assert.ok(result);
      assert.equal(result.format, 'mp3');
      assert.equal(result.model, 'tts-1-hd');
      assert.equal(result.sizeBytes, 1024);
    });

    it('should throw on empty text', async () => {
      await assert.rejects(
        () => multimodalmMod.synthesizeSpeech(''),
        /text is required/
      );
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe audio from buffer', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/audio/transcriptions': {
          json: {
            text: 'Hello world, this is a transcription test.',
            language: 'en',
            duration: 3.5,
          },
        },
      });

      const fakeAudio = Buffer.alloc(2048, 0xCD);
      const result = await multimodalmMod.transcribeAudio(fakeAudio, {
        model: 'whisper-1',
        language: 'en',
      });

      assert.ok(result);
      assert.equal(result.text, 'Hello world, this is a transcription test.');
      assert.equal(result.language, 'en');
      assert.equal(result.duration, 3.5);
    });

    it('should throw on null audio', async () => {
      await assert.rejects(
        () => multimodalmMod.transcribeAudio(null),
        /audio is required/
      );
    });
  });

  describe('gateway URL management', () => {
    it('should set and get gateway URL', () => {
      multimodalmMod.setMultimodalGatewayUrl('http://custom-gateway:8080');
      assert.equal(multimodalmMod.getMultimodalGatewayUrl(), 'http://custom-gateway:8080');

      // Reset to default
      multimodalmMod.setMultimodalGatewayUrl('http://127.0.0.1:3100');
      assert.equal(multimodalmMod.getMultimodalGatewayUrl(), 'http://127.0.0.1:3100');
    });

    it('should strip trailing slash from gateway URL', () => {
      multimodalmMod.setMultimodalGatewayUrl('http://localhost:3100/');
      assert.equal(multimodalmMod.getMultimodalGatewayUrl(), 'http://localhost:3100');

      multimodalmMod.setMultimodalGatewayUrl('http://127.0.0.1:3100');
    });
  });
});

// ── generateVideo Tests ─────────────────────────────────────────────────────

describe('generateVideo', () => {
  let multimodalmMod;

  before(async () => {
    originalFetch = globalThis.fetch;
    multimodalmMod = await import('../src/multimodal-client/index.js');
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('should generate a video with URL response', async () => {
    globalThis.fetch = createMockFetch({
      '/v1/images/generations': {
        json: {
          data: [{ url: 'https://example.com/video.mp4' }],
          model: 'wanx-video-v1',
          provider: 'dashscope',
        },
      },
    });
    const result = await multimodalmMod.generateVideo('A cat playing piano', { model: 'wanx-video-v1' });
    assert.ok(result.videos.length > 0);
    assert.equal(result.videos[0].url, 'https://example.com/video.mp4');
    assert.equal(result.model, 'wanx-video-v1');
  });

  it('should throw on empty prompt', async () => {
    await assert.rejects(() => multimodalmMod.generateVideo(''), /prompt is required/);
  });
});

// ── checkGatewayHealth Tests ────────────────────────────────────────────────

describe('checkGatewayHealth', () => {
  let multimodalmMod;

  before(async () => {
    originalFetch = globalThis.fetch;
    multimodalmMod = await import('../src/multimodal-client/index.js');
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return healthy status', async () => {
    globalThis.fetch = createMockFetch({
      '/health/check': { json: { status: 'ok', version: '1.0.0' } },
    });
    const result = await multimodalmMod.checkGatewayHealth();
    assert.equal(result.healthy, true);
    assert.ok(typeof result.latencyMs === 'number');
  });

  it('should return unhealthy on failure', async () => {
    globalThis.fetch = async () => { throw new Error('Network error'); };
    const result = await multimodalmMod.checkGatewayHealth();
    assert.equal(result.healthy, false);
  });
});

// ── MultimodalError Export Tests ────────────────────────────────────────────

describe('MultimodalError', () => {
  let multimodalmMod;

  before(async () => {
    multimodalmMod = await import('../src/multimodal-client/index.js');
  });

  it('should be exported and constructable', () => {
    assert.ok(multimodalmMod.MultimodalError);
    const err = new multimodalmMod.MultimodalError('Test message', { code: 'test_error', status: 500, retryable: true });
    assert.equal(err.code, 'test_error');
    assert.equal(err.message, 'Test message');
    assert.equal(err.status, 500);
    assert.equal(err.retryable, true);
    assert.ok(err instanceof Error);
  });
});

// ── URL Validation Tests ────────────────────────────────────────────────────

describe('setMultimodalGatewayUrl validation', () => {
  let multimodalmMod;

  before(async () => {
    multimodalmMod = await import('../src/multimodal-client/index.js');
  });

  it('should reject empty string', () => {
    assert.throws(() => multimodalmMod.setMultimodalGatewayUrl(''), /url must be a non-empty string/);
  });

  it('should reject non-http URL', () => {
    assert.throws(() => multimodalmMod.setMultimodalGatewayUrl('ftp://example.com'), /url must start with http/);
  });

  it('should accept valid URL', () => {
    multimodalmMod.setMultimodalGatewayUrl('http://localhost:3100');
    assert.equal(multimodalmMod.getMultimodalGatewayUrl(), 'http://localhost:3100');
  });
});

// ── Retry Behavior Tests ────────────────────────────────────────────────────

describe('Retry behavior', () => {
  let multimodalmMod;

  before(async () => {
    originalFetch = globalThis.fetch;
    multimodalmMod = await import('../src/multimodal-client/index.js');
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('should retry on 500 and succeed', async () => {
    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500, text: async () => 'Internal Server Error', json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ data: [{ url: 'https://example.com/img.png' }], model: 'test' }), text: async () => '' };
    };
    const result = await multimodalmMod.generateImage('test prompt');
    assert.ok(result.images.length > 0);
    assert.equal(callCount, 2);
  });

  it('should exhaust retries and throw', async () => {
    globalThis.fetch = async () => ({
      ok: false, status: 503, text: async () => 'Service Unavailable', json: async () => ({}),
    });
    await assert.rejects(() => multimodalmMod.generateImage('test'), /failed/);
  });
});

// ── Per-request Timeout Tests ───────────────────────────────────────────────

describe('Per-request timeout', () => {
  let multimodalmMod;

  before(async () => {
    originalFetch = globalThis.fetch;
    multimodalmMod = await import('../src/multimodal-client/index.js');
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('should accept custom timeout in opts', async () => {
    globalThis.fetch = async (url, opts) => {
      // Check that the AbortController signal is present
      assert.ok(opts.signal, 'Should have abort signal');
      return { ok: true, status: 200, json: async () => ({ data: [{ url: 'https://example.com/img.png' }] }), text: async () => '' };
    };
    const result = await multimodalmMod.generateImage('test', { timeout: 5000 });
    assert.ok(result.images.length > 0);
  });
});
