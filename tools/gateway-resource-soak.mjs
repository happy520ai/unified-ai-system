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
const METHOD_VERSION = "gateway-resource-soak-v1";
const OUTPUT_TAIL_LIMIT = 16_384;
const MEBIBYTE = 1024 * 1024;

const PROFILES = Object.freeze({
  ci: Object.freeze({
    durationMs: 12_000,
    targetRps: 100,
    maxOutstanding: 64,
    warmupRequests: 80,
    sampleIntervalMs: 500,
    requestTimeoutMs: 5_000,
    minArrivalRatio: 0.98,
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
    minArrivalRatio: 0.98,
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
const report = await runResourceSoak(config);
await writeReport(config.output, report);

if (config.json) {
  process.stdout.write(`${JSON.stringify(report)}\n`);
} else {
  printSummary(report, config.output);
}
if (report.status !== "passed") process.exitCode = 1;

async function runResourceSoak(options) {
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
  let requestHeaders = options.privateRequestHeaders ?? Object.freeze({});
  let gatewayAuthSource = options.gatewayAuthSource ?? "none";

  try {
    if (options.managed) {
      gateway = await startManagedGateway(options);
      endpointUrl = `${gateway.baseUrl}/v1/chat/completions`;
      metricsUrl = `${gateway.baseUrl}/metrics`;
      health = gateway.health;
      requestHeaders = gateway.privateRequestHeaders;
      gatewayAuthSource = "ephemeral-managed";
    }

    if (Object.keys(requestHeaders).length > 0) {
      await verifyAuthenticatedSession(new URL(endpointUrl).origin, requestHeaders);
    }
    await primeResourceMonitor(metricsUrl, requestHeaders);
    await delay(Math.min(250, options.sampleIntervalMs));

    warmup = await executeWarmup({
      endpointUrl,
      requests: options.warmupRequests,
      concurrency: Math.min(8, options.maxOutstanding),
      timeoutMs: options.requestTimeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      requestHeaders,
    });

    const samples = [];
    const sampleFailures = [];
    await captureResourceSample({ metricsUrl, requestHeaders, samples, sampleFailures, started: overallStarted });
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        await delay(options.sampleIntervalMs);
        if (!sampling) break;
        await captureResourceSample({ metricsUrl, requestHeaders, samples, sampleFailures, started: overallStarted });
      }
    })();

    workload = await executeOpenLoop({
      endpointUrl,
      durationMs: options.durationMs,
      targetRps: options.targetRps,
      maxOutstanding: options.maxOutstanding,
      timeoutMs: options.requestTimeoutMs,
      model: options.model,
      requireFakeExecution: options.managed,
      requestHeaders,
    });
    sampling = false;
    await sampler;
    await captureResourceSample({ metricsUrl, requestHeaders, samples, sampleFailures, started: overallStarted });
    resources = summarizeResources(samples, sampleFailures);
  } catch (error) {
    fatalError = normalizeError(error);
  } finally {
    if (gateway) managedGatewayCleanedUp = await stopManagedGateway(gateway);
  }

  const checks = createChecks({
    options,
    health,
    warmup,
    workload,
    resources,
    fatalError,
    managedGatewayCleanedUp,
  });

  return {
    schemaVersion: 1,
    methodologyVersion: METHOD_VERSION,
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    startedAt,
    totalDurationMs: round(performance.now() - overallStarted),
    mode: options.managed ? "managed-local-fake" : "external-observation",
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
      managedGatewayCleanedUp,
    },
    warmup,
    workload,
    resources,
    checks,
    issueCodes: checks.filter((check) => !check.passed).map((check) => check.code),
    fatalError,
    comparisonBoundary: "The CI profile is a short resource-regression gate on one host. It does not prove leak freedom, production capacity, or superiority; use repeated long observe runs with the same host and workload for release evidence.",
  };
}

async function startManagedGateway(options) {
  const port = await reserveFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const authToken = randomBytes(32).toString("base64url");
  const authExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
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
  const state = { child, baseUrl, stdout: "", stderr: "", exitError: null, health: null };
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

async function executeWarmup({ endpointUrl, requests, concurrency, timeoutMs, model, requireFakeExecution, requestHeaders }) {
  const results = new Array(requests);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, requests) }, async () => {
    while (true) {
      const sequence = cursor++;
      if (sequence >= requests) return;
      results[sequence] = await executeChat({ endpointUrl, timeoutMs, model, requireFakeExecution, requestHeaders, sequence, phase: "warmup" });
    }
  });
  await Promise.all(workers);
  return summarizeWorkload(results, requests, requests, 0, 0);
}

