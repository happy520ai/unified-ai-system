import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGatewayApplication } from "./createGatewayApplication.js";

describe("Agent Governance application configuration", () => {
  it("keeps governance default-off so legacy execution route contracts remain compatible", () => {
    const application = createGatewayApplication({});
    expect(application.agentGovernance).toBeNull();
  });

  it("refuses explicit governance enablement with a non-transactional multi-instance backend", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_MULTI_INSTANCE: "true",
    })).toThrow(expect.objectContaining({
      code: "AGENT_GOVERNANCE_MULTI_INSTANCE_UNSUPPORTED",
    }));
  });

  it("keeps governance explicitly disabled as a rollback boundary", () => {
    const application = createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false",
    });
    expect(application.agentGovernance).toBeNull();
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

  it("accepts only a trusted existing directory for Agent execution", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: "package.json",
    })).toThrow(expect.objectContaining({ code: "AGENT_EXEC_WORKING_DIRECTORY_INVALID" }));
  });
});
