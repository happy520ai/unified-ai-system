#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, cpus, platform, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const serviceEntrypoint = resolve(serviceRoot, "src/index.js");
const DEFAULT_OUTPUT = resolve(repoRoot, ".tmp/gateway-resource-soak.json");
const METHOD_VERSION = "gateway-resource-soak-v3";
const CHECKPOINT_METHOD_VERSION = "gateway-resource-soak-checkpoint-v1";
const OUTPUT_TAIL_LIMIT = 16_384;
const MEBIBYTE = 1024 * 1024;
const DEFAULT_CHECKPOINT_INTERVAL_MS = 5 * 60_000;
const LONG_RUN_THRESHOLD_MS = 60 * 60_000;
const AUTH_TTL_BUFFER_MS = 15 * 60_000;
const AUTH_POST_SOAK_ALLOWANCE_MS = 60_000;
const MAX_DURATION_MS = 7 * 24 * 60 * 60_000;
const METRIC_RESERVOIR_LIMIT = 100_000;
const MAX_RESOURCE_SAMPLES = 100_000;
const MAX_WARMUP_REQUESTS = 10_000;

const PROFILES = Object.freeze({
  ci: Object.freeze({
    durationMs: 12_000,
    targetRps: 100,
    maxOutstanding: 64,
    warmupRequests: 80,
    sampleIntervalMs: 500,
    requestTimeoutMs: 5_000,
    minArrivalRatio: 0.8,
    maxErrorRate: 0,
    maxHeapGrowthBytes: 32 * MEBIBYTE,
    maxRssGrowthBytes: 64 * MEBIBYTE,
    maxMemoryGrowthRatio: 0.5,
    maxEventLoopP99Seconds: 0.2,
    maxEventLoopUtilization: 0.95,
  }),
  observe: Object.freeze({
    durationMs: 300_000,
    targetRps: 100,
    maxOutstanding: 128,
    warmupRequests: 200,
    sampleIntervalMs: 1_000,
    requestTimeoutMs: 10_000,
    minArrivalRatio: 0.8,
    maxErrorRate: 0,
    maxHeapGrowthBytes: 64 * MEBIBYTE,
    maxRssGrowthBytes: 128 * MEBIBYTE,
    maxMemoryGrowthRatio: 0.5,
    maxEventLoopP99Seconds: 0.2,
    maxEventLoopUtilization: 0.95,
  }),
});

const parsedArgs = parseArgs(process.argv.slice(2));
if (parsedArgs.help) {
  printHelp();
  process.exit(0);
}

const config = createConfig(parsedArgs, process.env);
const runController = new AbortController();
let receivedSignal = null;
for (const signalName of ["SIGINT", "SIGTERM"]) {
  process.once(signalName, () => {
    if (receivedSignal) return;
    receivedSignal = signalName;
    const error = new Error(`Gateway resource soak interrupted by ${signalName}.`);
    error.code = "RUN_ABORTED";
    runController.abort(error);
  });
}

const report = await runResourceSoak(config, { signal: runController.signal });
await writeReport(config.output, report);

if (config.json) {
  process.stdout.write(`${JSON.stringify(report)}\n`);
} else {
  printSummary(report, config.output);
}
if (receivedSignal === "SIGINT") process.exitCode = 130;
else if (receivedSignal === "SIGTERM") process.exitCode = 143;
else if (report.status !== "passed") process.exitCode = 1;

