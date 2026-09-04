#!/usr/bin/env node

/**
 * One-attempt, isolated B.AI gateway smoke.
 *
 * The wrapper receives BAI_API_KEY, removes it from process.env, starts a
 * credential-free gateway child with isolated state, injects the key through
 * the authenticated loopback runtime-credential route, performs one governed
 * Chat Completions request, then destroys the child and temporary state.
 */

import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serviceEntry = join(repoRoot, "apps", "ai-gateway-service", "src", "index.js");
const model = String(process.env.BAI_SMOKE_MODEL ?? "qwen3.8-flash").trim();
const apiKey = String(process.env.BAI_API_KEY ?? "").trim();
delete process.env.BAI_API_KEY;

const report = {
  wrapper: "bai-provider-smoke",
  ok: false,
  phase: "preflight",
  isolated: true,
  provider: "bai",
  model,
  modelVisible: false,
  providerSelected: false,
  executionModeReal: false,
  markerMatched: false,
  providerCallAttempted: false,
  keyPassedToChildEnvironment: false,
  credentialStorage: "memory-only",
  httpStatus: null,
  errorCode: null,
  cleanup: {
    processStopped: false,
    tempRemoved: false,
  },
};

let child = null;
let stateRoot = null;

try {
  if (!apiKey || apiKey.length < 20 || /\s/.test(apiKey)) {
    throw createSmokeError("bai_api_key_missing_or_invalid");
  }
  if (!/^[A-Za-z0-9._/-]{1,160}$/.test(model)) {
    throw createSmokeError("bai_smoke_model_invalid");
  }

  const port = await reserveLoopbackPort();
  stateRoot = await mkdtemp(join(tmpdir(), "uai-bai-smoke-"));
  const authToken = randomBytes(32).toString("hex");
  const tenantId = "bai-isolated-smoke";
  const childEnv = createChildEnvironment({
    port,
    stateRoot,
    authToken,
    tenantId,
    model,
  });

  if (Object.hasOwn(childEnv, "BAI_API_KEY")) {
    throw createSmokeError("bai_key_child_environment_violation");
  }

  child = spawn(process.execPath, [serviceEntry], {
    cwd: repoRoot,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  captureBoundedOutput(child);
  const baseUrl = `http://127.0.0.1:${port}`;
  report.port = port;
  report.phase = "startup";
  await waitForGateway(baseUrl, child, 60_000);

  const mutationHeaders = {
    "content-type": "application/json",
    "x-pme-auth-token": authToken,
    "x-pme-tenant-id": tenantId,
  };
  report.phase = "credential";
  const credential = await requestJson(`${baseUrl}/providers/runtime-credential`, {
    method: "POST",
    headers: mutationHeaders,
    body: JSON.stringify({
      providerId: "bai",
      apiKey,
      modelId: model,
      source: "isolated-bai-smoke",
    }),
  }, 20_000);
  if (credential.body?.data?.apiKeyPresent !== true) {
    throw createSmokeError("runtime_credential_not_accepted");
  }

  const gatewayHeaders = {
    authorization: `Bearer ${authToken}`,
    "x-pme-tenant-id": tenantId,
  };
  report.phase = "model-visibility";
  const models = await requestJson(`${baseUrl}/v1/models`, {
    headers: gatewayHeaders,
  }, 20_000);
  report.modelVisible = Array.isArray(models.body?.data)
    && models.body.data.some((entry) => (
      entry?.id === model && entry?.unified_ai?.provider_id === "bai"
    ));
  if (!report.modelVisible) {
    throw createSmokeError("bai_model_not_visible");
  }

  report.phase = "chat";
  report.providerCallAttempted = true;
  const chat = await requestJson(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      ...gatewayHeaders,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: BAI_GATEWAY_OK" }],
      stream: false,
      max_tokens: 32,
      unified_ai: { provider_id: "bai" },
    }),
  }, 220_000);

  const content = String(chat.body?.choices?.[0]?.message?.content ?? "");
  report.providerSelected = chat.body?.unified_ai?.selected_provider === "bai";
  report.executionModeReal = chat.body?.unified_ai?.execution_mode === "real";
  report.markerMatched = content.includes("BAI_GATEWAY_OK");
  report.usage = normalizeUsage(chat.body?.usage);
  report.ok = report.providerSelected && report.executionModeReal && report.markerMatched;
  if (!report.ok) {
    throw createSmokeError("real_execution_evidence_incomplete");
  }

} catch (error) {
  report.httpStatus = Number.isInteger(error?.statusCode) ? error.statusCode : null;
  report.errorCode = normalizeErrorCode(error);
} finally {
  report.cleanup.processStopped = await stopChild(child);
  if (stateRoot) {
    try {
      await rm(stateRoot, { recursive: true, force: true });
      report.cleanup.tempRemoved = true;
    } catch {
      report.cleanup.tempRemoved = false;
    }
  } else {
    report.cleanup.tempRemoved = true;
  }
  if (!report.cleanup.processStopped || !report.cleanup.tempRemoved) {
    report.ok = false;
    report.errorCode ??= "isolated_cleanup_incomplete";
  }
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.ok ? 0 : 1);

