import { createHash } from "node:crypto";
import { link, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
  LOCAL_CLIENT_ONBOARDING_PROFILE_IDS,
  createLocalClientOnboardingRegistry,
  type LocalClientOnboardingProfileId,
  type LocalClientOnboardingRegistry,
  type LocalClientOnboardingRegistryV1Options,
  type LocalClientOnboardingRegistryOptions,
} from "./localClientOnboardingRegistry.ts";

import * as transactionModule from "./localClientConfigTransaction.ts";
import { parseDocument } from "yaml";

const PRIVATE_COMMAND = "private-command-must-not-leak";
const PRIVATE_ARG = "--private-argument-must-not-leak";
const PRIVATE_ENV = "private-env-value-must-not-leak";

const PROFILE_CASES = [
  {
    profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.claudeCompatible,
    targetKey: "claude" as const,
    containerKey: "mcpServers" as const,
    vscode: false,
  },
  {
    profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.cursor,
    targetKey: "cursor" as const,
    containerKey: "mcpServers" as const,
    vscode: false,
  },
  {
    profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscode,
    targetKey: "vscode" as const,
    containerKey: "servers" as const,
    vscode: true,
  },
] as const;

describe("LocalClientOnboardingRegistry", () => {
  let root = "";
  let registry: LocalClientOnboardingRegistry;
  let registryOptions: LocalClientOnboardingRegistryV1Options;
  let targets: Record<(typeof PROFILE_CASES)[number]["targetKey"], string>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-onboarding-"));
    targets = {
      claude: join(root, "claude", "config.json"),
      cursor: join(root, "cursor", "mcp.json"),
      vscode: join(root, "vscode", "mcp.json"),
    };
    for (const targetPath of Object.values(targets)) await mkdir(dirname(targetPath), { recursive: true });
    await Promise.all([
      writeFile(targets.claude, fixture("mcpServers", "claude-theme"), "utf8"),
      writeFile(targets.cursor, fixture("mcpServers", "cursor-theme"), "utf8"),
      writeFile(targets.vscode, fixture("servers", "vscode-theme"), "utf8"),
    ]);
    registryOptions = createOptions(root, targets);
    registry = await createLocalClientOnboardingRegistry(registryOptions);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("lists only three redacted code-registered JSON profiles", () => {
    const profiles = registry.listProfiles();

    expect(profiles).toEqual([
      expect.objectContaining({
        profileId: "claude-compatible-mcp-json",
        client: "claude-compatible",
        format: "json-only",
        containerKey: "mcpServers",
      }),
      expect.objectContaining({
        profileId: "cursor-mcp-json",
        client: "cursor",
        format: "json-only",
        containerKey: "mcpServers",
      }),
      expect.objectContaining({
        profileId: "vscode-mcp-json",
        client: "vscode",
        format: "json-only",
        containerKey: "servers",
      }),
    ]);
    for (const profile of profiles) {
      expect(profile).toMatchObject({
        serverName: "unified-ai-system",
        transport: "stdio",
        supportedActions: ["enable", "disable"],
        certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
        redacted: true,
      });
    }
    assertRedacted(profiles, root, ...Object.values(targets));
  });

  it("rejects normalized target aliases before independent locks can govern one file", async () => {
    const aliasDirectory = join(root, "alias-segment");
    await mkdir(aliasDirectory, { recursive: true });
    const options = createOptions(root, targets) as any;
    options.profiles.cursor.targetPath = `${aliasDirectory}${sep}..${sep}claude${sep}config.json`;

    await expect(createLocalClientOnboardingRegistry(options)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_CONFIGURATION_INVALID",
      statusCode: 500,
    });
  });

  it("rejects two distinct target paths that are hard links to one file identity", async () => {
    const hardLinkDirectory = join(root, "hard-link");
    await mkdir(hardLinkDirectory, { recursive: true });
    const hardLinkTarget = join(hardLinkDirectory, "cursor.json");
    await link(targets.claude, hardLinkTarget);
    const options = createOptions(root, targets) as any;
    options.profiles.cursor.targetPath = hardLinkTarget;

    await expect(createLocalClientOnboardingRegistry(options)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_CONFIGURATION_INVALID",
      statusCode: 500,
    });
  });

  it.each([
    {
      name: "target equals another profile journal",
      mutate(options: any) {
        options.profiles.cursor.journalPath = options.profiles.claudeCompatible.targetPath;
      },
    },
    {
      name: "backup contains another profile target",
      mutate(options: any) {
        options.profiles.cursor.backupDir = dirname(options.profiles.vscode.targetPath);
      },
    },
    {
      name: "one backup directory nests another",
      mutate(options: any) {
        options.profiles.cursor.backupDir = join(options.profiles.claudeCompatible.backupDir, "nested");
      },
    },
  ])("rejects cross-role storage collision: $name", async ({ mutate }) => {
    const options = createOptions(root, targets) as any;
    mutate(options);
    await expect(createLocalClientOnboardingRegistry(options)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_CONFIGURATION_INVALID",
      statusCode: 500,
    });
  });

  it.each(PROFILE_CASES)(
    "enables and verifies $profileId while preserving unrelated fields",
    async ({ profileId, targetKey, containerKey, vscode }) => {
      const before = await readFile(targets[targetKey]);
      const initial = await registry.inspect(profileId);
      expect(initial).toMatchObject({
        installation: { installed: false, state: "absent" },
        recoveryRequired: false,
        journalCorrupt: false,
      });

      const plan = await registry.plan(profileId, "enable");
      expect(await readFile(targets[targetKey])).toEqual(before);
      expect(plan).toMatchObject({
        profileId,
        action: "enable",
        writesPerformed: false,
        format: "json-only",
        certificationStatus: "fixture-tested-not-real-client-certified",
        redacted: true,
      });
      const receipt = await registry.apply(plan.planId);
      const stored = JSON.parse(await readFile(targets[targetKey], "utf8"));

      expect(stored.unrelated).toEqual({
        theme: `${targetKey}-theme`,
        nested: { keep: true },
      });
      expect(stored[containerKey].existing).toEqual({ command: "existing-command" });
      expect(stored[containerKey]["unified-ai-system"]).toEqual({
        ...(vscode ? { type: "stdio" } : {}),
        command: PRIVATE_COMMAND,
        args: ["gateway-entry.mjs", PRIVATE_ARG],
        cwd: join(root, "private-cwd"),
        env: { UNIFIED_AI_PRIVATE_VALUE: PRIVATE_ENV },
      });
      await expect(registry.verifyInstalled(profileId)).resolves.toMatchObject({
        installed: true,
        state: "exact",
        certificationStatus: "fixture-tested-not-real-client-certified",
      });
      expect(receipt).toMatchObject({
        profileId,
        action: "enable",
        planId: plan.planId,
        transaction: {
          beforeSha256: sha256(before),
          afterSha256: plan.afterSha256,
        },
        format: "json-only",
        certificationStatus: "fixture-tested-not-real-client-certified",
      });
      assertRedacted([initial, plan, receipt], root, targets[targetKey]);
    },
  );

  it("disable removes only unified-ai-system and preserves other Cursor entries", async () => {
    const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.cursor;
    const enable = await registry.plan(profileId, "enable");
    await registry.apply(enable.planId);
    const disable = await registry.plan(profileId, "disable");
    const receipt = await registry.apply(disable.planId);
    const stored = JSON.parse(await readFile(targets.cursor, "utf8"));

    expect(stored.mcpServers).toEqual({ existing: { command: "existing-command" } });
    expect(stored.unrelated).toEqual({ theme: "cursor-theme", nested: { keep: true } });
    await expect(registry.verifyInstalled(profileId)).resolves.toMatchObject({
      installed: false,
      state: "absent",
    });
    expect(receipt).toMatchObject({ profileId, action: "disable" });
  });

  it("restores byte-identical configuration through receipt-bound rollback", async () => {
    const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.claudeCompatible;
    const original = Buffer.from(fixture("mcpServers", "claude-theme").replace(/\n/gu, "\r\n"), "utf8");
    await writeFile(targets.claude, original);

    const plan = await registry.plan(profileId, "enable");
    const receipt = await registry.apply(plan.planId);
    expect(await readFile(targets.claude)).not.toEqual(original);
    const rollback = await registry.rollback(receipt);

    expect(await readFile(targets.claude)).toEqual(original);
    expect(rollback).toMatchObject({
      profileId,
      action: "enable",
      planId: plan.planId,
      transaction: {
        restoredSha256: sha256(original),
        replacedSha256: plan.afterSha256,
      },
      format: "json-only",
      certificationStatus: "fixture-tested-not-real-client-certified",
      redacted: true,
    });
    assertRedacted([receipt, rollback], root, targets.claude);
  });

  it("rejects a plan whose public profile binding is changed", async () => {
    const plan = await registry.plan(LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.claudeCompatible, "enable");
    const forged = plan.planId.replace(
      `onboard:${LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.claudeCompatible}:`,
      `onboard:${LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.cursor}:`,
    );

    await expect(registry.apply(forged)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_PLAN_PROFILE_MISMATCH",
      statusCode: 409,
    });
    await expect(registry.apply(plan.planId)).resolves.toMatchObject({
      profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.claudeCompatible,
    });
  });

  it("fails closed for corrupt JSON and a post-plan external change", async () => {
    const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscode;
    await writeFile(targets.vscode, "{not-json", "utf8");
    await expect(registry.inspect(profileId)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID",
    });
    await expect(registry.plan(profileId, "enable")).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_JSON_INVALID",
    });

    await writeFile(targets.vscode, fixture("servers", "vscode-theme"), "utf8");
    const restarted = await createLocalClientOnboardingRegistry(registryOptions);
    const plan = await restarted.plan(profileId, "enable");
    const externallyChanged = JSON.parse(await readFile(targets.vscode, "utf8"));
    externallyChanged.externalOwner = { mustRemain: true };
    await writeFile(targets.vscode, `${JSON.stringify(externallyChanged, null, 2)}\n`, "utf8");

    await expect(restarted.apply(plan.planId)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_CONFIG_TARGET_CHANGED",
      statusCode: 409,
    });
    expect(JSON.parse(await readFile(targets.vscode, "utf8"))).toMatchObject({
      externalOwner: { mustRemain: true },
    });
  });

  it("surfaces corrupt journal state and refuses plan/apply until explicit recovery", async () => {
    const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.cursor;
    const journalPath = registryOptions.profiles.cursor.journalPath;
    await mkdir(dirname(journalPath), { recursive: true });
    await writeFile(journalPath, "{not-json", "utf8");
    const restarted = await createLocalClientOnboardingRegistry(registryOptions);

    await expect(restarted.inspect(profileId)).resolves.toMatchObject({
      recoveryRequired: true,
      journalCorrupt: true,
    });
    await expect(restarted.plan(profileId, "enable")).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECOVERY_REQUIRED",
    });
    await expect(restarted.recover(profileId)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECOVERY_REQUIRED",
    });
  });

  it("recovers a provable pending-before state by profile without exposing config", async () => {
    const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.claudeCompatible;
    const original = await readFile(targets.claude);
    const plan = await registry.plan(profileId, "enable");
    await registry.apply(plan.planId);
    const journalPath = registryOptions.profiles.claudeCompatible.journalPath;
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    const entry = journal.entries[0];
    entry.status = "pending";
    entry.afterIdentityFingerprint = null;
    entry.committedAtMs = null;
    entry.receiptDigest = null;
    entry.rolledBackAtMs = null;
    entry.rollbackReceiptDigest = null;
    entry.updatedAtMs = entry.createdAtMs;
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
    await writeFile(targets.claude, original);

    const restarted = await createLocalClientOnboardingRegistry(registryOptions);
    await expect(restarted.inspect(profileId)).resolves.toMatchObject({
      recoveryRequired: true,
      pendingTransactionCount: 1,
    });
    const recovery = await restarted.recover(profileId);
    expect(recovery).toMatchObject({
      profileId,
      transaction: {
        resolution: "apply-aborted",
        currentSha256: sha256(original),
      },
      format: "json-only",
      certificationStatus: "fixture-tested-not-real-client-certified",
      redacted: true,
    });
    await expect(restarted.verifyInstalled(profileId)).resolves.toMatchObject({
      installed: false,
      state: "absent",
    });
    assertRedacted(recovery, root, targets.claude);
  });

  it("redacts every public result and rejects unknown input instead of accepting config", async () => {
    const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscode;
    const inspection = await registry.inspect(profileId);
    const plan = await registry.plan(profileId, "enable");
    const receipt = await registry.apply(plan.planId);
    const verification = await registry.verifyInstalled(profileId);

    assertRedacted(
      [registry.listProfiles(), inspection, plan, receipt, verification],
      root,
      ...Object.values(targets),
    );
    await expect(registry.inspect("attacker-profile" as LocalClientOnboardingProfileId))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_PROFILE_UNKNOWN" });
    await expect(registry.plan(profileId, "replace" as never))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_ACTION_INVALID" });
    await expect(registry.apply("onboard:vscode-mcp-json:not-a-plan"))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_PLAN_UNKNOWN" });
  });

  it.each(["jsonc", "toml", "yaml"] as const)("selects one explicit %s profile across inspect, enable, verify, disable, restart and exact rollback", async (format) => {
    const original = format === "yaml" ? Buffer.from('name: Fixture\r\nversion: "1"\r\nschema: v1\r\nmcpServers:\r\n  - {name: other, command: unchanged}\r\n') : format === "toml" ? Buffer.from('# retained TOML fixture\r\nmodel = "preserved"\r\n[mcp_servers.other]\r\ncommand = "unchanged"') : Buffer.from('\ufeff{\r\n // retained JSONC fixture\r\n "servers": { "other" : {"args":["a",],}, }, /* end */\r\n}');
    await registry.close();
    const legacyBefore = await Promise.all([readFile(targets.claude), readFile(targets.cursor)]);
    await writeFile(targets.vscode, original);
    const profileId = format === "yaml" ? LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.continueYaml : format === "toml" ? LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.codexToml : LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscodeJsonc;
    const options: LocalClientOnboardingRegistryOptions = {
      version: 2,
      profiles: [{ profileId, paths: registryOptions.profiles.vscode }],
      serverDefinition: format !== "jsonc" ? { transport: "stdio", command: "node", args: ["gateway.mjs"] } : registryOptions.serverDefinition,
      backupEncryptionKey: Buffer.alloc(32, 0x61),
    };
    registry = await createLocalClientOnboardingRegistry(options);
    expect(registry.listProfiles()).toEqual([expect.objectContaining({ profileId, format, client: format === "yaml" ? "continue" : format === "toml" ? "codex" : "vscode" })]);
    await expect(registry.inspect(LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.cursor)).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_PROFILE_UNKNOWN" });
    await expect(registry.inspect(profileId)).resolves.toMatchObject({ installation: { state: "absent", format } });
    const plan = await registry.plan(profileId, "enable");
    expect(plan.format).toBe(format);
    const applied = await registry.apply(plan.planId);
    const enabled = await readFile(targets.vscode);
    expect(applied.format).toBe(format);
    if (format === "yaml") expect(enabled.toString()).toBe(original.toString() + '  - {"name":"unified-ai-system","command":"node","args":["gateway.mjs"]}\r\n');
    else if (format === "toml") expect(enabled.toString()).toBe(original.toString() + '\r\n[mcp_servers."unified-ai-system"]\r\ncommand = "node"\r\nargs = ["gateway.mjs"]');
    else {
      expect(enabled.toString()).toContain('"other" : {"args":["a",],}');
      expect(enabled.toString()).toContain("// retained JSONC fixture\r\n");
    }
    await expect(registry.verifyInstalled(profileId)).resolves.toMatchObject({ state: "exact", format });
    await expect(registry.rollback({ ...applied, format: "json-only" })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_INVALID" });
    expect(await readFile(targets.vscode)).toEqual(enabled);
    const disablePlan = await registry.plan(profileId, "disable");
    const disabled = await registry.apply(disablePlan.planId);
    await expect(registry.verifyInstalled(profileId)).resolves.toMatchObject({ state: "absent", format });
    const disabledReceipt = await registry.rollback(disabled);
    expect(disabledReceipt.format).toBe(format);
    expect(await readFile(targets.vscode)).toEqual(enabled);
    // A restored file has a new identity; use the fresh apply flow's receipt for restart rollback.
    const reDisable = await registry.apply((await registry.plan(profileId, "disable")).planId);
    await registry.close();
    registry = await createLocalClientOnboardingRegistry(options);
    await registry.rollback(reDisable);
    expect(await readFile(targets.vscode)).toEqual(enabled);
    await registry.close();
    // Independent lifecycle proves the original BOM, comments and whitespace survive encrypted restart rollback.
    await writeFile(targets.vscode, original);
    const freshOptions: LocalClientOnboardingRegistryOptions = {
      ...options,
      profiles: [{ profileId, paths: { ...registryOptions.profiles.vscode, backupDir: join(root, "jsonc-fresh-backups"), journalPath: join(root, "jsonc-fresh-journal.json") } }],
    };
    registry = await createLocalClientOnboardingRegistry(freshOptions);
    const freshReceipt = await registry.apply((await registry.plan(profileId, "enable")).planId);
    await registry.close();
    registry = await createLocalClientOnboardingRegistry(freshOptions);
    expect((await registry.rollback(freshReceipt)).format).toBe(format);
    expect(await readFile(targets.vscode)).toEqual(original);
    expect(await Promise.all([readFile(targets.claude), readFile(targets.cursor)])).toEqual(legacyBefore);
    assertRedacted([plan, applied, disabledReceipt, registry.listProfiles()], root, ...Object.values(targets));
  });

  it.each([LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.codexToml, LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.continueYaml])("rejects %s environment fields without opening a second profile or changing files", async (profileId) => {
    const before = await Promise.all(Object.values(targets).map(path => readFile(path)));
    await expect(createLocalClientOnboardingRegistry({ version: 2,
      profiles: [{ profileId, paths: registryOptions.profiles.vscode }],
      serverDefinition: { transport: "stdio", command: "node", args: [], env: {} },
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_CONFIGURATION_INVALID" });
    expect(await Promise.all(Object.values(targets).map(path => readFile(path)))).toEqual(before);
  });

  it("disables the only YAML member to an empty native list and restores its exact bytes after restart", async () => {
    await registry.close();
    const original = 'name: Fixture\nversion: "1"\nschema: v1\nmcpServers: [{name: unified-ai-system, command: node, args: []}] # keep\n';
    await writeFile(targets.vscode, original); const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.continueYaml;
    const options: LocalClientOnboardingRegistryOptions = { version: 2, profiles: [{ profileId, paths: registryOptions.profiles.vscode }],
      serverDefinition: { transport: "stdio", command: "node", args: [] }, backupEncryptionKey: Buffer.alloc(32, 0x6d) };
    registry = await createLocalClientOnboardingRegistry(options);
    await expect(registry.verifyInstalled(profileId)).resolves.toMatchObject({ state: "exact", format: "yaml" });
    const receipt = await registry.apply((await registry.plan(profileId, "disable")).planId);
    const disabled = await readFile(targets.vscode, "utf8");
    expect(parseDocument(disabled).toJS()).toEqual({ name: "Fixture", version: "1", schema: "v1", mcpServers: [] });
    expect(disabled).toContain("# keep"); await registry.close(); registry = await createLocalClientOnboardingRegistry(options);
    await registry.rollback(receipt); expect(await readFile(targets.vscode, "utf8")).toBe(original);
  });

  it("rejects a YAML sibling change between registry preparation and the transaction snapshot", async () => {
    await registry.close();
    const header = 'name: Fixture\nversion: "1"\nschema: v1\nmcpServers:\n';
    await writeFile(targets.vscode, header + '  - {name: other, command: before}\n');
    const changed = header + '  - {name: other, command: after}\n';
    const originalFactory = transactionModule.createLocalClientConfigTransactionEngine;
    const factory = vi.spyOn(transactionModule, "createLocalClientConfigTransactionEngine").mockImplementation(async options => {
      const engine = await originalFactory(options); const originalPlan = engine.plan.bind(engine);
      vi.spyOn(engine, "plan").mockImplementation(async request => { await writeFile(targets.vscode, changed); return originalPlan(request); });
      return engine;
    });
    try {
      registry = await createLocalClientOnboardingRegistry({ version: 2,
        profiles: [{ profileId: LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.continueYaml, paths: registryOptions.profiles.vscode }],
        serverDefinition: { transport: "stdio", command: "node", args: [] },
      });
      await expect(registry.plan(LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.continueYaml, "enable")).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_YAML_INVALID" });
      expect(await readFile(targets.vscode, "utf8")).toBe(changed);
      await expect(readFile(registryOptions.profiles.vscode.journalPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { factory.mockRestore(); vi.restoreAllMocks(); await registry.close(); }
  });

  it("rejects unknown, duplicate or absent selected JSONC profiles before opening storage", async () => {
    const profileId = LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.vscodeJsonc;
    const selected = { profileId, paths: registryOptions.profiles.vscode };
    const base = { version: 2, serverDefinition: registryOptions.serverDefinition };
    for (const profiles of [[], [selected, selected], [{ ...selected, profileId: "vscode-auto" }], [{ ...selected, format: "jsonc" }]]) {
      await expect(createLocalClientOnboardingRegistry({ ...base, profiles } as never)).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_CONFIGURATION_INVALID" });
    }
    const original = await readFile(targets.vscode);
    await writeFile(targets.vscode, '{"servers":{},"ser\\u0076ers":{}}');
    const jsoncRegistry = await createLocalClientOnboardingRegistry({ ...base, version: 2, profiles: [selected] });
    await expect(jsoncRegistry.inspect(profileId)).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID" });
    await expect(jsoncRegistry.plan(profileId, "enable")).rejects.toMatchObject({ code: "LOCAL_CLIENT_CONFIG_JSON_INVALID" });
    await jsoncRegistry.close();
    await writeFile(targets.vscode, original);
  });
});

function createOptions(
  root: string,
  targets: Record<(typeof PROFILE_CASES)[number]["targetKey"], string>,
): LocalClientOnboardingRegistryV1Options {
  const paths = (name: string, targetPath: string) => ({
    targetPath,
    allowedRoot: root,
    backupDir: join(root, `${name}-backups`),
    journalPath: join(root, `${name}-state`, "journal.json"),
    maxBytes: 64 * 1_024,
    maxTransactions: 16,
  });
  return {
    profiles: {
      claudeCompatible: paths("claude", targets.claude),
      cursor: paths("cursor", targets.cursor),
      vscode: paths("vscode", targets.vscode),
    },
    serverDefinition: {
      transport: "stdio",
      command: PRIVATE_COMMAND,
      args: ["gateway-entry.mjs", PRIVATE_ARG],
      cwd: join(root, "private-cwd"),
      env: { UNIFIED_AI_PRIVATE_VALUE: PRIVATE_ENV },
    },
  };
}

function fixture(containerKey: "mcpServers" | "servers", theme: string): string {
  return `${JSON.stringify({
    unrelated: { theme, nested: { keep: true } },
    [containerKey]: {
      existing: { command: "existing-command" },
    },
  }, null, 2)}\n`;
}

function assertRedacted(value: unknown, ...paths: string[]): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    ...paths,
    PRIVATE_COMMAND,
    PRIVATE_ARG,
    PRIVATE_ENV,
    "gateway-entry.mjs",
    "private-cwd",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
  for (const forbiddenKey of ["\"command\"", "\"args\"", "\"cwd\"", "\"env\""]) {
    expect(serialized).not.toContain(forbiddenKey);
  }
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