async function runResourceSoak(options, { signal } = {}) {
  const startedAt = new Date().toISOString();
  const overallStarted = performance.now();
  let gateway = null;
  let endpointUrl = options.target;
  let metricsUrl = options.metricsUrl;
  let health = null;
  let warmup = null;
  let workload = null;
  let resources = null;
  let fatalError = null;
  let managedGatewayCleanedUp = null;
  let managedAuthValidityMs = null;
  let managedAuthRemainingAtMeasurementStartMs = null;
  let managedAuthRequiredAtMeasurementStartMs = null;
  let postSoak = null;
  let checkpointError = null;
  let requestHeaders = options.privateRequestHeaders ?? Object.freeze({});
  let gatewayAuthSource = options.gatewayAuthSource ?? "none";
  const samples = [];
  const sampleFailures = [];
  const progress = { phase: "starting", workloadSnapshot: null };
  const checkpointWriter = startCheckpointWriter({
    intervalMs: options.checkpointIntervalMs,
    output: options.checkpointOutput,
    snapshot: () => createCheckpoint({
      options,
      startedAt,
      overallStarted,
      progress,
      samples,
      sampleFailures,
      fatalError,
      managedGatewayCleanedUp,
      signal,
    }),
    onError: (error) => { checkpointError ??= normalizeError(error); },
  });
  await checkpointWriter.writeNow();

  try {
    throwIfAborted(signal);
    if (options.managed) {
      progress.phase = "starting-managed-gateway";
      gateway = await startManagedGateway(options);
      endpointUrl = `${gateway.baseUrl}/v1/chat/completions`;
      metricsUrl = `${gateway.baseUrl}/metrics`;
      health = gateway.health;
      managedAuthValidityMs = gateway.authValidityMs;
      requestHeaders = gateway.privateRequestHeaders;
      gatewayAuthSource = "ephemeral-managed";
    }

    if (Object.keys(requestHeaders).length > 0) {
      await verifyAuthenticatedSession(new URL(endpointUrl).origin, requestHeaders);
    }
    throwIfAborted(signal);
    progress.phase = "priming-resource-monitor";
    await primeResourceMonitor(metricsUrl, requestHeaders);
    await delay(Math.min(250, options.sampleIntervalMs), signal);

    progress.phase = "warmup";
    warmup = await executeWarmup({
      endpointUrl,
      requests: options.warmupRequests,
      concurrency: Math.min(8, options.maxOutstanding),
      timeoutMs: options.requestTimeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      requestHeaders,
      signal,
    });
    throwIfAborted(signal);

    if (options.managed) {
      managedAuthRemainingAtMeasurementStartMs = Math.max(0, gateway.authExpiresAtMs - Date.now());
      managedAuthRequiredAtMeasurementStartMs = options.durationMs
        + options.requestTimeoutMs
        + AUTH_POST_SOAK_ALLOWANCE_MS;
      if (managedAuthRemainingAtMeasurementStartMs < managedAuthRequiredAtMeasurementStartMs) {
        const error = new Error("Managed authentication does not cover measurement, request drain, and post-soak verification.");
        error.code = "MANAGED_AUTH_WINDOW_INSUFFICIENT";
        throw error;
      }
    }

    progress.phase = "measurement";
    await captureResourceSample({ metricsUrl, requestHeaders, samples, sampleFailures, started: overallStarted, signal });
    const sampler = sampleResourcesForDuration({
      metricsUrl,
      requestHeaders,
      samples,
      sampleFailures,
      started: overallStarted,
      durationMs: options.durationMs,
      sampleIntervalMs: options.sampleIntervalMs,
      signal,
    });
    const workloadPromise = executeOpenLoop({
      endpointUrl,
      durationMs: options.durationMs,
      targetRps: options.targetRps,
      maxOutstanding: options.maxOutstanding,
      timeoutMs: options.requestTimeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      requestHeaders,
      signal,
      progress,
    });
    const [workloadResult] = await Promise.all([workloadPromise, sampler]);
    workload = workloadResult;
    throwIfAborted(signal);
    await captureResourceSample({ metricsUrl, requestHeaders, samples, sampleFailures, started: overallStarted, signal });
    resources = summarizeResources(samples, sampleFailures);
    progress.phase = "post-soak-verification";
    postSoak = await verifyPostSoak({
      baseUrl: gateway?.baseUrl ?? null,
      endpointUrl,
      timeoutMs: options.requestTimeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      requestHeaders,
      signal,
      managed: options.managed,
    });
  } catch (error) {
    fatalError = normalizeError(error);
  } finally {
    progress.phase = "cleanup";
    if (gateway) managedGatewayCleanedUp = await stopManagedGateway(gateway);
  }
  progress.phase = "finalizing";
  progress.finalStatus = fatalError ? "failed" : "finalizing";
  await checkpointWriter.stop();
  const checkpointStats = checkpointWriter.stats();

  const checks = createChecks({
    options,
    health,
    warmup,
    workload,
    resources,
    postSoak,
    fatalError,
    managedGatewayCleanedUp,
    managedAuthValidityMs,
    managedAuthRemainingAtMeasurementStartMs,
    managedAuthRequiredAtMeasurementStartMs,
    checkpointError,
  });

  const report = {
    schemaVersion: 1,
    methodologyVersion: METHOD_VERSION,
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    startedAt,
    totalDurationMs: round(performance.now() - overallStarted),
    mode: options.managed ? "managed-local-fake" : "external-observation",
    source: {
      candidateSha: options.candidateSha,
      workflowRunId: options.workflowRunId,
      workflowRunAttempt: options.workflowRunAttempt,
    },
    target: {
      endpoint: sanitizeTarget(endpointUrl),
      metrics: sanitizeTarget(metricsUrl),
      model: options.model,
      managed: options.managed,
      providerCredentialsSupported: false,
      gatewayAuthenticationSupported: true,
    },
    workloadConfig: {
      arrivalModel: "open-loop-fixed-rate",
      durationMs: options.durationMs,
      targetRps: options.targetRps,
      maxOutstanding: options.maxOutstanding,
      warmupRequests: options.warmupRequests,
      sampleIntervalMs: options.sampleIntervalMs,
      requestTimeoutMs: options.requestTimeoutMs,
    },
    thresholds: {
      minArrivalRatio: options.minArrivalRatio,
      maxErrorRate: options.maxErrorRate,
      maxHeapGrowthBytes: options.maxHeapGrowthBytes,
      maxRssGrowthBytes: options.maxRssGrowthBytes,
      maxMemoryGrowthRatio: options.maxMemoryGrowthRatio,
      maxEventLoopP99Seconds: options.maxEventLoopP99Seconds,
      maxEventLoopUtilization: options.maxEventLoopUtilization,
      maxHeapTrendBytesPerMinute: options.maxHeapTrendBytesPerMinute,
      maxRssTrendBytesPerMinute: options.maxRssTrendBytesPerMinute,
      memoryGrowthGateMode: options.durationMs >= LONG_RUN_THRESHOLD_MS
        ? "absolute-and-relative"
        : "absolute-or-relative",
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
      realProviderCallsMade: options.managed ? false : null,
      credentialEnvironmentForwarded: false,
      gatewayAuthenticationEnabled: gatewayAuthSource !== "none",
      gatewayAuthSource,
      gatewayAuthTokenExposed: false,
      persistentCredentialStoreRead: false,
      runtimeCredentialStoreMode: options.managed ? "memory" : "unknown",
      gatewayAuthValidityMs: managedAuthValidityMs,
      gatewayAuthRemainingAtMeasurementStartMs: managedAuthRemainingAtMeasurementStartMs,
      gatewayAuthRequiredAtMeasurementStartMs: managedAuthRequiredAtMeasurementStartMs,
      gatewayAuthPostSoakAllowanceMs: AUTH_POST_SOAK_ALLOWANCE_MS,
      managedGatewayCleanedUp,
    },
    checkpoint: {
      methodologyVersion: CHECKPOINT_METHOD_VERSION,
      intervalMs: options.checkpointIntervalMs,
      writesSucceeded: checkpointError === null,
      requestedWrites: checkpointStats.requestedWrites,
      completedWrites: checkpointStats.completedWrites,
      coalescedWrites: checkpointStats.coalescedWrites,
      maxConcurrentWrites: checkpointStats.maxConcurrentWrites,
      error: checkpointError,
    },
    warmup,
    workload,
    resources,
    postSoak,
    checks,
    issueCodes: checks.filter((check) => !check.passed).map((check) => check.code),
    fatalError,
    comparisonBoundary: "The CI profile is a short resource-regression gate on one host. A long run provides bounded release evidence for this exact commit, host, and workload, but does not independently prove production capacity or superiority.",
  };
  progress.phase = "complete";
  progress.finalStatus = report.status;
  return report;
}

