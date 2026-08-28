import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
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

async function createMockGateway(options = {}) {
  let chatRequestCount = 0;
  let promptEnhancementRequestCount = 0;
  let lastPrompt = null;
  let lastPromptEnhancement = null;
  let lastPromptEnhancementLanguage = null;
  let lastSpendAuthorization = null;
  let lastClientsAuthorization = null;
  let lastOnboardingAuthorization = null;
  const realProviderEnabled = options.realProviderEnabled === true;
  const server = createServer(async (request, response) => {
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

function onboardingVerification(profileId) {
  return {
    profileId,
    installed: true,
    state: "exact",
    format: "json-only",
    certificationStatus: "fixture-tested-not-real-client-certified",
    redacted: true,
  };
}

function onboardingApplyReceipt() {
  const transactionPlanId = "b".repeat(64);
  return {
    receiptVersion: "local-client-onboarding-receipt-v1",
    profileId: "cursor-mcp-json",
    action: "enable",
    planId: `onboard:cursor-mcp-json:${transactionPlanId}`,
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
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 20_000);

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
