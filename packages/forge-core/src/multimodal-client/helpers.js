/**
 * Internal helpers for multimodal-client.
 *
 * Contains constants, the MultimodalError class, and all private utility
 * functions (HTTP fetch with retry/timeout, file download, multipart
 * construction, MIME detection, sleep).
 *
 * @module multimodal-client/helpers
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// ── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:3100';
export const IMAGE_TIMEOUT_MS = 60000;
export const EMBEDDING_TIMEOUT_MS = 30000;
export const AUDIO_TIMEOUT_MS = 60000;
export const TRANSCRIPTION_TIMEOUT_MS = 120000;
export const VIDEO_TIMEOUT_MS = 300000;
export const DOWNLOAD_TIMEOUT_MS = 30000;
export const HEALTH_TIMEOUT_MS = 10000;

// Retry defaults
export const DEFAULT_MAX_RETRIES = 2;
export const BASE_BACKOFF_MS = 1000;

// HTTP status codes that are retryable
export const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// ── MultimodalError ─────────────────────────────────────────────────────────

/**
 * Structured error for multimodal operations.
 * Carries a machine-readable `code`, an HTTP `status` (0 for network errors),
 * and a `retryable` flag so callers can decide whether to retry.
 */
export class MultimodalError extends Error {
  /**
   * @param {string} message
   * @param {object} [details]
   * @param {string} [details.code]    -- e.g. 'TIMEOUT', 'NETWORK', 'GATEWAY_ERROR', 'PARSE_ERROR', 'INVALID_INPUT'
   * @param {number} [details.status]  -- HTTP status code, 0 for non-HTTP errors
   * @param {boolean} [details.retryable]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'MultimodalError';
    this.code = details.code || 'UNKNOWN';
    this.status = details.status || 0;
    this.retryable = details.retryable ?? false;
  }
}

// ── Pure / Stateless Utilities ──────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine MIME type from audio filename extension.
 * @param {string} filename
 * @returns {string}
 */
export function _audioMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    webm: 'audio/webm',
    pcm: 'audio/pcm',
    wma: 'audio/x-ms-wma',
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

/**
 * Combine multipart form data parts into a single Buffer.
 * The boundary string is already embedded in the part strings.
 * @param {Array<string|Buffer>} parts
 * @returns {Buffer}
 */
export function _combineMultipart(parts) {
  const buffers = parts.map(part => {
    if (Buffer.isBuffer(part)) return part;
    if (typeof part === 'string') return Buffer.from(part, 'utf-8');
    if (part instanceof Uint8Array) return Buffer.from(part);
    return Buffer.from(String(part), 'utf-8');
  });
  return Buffer.concat(buffers);
}

/**
 * Ensure the parent directory of a file path exists.
 * @param {string} filePath
 */
export async function _ensureDir(filePath) {
  const dir = dirname(filePath);
  if (dir && dir !== '.') {
    await mkdir(dir, { recursive: true });
  }
}

// ── HTTP Helpers ────────────────────────────────────────────────────────────

/**
 * Fetch with a timeout using AbortController.
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
export async function _fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new MultimodalError(
        `Gateway request timed out after ${timeoutMs}ms: ${url}`,
        { code: 'TIMEOUT', status: 0, retryable: true },
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch with timeout and automatic retry for transient failures.
 *
 * Retries on: 429, 500, 502, 503, 504, AbortError (timeout), network errors.
 * Respects the Retry-After header on 429 responses.
 * Uses exponential backoff (1s, 2s, ...) between attempts.
 *
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 * @param {object} [retryOpts]
 * @param {number} [retryOpts.maxRetries] -- default 2
 * @returns {Promise<Response>}
 */
export async function _fetchWithRetry(url, init, timeoutMs, retryOpts = {}) {
  const maxRetries = retryOpts.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await _fetchWithTimeout(url, init, timeoutMs);

      // If the response is retryable and we have attempts left, wait and retry
      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        let delayMs = BASE_BACKOFF_MS * Math.pow(2, attempt);

        // Respect Retry-After header for 429s
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            const parsed = Number(retryAfter);
            if (Number.isFinite(parsed) && parsed > 0) {
              delayMs = parsed * 1000;
            }
          }
        }

        // Consume the body to free the connection before sleeping
        await response.text().catch(() => {});
        await _sleep(delayMs);
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;

      // Determine if the error is retryable
      const isTimeout = err.name === 'AbortError' ||
        (err instanceof MultimodalError && err.code === 'TIMEOUT');
      const isNetworkError = err instanceof TypeError || err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' || err.code === 'ENOTFOUND';
      const isRetryable = isTimeout || isNetworkError;

      if (!isRetryable || attempt >= maxRetries) {
        throw err;
      }

      const delayMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
      await _sleep(delayMs);
    }
  }

  // Should not reach here, but throw last error as a safety net
  throw lastError || new MultimodalError('Request failed after retries', { code: 'RETRY_EXHAUSTED' });
}

