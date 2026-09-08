#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../apps/agent-console/src/cli-core.js";
import { createGatewayApplication } from "../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { destroyAllPools } from "../apps/ai-gateway-service/src/http/connectionPool.js";
import { createGatewayHttpServer } from "../apps/ai-gateway-service/src/http/httpServer.js";
import { MCP_MODERN_PROTOCOL_VERSION } from "../packages/mcp-server/src/server.js";

const requireFromMcpPackage = createRequire(
  new URL("../packages/mcp-server/package.json", import.meta.url),
);
const { Client } = requireFromMcpPackage("@modelcontextprotocol/client");
const { StdioClientTransport } = requireFromMcpPackage("@modelcontextprotocol/client/stdio");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceIdentity = await captureSourceIdentity();
const root = await mkdtemp(join(tmpdir(), "unified-ai-control-center-smoke-"));
const previousCwd = process.cwd();
const tenantId = "control-center-smoke-tenant";
const bootstrapToken = "control-center-smoke-bootstrap-token-2026";
const profileIds = [
  "claude-compatible-mcp-json",
  "cursor-mcp-json",
  "vscode-mcp-json",
];
const targetPaths = {
  claude: join(root, "claude", "config.json"),
  cursor: join(root, "cursor", "mcp.json"),
  vscode: join(root, "vscode", "mcp.json"),
};
let application = null;
let server = null;
let output;
let currentStage = "startup";
const smokeStartedAt = Date.now();
const timingsMs = {};

