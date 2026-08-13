import http from "node:http";
import https from "node:https";
import { setTimeout as wait } from "node:timers/promises";
import { URL } from "node:url";

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    baseUrl: null,
    tripRoute: "/provider-config/save",
    probeRoute: "/healthz",
    metricsRoute: "/metrics",
    tripAttempts: 2,
    pollIntervalMs: 1000,
    pollLimit: 20,
    openWaitMs: null,
    tripBody: "{}",
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      values.json = true;
      continue;
    }
    if (arg === "--base-url") {
      values.baseUrl = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--trip-route") {
      values.tripRoute = args[index + 1] ?? values.tripRoute;
      index += 1;
      continue;
    }
    if (arg === "--probe-route") {
      values.probeRoute = args[index + 1] ?? values.probeRoute;
      index += 1;
      continue;
    }
    if (arg === "--metrics-route") {
      values.metricsRoute = args[index + 1] ?? values.metricsRoute;
      index += 1;
      continue;
    }
    if (arg === "--trip-attempts") {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        values.tripAttempts = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--poll-interval-ms") {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        values.pollIntervalMs = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--poll-limit") {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        values.pollLimit = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--open-wait-ms") {
      const value = Number(args[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        values.openWaitMs = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--trip-body") {
      values.tripBody = args[index + 1] ?? values.tripBody;
      index += 1;
      continue;
    }
  }

  return values;
}

function buildBaseUrl(rawUrl) {
  const fallback = "http://127.0.0.1:3100";
  if (!rawUrl) {
    return new URL(process.env.AI_GATEWAY_SERVICE_URL ?? fallback);
  }
  return new URL(rawUrl);
}

async function sendRequest(base, path, method = "GET", body = "") {
  const requestUrl = new URL(path, base);
  const useHttps = requestUrl.protocol === "https:";
  const requestFn = useHttps ? https : http;
  const bodyBuffer = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from("");
  const headers = {
    Accept: "*/*",
    "User-Agent": "circuit-drill-script/1.0",
  };
  if (body) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(bodyBuffer.length);
  }

  return new Promise((resolve, reject) => {
    const request = requestFn.request({
      protocol: requestUrl.protocol,
      hostname: requestUrl.hostname,
      port: requestUrl.port,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      method,
      headers,
    }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body,
        });
      });
    });
    request.on("error", reject);
    if (body) {
      request.write(bodyBuffer);
    }
    request.end();
  });
}

function parseCircuitState(metricsText, stateName) {
  const pattern = new RegExp(`gateway_error_circuit_state\\{state="${stateName}"\\}\\s+(\\d+(?:\\.\\d+)?)`);
  const match = metricsText.match(pattern);
  return match ? Number(match[1]) : 0;
}

async function readProbe(base, route) {
  const response = await sendRequest(base, route, "GET");
  let payload = null;
  try {
    payload = JSON.parse(response.body);
  } catch {
    payload = null;
  }
  return {
    statusCode: response.statusCode,
    ready: response.statusCode === 200,
    payload,
    headers: response.headers,
  };
}

async function readMetrics(base, route) {
  const response = await sendRequest(base, route, "GET");
  return {
    statusCode: response.statusCode,
    text: response.body,
  };
}

function summarizeCircuit(metrics) {
  const open = parseCircuitState(metrics, "open");
  const halfOpen = parseCircuitState(metrics, "half-open");
  const closed = parseCircuitState(metrics, "closed");
  if (open >= 1) return "open";
  if (halfOpen >= 1) return "half-open";
  if (closed >= 1) return "closed";
  return "unknown";
}

async function pollGate(base, probeRoute, metricsRoute, pollLimit, pollIntervalMs, predicate, label) {
  const samples = [];
  for (let attempt = 0; attempt < pollLimit; attempt += 1) {
    const [probe, metrics] = await Promise.all([
      readProbe(base, probeRoute),
      readMetrics(base, metricsRoute),
    ]);
    const state = summarizeCircuit(metrics.text);
    const sample = {
      attempt,
      time: new Date().toISOString(),
      state,
      probeStatus: probe.statusCode,
      readinessFailures: probe.payload?.error?.details?.readinessFailures ?? [],
    };
    samples.push(sample);
    if (predicate(sample)) {
      return { found: true, sample, samples };
    }
    await wait(pollIntervalMs);
  }

  return { found: false, sample: null, samples };
}

