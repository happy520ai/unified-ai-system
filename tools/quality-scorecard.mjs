import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
  try {
    const result = spawnSync(command, args, {
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
    "quality-scorecard.json",
    "actions/upload-artifact",
    "--require-score 140",
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
      "gateway_error_circuit_state",
      "gateway_error_circuit_rejections_total",
      "gateway_error_circuit_open_seconds",
      "gateway_error_circuit_success_total",
      "gateway_error_circuit_failures_total",
      "AiGatewayRequestCircuitOpen",
      "gateway-error-circuit",
    ];
    const missingMarkers = requiredMarkers.filter(
      (marker) => !(serverSource.includes(marker) || exporterSource.includes(marker)
        || envSource.includes(marker) || readinessGuideSource.includes(marker)),
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
    const policySource = readTextFile("apps/ai-gateway-service/src/http/routeAccessPolicy.js");
    const envSource = readTextFile(".env.example");
    const requiredRouteMarkers = [
      "/healthz",
      "service_unready",
      "readinessFailures",
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
    const requiredPolicyMarkers = [
      "pathname === \"/healthz\"",
      "pathname === \"/ready\"",
    ];
    const missingRouteMarkers = requiredRouteMarkers.filter(
      (marker) => !routeSource.includes(marker) && !serverSource.includes(marker),
    );
    const missingEnvMarkers = requiredEnvMarkers.filter((marker) => !envSource.includes(marker));
    const missingPolicyMarkers = requiredPolicyMarkers.filter((marker) => !policySource.includes(marker));
    return {
      ok: missingRouteMarkers.length === 0 && missingEnvMarkers.length === 0 && missingPolicyMarkers.length === 0,
      details: JSON.stringify({
        missingRouteMarkers,
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
  const runtimeHardeningCheck = checkRuntimeHardening();
  const requestBodyGuardrailsCheck = checkRequestBodyGuardrails();
  const errorNormalizationCheck = checkErrorNormalization();
  const unhandledErrorTelemetryCheck = checkUnhandledErrorTelemetry();
  const metricsCheck = checkMetricsInstrumentation();
  const gatewayErrorCircuitBreakerCheck = checkGatewayErrorCircuitBreaker();
  const healthzCheck = checkHealthzReadinessProbe();
  const runbookVisibilityCheck = checkReadinessRunbookVisibility();

  const gateResults = {
    publicRepoCheck: repoCheck,
    verifyPublicClone: publicClone,
    repoFilesPresent: repoFileCheck,
    versionConsistency: versionCheck,
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
  };

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

  const maxScore = gates.reduce((sum, item) => sum + item.weight, 0);
  const summary = {
    score,
    maxScore,
    percent: Math.round((score / maxScore) * 100),
    pass: score === maxScore,
    threshold:
      requireScore > 0
        ? { required: requireScore, passed: score >= requireScore }
        : null,
    packageVersion: rootPackage.version,
    checks: gates,
    executedChecks: gateResults,
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

  if (requireScore > 0 && score < requireScore) {
    process.exitCode = 1;
  }
}

main();
