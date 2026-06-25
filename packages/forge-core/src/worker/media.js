/**
 * Media Workers -- generate binary artifacts (images, audio, video, embeddings)
 * rather than code file edits.
 *
 * These workers are intentionally separate from BaseWorker (src/worker/base.js),
 * which is tightly coupled to code file operations (allowedFiles, file diffs,
 * tool calls). Media workers produce binary output and have different lifecycle
 * needs: output directories, binary file writes, and media-specific API calls.
 *
 * Worker classes:
 *   - ImageWorker       -- text-to-image generation
 *   - EmbeddingWorker   -- text embedding generation for search/RAG
 *   - AudioWorker       -- text-to-speech and speech-to-text
 *   - VideoWorker       -- text-to-video generation (routes through generateVideo)
 *
 * Usage:
 *   import { ImageWorker } from './worker/media.js';
 *   const worker = new ImageWorker();
 *   const result = await worker.execute(task, projectRoot);
 */

import { writeFile, stat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  generateImage,
  generateVideo,
  generateEmbedding,
} from '../multimodal-client/index.js';
import { executeTTS, executeSTT } from './media-helpers.js';

// ── Base MediaWorker ────────────────────────────────────────────────────────

/**
 * Base class for media-generating workers.
 * Unlike BaseWorker, these workers produce binary artifacts (images, audio, video)
 * rather than code file edits.
 */
export class MediaWorker {
  #role;
  #taskType;
  #outputDir;

  /**
   * @param {object} config
   * @param {string} config.role -- worker role identifier
   * @param {string} config.taskType -- task type this worker handles
   * @param {string} [config.outputDir] -- output directory relative to project root
   */
  constructor({ role, taskType, outputDir }) {
    this.#role = role;
    this.#taskType = taskType;
    this.#outputDir = outputDir || '.forge/media-output';
  }