async function startManagedGateway(options) {
  const port = await reserveFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const authToken = randomBytes(32).toString("base64url");
  const authValidityMs = options.durationMs + options.requestTimeoutMs + AUTH_TTL_BUFFER_MS;
  const authExpiresAtMs = Date.now() + authValidityMs;
  const authExpiresAt = new Date(authExpiresAtMs).toISOString();
  const requestHeaders = Object.freeze({ Authorization: `Bearer ${authToken}` });
  const isolatedStateRoot = resolve(repoRoot, ".tmp", `gateway-resource-soak-state-${port}`);
  const child = spawn(process.execPath, [serviceEntrypoint], {
    cwd: serviceRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...createMinimalChildEnvironment(process.env),
      AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
      AI_GATEWAY_SERVICE_PORT: String(port),
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ROUTE_MODE: "registry-default",
      AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1,::1,::ffff:127.0.0.1",
      AI_GATEWAY_MAX_IN_FLIGHT_REQUESTS: String(Math.max(64, options.maxOutstanding * 2)),
      AI_GATEWAY_MAX_REQUEST_BODY_BYTES: "4096",
      AI_GATEWAY_USAGE_LOG_DIR: resolve(repoRoot, ".tmp", `gateway-resource-soak-${port}`),
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: "",
      PME_ENTERPRISE_USERS_JSON: JSON.stringify([{
        token: authToken,
        userId: "gateway-resource-soak",
        tenantId: "gateway-resource-soak",
        role: "operator",
        permissions: ["chat:use", "dashboard:read", "session:read"],
        expiresAt: authExpiresAt,
      }]),
      PME_ENTERPRISE_USER_STORE_PATH: resolve(isolatedStateRoot, "enterprise-users.json"),
      PME_AUDIT_LOG_PATH: resolve(isolatedStateRoot, "enterprise-audit.jsonl"),
      PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
    },
  });
  const state = { child, baseUrl, stdout: "", stderr: "", exitError: null, health: null, authValidityMs, authExpiresAtMs };
  Object.defineProperty(state, "privateRequestHeaders", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: requestHeaders,
  });
  child.stdout.on("data", (chunk) => { state.stdout = appendBounded(state.stdout, chunk.toString()); });
  child.stderr.on("data", (chunk) => { state.stderr = appendBounded(state.stderr, chunk.toString()); });
  child.once("error", (error) => { state.exitError = error; });
  try {
    state.health = await waitForHealth(state, 20_000);
    if (state.health.body?.data?.providerMode !== "fake" || state.health.body?.data?.realProviderEnabled !== false) {
      throw new Error("Managed gateway did not prove fake-only execution.");
    }
    await verifyAuthenticatedSession(baseUrl, requestHeaders);
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
    if (hasChildExited(state.child)) throw new Error(`Gateway exited before readiness. ${outputTail(state)}`);
    try {
      const response = await fetchJson(`${state.baseUrl}/health/check`, { timeoutMs: 1_000 });
      if (response.status === 200 && response.body?.data?.status === "ready") return response;
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

async function executeWarmup({ endpointUrl, requests, concurrency, timeoutMs, model, requireFakeExecution, requestHeaders, signal }) {
  const results = new Array(requests);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, requests) }, async () => {
    while (true) {
      throwIfAborted(signal);
      const sequence = cursor++;
      if (sequence >= requests) return;
      results[sequence] = await executeChat({ endpointUrl, timeoutMs, model, requireFakeExecution, requestHeaders, sequence, phase: "warmup", signal });
    }
  });
  await Promise.all(workers);
  return summarizeWorkload(results, requests, requests, 0, 0);
}

async function executeOpenLoop({ endpointUrl, durationMs, targetRps, maxOutstanding, timeoutMs, model, requireFakeExecution, requestHeaders, signal, progress }) {
  const accumulator = createWorkloadAccumulator();
  const pending = new Set();
  const schedulerLag = createMetricAccumulator();
  const startedAt = performance.now();
  const intervalMs = 1_000 / targetRps;
  let maxOutstandingObserved = 0;
  progress.workloadSnapshot = () => summarizeWorkloadAccumulator({
    accumulator,
    scheduled: accumulator.scheduled,
    started: accumulator.started,
    clientDropped: accumulator.clientDropped,
    wallDurationMs: performance.now() - startedAt,
    targetRps,
    maxOutstandingObserved,
    schedulerLag,
    aborted: signal?.aborted === true,
  });

  while (!signal?.aborted) {
    const targetAt = startedAt + accumulator.scheduled * intervalMs;
    if (targetAt - startedAt >= durationMs) break;
    const waitMs = targetAt - performance.now();
    if (waitMs > 0) await delay(waitMs, signal);
    if (signal?.aborted) break;
    recordMetric(schedulerLag, Math.max(0, performance.now() - targetAt));
    accumulator.scheduled += 1;
    if (pending.size >= maxOutstanding) {
      accumulator.clientDropped += 1;
      continue;
    }
    const sequence = accumulator.started++;
    const task = executeChat({ endpointUrl, timeoutMs, model, requireFakeExecution, requestHeaders, sequence, phase: "resource-soak", signal })
      .then((result) => { recordWorkloadResult(accumulator, result); })
      .finally(() => { pending.delete(task); });
    pending.add(task);
    maxOutstandingObserved = Math.max(maxOutstandingObserved, pending.size);
  }
  const measurementDeadline = startedAt + durationMs;
  while (!signal?.aborted && performance.now() < measurementDeadline) {
    await delay(measurementDeadline - performance.now(), signal);
  }
  await Promise.all(pending);
  const wallDurationMs = performance.now() - startedAt;
  return summarizeWorkloadAccumulator({
    accumulator,
    scheduled: accumulator.scheduled,
    started: accumulator.started,
    clientDropped: accumulator.clientDropped,
    wallDurationMs,
    targetRps,
    maxOutstandingObserved,
    schedulerLag,
    aborted: signal?.aborted === true,
  });
}

async function executeChat({ endpointUrl, timeoutMs, model, requireFakeExecution, requestHeaders, sequence, phase, signal }) {
  const started = performance.now();
  try {
    const response = await fetchJson(endpointUrl, {
      method: "POST",
      timeoutMs,
      headers: { ...requestHeaders, "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: `${phase} resource stability request ${sequence}` }],
      }),
    });
    const protocolValid = response.status === 200
      && response.body?.object === "chat.completion"
      && typeof response.body?.choices?.[0]?.message?.content === "string";
    const executionMode = response.body?.unified_ai?.execution_mode ?? null;
    const safetyValid = !requireFakeExecution || executionMode === "fake";
    return {
      latencyMs: performance.now() - started,
      status: response.status,
      ok: protocolValid && safetyValid,
      protocolValid,
      safetyValid,
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
      timedOut: normalized?.name === "AbortError" || normalized?.code === "REQUEST_TIMEOUT",
      transportError: normalized?.code ?? normalized?.name ?? "request_failed",
    };
  }
}

async function sampleResourcesForDuration({
  metricsUrl,
  requestHeaders,
  samples,
  sampleFailures,
  started,
  durationMs,
  sampleIntervalMs,
  signal,
}) {
  const samplingStarted = performance.now();
  const pendingSamples = new Set();
  for (let sampleIndex = 1; sampleIndex * sampleIntervalMs < durationMs && !signal?.aborted; sampleIndex += 1) {
    const targetAt = samplingStarted + sampleIndex * sampleIntervalMs;
    const waitMs = targetAt - performance.now();
    if (waitMs > 0) await delay(waitMs, signal);
    if (signal?.aborted) break;
    const task = captureResourceSample({
      metricsUrl,
      requestHeaders,
      samples,
      sampleFailures,
      started,
      signal,
    }).finally(() => { pendingSamples.delete(task); });
    pendingSamples.add(task);
  }
  await Promise.all([...pendingSamples]);
  samples.sort((left, right) => left.elapsedMs - right.elapsedMs);
  sampleFailures.sort((left, right) => left.elapsedMs - right.elapsedMs);
}

function summarizeWorkload(results, scheduled, started, clientDropped, wallDurationMs) {
  const accumulator = createWorkloadAccumulator();
  accumulator.scheduled = scheduled;
  accumulator.started = started;
  accumulator.clientDropped = clientDropped;
  for (const result of results) recordWorkloadResult(accumulator, result);
  return summarizeWorkloadAccumulator({
    accumulator,
    scheduled,
    started,
    clientDropped,
    wallDurationMs,
    targetRps: null,
    maxOutstandingObserved: null,
    schedulerLag: null,
    aborted: false,
  });
}