try {
  process.chdir(root);
  for (const targetPath of Object.values(targetPaths)) {
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, "{}\n", "utf8");
  }

  const env = createSmokeEnvironment();
  application = createGatewayApplication(env);
  server = createGatewayHttpServer(application);
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const gatewayUrl = `http://127.0.0.1:${address.port}`;
  timingsMs.startup = Date.now() - smokeStartedAt;

  currentStage = "virtual-key-setup";
  const sharedVirtualKey = await createBudgetedVirtualKey(gatewayUrl);
  const manifestPath = join(root, "control-center.json");
  await writeFile(manifestPath, `${JSON.stringify({
    schema: "unified-ai-system/local-ai-control-center/v1",
    gatewayUrl,
    profiles: profileIds,
  }, null, 2)}\n`, "utf8");

  currentStage = "plan";
  const plan = await invokeControlCenter([
    "control-center",
    "configure",
    "--manifest",
    "control-center.json",
    "--url",
    gatewayUrl,
    "--admin-key",
    bootstrapToken,
    "--json",
  ]);
  assertControlCenterSuccess(plan, "plan");
  timingsMs.plan = plan.durationMs;
  const planned = JSON.parse(plan.stdout);
  assert.equal(planned.status, "planned");
  assert.equal(planned.clientConfigWritesPerformed, false);
  assert.equal(planned.plans.length, 3);

  currentStage = "apply";
  const apply = await invokeControlCenter([
    "control-center",
    "configure",
    "--manifest",
    "control-center.json",
    "--apply",
    "--yes",
    "--idempotency-key",
    "control-center-smoke-001",
    "--url",
    gatewayUrl,
    "--admin-key",
    bootstrapToken,
    "--json",
  ]);
  assertControlCenterSuccess(apply, "apply");
  timingsMs.apply = apply.durationMs;
  const applied = JSON.parse(apply.stdout);
  assert.equal(applied.status, "completed");
  assert.equal(applied.completed.length, 3);
  assert.equal(applied.verification.installedProfileCount, 3);
  assert.equal(applied.atomicAcrossClients, false);
  assert.equal(applied.retryAllowed, false);
  assert.ok(applied.completed.every((entry) => entry.receipt?.redacted === true));

  currentStage = "configuration-readback";
  const claude = JSON.parse(await readFile(targetPaths.claude, "utf8"));
  const cursor = JSON.parse(await readFile(targetPaths.cursor, "utf8"));
  const vscode = JSON.parse(await readFile(targetPaths.vscode, "utf8"));
  const entries = [
    claude.mcpServers?.["unified-ai-system"],
    cursor.mcpServers?.["unified-ai-system"],
    vscode.servers?.["unified-ai-system"],
  ];
  assert.ok(entries.every((entry) => entry && entry.command === process.execPath));
  currentStage = "mcp-sessions";
  const sessionsStartedAt = Date.now();
  const mcpSessions = await exerciseConfiguredMcpClients(entries, gatewayUrl, sharedVirtualKey);
  timingsMs.mcpSessions = Date.now() - sessionsStartedAt;

  currentStage = "status";
  const status = await invokeControlCenter([
    "control-center",
    "--url",
    gatewayUrl,
    "--admin-key",
    bootstrapToken,
    "--json",
  ]);
  assertControlCenterSuccess(status, "status");
  timingsMs.status = status.durationMs;
  const inspected = JSON.parse(status.stdout);
  assert.equal(inspected.ok, true);
  assert.equal(inspected.shared.models.count > 0, true);
  assert.equal(inspected.shared.budget.activeKeys, 1);
  assert.equal(inspected.shared.budget.requestCount >= 3, true);
  assert.equal(inspected.shared.budget.tokensUsed > 0, true);
  assert.equal(inspected.shared.tools.sharedByMultipleClients, true);
  const serializedConfigs = JSON.stringify([claude, cursor, vscode]);
  assert.equal(serializedConfigs.includes(bootstrapToken), false);
  assert.equal(plan.stdout.includes(bootstrapToken), false);
  assert.equal(apply.stdout.includes(bootstrapToken), false);
  assert.equal(status.stdout.includes(bootstrapToken), false);

  currentStage = "source-integrity";
  const sourceAfter = await captureSourceIdentity();
  assert.equal(sourceAfter.head, sourceIdentity.head);
  assert.equal(sourceAfter.runtimeDigest, sourceIdentity.runtimeDigest);
  output = {
    ok: true,
    source: sourceIdentity,
    timingsMs,
    checks: {
      realGatewayStarted: true,
      oneManifestPlannedThreeProfiles: planned.plans.length === 3,
      oneManifestAppliedThreeProfiles: applied.completed.length === 3,
      exactPostApplyVerification: applied.verification.installedProfileCount === 3,
      sharedModelCatalogVisible: inspected.shared.models.count > 0,
      sharedBudgetLedgerVisible: inspected.shared.budget.activeKeys === 1
        && inspected.shared.budget.requestCount >= 3
        && inspected.shared.budget.tokensUsed > 0,
      sharedMcpServerInstalled: entries.every(Boolean),
      threeMcpClientsCalledOneGateway: mcpSessions.length === 3
        && mcpSessions.every((session) => session.gatewayUrl === gatewayUrl),
      threeMcpClientsSharedOneBudget: inspected.shared.budget.requestCount >= 3,
      threeMcpClientsUsedFakeModel: mcpSessions.every((session) => (
        session.executionMode === "fake"
        && session.provider === "local-fake-provider"
      )),
      redactedReceiptsPreserved: applied.completed.every((entry) => entry.receipt?.redacted === true),
      credentialAbsentFromOutputAndConfigs: !serializedConfigs.includes(bootstrapToken)
        && !plan.stdout.includes(bootstrapToken)
        && !apply.stdout.includes(bootstrapToken)
        && !status.stdout.includes(bootstrapToken),
    },
    executionMode: "fake-provider",
    realProviderCallsMade: false,
    realClientProcessesStarted: false,
    mcpClientProcessesStarted: 3,
    sharedGatewayChatCalls: mcpSessions.length,
    clientConfigWrites: 3,
    crossClientAtomicityClaimed: false,
  };
} catch (error) {
  const code = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{0,100}$/u.test(error.code) ? error.code : "CONTROL_CENTER_SMOKE_FAILED";
  const failure = { stage: currentStage, code, kind: "isolated-smoke", elapsedMs: Date.now() - smokeStartedAt,
    source: sourceIdentity, ...(error?.controlCenterDiagnostic ? { cli: error.controlCenterDiagnostic } : {}) };
  throw new Error(`CONTROL_CENTER_SMOKE_FAILED ${JSON.stringify(failure)}`);
} finally {
  const cleanupStartedAt = Date.now();
  await closeServer(server);
  await closeApplication(application);
  await destroyAllPools();
  process.chdir(previousCwd);
  await rm(root, { recursive: true, force: true });
  timingsMs.cleanup = Date.now() - cleanupStartedAt;
  timingsMs.total = Date.now() - smokeStartedAt;
}

