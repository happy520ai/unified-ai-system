/**
 * Multimodal API Client -- calls image generation, embedding, audio, and video APIs
 * through the AI Gateway.
 *
 * Gateway endpoints:
 *   POST /v1/images/generations    -- image generation
 *   POST /v1/embeddings            -- text embeddings
 *   POST /v1/audio/speech          -- text-to-speech
 *   POST /v1/audio/transcriptions  -- speech-to-text
 *   GET  /health/check             -- gateway health
 *
 * All functions route through the local AI Gateway, which handles provider
 * selection, credential management, and rate limiting. No API keys are stored
 * or logged by this module.
 *
 * Usage:
 *   import { generateImage, setMultimodalGatewayUrl } from './multimodal-client/index.js';
 *   setMultimodalGatewayUrl('http://127.0.0.1:3100');
 *   const result = await generateImage('A sunset over mountains', { size: '1024x1024' });
 */

import { writeFile } from 'node:fs/promises';
import {
  MultimodalError,
  DEFAULT_GATEWAY_URL,
  IMAGE_TIMEOUT_MS,
  EMBEDDING_TIMEOUT_MS,
  AUDIO_TIMEOUT_MS,
  TRANSCRIPTION_TIMEOUT_MS,
  VIDEO_TIMEOUT_MS,
  HEALTH_TIMEOUT_MS,
  RETRYABLE_STATUSES,
  _post,
  _fetchWithRetry,
  _fetchWithTimeout,
  _downloadFile,
  _ensureDir,
  _buildTranscriptionBody,
} from './helpers.js';

export { MultimodalError };

// ── Module State ────────────────────────────────────────────────────────────

let _gatewayUrl = DEFAULT_GATEWAY_URL;

/**
 * Set the AI Gateway base URL for all multimodal requests.
 * Validates that the URL is a non-empty string starting with http:// or https://.
 * @param {string} url -- e.g. 'http://127.0.0.1:3100'
 * @throws {MultimodalError} on invalid input
 */
export function setMultimodalGatewayUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new MultimodalError(
      'setMultimodalGatewayUrl: url must be a non-empty string',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new MultimodalError(
      'setMultimodalGatewayUrl: url must start with http:// or https://',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }
  _gatewayUrl = url.replace(/\/$/, '');
}

/**
 * Get the current AI Gateway base URL.
 * @returns {string}
 */
export function getMultimodalGatewayUrl() {
  return _gatewayUrl;
}

// ── Image Generation ────────────────────────────────────────────────────────

/**
 * Generate an image using a text prompt.
 *
 * @param {string} prompt -- text description of the desired image
 * @param {object} [opts]
 * @param {string} [opts.model] -- model ID (e.g. 'dall-e-3', 'gpt-image-1')
 * @param {string} [opts.provider] -- provider ID (auto-detected if omitted)
 * @param {string} [opts.size] -- image size (e.g. '1024x1024', '1792x1024')
 * @param {number} [opts.n] -- number of images (default: 1)
 * @param {string} [opts.responseFormat] -- 'url' or 'b64_json' (default: 'url')
 * @param {string} [opts.outputPath] -- if set, download image to this path
 * @param {string} [opts.quality] -- image quality ('standard' or 'hd')
 * @param {string} [opts.style] -- image style ('vivid' or 'natural')
 * @param {number} [opts.timeout] -- per-request timeout override in ms
 * @returns {Promise<ImageResult>}
 *
 * @typedef {object} ImageResult
 * @property {Array<{url?: string, b64Json?: string, revisedPrompt?: string}>} images
 * @property {string} model
 * @property {string} provider
 * @property {object} usage
 * @property {boolean} [downloadSuccess] -- true/false when outputPath was given
 */
export async function generateImage(prompt, opts = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new MultimodalError(
      'generateImage: prompt is required and must be a non-empty string',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }

  const body = {
    prompt,
    n: opts.n ?? 1,
    size: opts.size ?? '1024x1024',
    response_format: opts.responseFormat ?? 'url',
  };

  if (opts.model) body.model = opts.model;
  if (opts.provider) body.provider = opts.provider;
  if (opts.quality) body.quality = opts.quality;
  if (opts.style) body.style = opts.style;
  if (opts.modality) body.modality = opts.modality;

  const url = `${_gatewayUrl}/v1/images/generations`;
  const timeout = opts.timeout ?? IMAGE_TIMEOUT_MS;
  const data = await _post(url, body, timeout);

  const apiUsage = data.usage || {};
  const usage = { images: apiUsage.images ?? apiUsage.n ?? body.n };

  const result = {
    images: [],
    model: data.model || opts.model || 'unknown',
    provider: data.provider || opts.provider || 'gateway',
    usage,
  };

  const imageData = data.data || data.images || [];
  for (const img of imageData) {
    const entry = {};
    if (img.url) entry.url = img.url;
    if (img.b64_json) entry.b64Json = img.b64_json;
    if (img.revised_prompt) entry.revisedPrompt = img.revised_prompt;
    result.images.push(entry);
  }

  if (opts.outputPath && result.images.length > 0) {
    result.downloadSuccess = await _downloadFile(result.images[0], opts.outputPath);
  }

  return result;
}

