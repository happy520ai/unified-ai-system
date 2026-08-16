#!/usr/bin/env node
// =============================================================================
// gateway-benchmark.mjs — self-hosted gateway infrastructure micro-benchmark
//
// Boots the real gateway (fake provider, deterministic, zero credentials) in
// isolated phases and measures the gateway's OWN overhead on the hot path:
// JSON/SSE chat latency, throughput, cache hit vs miss, guardrail scan cost,
// virtual-key gate cost, and prompt-enhance latency.
//
// This is an infrastructure benchmark (single node, loopback, fake provider).
// It says nothing about model quality or provider latency, and the report
// must keep saying so.
//
// Usage:
//   node tools/gateway-benchmark.mjs [--json out.json] [--port 3197]
// =============================================================================

import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const JSON_OUT = flag("--json", "");
const PORT = Number(flag("--port", "3197"));
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "benchmark-admin-token-0123456789abcdef0123456789abcdef";
const REPO_ROOT = resolve(import.meta.dirname, "..");
const SERVICE_ENTRY = resolve(REPO_ROOT, "apps/ai-gateway-service/src/index.js");

const CHAT_BODY = {
  model: "local-fake-model",
  messages: [{ role: "user", content: "Summarize the release plan for the team in three bullets." }],
};

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, v) => sum + v, 0) / (samples.length || 1);
  return {
    n: samples.length,
    meanMs: Math.round(mean * 100) / 100,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  };
}

async function startGateway(envOverrides) {
  const child = spawn(process.execPath, [SERVICE_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
      AI_GATEWAY_SERVICE_PORT: String(PORT),
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: TOKEN,
      ...envOverrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderrTail = "";
  child.stderr.on("data", (chunk) => {
    stderrTail = (stderrTail + String(chunk)).slice(-2000);
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health/check`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      if (response.ok) return child;
    } catch {
      // not ready yet
    }
    if (child.exitCode !== null) {
      throw new Error(`gateway exited with code ${child.exitCode}: ${stderrTail}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill("SIGKILL");
  throw new Error(`gateway did not become ready: ${stderrTail}`);
}

async function stopGateway(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((r) => setTimeout(r, 3000)),
  ]).catch(() => {});
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function postJson(path, body, headers = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const durationMs = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return { durationMs, text };
}

async function postSse(path, body) {
  const startedAt = performance.now();
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`${path} stream -> HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let firstTokenAt = null;
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteCount ?? value.length;
    if (firstTokenAt === null && decoder.decode(value, { stream: true }).includes('"delta"')) {
      firstTokenAt = performance.now();
    }
  }
  const totalMs = performance.now() - startedAt;
  return { ttftMs: firstTokenAt ? firstTokenAt - startedAt : totalMs, totalMs, bytes };
}

async function suiteChatJson(n) {
  const samples = [];
  for (let i = 0; i < 3; i += 1) await postJson("/v1/chat/completions", CHAT_BODY); // warmup
  for (let i = 0; i < n; i += 1) {
    const { durationMs } = await postJson("/v1/chat/completions", CHAT_BODY);
    samples.push(durationMs);
  }
  return { json: stats(samples) };
}

async function suiteChatSse(n) {
  const warm = await postSse("/v1/chat/completions", CHAT_BODY);
  void warm;
  const ttfts = [];
  const totals = [];
  for (let i = 0; i < n; i += 1) {
    const { ttftMs, totalMs } = await postSse("/v1/chat/completions", CHAT_BODY);
    ttfts.push(ttftMs);
    totals.push(totalMs);
  }
  return { ttft: stats(ttfts), streamTotal: stats(totals) };
}

async function suiteThroughput(n, concurrency) {
  let completed = 0;
  const failures = [];
  const startedAt = performance.now();
  async function worker() {
    for (;;) {
      const index = completed + failures.length;
      if (index >= n) return;
      try {
        await postJson("/v1/chat/completions", CHAT_BODY);
        completed += 1;
      } catch (error) {
        failures.push(String(error?.message ?? error));
        if (failures.length > 5) throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const wallMs = performance.now() - startedAt;
  return {
    requests: completed,
    concurrency,
    wallMs: Math.round(wallMs),
    requestsPerSecond: Math.round((completed / (wallMs / 1000)) * 100) / 100,
    ...(failures.length ? { failures: failures.slice(0, 3) } : {}),
  };
}

async function suiteCache(cacheEnabled, n) {
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const { durationMs } = await postJson("/v1/chat/completions", CHAT_BODY);
    samples.push(durationMs);
  }
  const label = cacheEnabled ? "cacheEnabled" : "cacheDisabled";
  return { [label]: stats(samples) };
}

async function suiteGuardrails(enabled, n) {
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const { durationMs } = await postJson("/v1/chat/completions", CHAT_BODY);
    samples.push(durationMs);
  }
  const label = enabled ? "guardrailsEnabled" : "guardrailsDisabled";
  return { [label]: stats(samples) };
}

async function suiteVirtualKey(n) {
  const created = await fetch(`${BASE}/enterprise/virtual-keys`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      role: "admin",
      budget: { limitTokens: 10_000_000, window: "daily" },
      rateLimit: { requestsPerMinute: 10_000 },
    }),
  });
  if (!created.ok) {
    throw new Error(`virtual key creation failed: HTTP ${created.status}`);
  }
  const keyEnvelope = await created.json();
  const virtualKey = keyEnvelope?.data?.key;

  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const { durationMs } = await postJson("/v1/chat/completions", CHAT_BODY, {
      authorization: `Bearer ${virtualKey}`,
    });
    samples.push(durationMs);
  }
  return { virtualKeyPath: stats(samples) };
}

async function suiteEnhance(n) {
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const { durationMs } = await postJson("/prompts/enhance", {
      input: "Build a small API for my team",
      profile: "coding",
      language: "en",
    });
    samples.push(durationMs);
  }
  return { enhance: stats(samples) };
}

async function runPhase(name, envOverrides, fn) {
  const child = await startGateway(envOverrides);
  try {
    const result = await fn();
    return { phase: name, ...result };
  } finally {
    await stopGateway(child);
  }
}

async function main() {
  const startedAt = new Date();
  const phases = [];

  phases.push(await runPhase("baseline", {}, async () => ({
    ...(await suiteChatJson(150)),
    ...(await suiteChatSse(80)),
    ...(await suiteThroughput(240, 8)),
    ...(await suiteEnhance(60)),
    ...(await suiteVirtualKey(120)),
  })));

  phases.push(await runPhase("cache-off", {}, () => suiteCache(false, 120)));
  phases.push(await runPhase("cache-on", { AI_GATEWAY_RESPONSE_CACHE_ENABLED: "true" }, () => suiteCache(true, 120)));
  phases.push(await runPhase("guardrails-off", {}, () => suiteGuardrails(false, 120)));
  phases.push(await runPhase("guardrails-on", { AI_GATEWAY_GUARDRAILS_ENABLED: "true" }, () => suiteGuardrails(true, 120)));

  const report = {
    schema: "unified-ai-system/gateway-benchmark/v1",
    generatedAtUtc: startedAt.toISOString(),
    environment: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      note: "Single node, loopback, fake provider — measures gateway infrastructure overhead only, not model quality or provider latency.",
    },
    phases,
  };

  const serialized = JSON.stringify(report, null, 2);
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, serialized);
    process.stdout.write(`written: ${JSON_OUT}\n`);
  } else {
    process.stdout.write(serialized);
    process.stdout.write("\n");
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