if (!output?.ok || !Object.values(output.checks).every(Boolean)) {
  throw new Error("Local AI control-center smoke failed.");
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

function createSmokeEnvironment() {
  const profile = (name, targetPath) => ({
    targetPath,
    allowedRoot: root,
    backupDir: join(root, `${name}-backups`),
    journalPath: join(root, `${name}-state`, "journal.json"),
    maxBytes: 65_536,
    maxTransactions: 16,
  });
  return {
    NODE_ENV: "test",
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_MULTI_INSTANCE: "false",
    AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: bootstrapToken,
    PME_AUTH_USER_ID: "control-center-smoke-admin",
    PME_AUTH_TENANT_ID: tenantId,
    PME_AUTH_ROLE: "admin",
    PME_ENTERPRISE_USER_STORE_PATH: join(root, "enterprise-users.json"),
    PME_API_KEY_STORE_PATH: join(root, "enterprise-api-keys.json"),
    PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"),
    PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_DISCOVERY_HINTS_PATH: join(root, "discovery-hints.json"),
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "true",
    AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "control-center-smoke-host",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH:
      join(root, "receipt-authority.sqlite"),
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE:
      "control-center-smoke",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS: "2592000000",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS: "600000",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS: "128",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS: "100",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF:
      "env_key_name:CONTROL_CENTER_SMOKE_ONBOARDING_ROOT_SECRET",
    CONTROL_CENTER_SMOKE_ONBOARDING_ROOT_SECRET: `hex:${"9a".repeat(32)}`,
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify({
      version: 1,
      ownerTenantId: tenantId,
      profiles: {
        claudeCompatible: profile("claude", targetPaths.claude),
        cursor: profile("cursor", targetPaths.cursor),
        vscode: profile("vscode", targetPaths.vscode),
      },
      serverDefinition: {
        transport: "stdio",
        command: process.execPath,
        args: [join(repoRoot, "packages", "mcp-server", "src", "index.js")],
        cwd: repoRoot,
      },
    }),
    AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE: "local",
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "control"),
    AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
    AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "idempotency.sqlite"),
    AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "control-center-idempotency-secret".padEnd(64, "x"),
    AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
    AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "external-effects.sqlite"),
    AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET:
      "control-center-external-effect-secret".padEnd(64, "x"),
    AI_GATEWAY_EXTERNAL_EFFECT_CENTRAL_REQUIRED: "false",
  };
}

async function createBudgetedVirtualKey(gatewayUrl) {
  const response = await fetch(`${gatewayUrl}/enterprise/virtual-keys`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bootstrapToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      role: "operator",
      tenantId,
      description: "control-center-smoke",
      budget: { limitTokens: 10_000, window: "daily", softThreshold: 0.8 },
    }),
  });
  if (!response.ok) throw new Error(`Virtual-key setup failed with HTTP ${response.status}.`);
  const payload = await response.json();
  assert.equal(typeof payload?.data?.key, "string");
  assert.equal(payload.data.record?.tenantId, tenantId);
  return payload.data.key;
}

async function exerciseConfiguredMcpClients(entries, gatewayUrl, sharedVirtualKey) {
  const results = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const client = new Client(
      { name: `control-center-smoke-client-${index + 1}`, version: "0.6.0" },
      { versionNegotiation: { mode: { pin: MCP_MODERN_PROTOCOL_VERSION } } },
    );
    const transport = new StdioClientTransport({
      command: entry.command,
      args: entry.args,
      cwd: entry.cwd,
      env: createMcpClientEnvironment(gatewayUrl, sharedVirtualKey),
    });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      assert.equal(listed.tools.some((tool) => tool.name === "gateway_chat"), true);
      const health = parseMcpToolResult(
        await client.callTool({ name: "gateway_health", arguments: {} }),
      );
      const chat = parseMcpToolResult(
        await client.callTool({
          name: "gateway_chat",
          arguments: { prompt: `Shared control-center call ${index + 1}` },
        }),
      );
      assert.equal(health.ok, true);
      assert.equal(health.gateway.managed, false);
      assert.equal(health.gateway.authVerified, true);
      assert.equal(health.gateway.authTokenExposed, false);
      assert.equal(chat.ok, true);
      results.push(Object.freeze({
        gatewayUrl: health.gateway.baseUrl,
        executionMode: chat.result.data.executionMode,
        provider: chat.result.data.selectedProvider,
      }));
    } finally {
      await client.close();
    }
  }
  return Object.freeze(results);
}