/**
 * POST JSON to a gateway endpoint and return parsed JSON.
 * Uses _fetchWithRetry for resilience.
 * Consolidates error parsing from the response body.
 * @param {string} url
 * @param {object} body
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
export async function _post(url, body, timeoutMs) {
  const response = await _fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);

  if (!response.ok) {
    // Try to parse structured error JSON for better messages
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorDetail = errorText || errorDetail;
      }
    } catch { /* keep default */ }

    throw new MultimodalError(
      `Gateway request failed (${response.status}): ${errorDetail}`,
      {
        code: 'GATEWAY_ERROR',
        status: response.status,
        retryable: RETRYABLE_STATUSES.has(response.status),
      },
    );
  }

  // response.json() can throw on malformed bodies
  try {
    return await response.json();
  } catch {
    throw new MultimodalError(
      `Gateway request succeeded (${response.status}) but response JSON could not be parsed`,
      { code: 'PARSE_ERROR', status: response.status, retryable: false },
    );
  }
}

// ── File Download ───────────────────────────────────────────────────────────

/**
 * Download a file (image or video) from a URL or decode base64 and write to a file path.
 * Uses AbortController timeout for URL downloads.
 * @param {{url?: string, b64Json?: string}} entry
 * @param {string} outputPath
 * @returns {Promise<boolean>} -- true on success, false on failure
 */
export async function _downloadFile(entry, outputPath) {
  try {
    await _ensureDir(outputPath);

    if (entry.b64Json) {
      const buffer = Buffer.from(entry.b64Json, 'base64');
      await writeFile(outputPath, buffer);
      return true;
    }

    if (entry.url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

      try {
        const response = await fetch(entry.url, { signal: controller.signal });
        if (!response.ok) {
          console.error(`[multimodal-client] Download failed: HTTP ${response.status} from ${entry.url}`);
          return false;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(outputPath, buffer);
        return true;
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error(`[multimodal-client] Download timed out after ${DOWNLOAD_TIMEOUT_MS}ms: ${entry.url}`);
        } else {
          console.error(`[multimodal-client] Download failed: ${err.message}`);
        }
        return false;
      } finally {
        clearTimeout(timer);
      }
    }

    console.error('[multimodal-client] Warning: no URL or b64_json to download');
    return false;
  } catch (err) {
    console.error(`[multimodal-client] Download error: ${err.message}`);
    return false;
  }
}

// ── Transcription Multipart Body ────────────────────────────────────────────

/**
 * Build the multipart/form-data body for the transcription request.
 * @param {Buffer|string} audio
 * @param {object} opts
 * @returns {Promise<{bodyBuffer: Buffer, boundary: string, model: string}>}
 */
export async function _buildTranscriptionBody(audio, opts) {
  const boundary = `----ForgeBoundary${Date.now().toString(36)}`;
  const parts = [];

  let audioBuffer;
  let filename = 'audio.mp3';

  if (typeof audio === 'string') {
    audioBuffer = await readFile(audio);
    const pathParts = audio.replace(/\\/g, '/').split('/');
    filename = pathParts[pathParts.length - 1] || 'audio.mp3';
  } else if (Buffer.isBuffer(audio)) {
    audioBuffer = audio;
  } else if (audio instanceof Uint8Array) {
    audioBuffer = Buffer.from(audio);
  } else {
    throw new MultimodalError(
      'transcribeAudio: audio must be a file path string, Buffer, or Uint8Array',
      { code: 'INVALID_INPUT', retryable: false },
    );
  }

  const mimeType = _audioMimeType(filename);
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  parts.push(audioBuffer);
  parts.push('\r\n');

  const model = opts.model || 'whisper-1';
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`
  );

  if (opts.language) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n${opts.language}\r\n`
    );
  }

  if (opts.prompt) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="prompt"\r\n\r\n${opts.prompt}\r\n`
    );
  }

  const responseFormat = opts.format || 'json';
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="response_format"\r\n\r\n${responseFormat}\r\n`
  );

  if (opts.temperature != null) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="temperature"\r\n\r\n${opts.temperature}\r\n`
    );
  }

  if (opts.provider) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="provider"\r\n\r\n${opts.provider}\r\n`
    );
  }

  parts.push(`--${boundary}--\r\n`);

  return { bodyBuffer: _combineMultipart(parts), boundary, model };
}
