import { mkdtemp, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveLocalClientOnboardingConfiguration } from "./localClientOnboardingConfig.ts";
import { createLocalClientGovernedOnboardingRuntime } from "./localClientGovernedOnboardingRuntime.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map(async (path) => {
    expect(await realpath(path)).toBe(path);
    expect(dirname(path)).toBe(await realpath(tmpdir()));
    await rm(path, { recursive: true, force: true });
  }));
});

async function enabledConfiguration() {
  const root = await mkdtemp(resolve(await realpath(tmpdir()), "local-client-onboarding-runtime-"));
  temporaryRoots.push(root);
  const profile = async (name: string) => {
    const directory = resolve(root, name);
    await mkdir(directory, { recursive: true });
    const targetPath = resolve(directory, "client.json");
    await writeFile(targetPath, "{}\n", "utf8");
    return {
      targetPath,
      allowedRoot: directory,
      backupDir: resolve(directory, "backup"),
      journalPath: resolve(directory, "journal.json"),
    };
  };
  const configuration = resolveLocalClientOnboardingConfiguration({
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "true",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify({
      version: 1,
      ownerTenantId: "tenant-a",
      profiles: {
        claudeCompatible: await profile("claude"),
        cursor: await profile("cursor"),
        vscode: await profile("vscode"),
      },
      serverDefinition: {
        transport: "stdio",
        command: process.execPath,
        args: [resolve(root, "server.mjs")],
      },
    }),
  });
  if (!configuration.enabled) throw new Error("expected enabled configuration");
  if (configuration.registryOptions.version === 2) throw new Error("expected legacy registry options");
  return Object.freeze({
    ...configuration,
    registryOptions: Object.freeze({
      ...configuration.registryOptions,
      backupEncryptionKey: Buffer.alloc(32, 0x4a),
      committedRetentionMs: 30 * 24 * 60 * 60_000,
    }),
  });
}

async function selectedConfiguration(format: "jsonc" | "toml" = "jsonc") {
  const profileId = format === "toml" ? "codex-mcp-toml-v1" : "vscode-mcp-jsonc-v1";
  const root = await mkdtemp(resolve(await realpath(tmpdir()), "local-client-onboarding-runtime-v2-"));
  temporaryRoots.push(root);
  const targetPath = resolve(root, "mcp.json");
  const original = format === "toml" ? '# selected profile only\r\nmodel = "retained"\r\n' : '{\r\n  // selected profile only\r\n  "servers": {},\r\n  "unmanaged": true,\r\n}\r\n';
  await writeFile(targetPath, original, "utf8");
  const configuration = resolveLocalClientOnboardingConfiguration({
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "true",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify({ version: 2, ownerTenantId: "tenant-a",
      profiles: [{ profileId, paths: { targetPath, allowedRoot: root,
        backupDir: resolve(root, "backup"), journalPath: resolve(root, "journal.json") } }],
      serverDefinition: { transport: "stdio", command: process.execPath, args: [resolve(root, "server.mjs")] },
    }),
  });
  if (!configuration.enabled || configuration.registryOptions.version !== 2) throw new Error("expected v2 registry options");
  return { root, targetPath, original, configuration: Object.freeze({ ...configuration,
    registryOptions: Object.freeze({ ...configuration.registryOptions, backupEncryptionKey: Buffer.alloc(32, 0x4a),
      committedRetentionMs: 30 * 24 * 60 * 60_000 }) }) };
}

function dependencies() {
  return {
    approvalGate: {
      approve: vi.fn(),
      consume: vi.fn(),
    },
    idempotencyCoordinator: {
      execute: vi.fn(),
      getStats: vi.fn(() => ({ storeMode: "sqlite", available: true })),
      checkHealth: vi.fn(async () => ({ storeMode: "sqlite", available: true })),
    } as any,
    externalEffectGate: {
      status: { mode: "sqlite", enabled: true, durable: true, distributed: false },
      reserve: vi.fn(),
    },
    receiptAuthorityStore: {
      status: {
        mode: "sqlite-onboarding-receipt-authority",
        available: true,
        durable: true,
        distributed: false,
        oneTimeRollbackAuthorization: true,
      },
      recordApplied: vi.fn(),
      authorizeRollback: vi.fn(),
      markRolledBack: vi.fn(),
      releaseRollbackClaim: vi.fn(),
    },
  };
}

