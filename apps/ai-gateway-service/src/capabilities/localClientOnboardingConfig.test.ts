import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LocalClientOnboardingConfigurationError,
  resolveLocalClientOnboardingConfiguration,
} from "./localClientOnboardingConfig.ts";

function configuredEnv() {
  const root = resolve(".tmp", "local-client-onboarding-config");
  const profile = (name: string) => ({
    targetPath: resolve(root, name, "client.json"),
    allowedRoot: resolve(root, name),
    backupDir: resolve(root, name, "backup"),
    journalPath: resolve(root, name, "journal.json"),
  });
  return {
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "true",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify({
      version: 1,
      ownerTenantId: "tenant-a",
      profiles: {
        claudeCompatible: profile("claude"),
        cursor: profile("cursor"),
        vscode: profile("vscode"),
      },
      serverDefinition: {
        transport: "stdio",
        command: resolve(root, "bin", "node"),
        args: [resolve(root, "mcp-server.mjs"), "--stdio"],
        cwd: root,
      },
    }),
  };
}

describe("resolveLocalClientOnboardingConfiguration", () => {
  it("is disabled by default and never infers activation from a JSON payload", () => {
    const disabled = resolveLocalClientOnboardingConfiguration({});
    expect(disabled).toEqual(expect.objectContaining({
      enabled: false,
      registryOptions: null,
      status: expect.objectContaining({
        configuredProfileCount: 0,
        automaticDiscoveryOrMutation: false,
        sensitiveConfigurationRedacted: true,
      tenantOwned: true,
      backupProtection: "aes-256-gcm",
      }),
    }));

    const configuredButDisabled = resolveLocalClientOnboardingConfiguration({
      ...configuredEnv(),
      AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "false",
    });
    expect(configuredButDisabled.enabled).toBe(false);
  });

  it("parses the exact versioned three-client configuration without exposing it in status", () => {
    const result = resolveLocalClientOnboardingConfiguration(configuredEnv());
    expect(result.enabled).toBe(true);
    if (!result.enabled) throw new Error("expected enabled configuration");
    expect(result.registryOptions.profiles.cursor.targetPath).toContain("cursor");
    expect(result.registryOptions.serverDefinition.transport).toBe("stdio");
    expect(result.status).toEqual(expect.objectContaining({
      enabled: true,
      configuredProfileCount: 3,
      clients: ["claude-compatible", "cursor", "vscode"],
      certificationStatus: "fixture-tested-not-real-client-certified",
      requiresExplicitApproval: true,
      requiresDurableIdempotency: true,
      requiresDurableExternalEffectFence: true,
      requiresDurableReceiptAuthority: true,
      automaticDiscoveryOrMutation: false,
      sensitiveConfigurationRedacted: true,
    }));
    expect(JSON.stringify(result.status)).not.toContain("client.json");
    expect(JSON.stringify(result.status)).not.toContain("mcp-server.mjs");
    expect(JSON.stringify(result.status)).not.toContain("tenant-a");
  });

  it.each([
    "yes",
    "enabled",
    "TRUE ",
  ])("rejects ambiguous enablement %s", (value) => {
    expect(() => resolveLocalClientOnboardingConfiguration({
      AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: value,
    })).toThrowError(LocalClientOnboardingConfigurationError);
  });

  it("requires configuration only after explicit activation", () => {
    expect(() => resolveLocalClientOnboardingConfiguration({
      AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "true",
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_REQUIRED" }));
  });

  it.each([
    { mutate: (value: any) => { value.version = 2; } },
    { mutate: (value: any) => { delete value.ownerTenantId; } },
    { mutate: (value: any) => { value.ownerTenantId = "tenant with spaces"; } },
    { mutate: (value: any) => { value.extra = true; } },
    { mutate: (value: any) => { delete value.profiles.vscode; } },
    { mutate: (value: any) => { value.profiles.cursor.targetPath = "relative.json"; } },
    { mutate: (value: any) => { value.profiles.cursor.targetPath = "\\\\server\\share\\config.json"; } },
    { mutate: (value: any) => { value.serverDefinition.transport = "http"; } },
    { mutate: (value: any) => { value.serverDefinition.command = "node"; } },
    { mutate: (value: any) => { value.serverDefinition.env = { TOKEN: "forbidden" }; } },
    { mutate: (value: any) => { value.serverDefinition.args = new Array(129).fill("x"); } },
    { mutate: (value: any) => { value.serverDefinition.args = ["--api-key=must-not-enter-config"]; } },
    { mutate: (value: any) => { value.serverDefinition.args = ["Authorization: Bearer must-not-enter-config"]; } },
    { mutate: (value: any) => { value.profiles.cursor.maxTransactions = 0; } },
  ])("rejects malformed, expansive, remote, or secret-bearing configuration", ({ mutate }) => {
    const env = configuredEnv();
    const value = JSON.parse(env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON);
    mutate(value);
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON = JSON.stringify(value);
    expect(() => resolveLocalClientOnboardingConfiguration(env)).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID" }),
    );
  });

  it("rejects prototype-pollution keys instead of widening the schema", () => {
    const env = configuredEnv();
    const value = JSON.parse(env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON);
    const raw = JSON.stringify(value).replace(
      '"version":1',
      '"version":1,"__proto__":{"polluted":true}',
    );
    expect(() => resolveLocalClientOnboardingConfiguration({
      ...env,
      AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: raw,
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID" }));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
