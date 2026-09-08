import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  lstat,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CliUsageError,
  parseCliArgs,
  runCli,
} from "./cli-core.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const cliEntrypoint = resolve(currentDirectory, "cli.js");
const repoRoot = resolve(currentDirectory, "../../..");
const onboardingPlanId = `onboarding_${"a".repeat(64)}`;

test("parseCliArgs supports terminal commands and machine output", () => {
  const parsed = parseCliArgs(
    [
      "chat",
      "hello",
      "from",
      "the",
      "terminal",
      "--url",
      "http://127.0.0.1:43100",
      "--timeout=2500",
      "--json",
    ],
    {},
  );

  assert.equal(parsed.command, "chat");
  assert.equal(parsed.positionals.join(" "), "hello from the terminal");
  assert.equal(parsed.url, "http://127.0.0.1:43100");
  assert.equal(parsed.timeoutMs, 2500);
  assert.equal(parsed.json, true);
});

test("parseCliArgs supports prompt enhancement commands and profiles", () => {
  const preview = parseCliArgs([
    "enhance",
    "build",
    "an",
    "API",
    "--profile=coding",
  ], {});
  assert.equal(preview.command, "enhance");
  assert.equal(preview.positionals.join(" "), "build an API");
  assert.equal(preview.profile, "coding");

  const chat = parseCliArgs([
    "chat",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
  ], {});
  assert.equal(chat.enhance, true);
  assert.equal(chat.profile, "coding");
  assert.equal(chat.language, "zh-CN");

  const demo = parseCliArgs([
    "demo",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--evidence",
  ], {});
  assert.equal(demo.enhance, true);
  assert.equal(demo.profile, "coding");
  assert.equal(demo.evidence, true);

  const evidence = parseCliArgs([
    "enhance",
    "build an API",
    "--evidence",
  ], {});
  assert.equal(evidence.evidence, true);
});

