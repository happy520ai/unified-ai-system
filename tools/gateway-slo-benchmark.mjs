#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, cpus, platform, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const serviceEntrypoint = resolve(serviceRoot, "src/index.js");
const DEFAULT_OUTPUT = resolve(repoRoot, ".tmp/gateway-slo-benchmark.json");
const OUTPUT_TAIL_LIMIT = 16_384;
const METHOD_VERSION = "gateway-slo-v1";

const PROFILES = Object.freeze({
  ci: Object.freeze({
    requests: 80,
    concurrency: 8,
    warmup: 12,
    timeoutMs: 5_000,
    maxP95Ms: 750,
    maxP99Ms: 1_500,
    minThroughputRps: 10,
    maxStreamTtftP95Ms: 1_000,
    maxStreamTotalP95Ms: 2_500,
    minStreamThroughputRps: 5,
    maxErrorRate: 0,
  }),
  observe: Object.freeze({
    requests: 250,
    concurrency: 16,
    warmup: 25,
    timeoutMs: 10_000,
    maxP95Ms: null,
    maxP99Ms: null,
    minThroughputRps: null,
    maxStreamTtftP95Ms: null,
    maxStreamTotalP95Ms: null,
    minStreamThroughputRps: null,
    maxErrorRate: 0,
  }),
});

const parsedArgs = parseArgs(process.argv.slice(2));
if (parsedArgs.help) {
  printHelp();
  process.exit(0);
}

const config = createConfig(parsedArgs);
const report = await runBenchmark(config);
await writeReport(config.output, report);

if (config.json) {
  process.stdout.write(`${JSON.stringify(report)}\n`);
} else {
  printSummary(report, config.output);
}

if (report.status !== "passed") {
  process.exitCode = 1;
}

async function runBenchmark(options) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let managedGateway = null;
  let managedGatewayCleanedUp = null;
  let health = null;
  let warmup = null;
  let streamingWarmup = null;
  let faultIsolation = createSkippedFaultResult(options.faultProbes
    ? "Benchmark execution did not reach the fault probes."
    : "Fault probes were not requested for an external target.");
  let measurement = null;
  let streamingMeasurement = null;
  let fatalError = null;
  let endpointUrl = options.target;

  try {
    if (options.managed) {
      managedGateway = await startManagedGateway(options);
      endpointUrl = `${managedGateway.baseUrl}/v1/chat/completions`;
      health = managedGateway.health;
    }

    warmup = await executeBatch({
      endpointUrl,
      requests: options.warmup,
      concurrency: Math.min(options.concurrency, options.warmup),
      timeoutMs: options.timeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      label: "warmup",
    });
    streamingWarmup = await executeStreamBatch({
      endpointUrl,
      requests: options.warmup,
      concurrency: Math.min(options.concurrency, options.warmup),
      timeoutMs: options.timeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      label: "streaming-warmup",
    });

    if (options.faultProbes) {
      faultIsolation = await runFaultIsolationProbes({
        endpointUrl,
        baseUrl: managedGateway?.baseUrl ?? null,
        timeoutMs: options.timeoutMs,
        model: options.model,
        requireFakeExecution: options.managed,
      });
    }

    measurement = await executeBatch({
      endpointUrl,
      requests: options.requests,
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      label: "measurement",
    });
    streamingMeasurement = await executeStreamBatch({
      endpointUrl,
      requests: options.requests,
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      label: "streaming-measurement",
    });
  } catch (error) {
    fatalError = normalizeError(error);
  } finally {
    if (managedGateway) {
      managedGatewayCleanedUp = await stopManagedGateway(managedGateway);
    }
  }

  const checks = createChecks({
    options,
    health,
    warmup,
    streamingWarmup,
    faultIsolation,
    measurement,
    streamingMeasurement,
    fatalError,
    managedGatewayCleanedUp,
  });
  const status = checks.every((check) => check.passed) ? "passed" : "failed";

  return {
    schemaVersion: 1,
    methodologyVersion: METHOD_VERSION,
    status,
    generatedAt: new Date().toISOString(),
    startedAt,
    totalDurationMs: round(performance.now() - started),
    mode: options.managed ? "managed-local-fake" : "external-observation",
    target: {
      endpoint: sanitizeTarget(endpointUrl),
      model: options.model,
      managed: options.managed,
      credentialsSupported: false,
    },
    workload: {
      profile: options.profile,
      requests: options.requests,
      concurrency: options.concurrency,
      warmupRequests: options.warmup,
      timeoutMs: options.timeoutMs,
      payloads: [
        "OpenAI-compatible non-streaming chat completion",
        "OpenAI-compatible SSE streaming chat completion with usage",
      ],
    },
    thresholds: {
      maxP95Ms: options.maxP95Ms,
      maxP99Ms: options.maxP99Ms,
      minThroughputRps: options.minThroughputRps,
      maxStreamTtftP95Ms: options.maxStreamTtftP95Ms,
      maxStreamTotalP95Ms: options.maxStreamTotalP95Ms,
      minStreamThroughputRps: options.minStreamThroughputRps,
      maxErrorRate: options.maxErrorRate,
    },
    environment: {
      nodeVersion: process.version,
      platform: platform(),
      architecture: arch(),
      logicalCpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      ci: process.env.CI === "true",
    },
    safety: {
      providerMode: options.managed ? health?.body?.data?.providerMode ?? null : "unknown",
      realProviderEnabled: options.managed ? health?.body?.data?.realProviderEnabled ?? null : null,
      observedExecutionMode: measurement?.observedExecutionModes?.length === 1
        ? measurement.observedExecutionModes[0]
        : measurement?.observedExecutionModes ?? [],
      observedStreamingExecutionMode: streamingMeasurement?.observedExecutionModes?.length === 1
        ? streamingMeasurement.observedExecutionModes[0]
        : streamingMeasurement?.observedExecutionModes ?? [],
      realProviderCallsMade: options.managed ? false : null,
      credentialEnvironmentForwarded: false,
      managedGatewayCleanedUp,
    },
    warmup,
    streamingWarmup,
    faultIsolation,
    measurement,
    streamingMeasurement,
    checks,
    issueCodes: checks.filter((check) => !check.passed).map((check) => check.code),
    fatalError,
    comparisonBoundary: "These measurements describe this target on this host and workload only. They do not prove production readiness or superiority over another gateway without same-host, same-model, same-payload comparative runs.",
    industryAlignment: [
      "OpenAI-compatible protocol correctness",
      "latency percentiles (p50/p95/p99)",
      "streaming time to first content delta and inter-chunk latency",
      "throughput and error rate",
      "timeout classification",
      "fault isolation and recovery",
      "credential-free reproducibility",
      "managed process cleanup",
    ],
  };
}

