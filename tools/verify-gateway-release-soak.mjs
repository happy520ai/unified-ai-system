#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const MEBIBYTE = 1024 * 1024;
const LONG_RUN_THRESHOLD_MS = 60 * 60_000;
const MAX_RETAINED_METRIC_SAMPLES = 100_000;

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const evidencePath = resolve(required(args.evidence, "--evidence is required."));
const evidenceBytes = await readFile(evidencePath);
const evidence = parseJson(evidenceBytes, evidencePath);
const manifestPath = args.manifest ? resolve(args.manifest) : null;
const manifest = manifestPath ? parseJson(await readFile(manifestPath), manifestPath) : null;
const expectedDurationMs = parseDuration(args.expectedDuration ?? "360m");
const expectedRate = parsePositiveNumber(args.expectedRate ?? "10", "expected-rate");
const expectedSampleIntervalMs = parseDuration(args.expectedSampleInterval ?? "30s");
const expectedMaxOutstanding = parsePositiveInteger(args.expectedMaxOutstanding ?? "64", "expected-max-outstanding");
const minResourceSamples = parsePositiveInteger(
  args.minResourceSamples ?? String(Math.floor(expectedDurationMs / expectedSampleIntervalMs)),
  "min-resource-samples",
);
const candidateSha = normalizeSha(args.candidateSha, "candidate-sha");
const expectedRunId = normalizeRunIdentity(args.expectedRunId, "expected-run-id");
const expectedRunAttempt = normalizeRunIdentity(args.expectedRunAttempt, "expected-run-attempt");
const allowShortRun = args.allowShortRun === true;
if (allowShortRun && expectedDurationMs >= LONG_RUN_THRESHOLD_MS) {
  throw new Error("--allow-short-run requires --expected-duration below one hour.");
}
if (!allowShortRun && expectedDurationMs < LONG_RUN_THRESHOLD_MS) {
  throw new Error("Release verification requires at least one hour; use --allow-short-run only for explicit dry runs.");
}
const checks = [];
const add = (code, passed, expectation, actual) => {
  checks.push({ code, passed: passed === true, expectation, actual });
};

add("schema_version", evidence.schemaVersion === 1, "schemaVersion equals 1", evidence.schemaVersion ?? null);
add(
  "methodology_version",
  evidence.methodologyVersion === "gateway-resource-soak-v3",
  "methodologyVersion equals gateway-resource-soak-v3",
  evidence.methodologyVersion ?? null,
);
add("status_passed", evidence.status === "passed", "evidence status is passed", evidence.status ?? null);
add("fatal_error_absent", evidence.fatalError === null, "fatalError is null", evidence.fatalError ?? null);
add("managed_fake_mode", evidence.mode === "managed-local-fake", "mode is managed-local-fake", evidence.mode ?? null);
add(
  "candidate_sha_bound",
  candidateSha !== null && evidence.source?.candidateSha === candidateSha,
  "evidence source binds the requested complete candidate SHA",
  evidence.source?.candidateSha ?? null,
);
add(
  "workflow_run_identity_bound",
  evidence.source?.workflowRunId === expectedRunId
    && evidence.source?.workflowRunAttempt === expectedRunAttempt,
  "evidence source binds the exact workflow run id and attempt",
  {
    workflowRunId: evidence.source?.workflowRunId ?? null,
    workflowRunAttempt: evidence.source?.workflowRunAttempt ?? null,
  },
);

const workloadConfig = evidence.workloadConfig ?? {};
add("duration_exact", workloadConfig.durationMs === expectedDurationMs, `durationMs equals ${expectedDurationMs}`, workloadConfig.durationMs ?? null);
add("rate_exact", workloadConfig.targetRps === expectedRate, `targetRps equals ${expectedRate}`, workloadConfig.targetRps ?? null);
add(
  "sample_interval_exact",
  workloadConfig.sampleIntervalMs === expectedSampleIntervalMs,
  `sampleIntervalMs equals ${expectedSampleIntervalMs}`,
  workloadConfig.sampleIntervalMs ?? null,
);
add(
  "max_outstanding_exact",
  workloadConfig.maxOutstanding === expectedMaxOutstanding,
  `maxOutstanding equals ${expectedMaxOutstanding}`,
  workloadConfig.maxOutstanding ?? null,
);
add("request_timeout_exact", workloadConfig.requestTimeoutMs === 5_000, "requestTimeoutMs equals 5000", workloadConfig.requestTimeoutMs ?? null);