test("parseCliArgs rejects ambiguous or unsafe option combinations", () => {
  assert.throws(
    () => parseCliArgs(["status", "--allow-real-provider"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with the chat"),
  );
  assert.throws(
    () => parseCliArgs(["chat", "hello", "--prompt", "world"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("either positional prompt"),
  );
  assert.throws(
    () => parseCliArgs(["serve", "--json"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("not supported by serve"),
  );
  assert.throws(
    () => parseCliArgs(["status", "--profile", "coding"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with enhance"),
  );
  assert.throws(
    () => parseCliArgs(["enhance", "hello", "--profile", "magic"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("Unsupported enhancement profile"),
  );
  assert.throws(
    () => parseCliArgs(["enhance", "hello", "--language", "fr"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("Unsupported enhancement language"),
  );
  assert.throws(
    () => parseCliArgs(["chat", "hello", "--evidence"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with the demo or enhance"),
  );
  assert.throws(
    () => parseCliArgs(["chat", "hello", "--language", "zh-CN"], {}),
    (error) =>
      error instanceof CliUsageError
      && error.message.includes("only valid with enhance"),
  );
});

test("agents parses the human governance surface and requires explicit mutation confirmation", () => {
  const env = { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" };
  assert.throws(
    () => parseCliArgs(["agents", "status"], {}),
    (error) => error instanceof CliUsageError && error.message.includes("scoped Agent Governance key"),
  );
  for (const operation of ["status", "list", "approvals"]) {
    const parsed = parseCliArgs(["agents", operation], env);
    assert.equal(parsed.command, "agents");
    assert.equal(parsed.positionals[0], operation);
  }
  assert.equal(
    parseCliArgs(["agents", "show", "--agent-id", "agt_fixture"], env).agentId,
    "agt_fixture",
  );

  const mutationCases = [
    ["generate", "--name", "reader", "--task", "Read a report"],
    ["run", "--agent-id", "agt_fixture", "--goal", "Read README"],
    ["revoke", "--agent-id", "agt_fixture"],
    ["approve", "--approval-id", "appr_fixture"],
    ["reject", "--approval-id", "appr_fixture"],
  ];
  for (const arguments_ of mutationCases) {
    assert.throws(
      () => parseCliArgs(["agents", ...arguments_], env),
      (error) => error instanceof CliUsageError && error.message.includes("--yes"),
    );
    assert.equal(
      parseCliArgs(["agents", ...arguments_, "--yes"], env).confirmed,
      true,
    );
  }

  assert.throws(
    () => parseCliArgs(["agents", "list", "--yes"], env),
    (error) => error instanceof CliUsageError && error.message.includes("only valid"),
  );
  assert.throws(
    () => parseCliArgs([
      "agents", "run", "--agent-id", "agt_fixture", "--goal", "Use paid model",
      "--provider-id", "paid-provider", "--yes",
    ], env),
    (error) => error instanceof CliUsageError && error.message.includes("--allow-real-provider"),
  );
  assert.throws(
    () => parseCliArgs(["status", "--agent-id", "agt_fixture"], env),
    (error) => error instanceof CliUsageError && error.message.includes("only valid with the agents"),
  );
});

test("forge command uses canonical positional parsing", () => {
  const status = parseCliArgs(["forge", "status"], {});
  assert.equal(status.command, "forge");
  assert.deepEqual(status.positionals, ["status"]);

  assert.throws(
    () => parseCliArgs(["forge", "polish", "make", "this", "clear"], {}),
    (error) => error instanceof CliUsageError && error.message.includes("remain disabled"),
  );
});

test("agents uses canonical v1 routes with scoped authentication", async (context) => {
  const gateway = await createAgentGovernanceMockGateway();
  context.after(gateway.close);
  const common = ["--json", "--url", gateway.url];
  const processOptions = { env: { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" } };

  const commands = [
    ["agents", "status", ...common],
    ["agents", "list", ...common],
    ["agents", "show", "--agent-id", "agt_cli_fixture", ...common],
    [
      "agents", "generate", "--name", "report-reader", "--task", "Read the report",
      "--tool", "file_read", "--ttl-seconds", "7200", "--yes", ...common,
    ],
    [
      "agents", "run", "--agent-id", "agt_cli_fixture", "--goal", "Read README",
      "--tool", "file_read", "--max-iterations", "2",
      "--provider-id", "local-fake-provider", "--yes", ...common,
    ],
    [
      "agents", "revoke", "--agent-id", "agt_cli_fixture", "--reason", "operator_requested",
      "--yes", ...common,
    ],
    ["agents", "approvals", "--agent-id", "agt_cli_fixture", ...common],
    ["agents", "approve", "--approval-id", "appr_cli_fixture", "--yes", ...common],
    ["agents", "reject", "--approval-id", "appr_cli_fixture", "--yes", ...common],
  ];
  const outputs = [];
  for (const command of commands) {
    const result = await runCliProcess(command, "", processOptions);
    assert.equal(result.code, 0, `${command.join(" ")}\n${result.stderr}`);
    const output = JSON.parse(result.stdout);
    outputs.push(output);
    assert.equal(output.ok, true);
  }
  assert.doesNotMatch(JSON.stringify(outputs), /token-value|private authorization/iu);

  assert.deepEqual(
    gateway.requests.map(({ method, path }) => `${method} ${path}`).sort(),
    [
      "GET /v1/governance/stats",
      "GET /v1/agents",
      "GET /v1/agents/agt_cli_fixture",
      "GET /v1/agents/agt_cli_fixture/effective-policy",
      "POST /v1/agents/generate",
      "POST /v1/agents/agt_cli_fixture/run",
      "POST /v1/agents/agt_cli_fixture/revoke",
      "GET /v1/approvals",
      "POST /v1/approvals/appr_cli_fixture/approve",
      "POST /v1/approvals/appr_cli_fixture/reject",
    ].sort(),
  );
  assert.ok(gateway.requests.every(({ authorization }) => authorization === "Bearer uai-mock-admin-key"));
  assert.deepEqual(gateway.last("/v1/agents/generate").body, {
    name: "report-reader",
    task: "Read the report",
    requestedTools: ["file_read"],
    ttlSeconds: 7200,
    parentAgentId: null,
  });
  assert.deepEqual(gateway.last("/v1/agents/agt_cli_fixture/run").body, {
    goal: "Read README",
    timeoutMs: 60_000,
    maxIterations: 2,
    toolMode: "readonly",
    toolAllowlist: ["file_read"],
    providerId: "local-fake-provider",
  });
  assert.deepEqual(gateway.last("/v1/agents/agt_cli_fixture/revoke").body, {
    reason: "operator_requested",
    cascade: false,
  });
});

test("agents approvals shows complete Workforce model bindings and the request versus token budget boundary", async (context) => {
  const bindings = ["ceo", "pm", "architect", "frontend-engineer", "backend-engineer", "qa", "reviewer"].map((roleId, index) => ({
    roleId, employeeId: `employee-${roleId}`, providerId: "approved-provider", modelId: `approved-model-${index}`,
    maxRequests: 1, maxInputTokens: 8192, maxOutputTokens: 2048, timeoutMs: 30000,
  }));
  const review = { schemaVersion: 1, reviewable: true, effectType: "workforce:execute", policyHash: `sha256:${"a".repeat(64)}`,
    workforce: { goal: "Review the actual employee contributions", planId: "plan-bounded", planDigest: `sha256:${"b".repeat(64)}`,
      autonomyMode: "controlled-execution", options: { selectedRoleCount: 7, templateSelected: false,
        roleExecution: { version: 1, mode: "gateway-llm-required", profileId: "reviewed-profile", profileHash: `sha256:${"c".repeat(64)}`,
          maxTotalRequests: 7, maxConcurrentRoles: 2, bindings } } } };
  const gateway = await createAgentGovernanceMockGateway({ approvalReview: review }); context.after(gateway.close);
  const args = ["agents", "approvals", "--url", gateway.url];
  const processOptions = { env: { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" } };
  const plain = await runCliProcess(args, "", processOptions);
  assert.equal(plain.code, 0, plain.stderr);
  for (const binding of bindings) {
    assert.ok(plain.stdout.includes(binding.employeeId)); assert.ok(plain.stdout.includes(binding.modelId));
  }
  assert.match(plain.stdout, /Request dispatch hard limit: 7/);
  assert.match(plain.stdout, /Concurrent roles: 2/);
  assert.match(plain.stdout, /input estimate=8192; output parameter=2048; timeout=30000ms/);
  assert.match(plain.stdout, /upstream usage/); assert.match(plain.stdout, /Unknown usage and USD cost remain null/);
  const json = await runCliProcess([...args, "--json"], "", processOptions);
  assert.equal(json.code, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).data[0].review.workforce.options.roleExecution.bindings[0].maxInputTokens, 8192);
});

test("agents approvals keeps template output compatible and rejects an unreadable Workforce token budget", async (context) => {
  const ordinary = await createAgentGovernanceMockGateway(); context.after(ordinary.close);
  const processOptions = { env: { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" } };
  const original = await runCliProcess(["agents", "approvals", "--url", ordinary.url], "", processOptions);
  assert.equal(original.code, 0); assert.match(original.stdout, /Publish the reviewed change/);
  assert.doesNotMatch(original.stdout, /Request dispatch hard limit/);
  const invalid = await createAgentGovernanceMockGateway({ approvalReview: { reviewable: true, effectType: "workforce:execute",
    workforce: { options: { roleExecution: { bindings: [{ maxInputTokens: "sensitive-token-fixture", maxOutputTokens: 5 }] } } } } });
  context.after(invalid.close);
  const response = await runCliProcess(["agents", "approvals", "--url", invalid.url], "", processOptions);
  assert.notEqual(response.code, 0); assert.doesNotMatch(response.stdout + response.stderr, /sensitive-token-fixture/);
});

test("agents run keeps transport alive beyond a shorter global timeout", async (context) => {
  const gateway = await createAgentGovernanceMockGateway({ runDelayMs: 350 });
  context.after(gateway.close);
  const result = await runCliProcess([
    "agents", "run",
    "--agent-id", "agt_cli_fixture",
    "--goal", "Wait for delayed completion",
    "--run-timeout-ms", "1000",
    "--timeout", "100",
    "--yes",
    "--json",
    "--url", gateway.url,
  ], "", { env: { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" } });

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.operation, "run");
  assert.equal(gateway.last("/v1/agents/agt_cli_fixture/run").body.timeoutMs, 1_000);
});

test("agents redacts uncertain mutation failures and forbids blind retry", async (context) => {
  const gateway = await createAgentGovernanceMockGateway({ failPath: "/v1/agents/generate" });
  context.after(gateway.close);
  const result = await runCliProcess([
    "agents", "generate", "--name", "reader", "--task", "Read", "--yes", "--json",
    "--url", gateway.url,
  ], "", { env: { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" } });

  assert.equal(result.code, 1);
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.code, "AGENT_GOVERNANCE_OUTCOME_UNKNOWN");
  assert.equal(failure.status, "unknown-reconcile-required");
  assert.equal(failure.retryAllowed, false);
  assert.doesNotMatch(result.stderr, /private|secret|token-value/iu);
  assert.equal(gateway.requests.length, 1);
});

test("forge status is reachable through the repaired command", async (context) => {
  const gateway = await createAgentGovernanceMockGateway();
  context.after(gateway.close);
  const result = await runCliProcess([
    "forge", "status", "--json", "--url", gateway.url,
  ], "", { env: { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" } });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).data.status, "ready");
  assert.equal(gateway.last("/forge/status").authorization, "Bearer uai-mock-admin-key");
});

test("status reports gateway readiness as JSON", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "status",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.status, "ready");
  assert.equal(output.providerMode, "fake");
  assert.equal(output.realProviderEnabled, false);
  assert.deepEqual(output.providers, ["local-fake-provider"]);
  assert.equal(output.chatReady, true);
});

test("control-center reports one redacted view of shared models, budget, tools, and clients", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "control-center",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.command, "control-center");
  assert.equal(output.mode, "read-only");
  assert.equal(output.writesPerformed, false);
  assert.equal(output.gateway.chatReady, true);
  assert.equal(output.shared.models.count, 1);
  assert.deepEqual(output.shared.models.items, [{
    id: "local-fake-model",
    providerId: "local-fake-provider",
    executionMode: "fake",
  }]);
  assert.equal(output.shared.budget.activeKeys, 1);
  assert.equal(output.shared.budget.tokensUsed, 4200);
  assert.equal(output.shared.tools.serverName, "unified-ai-system");
  assert.equal(output.shared.tools.sharedByMultipleClients, true);
  assert.equal(output.clients.onboarding.installedProfileCount, 3);
  assert.deepEqual(
    output.clients.onboarding.profiles.map(({ client, state }) => [client, state]),
    [["claude-compatible", "exact"], ["cursor", "exact"], ["vscode", "exact"]],
  );
  assert.equal(output.assurance.nativeModelLoginRerouted, false);
  assert.equal(output.assurance.realClientCertified, false);
  assert.equal(gateway.lastModelsAuthorization, "Bearer uai-mock-admin-key");
  assert.equal(gateway.lastSpendAuthorization, "Bearer uai-mock-admin-key");
  assert.equal(gateway.lastClientsAuthorization, "Bearer uai-mock-admin-key");
  assert.equal(gateway.lastOnboardingAuthorization, "Bearer uai-mock-admin-key");
  assert.doesNotMatch(result.stdout, /uai-mock-admin-key/);
});

test("control-center returns setup actions when fewer than two client profiles are installed", async (context) => {
  const gateway = await createMockGateway({
    missingProfileIds: ["cursor-mcp-json", "vscode-mcp-json"],
  });
  context.after(gateway.close);

  const result = await runCliProcess([
    "center",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ]);

  assert.equal(result.code, 1, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, false);
  assert.equal(output.shared.tools.sharedByMultipleClients, false);
  assert.equal(output.clients.onboarding.installedProfileCount, 1);
  assert.equal(output.nextActions.length, 1);
  assert.match(output.nextActions[0], /control-center configure/);
  assert.equal(output.writesPerformed, false);
});

test("control-center reports a safe failed surface, error code, and duration", async (context) => {
  const gateway = await createMockGateway({ modelsHttpStatus: 503 });
  context.after(gateway.close);
  const result = await runCliProcess(["control-center", "--json", "--url", gateway.url, "--admin-key", "uai-mock-admin-key"]);
  assert.equal(result.code, 1);
  const output = JSON.parse(result.stderr);
  assert.equal(output.kind, "required-surface");
  assert.equal(output.surface, "models");
  assert.equal(output.code, "CONTROL_CENTER_HTTP_503");
  assert.equal(Number.isSafeInteger(output.durationMs), true);
  assert.equal(output.durationMs >= 0, true);
  assert.doesNotMatch(result.stderr, /private-failure-payload|uai-mock-admin-key/u);
});

test("control-center refuses to perform network I/O without an admin key", async () => {
  const result = await runCliProcess([
    "control-center",
    "--url",
    "http://127.0.0.1:43199",
  ]);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /admin key/i);
  assert.doesNotMatch(result.stderr, /could not read all required gateway surfaces/i);
});

test("control-center rejects credentials embedded in the gateway URL", () => {
  assert.throws(
    () => parseCliArgs([
      "control-center",
      "--url",
      "http://user:secret@127.0.0.1:3100",
    ], { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" }),
    (error) => error instanceof CliUsageError && error.message.includes("userinfo credentials"),
  );
});

test("control-center configure plans every profile from one bounded manifest without client writes", async (context) => {
  const gateway = await createMockGateway({
    missingProfileIds: [
      "claude-compatible-mcp-json",
      "cursor-mcp-json",
      "vscode-mcp-json",
    ],
  });
  const root = await mkdtemp(join(tmpdir(), "uai-control-center-plan-"));
  context.after(async () => {
    await gateway.close();
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(
    join(root, "control-center.json"),
    JSON.stringify(controlCenterManifest(gateway.url)),
    "utf8",
  );

  const result = await runCliProcess([
    "control-center",
    "configure",
    "--manifest",
    "control-center.json",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ], "", { cwd: root });

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "planned");
  assert.equal(output.mode, "plan");
  assert.equal(output.clientConfigWritesPerformed, false);
  assert.equal(output.plans.length, 3);
  assert.equal(output.completed.length, 0);
  assert.equal(output.atomicAcrossClients, false);
  assert.equal(gateway.controlCenterRequestCount("plan"), 3);
  assert.equal(gateway.controlCenterMutationRequestCount, 0);
});

test("control-center configure applies one manifest with per-client approval, receipts, and verification", async (context) => {
  const profiles = [
    "claude-compatible-mcp-json",
    "cursor-mcp-json",
    "vscode-mcp-json",
  ];
  const gateway = await createMockGateway({ missingProfileIds: profiles });
  const root = await mkdtemp(join(tmpdir(), "uai-control-center-apply-"));
  context.after(async () => {
    await gateway.close();
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(
    join(root, "control-center.json"),
    JSON.stringify(controlCenterManifest(gateway.url)),
    "utf8",
  );

  const result = await runCliProcess([
    "control-center",
    "configure",
    "--manifest",
    "control-center.json",
    "--apply",
    "--yes",
    "--idempotency-key",
    "personal-setup-001",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ], "", { cwd: root });

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "completed");
  assert.equal(output.clientConfigWritesPerformed, true);
  assert.equal(output.completed.length, 3);
  assert.equal(output.verification.installedProfileCount, 3);
  assert.equal(output.retryAllowed, false);
  assert.equal(output.atomicAcrossClients, false);
  assert.equal(output.automaticRollbackPerformed, false);
  assert.ok(output.completed.every((entry) => entry.receipt.redacted === true));
  assert.equal(gateway.controlCenterRequestCount("approve"), 3);
  assert.equal(gateway.controlCenterRequestCount("apply"), 3);
  assert.deepEqual(gateway.controlCenterIdempotencyKeys, [
    "personal-setup-001:approve:1",
    "personal-setup-001:apply:1",
    "personal-setup-001:approve:2",
    "personal-setup-001:apply:2",
    "personal-setup-001:approve:3",
    "personal-setup-001:apply:3",
  ]);
  assert.doesNotMatch(result.stdout, /personal-setup-001/);
});

test("control-center configure stops on the first uncertain mutation and preserves completed receipts", async (context) => {
  const profiles = [
    "claude-compatible-mcp-json",
    "cursor-mcp-json",
    "vscode-mcp-json",
  ];
  const gateway = await createMockGateway({
    missingProfileIds: profiles,
    failApplyProfileId: "cursor-mcp-json",
  });
  const root = await mkdtemp(join(tmpdir(), "uai-control-center-partial-"));
  context.after(async () => {
    await gateway.close();
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(
    join(root, "control-center.json"),
    JSON.stringify(controlCenterManifest(gateway.url)),
    "utf8",
  );

  const result = await runCliProcess([
    "control-center",
    "configure",
    "--manifest",
    "control-center.json",
    "--apply",
    "--yes",
    "--idempotency-key",
    "personal-setup-002",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ], "", { cwd: root });

  assert.equal(result.code, 1, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "partial");
  assert.equal(output.completed.length, 1);
  assert.equal(output.completed[0].profileId, "claude-compatible-mcp-json");
  assert.equal(output.completed[0].receipt.redacted, true);
  assert.equal(output.failure.profileId, "cursor-mcp-json");
  assert.equal(output.failure.status, "unknown-reconcile-required");
  assert.equal(output.failure.retryAllowed, false);
  assert.equal(output.automaticRollbackPerformed, false);
  assert.equal(gateway.controlCenterRequestCount("apply"), 2);
  assert.equal(gateway.controlCenterRequestCount("rollback"), 0);
});

test("control-center does not claim no client writes when the first apply commits but loses its receipt", async (context) => {
  const profiles = ["claude-compatible-mcp-json", "cursor-mcp-json", "vscode-mcp-json"];
  const gateway = await createMockGateway({ missingProfileIds: profiles, failApplyProfileId: profiles[0], commitBeforeFailedApply: true });
  const root = await mkdtemp(join(tmpdir(), "uai-control-center-unknown-"));
  context.after(async () => { await gateway.close(); await rm(root, { recursive: true, force: true }); });
  await writeFile(join(root, "control-center.json"), JSON.stringify(controlCenterManifest(gateway.url)), "utf8");
  const result = await runCliProcess([
    "control-center", "configure", "--manifest", "control-center.json", "--apply", "--yes",
    "--idempotency-key", "unknown-first-apply", "--json", "--url", gateway.url, "--admin-key", "uai-mock-admin-key",
  ], "", { cwd: root });
  assert.equal(result.code, 1, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.completed.length, 0);
  assert.equal(output.verification.profiles[0].installed, true);
  assert.equal(output.clientConfigWritesPerformed, null);
  assert.equal(output.clientConfigOutcomeUnknown, true);
  assert.equal(output.status, "unknown-reconcile-required");
  assert.equal(output.failure.operation, "apply");
  assert.equal(output.retryAllowed, false);
  assert.equal(output.automaticRollbackPerformed, false);
  assert.equal(gateway.controlCenterRequestCount("apply"), 1);
  assert.equal(gateway.controlCenterRequestCount("rollback"), 0);
});

test("control-center configure rejects unsafe manifests and incomplete mutation authority before I/O", async (context) => {
  const gateway = await createMockGateway();
  const root = await mkdtemp(join(tmpdir(), "uai-control-center-invalid-"));
  context.after(async () => {
    await gateway.close();
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(join(root, "one-client.json"), JSON.stringify({
    ...controlCenterManifest(gateway.url),
    profiles: ["cursor-mcp-json"],
  }), "utf8");

  const invalid = await runCliProcess([
    "control-center",
    "configure",
    "--manifest",
    "one-client.json",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ], "", { cwd: root });
  assert.equal(invalid.code, 2);
  assert.equal(gateway.controlCenterRequestCount(), 0);

  assert.throws(
    () => parseCliArgs([
      "control-center",
      "configure",
      "--manifest",
      "control-center.json",
      "--apply",
      "--yes",
    ], { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" }),
    (error) => error instanceof CliUsageError && error.message.includes("idempotency-key"),
  );
});

test("spend reports per-key token spend with an admin key", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "spend",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.lastSpendAuthorization, "Bearer uai-mock-admin-key");
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.totals.tokensUsed, 4200);
  assert.equal(output.rows[0].keyId, "abc123def456");
  assert.equal(output.rows[0].budget.softBudgetExceeded, true);
});

test("spend refuses to run without an admin key", async () => {
  const result = await runCliProcess(["spend", "--url", "http://127.0.0.1:43199"]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /admin key/i);
});

test("clients reports the redacted local-client registry with an admin key", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "clients",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.lastClientsAuthorization, "Bearer uai-mock-admin-key");
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.mode, "preview-only");
  assert.equal(output.status.boundaries.tenantScoped, true);
  assert.equal(output.registry.total, 1);
  assert.equal(output.registry.clients[0].clientId, "desktop-browser");
  assert.equal("executable" in output.registry.clients[0], false);
  assert.equal("metadata" in output.registry.clients[0], false);
  assert.equal(output.onboarding.available, true);
  assert.equal(output.onboarding.certificationStatus, "fixture-tested-not-real-client-certified");
  assert.deepEqual(
    output.onboarding.profiles.map((profile) => profile.client),
    ["claude-compatible", "cursor", "vscode"],
  );
  assert.equal(gateway.lastOnboardingAuthorization, "Bearer uai-mock-admin-key");
});

test("clients text output lists supported onboarding profiles without mutating config", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "clients",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Claude-compatible: claude-compatible-mcp-json/);
  assert.match(result.stdout, /Cursor: cursor-mcp-json/);
  assert.match(result.stdout, /VS Code: vscode-mcp-json/);
  assert.match(result.stdout, /inspection only; no config changed/);
});

test("clients degrades safely when onboarding is disabled", async (context) => {
  const gateway = await createMockGateway({
    onboardingStatusCode: 503,
    onboardingErrorCode: "LOCAL_CLIENT_ONBOARDING_DISABLED",
    onboardingErrorMessage: "disabled service detail must stay private",
  });
  context.after(gateway.close);

  const result = await runCliProcess([
    "clients",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.onboarding, {
    available: false,
    code: "LOCAL_CLIENT_ONBOARDING_DISABLED",
  });
  assert.equal(output.registry.total, 1);
  assert.doesNotMatch(result.stdout, /disabled service detail must stay private/);
});

test("clients never exposes an onboarding error body, path, or command", async (context) => {
  const gateway = await createMockGateway({
    onboardingStatusCode: 503,
    onboardingErrorCode: "C:\\private\\secret-command.exe",
    onboardingErrorMessage: "launch --token secret-value",
    onboardingErrorPath: "C:\\Users\\secret\\client.json",
    onboardingErrorCommand: "powershell.exe -File private.ps1",
  });
  context.after(gateway.close);

  const result = await runCliProcess([
    "clients",
    "--json",
    "--url",
    gateway.url,
    "--admin-key",
    "uai-mock-admin-key",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.onboarding, {
    available: false,
    code: "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE",
  });
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(combined, /secret-command|secret-value|client\.json|private\.ps1|powershell/i);
});

test("clients refuses to run without an admin key", async () => {
  const result = await runCliProcess(["clients", "--url", "http://127.0.0.1:43199"]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /admin key/i);
});

test("clients lifecycle accepts only bounded non-secret operator inputs", () => {
  const parsed = parseCliArgs([
    "clients",
    "discover",
    "--max-processes",
    "50",
    "--include-unknown",
  ], { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" });
  assert.equal(parsed.command, "clients");
  assert.deepEqual(parsed.positionals, ["discover"]);
  assert.equal(parsed.lifecycleApply, false);
  assert.equal(parsed.confirmed, false);

  for (const flag of [
    "--target-path",
    "--command",
    "--env",
    "--api-key",
    "--token",
    "--tenant-id",
    "--subject-id",
  ]) {
    assert.throws(
      () => parseCliArgs([
        "clients",
        "register",
        "--client-id",
        "safe-client",
        "--capability",
        "browser",
        flag,
        "operator-supplied-secret-or-authority",
      ], { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" }),
      (error) => error instanceof CliUsageError && error.message.includes("Unknown option"),
    );
  }
  assert.throws(
    () => parseCliArgs([
      "clients",
      "discover",
      "--apply",
    ], { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" }),
    (error) => error instanceof CliUsageError && error.message.includes("--yes"),
  );
  for (const clientId of ["Foo:Bar", "9router-client", "client:colon"]) {
    assert.throws(
      () => parseCliArgs([
        "clients",
        "inspect",
        "--client-id",
        clientId,
      ], { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" }),
      (error) => error instanceof CliUsageError && error.message.includes("lowercase letter-leading"),
    );
  }
  for (const capability of ["9router:cap", "Uppercase", "cap:colon"]) {
    assert.throws(
      () => parseCliArgs([
        "clients",
        "register",
        "--client-id",
        "safe-client",
        "--capability",
        capability,
        "--yes",
      ], { AGENT_CONSOLE_ADMIN_KEY: "uai-mock-admin-key" }),
      (error) => error instanceof CliUsageError && error.message.includes("--capability"),
    );
  }
});

test("clients list and inspect expose only allowlisted registry fields", async (context) => {
  const gateway = await createLifecycleMockGateway();
  context.after(gateway.close);

  const listed = await runCliProcess([
    "clients",
    "list",
    "--include-disabled",
    "--limit",
    "20",
    "--offset",
    "0",
    "--capability",
    "browser",
    "--admin-key",
    "uai-mock-admin-key",
    "--json",
    "--url",
    gateway.url,
  ]);
  assert.equal(listed.code, 0, listed.stderr);
  const listOutput = JSON.parse(listed.stdout);
  assert.equal(listOutput.mode, "read-only");
  assert.equal(listOutput.writesPerformed, false);
  assert.equal(listOutput.data.source, "registry-list");
  assert.equal(listOutput.data.clients[0].clientId, "fixture-client");
  assert.equal("executable" in listOutput.data.clients[0], false);
  assert.equal("metadata" in listOutput.data.clients[0], false);
  assert.doesNotMatch(listed.stdout, /private-command|secret-path|token-value/i);

  const inspected = await runCliProcess([
    "clients",
    "inspect",
    "--client-id",
    "fixture-client",
    "--admin-key",
    "uai-mock-admin-key",
    "--url",
    gateway.url,
  ]);
  assert.equal(inspected.code, 0, inspected.stderr);
  assert.match(inspected.stdout, /Source: registry-list \(not an independent authoritative read\)/);
  assert.match(inspected.stdout, /Configuration writes: none/);
  assert.equal(gateway.requestCount("list"), 2);
});

test("clients discover and smart-manage default to dry-run without --yes", async (context) => {
  const gateway = await createLifecycleMockGateway();
  context.after(gateway.close);

  const discovered = await runCliProcess([
    "clients",
    "discover",
    "--max-processes",
    "50",
    "--include-unknown",
    "--admin-key",
    "uai-mock-admin-key",
    "--json",
    "--url",
    gateway.url,
  ]);
  assert.equal(discovered.code, 0, discovered.stderr);
  const discoverOutput = JSON.parse(discovered.stdout);
  assert.equal(discoverOutput.mode, "dry-run");
  assert.equal(discoverOutput.writesPerformed, false);
  assert.equal(discoverOutput.data.droppedCount, 6);
  assert.deepEqual(gateway.last("discover").body, {
    dryRun: true,
    maxProcesses: 50,
    includeUnknown: true,
  });

  const managed = await runCliProcess([
    "clients",
    "smart-manage",
    "--admin-key",
    "uai-mock-admin-key",
    "--json",
    "--url",
    gateway.url,
  ]);
  assert.equal(managed.code, 0, managed.stderr);
  const manageOutput = JSON.parse(managed.stdout);
  assert.equal(manageOutput.mode, "dry-run");
  assert.equal(manageOutput.data.recommendationCount, 1);
  assert.equal(manageOutput.data.discovery.droppedCount, 6);
  assert.doesNotMatch(managed.stdout, /secret-path|private-command|token-value/i);
  assert.deepEqual(gateway.last("smart-manage").body, { dryRun: true });
  assert.equal(gateway.mutationRequestCount, 0);
});

test("clients lifecycle mutations fail locally without exact confirmation facts", async (context) => {
  const gateway = await createLifecycleMockGateway();
  context.after(gateway.close);
  const common = ["--admin-key", "uai-mock-admin-key", "--url", gateway.url];
  const cases = [
    ["register", "--client-id", "new-client", "--capability", "browser"],
    [
      "verify",
      "--client-id",
      "fixture-client",
      "--revision",
      "7",
      "--adapter-id",
      "loopback.adapter",
      "--adapter-type",
      "loopback-http",
      "--adapter-version",
      "1.0.0",
      "--manifest-sha256",
      "a".repeat(64),
    ],
    ["disable", "--client-id", "fixture-client"],
    ["revoke", "--client-id", "fixture-client", "--yes"],
    ["discover", "--apply"],
    ["smart-manage", "--apply"],
  ];
  for (const args of cases) {
    const result = await runCliProcess(["clients", ...args, ...common]);
    assert.notEqual(result.code, 0);
  }
  assert.equal(gateway.requestCount(), 0);
});

test("clients register, verify, disable, and revoke send minimal one-shot mutations", async (context) => {
  const gateway = await createLifecycleMockGateway();
  context.after(gateway.close);
  const common = [
    "--admin-key",
    "uai-mock-admin-key",
    "--yes",
    "--url",
    gateway.url,
  ];
  const adapter = [
    "--adapter-id",
    "loopback.adapter",
    "--adapter-type",
    "loopback-http",
    "--adapter-version",
    "1.0.0",
    "--manifest-sha256",
    "a".repeat(64),
  ];

  const registered = await runCliProcess([
    "clients",
    "register",
    "--client-id",
    "fixture-client",
    "--display-name",
    "Fixture Client",
    "--capability",
    "browser",
    ...adapter,
    ...common,
    "--json",
  ]);
  assert.equal(registered.code, 0, registered.stderr);
  assert.equal(JSON.parse(registered.stdout).retryAllowed, false);
  assert.deepEqual(gateway.last("register").body, {
    clientId: "fixture-client",
    displayName: "Fixture Client",
    capabilityIds: ["browser"],
    adapterId: "loopback.adapter",
    adapterType: "loopback-http",
    adapterVersion: "1.0.0",
    manifestSha256: "a".repeat(64),
  });

  const verified = await runCliProcess([
    "clients",
    "verify",
    "--client-id",
    "fixture-client",
    "--revision",
    "7",
    ...adapter,
    ...common,
    "--json",
  ]);
  assert.equal(verified.code, 0, verified.stderr);
  assert.deepEqual(gateway.last("verify").body, {
    clientId: "fixture-client",
    expectedRevision: 7,
    expectedAdapter: {
      id: "loopback.adapter",
      type: "loopback-http",
      version: "1.0.0",
    },
    expectedManifestSha256: "a".repeat(64),
  });

  const disabled = await runCliProcess([
    "clients",
    "disable",
    "--client-id",
    "fixture-client",
    "--reason",
    "security_review",
    ...common,
  ]);
  assert.equal(disabled.code, 0, disabled.stderr);
  assert.match(disabled.stdout, /Automatic retry: forbidden/);
  assert.deepEqual(gateway.last("disable").body, {
    clientId: "fixture-client",
    reason: "security_review",
  });

  const revoked = await runCliProcess([
    "clients",
    "revoke",
    "--client-id",
    "fixture-client",
    "--revision",
    "7",
    "--reason",
    "security_incident",
    ...common,
    "--json",
  ]);
  assert.equal(revoked.code, 0, revoked.stderr);
  assert.deepEqual(gateway.last("revoke").body, {
    clientId: "fixture-client",
    expectedRevision: 7,
    reason: "security_incident",
  });

  for (const operation of ["register", "verify", "disable", "revoke"]) {
    assert.equal(gateway.requestCount(operation), 1);
    assert.equal(gateway.last(operation).authorization, "Bearer uai-mock-admin-key");
    assert.equal(gateway.last(operation).idempotencyKey, null);
  }
});

test("clients discover and smart-manage mutate only with --apply --yes", async (context) => {
  const gateway = await createLifecycleMockGateway();
  context.after(gateway.close);
  const common = [
    "--apply",
    "--yes",
    "--admin-key",
    "uai-mock-admin-key",
    "--url",
    gateway.url,
  ];
  const discovered = await runCliProcess([
    "clients",
    "discover",
    "--auto-discover-all",
    ...common,
    "--json",
  ]);
  assert.equal(discovered.code, 0, discovered.stderr);
  assert.equal(JSON.parse(discovered.stdout).mode, "governed-mutation");
  assert.deepEqual(gateway.last("discover").body, {
    dryRun: false,
    autoDiscoverAll: true,
  });

  const managed = await runCliProcess([
    "clients",
    "smart-manage",
    ...common,
  ]);
  assert.equal(managed.code, 0, managed.stderr);
  assert.match(managed.stdout, /Automatic retry: forbidden/);
  assert.deepEqual(gateway.last("smart-manage").body, { dryRun: false });
  assert.equal(gateway.mutationRequestCount, 2);
});

test("clients mutation errors are redacted, unknown, and never retried", async (context) => {
  const gateway = await createLifecycleMockGateway({
    errorOperation: "disable",
    errorCode: "C:\\private\\secret-command.exe",
  });
  context.after(gateway.close);
  const result = await runCliProcess([
    "clients",
    "disable",
    "--client-id",
    "fixture-client",
    "--yes",
    "--admin-key",
    "uai-mock-admin-key",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 1);
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: "clients",
    operation: "disable",
    status: "unknown-reconcile-required",
    code: "LOCAL_CLIENT_LIFECYCLE_OUTCOME_UNKNOWN",
    retryAllowed: false,
  });
  assert.doesNotMatch(result.stderr, /private|secret|powershell|token|client\.json/i);
  assert.equal(gateway.requestCount("disable"), 1);
});

test("clients read errors expose only an allowlisted code", async (context) => {
  const gateway = await createLifecycleMockGateway({
    errorOperation: "list",
    errorCode: "C:\\private\\registry-command.exe",
  });
  context.after(gateway.close);
  const result = await runCliProcess([
    "clients",
    "list",
    "--admin-key",
    "uai-mock-admin-key",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 1);
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: "clients",
    operation: "list",
    status: "rejected",
    code: "LOCAL_CLIENT_LIFECYCLE_UNAVAILABLE",
    retryAllowed: false,
  });
  assert.doesNotMatch(result.stderr, /private|secret|powershell|token|client\.json/i);
  assert.equal(gateway.requestCount("list"), 1);
});

test("clients-onboarding accepts only the bounded operator input surface", () => {
  const parsed = parseCliArgs([
    "clients-onboarding",
    "plan",
    "--profile-id",
    "cursor-mcp-json",
    "--action",
    "enable",
  ], {});
  assert.equal(parsed.command, "clients-onboarding");
  assert.deepEqual(parsed.positionals, ["plan"]);
  assert.equal(parsed.onboardingProfileId, "cursor-mcp-json");
  assert.equal(parsed.onboardingAction, "enable");

  for (const flag of ["--target-path", "--command", "--env", "--scope", "--digest"]) {
    assert.throws(
      () => parseCliArgs([
        "clients-onboarding",
        "plan",
        "--profile-id",
        "cursor-mcp-json",
        "--action",
        "enable",
        flag,
        "operator-supplied-authority",
      ], {}),
      (error) => error instanceof CliUsageError && error.message.includes("Unknown option"),
    );
  }
});

test("clients-onboarding profiles, inspect, verify, and plan remain read-only", async (context) => {
  const gateway = await createOnboardingMockGateway();
  context.after(gateway.close);

  const profiles = await runCliProcess([
    "clients-onboarding",
    "profiles",
    "--json",
    "--url",
    gateway.url,
  ]);
  assert.equal(profiles.code, 0, profiles.stderr);
  const profilesOutput = JSON.parse(profiles.stdout);
  assert.equal(profilesOutput.mode, "read-only");
  assert.equal(profilesOutput.writesPerformed, false);
  assert.equal(profilesOutput.data.profiles.length, 3);

  const inspect = await runCliProcess([
    "clients-onboarding",
    "inspect",
    "--profile-id",
    "cursor-mcp-json",
    "--json",
    "--url",
    gateway.url,
  ]);
  assert.equal(inspect.code, 0, inspect.stderr);
  assert.equal(JSON.parse(inspect.stdout).data.installation.state, "exact");

  const verify = await runCliProcess([
    "clients-onboarding",
    "verify",
    "--profile-id",
    "cursor-mcp-json",
    "--json",
    "--url",
    gateway.url,
  ]);
  assert.equal(verify.code, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).data.redacted, true);

  const plan = await runCliProcess([
    "clients-onboarding",
    "plan",
    "--profile-id",
    "cursor-mcp-json",
    "--action",
    "enable",
    "--url",
    gateway.url,
  ]);
  assert.equal(plan.code, 0, plan.stderr);
  assert.match(plan.stdout, /Mode: read-only/);
  assert.match(plan.stdout, /Configuration writes: none/);
  assert.deepEqual(gateway.last("plan").body, {
    profileId: "cursor-mcp-json",
    action: "enable",
  });
  assert.equal(gateway.mutationRequestCount, 0);
});

test("clients-onboarding mutations require admin, yes, idempotency, and plan id before I/O", async (context) => {
  const gateway = await createOnboardingMockGateway();
  context.after(gateway.close);
  const base = ["--url", gateway.url, "--json"];
  const cases = [
    [
      "approve",
      "--plan-id",
      onboardingPlanId,
      "--yes",
      "--idempotency-key",
      "approve-key",
    ],
    [
      "apply",
      "--plan-id",
      onboardingPlanId,
      "--admin-key",
      "uai-mock-admin-key",
      "--idempotency-key",
      "apply-key",
    ],
    [
      "rollback",
      "--plan-id",
      onboardingPlanId,
      "--admin-key",
      "uai-mock-admin-key",
      "--yes",
      "--idempotency-key",
      "has space",
    ],
    [
      "recover",
      "--admin-key",
      "uai-mock-admin-key",
      "--yes",
      "--idempotency-key",
      "recover-key",
    ],
  ];

  for (const args of cases) {
    const result = await runCliProcess(
      ["clients-onboarding", ...args, ...base],
      "",
      { env: { AGENT_CONSOLE_ADMIN_KEY: "", PME_AUTH_TOKEN: "" } },
    );
    assert.notEqual(result.code, 0);
  }
  assert.equal(gateway.mutationRequestCount, 0);
});

test("clients-onboarding rollback plan reads only a bounded exact redacted receipt", async (context) => {
  const gateway = await createOnboardingMockGateway();
  const temporaryRoot = await mkdtemp(join(tmpdir(), "uai-cli-onboarding-"));
  const workspace = join(temporaryRoot, "workspace");
  await mkdir(workspace);
  context.after(gateway.close);
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }));

  const receipt = onboardingApplyReceipt();
  await writeFile(join(workspace, "receipt.json"), JSON.stringify(receipt), "utf8");
  const accepted = await runCliProcess([
    "clients-onboarding",
    "plan",
    "--profile-id",
    "cursor-mcp-json",
    "--action",
    "rollback",
    "--receipt-file",
    "receipt.json",
    "--json",
    "--url",
    gateway.url,
  ], "", { cwd: workspace });
  assert.equal(accepted.code, 0, accepted.stderr);
  assert.deepEqual(gateway.last("plan").body, {
    profileId: "cursor-mcp-json",
    action: "rollback",
    receipt,
  });

  await writeFile(join(temporaryRoot, "outside.json"), JSON.stringify(receipt), "utf8");
  const escaped = await runCliProcess([
    "clients-onboarding",
    "plan",
    "--profile-id",
    "cursor-mcp-json",
    "--action",
    "rollback",
    "--receipt-file",
    "../outside.json",
    "--url",
    gateway.url,
  ], "", { cwd: workspace });
  assert.notEqual(escaped.code, 0);
  assert.match(escaped.stderr, /current working directory/i);

  await writeFile(join(workspace, "oversized.json"), "x".repeat(64 * 1024 + 1), "utf8");
  const oversized = await runCliProcess([
    "clients-onboarding",
    "plan",
    "--profile-id",
    "cursor-mcp-json",
    "--action",
    "rollback",
    "--receipt-file",
    "oversized.json",
    "--url",
    gateway.url,
  ], "", { cwd: workspace });
  assert.notEqual(oversized.code, 0);
  assert.match(oversized.stderr, /no larger than 65536 bytes/i);

  await writeFile(
    join(workspace, "not-redacted.json"),
    JSON.stringify({ ...receipt, redacted: false }),
    "utf8",
  );
  const notRedacted = await runCliProcess([
    "clients-onboarding",
    "plan",
    "--profile-id",
    "cursor-mcp-json",
    "--action",
    "rollback",
    "--receipt-file",
    "not-redacted.json",
    "--url",
    gateway.url,
  ], "", { cwd: workspace });
  assert.notEqual(notRedacted.code, 0);
  assert.match(notRedacted.stderr, /exact redacted/i);
  assert.equal(gateway.requestCount("plan"), 1);
});

test("clients-onboarding apply sends one minimal governed mutation and emits a redacted receipt", async (context) => {
  const gateway = await createOnboardingMockGateway();
  context.after(gateway.close);
  const result = await runCliProcess([
    "clients-onboarding",
    "apply",
    "--plan-id",
    onboardingPlanId,
    "--admin-key",
    "uai-mock-admin-key",
    "--yes",
    "--idempotency-key",
    "apply-once-key",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  const request = gateway.last("apply");
  assert.equal(request.authorization, "Bearer uai-mock-admin-key");
  assert.equal(request.idempotencyKey, "apply-once-key");
  assert.deepEqual(request.body, { planId: onboardingPlanId });
  const output = JSON.parse(result.stdout);
  assert.equal(output.mode, "governed-mutation");
  assert.equal(output.retryAllowed, false);
  assert.equal(output.data.result.receipt.redacted, true);
  assert.equal("path" in output.data.result.receipt, false);
  assert.equal(gateway.requestCount("apply"), 1);
});

test("clients-onboarding approve, rollback, and recover remain explicit one-shot operations", async (context) => {
  const gateway = await createOnboardingMockGateway();
  context.after(gateway.close);
  for (const operation of ["approve", "rollback", "recover"]) {
    const result = await runCliProcess([
      "clients-onboarding",
      operation,
      "--plan-id",
      onboardingPlanId,
      "--admin-key",
      "uai-mock-admin-key",
      "--yes",
      "--idempotency-key",
      `${operation}-once-key`,
      "--url",
      gateway.url,
    ]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`Operation: ${operation}`));
    assert.match(result.stdout, /Automatic retry: forbidden/);
    assert.equal(gateway.requestCount(operation), 1);
    assert.deepEqual(gateway.last(operation).body, { planId: onboardingPlanId });
    assert.equal(gateway.last(operation).idempotencyKey, `${operation}-once-key`);
  }
});

test("clients-onboarding redacts server errors and never retries an unknown mutation", async (context) => {
  const gateway = await createOnboardingMockGateway({
    errorOperation: "apply",
    errorCode: "C:\\private\\operator-command.exe",
  });
  context.after(gateway.close);
  const result = await runCliProcess([
    "clients-onboarding",
    "apply",
    "--plan-id",
    onboardingPlanId,
    "--admin-key",
    "uai-mock-admin-key",
    "--yes",
    "--idempotency-key",
    "unknown-once-key",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 1);
  const failure = JSON.parse(result.stderr);
  assert.deepEqual(failure, {
    ok: false,
    command: "clients-onboarding",
    operation: "apply",
    status: "unknown-reconcile-required",
    code: "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
    retryAllowed: false,
  });
  assert.doesNotMatch(result.stderr, /private|secret|powershell|token|client\.json/i);
  assert.equal(gateway.requestCount("apply"), 1);
});

test("clients-onboarding read failures expose only an allowlisted code", async (context) => {
  const gateway = await createOnboardingMockGateway({
    errorOperation: "verify",
    errorCode: "C:\\private\\verify.exe",
  });
  context.after(gateway.close);
  const result = await runCliProcess([
    "clients-onboarding",
    "verify",
    "--profile-id",
    "cursor-mcp-json",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 1);
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    command: "clients-onboarding",
    operation: "verify",
    status: "rejected",
    code: "LOCAL_CLIENT_ONBOARDING_UNAVAILABLE",
    retryAllowed: false,
  });
  assert.doesNotMatch(result.stderr, /private|secret|powershell|token|client\.json/i);
  assert.equal(gateway.requestCount("verify"), 1);
});

test("chat sends one request to a proven fake-provider runtime", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "chat",
    "hello",
    "gateway",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.chatRequestCount, 1);
  assert.equal(gateway.lastPrompt, "hello gateway");
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.outputText, "mock response");
  assert.equal(output.executionMode, "fake");
  assert.equal(output.realProviderAuthorized, false);
});

test("enhance previews a structured prompt without checking or calling a provider", async (context) => {
  const gateway = await createMockGateway({ realProviderEnabled: true });
  context.after(gateway.close);

  const result = await runCliProcess([
    "enhance",
    "build an API",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.promptEnhancementRequestCount, 1);
  assert.equal(gateway.chatRequestCount, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.original, "build an API");
  assert.equal(output.profile, "coding");
  assert.equal(output.language, "zh-CN");
  assert.match(output.enhancedPrompt, /Execution requirements/);
  assert.equal(output.metadata.providerCalled, false);
  assert.equal(gateway.lastPromptEnhancementLanguage, "zh-CN");
});

test("enhance accepts a prompt from stdin when no positional prompt is supplied", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "enhance",
    "--profile",
    "planning",
    "--json",
    "--url",
    gateway.url,
  ], "Plan a launch\n");

  assert.equal(result.code, 0, result.stderr);
  assert.equal(gateway.promptEnhancementRequestCount, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.original, "Plan a launch");
  assert.equal(output.profile, "planning");
});

test("enhance human output explains optional questions and safety evidence", async (context) => {
  const gateway = await createMockGateway({
    clarifyingQuestions: ["What output format and level of detail do you want?"],
  });
  context.after(gateway.close);

  const result = await runCliProcess([
    "enhance",
    "build an API",
    "--profile",
    "coding",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Questions to refine \(optional\)/);
  assert.match(result.stdout, /What output format and level of detail do you want\?/);
  assert.match(result.stdout, /provider call none/);
  assert.match(result.stdout, /credentials not required/);
  assert.match(result.stdout, /deterministic yes/);
  assert.match(result.stdout, /Original request preserved/);
  assert.match(result.stdout, /--evidence for a shareable report/);
});

test("enhance can emit report-ready provider-free evidence", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "enhance",
    "build an API",
    "--profile",
    "coding",
    "--language",
    "en",
    "--evidence",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.schema, "unified-ai-system/usage-report/v1");
  assert.match(evidence.command, /pnpm gateway enhance/);
  assert.equal(evidence.mode, "prompt-enhancement");
  assert.equal(evidence.providerCalled, false);
  assert.equal(evidence.credentialRequired, false);
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.original, "build an API");
  assert.equal(evidence.profile, "coding");
  assert.equal(evidence.language, "en");
  assert.deepEqual(
    Object.keys(evidence.detectedSignals).sort(),
    ["audience", "constraints", "environment", "evidence", "format", "success"],
  );
  assert.equal(evidence.compiledSections.length, 4);
  assert.equal(evidence.reviewBeforeSharing, true);
});

test("demo can enhance a prompt in one isolated fake-provider run", async () => {
  const result = await runCliProcess([
    "demo",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
    "--json",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.executionMode, "fake");
  assert.equal(output.realProviderCallsMade, false);
  assert.equal(output.promptEnhancement.profile, "coding");
  assert.equal(output.promptEnhancement.language, "zh-CN");
  assert.equal(output.promptEnhancement.metadata.providerCalled, false);
  assert.match(output.promptEnhancement.enhancedPrompt, /执行要求/);
});

test("demo accepts a prompt from stdin when no positional prompt is supplied", async () => {
  const result = await runCliProcess([
    "demo",
    "--enhance",
    "--profile",
    "planning",
    "--language",
    "en",
    "--json",
  ], "Plan a launch\n");

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.executionMode, "fake");
  assert.equal(output.prompt, "Plan a launch");
  assert.equal(output.promptEnhancement.original, "Plan a launch");
  assert.equal(output.promptEnhancement.profile, "planning");
  assert.equal(output.promptEnhancement.metadata.providerCalled, false);
});

test("demo can emit report-ready evidence without changing fake execution", async () => {
  const result = await runCliProcess([
    "demo",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--evidence",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.schema, "unified-ai-system/usage-report/v1");
  assert.match(evidence.command, /--enhance --profile coding/);
  assert.equal(evidence.mode, "fake");
  assert.equal(evidence.providerCalled, false);
  assert.equal(evidence.credentialRequired, false);
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.original, "build an API");
  assert.equal(typeof evidence.detectedSignals.format, "boolean");
  assert.equal(evidence.compiledSections.length, 4);
  assert.equal(evidence.reviewBeforeSharing, true);
});

test("chat opts into gateway enhancement only with --enhance", async (context) => {
  const gateway = await createMockGateway();
  context.after(gateway.close);

  const result = await runCliProcess([
    "chat",
    "build an API",
    "--enhance",
    "--profile",
    "coding",
    "--language",
    "zh-CN",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(gateway.lastPromptEnhancement, {
    enabled: true,
    profile: "coding",
    language: "zh-CN",
  });
  const output = JSON.parse(result.stdout);
  assert.equal(output.promptEnhancement.applied, true);
  assert.equal(output.promptEnhancement.profile, "coding");
  assert.equal(output.promptEnhancement.language, "zh-CN");
});

test("chat blocks a real-provider runtime until explicitly authorized", async (context) => {
  const gateway = await createMockGateway({ realProviderEnabled: true });
  context.after(gateway.close);

  const blocked = await runCliProcess([
    "chat",
    "do not send",
    "--json",
    "--url",
    gateway.url,
  ]);

  assert.equal(blocked.code, 2);
  assert.equal(gateway.chatRequestCount, 0);
  const failure = JSON.parse(blocked.stderr);
  assert.equal(failure.ok, false);
  assert.match(failure.error, /request was not sent/i);

  const authorized = await runCliProcess([
    "chat",
    "authorized request",
    "--json",
    "--url",
    gateway.url,
    "--allow-real-provider",
  ]);

  assert.equal(authorized.code, 0, authorized.stderr);
  assert.equal(gateway.chatRequestCount, 1);
  const output = JSON.parse(authorized.stdout);
  assert.equal(output.realProviderAuthorized, true);
  assert.equal(output.executionMode, "real");
});

test("doctor enforces the package engine boundaries", async (context) => {
  const cases = [
    { name: "Node 20 is unsupported", nodeVersion: "20.19.0", pnpmVersion: "11.19.0", nodePassed: false, pnpmPassed: true },
    { name: "Node below the minimum patch is unsupported", nodeVersion: "22.17.0", pnpmVersion: "11.19.0", nodePassed: false, pnpmPassed: true },
    { name: "the minimum toolchain is supported", nodeVersion: "22.18.0", pnpmVersion: "11.19.0", nodePassed: true, pnpmPassed: true },
    { name: "pnpm 9 is unsupported", nodeVersion: "22.18.0", pnpmVersion: "9.15.0", nodePassed: true, pnpmPassed: false },
    { name: "pnpm below the minimum minor is unsupported", nodeVersion: "22.18.0", pnpmVersion: "11.18.9", nodePassed: true, pnpmPassed: false },
    { name: "pnpm 12 is unsupported", nodeVersion: "22.18.0", pnpmVersion: "12.0.0", nodePassed: true, pnpmPassed: false },
    { name: "later supported stable versions work", nodeVersion: "25.8.1", pnpmVersion: "11.20.0", nodePassed: true, pnpmPassed: true },
    { name: "unknown Node version fails closed", nodeVersion: "unknown", pnpmVersion: "11.19.0", nodePassed: false, pnpmPassed: true },
    { name: "unknown pnpm version fails closed", nodeVersion: "22.18.0", pnpmVersion: "11.invalid", nodePassed: true, pnpmPassed: false },
    { name: "pnpm prerelease is not a supported stable release", nodeVersion: "22.18.0", pnpmVersion: "11.19.0-beta.1", nodePassed: true, pnpmPassed: false },
  ];
  for (const fixture of cases) {
    await context.test(fixture.name, async () => {
      const { code, payload } = await runDoctorFixture(fixture);
      assert.equal(payload.checks.find((check) => check.id === "node").passed, fixture.nodePassed);
      assert.equal(payload.checks.find((check) => check.id === "pnpm").passed, fixture.pnpmPassed);
      assert.equal(payload.ok, fixture.nodePassed && fixture.pnpmPassed);
      assert.equal(code, payload.ok ? 0 : 1);
      assert.equal(payload.gateway.reachable, false);
    });
  }
});

test("doctor exposes engine requirements and rejects a missing pnpm executable", async () => {
  const { code, payload } = await runDoctorFixture({ nodeVersion: "22.18.0", pnpmVersion: "", pnpmStatus: 1 });
  assert.equal(code, 1);
  const nodeCheck = payload.checks.find((check) => check.id === "node");
  const pnpmCheck = payload.checks.find((check) => check.id === "pnpm");
  assert.equal(nodeCheck.required, ">=22.18.0");
  assert.equal(pnpmCheck.required, ">=11.19.0 <12");
  assert.equal(pnpmCheck.passed, false);
  assert.match(pnpmCheck.detail, /not found on PATH/u);
});

test("doctor human output explains required versions", async () => {
  const { code, stdout } = await runDoctorFixture({ nodeVersion: "22.17.0", pnpmVersion: "12.0.0", json: false });
  assert.equal(code, 1);
  assert.match(stdout, /Node\.js 22\.17\.0 \(requires >=22\.18\.0\)/u);
  assert.match(stdout, /pnpm 12\.0\.0 \(requires >=11\.19\.0 <12\)/u);
});

test("doctor fails closed for missing or unsupported engine declarations", async (context) => {
  for (const engines of [{}, { node: "", pnpm: "" }, { node: "^22.18.0", pnpm: ">=11.19.0 || <12" }]) {
    await context.test(JSON.stringify(engines), async () => {
      const { code, payload } = await runDoctorFixture({ nodeVersion: "22.18.0", pnpmVersion: "11.19.0", engineRequirements: engines });
      assert.equal(code, 1);
      assert.equal(payload.ok, false);
      assert.equal(payload.checks.find((check) => check.id === "node").passed, false);
      assert.equal(payload.checks.find((check) => check.id === "pnpm").passed, false);
    });
  }
});

test("doctor reads changed requirements rather than keeping old hard-coded minimums", async () => {
  const { code, payload } = await runDoctorFixture({ nodeVersion: "22.18.0", pnpmVersion: "11.19.0", engineRequirements: { node: ">=25.8.1", pnpm: ">=11.20.0 <12" } });
  assert.equal(code, 1);
  assert.equal(payload.checks.find((check) => check.id === "node").required, ">=25.8.1");
  assert.equal(payload.checks.find((check) => check.id === "node").passed, false);
  assert.equal(payload.checks.find((check) => check.id === "pnpm").passed, false);
});

async function runDoctorFixture({ nodeVersion, pnpmVersion, pnpmStatus = 0, json = true, engineRequirements }) {
  let stdout = "";
  let stderr = "";
  let spawnCount = 0;
  const code = await runCli([
    "doctor", ...(json ? ["--json"] : []), "--url", "http://127.0.0.1:9", "--timeout", "1",
  ], {
    env: {},
    nodeVersion,
    engineRequirements,
    stdout: { isTTY: false, write(chunk) { stdout += chunk; } },
    stderr: { write(chunk) { stderr += chunk; } },
    spawnSynchronous() {
      spawnCount += 1;
      return { status: pnpmStatus, stdout: pnpmVersion };
    },
  });
  assert.equal(stderr, "");
  assert.equal(spawnCount, 1);
  return { code, stdout, payload: json ? JSON.parse(stdout) : null };
}

test("doctor treats an offline gateway as optional", async () => {
  const result = await runCliProcess([
    "doctor",
    "--json",
    "--url",
    "http://127.0.0.1:9",
    "--timeout",
    "100",
  ]);

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.gateway.reachable, false);
  assert.equal(output.nextAction, "pnpm gateway serve");
});

test("CLI workflow requests a real approval and publishes the exact reviewed artifact once", { timeout: 60_000 }, async (context) => {
  // This integration must never load a user's model-library runtime state.
  await assert.rejects(lstat(join(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-model-library-state.json")), { code: "ENOENT" });
  const [{ createGatewayApplication }, { createGatewayHttpServer }, { createAgentApprovalStore }] = await Promise.all([
    import("../../ai-gateway-service/src/application/createGatewayApplication.js"),
    import("../../ai-gateway-service/src/http/httpServer.js"),
    import("../../ai-gateway-service/src/agent-governance/agentApprovalStore.ts"),
  ]);
  const root = await mkdtemp(join(tmpdir(), "cli-real-workflow-"));
  const outputDir = join(root, "artifacts");
  const token = "cli-workflow-integration-fixture-token";
  const identity = { tenantId: "cli-workflow-tenant", userId: "cli-workflow-owner", role: "admin", permissions: ["*"] };
  let server;
  context.after(async () => {
    if (server) {
      await new Promise(resolveClose => { server.close(() => resolveClose()); server.closeAllConnections(); });
      await server.shutdownResources?.();
    }
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/")));
    await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });
  const application = createGatewayApplication({
    NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory",
    AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true", AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "cli-workflow-governance-fixture-key-0123456789",
    WORKFLOW_OUTPUT_DIR: outputDir, WORKFORCE_PLAN_STORE_PATH: join(root, "workforce-plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "workforce"),
    AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"), PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId,
    PME_AUTH_ROLE: identity.role, PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId,
    PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
    PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit.chain.jsonl"),
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
  });
  server = createGatewayHttpServer(application);
  const agent = await application.agentGovernance.service.generateAgent({
    name: "cli-workflow-writer", task: "write a controlled local report", requestedTools: ["file_write"], ttlSeconds: 3600, parentAgentId: null,
  }, identity);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port;
  const common = ["--admin-key", token, "--url", url, "--json"];
  const runArgs = ["workflow", "run", "--workflow-id", "cli-real-report", "--goal", "Explain the local gateway", "--agent-id", agent.agentId, "--artifact-name", "cli-report.md"];
  const run = await runCliProcess([...runArgs, ...common]);
  assert.equal(run.code, 0, run.stderr);
  const completion = JSON.parse(run.stdout).data;
  const stored = application.workflowService.getRun("cli-real-report", identity);
  assert.equal(stored.status, "completed"); assert.equal(stored.canResume, false); assert.equal(stored.resumeAction, null);
  assert.equal(completion.artifact.fileName, "cli-report.md");
  assert.ok(resolve(stored.result.artifact.absolutePath).startsWith(resolve(outputDir) + (process.platform === "win32" ? "\\" : "/")));
  const report = await readFile(stored.result.artifact.absolutePath);
  assert.equal(completion.artifact.bytes, report.length);
  assert.equal(completion.artifact.sha256, createHash("sha256").update(report).digest("hex"));
  for (const operation of ["status", "recover"]) {
    const result = await runCliProcess(["workflow", operation, "--workflow-id", "cli-real-report", ...common]);
    assert.equal(result.code, 0, result.stderr); assert.equal(JSON.parse(result.stdout).data.status, "completed");
  }
  const listed = await runCliProcess(["workflow", "list", ...common]);
  assert.equal(listed.code, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).data.runs[0].workflowId, "cli-real-report");

  // Activate a restrictive policy BEFORE issuing a fresh Agent. Reconfiguring
  // the already-run Agent introduced a separate execution fence in the first run.
  await application.agentGovernance.service.createPolicyVersion({
    policyKey: "task:workflow-review", version: 1, policyType: "task", scopeKey: "workflow-review",
    content: { toolRules: { file_write: "require_approval" } },
  }, identity);
  await application.agentGovernance.service.activatePolicyVersion("task:workflow-review", 1, identity);
  const restrictedAgent = await application.agentGovernance.service.generateAgent({
    name: "approval-required-workflow", task: "write a controlled local report", requestedTools: ["file_write"],
    ttlSeconds: 3600, parentAgentId: null, taskPolicyKeys: ["workflow-review"],
  }, identity);
  assert.equal((await application.agentGovernance.service.getEffectivePolicy(restrictedAgent.agentId, identity.tenantId)).toolDecisions.file_write, "require_approval");
  const approvalRun = ["workflow", "run", "--workflow-id", "approval-reviewed-report", "--goal",
    "Review the complete local artifact. ".repeat(70).trim(), "--artifact-name", "reviewed-report.md", "--agent-id", restrictedAgent.agentId, ...common];
  const pending = await runCliProcess(approvalRun);
  assert.equal(pending.code, 1); const blocked = JSON.parse(pending.stderr);
  assert.equal(blocked.code, "TOOL_APPROVAL_REQUIRED"); assert.match(blocked.approvalId, /^appr_/);
  assert.match(blocked.nextAction, /review the exact file_write request/);
  assert.equal(application.workflowService.getRun("approval-reviewed-report", identity).error.code, "TOOL_APPROVAL_REQUIRED");
  assert.deepEqual((await readdir(dirname(stored.result.artifact.absolutePath))).filter(name => name.endsWith(".md")), ["cli-report.md"]);
  const approvals = await runCliProcess(["agents", "approvals", "--agent-id", restrictedAgent.agentId, ...common]);
  assert.equal(approvals.code, 0, approvals.stderr);
  const approval = JSON.parse(approvals.stdout).data[0]; const reviewed = approval.review.workflow;
  assert.equal(approval.id, blocked.approvalId); assert.equal(approval.status, "PENDING");
  assert.equal(approval.review.effectType, "workflow:artifact-write"); assert.equal(reviewed.target.fileName, "reviewed-report.md");
  assert.ok(reviewed.content.length > 4_000); assert.equal(reviewed.contentBytes, Buffer.byteLength(reviewed.content));
  assert.equal(reviewed.contentHash, "sha256:" + createHash("sha256").update(reviewed.content).digest("hex"));
  const plain = await runCliProcess(["agents", "approvals", "--agent-id", restrictedAgent.agentId, "--admin-key", token, "--url", url]);
  assert.equal(plain.code, 0, plain.stderr); assert.ok(plain.stdout.includes(reviewed.content)); assert.match(plain.stdout, /End of complete Markdown content/);
  const decision = await runCliProcess(["agents", "approve", "--approval-id", approval.id, "--yes", ...common]);
  assert.equal(decision.code, 0, decision.stderr); assert.equal(JSON.parse(decision.stdout).data.status, "APPROVED");
  const approvedRun = await runCliProcess(approvalRun);
  assert.equal(approvedRun.code, 0, approvedRun.stderr);
  const published = application.workflowService.getRun("approval-reviewed-report", identity);
  assert.equal(await readFile(published.result.artifact.absolutePath, "utf8"), reviewed.content);
  assert.equal(JSON.parse(approvedRun.stdout).data.artifact.sha256, reviewed.contentHash.slice(7));
  const approvalReader = () => createAgentApprovalStore({ storePath: join(root, "governance", "approvals.json"), secret: "cli-workflow-governance-fixture-key-0123456789" });
  assert.equal((await approvalReader().get(approval.id)).status, "CONSUMED");
  const usage = await application.agentGovernance.service.getUsage(restrictedAgent.agentId);
  const replay = await runCliProcess(approvalRun); assert.equal(replay.code, 0, replay.stderr);
  assert.equal((await application.agentGovernance.service.getUsage(restrictedAgent.agentId)).toolCalls, usage.toolCalls);
  assert.equal((await approvalReader().get(approval.id)).status, "CONSUMED");
  const unsafe = await runCliProcess(["workflow", "run", "--workflow-id", "unsafe-review-report", "--goal", "password=synthetic-secret-value", "--agent-id", restrictedAgent.agentId, ...common]);
  assert.equal(unsafe.code, 1); assert.equal(JSON.parse(unsafe.stderr).code, "APPROVAL_REVIEW_UNAVAILABLE");
  assert.equal(application.workflowService.getRun("unsafe-review-report", identity).error.code, "APPROVAL_REVIEW_UNAVAILABLE");
  assert.deepEqual(await application.agentGovernance.service.listApprovals(restrictedAgent.agentId, identity.tenantId), []);
  const artifacts = (await readdir(dirname(stored.result.artifact.absolutePath))).filter(name => name.endsWith(".md"));
  assert.deepEqual(artifacts.sort(), ["cli-report.md", "reviewed-report.md"]);
});

test("workflow/provider commands use explicit identifiers without a new confirmation layer", () => {
  const env = { AGENT_CONSOLE_ADMIN_KEY: "operator-fixture-key" };
  const run = parseCliArgs(["--goal", "Local report", "workflow", "run", "--workflow-id", "report-001", "--agent-id", "agt_report"], env);
  assert.equal(run.confirmed, false);
  assert.equal(run.workflowId, "report-001");
  assert.equal(parseCliArgs(["providers", "clear-credential", "--provider-id", "bai"], env).confirmed, false);
  assert.throws(() => parseCliArgs(["providers", "clear-credential", "--provider-id", "bai"], {}), CliUsageError);
  assert.throws(() => parseCliArgs(["workflow", "list"], {}), CliUsageError);
  for (const args of [
    ["workflow", "run", "--goal", "report", "--agent-id", "agt_report"],
    ["workflow", "run", "--workflow-id", "report-001", "--goal", "report"],
    ["workflow", "status", "--workflow-id", "../escape"],
    ["workflow", "recover", "--workflow-id", "report-001", "--goal", "new input"],
    ["workflow", "list", "--limit", "101"],
    ["workflow", "run", "--workflow-id", "report-001", "--goal", "report", "--agent-id", "agt_report", "--provider-id", "bai"],
    ["providers", "clear-credential", "--provider-id", "../bai"],
    ["agents", "status", "--workflow-id", "report-001"],
  ]) assert.throws(() => parseCliArgs(args, env), CliUsageError);
});

test("workflow run/list/status/recover use their SDK routes once and preserve recorded IDs", async (context) => {
  const gateway = await createWorkflowOperatorFixture(); context.after(gateway.close);
  const run = await runWorkflowOperatorFixture(["workflow", "run", "--workflow-id", "report-001", "--goal", "Local report", "--agent-id", "agt_report", "--artifact-name", "report.md"], gateway.url);
  assert.equal(run.code, 0, run.stderr);
  assert.deepEqual(gateway.requests[0].body, { workflowId: "report-001", goal: "Local report", agentId: "agt_report", artifactName: "report.md" });
  assert.equal(gateway.requests[0].method, "POST");
  assert.equal(gateway.requests[0].authorization, "Bearer operator-fixture-key");
  assert.equal(JSON.parse(run.stdout).data.artifact.sha256, "a".repeat(64));
  const list = await runWorkflowOperatorFixture(["workflow", "list", "--limit", "5"], gateway.url);
  const status = await runWorkflowOperatorFixture(["workflow", "status", "--workflow-id", "report-001"], gateway.url);
  const recover = await runWorkflowOperatorFixture(["workflow", "recover", "--workflow-id", "report-001"], gateway.url);
  assert.deepEqual([list.code, status.code, recover.code], [0, 0, 0]);
  assert.deepEqual(gateway.requests.map(row => [row.method, row.url]), [
    ["POST", "/workflow/run"], ["GET", "/workflow/runs?limit=5"], ["GET", "/workflow/runs/report-001"], ["POST", "/workflow/runs/report-001/recover"],
  ]);
  assert.deepEqual(gateway.requests[3].body, {});
  for (const result of [run, list, status, recover]) assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret|private-path|owner-spoof/);
});

test("workflow unknown recovery reports the next action without automatically running again", async (context) => {
  const gateway = await createWorkflowOperatorFixture({ inspection: { status: "unknown", canResume: true, resumeAction: "recheck-governance-only", outcomeUnknown: true } });
  context.after(gateway.close);
  const result = await runWorkflowOperatorFixture(["workflow", "recover", "--workflow-id", "report-001"], gateway.url);
  assert.equal(result.code, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.data.status, "unknown"); assert.equal(output.data.resumeAction, "recheck-governance-only");
  assert.equal(output.retryAllowed, false); assert.match(output.nextAction, /result governance only/);
  assert.equal(gateway.requests.length, 1);
  assert.equal(gateway.requests[0].url, "/workflow/runs/report-001/recover");
});

test("workflow recovery does not mark a missing completion receipt as success", async (context) => {
  const gateway = await createWorkflowOperatorFixture({ inspection: { result: null } }); context.after(gateway.close);
  const result = await runWorkflowOperatorFixture(["workflow", "recover", "--workflow-id", "report-001"], gateway.url);
  const failure = JSON.parse(result.stderr);
  assert.equal(result.code, 1); assert.equal(failure.status, "unknown-reconcile-required");
  assert.equal(failure.workflowId, "report-001"); assert.equal(gateway.requests.length, 1);
});

test("workflow admission directs a required approval to the existing Agent approval surface", async (context) => {
  const gateway = await createWorkflowOperatorFixture({ status: 409, error: { code: "TOOL_APPROVAL_REQUIRED" } }); context.after(gateway.close);
  const result = await runWorkflowOperatorFixture(["workflow", "run", "--workflow-id", "report-001", "--goal", "Local report", "--agent-id", "agt_report"], gateway.url);
  const failure = JSON.parse(result.stderr);
  assert.equal(result.code, 1); assert.equal(failure.code, "TOOL_APPROVAL_REQUIRED");
  assert.match(failure.nextAction, /agents approvals --agent-id agt_report/);
  assert.equal(failure.workflowId, "report-001"); assert.equal(gateway.requests.length, 1);
});

test("workflow failures retain the explicit ID, redact untrusted errors and never retry", async (context) => {
  for (const options of [
    { status: 503, error: { code: "WORKFLOW_STATE_UNAVAILABLE", message: "fixture-secret private-path", details: { workflowId: "owner-spoof" } } },
    { disconnect: true }, { badCompletion: true },
  ]) {
    const gateway = await createWorkflowOperatorFixture(options); context.after(gateway.close);
    const result = await runWorkflowOperatorFixture(["workflow", "run", "--workflow-id", "report-001", "--goal", "Local report", "--agent-id", "agt_report"], gateway.url);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.workflowId, "report-001"); assert.equal(failure.status, "unknown-reconcile-required");
    assert.equal(failure.retryAllowed, false); assert.equal(gateway.requests.length, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret|private-path|owner-spoof/);
  }
});

test("provider credential clearing reports exact store receipts and preserves uncertain committed outcomes", async (context) => {
  for (const removed of [true, false]) {
    const gateway = await createWorkflowOperatorFixture({ removed }); context.after(gateway.close);
    const result = await runWorkflowOperatorFixture(["providers", "clear-credential", "--provider-id", "bai"], gateway.url);
    assert.equal(result.code, 0, result.stderr); const output = JSON.parse(result.stdout);
    assert.equal(output.data.removed, removed); assert.equal(output.data.providerKeyRevoked, false);
    assert.match(output.nextAction, /Environment\/configuration credentials may still apply/);
    assert.deepEqual(gateway.requests.map(row => [row.method, row.url, row.body]), [["DELETE", "/providers/runtime-credential", { providerId: "bai" }]]);
  }
  const gateway = await createWorkflowOperatorFixture({ status: 503, error: {
    code: "provider_runtime_credential_clear_result_audit_unconfirmed", message: "fixture-secret private-path",
    details: { ...workflowCredentialReceipt(true), operationCommitted: true, privatePath: "private-path" },
  } }); context.after(gateway.close);
  const result = await runWorkflowOperatorFixture(["providers", "clear-credential", "--provider-id", "bai"], gateway.url);
  const failure = JSON.parse(result.stderr);
  assert.equal(result.code, 1); assert.equal(failure.status, "unknown-reconcile-required"); assert.equal(failure.receipt.removed, true);
  assert.equal(gateway.requests.length, 1); assert.doesNotMatch(result.stdout + result.stderr, /fixture-secret|private-path/);
});

test("credential clearing separates pre-effect rejection from an unconfirmed receipt", async (context) => {
  for (const [options, status, code] of [
    [{ status: 403, error: { code: "private-path", message: "fixture-secret" } }, "rejected", "CREDENTIAL_CLEAR_REJECTED"],
    [{ status: 503, error: { code: "provider_runtime_credential_clear_audit_unavailable", details: { operationStarted: false } } }, "rejected", "CREDENTIAL_CLEAR_NOT_STARTED"],
    [{ removed: "unconfirmed" }, "unknown-reconcile-required", "CREDENTIAL_CLEAR_OUTCOME_UNKNOWN"],
  ]) {
    const gateway = await createWorkflowOperatorFixture(options); context.after(gateway.close);
    const result = await runWorkflowOperatorFixture(["providers", "clear-credential", "--provider-id", "bai"], gateway.url);
    const failure = JSON.parse(result.stderr);
    assert.equal(result.code, 1); assert.equal(failure.status, status); assert.equal(failure.code, code);
    assert.equal(failure.providerId, "bai"); assert.equal(failure.retryAllowed, false);
    assert.equal(gateway.requests.length, 1); assert.doesNotMatch(result.stderr, /fixture-secret|private-path/);
  }
});

async function runWorkflowOperatorFixture(args, url) {
  let stdout = ""; let stderr = "";
  const code = await runCli([...args, "--url", url, "--json"], {
    env: { AGENT_CONSOLE_ADMIN_KEY: "operator-fixture-key" },
    stdout: { isTTY: false, write: value => { stdout += value; } }, stderr: { write: value => { stderr += value; } },
  });
  return { code, stdout, stderr };
}
function workflowCredentialReceipt(removed) {
  return { providerId: "bai", removed, scope: "runtime-credential-store", appliesTo: "subsequent-credential-lookups",
    inFlightRequestsCancelled: false, providerKeyRevoked: false, otherCredentialSourcesModified: false, otherProcessesInvalidated: false };
}
async function createWorkflowOperatorFixture(options = {}) {
  const requests = [];
  const completion = { workflowId: "report-001", status: "completed", artifact: { fileName: "report.md", bytes: 12, sha256: "a".repeat(64), absolutePath: "private-path" }, secret: "fixture-secret" };
  const server = createServer(async (request, response) => {
    const body = await readJsonBody(request);
    requests.push({ method: request.method, url: request.url, body, authorization: request.headers.authorization });
    if (options.disconnect) { request.socket.destroy(); return; }
    if (options.status) { writeJson(response, options.status, { error: options.error }); return; }
    const inspection = { workflowId: "report-001", status: "completed", stage: "artifact.write", attempt: 1,
      canResume: false, resumeAction: null, outcomeUnknown: false, error: null, result: completion,
      persistence: { storageMode: "single-host-sqlite", automaticRedispatch: false }, privatePath: "private-path", ...options.inspection };
    const data = request.method === "DELETE" ? { ...workflowCredentialReceipt(options.removed ?? true), secret: "fixture-secret" }
      : request.url === "/workflow/run" ? options.badCompletion ? { ...completion, workflowId: "owner-spoof" } : completion
        : request.url.startsWith("/workflow/runs?") ? { runs: [inspection] } : inspection;
    writeJson(response, 200, { data });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  return { url: `http://127.0.0.1:${server.address().port}`, requests,
    close: () => new Promise(resolveClose => { server.close(() => resolveClose()); server.closeAllConnections(); }) };
}

async function createAgentGovernanceMockGateway(options = {}) {
  const requests = [];
  const agent = {
    agentId: "agt_cli_fixture",
    name: "report-reader",
    purpose: "Read a report",
    tenantId: "tenant-a",
    ownerUserId: "operator-a",
    parentAgentId: null,
    generationDepth: 0,
    classification: { family: "analysis", domain: "general", subclass: "reader" },
    traits: ["read_only"],
    riskLevel: "low",
    requestedTools: ["file_read"],
    grantedTools: ["file_read"],
    policyHash: `sha256:${"a".repeat(64)}`,
    status: "ACTIVE",
    createdAt: "2026-08-30T00:00:00.000Z",
    expiresAt: "2026-08-30T01:00:00.000Z",
  };
  const approval = {
    id: "appr_cli_fixture",
    agentId: agent.agentId,
    toolName: "git_push",
    argumentsHash: "b".repeat(64),
    status: "PENDING",
    requestedAt: "2026-08-30T00:10:00.000Z",
    expiresAt: "2026-08-30T00:20:00.000Z",
    review: options.approvalReview ?? {
      kind: "generic",
      summary: "Publish the reviewed change",
      authorization: "private authorization token-value",
    },
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const body = request.method === "POST" ? await readJsonBody(request) : null;
    const entry = {
      method: request.method,
      path: url.pathname,
      query: url.search,
      authorization: request.headers.authorization ?? null,
      body,
    };
    requests.push(entry);
    if (entry.authorization !== "Bearer uai-mock-admin-key") {
      return writeJson(response, 401, {
        status: "error",
        error: { code: "UNAUTHENTICATED", message: "private auth detail" },
      });
    }
    if (options.failPath === url.pathname) {
      return writeJson(response, 503, {
        status: "error",
        error: {
          code: "AGENT_GOVERNANCE_STORE_UNAVAILABLE",
          message: "private secret token-value must not reach the terminal",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/governance/stats") {
      return writeJson(response, 200, {
        status: "ok",
        data: { stats: { agents: 1, byStatus: { ACTIVE: 1 }, policies: 2 } },
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/agents") {
      return writeJson(response, 200, { status: "ok", data: { agents: [agent] } });
    }
    if (request.method === "GET" && url.pathname === `/v1/agents/${agent.agentId}`) {
      return writeJson(response, 200, { status: "ok", data: { agent } });
    }
    if (request.method === "GET"
      && url.pathname === `/v1/agents/${agent.agentId}/effective-policy`) {
      return writeJson(response, 200, {
        status: "ok",
        data: {
          effectivePolicy: {
            agentId: agent.agentId,
            grantedTools: ["file_read"],
            policyHash: agent.policyHash,
            expiresAt: agent.expiresAt,
          },
        },
      });
    }
    if (request.method === "POST" && url.pathname === "/v1/agents/generate") {
      return writeJson(response, 200, {
        status: "ok",
        data: {
          agentId: agent.agentId,
          status: "ACTIVE",
          grantedTools: body.requestedTools,
          expiresAt: agent.expiresAt,
          policyHash: agent.policyHash,
        },
      });
    }
    if (request.method === "POST" && url.pathname === `/v1/agents/${agent.agentId}/run`) {
      if (Number.isFinite(options.runDelayMs) && options.runDelayMs > 0) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, options.runDelayMs));
      }
      return writeJson(response, 200, {
        status: "ok",
        data: {
          status: "completed",
          goal: body.goal,
          finalAnswer: "fixture answer",
          iterations: { used: 1, max: body.maxIterations ?? 8 },
          timing: { durationMs: 1, timeoutMs: 60_000, timedOut: false },
          tools: { mode: body.toolMode, allowlist: body.toolAllowlist ?? [], usage: {} },
          usage: {},
          provider: { id: body.providerId ?? "local-fake-provider", modelId: null },
          sessionId: null,
          governance: { enforced: true, agentId: agent.agentId, policyHash: agent.policyHash },
        },
      });
    }
    if (request.method === "POST" && url.pathname === `/v1/agents/${agent.agentId}/revoke`) {
      return writeJson(response, 200, {
        status: "ok",
        data: { revoked: [agent.agentId] },
      });
    }
    if (request.method === "GET" && url.pathname === "/v1/approvals") {
      return writeJson(response, 200, {
        status: "ok",
        data: { approvals: [approval] },
      });
    }
    const decisionMatch = /^\/v1\/approvals\/([^/]+)\/(approve|reject)$/u.exec(url.pathname);
    if (request.method === "POST" && decisionMatch) {
      return writeJson(response, 200, {
        status: "ok",
        data: {
          approval: {
            ...approval,
            id: decisionMatch[1],
            status: decisionMatch[2] === "approve" ? "APPROVED" : "REJECTED",
          },
        },
      });
    }
    if (request.method === "GET" && url.pathname === "/forge/status") {
      return writeJson(response, 200, { status: "ok", data: { status: "ready" } });
    }
    return writeJson(response, 404, {
      status: "error",
      error: { code: "NOT_FOUND", message: "not found" },
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.ok(port);
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    last(path) {
      return requests.filter((entry) => entry.path === path).at(-1) ?? null;
    },
    close: () => new Promise((resolvePromise, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolvePromise();
      });
    }),
  };
}

async function createMockGateway(options = {}) {
  let chatRequestCount = 0;
  let promptEnhancementRequestCount = 0;
  let lastPrompt = null;
  let lastPromptEnhancement = null;
  let lastPromptEnhancementLanguage = null;
  let lastSpendAuthorization = null;
  let lastClientsAuthorization = null;
  let lastOnboardingAuthorization = null;
  let lastModelsAuthorization = null;
  const realProviderEnabled = options.realProviderEnabled === true;
  const profileIds = [
    "claude-compatible-mcp-json",
    "cursor-mcp-json",
    "vscode-mcp-json",
  ];
  const installedProfiles = new Set(
    profileIds.filter((profileId) => !new Set(options.missingProfileIds ?? []).has(profileId)),
  );
  const plansById = new Map();
  const controlCenterRequests = [];
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/v1/models") {
      lastModelsAuthorization = request.headers.authorization ?? null;
      if (options.modelsHttpStatus) {
        return writeJson(response, options.modelsHttpStatus, { error: { code: "UPSTREAM_UNAVAILABLE", message: "private-failure-payload" } });
      }
      if (request.headers.authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          error: { code: "UNAUTHENTICATED" },
        });
      }
      return writeJson(response, 200, {
        object: "list",
        data: [{
          id: "local-fake-model",
          object: "model",
          owned_by: "local-fake-provider",
          unified_ai: {
            provider_id: "local-fake-provider",
            execution_mode: "fake",
          },
        }],
      });
    }

    if (request.method === "GET" && request.url === "/enterprise/spend-report") {
      lastSpendAuthorization = request.headers.authorization ?? null;
      if (request.headers.authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          success: false,
          error: { code: "UNAUTHENTICATED" },
        });
      }
      return writeJson(response, 200, {
        success: true,
        data: {
          window: "current-budget-window",
          totals: {
            keys: 1,
            activeKeys: 1,
            tokensUsed: 4200,
            requestCount: 37,
            keysOverSoftBudget: 1,
          },
          rows: [
            {
              keyId: "abc123def456",
              description: "ci key",
              role: "operator",
              tenantId: "tenant-a",
              revoked: false,
              lastUsedAt: "2026-08-16T00:00:00.000Z",
              tokensUsed: 4200,
              requestCount: 37,
              budget: {
                enabled: true,
                limitTokens: 5000,
                tokensRemaining: 800,
                softBudgetExceeded: true,
                windowResetAt: "2026-08-17T00:00:00.000Z",
              },
            },
          ],
        },
      });
    }

    if (request.method === "GET" && request.url === "/local-clients/status") {
      lastClientsAuthorization = request.headers.authorization ?? null;
      if (request.headers.authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED" },
        });
      }
      return writeJson(response, 200, {
        status: "ok",
        data: {
          status: "preview-ready",
          executionEnabled: false,
          boundaries: {
            previewOnly: true,
            tenantScoped: true,
            observedApplicationsRoutable: false,
            executionAdapterConfigured: false,
          },
        },
      });
    }

    if (request.method === "GET" && request.url === "/local-clients/registry?includeDisabled=true&limit=100") {
      lastClientsAuthorization = request.headers.authorization ?? null;
      if (request.headers.authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED" },
        });
      }
      return writeJson(response, 200, {
        status: "ok",
        data: {
          total: 1,
          clients: [{
            clientId: "desktop-browser",
            displayName: "Desktop Browser",
            state: "declared",
            enabled: true,
            routable: true,
            capabilityIds: ["browser"],
            health: { status: "unknown" },
            trustDecision: "declared",
          }],
          pagination: {
            offset: 0,
            limit: 100,
            returned: 1,
            includeDisabled: true,
          },
        },
      });
    }

    if (request.method === "GET" && request.url === "/local-clients/onboarding/profiles") {
      lastOnboardingAuthorization = request.headers.authorization ?? null;
      if (request.headers.authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED" },
        });
      }
      if (Number.isInteger(options.onboardingStatusCode)) {
        return writeJson(response, options.onboardingStatusCode, {
          status: "error",
          error: {
            code: options.onboardingErrorCode ?? "LOCAL_CLIENT_ONBOARDING_DISABLED",
            message: options.onboardingErrorMessage ?? "onboarding unavailable",
            path: options.onboardingErrorPath ?? null,
            command: options.onboardingErrorCommand ?? null,
          },
        });
      }
      return writeJson(response, 200, {
        status: "ok",
        data: [
          onboardingProfile("claude-compatible-mcp-json", "claude-compatible"),
          onboardingProfile("cursor-mcp-json", "cursor"),
          onboardingProfile("vscode-mcp-json", "vscode"),
        ],
      });
    }

    const onboardingVerifyMatch = /^\/local-clients\/onboarding\/profiles\/([^/]+)\/verify$/u.exec(
      request.url ?? "",
    );
    if (request.method === "GET" && onboardingVerifyMatch) {
      lastOnboardingAuthorization = request.headers.authorization ?? null;
      if (request.headers.authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED" },
        });
      }
      const profileId = decodeURIComponent(onboardingVerifyMatch[1]);
      return writeJson(response, 200, {
        status: "ok",
        data: onboardingVerification(profileId, installedProfiles.has(profileId)),
      });
    }

    if (request.method === "POST" && request.url === "/local-clients/onboarding/plans") {
      const body = await readJsonBody(request);
      controlCenterRequests.push({
        operation: "plan",
        authorization: request.headers.authorization ?? null,
        idempotencyKey: request.headers["idempotency-key"] ?? null,
        body,
      });
      if (request.headers.authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED" },
        });
      }
      const profileIndex = profileIds.indexOf(body.profileId);
      if (profileIndex === -1 || body.action !== "enable") {
        return writeJson(response, 400, {
          status: "error",
          error: { code: "LOCAL_CLIENT_ONBOARDING_REQUEST_INVALID" },
        });
      }
      const planId = `onboarding_${String(profileIndex + 1).repeat(64)}`;
      plansById.set(planId, body.profileId);
      const now = Date.now();
      return writeJson(response, 200, {
        status: "ok",
        data: {
          apiVersion: "local-client-governed-onboarding-api-v1",
          planVersion: "local-client-governed-onboarding-plan-v1",
          planId,
          profileId: body.profileId,
          action: "enable",
          createdAtMs: now,
          expiresAtMs: now + 300_000,
          writesPerformed: false,
          redacted: true,
        },
      });
    }

    const controlCenterMutationMatch = /^\/local-clients\/onboarding\/(approve|apply|rollback)$/u.exec(
      request.url ?? "",
    );
    if (request.method === "POST" && controlCenterMutationMatch) {
      const operation = controlCenterMutationMatch[1];
      const body = await readJsonBody(request);
      const profileId = plansById.get(body.planId);
      controlCenterRequests.push({
        operation,
        authorization: request.headers.authorization ?? null,
        idempotencyKey: request.headers["idempotency-key"] ?? null,
        body,
        profileId,
      });
      if (request.headers.authorization !== "Bearer uai-mock-admin-key" || !profileId) {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED" },
        });
      }
      if (operation === "approve") {
        const now = Date.now();
        return writeJson(response, 200, {
          status: "ok",
          data: {
            apiVersion: "local-client-governed-onboarding-api-v1",
            operation: "approve",
            status: "approved",
            approvalId: `approval_${profileIds.indexOf(profileId) + 1}`,
            planId: body.planId,
            approvedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 300_000).toISOString(),
            writesPerformed: false,
            redacted: true,
          },
        });
      }
      if (operation === "apply" && options.failApplyProfileId === profileId) {
        if (options.commitBeforeFailedApply) installedProfiles.add(profileId);
        return writeJson(response, 503, {
          status: "error",
          error: {
            code: "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
            message: "private mutation detail must not be returned",
          },
        });
      }
      if (operation === "apply") installedProfiles.add(profileId);
      return writeJson(response, 200, {
        status: "ok",
        data: {
          accepted: true,
          status: "completed",
          statusCode: 200,
          idempotencyStatus: "created",
          replayed: false,
          replayable: true,
          operationInvoked: true,
          retryAllowed: false,
          result: {
            apiVersion: "local-client-governed-onboarding-api-v1",
            operation,
            profileId,
            action: operation === "apply" ? "enable" : operation,
            planId: body.planId,
            status: "completed",
            receipt: onboardingApplyReceipt(profileId),
            redacted: true,
          },
        },
      });
    }

    if (request.method === "GET" && request.url === "/health/check") {
      return writeJson(response, 200, {
        success: true,
        data: {
          status: "ready",
          providerMode: realProviderEnabled ? "real" : "fake",
          realProviderEnabled,
          providers: [
            {
              id: realProviderEnabled
                ? "mock-real-provider"
                : "local-fake-provider",
            },
          ],
        },
      });
    }

    if (request.method === "GET" && request.url === "/setup/readiness") {
      return writeJson(response, 200, {
        success: true,
        data: {
          readiness: {
            chat: { ready: true },
          },
        },
      });
    }

    if (request.method === "POST" && request.url === "/chat") {
      chatRequestCount += 1;
      const body = await readJsonBody(request);
      lastPrompt = body.messages?.[0]?.content ?? null;
      lastPromptEnhancement = body.promptEnhancement ?? null;
      return writeJson(response, 200, {
        success: true,
        data: {
          outputText: "mock response",
          selectedProvider: realProviderEnabled
            ? "mock-real-provider"
            : "local-fake-provider",
          selectedModel: realProviderEnabled
            ? "mock-real-model"
            : "local-fake-model",
          executionMode: realProviderEnabled ? "real" : "fake",
          executionStatus: "completed",
          ...(body.promptEnhancement?.enabled
            ? {
                promptEnhancement: {
                  applied: true,
                  profile: body.promptEnhancement.profile ?? "general",
                  language: body.promptEnhancement.language ?? "auto",
                  engine: "local-deterministic",
                  version: "prompt-enhancer-v3",
                  providerCalled: false,
                  originalPreserved: true,
                },
              }
            : {}),
        },
      });
    }

    if (request.method === "POST" && request.url === "/prompts/enhance") {
      promptEnhancementRequestCount += 1;
      const body = await readJsonBody(request);
      lastPromptEnhancementLanguage = body.language ?? "auto";
      return writeJson(response, 200, {
        status: "ok",
        data: {
          original: body.input,
          enhancedPrompt: `# Task\n\n${body.input}\n\n# Execution requirements`,
          profile: body.profile === "auto" ? "general" : body.profile,
          language: body.language ?? "auto",
          clarifyingQuestions: options.clarifyingQuestions ?? [],
          signals: {
            format: false,
            constraints: false,
            audience: false,
            environment: false,
            evidence: false,
            success: false,
          },
          sections: [
            { id: "context", title: "# Task essentials", items: ["mock"] },
            { id: "execution", title: "# Execution requirements", items: ["mock"] },
            { id: "output", title: "# Output requirements", items: ["mock"] },
            { id: "acceptance", title: "# Completion criteria", items: ["mock"] },
          ],
          metadata: {
            engine: "local-deterministic",
            providerCalled: false,
            credentialRequired: false,
            originalPreserved: true,
            deterministic: true,
          },
        },
      });
    }

    return writeJson(response, 404, {
      success: false,
      error: { message: "not found" },
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.ok(port);

  return {
    url: `http://127.0.0.1:${port}`,
    get chatRequestCount() {
      return chatRequestCount;
    },
    get promptEnhancementRequestCount() {
      return promptEnhancementRequestCount;
    },
    get lastPrompt() {
      return lastPrompt;
    },
    get lastPromptEnhancement() {
      return lastPromptEnhancement;
    },
    get lastPromptEnhancementLanguage() {
      return lastPromptEnhancementLanguage;
    },
    get lastSpendAuthorization() {
      return lastSpendAuthorization;
    },
    get lastClientsAuthorization() {
      return lastClientsAuthorization;
    },
    get lastOnboardingAuthorization() {
      return lastOnboardingAuthorization;
    },
    get lastModelsAuthorization() {
      return lastModelsAuthorization;
    },
    get controlCenterMutationRequestCount() {
      return controlCenterRequests.filter(({ operation }) => operation !== "plan").length;
    },
    get controlCenterIdempotencyKeys() {
      return controlCenterRequests
        .map(({ idempotencyKey }) => idempotencyKey)
        .filter(Boolean);
    },
    controlCenterRequestCount(operation) {
      return operation === undefined
        ? controlCenterRequests.length
        : controlCenterRequests.filter((entry) => entry.operation === operation).length;
    },
    close: () =>
      new Promise((resolvePromise, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolvePromise();
        });
      }),
  };
}

function onboardingProfile(profileId, client) {
  return {
    profileId,
    client,
    format: "json-only",
    containerKey: client === "vscode" ? "servers" : "mcpServers",
    serverName: "unified-ai-system",
    transport: "stdio",
    backupProtection: "aes-256-gcm",
    supportedActions: ["enable", "disable"],
    certificationStatus: "fixture-tested-not-real-client-certified",
    redacted: true,
  };
}

function controlCenterManifest(gatewayUrl) {
  return {
    schema: "unified-ai-system/local-ai-control-center/v1",
    gatewayUrl,
    profiles: [
      "claude-compatible-mcp-json",
      "cursor-mcp-json",
      "vscode-mcp-json",
    ],
  };
}

async function createLifecycleMockGateway(options = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const parsedUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const authorization = request.headers.authorization ?? null;
    const idempotencyKey = request.headers["idempotency-key"] ?? null;

    if (request.method === "GET" && parsedUrl.pathname === "/local-clients/registry") {
      requests.push({
        operation: "list",
        authorization,
        idempotencyKey,
        body: null,
        url: request.url,
        mutation: false,
      });
      if (authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED", message: "private auth detail" },
        });
      }
      if (writeLifecycleMockError(response, options, "list")) return;
      const offset = Number(parsedUrl.searchParams.get("offset") ?? 0);
      const clients = offset === 0 ? [lifecycleClient()] : [];
      return writeJson(response, 200, {
        status: "ok",
        data: lifecycleRegistry(clients, offset),
      });
    }

    const routeOperations = new Map([
      ["/local-clients/discover/system", "discover"],
      ["/local-clients/register", "register"],
      ["/local-clients/verify", "verify"],
      ["/local-clients/disable", "disable"],
      ["/local-clients/revoke", "revoke"],
      ["/local-clients/smart-manage", "smart-manage"],
    ]);
    const operation = routeOperations.get(parsedUrl.pathname);
    if (request.method === "POST" && operation) {
      const body = await readJsonBody(request);
      const mutation = new Set(["register", "verify", "disable", "revoke"]).has(operation)
        || (new Set(["discover", "smart-manage"]).has(operation) && body.dryRun === false);
      requests.push({
        operation,
        authorization,
        idempotencyKey,
        body,
        url: request.url,
        mutation,
      });
      if (authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED", message: "private auth detail" },
        });
      }
      if (writeLifecycleMockError(response, options, operation)) return;

      if (operation === "discover") {
        const common = {
          phase: "local-client-intelligence-gateway-v1",
          source: "local-process-scan",
          strategy: "system-scan",
          dryRun: body.dryRun,
          discovered: 1,
          includedSystemProcesses: body.includeSystemProcesses === true,
          includeUnknown: body.autoDiscoverAll === true || body.includeUnknown === true,
          includeMissingAsDisabled: body.includeMissingAsDisabled === true,
          autoDiscoverAll: body.autoDiscoverAll === true,
          maxProcesses: body.maxProcesses ?? 200,
          dropped: {
            filteredSystemProcessCount: 1,
            filteredUnknownCount: 2,
            duplicateProcessCount: 3,
          },
        };
        return writeJson(response, 200, {
          status: "ok",
          data: body.dryRun
            ? { ...common, candidates: [lifecycleClient()] }
            : {
                ...common,
                includeMissingAsDisabled: undefined,
                inserted: ["fixture-client"],
                updated: [],
                registry: lifecycleRegistry([lifecycleClient()], 0),
              },
        });
      }
      if (operation === "register") {
        return writeJson(response, 200, {
          status: "ok",
          data: {
            phase: "local-client-intelligence-gateway-v1",
            action: "updated",
            client: lifecycleClient(),
            command: "private-command --token token-value",
          },
        });
      }
      if (operation === "verify") {
        return writeJson(response, 200, {
          status: "ok",
          data: {
            promotionVersion: "local-client-verification-promotion-v1",
            descriptorVersion: "verified-local-client-adapter-target-v1",
            clientId: body.clientId,
            revision: body.expectedRevision + 1,
            state: "verified",
            trustDecision: "verified",
            adapter: body.expectedAdapter,
            manifestSha256: body.expectedManifestSha256,
            capabilityIds: ["browser"],
            verification: {
              evidenceVersion: "local-client-verification-evidence-v1",
              fingerprint: "b".repeat(64),
              verifiedAtMs: 1_000,
              expiresAtMs: 2_000,
            },
            path: "C:\\secret-path\\client.json",
          },
        });
      }
      if (operation === "disable") {
        return writeJson(response, 200, {
          status: "ok",
          data: {
            phase: "local-client-intelligence-gateway-v1",
            mode: "applied",
            action: "disabled",
            client: lifecycleClient({ state: "disabled", enabled: false }),
          },
        });
      }
      if (operation === "revoke") {
        return writeJson(response, 200, {
          status: "ok",
          data: {
            phase: "local-client-intelligence-gateway-v1",
            mode: "applied",
            action: "revoked",
            client: lifecycleClient({
              state: "revoked",
              enabled: false,
              routable: false,
              trustDecision: "rejected",
              revision: body.expectedRevision + 1,
            }),
          },
        });
      }
      return writeJson(response, 200, {
        status: "ok",
        data: {
          phase: "local-client-intelligence-gateway-v1",
          action: "smart-manage",
          dryRun: body.dryRun,
          includeDiscoveryOnly: false,
          discovery: {
            phase: "local-client-intelligence-gateway-v1",
            source: "local-management-cycle",
            dryRun: body.dryRun,
            discovered: 1,
            includeUnknown: true,
            includeMissingAsDisabled: true,
            includeSystemProcesses: false,
            autoDiscoverAll: true,
            dropped: {
              filteredSystemProcessCount: 1,
              filteredUnknownCount: 2,
              duplicateProcessCount: 3,
            },
          },
          maintenance: {
            dryRun: body.dryRun,
            staleCandidates: 0,
            autoRiskRecoveries: 0,
            summary: {
              totalClients: 1,
              staleCandidates: 0,
              riskCandidates: 0,
              appliedChanges: 0,
            },
            counts: {
              staleDisabledCount: 0,
              autoRiskRecoveredCount: 0,
              riskDisabledCount: 0,
              riskMarkedCount: 0,
            },
          },
          recommendations: ["run private-command --token token-value"],
          registrySnapshot: [],
          generatedAt: "2026-08-28T00:00:00.000Z",
          executedAt: "2026-08-28T00:00:00.000Z",
        },
      });
    }

    return writeJson(response, 404, {
      status: "error",
      error: { code: "NOT_FOUND" },
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.ok(port);

  return {
    url: `http://127.0.0.1:${port}`,
    get mutationRequestCount() {
      return requests.filter((entry) => entry.mutation).length;
    },
    requestCount(operation) {
      return operation === undefined
        ? requests.length
        : requests.filter((entry) => entry.operation === operation).length;
    },
    last(operation) {
      return requests.filter((entry) => entry.operation === operation).at(-1) ?? null;
    },
    close: () => new Promise((resolvePromise, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolvePromise();
      });
    }),
  };
}

function lifecycleClient(overrides = {}) {
  return {
    clientId: "fixture-client",
    displayName: "Fixture Client",
    state: "declared",
    enabled: true,
    routable: true,
    adapterId: "loopback.adapter",
    adapterType: "loopback-http",
    adapterVersion: "1.0.0",
    manifestSha256: "a".repeat(64),
    protocolVersion: "1.0",
    capabilityIds: ["browser"],
    health: {
      status: "unknown",
      latencyMs: null,
      lastSeenAt: "2026-08-28T00:00:00.000Z",
      leaseExpiresAt: null,
    },
    trustDecision: "declared",
    revision: 7,
    executable: "C:\\secret-path\\private-command.exe",
    command: "private-command --token token-value",
    endpoint: "http://127.0.0.1/private",
    metadata: { token: "token-value" },
    ...overrides,
  };
}

function lifecycleRegistry(clients, offset) {
  return {
    phase: "local-client-intelligence-gateway-v1",
    total: clients.length,
    clients,
    pagination: {
      offset,
      limit: 100,
      returned: clients.length,
      includeDisabled: true,
    },
  };
}

function writeLifecycleMockError(response, options, operation) {
  if (options.errorOperation !== operation) return false;
  writeJson(response, 503, {
    status: "error",
    error: {
      code: options.errorCode ?? "local_client_register_persistence_failed",
      message: "launch private-command --token token-value",
      path: "C:\\secret-path\\client.json",
      command: "powershell.exe -File private.ps1",
      env: { PRIVATE_TOKEN: "token-value" },
    },
  });
  return true;
}

async function createOnboardingMockGateway(options = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const authorization = request.headers.authorization ?? null;
    const idempotencyKey = request.headers["idempotency-key"] ?? null;

    if (request.method === "GET" && request.url === "/local-clients/onboarding/profiles") {
      requests.push({ operation: "profiles", authorization, idempotencyKey, body: null });
      if (writeOnboardingMockError(response, options, "profiles")) return;
      return writeJson(response, 200, {
        status: "ok",
        data: [
          onboardingProfile("claude-compatible-mcp-json", "claude-compatible"),
          onboardingProfile("cursor-mcp-json", "cursor"),
          onboardingProfile("vscode-mcp-json", "vscode"),
        ],
      });
    }

    const verifyMatch = /^\/local-clients\/onboarding\/profiles\/([^/]+)\/verify$/u.exec(
      request.url ?? "",
    );
    if (request.method === "GET" && verifyMatch) {
      const profileId = decodeURIComponent(verifyMatch[1]);
      requests.push({ operation: "verify", authorization, idempotencyKey, body: null });
      if (writeOnboardingMockError(response, options, "verify")) return;
      return writeJson(response, 200, {
        status: "ok",
        data: onboardingVerification(profileId),
      });
    }

    const inspectMatch = /^\/local-clients\/onboarding\/profiles\/([^/]+)$/u.exec(
      request.url ?? "",
    );
    if (request.method === "GET" && inspectMatch) {
      const profileId = decodeURIComponent(inspectMatch[1]);
      requests.push({ operation: "inspect", authorization, idempotencyKey, body: null });
      if (writeOnboardingMockError(response, options, "inspect")) return;
      const client = profileId === "vscode-mcp-json"
        ? "vscode"
        : profileId === "cursor-mcp-json"
          ? "cursor"
          : "claude-compatible";
      return writeJson(response, 200, {
        status: "ok",
        data: {
          profile: onboardingProfile(profileId, client),
          installation: onboardingVerification(profileId),
          recoveryRequired: false,
          journalCorrupt: false,
          pendingTransactionCount: 0,
          storedPlanCount: 0,
          available: true,
        },
      });
    }

    if (request.method === "POST" && request.url === "/local-clients/onboarding/plans") {
      const body = await readJsonBody(request);
      requests.push({ operation: "plan", authorization, idempotencyKey, body });
      if (writeOnboardingMockError(response, options, "plan")) return;
      return writeJson(response, 200, {
        status: "ok",
        data: {
          apiVersion: "local-client-governed-onboarding-api-v1",
          planVersion: "local-client-governed-onboarding-plan-v1",
          planId: onboardingPlanId,
          planDigest: "a".repeat(64),
          profileId: body.profileId,
          action: body.action,
          scopes: ["fixture-only"],
          createdAtMs: 1_000,
          expiresAtMs: 2_000,
          writesPerformed: false,
          redacted: true,
        },
      });
    }

    const mutationMatch = /^\/local-clients\/onboarding\/(approve|apply|rollback|recover)$/u.exec(
      request.url ?? "",
    );
    if (request.method === "POST" && mutationMatch) {
      const operation = mutationMatch[1];
      const body = await readJsonBody(request);
      requests.push({ operation, authorization, idempotencyKey, body });
      if (authorization !== "Bearer uai-mock-admin-key") {
        return writeJson(response, 401, {
          status: "error",
          error: { code: "UNAUTHENTICATED", message: "private auth detail" },
        });
      }
      if (writeOnboardingMockError(response, options, operation)) return;
      if (operation === "approve") {
        return writeJson(response, 200, {
          status: "ok",
          data: {
            apiVersion: "local-client-governed-onboarding-api-v1",
            operation: "approve",
            status: "approved",
            approvalId: "approval_fixture",
            planId: body.planId,
            planDigest: "a".repeat(64),
            scopes: ["fixture-only"],
            approvedAt: "2026-08-28T00:00:00.000Z",
            expiresAt: "2026-08-28T00:05:00.000Z",
            writesPerformed: false,
            redacted: true,
          },
        });
      }
      const receipt = operation === "apply"
        ? onboardingApplyReceipt()
        : operation === "rollback"
          ? {
              rollbackVersion: "local-client-onboarding-rollback-v1",
              profileId: "cursor-mcp-json",
              action: "enable",
              planId: `onboard:cursor-mcp-json:${"b".repeat(64)}`,
              transaction: {},
              format: "json-only",
              certificationStatus: "fixture-tested-not-real-client-certified",
              redacted: true,
            }
          : {
              recoveryVersion: "local-client-onboarding-recovery-v1",
              profileId: "cursor-mcp-json",
              transaction: {},
              format: "json-only",
              certificationStatus: "fixture-tested-not-real-client-certified",
              redacted: true,
            };
      return writeJson(response, 200, {
        status: "ok",
        data: {
          accepted: true,
          status: "completed",
          statusCode: 200,
          idempotencyStatus: "created",
          replayed: false,
          replayable: true,
          operationInvoked: true,
          retryAllowed: false,
          result: {
            apiVersion: "local-client-governed-onboarding-api-v1",
            operation,
            profileId: "cursor-mcp-json",
            action: operation === "apply" ? "enable" : operation,
            planId: body.planId,
            status: "completed",
            receipt,
            redacted: true,
          },
        },
      });
    }

    return writeJson(response, 404, {
      status: "error",
      error: { code: "NOT_FOUND" },
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.ok(port);

  return {
    url: `http://127.0.0.1:${port}`,
    get mutationRequestCount() {
      return requests.filter(({ operation }) => (
        ["approve", "apply", "rollback", "recover"].includes(operation)
      )).length;
    },
    requestCount(operation) {
      return requests.filter((entry) => entry.operation === operation).length;
    },
    last(operation) {
      return requests.filter((entry) => entry.operation === operation).at(-1) ?? null;
    },
    close: () => new Promise((resolvePromise, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolvePromise();
      });
    }),
  };
}

function writeOnboardingMockError(response, options, operation) {
  if (options.errorOperation !== operation) return false;
  writeJson(response, 503, {
    status: "error",
    error: {
      code: options.errorCode ?? "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
      message: "launch --token secret-value",
      path: "C:\\Users\\secret\\client.json",
      command: "powershell.exe -File private.ps1",
      env: { PRIVATE_TOKEN: "secret-value" },
    },
  });
  return true;
}

function onboardingVerification(profileId, installed = true) {
  return {
    profileId,
    installed,
    state: installed ? "exact" : "absent",
    format: "json-only",
    certificationStatus: "fixture-tested-not-real-client-certified",
    redacted: true,
  };
}

function onboardingApplyReceipt(profileId = "cursor-mcp-json") {
  const transactionPlanId = "b".repeat(64);
  return {
    receiptVersion: "local-client-onboarding-receipt-v1",
    profileId,
    action: "enable",
    planId: `onboard:${profileId}:${transactionPlanId}`,
    transaction: {
      receiptVersion: "local-client-config-receipt-v1",
      transactionId: `tx_${"c".repeat(64)}`,
      planId: transactionPlanId,
      targetFingerprint: "d".repeat(64),
      beforeSha256: "e".repeat(64),
      afterSha256: "f".repeat(64),
      backupSha256: "1".repeat(64),
      afterIdentityFingerprint: "2".repeat(64),
      committedAtMs: 1_000,
      receiptDigest: "3".repeat(64),
    },
    receiptDigest: "4".repeat(64),
    format: "json-only",
    certificationStatus: "fixture-tested-not-real-client-certified",
    redacted: true,
  };
}

function runCliProcess(args, input = "", options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cliEntrypoint, ...args], {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...process.env,
        ...options.env,
        NO_COLOR: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    // The demo command starts an isolated Gateway and has its own 30-second
    // readiness deadline. Keep the outer harness beyond that product deadline
    // so a loaded Windows host reports the real diagnostic instead of a false
    // test-process timeout.
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 45_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolvePromise({
        code: code ?? (signal ? 1 : 0),
        stdout,
        stderr,
      });
    });
    child.stdin.end(input);
  });
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(body));
}