async function startManagedGateway(options) {
  const port = await reserveFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const inheritedEnv = createMinimalChildEnvironment(process.env);
  const child = spawn(process.execPath, [serviceEntrypoint], {
    cwd: serviceRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...inheritedEnv,
      AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
      AI_GATEWAY_SERVICE_PORT: String(port),
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ROUTE_MODE: "registry-default",
      AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1,::1,::ffff:127.0.0.1",
      AI_GATEWAY_MAX_IN_FLIGHT_REQUESTS: String(Math.max(64, options.concurrency * 4)),
      AI_GATEWAY_MAX_REQUEST_BODY_BYTES: "4096",
      AI_GATEWAY_USAGE_LOG_DIR: resolve(repoRoot, ".tmp", `gateway-slo-usage-${port}`),
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    },
  });

  const state = { child, baseUrl, stdout: "", stderr: "", exitError: null };
  child.stdout.on("data", (chunk) => {
    state.stdout = appendBounded(state.stdout, chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    state.stderr = appendBounded(state.stderr, chunk.toString());
  });
  child.once("error", (error) => {
    state.exitError = error;
  });

  try {
    state.health = await waitForHealth(state, 20_000);
    if (state.health.body?.data?.providerMode !== "fake") {
      throw new Error("Managed gateway did not report providerMode=fake.");
    }
    if (state.health.body?.data?.realProviderEnabled !== false) {
      throw new Error("Managed gateway did not report realProviderEnabled=false.");
    }
    return state;
  } catch (error) {
    await stopManagedGateway(state);
    throw error;
  }
}