const thresholds = evidence.thresholds ?? {};
add("arrival_gate_strict", thresholds.minArrivalRatio === 1, "minimum arrival ratio is 1", thresholds.minArrivalRatio ?? null);
add("error_gate_zero", thresholds.maxErrorRate === 0, "maximum error rate is 0", thresholds.maxErrorRate ?? null);
add("heap_growth_limit", thresholds.maxHeapGrowthBytes === 64 * MEBIBYTE, "heap growth limit is 64 MiB", thresholds.maxHeapGrowthBytes ?? null);
add("rss_growth_limit", thresholds.maxRssGrowthBytes === 128 * MEBIBYTE, "RSS growth limit is 128 MiB", thresholds.maxRssGrowthBytes ?? null);
add("relative_growth_limit", thresholds.maxMemoryGrowthRatio === 0.5, "relative memory growth limit is 0.5", thresholds.maxMemoryGrowthRatio ?? null);
add("event_loop_p99_limit", thresholds.maxEventLoopP99Seconds === 0.2, "event-loop p99 limit is 0.2 seconds", thresholds.maxEventLoopP99Seconds ?? null);
add("event_loop_utilization_limit", thresholds.maxEventLoopUtilization === 0.95, "event-loop utilization limit is 0.95", thresholds.maxEventLoopUtilization ?? null);
const expectedHeapTrendLimit = round((64 * MEBIBYTE) / (expectedDurationMs / 60_000));
const expectedRssTrendLimit = round((128 * MEBIBYTE) / (expectedDurationMs / 60_000));
add("heap_trend_limit", thresholds.maxHeapTrendBytesPerMinute === expectedHeapTrendLimit, `heap trend limit equals ${expectedHeapTrendLimit} bytes/minute`, thresholds.maxHeapTrendBytesPerMinute ?? null);
add("rss_trend_limit", thresholds.maxRssTrendBytesPerMinute === expectedRssTrendLimit, `RSS trend limit equals ${expectedRssTrendLimit} bytes/minute`, thresholds.maxRssTrendBytesPerMinute ?? null);
if (!allowShortRun || expectedDurationMs >= LONG_RUN_THRESHOLD_MS) {
  add(
    "long_run_memory_gate",
    thresholds.memoryGrowthGateMode === "absolute-and-relative",
    "long runs require both absolute and relative memory bounds",
    thresholds.memoryGrowthGateMode ?? null,
  );
} else {
  add(
    "short_run_explicitly_allowed",
    expectedDurationMs < LONG_RUN_THRESHOLD_MS,
    "short verification is explicitly opted in and remains below the release duration boundary",
    expectedDurationMs,
  );
}