function createWorkloadAccumulator() {
  return {
    scheduled: 0,
    started: 0,
    clientDropped: 0,
    completed: 0,
    succeeded: 0,
    protocolValid: 0,
    safetyValid: 0,
    timeouts: 0,
    transportErrors: 0,
    statusCodes: {},
    latency: createMetricAccumulator(),
  };
}

function recordWorkloadResult(accumulator, result) {
  accumulator.completed += 1;
  if (result.ok) {
    accumulator.succeeded += 1;
    recordMetric(accumulator.latency, result.latencyMs);
  }
  if (result.protocolValid) accumulator.protocolValid += 1;
  if (result.safetyValid) accumulator.safetyValid += 1;
  if (result.timedOut) accumulator.timeouts += 1;
  if (result.transportError) accumulator.transportErrors += 1;
  const key = result.status === null ? "transport_error" : String(result.status);
  accumulator.statusCodes[key] = (accumulator.statusCodes[key] ?? 0) + 1;
}

function summarizeWorkloadAccumulator({
  accumulator,
  scheduled,
  started,
  clientDropped,
  wallDurationMs,
  targetRps,
  maxOutstandingObserved,
  schedulerLag,
  aborted,
}) {
  const failed = accumulator.completed - accumulator.succeeded;
  const wallSeconds = wallDurationMs / 1_000;
  return {
    scheduled,
    started,
    clientDropped,
    completed: accumulator.completed,
    succeeded: accumulator.succeeded,
    failed,
    protocolValid: accumulator.protocolValid,
    safetyValid: accumulator.safetyValid,
    timeouts: accumulator.timeouts,
    transportErrors: accumulator.transportErrors,
    errorRate: ratio(failed, accumulator.completed),
    protocolValidityRate: ratio(accumulator.protocolValid, accumulator.completed),
    wallDurationMs: round(wallDurationMs),
    latencyMs: summarizeMetricAccumulator(accumulator.latency),
    statusCodes: { ...accumulator.statusCodes },
    ...(targetRps === null ? {} : {
      targetRps,
      startedRps: wallSeconds > 0 ? round(started / wallSeconds) : 0,
      successfulRps: wallSeconds > 0 ? round(accumulator.succeeded / wallSeconds) : 0,
      arrivalRatio: ratio(started, scheduled),
      maxOutstandingObserved,
      schedulerLagMs: summarizeMetricAccumulator(schedulerLag),
      aborted,
    }),
  };
}

async function captureResourceSample({ metricsUrl, requestHeaders, samples, sampleFailures, started, signal }) {
  try {
    const response = await fetchText(metricsUrl, { headers: requestHeaders, timeoutMs: 2_000, signal });
    if (response.status !== 200) throw new Error(`Metrics returned HTTP ${response.status}.`);
    const metrics = parsePrometheus(response.body);
    samples.push({
      elapsedMs: round(performance.now() - started),
      rssBytes: requiredMetric(metrics, "ai_gateway_memory_usage_bytes", { type: "rss" }),
      heapUsedBytes: requiredMetric(metrics, "ai_gateway_memory_usage_bytes", { type: "heapUsed" }),
      externalBytes: requiredMetric(metrics, "ai_gateway_memory_usage_bytes", { type: "external" }),
      arrayBuffersBytes: requiredMetric(metrics, "ai_gateway_memory_usage_bytes", { type: "arrayBuffers" }),
      cpuUserSeconds: requiredMetric(metrics, "ai_gateway_process_cpu_seconds_total", { mode: "user" }),
      cpuSystemSeconds: requiredMetric(metrics, "ai_gateway_process_cpu_seconds_total", { mode: "system" }),
      eventLoopUtilizationRatio: requiredMetric(metrics, "ai_gateway_event_loop_utilization_ratio"),
      eventLoopDelayP99Seconds: requiredMetric(metrics, "ai_gateway_event_loop_delay_seconds", { quantile: "0.99" }),
      eventLoopDelayMaxSeconds: requiredMetric(metrics, "ai_gateway_event_loop_delay_max_seconds"),
      eventLoopDelaySamples: requiredMetric(metrics, "ai_gateway_event_loop_delay_seconds_count"),
    });
  } catch (error) {
    sampleFailures.push({ elapsedMs: round(performance.now() - started), error: normalizeError(error) });
  }
}

async function primeResourceMonitor(metricsUrl, requestHeaders) {
  const response = await fetchText(metricsUrl, { headers: requestHeaders, timeoutMs: 2_000 });
  if (response.status !== 200) throw new Error(`Metrics prime returned HTTP ${response.status}.`);
  const metrics = parsePrometheus(response.body);
  requiredMetric(metrics, "ai_gateway_event_loop_utilization_ratio");
  requiredMetric(metrics, "ai_gateway_event_loop_delay_seconds_count");
}

async function verifyPostSoak({
  baseUrl,
  endpointUrl,
  timeoutMs,
  model,
  requireFakeExecution,
  requestHeaders,
  signal,
  managed,
}) {
  if (!managed) {
    return {
      required: false,
      status: "not-required-for-external-observation",
      healthReady: null,
      chatValid: null,
    };
  }
  throwIfAborted(signal);
  const health = await fetchJson(`${baseUrl}/health/check`, {
    headers: requestHeaders,
    timeoutMs: Math.min(timeoutMs, 2_000),
    signal,
  });
  const chat = await executeChat({
    endpointUrl,
    timeoutMs,
    model,
    requireFakeExecution,
    requestHeaders,
    sequence: -1,
    phase: "post-soak",
    signal,
  });
  return {
    required: true,
    status: health.status === 200 && health.body?.data?.status === "ready" && chat.ok
      ? "passed"
      : "failed",
    healthReady: health.status === 200 && health.body?.data?.status === "ready",
    healthStatusCode: health.status,
    chatValid: chat.ok,
    chatProtocolValid: chat.protocolValid,
    chatSafetyValid: chat.safetyValid,
    chatLatencyMs: round(chat.latencyMs),
  };
}