async function executeOpenLoop({ endpointUrl, durationMs, targetRps, maxOutstanding, timeoutMs, model, requireFakeExecution, requestHeaders }) {
  const results = [];
  const pending = new Set();
  const schedulerLag = [];
  const startedAt = performance.now();
  const intervalMs = 1_000 / targetRps;
  let scheduled = 0;
  let started = 0;
  let clientDropped = 0;
  let maxOutstandingObserved = 0;

  while (true) {
    const targetAt = startedAt + scheduled * intervalMs;
    if (targetAt - startedAt >= durationMs) break;
    const waitMs = targetAt - performance.now();
    if (waitMs > 0) await delay(waitMs);
    schedulerLag.push(Math.max(0, performance.now() - targetAt));
    scheduled += 1;
    if (pending.size >= maxOutstanding) {
      clientDropped += 1;
      continue;
    }
    const sequence = started++;
    const task = executeChat({ endpointUrl, timeoutMs, model, requireFakeExecution, requestHeaders, sequence, phase: "resource-soak" })
      .then((result) => { results.push(result); })
      .finally(() => { pending.delete(task); });
    pending.add(task);
    maxOutstandingObserved = Math.max(maxOutstandingObserved, pending.size);
  }
  await Promise.all(pending);
  const wallDurationMs = performance.now() - startedAt;
  return {
    ...summarizeWorkload(results, scheduled, started, clientDropped, wallDurationMs),
    targetRps,
    startedRps: round(started / (wallDurationMs / 1_000)),
    successfulRps: round(results.filter((result) => result.ok).length / (wallDurationMs / 1_000)),
    arrivalRatio: ratio(started, scheduled),
    maxOutstandingObserved,
    schedulerLagMs: summarizeMetric(schedulerLag),
  };
}