const workload = evidence.workload ?? {};
const expectedScheduled = Math.round((expectedDurationMs / 1_000) * expectedRate);
add("measurement_wall_duration", workload.wallDurationMs >= expectedDurationMs, `workload wall duration is at least ${expectedDurationMs}ms`, workload.wallDurationMs ?? null);
add("scheduled_exact", workload.scheduled === expectedScheduled, `scheduled requests equal ${expectedScheduled}`, workload.scheduled ?? null);
add("zero_client_drop", workload.clientDropped === 0, "clientDropped equals 0", workload.clientDropped ?? null);
add("all_arrivals_started", workload.started === workload.scheduled, "every fixed arrival starts", { scheduled: workload.scheduled ?? null, started: workload.started ?? null });
add("all_started_completed", workload.completed === workload.started, "every started request completes", { started: workload.started ?? null, completed: workload.completed ?? null });
add("zero_workload_failures", workload.failed === 0 && workload.errorRate === 0, "failed and errorRate equal 0", { failed: workload.failed ?? null, errorRate: workload.errorRate ?? null });
add("zero_timeouts", workload.timeouts === 0, "timeouts equals 0", workload.timeouts ?? null);
add("zero_transport_errors", workload.transportErrors === 0, "transportErrors equals 0", workload.transportErrors ?? null);
add("protocol_complete", workload.protocolValid === workload.started && workload.protocolValidityRate === 1, "all started responses satisfy the protocol", { started: workload.started ?? null, protocolValid: workload.protocolValid ?? null, rate: workload.protocolValidityRate ?? null });
add("fake_safety_complete", workload.safetyValid === workload.started, "all started responses prove fake execution", { started: workload.started ?? null, safetyValid: workload.safetyValid ?? null });
add("http_200_only", workload.statusCodes?.["200"] === workload.started && Object.keys(workload.statusCodes ?? {}).length === 1, "every response is HTTP 200 and no other status is present", workload.statusCodes ?? null);
add("workload_not_aborted", workload.aborted === false, "workload is not aborted", workload.aborted ?? null);
for (const [name, metric] of [["latency", workload.latencyMs], ["scheduler_lag", workload.schedulerLagMs]]) {
  add(
    `${name}_retention_bounded`,
    Number.isInteger(metric?.retainedSamples)
      && metric.retainedSamples > 0
      && metric.retainedSamples <= MAX_RETAINED_METRIC_SAMPLES
      && metric.retainedSamples <= metric.samples,
    `${name} retains at most ${MAX_RETAINED_METRIC_SAMPLES} bounded metric samples`,
    metric ? { samples: metric.samples, retainedSamples: metric.retainedSamples, approximate: metric.approximate } : null,
  );
}

const resources = evidence.resources ?? {};
const rawSamples = Array.isArray(resources.samples) ? resources.samples : [];
const rawSampleValidation = validateRawSamples(rawSamples, expectedDurationMs, expectedSampleIntervalMs);
const recomputedResources = rawSampleValidation.valid ? recomputeResources(rawSamples) : null;
add("resource_samples_sufficient", resources.sampleCount >= minResourceSamples, `resource sample count is at least ${minResourceSamples}`, resources.sampleCount ?? null);
add("resource_samples_consistent", Array.isArray(resources.samples) && resources.samples.length === resources.sampleCount, "raw resource sample count matches sampleCount", { declared: resources.sampleCount ?? null, actual: Array.isArray(resources.samples) ? resources.samples.length : null });
add("resource_scrapes_clean", resources.sampleFailureCount === 0 && Array.isArray(resources.sampleFailures) && resources.sampleFailures.length === 0, "resource scrape failures equal 0", { count: resources.sampleFailureCount ?? null, failures: resources.sampleFailures ?? null });
add("raw_resource_samples_valid", rawSampleValidation.valid, "raw samples are finite, cumulative metrics are monotonic, and elapsed timestamps strictly increase", rawSampleValidation.issues);
add("raw_resource_coverage", Number.isFinite(rawSampleValidation.coverageMs) && rawSampleValidation.coverageMs >= expectedDurationMs, `raw samples cover at least ${expectedDurationMs}ms`, rawSampleValidation.coverageMs);
add("raw_resource_cadence", Number.isFinite(rawSampleValidation.maxGapMs) && rawSampleValidation.maxGapMs <= expectedSampleIntervalMs + 2_500, `raw sample gaps do not exceed ${expectedSampleIntervalMs + 2_500}ms`, rawSampleValidation.maxGapMs);
add("heap_summary_present", finiteGrowth(resources.memory?.heapUsed), "heap growth summary is finite", resources.memory?.heapUsed ?? null);
add("rss_summary_present", finiteGrowth(resources.memory?.rss), "RSS growth summary is finite", resources.memory?.rss ?? null);
add(
  "memory_summary_recomputed",
  recomputedResources !== null
    && sameGrowthSummary(resources.memory?.heapUsed, recomputedResources.memory.heapUsed)
    && sameGrowthSummary(resources.memory?.rss, recomputedResources.memory.rss)
    && sameFiniteNumber(resources.memory?.externalMaxBytes, recomputedResources.memory.externalMaxBytes)
    && sameFiniteNumber(resources.memory?.arrayBuffersMaxBytes, recomputedResources.memory.arrayBuffersMaxBytes),
  "reported memory results exactly match recomputation from raw samples",
  recomputedResources ? { reported: resources.memory ?? null, recomputed: recomputedResources.memory } : null,
);
add(
  "heap_growth_recomputed",
  memoryWithinReleaseBounds(resources.memory?.heapUsed, thresholds.maxHeapGrowthBytes, thresholds.maxMemoryGrowthRatio, thresholds.maxHeapTrendBytesPerMinute, !allowShortRun || expectedDurationMs >= LONG_RUN_THRESHOLD_MS),
  "heap growth independently satisfies final, peak, ratio, and positive-slope release bounds",
  resources.memory?.heapUsed ?? null,
);
add(
  "rss_growth_recomputed",
  memoryWithinReleaseBounds(resources.memory?.rss, thresholds.maxRssGrowthBytes, thresholds.maxMemoryGrowthRatio, thresholds.maxRssTrendBytesPerMinute, !allowShortRun || expectedDurationMs >= LONG_RUN_THRESHOLD_MS),
  "RSS growth independently satisfies final, peak, ratio, and positive-slope release bounds",
  resources.memory?.rss ?? null,
);
add(
  "event_loop_summary_recomputed",
  recomputedResources !== null
    && sameFiniteNumber(resources.eventLoop?.utilizationMaxRatio, recomputedResources.eventLoop.utilizationMaxRatio)
    && sameFiniteNumber(resources.eventLoop?.delayP99MaxSeconds, recomputedResources.eventLoop.delayP99MaxSeconds)
    && sameFiniteNumber(resources.eventLoop?.delayMaxSeconds, recomputedResources.eventLoop.delayMaxSeconds)
    && sameFiniteNumber(resources.eventLoop?.finalDelaySampleCount, recomputedResources.eventLoop.finalDelaySampleCount),
  "reported event-loop results exactly match recomputation from raw samples",
  recomputedResources ? { reported: resources.eventLoop ?? null, recomputed: recomputedResources.eventLoop } : null,
);
add("event_loop_sampled", Number.isFinite(resources.eventLoop?.finalDelaySampleCount) && resources.eventLoop.finalDelaySampleCount > 0, "event-loop histogram contains samples", resources.eventLoop?.finalDelaySampleCount ?? null);
add("event_loop_p99_recomputed", Number.isFinite(resources.eventLoop?.delayP99MaxSeconds) && Number.isFinite(thresholds.maxEventLoopP99Seconds) && resources.eventLoop.delayP99MaxSeconds <= thresholds.maxEventLoopP99Seconds, "event-loop p99 independently satisfies its configured bound", resources.eventLoop?.delayP99MaxSeconds ?? null);
add("event_loop_utilization_recomputed", Number.isFinite(resources.eventLoop?.utilizationMaxRatio) && Number.isFinite(thresholds.maxEventLoopUtilization) && resources.eventLoop.utilizationMaxRatio <= thresholds.maxEventLoopUtilization, "event-loop utilization independently satisfies its configured bound", resources.eventLoop?.utilizationMaxRatio ?? null);