function summarizeResources(samples, failures) {
  if (samples.length === 0) return { samples: [], sampleCount: 0, sampleFailures: failures, sampleFailureCount: failures.length };
  const edgeCount = Math.min(3, samples.length);
  const first = samples.slice(0, edgeCount);
  const last = samples.slice(-edgeCount);
  const heapInitial = median(first.map((sample) => sample.heapUsedBytes));
  const heapFinal = median(last.map((sample) => sample.heapUsedBytes));
  const rssInitial = median(first.map((sample) => sample.rssBytes));
  const rssFinal = median(last.map((sample) => sample.rssBytes));
  const firstSample = samples[0];
  const lastSample = samples.at(-1);
  return {
    sampleCount: samples.length,
    sampleFailureCount: failures.length,
    sampleFailures: failures,
    memory: {
      heapUsed: summarizeGrowth(samples, "heapUsedBytes", heapInitial, heapFinal),
      rss: summarizeGrowth(samples, "rssBytes", rssInitial, rssFinal),
      externalMaxBytes: extremeSampleValue(samples, "externalBytes", Math.max),
      arrayBuffersMaxBytes: extremeSampleValue(samples, "arrayBuffersBytes", Math.max),
    },
    cpuSecondsDelta: round(Math.max(0,
      lastSample.cpuUserSeconds + lastSample.cpuSystemSeconds
      - firstSample.cpuUserSeconds - firstSample.cpuSystemSeconds,
    )),
    eventLoop: {
      utilizationMaxRatio: extremeSampleValue(samples, "eventLoopUtilizationRatio", Math.max),
      delayP99MaxSeconds: extremeSampleValue(samples, "eventLoopDelayP99Seconds", Math.max),
      delayMaxSeconds: extremeSampleValue(samples, "eventLoopDelayMaxSeconds", Math.max),
      finalDelaySampleCount: lastSample.eventLoopDelaySamples,
    },
    samples,
  };
}

function summarizeGrowth(samples, field, initialBytes, finalBytes) {
  const growthBytes = finalBytes - initialBytes;
  const maxBytes = extremeSampleValue(samples, field, Math.max);
  return {
    initialMedianBytes: round(initialBytes),
    finalMedianBytes: round(finalBytes),
    growthBytes: round(growthBytes),
    growthRatio: initialBytes > 0 ? round(growthBytes / initialBytes) : 0,
    minBytes: extremeSampleValue(samples, field, Math.min),
    maxBytes,
    peakIncreaseBytes: round(maxBytes - initialBytes),
    trendBytesPerMinute: round(linearSlope(samples.map((sample) => [sample.elapsedMs, sample[field]])) * 60_000),
  };
}

function extremeSampleValue(samples, field, choose) {
  let value = samples[0][field];
  for (let index = 1; index < samples.length; index += 1) {
    value = choose(value, samples[index][field]);
  }
  return value;
}

function createChecks({ options, health, warmup, workload, resources, postSoak, fatalError, managedGatewayCleanedUp, managedAuthValidityMs, managedAuthRemainingAtMeasurementStartMs, managedAuthRequiredAtMeasurementStartMs, checkpointError }) {
  const expectedSamples = Math.max(2, Math.floor(options.durationMs / options.sampleIntervalMs));
  const minimumSamples = Math.max(2, Math.floor(expectedSamples * 0.8));
  const longRun = options.durationMs >= LONG_RUN_THRESHOLD_MS;
  const memoryWithin = (summary, maxBytes) => {
    if (!summary) return false;
    const absoluteWithin = summary.growthBytes <= maxBytes;
    const relativeWithin = summary.growthRatio <= options.maxMemoryGrowthRatio;
    return longRun ? absoluteWithin && relativeWithin : absoluteWithin || relativeWithin;
  };
  const longMemoryWithin = (summary, maxBytes, maxTrendBytesPerMinute) => memoryWithin(summary, maxBytes)
    && summary.peakIncreaseBytes <= maxBytes
    && summary.trendBytesPerMinute <= maxTrendBytesPerMinute;
  const memoryExpectation = (label, maxBytes, maxTrendBytesPerMinute) => longRun
    ? `${label} final growth and peak increase <= ${maxBytes} bytes, ratio <= ${options.maxMemoryGrowthRatio}, and positive trend <= ${maxTrendBytesPerMinute} bytes/minute`
    : `${label} growth <= ${maxBytes} bytes or ratio <= ${options.maxMemoryGrowthRatio}`;
  const checks = [
    check("benchmark_completed", fatalError === null, "benchmark completes without a fatal error", fatalError?.message ?? "complete"),
    check("checkpoint_writes_succeeded", checkpointError === null, "atomic progress checkpoints remain writable", checkpointError?.message ?? "complete"),
    check("warmup_healthy", warmup?.failed === 0, "warmup completes without failures", warmup?.failed ?? null),
    check("workload_completed", workload?.completed === workload?.started, "every started request completes", workload ? { started: workload.started, completed: workload.completed } : null),
    check("workload_pressure_sufficient", workload?.arrivalRatio >= options.minArrivalRatio, `bounded client starts at least ${options.minArrivalRatio} of fixed arrivals`, workload ? { arrivalRatio: workload.arrivalRatio, clientDropped: workload.clientDropped } : null),
    check("workload_error_rate", workload?.errorRate <= options.maxErrorRate, `error rate <= ${options.maxErrorRate}`, workload?.errorRate ?? null),
    check("workload_protocol_valid", workload?.protocolValidityRate === 1, "all completed responses satisfy the OpenAI contract", workload?.protocolValidityRate ?? null),
    check("resource_samples_complete", resources?.sampleCount >= minimumSamples && resources?.sampleFailureCount === 0, `at least ${minimumSamples} resource samples and zero scrape failures`, resources ? { samples: resources.sampleCount, failures: resources.sampleFailureCount } : null),
    check("heap_growth_bounded", longRun ? longMemoryWithin(resources?.memory?.heapUsed, options.maxHeapGrowthBytes, options.maxHeapTrendBytesPerMinute) : memoryWithin(resources?.memory?.heapUsed, options.maxHeapGrowthBytes), memoryExpectation("heap", options.maxHeapGrowthBytes, options.maxHeapTrendBytesPerMinute), resources?.memory?.heapUsed ?? null),
    check("rss_growth_bounded", longRun ? longMemoryWithin(resources?.memory?.rss, options.maxRssGrowthBytes, options.maxRssTrendBytesPerMinute) : memoryWithin(resources?.memory?.rss, options.maxRssGrowthBytes), memoryExpectation("RSS", options.maxRssGrowthBytes, options.maxRssTrendBytesPerMinute), resources?.memory?.rss ?? null),
    check("event_loop_delay_sampled", resources?.eventLoop?.finalDelaySampleCount > 0, "event-loop delay histogram contains samples", resources?.eventLoop?.finalDelaySampleCount ?? null),
    check("event_loop_delay_bounded", resources?.eventLoop?.delayP99MaxSeconds <= options.maxEventLoopP99Seconds, `event-loop delay p99 <= ${options.maxEventLoopP99Seconds}s`, resources?.eventLoop?.delayP99MaxSeconds ?? null),
    check("event_loop_utilization_bounded", resources?.eventLoop?.utilizationMaxRatio <= options.maxEventLoopUtilization, `event-loop utilization <= ${options.maxEventLoopUtilization}`, resources?.eventLoop?.utilizationMaxRatio ?? null),
  ];
  if (options.managed) {
    const safeHealth = {
      providerMode: health?.body?.data?.providerMode ?? null,
      realProviderEnabled: health?.body?.data?.realProviderEnabled ?? null,
    };
    checks.push(
      check("managed_fake_only", safeHealth.providerMode === "fake" && safeHealth.realProviderEnabled === false && workload?.safetyValid === workload?.started, "managed workload remains fake-only", safeHealth),
      check(
        "managed_auth_valid_for_run",
        Number.isFinite(managedAuthRemainingAtMeasurementStartMs)
          && Number.isFinite(managedAuthRequiredAtMeasurementStartMs)
          && managedAuthRemainingAtMeasurementStartMs >= managedAuthRequiredAtMeasurementStartMs,
        "authentication remaining at measurement start covers measurement, request drain, and post-soak verification",
        {
          originalValidityMs: managedAuthValidityMs,
          remainingAtMeasurementStartMs: managedAuthRemainingAtMeasurementStartMs,
          requiredAtMeasurementStartMs: managedAuthRequiredAtMeasurementStartMs,
        },
      ),
      check("post_soak_health_ready", postSoak?.healthReady === true, "managed gateway remains ready after the measured workload", postSoak?.healthReady ?? null),
      check("post_soak_chat_valid", postSoak?.chatValid === true && postSoak?.chatProtocolValid === true && postSoak?.chatSafetyValid === true, "managed gateway completes one protocol-valid fake chat after the measured workload", postSoak ?? null),
      check("managed_gateway_cleaned_up", managedGatewayCleanedUp === true, "managed gateway exits after the soak", managedGatewayCleanedUp),
    );
  }
  return checks;
}