async function waitForHealth(state, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  let lastError = null;
  while (performance.now() < deadline) {
    if (state.exitError) throw state.exitError;
    if (hasChildExited(state.child)) {
      throw new Error(`Gateway exited before readiness with code ${state.child.exitCode ?? state.child.signalCode}. ${outputTail(state)}`);
    }
    try {
      const health = await fetchJson(`${state.baseUrl}/health/check`, {
        method: "GET",
        timeoutMs: 1_000,
      });
      if (health.status === 200 && health.body?.data?.status === "ready") return health;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Gateway readiness timed out: ${normalizeError(lastError)?.message ?? "no response"}. ${outputTail(state)}`);
}

async function stopManagedGateway(state) {
  const child = state?.child;
  if (!child || hasChildExited(child)) return true;

  child.kill("SIGTERM");
  await waitForChildExit(child, 5_000);
  if (!hasChildExited(child)) {
    child.kill("SIGKILL");
    await waitForChildExit(child, 2_000);
  }
  return hasChildExited(child);
}

async function executeBatch({ endpointUrl, requests, concurrency, timeoutMs, model, requireFakeExecution, label }) {
  const results = new Array(requests);
  let cursor = 0;
  const batchStarted = performance.now();
  const workers = Array.from({ length: Math.min(concurrency, requests) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= requests) return;
      results[index] = await executeChatRequest({
        endpointUrl,
        timeoutMs,
        model,
        requireFakeExecution,
        sequence: index,
        label,
      });
    }
  });
  await Promise.all(workers);
  const wallDurationMs = performance.now() - batchStarted;
  return summarizeBatch(results, wallDurationMs);
}

async function executeStreamBatch({ endpointUrl, requests, concurrency, timeoutMs, model, requireFakeExecution, label }) {
  const results = new Array(requests);
  let cursor = 0;
  const batchStarted = performance.now();
  const workers = Array.from({ length: Math.min(concurrency, requests) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= requests) return;
      results[index] = await executeStreamingChatRequest({
        endpointUrl,
        timeoutMs,
        model,
        requireFakeExecution,
        sequence: index,
        label,
      });
    }
  });
  await Promise.all(workers);
  return summarizeStreamBatch(results, performance.now() - batchStarted);
}

async function executeChatRequest({ endpointUrl, timeoutMs, model, requireFakeExecution, sequence, label }) {
  const started = performance.now();
  try {
    const response = await fetchJson(endpointUrl, {
      method: "POST",
      timeoutMs,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: `${label} gateway benchmark request ${sequence}` }],
      }),
    });
    const protocolValid = response.status === 200
      && response.body?.object === "chat.completion"
      && Array.isArray(response.body?.choices)
      && typeof response.body?.choices?.[0]?.message?.content === "string";
    const executionMode = response.body?.unified_ai?.execution_mode ?? null;
    const safetyValid = !requireFakeExecution || executionMode === "fake";
    return {
      latencyMs: performance.now() - started,
      status: response.status,
      ok: response.status === 200 && protocolValid && safetyValid,
      protocolValid,
      safetyValid,
      executionMode,
      timedOut: false,
      transportError: null,
    };
  } catch (error) {
    const normalized = normalizeError(error);
    return {
      latencyMs: performance.now() - started,
      status: null,
      ok: false,
      protocolValid: false,
      safetyValid: false,
      executionMode: null,
      timedOut: normalized?.name === "AbortError" || normalized?.code === "REQUEST_TIMEOUT",
      transportError: normalized?.code ?? normalized?.name ?? "request_failed",
    };
  }
}

async function executeStreamingChatRequest({ endpointUrl, timeoutMs, model, requireFakeExecution, sequence, label }) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Streaming request timeout.")), timeoutMs);
  timer.unref?.();

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "user", content: `${label} gateway benchmark request ${sequence}` }],
      }),
      signal: controller.signal,
    });
    const headersAt = performance.now();
    const contentType = response.headers.get("content-type") ?? "";
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Streaming response body is unavailable.");

    const decoder = new TextDecoder();
    const executionModes = new Set();
    const interContentChunkMs = [];
    let buffer = "";
    let bytesReceived = 0;
    let eventCount = 0;
    let objectChunkCount = 0;
    let contentChunkCount = 0;
    let contentCharacters = 0;
    let parseErrors = 0;
    let errorPayloads = 0;
    let firstEventAt = null;
    let firstContentAt = null;
    let previousContentAt = null;
    let finishReasonSeen = false;
    let usageChunkSeen = false;
    let doneSeen = false;

    const consumeEvent = (block) => {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();
      if (!data) return;

      const observedAt = performance.now();
      firstEventAt ??= observedAt;
      if (data === "[DONE]") {
        doneSeen = true;
        return;
      }

      eventCount += 1;
      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        parseErrors += 1;
        return;
      }
      if (payload?.error) errorPayloads += 1;
      if (payload?.object === "chat.completion.chunk") objectChunkCount += 1;
      if (payload?.unified_ai?.execution_mode) executionModes.add(payload.unified_ai.execution_mode);
      if (payload?.usage && typeof payload.usage === "object") usageChunkSeen = true;

      const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
      if (choice?.finish_reason !== null && choice?.finish_reason !== undefined) finishReasonSeen = true;
      const content = choice?.delta?.content;
      if (typeof content === "string" && content.length > 0) {
        firstContentAt ??= observedAt;
        if (previousContentAt !== null) interContentChunkMs.push(observedAt - previousContentAt);
        previousContentAt = observedAt;
        contentChunkCount += 1;
        contentCharacters += content.length;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesReceived += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) consumeEvent(block);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);

    const completedAt = performance.now();
    const observedExecutionModes = [...executionModes].sort();
    const protocolValid = response.status === 200
      && contentType.toLowerCase().includes("text/event-stream")
      && objectChunkCount > 0
      && contentChunkCount > 0
      && finishReasonSeen
      && usageChunkSeen
      && doneSeen
      && parseErrors === 0
      && errorPayloads === 0;
    const safetyValid = !requireFakeExecution
      || (observedExecutionModes.length === 1 && observedExecutionModes[0] === "fake");

    return {
      status: response.status,
      ok: protocolValid && safetyValid,
      protocolValid,
      safetyValid,
      timedOut: false,
      transportError: null,
      responseHeadersMs: headersAt - started,
      timeToFirstEventMs: firstEventAt === null ? null : firstEventAt - started,
      timeToFirstContentDeltaMs: firstContentAt === null ? null : firstContentAt - started,
      totalResponseMs: completedAt - started,
      interContentChunkMs,
      eventCount,
      objectChunkCount,
      contentChunkCount,
      contentCharacters,
      bytesReceived,
      finishReasonSeen,
      usageChunkSeen,
      doneSeen,
      parseErrors,
      errorPayloads,
      observedExecutionModes,
    };
  } catch (error) {
    const normalized = normalizeError(error);
    return {
      status: null,
      ok: false,
      protocolValid: false,
      safetyValid: false,
      timedOut: controller.signal.aborted || normalized?.name === "AbortError" || normalized?.code === "REQUEST_TIMEOUT",
      transportError: normalized?.code ?? normalized?.name ?? "stream_request_failed",
      responseHeadersMs: null,
      timeToFirstEventMs: null,
      timeToFirstContentDeltaMs: null,
      totalResponseMs: performance.now() - started,
      interContentChunkMs: [],
      eventCount: 0,
      objectChunkCount: 0,
      contentChunkCount: 0,
      contentCharacters: 0,
      bytesReceived: 0,
      finishReasonSeen: false,
      usageChunkSeen: false,
      doneSeen: false,
      parseErrors: 0,
      errorPayloads: 0,
      observedExecutionModes: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runFaultIsolationProbes({ endpointUrl, baseUrl, timeoutMs, model, requireFakeExecution }) {
  const malformed = await fetchJson(endpointUrl, {
    method: "POST",
    timeoutMs,
    headers: { "content-type": "application/json" },
    body: "{",
    allowInvalidJson: true,
  });
  const oversized = await fetchJson(endpointUrl, {
    method: "POST",
    timeoutMs,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "x".repeat(8_192) }] }),
    allowInvalidJson: true,
  });
  const recovery = await executeChatRequest({
    endpointUrl,
    timeoutMs,
    model,
    requireFakeExecution,
    sequence: 0,
    label: "fault-recovery",
  });
  const health = baseUrl
    ? await fetchJson(`${baseUrl}/health/check`, { method: "GET", timeoutMs })
    : null;
  const checks = {
    malformedJsonRejected: malformed.status === 400,
    oversizedPayloadRejected: oversized.status === 413,
    validRequestRecovered: recovery.ok,
    healthRecovered: health === null || (health.status === 200 && health.body?.data?.status === "ready"),
  };
  return {
    status: Object.values(checks).every(Boolean) ? "passed" : "failed",
    checks,
    observedStatuses: {
      malformedJson: malformed.status,
      oversizedPayload: oversized.status,
      recovery: recovery.status,
      health: health?.status ?? null,
    },
  };
}

function summarizeBatch(results, wallDurationMs) {
  const successful = results.filter((result) => result.ok);
  const latencies = successful.map((result) => result.latencyMs).sort((a, b) => a - b);
  const statusCodes = {};
  for (const result of results) {
    const key = result.status === null ? "transport_error" : String(result.status);
    statusCodes[key] = (statusCodes[key] ?? 0) + 1;
  }
  const observedExecutionModes = [...new Set(results.map((result) => result.executionMode).filter(Boolean))].sort();
  const attempted = results.length;
  const succeeded = successful.length;
  const failed = attempted - succeeded;
  return {
    attempted,
    succeeded,
    failed,
    protocolValid: results.filter((result) => result.protocolValid).length,
    safetyValid: results.filter((result) => result.safetyValid).length,
    transportErrors: results.filter((result) => result.transportError !== null).length,
    timeouts: results.filter((result) => result.timedOut).length,
    errorRate: ratio(failed, attempted),
    protocolValidityRate: ratio(results.filter((result) => result.protocolValid).length, attempted),
    wallDurationMs: round(wallDurationMs),
    throughputRps: wallDurationMs > 0 ? round((succeeded * 1_000) / wallDurationMs) : 0,
    attemptedRps: wallDurationMs > 0 ? round((attempted * 1_000) / wallDurationMs) : 0,
    latencyMs: summarizeLatency(latencies),
    statusCodes,
    observedExecutionModes,
  };
}

function summarizeStreamBatch(results, wallDurationMs) {
  const successful = results.filter((result) => result.ok);
  const statusCodes = {};
  for (const result of results) {
    const key = result.status === null ? "transport_error" : String(result.status);
    statusCodes[key] = (statusCodes[key] ?? 0) + 1;
  }
  const observedExecutionModes = [...new Set(results.flatMap((result) => result.observedExecutionModes))].sort();
  const attempted = results.length;
  const succeeded = successful.length;
  const failed = attempted - succeeded;
  const contentCharacters = successful.reduce((sum, result) => sum + result.contentCharacters, 0);
  const bytesReceived = successful.reduce((sum, result) => sum + result.bytesReceived, 0);
  return {
    attempted,
    succeeded,
    failed,
    protocolValid: results.filter((result) => result.protocolValid).length,
    safetyValid: results.filter((result) => result.safetyValid).length,
    transportErrors: results.filter((result) => result.transportError !== null).length,
    timeouts: results.filter((result) => result.timedOut).length,
    errorRate: ratio(failed, attempted),
    protocolValidityRate: ratio(results.filter((result) => result.protocolValid).length, attempted),
    wallDurationMs: round(wallDurationMs),
    throughputRps: wallDurationMs > 0 ? round((succeeded * 1_000) / wallDurationMs) : 0,
    contentCharacters,
    contentCharactersPerSecond: wallDurationMs > 0 ? round((contentCharacters * 1_000) / wallDurationMs) : 0,
    bytesReceived,
    eventCount: successful.reduce((sum, result) => sum + result.eventCount, 0),
    contentChunkCount: successful.reduce((sum, result) => sum + result.contentChunkCount, 0),
    responseHeadersMs: summarizeMetric(successful.map((result) => result.responseHeadersMs)),
    timeToFirstEventMs: summarizeMetric(successful.map((result) => result.timeToFirstEventMs)),
    timeToFirstContentDeltaMs: summarizeMetric(successful.map((result) => result.timeToFirstContentDeltaMs)),
    totalResponseMs: summarizeMetric(successful.map((result) => result.totalResponseMs)),
    interContentChunkMs: summarizeMetric(successful.flatMap((result) => result.interContentChunkMs)),
    statusCodes,
    observedExecutionModes,
    protocolSignals: {
      finishReason: results.filter((result) => result.finishReasonSeen).length,
      usageChunk: results.filter((result) => result.usageChunkSeen).length,
      doneSentinel: results.filter((result) => result.doneSeen).length,
      parseErrors: results.reduce((sum, result) => sum + result.parseErrors, 0),
      errorPayloads: results.reduce((sum, result) => sum + result.errorPayloads, 0),
    },
  };
}

function summarizeMetric(values) {
  return summarizeLatency(values.filter(Number.isFinite).sort((a, b) => a - b));
}

function summarizeLatency(sorted) {
  if (sorted.length === 0) {
    return { samples: 0, min: null, mean: null, p50: null, p95: null, p99: null, max: null };
  }
  return {
    samples: sorted.length,
    min: round(sorted[0]),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted[sorted.length - 1]),
  };
}

function createChecks({ options, health, warmup, streamingWarmup, faultIsolation, measurement, streamingMeasurement, fatalError, managedGatewayCleanedUp }) {
  const checks = [
    check("benchmark_completed", fatalError === null, "benchmark execution completes without a fatal error", fatalError?.message ?? "complete"),
    check("warmup_healthy", warmup?.failed === 0, "warmup has zero failed requests", warmup?.failed ?? null),
    check("streaming_warmup_healthy", streamingWarmup?.failed === 0, "streaming warmup has zero failed requests", streamingWarmup?.failed ?? null),
    check("protocol_valid", measurement?.protocolValidityRate === 1, "all measured responses satisfy the OpenAI chat-completion shape", measurement?.protocolValidityRate ?? null),
    check("streaming_protocol_valid", streamingMeasurement?.protocolValidityRate === 1, "all measured streams contain valid SSE chunks, usage, finish reason, and DONE sentinel", streamingMeasurement?.protocolValidityRate ?? null),
    check("error_rate_within_limit", measurement !== null && measurement.errorRate <= options.maxErrorRate, `error rate <= ${options.maxErrorRate}`, measurement?.errorRate ?? null),
    check("streaming_error_rate_within_limit", streamingMeasurement !== null && streamingMeasurement.errorRate <= options.maxErrorRate, `streaming error rate <= ${options.maxErrorRate}`, streamingMeasurement?.errorRate ?? null),
  ];

  if (options.maxP95Ms !== null) {
    const actualP95Ms = measurement?.latencyMs?.p95;
    checks.push(check("p95_within_limit", Number.isFinite(actualP95Ms) && actualP95Ms <= options.maxP95Ms, `p95 <= ${options.maxP95Ms} ms`, actualP95Ms ?? null));
  }
  if (options.maxP99Ms !== null) {
    const actualP99Ms = measurement?.latencyMs?.p99;
    checks.push(check("p99_within_limit", Number.isFinite(actualP99Ms) && actualP99Ms <= options.maxP99Ms, `p99 <= ${options.maxP99Ms} ms`, actualP99Ms ?? null));
  }
  if (options.minThroughputRps !== null) {
    const actualThroughputRps = measurement?.throughputRps;
    checks.push(check("throughput_within_limit", Number.isFinite(actualThroughputRps) && actualThroughputRps >= options.minThroughputRps, `successful throughput >= ${options.minThroughputRps} requests/s`, actualThroughputRps ?? null));
  }
  if (options.maxStreamTtftP95Ms !== null) {
    const actualStreamTtftP95Ms = streamingMeasurement?.timeToFirstContentDeltaMs?.p95;
    checks.push(check("streaming_ttft_p95_within_limit", Number.isFinite(actualStreamTtftP95Ms) && actualStreamTtftP95Ms <= options.maxStreamTtftP95Ms, `streaming first-content p95 <= ${options.maxStreamTtftP95Ms} ms`, actualStreamTtftP95Ms ?? null));
  }
  if (options.maxStreamTotalP95Ms !== null) {
    const actualStreamTotalP95Ms = streamingMeasurement?.totalResponseMs?.p95;
    checks.push(check("streaming_total_p95_within_limit", Number.isFinite(actualStreamTotalP95Ms) && actualStreamTotalP95Ms <= options.maxStreamTotalP95Ms, `streaming total-response p95 <= ${options.maxStreamTotalP95Ms} ms`, actualStreamTotalP95Ms ?? null));
  }
  if (options.minStreamThroughputRps !== null) {
    const actualStreamThroughputRps = streamingMeasurement?.throughputRps;
    checks.push(check("streaming_throughput_within_limit", Number.isFinite(actualStreamThroughputRps) && actualStreamThroughputRps >= options.minStreamThroughputRps, `successful streaming throughput >= ${options.minStreamThroughputRps} requests/s`, actualStreamThroughputRps ?? null));
  }
  if (options.faultProbes) {
    checks.push(check("fault_isolation_recovered", faultIsolation?.status === "passed", "malformed and oversized requests are isolated and valid traffic recovers", faultIsolation?.status ?? null));
  }
  if (options.managed) {
    checks.push(
      check("managed_fake_only", health?.body?.data?.providerMode === "fake" && health?.body?.data?.realProviderEnabled === false && measurement?.observedExecutionModes?.length === 1 && measurement.observedExecutionModes[0] === "fake" && streamingMeasurement?.observedExecutionModes?.length === 1 && streamingMeasurement.observedExecutionModes[0] === "fake", "managed non-streaming and streaming runs stay on the fake provider with real providers disabled", { nonStreaming: measurement?.observedExecutionModes ?? null, streaming: streamingMeasurement?.observedExecutionModes ?? null }),
      check("managed_gateway_cleaned_up", managedGatewayCleanedUp === true, "managed gateway process exits after the benchmark", managedGatewayCleanedUp),
    );
  }
  return checks;
}

async function fetchJson(url, { method, timeoutMs, headers, body, allowInvalidJson = false }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timeout.")), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await response.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        if (!allowInvalidJson) throw error;
      }
    }
    return { status: response.status, body: parsed };
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`Request exceeded ${timeoutMs} ms.`);
      timeoutError.code = "REQUEST_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function createConfig(args) {
  const managed = !args.target;
  const profileName = args.profile ?? (managed ? "ci" : "observe");
  const profile = PROFILES[profileName];
  if (!profile) throw new Error(`Unknown profile: ${profileName}. Expected ci or observe.`);

  const target = managed ? null : validateTarget(args.target);
  return {
    profile: profileName,
    managed,
    target,
    model: args.model ?? "local-fake-model",
    requests: positiveInteger(args.requests, profile.requests, "requests"),
    concurrency: positiveInteger(args.concurrency, profile.concurrency, "concurrency"),
    warmup: positiveInteger(args.warmup, profile.warmup, "warmup"),
    timeoutMs: positiveInteger(args.timeoutMs, profile.timeoutMs, "timeout-ms"),
    maxP95Ms: optionalNonNegativeNumber(args.maxP95Ms, profile.maxP95Ms, "max-p95-ms"),
    maxP99Ms: optionalNonNegativeNumber(args.maxP99Ms, profile.maxP99Ms, "max-p99-ms"),
    minThroughputRps: optionalNonNegativeNumber(args.minThroughputRps, profile.minThroughputRps, "min-rps"),
    maxStreamTtftP95Ms: optionalNonNegativeNumber(args.maxStreamTtftP95Ms, profile.maxStreamTtftP95Ms, "max-stream-ttft-p95-ms"),
    maxStreamTotalP95Ms: optionalNonNegativeNumber(args.maxStreamTotalP95Ms, profile.maxStreamTotalP95Ms, "max-stream-total-p95-ms"),
    minStreamThroughputRps: optionalNonNegativeNumber(args.minStreamThroughputRps, profile.minStreamThroughputRps, "min-stream-rps"),
    maxErrorRate: boundedRatio(args.maxErrorRate, profile.maxErrorRate, "max-error-rate"),
    faultProbes: args.skipFaultProbes ? false : (managed || args.faultProbes),
    output: resolve(repoRoot, args.output ?? DEFAULT_OUTPUT),
    json: args.json,
  };
}

function parseArgs(argv) {
  const result = { json: false, help: false, faultProbes: false, skipFaultProbes: false };
  const valueFlags = new Map([
    ["--profile", "profile"],
    ["--target", "target"],
    ["--model", "model"],
    ["--requests", "requests"],
    ["--concurrency", "concurrency"],
    ["--warmup", "warmup"],
    ["--timeout-ms", "timeoutMs"],
    ["--max-p95-ms", "maxP95Ms"],
    ["--max-p99-ms", "maxP99Ms"],
    ["--min-rps", "minThroughputRps"],
    ["--max-stream-ttft-p95-ms", "maxStreamTtftP95Ms"],
    ["--max-stream-total-p95-ms", "maxStreamTotalP95Ms"],
    ["--min-stream-rps", "minStreamThroughputRps"],
    ["--max-error-rate", "maxErrorRate"],
    ["--output", "output"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--json") result.json = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--fault-probes") result.faultProbes = true;
    else if (arg === "--skip-fault-probes") result.skipFaultProbes = true;
    else if (valueFlags.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      result[valueFlags.get(arg)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

function validateTarget(value) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Target must use http or https.");
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Target credentials, query parameters, and fragments are not accepted.");
  }
  return url.toString().replace(/\/$/, "");
}

function createMinimalChildEnvironment(env) {
  const allowed = [
    "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR",
    "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "NODE_OPTIONS", "NODE_PATH",
    "CI", "GITHUB_ACTIONS", "FORCE_COLOR", "NO_COLOR",
  ];
  return Object.fromEntries(allowed.filter((name) => env[name] !== undefined).map((name) => [name, env[name]]));
}

async function reserveFreePort() {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolvePromise, rejectPromise) => server.close((error) => error ? rejectPromise(error) : resolvePromise()));
  if (!port) throw new Error("Unable to reserve a benchmark port.");
  return port;
}

async function writeReport(path, report) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function waitForChildExit(child, timeoutMs) {
  if (hasChildExited(child)) return Promise.resolve();
  return Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    delay(timeoutMs),
  ]);
}

function hasChildExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function percentile(sorted, quantile) {
  const rank = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  return sorted[Math.min(rank, sorted.length - 1)];
}

function check(code, passed, expectation, actual) {
  return { code, passed: Boolean(passed), expectation, actual };
}

function positiveInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function optionalNonNegativeNumber(value, fallback, name) {
  if (value === undefined) return fallback;
  if (value === "none") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be non-negative or none.`);
  return parsed;
}

function boundedRatio(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`${name} must be between 0 and 1.`);
  return parsed;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : 0;
}

