import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITY_SCORECARD_ISSUE_SOURCE = "quality-scorecard";

function normalizeIssueCode(raw) {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length === 0 ? "unknown_issue" : slug;
}

function normalizeSeverity(raw) {
  const normalized = String(raw ?? "").toLowerCase();
  if (["high", "medium", "low", "info", "unknown"].includes(normalized)) {
    return normalized;
  }
  return "unknown";
}

function summarizeIssueCodes(issueCodes) {
  const summary = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
    blocking: false,
  };
  if (!Array.isArray(issueCodes)) return summary;
  for (const issue of issueCodes) {
    const severity = normalizeSeverity(issue?.severity);
    if (severity === "high") summary.high += 1;
    else if (severity === "medium") summary.medium += 1;
    else if (severity === "low") summary.low += 1;
    else if (severity === "info") summary.info += 1;
    else summary.unknown += 1;
    summary.total += 1;
  }
  summary.blocking = summary.high > 0;
  return summary;
}

function normalizeIssueCodes(rawIssueCodes, fallbackSource = QUALITY_SCORECARD_ISSUE_SOURCE) {
  const issueCodes = Array.isArray(rawIssueCodes) ? rawIssueCodes : [];
  const normalized = [];
  const seen = new Set();
  for (const issue of issueCodes) {
    const code = normalizeIssueCode(issue?.code);
    const severity = normalizeSeverity(issue?.severity);
    const key = `${code}:${severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      code,
      severity,
      message: issue?.message ? String(issue.message) : "",
      artifactPath: issue?.artifactPath ?? null,
      source: issue?.source ?? fallbackSource,
    });
  }
  return normalized;
}

function extractIssueCodesFromResult(result, fallbackSource = QUALITY_SCORECARD_ISSUE_SOURCE) {
  if (!result || typeof result !== "object") return [];
  const parseableOutput = result.parseableOutput;
  if (!parseableOutput || !Array.isArray(parseableOutput.issueCodes)) return [];
  return normalizeIssueCodes(parseableOutput.issueCodes, fallbackSource);
}

function gateWeightToSeverity(weight) {
  if (weight >= 25) return "high";
  if (weight >= 10) return "medium";
  return "low";
}

function buildIssueCodesFromQualitySummary(gates, trendHealth, drillResult, requireScore, scoreValue, maxScore) {
  const issueCodes = [];
  const addIssue = (code, message, options = {}) => {
    issueCodes.push({
      code: normalizeIssueCode(code),
      severity: normalizeSeverity(options.severity),
      message,
      artifactPath: options.artifactPath ?? "quality-scorecard",
      source: options.source ?? QUALITY_SCORECARD_ISSUE_SOURCE,
    });
  };

  for (const gate of gates) {
    if (!gate.ok) {
      addIssue(
        `quality_gate_${normalizeIssueCode(gate.name)}`,
        `${gate.name}: ${gate.details ?? "gate failed"}`,
        {
          severity: gateWeightToSeverity(gate.weight ?? 0),
          artifactPath: gate.name,
        },
      );
    }
  }

  if (requireScore > 0 && typeof scoreValue === "number" && typeof maxScore === "number" && scoreValue < requireScore) {
    addIssue(
      "quality_score_threshold_not_met",
      `quality score ${scoreValue}/${maxScore} is below required ${requireScore}`,
      {
        severity: "high",
      },
    );
  }

  if (trendHealth && trendHealth.status && trendHealth.status !== "ok") {
    addIssue(
      `quality_trend_health_${trendHealth.status}`,
      `trend health status is ${trendHealth.status}`,
      {
        severity: trendHealth.blocked ? "high" : "medium",
        artifactPath: trendHealth.source ?? "quality-scorecard",
      },
    );
  }

  if (trendHealth?.blocked) {
    addIssue("quality_trend_health_blocked", "quality trend hard block is active", {
      severity: "high",
      artifactPath: trendHealth.source ?? "quality-scorecard",
    });
  }

  const dryRunStatus = drillResult?.status;
  if (drillResult && dryRunStatus !== "dry-run") {
    addIssue(
      "quality_dry_run_invalid_status",
      `circuit recovery dry-run status is ${String(dryRunStatus)}`,
      {
        severity: "medium",
        artifactPath: "tools/circuit-recovery-drill.mjs",
      },
    );
  }

  return normalizeIssueCodes(issueCodes);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let requireScore = 0;
  let outputJson = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      outputJson = true;
      continue;
    }
    if (arg === "--require-score") {
      const rawValue = args[index + 1];
      if (rawValue && /^\d+$/.test(rawValue)) {
        requireScore = Number(rawValue);
        index += 1;
      }
      continue;
    }
    const direct = arg.match(/^--require-score=(\d+)$/);
    if (direct) {
      requireScore = Number(direct[1]);
    }
  }
  return { outputJson, requireScore };
}

function runCommand(name, command, args, options = {}) {
  const startTime = Date.now();
  const { timeoutMs = 120000 } = options;
  const resolvedCommand = command === "node" ? process.execPath : command;
  try {
    const result = spawnSync(resolvedCommand, args, {
      cwd: repoRoot,
      timeout: timeoutMs,
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const durationMs = Date.now() - startTime;
    const stdout = (result.stdout ?? "").trim();
    const stderr = (result.stderr ?? "").trim();
    const output = stdout || stderr;
    return {
      name,
      command: `${command} ${args.join(" ")}`,
      ok: result.status === 0,
      status: result.status ?? null,
      durationMs,
      output: output.slice(0, 4000),
      parseableOutput: safeParseJson(stdout) || safeParseJson(stderr),
      timedOut: false,
    };
  } catch (error) {
    return {
      name,
      command: `${command} ${args.join(" ")}`,
      ok: false,
      status: null,
      durationMs: Date.now() - startTime,
      output: String(error.message).slice(0, 4000),
      parseableOutput: null,
      timedOut: /timed out/i.test(String(error.message)),
    };
  }
}

function safeParseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  const lastBraceIndex = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (lastBraceIndex === -1) return null;
  const candidate = text.slice(0, lastBraceIndex + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function readTextFile(path) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function readJsonFile(path) {
  try {
    const raw = readTextFile(path);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validateSchemaInstance(instance, schema) {
  const issues = [];
  if (!schema || typeof schema !== "object" || schema === null) {
    return issues;
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (!(key in (instance || {}))) {
      issues.push(`missing field: ${key}`);
    }
  }

  const properties = schema.properties || {};
  for (const [field, definition] of Object.entries(properties)) {
    if (!(field in (instance || {})) || definition == null) {
      continue;
    }
    const value = instance[field];
    const type = definition.type;
    if (!type) {
      continue;
    }
    if (type === "array" && !Array.isArray(value)) {
      issues.push(`${field} expected array`);
      continue;
    }
    if (type === "object" && (value === null || typeof value !== "object" || Array.isArray(value))) {
      issues.push(`${field} expected object`);
      continue;
    }
    if (type === "string" && typeof value !== "string") {
      issues.push(`${field} expected string`);
      continue;
    }
    if (type === "number" && typeof value !== "number") {
      issues.push(`${field} expected number`);
      continue;
    }
    if (type === "boolean" && typeof value !== "boolean") {
      issues.push(`${field} expected boolean`);
      continue;
    }

    if (type === "object" && definition.required && Array.isArray(definition.required)) {
      const nestedRequired = definition.required;
      for (const nestedKey of nestedRequired) {
        if (!Object.prototype.hasOwnProperty.call(value, nestedKey)) {
          issues.push(`${field}.${nestedKey} missing`);
        }
      }
    }
  }

  return issues;
}

function addGate(gates, name, description, weight, ok, details = "") {
  gates.push({
    name,
    description,
    weight,
    ok,
    details,
  });
  return ok ? weight : 0;
}

function checkRepositoryFilesPresence(paths) {
  const missing = [];
  const present = [];
  for (const relative of paths) {
    try {
      if (readTextFile(relative)) {
        present.push(relative);
      }
    } catch {
      missing.push(relative);
    }
  }
  return { missing, present };
}

function checkVersionConsistency(rootVersion) {
  const versionedEntries = [
    "README.md",
    "README.zh-CN.md",
    "docs/index.html",
    "docs/index.zh-CN.html",
    "docs/codex-mcp-docker-quickstart.html",
  ];
  const missing = [];
  const present = [];
  for (const path of versionedEntries) {
    try {
      const content = readTextFile(path);
      if (content.includes(rootVersion)) {
        present.push(path);
      } else {
        missing.push(path);
      }
    } catch {
      missing.push(path);
    }
  }
  return { present, missing };
}

function checkPluginHardening() {
  try {
    const plugin = JSON.parse(readTextFile(".codex-plugin/plugin.json"));
    const mcp = JSON.parse(readTextFile(".mcp.json"));
    const manifestOk = plugin.version && plugin.description && plugin.interface;
    const args = mcp?.mcpServers?.["unified-ai-system"]?.args ?? [];
    const requiredFlags = [
      "--network",
      "none",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
    ];
    const missingFlags = requiredFlags.filter((flag) => !args.includes(flag));
    const descMatches = [
      (plugin.description ?? "").toLowerCase().includes("governed mcp tools"),
      (plugin.interface?.shortDescription ?? "").toLowerCase().includes("governed mcp tools"),
    ];
    return {
      ok: manifestOk && missingFlags.length === 0 && descMatches.every(Boolean),
      details: JSON.stringify({
        manifestVersion: plugin.version,
        descriptionContainsGoverned: descMatches.every(Boolean),
        missingHardeningFlags: missingFlags,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkRuntimeHardening() {
  try {
    const source = readTextFile("apps/ai-gateway-service/src/http/httpServer.js");
    const requiredMarkers = [
      "AI_GATEWAY_REQUEST_TIMEOUT_MS",
      "AI_GATEWAY_MAX_IN_FLIGHT_REQUESTS",
      "AI_GATEWAY_MAX_REQUEST_BODY_BYTES",
      "AI_GATEWAY_HEALTHZ_IN_FLIGHT_DEGRADATION_PERCENT",
      "request_payload_too_large",
      "request_timeout",
      "service_overloaded",
      "parseContentLength",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Methods",
      "AI_GATEWAY_CORS_ALLOWED_ORIGINS",
      "createGatewayResilienceMetrics",
      "Content-Security-Policy",
      "Permissions-Policy",
      "Cross-Origin-Embedder-Policy",
      "X-Permitted-Cross-Domain-Policies",
      "Cache-Control",
    ];
    const missingMarkers = requiredMarkers.filter((marker) => !source.includes(marker));
    return {
      ok: missingMarkers.length === 0,
      details: JSON.stringify({ missingMarkers }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkRequestBodyGuardrails() {
  try {
    const serverSource = readTextFile("apps/ai-gateway-service/src/http/httpServer.js");
    const utilsSource = readTextFile("apps/ai-gateway-service/src/http/utils/responseUtils.js");
    const requiredMarkers = [
      "request.maxBodyBytes",
      "resolveRequestBodyLimit",
      "request_invalid_json",
      "request_payload_too_large",
      "AI_GATEWAY_MAX_REQUEST_BODY_BYTES",
    ];
    const missingMarkers = requiredMarkers.filter(
      (marker) => !(serverSource.includes(marker) || utilsSource.includes(marker)),
    );
    return {
      ok: missingMarkers.length === 0,
      details: JSON.stringify({ missingMarkers }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkErrorNormalization() {
  try {
    const source = readTextFile("apps/ai-gateway-service/src/http/httpServer.js");
    const requiredMarkers = [
      "createNormalizedHttpError",
      "recordUnhandledError()",
      "response.writableEnded || response.headersSent",
      "error instanceof Error",
      "\"http_handler_error\"",
    ];
    const missingMarkers = requiredMarkers.filter((marker) => !source.includes(marker));
    return {
      ok: missingMarkers.length === 0,
      details: JSON.stringify({ missingMarkers }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkUnhandledErrorTelemetry() {
  try {
    const serverSource = readTextFile("apps/ai-gateway-service/src/http/httpServer.js");
    const exporterSource = readTextFile("apps/ai-gateway-service/src/observability/prometheusExporter.js");
    const requiredMarkers = [
      "recordUnhandledErrorByCode",
      "request_unhandled_error",
      "unhandledErrorCodes",
      "gateway_resilience_error_events_total",
      "elapsedMs",
    ];
    const missingMarkers = requiredMarkers.filter(
      (marker) => !(serverSource.includes(marker) || exporterSource.includes(marker)),
    );
    return {
      ok: missingMarkers.length === 0,
      details: JSON.stringify({ missingMarkers }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkWorkflowGuardrails() {
  try {
    const workflow = readTextFile(".github/workflows/ci.yml");
    const requiredMarkers = [
      "pnpm check:public",
      "pnpm verify:public-clone",
      "pnpm smoke:mcp",
      "pnpm quality:trend-health-smoke",
      "quality-scorecard.json",
      "circuit-recovery-drill-dry-run.json",
      "quality-ci-verification.json",
      "actions/upload-artifact",
      "--require-score",
      "pnpm gateway doctor --json",
      "pnpm eval:prompt-enhancement -- --json",
    ];
    const missingMarkers = requiredMarkers.filter((marker) => !workflow.includes(marker));
    return {
      ok: missingMarkers.length === 0,
      details: JSON.stringify({
        missingMarkers,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkMetricsInstrumentation() {
  try {
    const serverSource = readTextFile("apps/ai-gateway-service/src/http/httpServer.js");
    const routeSource = readTextFile("apps/ai-gateway-service/src/http/httpServerRoutes02.js");
    const exporterSource = readTextFile("apps/ai-gateway-service/src/observability/prometheusExporter.js");
    const requiredMarkers = [
      "createGatewayResilienceMetrics",
      "recordRateLimitRejected",
      "recordTimeoutTriggered",
      "recordReadinessCheck",
      "resilienceMetrics",
      "gateway_readiness_checks_total",
      "gateway_readiness_status",
      "gateway_readiness_failures",
      "gateway_readiness_events_total",
      "gateway_resilience_events_total",
      "gateway_resilience_error_events_total",
      "gateway_error_circuit_state",
      "gateway_error_circuit_open_seconds",
      "gateway_error_circuit_rejections_total",
      "gateway_error_circuit_failures_total",
      "gateway_error_circuit_success_total",
      "gateway_resilience_in_flight_peak",
      "applySecurityHeaders",
    ];
    const missingMarkers = requiredMarkers.filter(
      (marker) => !(
        serverSource.includes(marker)
        || routeSource.includes(marker)
        || exporterSource.includes(marker)
      ),
    );
    return {
      ok: missingMarkers.length === 0,
      details: JSON.stringify({ missingMarkers }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkGatewayErrorCircuitBreaker() {
  try {
    const serverSource = readTextFile("apps/ai-gateway-service/src/http/httpServer.js");
    const exporterSource = readTextFile("apps/ai-gateway-service/src/observability/prometheusExporter.js");
    const envSource = readTextFile(".env.example");
    const enterpriseEnvSource = readTextFile(".env.enterprise.example");
    const readinessGuideSource = readTextFile("docs/readiness-observability-guide.md");
    const requiredMarkers = [
      "createGatewayErrorCircuitBreaker",
      "canProcessRequest",
      "recordGatewayErrorCircuitState",
      "recordGatewayErrorCircuitRejections",
      "recordGatewayErrorCircuitFailure",
      "AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD",
      "AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD",
      "AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS",
      "AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS",
      "AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES",
      "gateway_error_circuit_state",
      "gateway_error_circuit_rejections_total",
      "gateway_error_circuit_open_seconds",
      "gateway_error_circuit_success_total",
      "gateway_error_circuit_failures_total",
      "AiGatewayRequestCircuitOpen",
      "gateway-error-circuit",
      "Request-circuit failure drill",
      "curl -sS",
      "sed -n",
      "awk '/Retry-After/",
    ];
    const missingMarkers = requiredMarkers.filter(
      (marker) => !(serverSource.includes(marker) || exporterSource.includes(marker)
        || envSource.includes(marker) || enterpriseEnvSource.includes(marker) || readinessGuideSource.includes(marker)),
    );
    return {
      ok: missingMarkers.length === 0,
      details: JSON.stringify({ missingMarkers }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkHealthzReadinessProbe() {
  try {
    const routeSource = readTextFile("apps/ai-gateway-service/src/http/httpServerRoutes02.js");
    const serverSource = readTextFile("apps/ai-gateway-service/src/http/httpServer.js");
    const exporterSource = readTextFile("apps/ai-gateway-service/src/observability/prometheusExporter.js");
    const policySource = readTextFile("apps/ai-gateway-service/src/http/routeAccessPolicy.js");
    const envSource = readTextFile(".env.example");
    const requiredRouteMarkers = [
      "/healthz",
      "service_unready",
      "readinessFailures",
      "gateway-error-circuit",
      "inflight-saturation",
      "readinessFailureCount",
      "isReady",
      "collectReadinessFailures",
      "healthzInFlightDegradationPercent",
      "healthzInFlightThreshold",
      "createErrorEnvelope",
      "createOkEnvelope",
    ];
    const requiredEnvMarkers = [
      "AI_GATEWAY_HEALTHZ_IN_FLIGHT_DEGRADATION_PERCENT",
    ];
    const requiredMetricsMarkers = [
      "gateway_readiness_status{state=\"ready\"",
      "gateway_readiness_status{state=\"degraded\"",
      "gateway_readiness_failures{reason=\"",
      "gateway_readiness_failures ",
      "gateway_error_circuit_state{state=\"open\"",
      "gateway_error_circuit_state{state=\"half-open\"",
      "gateway_error_circuit_state{state=\"closed\"",
    ];
    const requiredPolicyMarkers = [
      "pathname === \"/healthz\"",
      "pathname === \"/ready\"",
    ];
    const missingRouteMarkers = requiredRouteMarkers.filter(
      (marker) => !routeSource.includes(marker) && !serverSource.includes(marker),
    );
    const missingMetricsMarkers = requiredMetricsMarkers.filter(
      (marker) => !exporterSource.includes(marker),
    );
    const missingEnvMarkers = requiredEnvMarkers.filter((marker) => !envSource.includes(marker));
    const missingPolicyMarkers = requiredPolicyMarkers.filter((marker) => !policySource.includes(marker));
    return {
      ok: missingRouteMarkers.length === 0 && missingMetricsMarkers.length === 0
        && missingEnvMarkers.length === 0 && missingPolicyMarkers.length === 0,
      details: JSON.stringify({
        missingRouteMarkers,
        missingMetricsMarkers,
        missingEnvMarkers,
        missingPolicyMarkers,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkReadinessRunbookVisibility() {
  try {
    const architecture = readTextFile("docs/architecture.md");
    const gettingStarted = readTextFile("docs/getting-started.md");
    const readinessGuideLink = "readiness-observability-guide.md";
    const missing = [];
    if (!architecture.includes(readinessGuideLink)) {
      missing.push("docs/architecture.md");
    }
    if (!gettingStarted.includes(readinessGuideLink)) {
      missing.push("docs/getting-started.md");
    }
    return {
      ok: missing.length === 0,
      details: JSON.stringify({ missing }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkCircuitRecoveryDrill() {
  try {
    const packageSource = readTextFile("package.json");
    const scriptSource = readTextFile("tools/circuit-recovery-drill.mjs");
    const readinessGuideSource = readTextFile("docs/readiness-observability-guide.md");
    const requiredPackageMarkers = [
      "\"drill:gateway-circuit\"",
      "circuit-recovery-drill.mjs",
    ];
    const requiredGuideMarkers = [
      "Quick automated drill",
      "pnpm drill:gateway-circuit",
    ];
    const missingPackage = requiredPackageMarkers.filter((marker) => !packageSource.includes(marker));
    const missingGuide = requiredGuideMarkers.filter((marker) => !readinessGuideSource.includes(marker));
    const missingScriptMarkers = [
      "expected",
      "recommendation",
    ].filter((marker) => !scriptSource.includes(marker));
    return {
      ok: missingPackage.length === 0 && missingGuide.length === 0 && missingScriptMarkers.length === 0,
      details: JSON.stringify({
        missingPackage,
        missingGuide,
        missingScriptMarkers,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkTrendDigestOperations() {
  try {
    const packageSource = readTextFile("package.json");
    const ciWorkflowSource = readTextFile(".github/workflows/ci.yml");
    const trendWorkflowSource = readTextFile(".github/workflows/quality-trend.yml");
    const readinessGuideSource = readTextFile("docs/readiness-observability-guide.md");
    const trendGuideSource = readTextFile("docs/quality-trend-digest-guide.md");
    const trendScriptSource = readTextFile("tools/quality-trend-digest.mjs");
    const summaryScriptSource = readTextFile("tools/quality-trend-summary.mjs");
    const checkScriptSource = readTextFile("tools/quality-trend-check.mjs");
    const smokeScriptSource = readTextFile("tools/quality-trend-health-smoke.mjs");

    const requiredPackageMarkers = [
      "\"quality:trend-digest\"",
      "\"quality:trend-check\"",
      "quality-trend-digest.md",
    ];
    const requiredWorkflowMarkers = [
      "quality:trend-health-smoke --",
      "quality-trend-digest.md",
      "quality-trend-digest.json",
      "quality-trend-check.json",
      "quality-trend-recommendations.md",
      "quality-trend-incident-bundle.md",
      "quality-trend-incident-bundle.json",
      "--incident-bundle",
      "QUALITY_TREND_HARD_BLOCK",
      "quality_trend_hard_block",
      "--hard-block",
      "Append quality trend artifacts to workflow summary",
      "Upload quality scorecard artifact",
    ];
    const requiredGuideMarkers = [
      "quality trend digest",
      "pnpm quality:trend-digest",
      "quality-trend-digest.json",
      "quality:trend-check",
      "quality-trend-recommendations.md",
      "quality-trend-incident-bundle.md",
      "QUALITY_TREND_HARD_BLOCK=true",
      "quality_trend_hard_block=true",
    ];
    const requiredScriptMarkers = [
      "Operational state",
      "Latest run risk snapshot",
      "Recommended next actions",
      "Quality trend check status",
      "quality trend hard block",
      "Quality Trend Failure Remediation",
      "Quality Trend Incident Bundle",
      "incident bundle",
    ];

    const missingPackage = requiredPackageMarkers.filter((marker) => !packageSource.includes(marker));
    const missingWorkflow = requiredWorkflowMarkers.filter(
      (marker) => !ciWorkflowSource.includes(marker) && !trendWorkflowSource.includes(marker),
    );
    const missingGuide = requiredGuideMarkers.filter((marker) => !trendGuideSource.includes(marker) && !readinessGuideSource.includes(marker));
    const missingSource = requiredScriptMarkers.filter(
      (marker) => (
        !trendScriptSource.includes(marker)
        && !summaryScriptSource.includes(marker)
        && !checkScriptSource.includes(marker)
        && !smokeScriptSource.includes(marker)
      ),
    );

    return {
      ok: (
        missingPackage.length === 0
        && missingWorkflow.length === 0
        && missingGuide.length === 0
        && missingSource.length === 0
      ),
      details: JSON.stringify({
        missingPackage,
        missingWorkflow,
        missingGuide,
        missingSource,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      details: String(error.message),
    };
  }
}

function checkTrendHardBlockArtifact() {
  const trendCheck = readJsonFile(".tmp/quality-trend-check.json");
  if (!trendCheck) {
    return {
      ok: true,
      details:
        "quality-trend-check.json not present in this run; generate via quality:trend-check to populate trend health evidence.",
      blocked: false,
      status: "not_collected",
      missing: true,
      severity: "unknown",
      reasons: [],
      source: ".tmp/quality-trend-check.json",
    };
  }

  const isBlocked = Boolean(trendCheck.blocked);
  const reasons = Array.isArray(trendCheck.reasons) ? trendCheck.reasons : [];
  return {
    ok: !isBlocked,
    blocked: isBlocked,
    status: trendCheck.status ?? "unknown",
    severity: trendCheck.severity ?? "unknown",
    source: ".tmp/quality-trend-check.json",
    reasonsCount: reasons.length,
    reasons,
    details: JSON.stringify({
      status: trendCheck.status ?? "unknown",
      severity: trendCheck.severity ?? "unknown",
      blocked: isBlocked,
      source: ".tmp/quality-trend-check.json",
      reasons,
    }),
  };
}

function checkTrendIncidentBundleSchema() {
  const jsonPath = ".tmp/quality-trend-incident-bundle.json";
  const mdPath = ".tmp/quality-trend-incident-bundle.md";
  const bundle = readJsonFile(jsonPath);
  const schema = readJsonFile("tools/quality-trend-incident-bundle.schema.json");
  const bundleMarkdown = (() => {
    try {
      return readTextFile(mdPath);
    } catch {
      return "";
    }
  })();

  if (!bundle) {
    return {
      ok: true,
      status: "not_collected",
      source: jsonPath,
      missing: true,
      malformed: false,
      details: "quality-trend-incident-bundle.json is absent in this run; generated on trend-health smoke failure only.",
    };
  }

  const requiredRootKeys = [
    "executedAtUtc",
    "failureReason",
    "qualityThreshold",
    "thresholds",
    "trendHealth",
    "failedSteps",
    "artifacts",
  ];
  const missingRootKeys = requiredRootKeys.filter((key) => !(key in bundle));
  const trendHealth = typeof bundle.trendHealth === "object" && bundle.trendHealth !== null ? bundle.trendHealth : null;
  const thresholds = typeof bundle.thresholds === "object" && bundle.thresholds !== null ? bundle.thresholds : null;
  const issueTags = [];
  if (!trendHealth) {
    issueTags.push("trendHealth");
  }
  if (!thresholds) {
    issueTags.push("thresholds");
  }
  if (!Array.isArray(bundle.failedSteps)) {
    issueTags.push("failedSteps");
  }
  if (!Array.isArray(bundle.extractedIssues)) {
    issueTags.push("extractedIssues");
  }
  const artifacts = Array.isArray(bundle.artifacts) ? bundle.artifacts : [];
  const hasInvalidArtifacts = artifacts.some(
    (artifact) => !(artifact && typeof artifact.path === "string" && typeof artifact.size === "number"),
  );
  if (hasInvalidArtifacts) {
    issueTags.push("artifacts");
  }
  if (!bundleMarkdown) {
    issueTags.push("markdownMissing");
  } else {
    const hasExpectedTitle = /^#\s+Quality Trend Incident Bundle/im.test(bundleMarkdown);
    if (!hasExpectedTitle) {
      issueTags.push("markdownTitle");
    }
    if (!/##\s+Artifacts/i.test(bundleMarkdown)) {
      issueTags.push("markdownArtifactsSection");
    }
    if (!/##\s+Failed steps/i.test(bundleMarkdown)) {
      issueTags.push("markdownFailedStepsSection");
    }
  }
  const mdAndJsonPaired = bundleMarkdown && bundle;
  if (!mdAndJsonPaired) {
    issueTags.push("pairIncomplete");
  }
  if (bundle.schemaVersion !== 1) {
    issueTags.push("schemaVersion");
  }
  const schemaIssues = validateSchemaInstance(bundle, schema);
  if (schemaIssues.length > 0) {
    issueTags.push(`schema:${schemaIssues.join(";")}`);
  }
  if (!schema) {
    issueTags.push("schemaMissing");
  }

  const malformed = missingRootKeys.length > 0 || issueTags.length > 0;
  return {
    ok: !malformed,
    status: malformed ? "malformed" : "ok",
    source: jsonPath,
    missing: false,
    malformed,
    details: JSON.stringify({
      missingRootKeys,
      issueTags,
      artifactEntries: artifacts.length,
      markdownPresent: Boolean(bundleMarkdown),
      malformed,
    }),
  };
}

async function main() {
  const { outputJson, requireScore } = parseArgs();
  const rootPackage = JSON.parse(readTextFile("package.json"));
  const gates = [];

  const repoCheck = runCommand("public_repo_check", "node", ["tools/public-repo-check.mjs"], {
    timeoutMs: 180000,
  });
  const publicClone = runCommand(
    "verify_public_clone",
    "node",
    ["tools/verify-public-clone.mjs"],
    { timeoutMs: 300000 },
  );

  const repoFileCheck = checkRepositoryFilesPresence([
    "docs/sitemap.xml",
    "docs/indexnow.json",
    "docs/security/mcp-image-review-0.4.9.md",
    "docs/readiness-observability-guide.md",
  ]);
  const versionCheck = checkVersionConsistency(rootPackage.version);
  const pluginCheck = checkPluginHardening();
  const workflowCheck = checkWorkflowGuardrails();
  const circuitDrillDryRun = runCommand(
    "circuit_drill_dry_run",
    "node",
    ["tools/circuit-recovery-drill.mjs", "--dry-run", "--json"],
    { timeoutMs: 30000 },
  );
  const runtimeHardeningCheck = checkRuntimeHardening();
  const requestBodyGuardrailsCheck = checkRequestBodyGuardrails();
  const errorNormalizationCheck = checkErrorNormalization();
  const unhandledErrorTelemetryCheck = checkUnhandledErrorTelemetry();
  const metricsCheck = checkMetricsInstrumentation();
  const gatewayErrorCircuitBreakerCheck = checkGatewayErrorCircuitBreaker();
  const healthzCheck = checkHealthzReadinessProbe();
  const runbookVisibilityCheck = checkReadinessRunbookVisibility();
  const circuitRecoveryDrillCheck = checkCircuitRecoveryDrill();
  const trendDigestOperationsCheck = checkTrendDigestOperations();
  const trendHardBlockArtifactCheck = checkTrendHardBlockArtifact();
  const trendIncidentBundleSchemaCheck = checkTrendIncidentBundleSchema();

  const gateResults = {
    publicRepoCheck: repoCheck,
    verifyPublicClone: publicClone,
    repoFilesPresent: repoFileCheck,
    versionConsistency: versionCheck,
    circuitDrillDryRun,
    runtimeHardening: runtimeHardeningCheck,
    metrics: metricsCheck,
    pluginHardening: pluginCheck,
    workflowGuardrails: workflowCheck,
    requestBodyGuardrails: requestBodyGuardrailsCheck,
    errorNormalization: errorNormalizationCheck,
    unhandledErrorTelemetry: unhandledErrorTelemetryCheck,
    gatewayErrorCircuitBreaker: gatewayErrorCircuitBreakerCheck,
    healthzProbe: healthzCheck,
    readinessRunbookVisibility: runbookVisibilityCheck,
    circuitRecoveryDrill: circuitRecoveryDrillCheck,
    trendDigestOperations: trendDigestOperationsCheck,
    trendHardBlockArtifact: trendHardBlockArtifactCheck,
    trendIncidentBundleSchema: trendIncidentBundleSchemaCheck,
  };

  const drillDryRunParsed = circuitDrillDryRun.parseableOutput ?? {};
  const drillDryRunOk = circuitDrillDryRun.ok && drillDryRunParsed.status === "dry-run";

  let score = 0;
  score += addGate(
    gates,
    "Public repository hygiene",
    "tools/public-repo-check.mjs must be clean",
    30,
    repoCheck.ok,
    repoCheck.ok ? "pass" : `failed with status ${String(repoCheck.status)}`,
  );
  score += addGate(
    gates,
    "Public clone verification",
    "tools/verify-public-clone.mjs must be clean",
    30,
    publicClone.ok,
    publicClone.ok ? "pass" : `failed with status ${String(publicClone.status)}`,
  );
  score += addGate(
    gates,
    "Documentation + evidence consistency",
    "Critical public docs and required markers are aligned",
    20,
    versionCheck.missing.length === 0 && repoFileCheck.missing.length === 0,
    `missingVersionedDocs=${versionCheck.missing.join(", ") || "none"}; missingFiles=${repoFileCheck.missing.join(", ") || "none"}`,
  );
  score += addGate(
    gates,
    "Plugin security hardening",
    "plugin manifests must declare hardened MCP runtime arguments",
    10,
    pluginCheck.ok,
    pluginCheck.details,
  );
  score += addGate(
    gates,
    "Runtime resilience hardening",
    "gateway HTTP runtime adds overload, timeout, and payload guardrails",
    10,
    runtimeHardeningCheck.ok,
    runtimeHardeningCheck.details,
  );
  score += addGate(
    gates,
    "Request body guardrails",
    "request body parsing uses configured limits and returns explicit parse/size errors",
    5,
    requestBodyGuardrailsCheck.ok,
    requestBodyGuardrailsCheck.details,
  );
  score += addGate(
    gates,
    "Resilience observability",
    "gateway exposes resilience counters at /metrics",
    10,
    metricsCheck.ok,
    metricsCheck.details,
  );
  score += addGate(
    gates,
    "HTTP error normalization",
    "handler exceptions are mapped to normalized code and status output",
    5,
    errorNormalizationCheck.ok,
    errorNormalizationCheck.details,
  );
  score += addGate(
    gates,
    "Unhandled error telemetry",
    "critical request faults are categorized and visible in /metrics",
    5,
    unhandledErrorTelemetryCheck.ok,
    unhandledErrorTelemetryCheck.details,
  );
  score += addGate(
    gates,
    "Gateway-level failure circuit",
    "repeated failures can trip a dedicated request circuit breaker",
    5,
    gatewayErrorCircuitBreakerCheck.ok,
    gatewayErrorCircuitBreakerCheck.details,
  );
  score += addGate(
    gates,
    "CI gate coverage",
    "CI should cover required runtime and quality checks",
    10,
    workflowCheck.ok,
    workflowCheck.details,
  );
  score += addGate(
    gates,
    "Healthz readiness and saturation signaling",
    "health probe must degrade under saturation and return readiness context",
    10,
    healthzCheck.ok,
    healthzCheck.details,
  );
  score += addGate(
    gates,
    "Runbook discoverability",
    "readiness observability runbook is linked from architecture and getting-started docs",
    10,
    runbookVisibilityCheck.ok,
    runbookVisibilityCheck.details,
  );
  score += addGate(
    gates,
    "Recovery drill automation",
    "reliable recovery validation script is discoverable and runnable from package scripts",
    5,
    circuitRecoveryDrillCheck.ok && drillDryRunOk,
    JSON.stringify({
      checkDetails: circuitRecoveryDrillCheck.details,
      dryRunOk: drillDryRunOk,
      dryRunStatus: drillDryRunParsed.status,
      dryRunBase: drillDryRunParsed.base,
    }),
  );
  score += addGate(
    gates,
    "Trend digest operations",
    "quality trend digest is generated, archived, and documented",
    8,
    trendDigestOperationsCheck.ok,
    trendDigestOperationsCheck.details,
  );
  score += addGate(
    gates,
    "Trend hard-block policy outcome",
    "trend hard-block checks must not report blocking when CI-grade gate artifacts are present",
    7,
    trendHardBlockArtifactCheck.ok,
    trendHardBlockArtifactCheck.details,
  );
  score += addGate(
    gates,
    "Trend incident bundle schema",
    "quality-trend-incident-bundle.json should be valid and parseable when generated",
    4,
    trendIncidentBundleSchemaCheck.ok,
    trendIncidentBundleSchemaCheck.details,
  );

  const maxScore = gates.reduce((sum, item) => sum + item.weight, 0);
  const issueCodes = normalizeIssueCodes([
    ...buildIssueCodesFromQualitySummary(
      gates,
      trendHardBlockArtifactCheck,
      drillDryRunParsed,
      requireScore,
      score,
      maxScore,
    ),
    ...extractIssueCodesFromResult(repoCheck, "public-repo-check"),
    ...extractIssueCodesFromResult(publicClone, "verify-public-clone"),
  ], QUALITY_SCORECARD_ISSUE_SOURCE);
  const issueCodeSummary = summarizeIssueCodes(issueCodes);

  const summary = {
    score,
    maxScore,
    percent: Math.round((score / maxScore) * 100),
    pass: score === maxScore,
    trendHealth: {
      status: trendHardBlockArtifactCheck.status,
      severity: trendHardBlockArtifactCheck.severity,
      blocked: trendHardBlockArtifactCheck.blocked,
      reasons: Array.isArray(trendHardBlockArtifactCheck.reasons)
        ? trendHardBlockArtifactCheck.reasons.slice(0, 10)
        : [],
      source: trendHardBlockArtifactCheck.source,
      missing: trendHardBlockArtifactCheck.missing || false,
    },
    threshold:
      requireScore > 0
        ? { required: requireScore, passed: score >= requireScore }
        : null,
    packageVersion: rootPackage.version,
    checks: gates,
    executedChecks: gateResults,
    drillDryRun: drillDryRunParsed,
    issueCodes,
    issueCodeSummary,
    executedAtUtc: new Date().toISOString(),
  };

  if (outputJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    const outputLines = [
      `Quality score: ${summary.score}/${summary.maxScore} (${summary.percent}%)`,
      `Version: ${summary.packageVersion}`,
      `Status: ${summary.pass ? "PASS" : "NONCOMPLIANT"}`,
    ];
    if (requireScore > 0) {
      outputLines.push(`Required score: ${requireScore}`);
    }
    outputLines.push(
      `Issue summary: total=${issueCodeSummary.total}, high=${issueCodeSummary.high}, medium=${issueCodeSummary.medium}, low=${issueCodeSummary.low}, info=${issueCodeSummary.info}, unknown=${issueCodeSummary.unknown}`,
    );
    if (issueCodeSummary.blocking) {
      outputLines.push(`Blocking issues: ${issueCodeSummary.high}`);
    }
    outputLines.push("");
    for (const gate of gates) {
      outputLines.push(
        `${gate.ok ? "PASS" : "FAIL"} ${gate.name} (${gate.weight}) - ${gate.description}`,
      );
      if (gate.details) {
        outputLines.push(`   ${gate.details}`);
      }
    }
    process.stdout.write(`${outputLines.join("\n")}\n`);
  }

  if (trendHardBlockArtifactCheck.blocked || (requireScore > 0 && score < requireScore)) {
    process.exitCode = 1;
  }
}

main();