function parsePrometheus(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_:][A-Za-z0-9_:]*)(?:\{([^}]*)\})?\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)$/);
    if (!match) continue;
    const labels = {};
    const labelPattern = /([A-Za-z_][A-Za-z0-9_]*)="((?:\\.|[^"\\])*)"/g;
    for (const label of match[2]?.matchAll(labelPattern) ?? []) labels[label[1]] = label[2].replace(/\\([\\"n])/g, "$1");
    entries.push({ name: match[1], labels, value: Number(match[3]) });
  }
  return entries;
}

function requiredMetric(entries, name, labels = {}) {
  const entry = entries.find((candidate) => candidate.name === name
    && Object.entries(labels).every(([key, value]) => candidate.labels[key] === value));
  if (!entry || !Number.isFinite(entry.value)) {
    const suffix = Object.keys(labels).length > 0 ? ` ${JSON.stringify(labels)}` : "";
    throw new Error(`Required metric ${name}${suffix} was not found.`);
  }
  return entry.value;
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { status: response.status, body };
}

async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  return { status: response.status, body: await response.text() };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const forwardAbort = () => controller.abort(externalSignal?.reason ?? new Error("Request aborted."));
  if (externalSignal?.aborted) forwardAbort();
  else externalSignal?.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("Request timeout.")), options.timeoutMs ?? 5_000);
  timer.unref?.();
  try {
    return await fetch(url, {
      ...options,
      redirect: "error",
      signal: controller.signal,
      timeoutMs: undefined,
    });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }
}

function createConfig(args, env = {}) {
  const profileName = args.profile ?? (args.target ? "observe" : "ci");
  const profile = PROFILES[profileName];
  if (!profile) throw new Error(`Unsupported profile: ${profileName}`);
  const managed = !args.target;
  const target = managed ? null : validateUrl(args.target, "target");
  const metricsUrl = managed ? null : validateUrl(args.metricsUrl, "metrics-url");
  const authToken = readGatewayAuthToken(env.AI_GATEWAY_RESOURCE_SOAK_AUTH_TOKEN);
  if (!managed && authToken) {
    assertSafeGatewayAuthTargets(target, metricsUrl);
  }
  const config = {
    profile: profileName,
    managed,
    target,
    metricsUrl,
    model: args.model ?? "local-fake-model",
    durationMs: parseDuration(args.duration, profile.durationMs),
    targetRps: parsePositiveNumber(args.rate, profile.targetRps, "rate"),
    maxOutstanding: parsePositiveInteger(args.maxOutstanding, profile.maxOutstanding, "max-outstanding"),
    warmupRequests: parsePositiveInteger(args.warmup, profile.warmupRequests, "warmup"),
    sampleIntervalMs: parseDuration(args.sampleInterval, profile.sampleIntervalMs),
    requestTimeoutMs: parseDuration(args.timeout, profile.requestTimeoutMs),
    minArrivalRatio: parseRatio(args.minArrivalRatio, profile.minArrivalRatio, "min-arrival-ratio"),
    maxErrorRate: parseRatio(args.maxErrorRate, profile.maxErrorRate, "max-error-rate"),
    maxHeapGrowthBytes: parseNonNegativeNumber(args.maxHeapGrowthBytes, profile.maxHeapGrowthBytes, "max-heap-growth-bytes"),
    maxRssGrowthBytes: parseNonNegativeNumber(args.maxRssGrowthBytes, profile.maxRssGrowthBytes, "max-rss-growth-bytes"),
    maxMemoryGrowthRatio: parseRatio(args.maxMemoryGrowthRatio, profile.maxMemoryGrowthRatio, "max-memory-growth-ratio"),
    maxEventLoopP99Seconds: parseDuration(args.maxEventLoopP99, profile.maxEventLoopP99Seconds * 1_000) / 1_000,
    maxEventLoopUtilization: parseRatio(args.maxEventLoopUtilization, profile.maxEventLoopUtilization, "max-event-loop-utilization"),
    output: resolve(args.output ?? DEFAULT_OUTPUT),
    checkpointIntervalMs: parseDuration(args.checkpointInterval, DEFAULT_CHECKPOINT_INTERVAL_MS),
    candidateSha: parseCandidateSha(args.candidateSha),
    workflowRunId: parseRunIdentity(args.workflowRunId, "workflow-run-id"),
    workflowRunAttempt: parseRunIdentity(args.workflowRunAttempt, "workflow-run-attempt"),
    json: args.json === true,
    gatewayAuthSource: authToken ? "environment" : "none",
  };
  config.checkpointOutput = checkpointPathFor(config.output);
  const durationMinutes = config.durationMs / 60_000;
  config.maxHeapTrendBytesPerMinute = round(config.maxHeapGrowthBytes / durationMinutes);
  config.maxRssTrendBytesPerMinute = round(config.maxRssGrowthBytes / durationMinutes);
  if (config.durationMs > MAX_DURATION_MS) {
    throw new Error(`duration must not exceed ${MAX_DURATION_MS}ms.`);
  }
  if (Math.ceil(config.durationMs / config.sampleIntervalMs) > MAX_RESOURCE_SAMPLES) {
    throw new Error(`duration/sample-interval must not exceed ${MAX_RESOURCE_SAMPLES} resource samples.`);
  }
  if (config.maxOutstanding > 10_000) {
    throw new Error("max-outstanding must not exceed 10000.");
  }
  if (config.warmupRequests > MAX_WARMUP_REQUESTS) {
    throw new Error(`warmup must not exceed ${MAX_WARMUP_REQUESTS}.`);
  }
  Object.defineProperty(config, "privateRequestHeaders", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  });
  return config;
}

function readGatewayAuthToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) return null;
  if (token.length < 32) {
    throw new Error("AI_GATEWAY_RESOURCE_SOAK_AUTH_TOKEN must contain at least 32 characters.");
  }
  return token;
}

function assertSafeGatewayAuthTargets(target, metricsUrl) {
  const targetUrl = new URL(target);
  const metrics = new URL(metricsUrl);
  if (targetUrl.origin !== metrics.origin) {
    throw new Error("Authenticated resource-soak target and metrics URL must have the same origin.");
  }
  if (targetUrl.protocol === "https:") return;
  if (!new Set(["127.0.0.1", "::1", "[::1]"]).has(targetUrl.hostname.toLowerCase())) {
    throw new Error("AI_GATEWAY_RESOURCE_SOAK_AUTH_TOKEN requires HTTPS for non-loopback targets.");
  }
}

async function verifyAuthenticatedSession(baseUrl, requestHeaders) {
  const response = await fetchJson(`${baseUrl}/enterprise/session`, {
    headers: requestHeaders,
    timeoutMs: 2_000,
  });
  if (response.status !== 200 || (response.body?.data ?? response.body)?.authenticated !== true) {
    throw new Error(`Gateway authentication check failed with HTTP ${response.status}.`);
  }
}

function parseArgs(argv) {
  const result = {};
  const names = {
    "--profile": "profile", "--target": "target", "--metrics-url": "metricsUrl", "--model": "model",
    "--duration": "duration", "--rate": "rate", "--max-outstanding": "maxOutstanding", "--warmup": "warmup",
    "--sample-interval": "sampleInterval", "--timeout": "timeout", "--min-arrival-ratio": "minArrivalRatio",
    "--max-error-rate": "maxErrorRate", "--max-heap-growth-bytes": "maxHeapGrowthBytes",
    "--max-rss-growth-bytes": "maxRssGrowthBytes", "--max-memory-growth-ratio": "maxMemoryGrowthRatio",
    "--max-event-loop-p99": "maxEventLoopP99", "--max-event-loop-utilization": "maxEventLoopUtilization",
    "--checkpoint-interval": "checkpointInterval", "--candidate-sha": "candidateSha",
    "--workflow-run-id": "workflowRunId", "--workflow-run-attempt": "workflowRunAttempt", "--output": "output",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--json") { result.json = true; continue; }
    if (arg === "--help" || arg === "-h") { result.help = true; continue; }
    const name = names[arg];
    if (!name) throw new Error(`Unknown option: ${arg}`);
    const value = argv[++index];
    if (value === undefined) throw new Error(`Missing value for ${arg}`);
    result[name] = value;
  }
  return result;
}

function validateUrl(raw, name) {
  if (!raw) throw new Error(`--${name} is required for an external run.`);
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`--${name} must be an HTTP(S) URL without credentials, query, or fragment.`);
  }
  return parsed.toString();
}

function parseDuration(value, fallback) {
  if (value === undefined) return fallback;
  const match = String(value).match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const factor = match[2] === "h" ? 3_600_000 : match[2] === "m" ? 60_000 : match[2] === "s" ? 1_000 : 1;
  const duration = Number(match[1]) * factor;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Duration must be positive: ${value}`);
  return Math.round(duration);
}

function parseCandidateSha(value) {
  if (value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(normalized)) {
    throw new Error("--candidate-sha must be a complete 40-character hexadecimal commit SHA.");
  }
  return normalized;
}

function parseRunIdentity(value, name) {
  if (value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim();
  if (!/^[1-9]\d{0,19}$/.test(normalized)) {
    throw new Error(`--${name} must be a positive decimal identifier.`);
  }
  return normalized;
}

function checkpointPathFor(output) {
  return output.toLowerCase().endsWith(".json")
    ? `${output.slice(0, -5)}.partial.json`
    : `${output}.partial.json`;
}

function parsePositiveInteger(value, fallback, name) {
  const parsed = parsePositiveNumber(value, fallback, name);
  if (!Number.isInteger(parsed)) throw new Error(`--${name} must be an integer.`);
  return parsed;
}

function parsePositiveNumber(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be positive.`);
  return parsed;
}