function createMcpClientEnvironment(gatewayUrl, sharedVirtualKey) {
  const env = {};
  for (const key of [
    "APPDATA",
    "COMSPEC",
    "HOME",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "PATH",
    "PATHEXT",
    "SYSTEMDRIVE",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR",
  ]) {
    if (typeof process.env[key] === "string") env[key] = process.env[key];
  }
  return {
    ...env,
    NODE_ENV: "test",
    AI_GATEWAY_MCP_URL: gatewayUrl,
    AI_GATEWAY_MCP_AUTH_TOKEN: sharedVirtualKey,
  };
}

function parseMcpToolResult(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  assert.equal(typeof text, "string");
  return JSON.parse(text);
}

async function invokeControlCenter(args) {
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";
  const code = await runCli(args, {
    cwd: root,
    env: {},
    stdout: { isTTY: false, write: (value) => { stdout += String(value); } },
    stderr: { isTTY: false, write: (value) => { stderr += String(value); } },
  });
  return { code, stdout, stderr, durationMs: Date.now() - startedAt };
}

function assertControlCenterSuccess(result, stage) {
  if (result.code === 0) return;
  let summary = null;
  try {
    const payload = JSON.parse(result.stderr || result.stdout);
    summary = {
      status: payload.status ?? null,
      kind: payload.kind ?? null,
      surface: payload.surface ?? null,
      code: payload.code ?? payload.error?.code ?? payload.failure?.code ?? null,
      durationMs: payload.durationMs ?? null,
      failedOperation: payload.failure?.operation ?? null,
    };
  } catch { /* Never print an unstructured CLI response. */ }
  throw Object.assign(new Error(`CONTROL_CENTER_SMOKE_${stage.toUpperCase()}_FAILED`), {
    controlCenterDiagnostic: { stage, exitCode: result.code, durationMs: result.durationMs, summary },
  });
}

async function captureSourceIdentity() {
  const paths = [
    "apps/agent-console/src/cli-core.js", "apps/ai-gateway-service/src/http/httpServerRoutes06.js",
    "apps/ai-gateway-service/src/http/httpServer.js", "apps/ai-gateway-service/src/http/openAiCompatibilityRoutes.js",
    "apps/ai-gateway-service/src/http/utils/healthUtils.js", "apps/ai-gateway-service/src/application/createGatewayApplication.js",
    "tools/local-ai-control-center-smoke.mjs", "package.json",
  ];
  const files = await Promise.all(paths.map(async (path) => [path, createHash("sha256").update(await readFile(resolve(repoRoot, path))).digest("hex")]));
  const git = (args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", windowsHide: true, timeout: 10_000 }).trim();
  return {
    head: git(["rev-parse", "HEAD"]),
    worktree: git(["status", "--porcelain=v1", "--untracked-files=all", "--", "apps", "packages", "tools", "package.json", ":(glob,exclude)**/.env*", ":(glob,exclude)**/.mcp.json"]) ? "dirty" : "clean",
    runtimeDigest: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
    sourceIdentityScope: "HEAD, source-worktree state, and eight relevant runtime files",
  };
}

async function closeServer(value) {
  if (!value?.listening) return;
  await new Promise((resolvePromise, reject) => {
    value.close((error) => error ? reject(error) : resolvePromise());
    value.closeAllConnections?.();
    value.closeIdleConnections?.();
  });
  await value.shutdownResources?.();
}

async function closeApplication(value) {
  if (!value) return;
  for (const resource of [
    value.localClientSmartManagementScheduler,
    value.localClientExecutionReceiptRecoveryService,
    value.localClientExecutionFeedbackDispatcher,
    value.localClientExecutionFeedbackOutbox,
    value.localClientExecutionReceiptJournalRegistry,
    value.localClientRoutePlanStore,
    value.localClientExecutionClaimStore,
    value.localClientPopIdentityAuthority,
    value.localClientVerificationService,
    value.localClientAdapterRegistry,
    value.localClientGovernedOnboardingRuntime,
    value.localClientOnboardingReceiptAuthorityStore,
    value.localClientManagementService,
    value.localClientExecutionControl,
    value.idempotencyCoordinator,
    value.workforceExecutor,
    value.requestLogger,
    value.providerDispatchGate,
    value.externalEffectGate,
    value.mcpGatewayService,
    value.enterpriseGovernanceService,
  ]) {
    await resource?.close?.();
  }
}
