import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGatewayApplication } from "./createGatewayApplication.js";

describe("Agent Governance application configuration", () => {
  it("keeps governance default-off so legacy execution route contracts remain compatible", () => {
    expect(createGatewayApplication({}).agentGovernance).toBeNull();
  });

  it("refuses explicit governance enablement with multi-instance mode", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_MULTI_INSTANCE: "true",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_MULTI_INSTANCE_UNSUPPORTED" }));
  });

  it("keeps governance explicitly disabled as a rollback boundary", () => {
    expect(createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false",
    }).agentGovernance).toBeNull();
  });

  it("rejects an in-repository custom state directory outside protected .data", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-config-governance-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: "state/agent-governance",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_DATA_DIR_UNSAFE" }));
  });

  it("admits only the exact reviewed Git high-risk allowlist and enables its durable effect gate", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-high-risk-config-"));
    try {
      const application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-high-risk-governance-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
        AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS: "git_push,git_create_pr,git_push",
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "application-high-risk-external-effect-key-0123456789",
      });
      expect(application.agentGovernance?.highRiskTools).toEqual(["git_push", "git_create_pr"]);
      expect(application.externalEffectGate.status).toMatchObject({ enabled: true, durable: true, mode: "sqlite" });
      await application.externalEffectGate.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unknown high-risk tools and high-risk configuration with governance disabled", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS: "shell_exec",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_HIGH_RISK_TOOL_UNSUPPORTED" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS: "git_push",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_HIGH_RISK_REQUIRES_GOVERNANCE" }));
  });

  it("keeps model proposal explicit and bound to a server-owned provider", async () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "sometimes",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_CONFIGURATION_INVALID" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "true",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_MODEL_PROPOSER_REQUIRES_GOVERNANCE" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "true",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_REQUIRED" }));

    const root = await mkdtemp(join(tmpdir(), "agent-governance-model-config-"));
    try {
      const application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-model-governance-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
        AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_ID: "local-fake-provider",
      });
      expect(application.agentGovernance).not.toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts only a trusted existing directory for Agent execution", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: "package.json",
    })).toThrow(expect.objectContaining({ code: "AGENT_EXEC_WORKING_DIRECTORY_INVALID" }));
  });

  it("keeps signed JSON as the sole promoted runtime Registry authority", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-json-authority-"));
    try {
      const application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-json-authority-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "json",
      });
      expect(application.agentGovernance?.registryStore).toBeNull();
      expect(application.agentGovernance?.registry).toMatchObject({
        storageMode: "single-process-json",
        durable: true,
        transactional: false,
        distributed: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed before reading SQLite/PostgreSQL runtime configuration", () => {
    for (const mode of ["sqlite", "postgres"]) {
      expect(() => createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-unpromoted-registry-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: mode,
      })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_REGISTRY_BACKEND_UNPROMOTED" }));
    }
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-unpromoted-url-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "json",
      AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL_FILE: "/run/secrets/never-read",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_REGISTRY_BACKEND_UNPROMOTED" }));
  });
});