const safety = evidence.safety ?? {};
add("provider_fake_only", safety.providerMode === "fake" && safety.realProviderEnabled === false && safety.realProviderCallsMade === false, "managed run remains fake-only with zero real provider calls", { providerMode: safety.providerMode ?? null, realProviderEnabled: safety.realProviderEnabled ?? null, realProviderCallsMade: safety.realProviderCallsMade ?? null });
add("credential_boundary", safety.credentialEnvironmentForwarded === false && safety.gatewayAuthTokenExposed === false && safety.persistentCredentialStoreRead === false && safety.runtimeCredentialStoreMode === "memory", "no provider credential is forwarded, exposed, persisted, or read", { credentialEnvironmentForwarded: safety.credentialEnvironmentForwarded ?? null, gatewayAuthTokenExposed: safety.gatewayAuthTokenExposed ?? null, persistentCredentialStoreRead: safety.persistentCredentialStoreRead ?? null, runtimeCredentialStoreMode: safety.runtimeCredentialStoreMode ?? null });
const expectedAuthRequiredMs = expectedDurationMs + workloadConfig.requestTimeoutMs + 60_000;
add(
  "managed_auth_duration",
  Number.isFinite(safety.gatewayAuthRemainingAtMeasurementStartMs)
    && Number.isFinite(safety.gatewayAuthRequiredAtMeasurementStartMs)
    && safety.gatewayAuthRequiredAtMeasurementStartMs === expectedAuthRequiredMs
    && safety.gatewayAuthPostSoakAllowanceMs === 60_000
    && safety.gatewayAuthRemainingAtMeasurementStartMs >= safety.gatewayAuthRequiredAtMeasurementStartMs,
  "authentication remaining at measurement start covers measurement, request drain, and post-soak verification",
  {
    remainingAtMeasurementStartMs: safety.gatewayAuthRemainingAtMeasurementStartMs ?? null,
    requiredAtMeasurementStartMs: safety.gatewayAuthRequiredAtMeasurementStartMs ?? null,
    postSoakAllowanceMs: safety.gatewayAuthPostSoakAllowanceMs ?? null,
  },
);
add("gateway_cleanup", safety.managedGatewayCleanedUp === true, "managed gateway is cleaned up", safety.managedGatewayCleanedUp ?? null);
add("checkpoint_complete", evidence.checkpoint?.writesSucceeded === true && evidence.checkpoint?.error === null, "atomic checkpoint writes succeed", evidence.checkpoint ?? null);
add(
  "checkpoint_single_flight",
  Number.isInteger(evidence.checkpoint?.requestedWrites)
    && Number.isInteger(evidence.checkpoint?.completedWrites)
    && Number.isInteger(evidence.checkpoint?.coalescedWrites)
    && evidence.checkpoint.requestedWrites >= 1
    && evidence.checkpoint.completedWrites >= 1
    && evidence.checkpoint.completedWrites <= evidence.checkpoint.requestedWrites
    && evidence.checkpoint.coalescedWrites >= 0
    && evidence.checkpoint.maxConcurrentWrites === 1,
  "checkpoint writes remain single-flight with bounded coalescing",
  evidence.checkpoint ?? null,
);
add("post_soak_health", evidence.postSoak?.status === "passed" && evidence.postSoak?.healthReady === true, "gateway remains ready after measurement", evidence.postSoak ?? null);
add("post_soak_chat", evidence.postSoak?.chatValid === true && evidence.postSoak?.chatProtocolValid === true && evidence.postSoak?.chatSafetyValid === true, "post-soak chat remains protocol-valid and fake-only", evidence.postSoak ?? null);