function appendBounded(existing, addition) {
  return `${existing}${addition}`.slice(-OUTPUT_TAIL_LIMIT);
}

function outputTail(state) {
  return `${state.stdout}\n${state.stderr}`.trim().slice(-4_000);
}

function normalizeError(error) {
  if (!error) return null;
  return {
    name: error.name ?? "Error",
    code: error.code ?? null,
    message: error.message ?? String(error),
  };
}

function createSkippedFaultResult(reason) {
  return { status: "skipped", reason, checks: {}, observedStatuses: {} };
}

function sanitizeTarget(target) {
  if (!target) return null;
  const url = new URL(target);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function printSummary(result, output) {
  const metrics = result.measurement;
  const streaming = result.streamingMeasurement;
  process.stdout.write([
    `Gateway SLO benchmark: ${result.status}`,
    `Mode: ${result.mode}`,
    `Requests: ${metrics?.succeeded ?? 0}/${metrics?.attempted ?? 0} successful`,
    `Latency: p50=${metrics?.latencyMs?.p50 ?? "n/a"}ms p95=${metrics?.latencyMs?.p95 ?? "n/a"}ms p99=${metrics?.latencyMs?.p99 ?? "n/a"}ms`,
    `Throughput: ${metrics?.throughputRps ?? 0} requests/s`,
    `Streaming: first-content p95=${streaming?.timeToFirstContentDeltaMs?.p95 ?? "n/a"}ms total p95=${streaming?.totalResponseMs?.p95 ?? "n/a"}ms`,
    `Streaming throughput: ${streaming?.throughputRps ?? 0} requests/s`,
    `Fault isolation: ${result.faultIsolation.status}`,
    `Evidence: ${output}`,
    result.issueCodes.length > 0 ? `Issues: ${result.issueCodes.join(", ")}` : "Issues: none",
  ].join("\n") + "\n");
}

function printHelp() {
  process.stdout.write(`Credential-free OpenAI-compatible gateway SLO benchmark.\n\nUsage:\n  node tools/gateway-slo-benchmark.mjs [options]\n\nOptions:\n  --profile <ci|observe>       Managed runs default to ci; external runs to observe.\n  --target <endpoint-url>      Complete external chat-completions endpoint; disables managed mode.\n  --model <id>                 Model sent in the request (default: local-fake-model).\n  --requests <count>           Measured request count per response mode.\n  --concurrency <count>        Concurrent workers.\n  --warmup <count>             Warmup request count per response mode.\n  --timeout-ms <ms>            Per-request timeout.\n  --max-p95-ms <ms|none>       Fail-closed non-streaming p95 threshold.\n  --max-p99-ms <ms|none>       Fail-closed non-streaming p99 threshold.\n  --min-rps <rps|none>         Fail-closed non-streaming throughput threshold.\n  --max-stream-ttft-p95-ms <ms|none> Streaming first-content p95 threshold.\n  --max-stream-total-p95-ms <ms|none> Streaming total-response p95 threshold.\n  --min-stream-rps <rps|none>  Fail-closed streaming-throughput threshold.\n  --max-error-rate <0..1>      Maximum measured error ratio for each mode.\n  --fault-probes               Enable malformed/oversized probes for an external target.\n  --skip-fault-probes          Disable fault probes.\n  --output <path>              JSON evidence path.\n  --json                       Emit compact JSON to stdout.\n  --help                       Show this help.\n\nNo authorization headers or provider credentials are accepted.\n`);
}