function createChildEnvironment({ port, stateRoot, authToken, tenantId, model }) {
  const environment = {};
  for (const name of [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "LOCALAPPDATA",
    "APPDATA",
    "USERPROFILE",
    "USERNAME",
    "USERDOMAIN",
    "COMSPEC",
    "PATHEXT",
    "PROCESSOR_ARCHITECTURE",
    "NUMBER_OF_PROCESSORS",
  ]) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return {
    ...environment,
    NODE_NO_WARNINGS: "1",
    NO_COLOR: "1",
    AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
    AI_GATEWAY_SERVICE_PORT: String(port),
    AI_GATEWAY_PROVIDER_MODE: "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
    AI_GATEWAY_ENABLED_PROVIDERS: "bai",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_FALLBACK_ENABLED: "false",
    AI_GATEWAY_DEFAULT_PROVIDER: "bai",
    AI_GATEWAY_DEFAULT_MODEL: model,
    BAI_MODEL: model,
    AI_GATEWAY_REQUEST_TIMEOUT_MS: "180000",
    AI_GATEWAY_SHUTDOWN_TIMEOUT_MS: "5000",
    AI_GATEWAY_MULTI_INSTANCE: "false",
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: authToken,
    PME_AUTH_TENANT_ID: tenantId,
    PME_ENTERPRISE_USER_STORE_PATH: join(stateRoot, "users.json"),
    PME_API_KEY_STORE_PATH: join(stateRoot, "api-keys.json"),
    PME_AUDIT_LOG_PATH: join(stateRoot, "enterprise-audit.jsonl"),
    PME_AUDIT_CHAIN_PATH: join(stateRoot, "enterprise-audit.chain.jsonl"),
    PME_AUDIT_CHECKPOINT_PATH: join(stateRoot, "enterprise-audit.checkpoint.json"),
    PME_AUDIT_CHECKPOINT_HMAC_KEY: randomBytes(32).toString("hex"),
    AI_GATEWAY_USAGE_LEDGER_STORE_MODE: "file",
    AI_GATEWAY_USAGE_LOG_DIR: join(stateRoot, "usage"),
    AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE: "sqlite",
    AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH: join(stateRoot, "provider-dispatch.sqlite"),
    AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: randomBytes(32).toString("hex"),
    AI_GATEWAY_PROVIDER_DISPATCH_KEY_REQUIRED: "true",
    AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "memory",
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  };
}

async function reserveLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  if (!Number.isInteger(port)) throw createSmokeError("port_reservation_failed");
  return port;
}

async function waitForGateway(baseUrl, childProcess, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) {
      throw createSmokeError("isolated_gateway_exited_before_ready");
    }
    try {
      const health = await requestJson(`${baseUrl}/health/check`, {}, 2_000);
      if (["ready", "degraded"].includes(health.body?.data?.status)) return;
    } catch {
      // Retry only local readiness. No Provider call has occurred yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw createSmokeError("isolated_gateway_not_ready");
}

async function requestJson(url, options = {}, timeoutMs = 20_000) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const wrapped = createSmokeError(
      error?.name === "TimeoutError" ? "request_timeout" : "request_transport_failed",
    );
    wrapped.cause = error;
    throw wrapped;
  }
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    const error = createSmokeError(
      String(body?.error?.code ?? body?.code ?? `http_${response.status}`),
    );
    error.statusCode = response.status;
    throw error;
  }
  return { statusCode: response.status, body };
}

function captureBoundedOutput(childProcess) {
  let stdoutBytes = 0;
  let stderrBytes = 0;
  childProcess.stdout.on("data", (chunk) => {
    stdoutBytes = Math.min(1_000_000, stdoutBytes + chunk.length);
  });
  childProcess.stderr.on("data", (chunk) => {
    stderrBytes = Math.min(1_000_000, stderrBytes + chunk.length);
  });
  return {
    done: new Promise((resolve) => childProcess.once("close", resolve)),
    get summary() {
      return { stdoutBytes, stderrBytes };
    },
  };
}

async function stopChild(childProcess) {
  if (!childProcess || childProcess.exitCode !== null) return true;
  childProcess.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => childProcess.once("close", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 8_000)),
  ]);
  if (!exited && childProcess.exitCode === null) {
    childProcess.kill("SIGKILL");
    await new Promise((resolve) => childProcess.once("close", resolve));
  }
  return childProcess.exitCode !== null || childProcess.signalCode !== null;
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  return {
    promptTokens: Number(usage.prompt_tokens ?? 0),
    completionTokens: Number(usage.completion_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? 0),
  };
}

function createSmokeError(code) {
  const error = new Error(String(code));
  error.code = String(code);
  return error;
}

function normalizeErrorCode(error) {
  const code = String(error?.code ?? error?.name ?? "unknown_error");
  return /^[A-Za-z0-9_.:-]{1,160}$/.test(code) ? code : "redacted_error";
}