const embeddedChecks = Array.isArray(evidence.checks) ? evidence.checks : [];
const requiredEmbeddedCodes = [
  "benchmark_completed",
  "checkpoint_writes_succeeded",
  "workload_completed",
  "workload_pressure_sufficient",
  "workload_error_rate",
  "workload_protocol_valid",
  "resource_samples_complete",
  "heap_growth_bounded",
  "rss_growth_bounded",
  "event_loop_delay_sampled",
  "event_loop_delay_bounded",
  "event_loop_utilization_bounded",
  "managed_fake_only",
  "managed_auth_valid_for_run",
  "post_soak_health_ready",
  "post_soak_chat_valid",
  "managed_gateway_cleaned_up",
];
const embeddedByCode = new Map(embeddedChecks.map((check) => [check?.code, check]));
add("embedded_checks_all_pass", embeddedChecks.length > 0 && embeddedChecks.every((check) => check?.passed === true), "all embedded soak checks pass", embeddedChecks.filter((check) => check?.passed !== true).map((check) => check?.code ?? null));
add("embedded_required_checks_present", requiredEmbeddedCodes.every((code) => embeddedByCode.get(code)?.passed === true), "all required embedded check codes exist and pass", requiredEmbeddedCodes.filter((code) => embeddedByCode.get(code)?.passed !== true));
add("issue_codes_empty", Array.isArray(evidence.issueCodes) && evidence.issueCodes.length === 0, "issueCodes is empty", evidence.issueCodes ?? null);

const evidenceSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
add(
  "manifest_required_for_release",
  manifest !== null,
  "every verification includes an immutable manifest",
  manifestPath,
);
if (manifest) {
  add("manifest_schema", manifest.schemaVersion === 1, "manifest schemaVersion equals 1", manifest.schemaVersion ?? null);
  add("manifest_candidate_sha", manifest.candidateSha === candidateSha, "manifest candidateSha matches requested SHA", manifest.candidateSha ?? null);
  add("manifest_candidate_tree", /^[a-f0-9]{40}$/.test(manifest.candidateTree ?? ""), "manifest contains a complete candidate tree SHA", manifest.candidateTree ?? null);
  add("manifest_lockfile_digest", /^[a-f0-9]{64}$/.test(manifest.lockfileSha256 ?? ""), "manifest contains a SHA-256 lockfile digest", manifest.lockfileSha256 ?? null);
  add("manifest_evidence_digest", manifest.evidenceSha256 === evidenceSha256, "manifest evidence digest matches the exact evidence bytes", manifest.evidenceSha256 ?? null);
  add("manifest_evidence_present", manifest.evidencePresent === true, "manifest records that final evidence was present", manifest.evidencePresent ?? null);
  add("manifest_mode", manifest.mode === (allowShortRun ? "dry-run" : "release"), `manifest mode equals ${allowShortRun ? "dry-run" : "release"}`, manifest.mode ?? null);
  add(
    "manifest_workload",
    optionalDuration(manifest.workload?.duration) === expectedDurationMs
      && manifest.workload?.targetRps === expectedRate
      && optionalDuration(manifest.workload?.sampleInterval) === expectedSampleIntervalMs
      && manifest.workload?.maxOutstanding === expectedMaxOutstanding,
    "manifest workload matches the independently requested verification contract",
    manifest.workload ?? null,
  );
  add("manifest_package_version", /^\d+\.\d+\.\d+$/.test(manifest.packageVersion ?? ""), "manifest contains an exact semantic package version", manifest.packageVersion ?? null);
  add("manifest_run_identity", manifest.workflowRunId === expectedRunId && manifest.workflowRunAttempt === expectedRunAttempt, "manifest matches the exact expected workflow run id and attempt", { workflowRunId: manifest.workflowRunId ?? null, workflowRunAttempt: manifest.workflowRunAttempt ?? null });
}

const failed = checks.filter((check) => !check.passed);
const result = {
  schemaVersion: 1,
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  evidencePath,
  manifestPath,
  evidenceSha256,
  candidateSha,
  expected: {
    durationMs: expectedDurationMs,
    targetRps: expectedRate,
    sampleIntervalMs: expectedSampleIntervalMs,
    maxOutstanding: expectedMaxOutstanding,
    minResourceSamples,
    allowShortRun,
    workflowRunId: expectedRunId,
    workflowRunAttempt: expectedRunAttempt,
  },
  checks,
  issueCodes: failed.map((check) => check.code),
};

if (args.json) process.stdout.write(`${JSON.stringify(result)}\n`);
else {
  process.stdout.write(`Gateway release soak verification: ${result.status}\n`);
  process.stdout.write(`Candidate: ${candidateSha ?? "missing"}\n`);
  process.stdout.write(`Evidence SHA-256: ${evidenceSha256}\n`);
  if (failed.length > 0) process.stdout.write(`Failed checks: ${failed.map((check) => check.code).join(", ")}\n`);
}
if (failed.length > 0) process.exitCode = 1;

function parseArgs(argv) {
  const result = {};
  const names = {
    "--evidence": "evidence",
    "--manifest": "manifest",
    "--candidate-sha": "candidateSha",
    "--expected-duration": "expectedDuration",
    "--expected-rate": "expectedRate",
    "--expected-sample-interval": "expectedSampleInterval",
    "--expected-max-outstanding": "expectedMaxOutstanding",
    "--min-resource-samples": "minResourceSamples",
    "--expected-run-id": "expectedRunId",
    "--expected-run-attempt": "expectedRunAttempt",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") { result.json = true; continue; }
    if (arg === "--allow-short-run") { result.allowShortRun = true; continue; }
    if (arg === "--help" || arg === "-h") { result.help = true; continue; }
    const name = names[arg];
    if (!name) throw new Error(`Unknown option: ${arg}`);
    const value = argv[++index];
    if (value === undefined) throw new Error(`Missing value for ${arg}`);
    result[name] = value;
  }
  return result;
}

function parseJson(bytes, path) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON at ${path}: ${error.message}`);
  }
}

function parseDuration(value) {
  const match = String(value).match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const factor = match[2] === "h" ? 3_600_000 : match[2] === "m" ? 60_000 : match[2] === "s" ? 1_000 : 1;
  const parsed = Number(match[1]) * factor;
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Duration must be positive: ${value}`);
  return Math.round(parsed);
}