async function executeChat({ endpointUrl, timeoutMs, model, requireFakeExecution, requestHeaders, sequence, phase }) {
  const started = performance.now();
  try {
    const response = await fetchJson(endpointUrl, {
      method: "POST",
      timeoutMs,
      headers: { ...requestHeaders, "content-type": "application/json" },
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

function summarizeWorkload(results, scheduled, started, clientDropped, wallDurationMs) {
  const succeeded = results.filter((result) => result.ok).length;
  const protocolValid = results.filter((result) => result.protocolValid).length;
  const safetyValid = results.filter((result) => result.safetyValid).length;
  const statusCodes = {};
  for (const result of results) {
    const key = result.status === null ? "transport_error" : String(result.status);
    statusCodes[key] = (statusCodes[key] ?? 0) + 1;
  }
  return {
    scheduled,
    started,
    clientDropped,
    completed: results.length,
    succeeded,
    failed: results.length - succeeded,
    protocolValid,
    safetyValid,
    timeouts: results.filter((result) => result.timedOut).length,
    transportErrors: results.filter((result) => result.transportError).length,
    errorRate: ratio(results.length - succeeded, results.length),
    protocolValidityRate: ratio(protocolValid, results.length),
    wallDurationMs: round(wallDurationMs),
    latencyMs: summarizeMetric(results.filter((result) => result.ok).map((result) => result.latencyMs)),
    statusCodes,
  };
}

async function captureResourceSample({ metricsUrl, requestHeaders, samples, sampleFailures, started }) {
  try {
    const response = await fetchText(metricsUrl, { headers: requestHeaders, timeoutMs: 2_000 });
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
      externalMaxBytes: Math.max(...samples.map((sample) => sample.externalBytes)),
      arrayBuffersMaxBytes: Math.max(...samples.map((sample) => sample.arrayBuffersBytes)),
    },
    cpuSecondsDelta: round(Math.max(0,
      lastSample.cpuUserSeconds + lastSample.cpuSystemSeconds
      - firstSample.cpuUserSeconds - firstSample.cpuSystemSeconds,
    )),
    eventLoop: {
      utilizationMaxRatio: Math.max(...samples.map((sample) => sample.eventLoopUtilizationRatio)),
      delayP99MaxSeconds: Math.max(...samples.map((sample) => sample.eventLoopDelayP99Seconds)),
      delayMaxSeconds: Math.max(...samples.map((sample) => sample.eventLoopDelayMaxSeconds)),
      finalDelaySampleCount: lastSample.eventLoopDelaySamples,
    },
    samples,
  };
}

function summarizeGrowth(samples, field, initialBytes, finalBytes) {
  const growthBytes = finalBytes - initialBytes;
  return {
    initialMedianBytes: round(initialBytes),
    finalMedianBytes: round(finalBytes),
    growthBytes: round(growthBytes),
    growthRatio: initialBytes > 0 ? round(growthBytes / initialBytes) : 0,
    minBytes: Math.min(...samples.map((sample) => sample[field])),
    maxBytes: Math.max(...samples.map((sample) => sample[field])),
    trendBytesPerMinute: round(linearSlope(samples.map((sample) => [sample.elapsedMs, sample[field]])) * 60_000),
  };
}

function createChecks({ options, health, warmup, workload, resources, fatalError, managedGatewayCleanedUp }) {
  const expectedSamples = Math.max(2, Math.floor(options.durationMs / options.sampleIntervalMs));
  const minimumSamples = Math.max(2, Math.floor(expectedSamples * 0.8));
  const memoryWithin = (summary, maxBytes) => summary
    && (summary.growthBytes <= maxBytes || summary.growthRatio <= options.maxMemoryGrowthRatio);
  const checks = [
    check("benchmark_completed", fatalError === null, "benchmark completes without a fatal error", fatalError?.message ?? "complete"),
    check("warmup_healthy", warmup?.failed === 0, "warmup completes without failures", warmup?.failed ?? null),
    check("workload_completed", workload?.completed === workload?.started, "every started request completes", workload ? { started: workload.started, completed: workload.completed } : null),
    check("workload_no_client_drop", workload?.clientDropped === 0, "load generator drops no scheduled arrivals", workload?.clientDropped ?? null),
    check("workload_arrival_ratio", workload?.arrivalRatio >= options.minArrivalRatio, `started/scheduled ratio >= ${options.minArrivalRatio}`, workload?.arrivalRatio ?? null),
    check("workload_error_rate", workload?.errorRate <= options.maxErrorRate, `error rate <= ${options.maxErrorRate}`, workload?.errorRate ?? null),
    check("workload_protocol_valid", workload?.protocolValidityRate === 1, "all completed responses satisfy the OpenAI contract", workload?.protocolValidityRate ?? null),
    check("resource_samples_complete", resources?.sampleCount >= minimumSamples && resources?.sampleFailureCount === 0, `at least ${minimumSamples} resource samples and zero scrape failures`, resources ? { samples: resources.sampleCount, failures: resources.sampleFailureCount } : null),
    check("heap_growth_bounded", memoryWithin(resources?.memory?.heapUsed, options.maxHeapGrowthBytes), `heap growth <= ${options.maxHeapGrowthBytes} bytes or ratio <= ${options.maxMemoryGrowthRatio}`, resources?.memory?.heapUsed ?? null),
    check("rss_growth_bounded", memoryWithin(resources?.memory?.rss, options.maxRssGrowthBytes), `RSS growth <= ${options.maxRssGrowthBytes} bytes or ratio <= ${options.maxMemoryGrowthRatio}`, resources?.memory?.rss ?? null),
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
    json: args.json === true,
    gatewayAuthSource: authToken ? "environment" : "none",
  };
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
    "--output": "output",
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
  const match = String(value).match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const factor = match[2] === "m" ? 60_000 : match[2] === "s" ? 1_000 : 1;
  const duration = Number(match[1]) * factor;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Duration must be positive: ${value}`);
  return Math.round(duration);
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
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return { samples: 0, min: null, mean: null, p50: null, p95: null, p99: null, max: null };
  return {
    samples: sorted.length,
    min: round(sorted[0]),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted.at(-1)),
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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, Math.max(0, ms)));
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
  process.stdout.write(`Credential-free-provider gateway resource stability soak.\n\nUsage:\n  node tools/gateway-resource-soak.mjs [options]\n\nOptions:\n  --profile <ci|observe>              ci defaults to 12s; observe defaults to 5m.\n  --target <chat-url>                 External chat endpoint; defaults to managed fake gateway.\n  --metrics-url <url>                 Required metrics endpoint for an external run.\n  --duration <ms|s|m>                 Measurement duration.\n  --rate <rps>                        Fixed request arrival rate.\n  --max-outstanding <count>           Client outstanding request cap.\n  --warmup <count>                    Warmup requests before the baseline.\n  --sample-interval <ms|s>            Metrics scrape interval.\n  --timeout <ms|s>                    Per-request timeout.\n  --min-arrival-ratio <0..1>          Minimum started/scheduled ratio.\n  --max-error-rate <0..1>             Maximum workload error rate.\n  --max-heap-growth-bytes <bytes>      Absolute heap-growth allowance.\n  --max-rss-growth-bytes <bytes>       Absolute RSS-growth allowance.\n  --max-memory-growth-ratio <0..1>     Relative memory-growth allowance.\n  --max-event-loop-p99 <ms|s>          Maximum observed event-loop p99 delay.\n  --max-event-loop-utilization <0..1>  Maximum observed event-loop utilization.\n  --model <id>                         Request model.\n  --output <path>                      JSON evidence path.\n  --json                               Emit compact JSON.\n  --help                               Show this help.\n\nProvider credential variables are never forwarded. External gateway authentication is accepted only through AI_GATEWAY_RESOURCE_SOAK_AUTH_TOKEN; authenticated chat and metrics URLs must share an origin.\n`);
}