  /** Worker role identifier. */
  get role() { return this.#role; }

  /** Task type this worker handles. */
  get taskType() { return this.#taskType; }

  /**
   * Ensure the output directory exists and return its absolute path.
   * @param {string} projectRoot
   * @returns {Promise<string>} absolute path to the output directory
   */
  async ensureOutputDir(projectRoot) {
    const dir = join(projectRoot, this.#outputDir);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Generate a unique filename with timestamp and random suffix to prevent
   * collisions when multiple workers generate files in the same second.
   * @param {string} prefix -- filename prefix
   * @param {string} ext -- file extension (without dot)
   * @param {string} [taskId] -- optional task ID to include
   * @returns {string}
   */
  generateFilename(prefix, ext, taskId) {
    const id = taskId || Date.now().toString(36);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const rand = Math.random().toString(36).slice(2, 6);
    return `${prefix}-${id}-${timestamp}-${rand}.${ext}`;
  }

  /**
   * Validate that an audio/video/image file exists and is non-empty.
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async validateOutputFile(filePath) {
    try {
      const s = await stat(filePath);
      return s.isFile() && s.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Format a result object with standard fields.
   * `extra` (metadata like taskId/status/type) is spread last so that it always
   * wins over any overlapping keys from the API response `result`.
   * @param {object} result -- raw result from the API call
   * @param {object} extra -- additional metadata fields (taskId, status, type)
   * @returns {object}
   */
  formatResult(result, extra = {}) {
    return {
      success: true,
      ...result,
      ...extra,
    };
  }

  /**
   * Format a standardized error response for any media worker failure.
   * @param {Error} err -- the caught error
   * @param {object} task -- the original task descriptor
   * @param {string} type -- worker type label (e.g. 'image', 'video', 'audio')
   * @returns {object}
   */
  formatError(err, task, type) {
    return {
      success: false,
      error: err.message,
      code: err.code || `${type}_error`,
      retryable: err.retryable || false,
      taskId: task.id,
      status: 'failed',
      type,
    };
  }
}

// ── Image Worker ────────────────────────────────────────────────────────────

/**
 * Image generation worker -- generates images from text prompts.
 *
 * Task fields:
 *   - prompt (string, required): text description of the image
 *   - model (string): model ID (e.g. 'dall-e-3', 'gpt-image-1')
 *   - provider (string): provider ID
 *   - size (string): image dimensions (e.g. '1024x1024', '1792x1024', '512x512')
 *   - count (number): number of images to generate (default: 1)
 *   - quality (string): 'standard' or 'hd'
 *   - style (string): 'vivid' or 'natural'
 *   - outputFile (string): custom output filename
 *   - responseFormat (string): 'url' or 'b64_json'
 *
 * Result fields:
 *   - taskId, status, type, outputPath, images, model, provider, usage
 */
export class ImageWorker extends MediaWorker {
  constructor(opts = {}) {
    super({
      role: 'image-generator',
      taskType: 'generate-image',
      outputDir: opts.outputDir || '.forge/media-output/images',
    });
  }

  /**
   * Execute an image generation task.
   * @param {object} task -- task descriptor
   * @param {string} projectRoot -- project root directory
   * @param {object} [context] -- execution context (unused for media tasks)
   * @returns {Promise<object>} execution result
   */
  async execute(task, projectRoot, context = {}) {
    const prompt = task.prompt || task.description || task.name;
    if (!prompt) {
      return { success: false, error: 'ImageWorker: no prompt provided' };
    }

    const model = task.model || task.modelHint;
    const provider = task.provider;
    const size = task.size || task.imageSize || '1024x1024';
    const n = task.count || task.imageCount || 1;
    const quality = task.quality;
    const style = task.style;
    const responseFormat = task.responseFormat || 'url';

    const outputDir = await this.ensureOutputDir(projectRoot);

    // Both 'url' and 'b64_json' response formats produce PNG output from the
    // provider; the extension is always 'png' regardless of responseFormat.
    const ext = 'png';
    const filename = task.outputFile || this.generateFilename('image', ext, task.id);
    const outputPath = join(outputDir, filename);

    console.log(`[forge:media] Generating image: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
    console.log(`[forge:media]   model=${model || 'auto'}, size=${size}, n=${n}`);

    try {
      const result = await generateImage(prompt, {
        model,
        provider,
        size,
        n,
        quality,
        style,
        responseFormat,
        outputPath,
      });

      const valid = await this.validateOutputFile(outputPath);
      console.log(`[forge:media] Image generated: ${outputPath} (${valid ? 'OK' : 'WARN: empty or missing'})`);

      return this.formatResult(
        {
          outputPath,
          images: result.images,
          model: result.model,
          provider: result.provider,
          usage: result.usage,
        },
        {
          taskId: task.id,
          status: 'completed',
          type: 'image',
          filesModified: valid ? [{ path: outputPath, action: 'create' }] : [],
        }
      );
    } catch (err) {
      console.error(`[forge:media] Image generation failed: ${err.message}`);
      return this.formatError(err, task, 'image');
    }
  }
}

// ── Embedding Worker ────────────────────────────────────────────────────────

/**
 * Embedding worker -- generates text embeddings for search/RAG.
 *
 * Task fields:
 *   - input (string|string[]): text(s) to embed
 *   - texts (string[]): alternative to input
 *   - prompt (string): single text fallback
 *   - model (string): model ID (e.g. 'text-embedding-3-small')
 *   - provider (string): provider ID
 *   - dimensions (number): target embedding dimensions
 *   - outputFile (string): if set, save embeddings as JSON
 *
 * Result fields:
 *   - taskId, status, type, embeddings, model, provider, usage
 */
export class EmbeddingWorker extends MediaWorker {
  constructor(opts = {}) {
    super({
      role: 'embedding-generator',
      taskType: 'generate-embedding',
      outputDir: opts.outputDir || '.forge/media-output/embeddings',
    });
  }

  /**
   * Execute an embedding generation task.
   * @param {object} task -- task descriptor
   * @param {string} projectRoot -- project root directory
   * @param {object} [context] -- execution context
   * @returns {Promise<object>} execution result
   */
  async execute(task, projectRoot, context = {}) {
    const input = task.input || task.texts || task.prompt;
    if (!input) {
      return { success: false, error: 'EmbeddingWorker: no input text provided' };
    }

    const model = task.model || task.modelHint;
    const provider = task.provider;
    const dimensions = task.dimensions;

    console.log(`[forge:media] Generating embeddings (${Array.isArray(input) ? input.length : 1} texts)...`);
    console.log(`[forge:media]   model=${model || 'auto'}`);

    try {
      const result = await generateEmbedding(input, { model, provider, dimensions });

      console.log(`[forge:media] Embeddings generated: ${result.embeddings.length} vectors, ` +
        `${result.embeddings[0]?.length || 0} dimensions each`);

      // Optionally save embeddings to a JSON file
      if (task.outputFile) {
        const outputDir = await this.ensureOutputDir(projectRoot);
        const filename = task.outputFile.endsWith('.json') ? task.outputFile : `${task.outputFile}.json`;
        const outputPath = join(outputDir, filename);
        const payload = {
          model: result.model,
          provider: result.provider,
          dimensions: result.embeddings[0]?.length || 0,
          count: result.embeddings.length,
          embeddings: result.embeddings,
          usage: result.usage,
          generatedAt: new Date().toISOString(),
        };
        await writeFile(outputPath, JSON.stringify(payload, null, 2));
        console.log(`[forge:media] Embeddings saved: ${outputPath}`);

        return this.formatResult(
          {
            embeddings: result.embeddings,
            model: result.model,
            provider: result.provider,
            usage: result.usage,
            outputPath,
          },
          {
            taskId: task.id,
            status: 'completed',
            type: 'embedding',
            filesModified: [{ path: outputPath, action: 'create' }],
          }
        );
      }

      return this.formatResult(
        {
          embeddings: result.embeddings,
          model: result.model,
          provider: result.provider,
          usage: result.usage,
        },
        {
          taskId: task.id,
          status: 'completed',
          type: 'embedding',
        }
      );
    } catch (err) {
      console.error(`[forge:media] Embedding generation failed: ${err.message}`);
      return this.formatError(err, task, 'embedding');
    }
  }
}

// ── Audio Worker ────────────────────────────────────────────────────────────

/**
 * Audio worker -- handles both text-to-speech (TTS) and speech-to-text (STT).
 *
 * Task fields for TTS (mode: 'tts'):
 *   - text (string, required): text to speak
 *   - voice (string): voice name (default: 'alloy')
 *   - model (string): model ID (default: 'tts-1')
 *   - format (string): audio format (default: 'mp3')
 *   - speed (number): speech speed (0.25 to 4.0)
 *   - outputFile (string): custom output filename
 *
 * Task fields for STT (mode: 'stt'):
 *   - audioFile (string, required): path to audio file
 *   - model (string): model ID (default: 'whisper-1')
 *   - language (string): ISO language code
 *   - prompt (string): optional guidance prompt
 *
 * Result fields:
 *   - taskId, status, type, audioPath/text, model, provider
 */
export class AudioWorker extends MediaWorker {
  constructor(opts = {}) {
    super({
      role: 'audio-generator',
      taskType: 'generate-audio',
      outputDir: opts.outputDir || '.forge/media-output/audio',
    });
  }

  /**
   * Execute an audio generation or transcription task.
   * @param {object} task -- task descriptor
   * @param {string} projectRoot -- project root directory
   * @param {object} [context] -- execution context
   * @returns {Promise<object>} execution result
   */
  async execute(task, projectRoot, context = {}) {
    const mode = task.mode || task.audioMode || 'tts';

    if (mode === 'tts') {
      return executeTTS(this, task, projectRoot);
    }

    if (mode === 'stt') {
      return executeSTT(this, task, projectRoot);
    }

    return {
      success: false,
      error: `AudioWorker: unknown audio mode "${mode}". Use "tts" or "stt".`,
      taskId: task.id,
      status: 'failed',
      type: 'audio',
    };
  }
}

// ── Video Worker ────────────────────────────────────────────────────────────

/**
 * Video generation worker -- generates video from text prompts.
 *
 * Uses the dedicated generateVideo client, which handles provider-specific
 * routing for video-capable models.
 *
 * Task fields:
 *   - prompt (string, required): text description of the video
 *   - model (string): model ID
 *   - provider (string): provider ID
 *   - outputFile (string): custom output filename
 *
 * Result fields:
 *   - taskId, status, type, outputPath, model, provider, usage
 */
export class VideoWorker extends MediaWorker {
  constructor(opts = {}) {
    super({
      role: 'video-generator',
      taskType: 'generate-video',
      outputDir: opts.outputDir || '.forge/media-output/video',
    });
  }

  /**
   * Execute a video generation task.
   * @param {object} task -- task descriptor
   * @param {string} projectRoot -- project root directory
   * @param {object} [context] -- execution context
   * @returns {Promise<object>} execution result
   */
  async execute(task, projectRoot, context = {}) {
    const prompt = task.prompt || task.description || task.name;
    if (!prompt) {
      return { success: false, error: 'VideoWorker: no prompt provided' };
    }

    const model = task.model || task.modelHint;
    const provider = task.provider;

    const outputDir = await this.ensureOutputDir(projectRoot);
    const filename = task.outputFile || this.generateFilename('video', 'mp4', task.id);
    const outputPath = join(outputDir, filename);

    console.log(`[forge:media] Generating video: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
    console.log(`[forge:media]   model=${model || 'auto'}`);

    try {
      const result = await generateVideo(prompt, {
        model,
        provider,
        responseFormat: 'url',
        outputPath,
      });

      const valid = await this.validateOutputFile(outputPath);
      console.log(`[forge:media] Video generated: ${outputPath} (${valid ? 'OK' : 'WARN: empty or missing'})`);

      return this.formatResult(
        {
          outputPath,
          model: result.model,
          provider: result.provider,
          usage: result.usage,
          images: result.images, // may contain video URLs depending on the provider
        },
        {
          taskId: task.id,
          status: 'completed',
          type: 'video',
          filesModified: valid ? [{ path: outputPath, action: 'create' }] : [],
        }
      );
    } catch (err) {
      console.error(`[forge:media] Video generation failed: ${err.message}`);
      return this.formatError(err, task, 'video');
    }
  }
}