function parseNonNegativeNumber(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be non-negative.`);
  return parsed;
}

function parseRatio(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error(`--${name} must be between 0 and 1.`);
  return parsed;
}

function summarizeMetric(values) {
  const accumulator = createMetricAccumulator(Math.max(1, values.length));
  for (const value of values) recordMetric(accumulator, value);
  return summarizeMetricAccumulator(accumulator);
}

function createMetricAccumulator(limit = METRIC_RESERVOIR_LIMIT) {
  return {
    count: 0,
    sum: 0,
    min: null,
    max: null,
    limit,
    retained: [],
  };
}

function recordMetric(accumulator, value) {
  if (!Number.isFinite(value)) return;
  accumulator.count += 1;
  accumulator.sum += value;
  accumulator.min = accumulator.min === null ? value : Math.min(accumulator.min, value);
  accumulator.max = accumulator.max === null ? value : Math.max(accumulator.max, value);
  if (accumulator.retained.length < accumulator.limit) {
    accumulator.retained.push(value);
    return;
  }
  const candidate = deterministicReservoirIndex(accumulator.count);
  if (candidate < accumulator.limit) accumulator.retained[candidate] = value;
}

function deterministicReservoirIndex(count) {
  let value = count >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) % count;
}

function summarizeMetricAccumulator(accumulator) {
  if (!accumulator || accumulator.count === 0) {
    return {
      samples: 0,
      retainedSamples: 0,
      approximate: false,
      min: null,
      mean: null,
      p50: null,
      p95: null,
      p99: null,
      max: null,
    };
  }
  const sorted = [...accumulator.retained].sort((a, b) => a - b);
  return {
    samples: accumulator.count,
    retainedSamples: sorted.length,
    approximate: accumulator.count > sorted.length,
    min: round(accumulator.min),
    mean: round(accumulator.sum / accumulator.count),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(accumulator.max),
  };
}

function percentile(sorted, quantile) {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(quantile * sorted.length) - 1))];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function linearSlope(points) {
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const [x, y] of points) {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

async function reserveFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

function createMinimalChildEnvironment(env) {
  const allowed = new Set([
    "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE",
    "LOCALAPPDATA", "APPDATA", "NODE_OPTIONS", "NODE_PATH", "CI", "GITHUB_ACTIONS", "FORCE_COLOR", "NO_COLOR",
  ]);
  return Object.fromEntries(Object.entries(env).filter(([name, value]) => allowed.has(name) && value !== undefined));
}

function hasChildExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForChildExit(child, timeoutMs) {
  if (hasChildExited(child)) return;
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    delay(timeoutMs),
  ]);
}

function appendBounded(current, next) {
  const combined = current + next;
  return combined.length <= OUTPUT_TAIL_LIMIT ? combined : combined.slice(-OUTPUT_TAIL_LIMIT);
}

function outputTail(gateway) {
  return (gateway.stdout + "\n" + gateway.stderr).trim().slice(-4_000);
}

function sanitizeTarget(raw) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "invalid";
  }
}

function createCheckpoint({
  options,
  startedAt,
  overallStarted,
  progress,
  samples,
  sampleFailures,
  fatalError,
  managedGatewayCleanedUp,
  signal,
}) {
  const lastSample = samples.at(-1) ?? null;
  return {
    schemaVersion: 1,
    methodologyVersion: CHECKPOINT_METHOD_VERSION,
    status: signal?.aborted ? "aborted" : progress.finalStatus ?? "running",
    generatedAt: new Date().toISOString(),
    startedAt,
    elapsedMs: round(performance.now() - overallStarted),
    phase: progress.phase,
    source: {
      candidateSha: options.candidateSha,
      workflowRunId: options.workflowRunId,
      workflowRunAttempt: options.workflowRunAttempt,
    },
    workloadConfig: {
      durationMs: options.durationMs,
      targetRps: options.targetRps,
      maxOutstanding: options.maxOutstanding,
      sampleIntervalMs: options.sampleIntervalMs,
    },
    workload: progress.workloadSnapshot?.() ?? null,
    resources: {
      sampleCount: samples.length,
      sampleFailureCount: sampleFailures.length,
      lastSample,
    },
    safety: {
      managed: options.managed,
      providerMode: options.managed ? "fake" : "unknown",
      realProviderEnabled: options.managed ? false : null,
      providerCredentialsSupported: false,
      managedGatewayCleanedUp,
    },
    fatalError,
  };
}

function startCheckpointWriter({ intervalMs, output, snapshot, onError }) {
  let inFlight = null;
  let pending = false;
  let stopped = false;
  let requestedWrites = 0;
  let completedWrites = 0;
  let coalescedWrites = 0;
  let activeWrites = 0;
  let maxConcurrentWrites = 0;

  const drain = async () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      do {
        pending = false;
        let value;
        try {
          value = snapshot();
        } catch (error) {
          onError(error);
          continue;
        }
        activeWrites += 1;
        maxConcurrentWrites = Math.max(maxConcurrentWrites, activeWrites);
        try {
          await writeReport(output, value);
          completedWrites += 1;
        } catch (error) {
          onError(error);
        } finally {
          activeWrites -= 1;
        }
      } while (pending);
    })();
    try {
      await inFlight;
    } finally {
      inFlight = null;
      if (pending && !stopped) await drain();
    }
  };

  const writeNow = () => {
    if (stopped) return Promise.resolve();
    requestedWrites += 1;
    if (inFlight || pending) coalescedWrites += 1;
    pending = true;
    return drain();
  };
  const timer = setInterval(() => { void writeNow(); }, intervalMs);
  timer.unref?.();
  return {
    writeNow,
    async stop() {
      clearInterval(timer);
      await writeNow();
      while (inFlight || pending) await drain();
      stopped = true;
    },
    stats() {
      return { requestedWrites, completedWrites, coalescedWrites, maxConcurrentWrites };
    },
  };
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : Object.assign(new Error("Gateway resource soak aborted."), { code: "RUN_ABORTED" });
}

function normalizeError(error) {
  if (!error) return null;
  return { name: error.name ?? "Error", code: error.code ?? null, message: error.message ?? String(error) };
}

async function writeReport(path, report) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function check(code, passed, expectation, actual) {
  return { code, passed: passed === true, expectation, actual };
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : 0;
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function delay(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolveDelay) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolveDelay();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolveDelay();
    }, Math.max(0, ms));
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function printSummary(report, output) {
  process.stdout.write(`Gateway resource soak: ${report.status}\n`);
  if (report.workload) process.stdout.write(`Load: ${report.workload.succeeded}/${report.workload.started} at ${report.workload.successfulRps} RPS\n`);
  if (report.resources?.memory) {
    process.stdout.write(`Heap growth: ${report.resources.memory.heapUsed.growthBytes} bytes; RSS growth: ${report.resources.memory.rss.growthBytes} bytes\n`);
    process.stdout.write(`Event loop: p99 max=${report.resources.eventLoop.delayP99MaxSeconds}s, utilization max=${report.resources.eventLoop.utilizationMaxRatio}\n`);
  }
  process.stdout.write(`Evidence: ${output}\n`);
}

function printHelp() {
  process.stdout.write(`Credential-free-provider gateway resource stability soak.\n\nUsage:\n  node tools/gateway-resource-soak.mjs [options]\n\nOptions:\n  --profile <ci|observe>              ci defaults to 12s; observe defaults to 5m.\n  --target <chat-url>                 External chat endpoint; defaults to managed fake gateway.\n  --metrics-url <url>                 Required metrics endpoint for an external run.\n  --duration <ms|s|m|h>               Measurement duration.\n  --rate <rps>                        Fixed request arrival rate.\n  --max-outstanding <count>           Client outstanding request cap.\n  --warmup <count>                    Warmup requests before the baseline.\n  --sample-interval <ms|s|m>          Metrics scrape interval.\n  --checkpoint-interval <ms|s|m>      Atomic partial-evidence interval (default 5m).\n  --candidate-sha <40-hex>            Immutable commit bound into the evidence.\n  --workflow-run-id <decimal>         Workflow run identity bound into the evidence.\n  --workflow-run-attempt <decimal>    Workflow attempt bound into the evidence.\n  --timeout <ms|s>                    Per-request timeout.\n  --min-arrival-ratio <0..1>          Minimum started/scheduled ratio.\n  --max-error-rate <0..1>             Maximum workload error rate.\n  --max-heap-growth-bytes <bytes>      Absolute heap-growth allowance.\n  --max-rss-growth-bytes <bytes>       Absolute RSS-growth allowance.\n  --max-memory-growth-ratio <0..1>     Relative memory-growth allowance.\n  --max-event-loop-p99 <ms|s>          Maximum observed event-loop p99 delay.\n  --max-event-loop-utilization <0..1>  Maximum observed event-loop utilization.\n  --model <id>                         Request model.\n  --output <path>                      JSON evidence path.\n  --json                               Emit compact JSON.\n  --help                               Show this help.\n\nProvider credential variables are never forwarded. External gateway authentication is accepted only through AI_GATEWAY_RESOURCE_SOAK_AUTH_TOKEN; authenticated chat and metrics URLs must share an origin.\n`);
}