describe("createLocalClientGovernedOnboardingRuntime", () => {
  it.each(["jsonc", "toml"] as const)("initializes only selected v2 %s profiles and preserves actual redacted status", async (format) => {
    const profileId = format === "toml" ? "codex-mcp-toml-v1" : "vscode-mcp-jsonc-v1";
    const client = format === "toml" ? "codex" : "vscode";
    const fixture = await selectedConfiguration(format);
    const dependencySet = dependencies();
    const runtime = createLocalClientGovernedOnboardingRuntime({ configuration: fixture.configuration, ...dependencySet });
    try {
      expect(runtime.getStatus()).toMatchObject({ initializationState: "not-started", configurationVersion: 2,
        configuredProfileCount: 1, clients: [client], formats: [format] });
      expect(runtime.getStatus()).not.toHaveProperty("format");
      const profiles = await runtime.api.list({ tenantId: "tenant-a", subjectId: "operator-a" });
      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toMatchObject({ profileId, client, format });
      await expect(runtime.api.inspect({ tenantId: "tenant-a", subjectId: "operator-a", profileId }))
        .resolves.toMatchObject({ installation: { installed: false, format }, journalCorrupt: false });
      expect(runtime.getStatus().initializationState).toBe("ready");
      expect(await readFile(fixture.targetPath, "utf8")).toBe(fixture.original);
      const createdNames = await readdir(fixture.root);
      for (const unselectedName of ["claude", "cursor", "vscode"]) expect(createdNames).not.toContain(unselectedName);
      expect(JSON.stringify(runtime.getStatus())).not.toContain(fixture.root);
      expect(dependencySet.approvalGate.consume).not.toHaveBeenCalled();
      expect(dependencySet.externalEffectGate.reserve).not.toHaveBeenCalled();
    } finally { await runtime.close(); }
  });

  it("enforces v2 tenant ownership before lazy profile I/O and zeroizes the selected source key on close", async () => {
    const fixture = await selectedConfiguration();
    const key = fixture.configuration.registryOptions.backupEncryptionKey;
    const before = await readdir(fixture.root);
    const runtime = createLocalClientGovernedOnboardingRuntime({ configuration: fixture.configuration, ...dependencies() });
    await expect(runtime.api.list({ tenantId: "tenant-b", subjectId: "operator-b" })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_TENANT_FORBIDDEN" });
    expect(runtime.getStatus().initializationState).toBe("not-started");
    expect(await readdir(fixture.root)).toEqual(before);
    await runtime.close();
    expect([...key]).toEqual(new Array(32).fill(0));
    expect(runtime.getStatus()).toMatchObject({ configurationVersion: 2, configuredProfileCount: 1,
      clients: ["vscode"], formats: ["jsonc"], initializationState: "closed" });
  });

  it("keeps disabled onboarding inert and redacted", async () => {
    const runtime = createLocalClientGovernedOnboardingRuntime({
      configuration: resolveLocalClientOnboardingConfiguration({}),
      ...dependencies(),
    });
    expect(runtime.getStatus()).toEqual(expect.objectContaining({
      enabled: false,
      initializationState: "disabled",
      automaticDiscoveryOrMutation: false,
    }));
    await expect(runtime.api.list({ tenantId: "tenant-a", subjectId: "operator-a" }))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_DISABLED" });
    expect(runtime.getStatus().initializationState).toBe("disabled");
  });

  it("lazily preflights exact code-bound files and exposes only public profiles", async () => {
    const runtime = createLocalClientGovernedOnboardingRuntime({
      configuration: await enabledConfiguration(),
      ...dependencies(),
    });
    expect(runtime.getStatus().initializationState).toBe("not-started");
    const profiles = await runtime.api.list({ tenantId: "tenant-a", subjectId: "operator-a" });
    expect(profiles).toHaveLength(3);
    expect(profiles.map((profile) => profile.profileId)).toEqual([
      "claude-compatible-mcp-json",
      "cursor-mcp-json",
      "vscode-mcp-json",
    ]);
    expect(runtime.getStatus().initializationState).toBe("ready");
    const serialized = JSON.stringify({ profiles, status: runtime.getStatus() });
    expect(serialized).not.toContain("client.json");
    expect(serialized).not.toContain("server.mjs");
    expect(serialized).not.toContain(process.execPath);
    expect(serialized).not.toContain("tenant-a");
  });

  it("rejects a non-owner tenant before opening or inspecting any configured file", async () => {
    const runtime = createLocalClientGovernedOnboardingRuntime({
      configuration: await enabledConfiguration(),
      ...dependencies(),
    });
    await expect(runtime.api.list({ tenantId: "tenant-b", subjectId: "operator-b" }))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_ONBOARDING_TENANT_FORBIDDEN",
        statusCode: 403,
      });
    expect(runtime.getStatus()).toMatchObject({
      initializationState: "not-started",
      tenantOwned: true,
      sensitiveConfigurationRedacted: true,
    });
  });

  it("never reports ready when a configured transaction journal is corrupt", async () => {
    const configuration = await enabledConfiguration();
    if (!configuration.enabled) throw new Error("expected enabled configuration");
    const journalPath = configuration.registryOptions.profiles.cursor.journalPath;
    await mkdir(resolve(journalPath, ".."), { recursive: true });
    await writeFile(journalPath, "{not-json", "utf8");
    const runtime = createLocalClientGovernedOnboardingRuntime({
      configuration,
      ...dependencies(),
    });

    await expect(runtime.api.list({ tenantId: "tenant-a", subjectId: "operator-a" }))
      .resolves.toHaveLength(3);
    expect(runtime.getStatus()).toMatchObject({
      enabled: true,
      initializationState: "failed",
    });
    await expect(runtime.api.inspect({
      tenantId: "tenant-a",
      subjectId: "operator-a",
      profileId: "cursor-mcp-json",
    })).resolves.toMatchObject({
      journalCorrupt: true,
      recoveryRequired: true,
    });
  });

  it("latches failed initialization without repeatedly touching a missing target", async () => {
    const configuration = await enabledConfiguration();
    if (!configuration.enabled) throw new Error("expected enabled configuration");
    const broken = {
      ...configuration,
      registryOptions: {
        ...configuration.registryOptions,
        profiles: {
          ...configuration.registryOptions.profiles,
          cursor: {
            ...configuration.registryOptions.profiles.cursor,
            targetPath: resolve(configuration.registryOptions.profiles.cursor.allowedRoot, "missing.json"),
          },
        },
      },
    } as typeof configuration;
    const runtime = createLocalClientGovernedOnboardingRuntime({
      configuration: broken,
      ...dependencies(),
    });
    await expect(runtime.initialize()).rejects.toBeTruthy();
    expect(runtime.getStatus().initializationState).toBe("failed");
    await expect(runtime.initialize()).rejects.toBeTruthy();
    expect(runtime.getStatus().initializationState).toBe("failed");
  });

  it("requires all durable governance dependencies only when enabled", async () => {
    const configuration = await enabledConfiguration();
    expect(() => createLocalClientGovernedOnboardingRuntime({
      configuration,
      approvalGate: {} as any,
      idempotencyCoordinator: null,
      externalEffectGate: {} as any,
      receiptAuthorityStore: null,
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ONBOARDING_RUNTIME_CONFIGURATION_INVALID",
    }));
  });

  it("closes before lazy initialization, zeroizes the source key, and rejects later calls", async () => {
    const configuration = await enabledConfiguration();
    if (!configuration.enabled) throw new Error("expected enabled configuration");
    const key = configuration.registryOptions.backupEncryptionKey as Uint8Array;
    const runtime = createLocalClientGovernedOnboardingRuntime({
      configuration,
      ...dependencies(),
    });

    await runtime.close();
    expect([...key]).toEqual(new Array(32).fill(0));
    expect(runtime.getStatus().initializationState).toBe("closed");
    await expect(runtime.api.list({ tenantId: "tenant-a", subjectId: "operator-a" }))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_RUNTIME_CLOSED" });
  });

  it("waits for concurrent lazy initialization and leaves no usable runtime after close", async () => {
    const configuration = await enabledConfiguration();
    if (!configuration.enabled) throw new Error("expected enabled configuration");
    const key = configuration.registryOptions.backupEncryptionKey as Uint8Array;
    const runtime = createLocalClientGovernedOnboardingRuntime({
      configuration,
      ...dependencies(),
    });

    const initializing = runtime.initialize();
    const closing = runtime.close();
    await Promise.allSettled([initializing, closing]);
    expect([...key]).toEqual(new Array(32).fill(0));
    expect(runtime.getStatus().initializationState).toBe("closed");
    await expect(runtime.api.inspect({
      tenantId: "tenant-a",
      subjectId: "operator-a",
      profileId: "cursor-mcp-json",
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_RUNTIME_CLOSED" });
  });
});
