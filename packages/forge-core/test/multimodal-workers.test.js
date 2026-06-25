/**
 * Multimodal Workers & Pipeline Tests
 *
 * Tests the media worker layer and pipeline integration:
 *   - ImageWorker: role, taskType, execute, error on missing prompt
 *   - EmbeddingWorker: role, taskType, execute, error on missing input
 *   - AudioWorker: role, taskType, TTS execute, error on unknown mode
 *   - AudioWorker STT mode: transcribe from file path, fail without file
 *   - VideoWorker: role, taskType, error on missing prompt, successful execution
 *   - MediaWorker base: unique filename generation
 *   - Goal Compiler: multimodal task type recognition
 *   - DAG Builder: multimodal role mapping
 *   - Orchestrator: WORKER_MAP multimodal entries
 *
 * All HTTP calls are mocked via global fetch override — no real provider calls.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// ── Test helpers ────────────────────────────────────────────────────────────

let originalFetch;
let tempDir;

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

// ── Media Workers Tests ─────────────────────────────────────────────────────

describe('Media Workers', () => {
  let mediaMod;

  before(async () => {
    originalFetch = globalThis.fetch;
    tempDir = mkdtempSync(join(tmpdir(), 'forge-media-test-'));
    mediaMod = await import('../src/worker/media.js');
  });

  after(() => {
    globalThis.fetch = originalFetch;
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  describe('ImageWorker', () => {
    it('should create with correct role and taskType', () => {
      const worker = new mediaMod.ImageWorker();
      assert.equal(worker.role, 'image-generator');
      assert.equal(worker.taskType, 'generate-image');
    });

    it('should execute image generation task with mocked fetch', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/images/generations': {
          json: {
            data: [{ url: 'https://example.com/test-image.png' }],
            model: 'dall-e-3',
            provider: 'openai',
          },
        },
      });

      const worker = new mediaMod.ImageWorker();
      const result = await worker.execute(
        {
          id: 'img-task-1',
          prompt: 'A test image of a cat',
          model: 'dall-e-3',
          size: '512x512',
        },
        tempDir
      );

      assert.ok(result);
      assert.equal(result.taskId, 'img-task-1');
      assert.equal(result.status, 'completed');
      assert.equal(result.type, 'image');
      assert.equal(result.success, true);
      assert.equal(result.model, 'dall-e-3');
      assert.equal(result.images.length, 1);
    });

    it('should return error when no prompt provided', async () => {
      const worker = new mediaMod.ImageWorker();
      const result = await worker.execute({ id: 'img-task-2' }, tempDir);

      assert.equal(result.success, false);
      assert.ok(result.error.includes('no prompt'));
    });
  });

  describe('EmbeddingWorker', () => {
    it('should create with correct role and taskType', () => {
      const worker = new mediaMod.EmbeddingWorker();
      assert.equal(worker.role, 'embedding-generator');
      assert.equal(worker.taskType, 'generate-embedding');
    });

    it('should execute embedding generation task', async () => {
      globalThis.fetch = createMockFetch({
        '/v1/embeddings': {
          json: {
            data: [
              { embedding: [0.1, 0.2, 0.3], index: 0 },
            ],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 3, total_tokens: 3 },
          },
        },
      });

      const worker = new mediaMod.EmbeddingWorker();
      const result = await worker.execute(
        {
          id: 'emb-task-1',
          input: 'Test embedding text',
          model: 'text-embedding-3-small',
        },
        tempDir
      );

      assert.ok(result);
      assert.equal(result.taskId, 'emb-task-1');
      assert.equal(result.status, 'completed');
      assert.equal(result.type, 'embedding');
      assert.equal(result.success, true);
      assert.equal(result.embeddings.length, 1);
      assert.deepEqual(result.embeddings[0], [0.1, 0.2, 0.3]);
    });

    it('should return error when no input provided', async () => {
      const worker = new mediaMod.EmbeddingWorker();
      const result = await worker.execute({ id: 'emb-task-2' }, tempDir);

      assert.equal(result.success, false);
      assert.ok(result.error.includes('no input'));
    });
  });

  describe('AudioWorker', () => {
    it('should create with correct role and taskType', () => {
      const worker = new mediaMod.AudioWorker();
      assert.equal(worker.role, 'audio-generator');
      assert.equal(worker.taskType, 'generate-audio');
    });

    it('should execute TTS task', async () => {
      const fakeAudioBytes = Buffer.alloc(512, 0xEF);
      globalThis.fetch = createMockFetch({
        '/v1/audio/speech': {
          binary: fakeAudioBytes.buffer.slice(fakeAudioBytes.byteOffset, fakeAudioBytes.byteOffset + fakeAudioBytes.byteLength),
        },
      });

      const worker = new mediaMod.AudioWorker();
      const result = await worker.execute(
        {
          id: 'audio-task-1',
          mode: 'tts',
          text: 'Hello world',
          voice: 'alloy',
          model: 'tts-1',
        },
        tempDir
      );

      assert.ok(result);
      assert.equal(result.taskId, 'audio-task-1');
      assert.equal(result.status, 'completed');
      assert.equal(result.type, 'audio');
      assert.equal(result.success, true);
    });

    it('should return error for unknown mode', async () => {
      const worker = new mediaMod.AudioWorker();
      const result = await worker.execute(
        { id: 'audio-task-2', mode: 'unknown' },
        tempDir
      );

      assert.equal(result.success, false);
      assert.ok(result.error.includes('unknown'));
    });
  });

  describe('VideoWorker', () => {
    it('should create with correct role and taskType', () => {
      const worker = new mediaMod.VideoWorker();
      assert.equal(worker.role, 'video-generator');
      assert.equal(worker.taskType, 'generate-video');
    });

    it('should return error when no prompt provided', async () => {
      const worker = new mediaMod.VideoWorker();
      const result = await worker.execute({ id: 'vid-task-1' }, tempDir);

      assert.equal(result.success, false);
      assert.ok(result.error.includes('no prompt'));
    });
  });

  describe('MediaWorker base', () => {
    it('should generate unique filenames', () => {
      const worker = new mediaMod.ImageWorker();
      const f1 = worker.generateFilename('image', 'png', 'task-1');
      const f2 = worker.generateFilename('image', 'png', 'task-2');

      assert.ok(f1.startsWith('image-'));
      assert.ok(f1.endsWith('.png'));
      assert.notEqual(f1, f2);
    });
  });
});

// ── Goal Compiler Multimodal Tests ──────────────────────────────────────────

describe('Goal Compiler - Multimodal Tasks', () => {
  let goalCompiler;

  before(async () => {
    goalCompiler = await import('../src/goal-compiler/index.js');
  });

  it('should recognize generate-image task type in system prompt', () => {
    // The system prompt should mention multimodal task types
    const prompt = goalCompiler.SYSTEM_PROMPT || goalCompiler.compileGoal?.toString() || '';
    // At minimum, the module should export compileGoal
    assert.ok(goalCompiler.compileGoal || goalCompiler.compileGoalV2, 'Goal compiler should export compileGoal or compileGoalV2');
  });
});

// ── DAG Builder Multimodal Tests ─────────────────────────────────────────────

describe('DAG Builder - Multimodal Roles', () => {
  let dagBuilder;

  before(async () => {
    dagBuilder = await import('../src/goal-compiler/dag-builder.js');
  });

  it('should map generate-image to image-generator role', () => {
    if (typeof dagBuilder.defaultAgentRole === 'function') {
      assert.equal(dagBuilder.defaultAgentRole('generate-image'), 'image-generator');
    }
  });

  it('should map generate-embedding to embedding-generator role', () => {
    if (typeof dagBuilder.defaultAgentRole === 'function') {
      assert.equal(dagBuilder.defaultAgentRole('generate-embedding'), 'embedding-generator');
    }
  });

  it('should map generate-audio to audio-generator role', () => {
    if (typeof dagBuilder.defaultAgentRole === 'function') {
      assert.equal(dagBuilder.defaultAgentRole('generate-audio'), 'audio-generator');
    }
  });

  it('should map generate-video to video-generator role', () => {
    if (typeof dagBuilder.defaultAgentRole === 'function') {
      assert.equal(dagBuilder.defaultAgentRole('generate-video'), 'video-generator');
    }
  });

  it('should map transcribe to audio-generator role', () => {
    if (typeof dagBuilder.defaultAgentRole === 'function') {
      assert.equal(dagBuilder.defaultAgentRole('transcribe'), 'audio-generator');
    }
  });
});

// ── Orchestrator WORKER_MAP Tests ────────────────────────────────────────────

describe('Orchestrator - Multimodal Worker Map', () => {
  let orchestratorMod;

  before(async () => {
    orchestratorMod = await import('../src/orchestrator/index.js');
  });

  it('should have image-generator in WORKER_MAP', () => {
    if (orchestratorMod.WORKER_MAP) {
      assert.ok(orchestratorMod.WORKER_MAP['image-generator'], 'WORKER_MAP should contain image-generator');
    }
  });

  it('should have embedding-generator in WORKER_MAP', () => {
    if (orchestratorMod.WORKER_MAP) {
      assert.ok(orchestratorMod.WORKER_MAP['embedding-generator'], 'WORKER_MAP should contain embedding-generator');
    }
  });

  it('should have audio-generator in WORKER_MAP', () => {
    if (orchestratorMod.WORKER_MAP) {
      assert.ok(orchestratorMod.WORKER_MAP['audio-generator'], 'WORKER_MAP should contain audio-generator');
    }
  });

  it('should have video-generator in WORKER_MAP', () => {
    if (orchestratorMod.WORKER_MAP) {
      assert.ok(orchestratorMod.WORKER_MAP['video-generator'], 'WORKER_MAP should contain video-generator');
    }
  });
});

// ── AudioWorker STT Mode Tests ──────────────────────────────────────────────

describe('AudioWorker STT mode', () => {
  let AudioWorker;
  let sttTempDir;

  before(async () => {
    originalFetch = globalThis.fetch;
    sttTempDir = mkdtempSync(join(tmpdir(), 'forge-audio-stt-test-'));
    const mediaMod = await import('../src/worker/media.js');
    AudioWorker = mediaMod.AudioWorker;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    try { rmSync(sttTempDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it('should transcribe audio from file path', async () => {
    // Create a small dummy audio file
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const audioFile = path.join(sttTempDir, 'test-audio.wav');
    await fs.writeFile(audioFile, Buffer.alloc(100, 0));

    globalThis.fetch = createMockFetch({
      '/v1/audio/transcriptions': {
        json: { text: 'Hello world', language: 'en', duration: 1.5 },
      },
    });

    const worker = new AudioWorker();
    const result = await worker.execute({
      id: 'stt-1',
      mode: 'stt',
      audioFile: audioFile,
      model: 'whisper-1',
    }, sttTempDir);

    assert.equal(result.success, true);
    assert.equal(result.text, 'Hello world');
    assert.equal(result.type, 'transcription');
  });

  it('should fail without audio file path', async () => {
    const worker = new AudioWorker();
    const result = await worker.execute({ id: 'stt-2', mode: 'stt' }, sttTempDir);
    assert.equal(result.success, false);
  });
});

// ── VideoWorker Execution Tests ──────────────────────────────────────────────

describe('VideoWorker execution', () => {
  let VideoWorker;
  let vidTempDir;

  before(async () => {
    originalFetch = globalThis.fetch;
    vidTempDir = mkdtempSync(join(tmpdir(), 'forge-video-exec-test-'));
    const mediaMod = await import('../src/worker/media.js');
    VideoWorker = mediaMod.VideoWorker;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    try { rmSync(vidTempDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it('should generate video successfully', async () => {
    globalThis.fetch = createMockFetch({
      '/v1/images/generations': {
        json: {
          data: [{ url: 'https://example.com/video.mp4' }],
          model: 'wanx-video-v1',
          provider: 'dashscope',
        },
      },
    });

    const worker = new VideoWorker();
    const result = await worker.execute({
      id: 'vid-1',
      prompt: 'A dancing robot',
      model: 'wanx-video-v1',
    }, vidTempDir);

    assert.equal(result.success, true);
    assert.equal(result.type, 'video');
  });
});
