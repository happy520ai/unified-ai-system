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

function selectedEnv(profileIds = ["vscode-mcp-jsonc-v1"]) {
  const env = configuredEnv();
  const value = JSON.parse(env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON);
  value.version = 2;
  value.profiles = profileIds.map((profileId, index) => {
    const root = resolve(".tmp", "local-client-onboarding-config-v2", String(index));
    return { profileId, paths: { targetPath: resolve(root, "client.jsonc"), allowedRoot: root,
      backupDir: resolve(root, "backup"), journalPath: resolve(root, "journal.json") } };
  });
  return { ...env, AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify(value) };
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
    if (result.registryOptions.version === 2) throw new Error("expected legacy registry options");
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
    expect(result.registryOptions).not.toHaveProperty("version");
    expect(result.status).not.toHaveProperty("formats");
  });

  it.each([
    ["vscode-mcp-jsonc-v1", "vscode", "jsonc"], ["codex-mcp-toml-v1", "codex", "toml"], ["continue-mcp-yaml-v1", "continue", "yaml"],
  ])("accepts one explicit %s profile and exposes only actual clients/formats", (profileId, client, format) => {
    const result = resolveLocalClientOnboardingConfiguration(selectedEnv([profileId]));
    if (!result.enabled || result.registryOptions.version !== 2) throw new Error("expected v2 configuration");
    expect(result.registryOptions.profiles).toHaveLength(1);
    expect(result.registryOptions.profiles[0]?.profileId).toBe(profileId);
    expect(result.status).toMatchObject({ enabled: true, configurationVersion: 2, configuredProfileCount: 1,
      clients: [client], formats: [format], tenantOwned: true, backupProtection: "aes-256-gcm" });
    expect(result.status).not.toHaveProperty("format");
    expect(JSON.stringify(result.status)).not.toContain("client.jsonc");
    expect(JSON.stringify(result.status)).not.toContain("tenant-a");
    expect(Object.isFrozen(result.registryOptions.profiles)).toBe(true);
    expect(Object.isFrozen(result.registryOptions.profiles[0]?.paths)).toBe(true);
  });

  it("reports six profiles with unique actual clients and formats in selected order", () => {
    const result = resolveLocalClientOnboardingConfiguration(selectedEnv([
      "vscode-mcp-jsonc-v1", "cursor-mcp-json", "claude-compatible-mcp-json", "vscode-mcp-json", "codex-mcp-toml-v1", "continue-mcp-yaml-v1",
    ]));
    expect(result.status).toMatchObject({ configurationVersion: 2, configuredProfileCount: 6,
      clients: ["vscode", "cursor", "claude-compatible", "codex", "continue"], formats: ["jsonc", "json-only", "toml", "yaml"] });
  });

  it.each(["codex-mcp-toml-v1", "continue-mcp-yaml-v1"])("rejects %s budgets above the codec limit in startup configuration", profileId => {
    const env = selectedEnv([profileId]);
    const value = JSON.parse(env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON);
    value.profiles[0].paths.maxBytes = 65_537;
    expect(() => resolveLocalClientOnboardingConfiguration({ ...env, AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify(value) }))
      .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID" }));
  });

  it("retains the exact disabled v1 status even when an unactivated v2 payload is present", () => {
    const result = resolveLocalClientOnboardingConfiguration({ ...selectedEnv(), AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "false" });
    expect(result.status).toMatchObject({ configurationVersion: 1, configuredProfileCount: 0,
      clients: ["claude-compatible", "cursor", "vscode"], format: "json-only" });
    expect(result.status).not.toHaveProperty("formats");
    expect(result.registryOptions).toBeNull();
  });

  it.each([
    { mutate: (value: any) => { value.profiles = []; } },
    { mutate: (value: any) => { value.profiles = new Array(5).fill(value.profiles[0]); } },
    { mutate: (value: any) => { value.profiles.push(value.profiles[0]); } },
    { mutate: (value: any) => { value.profiles[0].profileId = "vscode-mcp-jsonc-v2"; } },
    { mutate: (value: any) => { delete value.profiles[0].paths; } },
    { mutate: (value: any) => { delete value.profiles[0].profileId; } },
    { mutate: (value: any) => { value.profiles[0].format = "jsonc"; } },
    { mutate: (value: any) => { value.profiles[0].paths.targetPath = "relative.jsonc"; } },
    { mutate: (value: any) => { value.profiles = { vscode: value.profiles[0].paths }; } },
    { mutate: (value: any) => { value.version = 3; } },
  ])("rejects malformed or implicit v2 selections before initialization", ({ mutate }) => {
    const env = selectedEnv(); const value = JSON.parse(env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON); mutate(value);
    expect(() => resolveLocalClientOnboardingConfiguration({ ...env, AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify(value) }))
      .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID" }));
  });

  it("rejects duplicate decoded JSON keys at root, profile and nested path levels in v2", () => {
    const env = selectedEnv(); const raw = env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON;
    const profileId = '"profileId":"vscode-mcp-jsonc-v1"';
    const value = JSON.parse(raw); const target = `"targetPath":${JSON.stringify(value.profiles[0].paths.targetPath)}`;
    for (const duplicated of [
      raw.replace('"version":2', '"version":2,"\\u0076ersion":2'),
      raw.replace(profileId, `${profileId},"\\u0070rofileId":"vscode-mcp-jsonc-v1"`),
      raw.replace(target, `${target},${target}`),
    ]) {
      expect(() => JSON.parse(duplicated)).not.toThrow();
      expect(() => resolveLocalClientOnboardingConfiguration({ ...env, AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: duplicated }))
        .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID" }));
    }
  });

  it("accepts JSONC only in selected target files, never in the v2 startup configuration", () => {
    const env = selectedEnv(); const raw = env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON;
    for (const invalidRaw of [raw.replace("{", "{/* comment */"), `${raw.slice(0, -1)},}`]) {
      expect(() => resolveLocalClientOnboardingConfiguration({ ...env, AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: invalidRaw }))
        .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID" }));
    }
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