function optionalDuration(value) {
  try {
    return parseDuration(value);
  } catch {
    return null;
  }
}

function parsePositiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be positive.`);
  return parsed;
}

function parsePositiveInteger(value, name) {
  const parsed = parsePositiveNumber(value, name);
  if (!Number.isInteger(parsed)) throw new Error(`--${name} must be an integer.`);
  return parsed;
}

function normalizeSha(value, name) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(normalized)) throw new Error(`--${name} must be a complete 40-character hexadecimal SHA.`);
  return normalized;
}

function normalizeRunIdentity(value, name) {
  const normalized = String(value ?? "").trim();
  if (!/^[1-9]\d{0,19}$/.test(normalized)) {
    throw new Error(`--${name} must be a positive decimal identifier.`);
  }
  return normalized;
}

function validateRawSamples(samples, expectedDurationMs, expectedSampleIntervalMs) {
  const issues = [];
  const fields = [
    "elapsedMs",
    "rssBytes",
    "heapUsedBytes",
    "externalBytes",
    "arrayBuffersBytes",
    "cpuUserSeconds",
    "cpuSystemSeconds",
    "eventLoopUtilizationRatio",
    "eventLoopDelayP99Seconds",
    "eventLoopDelayMaxSeconds",
    "eventLoopDelaySamples",
  ];
  let maxGapMs = null;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
      issues.push(`sample ${index} is not an object`);
      continue;
    }
    for (const field of fields) {
      if (!Number.isFinite(sample[field])) issues.push(`sample ${index} ${field} is not finite`);
      else if (sample[field] < 0) issues.push(`sample ${index} ${field} is negative`);
    }
    if (Number.isFinite(sample.eventLoopUtilizationRatio) && sample.eventLoopUtilizationRatio > 1) {
      issues.push(`sample ${index} eventLoopUtilizationRatio exceeds 1`);
    }
    if (index === 0) continue;
    const previous = samples[index - 1];
    if (!previous || typeof previous !== "object") continue;
    if (!Number.isFinite(sample.elapsedMs) || !Number.isFinite(previous.elapsedMs) || sample.elapsedMs <= previous.elapsedMs) {
      issues.push(`sample ${index} elapsedMs is not strictly increasing`);
    } else {
      const gap = sample.elapsedMs - previous.elapsedMs;
      maxGapMs = maxGapMs === null ? gap : Math.max(maxGapMs, gap);
    }
    for (const field of ["cpuUserSeconds", "cpuSystemSeconds", "eventLoopDelaySamples"]) {
      if (Number.isFinite(sample[field]) && Number.isFinite(previous[field]) && sample[field] < previous[field]) {
        issues.push(`sample ${index} cumulative ${field} decreased`);
      }
    }
  }
  const firstElapsed = samples[0]?.elapsedMs;
  const lastElapsed = samples.at(-1)?.elapsedMs;
  const coverageMs = Number.isFinite(firstElapsed) && Number.isFinite(lastElapsed)
    ? round(lastElapsed - firstElapsed)
    : null;
  if (samples.length < 2) issues.push("at least two raw samples are required");
  if (Number.isFinite(coverageMs) && coverageMs < expectedDurationMs) {
    issues.push(`raw sample coverage ${coverageMs}ms is shorter than ${expectedDurationMs}ms`);
  }
  if (Number.isFinite(maxGapMs) && maxGapMs > expectedSampleIntervalMs + 2_500) {
    issues.push(`raw sample gap ${round(maxGapMs)}ms exceeds cadence allowance`);
  }
  return { valid: issues.length === 0, issues: issues.slice(0, 32), coverageMs, maxGapMs: round(maxGapMs) };
}

function recomputeResources(samples) {
  const edgeCount = Math.min(3, samples.length);
  const first = samples.slice(0, edgeCount);
  const last = samples.slice(-edgeCount);
  const heapInitial = median(first.map((sample) => sample.heapUsedBytes));
  const heapFinal = median(last.map((sample) => sample.heapUsedBytes));
  const rssInitial = median(first.map((sample) => sample.rssBytes));
  const rssFinal = median(last.map((sample) => sample.rssBytes));
  return {
    memory: {
      heapUsed: recomputeGrowth(samples, "heapUsedBytes", heapInitial, heapFinal),
      rss: recomputeGrowth(samples, "rssBytes", rssInitial, rssFinal),
      externalMaxBytes: maxField(samples, "externalBytes"),
      arrayBuffersMaxBytes: maxField(samples, "arrayBuffersBytes"),
    },
    eventLoop: {
      utilizationMaxRatio: maxField(samples, "eventLoopUtilizationRatio"),
      delayP99MaxSeconds: maxField(samples, "eventLoopDelayP99Seconds"),
      delayMaxSeconds: maxField(samples, "eventLoopDelayMaxSeconds"),
      finalDelaySampleCount: samples.at(-1).eventLoopDelaySamples,
    },
  };
}

function recomputeGrowth(samples, field, initialBytes, finalBytes) {
  const maxBytes = maxField(samples, field);
  const growthBytes = finalBytes - initialBytes;
  return {
    initialMedianBytes: round(initialBytes),
    finalMedianBytes: round(finalBytes),
    growthBytes: round(growthBytes),
    growthRatio: initialBytes > 0 ? round(growthBytes / initialBytes) : 0,
    minBytes: minField(samples, field),
    maxBytes,
    peakIncreaseBytes: round(maxBytes - initialBytes),
    trendBytesPerMinute: round(linearSlope(samples.map((sample) => [sample.elapsedMs, sample[field]])) * 60_000),
  };
}

function sameGrowthSummary(actual, expected) {
  return [
    "initialMedianBytes",
    "finalMedianBytes",
    "growthBytes",
    "growthRatio",
    "minBytes",
    "maxBytes",
    "peakIncreaseBytes",
    "trendBytesPerMinute",
  ].every((field) => sameFiniteNumber(actual?.[field], expected?.[field]));
}

function sameFiniteNumber(actual, expected) {
  return Number.isFinite(actual)
    && Number.isFinite(expected)
    && Math.abs(actual - expected) <= 1e-6;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function minField(samples, field) {
  return samples.reduce((value, sample) => Math.min(value, sample[field]), samples[0][field]);
}

function maxField(samples, field) {
  return samples.reduce((value, sample) => Math.max(value, sample[field]), samples[0][field]);
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

function finiteGrowth(summary) {
  return summary
    && Number.isFinite(summary.growthBytes)
    && Number.isFinite(summary.growthRatio)
    && Number.isFinite(summary.trendBytesPerMinute)
    && Number.isFinite(summary.peakIncreaseBytes);
}

function memoryWithinReleaseBounds(summary, maxBytes, maxRatio, maxTrendBytesPerMinute, requireLongRunBounds) {
  if (!finiteGrowth(summary) || !Number.isFinite(maxBytes) || !Number.isFinite(maxRatio)) return false;
  const absoluteWithin = summary.growthBytes <= maxBytes;
  const relativeWithin = summary.growthRatio <= maxRatio;
  if (!requireLongRunBounds) return absoluteWithin || relativeWithin;
  return Number.isFinite(maxTrendBytesPerMinute)
    && absoluteWithin
    && relativeWithin
    && summary.peakIncreaseBytes <= maxBytes
    && summary.trendBytesPerMinute <= maxTrendBytesPerMinute;
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function required(value, message) {
  if (value === undefined || String(value).trim() === "") throw new Error(message);
  return value;
}

function printHelp() {
  process.stdout.write(`Verify fail-closed gateway release soak evidence.\n\nUsage:\n  node tools/verify-gateway-release-soak.mjs --evidence <json> --manifest <json> --candidate-sha <40-hex> --expected-run-id <id> --expected-run-attempt <id> [options]\n\nOptions:\n  --expected-duration <duration>        Exact measured duration (default 360m).\n  --expected-rate <rps>                 Exact target rate (default 10).\n  --expected-sample-interval <duration> Exact scrape interval (default 30s).\n  --expected-max-outstanding <count>    Exact client bound (default 64).\n  --min-resource-samples <count>        Required resource samples.\n  --allow-short-run                     Explicit sub-one-hour dry-run mode; never release evidence.\n  --json                                Emit compact JSON.\n  --help                                Show help.\n`);
}
