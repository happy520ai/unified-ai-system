import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import https from "node:https";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceEntrypoint = resolve(repoRoot, "apps/ai-gateway-service/src/index.js");

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const values = {
    baseUrl: null,
    tripRoute: "/provider-config/save",
    probeRoute: "/healthz",
    recoveryRoute: "/dashboard/status",
    metricsRoute: "/metrics",
    tripAttempts: readPositiveInteger(env.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD, 12),
    pollIntervalMs: 100,
    pollLimit: 50,
    openWaitMs: null,
    tripBody: "{}",
    managedGateway: false,
    dryRun: false,
    json: false,
    authToken: typeof env.AI_GATEWAY_CIRCUIT_DRILL_AUTH_TOKEN === "string"
      ? env.AI_GATEWAY_CIRCUIT_DRILL_AUTH_TOKEN.trim() || null
      : null,
    explicit: {
      tripRoute: false,
      tripAttempts: false,
      pollIntervalMs: false,
      pollLimit: false,
      openWaitMs: false,
      tripBody: false,
    },
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--managed-gateway") {
      values.managedGateway = true;
      continue;
    }
    if (arg === "--dry-run") {
      values.dryRun = true;
      continue;
    }
    if (arg === "--json") {
      values.json = true;
      continue;
    }
    if (arg === "--base-url") {
      values.baseUrl = argv[index + 1] ?? values.baseUrl;
      index += 1;
      continue;
    }
    if (arg === "--trip-route") {
      values.tripRoute = argv[index + 1] ?? values.tripRoute;
      values.explicit.tripRoute = true;
      index += 1;
      continue;
    }
    if (arg === "--probe-route") {
      values.probeRoute = argv[index + 1] ?? values.probeRoute;
      index += 1;
      continue;
    }
    if (arg === "--recovery-route") {
      values.recoveryRoute = argv[index + 1] ?? values.recoveryRoute;
      index += 1;
      continue;
    }
    if (arg === "--metrics-route") {
      values.metricsRoute = argv[index + 1] ?? values.metricsRoute;
      index += 1;
      continue;
    }
    if (arg === "--trip-attempts") {
      values.tripAttempts = readPositiveInteger(argv[index + 1], values.tripAttempts);
      values.explicit.tripAttempts = true;
      index += 1;
      continue;
    }
    if (arg === "--poll-interval-ms") {
      values.pollIntervalMs = readPositiveInteger(argv[index + 1], values.pollIntervalMs);
      values.explicit.pollIntervalMs = true;
      index += 1;
      continue;
    }
    if (arg === "--poll-limit") {
      values.pollLimit = readPositiveInteger(argv[index + 1], values.pollLimit);
      values.explicit.pollLimit = true;
      index += 1;
      continue;
    }
    if (arg === "--open-wait-ms") {
      values.openWaitMs = readPositiveInteger(argv[index + 1], values.openWaitMs);
      values.explicit.openWaitMs = true;
      index += 1;
      continue;
    }
    if (arg === "--trip-body") {
      values.tripBody = argv[index + 1] ?? values.tripBody;
      values.explicit.tripBody = true;
      index += 1;
    }
  }

  return values;
}

function buildBaseUrl(rawUrl, env = process.env) {
  return new URL(rawUrl ?? env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100");
}

async function sendRequest(base, path, method = "GET", body = "", authToken = null) {
  const requestUrl = new URL(path, base);
  assertSafeAuthTarget(requestUrl, authToken);
  const requestFn = requestUrl.protocol === "https:" ? https : http;
  const bodyBuffer = body ? Buffer.from(String(body), "utf8") : Buffer.alloc(0);
  const headers = {
    Accept: "*/*",
    "User-Agent": "circuit-drill-script/2.0",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  if (bodyBuffer.length > 0) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(bodyBuffer.length);
  }

  return new Promise((resolvePromise, reject) => {
    const request = requestFn.request({
      protocol: requestUrl.protocol,
      hostname: requestUrl.hostname,
      port: requestUrl.port,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      method,
      headers,
      timeout: 10_000,
    }, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => {
        responseBody = `${responseBody}${chunk.toString("utf8")}`.slice(0, 64_000);
      });
      response.on("end", () => resolvePromise({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: responseBody,
      }));
    });
    request.once("timeout", () => request.destroy(new Error("Circuit drill request timed out.")));
    request.once("error", reject);
    if (bodyBuffer.length > 0) request.write(bodyBuffer);
    request.end();
  });
}