// ── Video Generation ────────────────────────────────────────────────────────

/**
 * Generate a video using a text prompt.
 * Routes through the image endpoint with modality='video'.
 *
 * @param {string} prompt -- text description of the desired video
 * @param {object} [opts]
 * @param {string} [opts.model] -- model ID
 * @param {string} [opts.provider] -- provider ID
 * @param {number} [opts.duration] -- video duration in seconds
 * @param {number} [opts.fps] -- frames per second
 * @param {string} [opts.resolution] -- video resolution (e.g. '1920x1080')
 * @param {string} [opts.responseFormat] -- 'url' or 'b64_json' (default: 'url')
 * @param {string} [opts.outputPath] -- if set, download video to this path
 * @param {number} [opts.timeout] -- per-request timeout override in ms
 * @returns {Promise<VideoResult>}
 *
 * @typedef {object} VideoResult
 * @property {Array<{url?: string, b64Json?: string}>} videos
 * @property {string} model
 * @property {string} provider
 * @property {object} usage
 * @property {boolean} [downloadSuccess]
 */
export async function generateVideo(prompt, opts = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new MultimodalError(
      'generateVideo: prompt is required and must be a non-empty string',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }

  const body = {
    prompt,
    modality: 'video',
    response_format: opts.responseFormat ?? 'url',
  };

  if (opts.model) body.model = opts.model;
  if (opts.provider) body.provider = opts.provider;
  if (opts.duration != null) body.duration = opts.duration;
  if (opts.fps != null) body.fps = opts.fps;
  if (opts.resolution) body.resolution = opts.resolution;

  const url = `${_gatewayUrl}/v1/images/generations`;
  const timeout = opts.timeout ?? VIDEO_TIMEOUT_MS;
  const data = await _post(url, body, timeout);

  const apiUsage = data.usage || {};
  const usage = { videos: apiUsage.videos ?? apiUsage.n ?? 1 };

  const result = {
    videos: [],
    model: data.model || opts.model || 'unknown',
    provider: data.provider || opts.provider || 'gateway',
    usage,
  };

  const videoData = data.data || data.videos || [];
  for (const vid of videoData) {
    const entry = {};
    if (vid.url) entry.url = vid.url;
    if (vid.b64_json) entry.b64Json = vid.b64_json;
    result.videos.push(entry);
  }

  if (opts.outputPath && result.videos.length > 0) {
    result.downloadSuccess = await _downloadFile(result.videos[0], opts.outputPath);
  }

  return result;
}

// ── Embedding Generation ────────────────────────────────────────────────────

/**
 * Generate text embeddings.
 *
 * @param {string|string[]} input -- text(s) to embed
 * @param {object} [opts]
 * @param {string} [opts.model] -- model ID (e.g. 'text-embedding-3-small')
 * @param {string} [opts.provider] -- provider ID
 * @param {number} [opts.dimensions] -- embedding dimensions (model-dependent)
 * @param {number} [opts.timeout] -- per-request timeout override in ms
 * @returns {Promise<EmbeddingResult>}
 *
 * @typedef {object} EmbeddingResult
 * @property {number[][]} embeddings -- array of embedding vectors
 * @property {string} model
 * @property {string} provider
 * @property {{inputTokens: number, totalTokens: number}} usage
 */
