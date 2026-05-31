#!/usr/bin/env node
/**
 * NVIDIA OpenAI-compatible local rate-limit proxy for OpenCode.
 *
 * Purpose:
 * - Hard cap NVIDIA upstream calls to <= 40 requests / rolling minute by default.
 * - Queue up to NVIDIA_QUEUE_LIMIT requests; reject overflow with 429 so the agent must split work.
 * - Never logs API keys. It forwards Authorization from OpenCode or uses NVIDIA_API_KEY from env.
 *
 * Usage, PowerShell:
 *   $env:NVIDIA_API_KEY="nvapi-..."
 *   $env:NVIDIA_RATE_LIMIT_PER_MINUTE="40"
 *   $env:NVIDIA_QUEUE_LIMIT="40"
 *   node tools/nvidia-rate-limit-proxy.mjs
 *
 * Then configure OpenCode provider.nvidia.options.baseURL = "http://127.0.0.1:8017/v1".
 */

import http from 'node:http';
import { Readable } from 'node:stream';

const PORT = Number.parseInt(process.env.NVIDIA_RATE_PROXY_PORT || '8017', 10);
const UPSTREAM_BASE = (process.env.NVIDIA_UPSTREAM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const LIMIT_PER_MINUTE = Math.max(1, Number.parseInt(process.env.NVIDIA_RATE_LIMIT_PER_MINUTE || '40', 10));
const QUEUE_LIMIT = Math.max(1, Number.parseInt(process.env.NVIDIA_QUEUE_LIMIT || '40', 10));
const MAX_BODY_BYTES = Math.max(1024, Number.parseInt(process.env.NVIDIA_PROXY_MAX_BODY_BYTES || String(50 * 1024 * 1024), 10));
const WINDOW_MS = 60_000;
const MIN_SPACING_MS = Math.ceil(WINDOW_MS / LIMIT_PER_MINUTE);

/** @type {number[]} */
const startedAt = [];
/** @type {{ req: http.IncomingMessage, res: http.ServerResponse, body: Buffer, enqueuedAt: number }[]} */
const queue = [];
let processing = false;
let lastStart = 0;
let totalAccepted = 0;
let totalRejected = 0;
let totalForwarded = 0;

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function cleanOld(now = Date.now()) {
  while (startedAt.length > 0 && now - startedAt[0] >= WINDOW_MS) startedAt.shift();
}

function nextDelayMs(now = Date.now()) {
  cleanOld(now);

  const spacingDelay = Math.max(0, MIN_SPACING_MS - (now - lastStart));
  if (startedAt.length < LIMIT_PER_MINUTE) return spacingDelay;

  const windowDelay = Math.max(0, WINDOW_MS - (now - startedAt[0]) + 5);
  return Math.max(spacingDelay, windowDelay);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('request body too large'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function redactHeaders(headers) {
  const copy = { ...headers };
  for (const key of Object.keys(copy)) {
    if (/authorization|api[-_]?key|token|secret|cookie/i.test(key)) copy[key] = '[redacted]';
  }
  return copy;
}

function upstreamUrl(reqUrl = '/') {
  const url = new URL(reqUrl, 'http://localhost');
  const path = url.pathname.replace(/^\/v1(?=\/|$)/, '');
  return `${UPSTREAM_BASE}${path}${url.search}`;
}

async function forward(item) {
  const { req, res, body } = item;
  const now = Date.now();
  cleanOld(now);
  startedAt.push(now);
  lastStart = now;
  totalForwarded += 1;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];

  if (!headers.authorization && process.env.NVIDIA_API_KEY) {
    headers.authorization = `Bearer ${process.env.NVIDIA_API_KEY}`;
  }

  try {
    const response = await fetch(upstreamUrl(req.url), {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
    });

    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      if (/^transfer-encoding$/i.test(key)) continue;
      responseHeaders[key] = value;
    }
    responseHeaders['x-nvidia-rate-limit-per-minute'] = String(LIMIT_PER_MINUTE);
    responseHeaders['x-nvidia-rate-queue-depth'] = String(queue.length);

    res.writeHead(response.status, responseHeaders);
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    json(res, 502, {
      error: 'nvidia_rate_proxy_upstream_error',
      message: error instanceof Error ? error.message : String(error),
      upstreamBase: UPSTREAM_BASE
    });
  }
}

function schedule() {
  if (processing) return;
  processing = true;

  const loop = () => {
    if (queue.length === 0) {
      processing = false;
      return;
    }

    const delay = nextDelayMs();
    if (delay > 0) {
      setTimeout(loop, delay);
      return;
    }

    const item = queue.shift();
    forward(item).finally(() => setTimeout(loop, MIN_SPACING_MS));
  };

  loop();
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz' || req.url === '/v1/healthz') {
    cleanOld();
    return json(res, 200, {
      ok: true,
      upstreamBase: UPSTREAM_BASE,
      limitPerMinute: LIMIT_PER_MINUTE,
      queueLimit: QUEUE_LIMIT,
      queueDepth: queue.length,
      rollingStartedCount: startedAt.length,
      totalAccepted,
      totalRejected,
      totalForwarded
    });
  }

  if (!req.url || !req.url.startsWith('/v1/')) {
    return json(res, 404, { error: 'not_found', message: 'Use /v1/* paths.' });
  }

  if (queue.length >= QUEUE_LIMIT) {
    totalRejected += 1;
    return json(res, 429, {
      error: 'nvidia_rate_proxy_queue_full',
      message: `This task is trying to exceed the configured queue/burst budget. Split the task into smaller phases so NVIDIA stays under ${LIMIT_PER_MINUTE} requests/minute.`,
      limitPerMinute: LIMIT_PER_MINUTE,
      queueLimit: QUEUE_LIMIT,
      queueDepth: queue.length
    });
  }

  try {
    const body = await readBody(req);
    totalAccepted += 1;
    queue.push({ req, res, body, enqueuedAt: Date.now() });
    schedule();
  } catch (error) {
    const status = error?.statusCode || 400;
    json(res, status, {
      error: 'nvidia_rate_proxy_bad_request',
      message: error instanceof Error ? error.message : String(error),
      headers: redactHeaders(req.headers)
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[nvidia-rate-proxy] listening http://127.0.0.1:${PORT}/v1 -> ${UPSTREAM_BASE}`);
  console.log(`[nvidia-rate-proxy] limit=${LIMIT_PER_MINUTE}/min spacing=${MIN_SPACING_MS}ms queueLimit=${QUEUE_LIMIT}`);
});