async function main() {
  const args = parseArgs();
  const base = buildBaseUrl(args.baseUrl);
  const summary = {
    startedAt: new Date().toISOString(),
    base: base.toString(),
    probeRoute: args.probeRoute,
    tripRoute: args.tripRoute,
    metricsRoute: args.metricsRoute,
    status: "unknown",
    steps: [],
    expected: [
      "trip-route should return a 5xx response",
      "probe route should show open state in metrics",
      "after open-wait, circuit should enter half-open or closed",
    ],
  };

  const baseline = await readProbe(base, args.probeRoute);
  const baselineMetrics = await readMetrics(base, args.metricsRoute);
  const baselineState = summarizeCircuit(baselineMetrics.text);
  summary.steps.push({
    name: "baseline",
    statusCode: baseline.statusCode,
    circuitState: baselineState,
    readinessFailures: baseline.payload?.error?.details?.readinessFailures ?? [],
  });

  let tripSuccess = false;
  for (let attempt = 0; attempt < args.tripAttempts; attempt += 1) {
    const response = await sendRequest(base, args.tripRoute, "POST", args.tripBody);
    const tripStatus = response.statusCode;
    const failed = tripStatus >= 500;
    summary.steps.push({
      name: "tripProbe",
      attempt,
      statusCode: tripStatus,
      failed,
      bodyPreview: response.body.slice(0, 200),
    });
    if (failed) {
      tripSuccess = true;
      break;
    }
  }

  if (!tripSuccess) {
    summary.status = "trip-failed";
    summary.error = "circuit never tripped; trip route likely did not return a server-side failure in attempts";
    emitResult(summary, args.json);
    process.exitCode = 1;
    return;
  }

  const openResult = await pollGate(
    base,
    args.probeRoute,
    args.metricsRoute,
    args.pollLimit,
    args.pollIntervalMs,
    (sample) => sample.state === "open",
    "open",
  );
  summary.steps.push({
    name: "openPoll",
    found: openResult.found,
    sampleCount: openResult.samples.length,
    last: openResult.sample,
    samples: openResult.samples,
  });
  if (!openResult.found) {
    summary.status = "open-poll-timeout";
    summary.error = "circuit did not enter open state within polling window";
    emitResult(summary, args.json);
    process.exitCode = 1;
    return;
  }

  const waitMs = args.openWaitMs ?? parseInt(process.env.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS ?? "30000", 10);
  await wait(waitMs);
  const halfResult = await pollGate(
    base,
    args.probeRoute,
    args.metricsRoute,
    args.pollLimit,
    args.pollIntervalMs,
    (sample) => sample.state === "half-open" || sample.state === "closed",
    "half-open-or-closed",
  );
  summary.steps.push({
    name: "recoveryPoll",
    found: halfResult.found,
    sampleCount: halfResult.samples.length,
    last: halfResult.sample,
    samples: halfResult.samples,
  });

  if (!halfResult.found) {
    summary.status = "recovery-timeout";
    summary.error = "circuit did not recover to half-open/closed within polling window";
    emitResult(summary, args.json);
    process.exitCode = 1;
    return;
  }

  const postRecovery = await readMetrics(base, args.metricsRoute);
  summary.status = "recovered";
  summary.steps.push({
    name: "finalCircuitState",
    state: summarizeCircuit(postRecovery.text),
  });
  const finalProbe = await readProbe(base, args.probeRoute);
  summary.finalProbeStatus = finalProbe.statusCode;
  summary.finalReadinessFailures = finalProbe.payload?.error?.details?.readinessFailures ?? [];
  summary.finalHealthReady = finalProbe.ready;
  summary.recommendation = finalProbe.ready
    ? "recovered: traffic can continue after confirming dependency health"
    : "investigate service dependency health and dependency recovery path before routing traffic";
  emitResult(summary, args.json);
}

function emitResult(summary, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  process.stdout.write(`drill status: ${summary.status}\n`);
  process.stdout.write(`steps:\n`);
  for (const step of summary.steps) {
    process.stdout.write(`  - ${JSON.stringify(step)}\n`);
  }
}

main().catch((error) => {
  process.stdout.write(`drill failed: ${String(error.message)}\n`);
  process.exitCode = 1;
});