function assertSafeAuthTarget(requestUrl, authToken) {
  if (!authToken || requestUrl.protocol === "https:") return;
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!loopbackHosts.has(requestUrl.hostname.toLowerCase())) {
    throw new Error("Circuit drill authentication requires HTTPS for non-loopback targets.");
  }
}

export function parseCircuitState(metricsText, stateName) {
  const metric = "(?:[A-Za-z_:][A-Za-z0-9_:]*_)?gateway_error_circuit_state";
  const pattern = new RegExp(`${metric}\\{state="${stateName}"\\}\\s+(\\d+(?:\\.\\d+)?)`);
  const match = String(metricsText).match(pattern);
  return match ? Number(match[1]) : 0;
}

export function summarizeCircuit(metricsText) {
  if (parseCircuitState(metricsText, "open") >= 1) return "open";
  if (parseCircuitState(metricsText, "half-open") >= 1) return "half-open";
  if (parseCircuitState(metricsText, "closed") >= 1) return "closed";
  return "unknown";
}

async function readProbe(base, route, authToken) {
  const response = await sendRequest(base, route, "GET", "", authToken);
  let payload = null;
  try {
    payload = JSON.parse(response.body);
  } catch {
    payload = null;
  }
  return {
    statusCode: response.statusCode,
    ready: response.statusCode === 200,
    readinessFailures: payload?.error?.details?.readinessFailures ?? [],
  };
}

async function readMetrics(base, route, authToken) {
  const response = await sendRequest(base, route, "GET", "", authToken);
  return { statusCode: response.statusCode, text: response.body };
}

function readResponseCode(body) {
  try {
    const payload = JSON.parse(body);
    return payload?.error?.code ?? payload?.code ?? null;
  } catch {
    return null;
  }
}

async function findFreePort() {
  const server = createNetServer();
  server.unref();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (!port) throw new Error("Unable to allocate a managed gateway port.");
  return port;
}