export async function generateEmbedding(input, opts = {}) {
  if (!input || (typeof input !== 'string' && !Array.isArray(input))) {
    throw new MultimodalError(
      'generateEmbedding: input is required and must be a string or string array',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }

  const body = { input: Array.isArray(input) ? input : [input] };

  if (opts.model) body.model = opts.model;
  if (opts.provider) body.provider = opts.provider;
  if (opts.dimensions) body.dimensions = opts.dimensions;

  const url = `${_gatewayUrl}/v1/embeddings`;
  const timeout = opts.timeout ?? EMBEDDING_TIMEOUT_MS;
  const data = await _post(url, body, timeout);

  const embeddings = [];
  const rawData = data.data || data.embeddings || [];
  for (const emb of rawData) {
    if (Array.isArray(emb)) {
      embeddings.push(emb);
    } else if (emb && Array.isArray(emb.embedding)) {
      embeddings.push(emb.embedding);
    }
  }

  const usage = data.usage || {};
  return {
    embeddings,
    model: data.model || opts.model || 'unknown',
    provider: data.provider || opts.provider || 'gateway',
    usage: {
      inputTokens: usage.prompt_tokens || usage.inputTokens || 0,
      totalTokens: usage.total_tokens || usage.totalTokens || 0,
    },
  };
}

// ── Text-to-Speech ──────────────────────────────────────────────────────────

/**
 * Convert text to speech audio.
 *
 * @param {string} text -- text to speak
 * @param {object} [opts]
 * @param {string} [opts.model] -- model ID (e.g. 'tts-1', 'tts-1-hd')
 * @param {string} [opts.voice] -- voice name (e.g. 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer')
 * @param {string} [opts.format] -- audio format ('mp3', 'wav', 'opus', 'aac', 'flac', 'pcm')
 * @param {number} [opts.speed] -- speech speed (0.25 to 4.0, default: 1.0)
 * @param {string} [opts.outputPath] -- if set, save audio to this path
 * @param {string} [opts.provider] -- provider ID
 * @param {number} [opts.timeout] -- per-request timeout override in ms
 * @returns {Promise<AudioResult>}
 *
 * @typedef {object} AudioResult
 * @property {string} audioPath -- path to the saved audio file
 * @property {string} format -- audio format
 * @property {string} model
 * @property {string} provider
 */
export async function synthesizeSpeech(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    throw new MultimodalError(
      'synthesizeSpeech: text is required and must be a non-empty string',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }

  const body = {
    input: text,
    voice: opts.voice ?? 'alloy',
    response_format: opts.format ?? 'mp3',
  };

  if (opts.model) body.model = opts.model;
  if (opts.provider) body.provider = opts.provider;
  if (opts.speed != null) body.speed = opts.speed;

  const url = `${_gatewayUrl}/v1/audio/speech`;
  const timeout = opts.timeout ?? AUDIO_TIMEOUT_MS;
  const format = opts.format ?? 'mp3';
  const audioPath = opts.outputPath || null;

  const response = await _fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new MultimodalError(
      `synthesizeSpeech failed (${response.status}): ${errorText}`,
      { code: 'GATEWAY_ERROR', status: response.status, retryable: RETRYABLE_STATUSES.has(response.status) },
    );
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  let savedPath = '';
  if (audioPath) {
    await _ensureDir(audioPath);
    await writeFile(audioPath, audioBuffer);
    savedPath = audioPath;
  }

  return {
    audioPath: savedPath,
    format,
    model: opts.model || 'tts-1',
    provider: opts.provider || 'gateway',
    sizeBytes: audioBuffer.length,
  };
}

// ── Speech-to-Text ──────────────────────────────────────────────────────────

/**
 * Transcribe audio to text.
 *
 * @param {Buffer|string} audio -- audio buffer or file path
 * @param {object} [opts]
 * @param {string} [opts.model] -- model ID (e.g. 'whisper-1')
 * @param {string} [opts.language] -- ISO 639-1 language code (e.g. 'en', 'zh')
 * @param {string} [opts.prompt] -- optional prompt to guide transcription
 * @param {string} [opts.format] -- response format ('json', 'text', 'verbose_json')
 * @param {number} [opts.temperature] -- sampling temperature (0.0 to 1.0)
 * @param {string} [opts.provider] -- provider ID
 * @param {number} [opts.timeout] -- per-request timeout override in ms
 * @returns {Promise<TranscriptionResult>}
 *
 * @typedef {object} TranscriptionResult
 * @property {string} text -- transcribed text
 * @property {string} [language] -- detected language
 * @property {number} [duration] -- audio duration in seconds
 * @property {string} model
 * @property {string} provider
 */
export async function transcribeAudio(audio, opts = {}) {
  if (!audio) {
    throw new MultimodalError(
      'transcribeAudio: audio is required (Buffer or file path)',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }

  const { bodyBuffer, boundary, model } = await _buildTranscriptionBody(audio, opts);

  const url = `${_gatewayUrl}/v1/audio/transcriptions`;
  const timeout = opts.timeout ?? TRANSCRIPTION_TIMEOUT_MS;
  const response = await _fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: bodyBuffer,
  }, timeout);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new MultimodalError(
      `transcribeAudio failed (${response.status}): ${errorText}`,
      { code: 'GATEWAY_ERROR', status: response.status, retryable: RETRYABLE_STATUSES.has(response.status) },
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new MultimodalError(
      'transcribeAudio: failed to parse response JSON',
      { code: 'PARSE_ERROR', status: response.status, retryable: false },
    );
  }

  return {
    text: data.text || '',
    language: data.language || opts.language || undefined,
    duration: data.duration || undefined,
    model: data.model || model,
    provider: data.provider || opts.provider || 'gateway',
  };
}

// ── Gateway Health ──────────────────────────────────────────────────────────

/**
 * Check the AI Gateway health by calling GET /health/check.
 * @param {object} [opts]
 * @param {number} [opts.timeout] -- per-request timeout override in ms
 * @returns {Promise<{healthy: boolean, latencyMs: number}>}
 */
export async function checkGatewayHealth(opts = {}) {
  const url = `${_gatewayUrl}/health/check`;
  const timeout = opts.timeout ?? HEALTH_TIMEOUT_MS;
  const start = Date.now();

  try {
    const response = await _fetchWithTimeout(url, { method: 'GET' }, timeout);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return { healthy: false, latencyMs };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return { healthy: true, latencyMs };
    }

    return {
      healthy: data.healthy === true || data.status === 'ok' || response.ok,
      latencyMs,
    };
  } catch {
    return { healthy: false, latencyMs: Date.now() - start };
  }
}
