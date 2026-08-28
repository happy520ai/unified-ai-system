import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveLocalClientOnboardingConfiguration } from "./localClientOnboardingConfig.ts";
import { createLocalClientGovernedOnboardingRuntime } from "./localClientGovernedOnboardingRuntime.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function enabledConfiguration() {
  const root = await mkdtemp(resolve(tmpdir(), "local-client-onboarding-runtime-"));
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
  return Object.freeze({
    ...configuration,
    registryOptions: Object.freeze({
      ...configuration.registryOptions,
      backupEncryptionKey: Buffer.alloc(32, 0x4a),
      committedRetentionMs: 30 * 24 * 60 * 60_000,
    }),
  });
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