async function waitForManagedGateway(base, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Managed gateway exited before readiness with code ${child.exitCode}.`);
    }
    try {
      const response = await sendRequest(base, "/health/check");
      if (response.statusCode === 200) return;
    } catch {
      // Startup can briefly refuse connections.
    }
    await wait(100);
  }
  throw new Error("Managed gateway readiness timed out.");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), wait(3_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), wait(2_000)]);
  }
  return child.exitCode !== null || child.signalCode !== null;
}

async function startManagedGateway(options, env = process.env) {
  if (options.baseUrl) {
    throw new Error("--managed-gateway cannot be combined with --base-url.");
  }
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const authToken = randomBytes(32).toString("base64url");
  const authExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const child = spawn(process.execPath, [serviceEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...env,
      AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
      AI_GATEWAY_SERVICE_PORT: String(port),
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ROUTE_MODE: "fixed",
      AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
      AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
      AI_GATEWAY_FAKE_PRIMARY_FAIL: "true",
      AI_GATEWAY_FALLBACK_ENABLED: "false",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD: "2",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD: "2",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS: "200",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS: "2",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES: "/health,/health/check,/healthz,/ready,/setup/readiness,/metrics",
      AI_GATEWAY_ROUTE_RATE_LIMIT_ENABLED: "false",
      AI_GATEWAY_OTEL_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: authToken,
      PME_AUTH_USER_ID: "circuit-drill",
      PME_AUTH_TENANT_ID: "circuit-drill",
      PME_AUTH_ROLE: "admin",
      PME_AUTH_EXPIRES_AT: authExpiresAt,
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  const base = buildBaseUrl(baseUrl, env);
  await waitForManagedGateway(base, child);
  return { child, base, baseUrl, port, authToken };
}

function applyManagedDefaults(options) {
  if (!options.explicit.tripRoute) options.tripRoute = "/chat";
  if (!options.explicit.tripBody) {
    options.tripBody = JSON.stringify({
      prompt: "Credential-free-provider circuit recovery drill",
      providerId: "local-fake-provider",
      model: "local-fake-model",
    });
  }
  if (!options.explicit.tripAttempts) options.tripAttempts = 3;
  if (!options.explicit.pollIntervalMs) options.pollIntervalMs = 50;
  if (!options.explicit.pollLimit) options.pollLimit = 40;
  if (!options.explicit.openWaitMs) options.openWaitMs = 250;
}

function createSummary(options, base) {
  return {
    startedAt: new Date().toISOString(),
    base: base.toString(),
    probeRoute: options.probeRoute,
    tripRoute: options.tripRoute,
    recoveryRoute: options.recoveryRoute,
    metricsRoute: options.metricsRoute,
    status: "unknown",
    steps: [],
    expected: [
      "baseline health should be ready with the circuit closed",
      "retryable provider failures should produce 5xx responses",
      "the gateway circuit should enter open state and block readiness",
      "the gateway circuit should pass through half-open state",
      "successful probes should close the circuit and restore readiness",
    ],
    config: {
      managedGateway: options.managedGateway,
      tripRoute: options.tripRoute,
      probeRoute: options.probeRoute,
      recoveryRoute: options.recoveryRoute,
      metricsRoute: options.metricsRoute,
      tripAttempts: options.tripAttempts,
      pollIntervalMs: options.pollIntervalMs,
      pollLimit: options.pollLimit,
      openWaitMs: options.openWaitMs
        ?? readPositiveInteger(process.env.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS, 30_000),
    },
  };
}

async function runAgainstGateway(options, base, { authToken = null, authTokenSource = "none" } = {}) {
  const summary = createSummary(options, base);
  summary.config.authenticatedRequests = Boolean(authToken);
  summary.config.authTokenSource = authTokenSource;
  summary.config.authTokenExposed = false;
  const baselineProbe = await readProbe(base, options.probeRoute, authToken);
  const baselineMetrics = await readMetrics(base, options.metricsRoute, authToken);
  const baselineState = summarizeCircuit(baselineMetrics.text);
  summary.steps.push({
    name: "baseline",
    probeStatus: baselineProbe.statusCode,
    metricsStatus: baselineMetrics.statusCode,
    circuitState: baselineState,
    readinessFailures: baselineProbe.readinessFailures,
  });
  if (!baselineProbe.ready || baselineMetrics.statusCode !== 200 || baselineState !== "closed") {
    summary.status = "baseline-failed";
    summary.error = "Gateway baseline must be ready with a closed circuit before the drill starts.";
    return summary;
  }

  let serverFailureObserved = false;
  let openObserved = false;
  for (let attempt = 1; attempt <= options.tripAttempts; attempt += 1) {
    const response = await sendRequest(base, options.tripRoute, "POST", options.tripBody, authToken);
    const metrics = await readMetrics(base, options.metricsRoute, authToken);
    const circuitState = summarizeCircuit(metrics.text);
    const serverFailure = response.statusCode >= 500 && response.statusCode <= 599;
    serverFailureObserved ||= serverFailure;
    openObserved ||= circuitState === "open";
    summary.steps.push({
      name: "tripProbe",
      attempt,
      statusCode: response.statusCode,
      serverFailure,
      errorCode: readResponseCode(response.body),
      circuitState,
    });
    if (openObserved) break;
  }
  if (!serverFailureObserved || !openObserved) {
    summary.status = "trip-failed";
    summary.error = "The drill did not observe both a server failure and an open circuit.";
    return summary;
  }

  const openProbe = await readProbe(base, options.probeRoute, authToken);
  const openMetrics = await readMetrics(base, options.metricsRoute, authToken);
  const openState = summarizeCircuit(openMetrics.text);
  const openReadinessBlocked = openProbe.statusCode === 503
    && openProbe.readinessFailures.includes("gateway-error-circuit");
  summary.steps.push({
    name: "openReadiness",
    probeStatus: openProbe.statusCode,
    circuitState: openState,
    readinessFailures: openProbe.readinessFailures,
  });

  const waitMs = options.openWaitMs
    ?? readPositiveInteger(process.env.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS, 30_000);
  await wait(waitMs);

  const recoverySamples = [];
  let halfOpenObserved = false;
  let closedObserved = false;
  for (let attempt = 1; attempt <= options.pollLimit; attempt += 1) {
    const recoveryProbe = await readProbe(base, options.recoveryRoute, authToken);
    const probe = await readProbe(base, options.probeRoute, authToken);
    const metrics = await readMetrics(base, options.metricsRoute, authToken);
    const circuitState = summarizeCircuit(metrics.text);
    halfOpenObserved ||= circuitState === "half-open";
    closedObserved ||= circuitState === "closed"
      && recoveryProbe.statusCode === 200
      && probe.statusCode === 200;
    recoverySamples.push({
      attempt,
      circuitState,
      recoveryStatus: recoveryProbe.statusCode,
      probeStatus: probe.statusCode,
      readinessFailures: probe.readinessFailures,
    });
    if (closedObserved) break;
    await wait(options.pollIntervalMs);
  }
  summary.steps.push({
    name: "recoveryPoll",
    sampleCount: recoverySamples.length,
    samples: recoverySamples,
  });

  const finalProbe = await readProbe(base, options.probeRoute, authToken);
  const finalMetrics = await readMetrics(base, options.metricsRoute, authToken);
  const finalState = summarizeCircuit(finalMetrics.text);
  summary.steps.push({
    name: "finalState",
    probeStatus: finalProbe.statusCode,
    circuitState: finalState,
    readinessFailures: finalProbe.readinessFailures,
  });
  summary.checks = {
    baselineHealthReady: baselineProbe.ready,
    baselineClosed: baselineState === "closed",
    serverFailureObserved,
    openObserved: openObserved && openState === "open",
    openReadinessBlocked,
    halfOpenObserved,
    closedObserved: closedObserved && finalState === "closed",
    finalHealthReady: finalProbe.ready,
  };
  const recovered = Object.values(summary.checks).every(Boolean);
  summary.status = recovered ? "recovered" : "recovery-failed";
  summary.finalProbeStatus = finalProbe.statusCode;
  summary.finalCircuitState = finalState;
  summary.recommendation = recovered
    ? "Recovery verified: readiness and traffic gates returned to a closed healthy state."
    : "Keep traffic blocked and investigate the failed transition checks.";
  return summary;
}

export async function runCircuitRecoveryDrill(options = parseArgs(), env = process.env) {
  const startedAtMs = Date.now();
  if (options.dryRun) {
    const base = buildBaseUrl(options.baseUrl, env);
    const summary = createSummary(options, base);
    summary.status = "dry-run";
    summary.recommendation = "Run with --managed-gateway to collect credential-free-provider live recovery evidence with ephemeral gateway authentication.";
    summary.completedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAtMs;
    return summary;
  }

  let managed = null;
  let summary = null;
  try {
    if (options.managedGateway) {
      applyManagedDefaults(options);
      managed = await startManagedGateway(options, env);
      options.baseUrl = managed.baseUrl;
    }
    const base = managed?.base ?? buildBaseUrl(options.baseUrl, env);
    const authToken = managed?.authToken ?? options.authToken;
    summary = await runAgainstGateway(options, base, {
      authToken,
      authTokenSource: managed ? "ephemeral-managed" : authToken ? "environment" : "none",
    });
  } finally {
    if (managed) {
      const cleanedUp = await stopChild(managed.child);
      summary ??= createSummary(options, managed.base);
      summary.managedGateway = {
        enabled: true,
        host: "127.0.0.1",
        providerMode: "fake",
        realProviderEnabled: false,
        enterpriseAuthEnabled: true,
        ephemeralAuthTokenUsed: true,
        authTokenExposed: false,
        cleanedUp,
      };
      summary.realProviderCallsMade = false;
      summary.checks = {
        ...(summary.checks ?? {}),
        managedGatewayCleanedUp: cleanedUp,
      };
      if (!cleanedUp) {
        summary.status = "cleanup-failed";
        summary.error = "Managed gateway process did not terminate cleanly.";
      }
    }
  }
  summary.completedAt = new Date().toISOString();
  summary.durationMs = Date.now() - startedAtMs;
  return summary;
}

function emitResult(summary, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  process.stdout.write(`drill status: ${summary.status}\n`);
  for (const step of summary.steps ?? []) {
    process.stdout.write(`  - ${JSON.stringify(step)}\n`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const options = parseArgs();
  runCircuitRecoveryDrill(options)
    .then((summary) => {
      emitResult(summary, options.json);
      if (summary.status !== "recovered" && summary.status !== "dry-run") process.exitCode = 1;
    })
    .catch((error) => {
      const failure = {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
      emitResult(failure, options.json);
      process.exitCode = 1;
    });
}
