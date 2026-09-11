import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { GatewayService } from "../core/gatewayService.ts";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createGatewayModelProposer, createMockModelProposer } from "./gatewayModelProposer.ts";

const VALID_PROPOSAL = {
  classification: { family: "monitoring" as const, domain: "operations", subclass: "watcher" },
  proposedTraits: ["read_only"],
  proposedRiskLevel: "low" as const,
};

const VALID_PROPOSAL_WITH_POLICY = {
  ...VALID_PROPOSAL,
  policyDraft: {
    limits: { maxSteps: 4, maxToolCalls: 6 },
    toolRules: { file_read: "deny" as const },
    dataRules: { deniedOutputFields: ["private_note"] },
  },
};

function gatewayResult(outputText: string) {
  return {
    success: true,
    code: "ok",
    message: "ok",
    data: {
      id: "response_1",
      selectedProvider: "configured-provider",
      selectedModel: "configured-model",
      executionMode: "fake" as const,
      executionStatus: "success" as const,
      outputText,
      warnings: [],
    },
    error: null,
    meta: { requestId: "gateway_request_1", timestamp: "2026-08-30T10:00:00.000Z", durationMs: 1 },
  };
}

describe("Gateway-backed Agent model proposer", () => {
  it("uses the existing GatewayService with server-owned provider routing and identity", async () => {
    const execute = vi.fn().mockResolvedValue(gatewayResult(JSON.stringify(VALID_PROPOSAL)));
    const proposer = createGatewayModelProposer({
      gatewayService: { execute } as unknown as GatewayService,
      providerId: "configured-provider",
      modelId: "configured-model",
    });

    await expect(proposer.proposeClassification("observe deployment", {
      name: "observer",
      requestedTools: ["file_read"],
      tenantId: "tenant_a",
      userId: "operator_a",
      requestId: "request_a",
    })).resolves.toEqual(VALID_PROPOSAL);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0]).toMatchObject({
      taskType: "chat",
      providerId: "configured-provider",
      model: "configured-model",
      enterpriseIdentity: { tenantId: "tenant_a", userId: "operator_a" },
      metadata: {
        source: "agent-governance-classifier",
        internalProviderExecution: { governedByGateway: true, directAdapterCall: false },
      },
    });
    expect(execute.mock.calls[0][1]).toMatchObject({
      providerDispatchRoute: "/__agent-governance/classify",
      providerDispatchInvocation: 1,
    });
  });

  it("rejects prose, unknown keys and missing authenticated identity", async () => {
    for (const output of [
      `Here is the JSON: ${JSON.stringify(VALID_PROPOSAL)}`,
      JSON.stringify({ ...VALID_PROPOSAL, grantedTools: ["shell_exec"] }),
    ]) {
      const proposer = createGatewayModelProposer({
        gatewayService: {
          execute: vi.fn().mockResolvedValue(gatewayResult(output)),
        } as unknown as GatewayService,
        providerId: "configured-provider",
      });
      await expect(proposer.proposeClassification("task", {
        name: "agent",
        requestedTools: [],
        tenantId: "tenant_a",
        userId: "operator_a",
      })).rejects.toMatchObject({ code: "AGENT_MODEL_PROPOSAL_INVALID" });
    }

    const proposer = createGatewayModelProposer({
      gatewayService: { execute: vi.fn() } as unknown as GatewayService,
      providerId: "configured-provider",
    });
    await expect(proposer.proposeClassification("task")).rejects.toMatchObject({
      code: "AGENT_MODEL_PROPOSER_IDENTITY_REQUIRED",
    });
  });

  it("accepts a strict optional PolicyDraft and rejects unknown or over-limit draft content", async () => {
    const proposer = createGatewayModelProposer({
      gatewayService: {
        execute: vi.fn().mockResolvedValue(gatewayResult(JSON.stringify(VALID_PROPOSAL_WITH_POLICY))),
      } as unknown as GatewayService,
      providerId: "configured-provider",
    });
    await expect(proposer.proposeClassification("restricted read", {
      name: "reader",
      requestedTools: ["file_read"],
      tenantId: "tenant_a",
      userId: "operator_a",
    })).resolves.toEqual(VALID_PROPOSAL_WITH_POLICY);

    for (const policyDraft of [
      { limits: { maxSteps: 2, unknownLimit: 1 } },
      { requestedTools: ["shell_exec"] },
      { requirements: { sandboxRequired: true } },
      { dataRules: { deniedResources: Array.from({ length: 129 }, (_, index) => `r${index}`) } },
    ]) {
      const invalid = createGatewayModelProposer({
        gatewayService: {
          execute: vi.fn().mockResolvedValue(gatewayResult(JSON.stringify({ ...VALID_PROPOSAL, policyDraft }))),
        } as unknown as GatewayService,
        providerId: "configured-provider",
      });
      await expect(invalid.proposeClassification("task", {
        name: "agent",
        requestedTools: ["file_read"],
        tenantId: "tenant_a",
        userId: "operator_a",
      })).rejects.toMatchObject({
        code: expect.stringMatching(/^AGENT_MODEL_POLICY_DRAFT_/u),
      });
    }
  });

  it("provides a deterministic mock seam and never lets model risk lower tool risk", async () => {
    const proposer = createMockModelProposer(VALID_PROPOSAL);
    await expect(proposer.proposeClassification("same task")).resolves.toEqual(VALID_PROPOSAL);

    const dataDir = await mkdtemp(join(tmpdir(), "agent-model-proposer-risk-"));
    try {
      const service = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "model-proposer-test-key-0123456789abcdef",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
        },
        dataDir,
        now: () => "2026-08-30T10:00:00.000Z",
        modelProposer: proposer,
      });
      const generated = await service.generateAgent({
        name: "model-proposed-agent",
        task: "push a reviewed change",
        requestedTools: ["git_push"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, {
        tenantId: "tenant_a",
        userId: "operator_a",
        role: "admin",
        permissions: ["*"],
      });
      expect(generated.riskLevel).toBe("high");
      expect(generated.traits).toEqual(expect.arrayContaining(["external_communication", "write_capable"]));
      const audit = await service.readAudit(generated.agentId, "tenant_a", 20);
      expect(audit.find((event) => event.eventType === "AGENT_CLASSIFIED")?.metadata).toMatchObject({
        proposalSource: "gateway_model",
        modelProposalFailed: false,
      });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("adopts a model PolicyDraft only as a deterministic instance restriction", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "agent-model-policy-draft-"));
    try {
      const proposer = createMockModelProposer({
        classification: { family: "execution", domain: "development", subclass: "publisher" },
        proposedTraits: ["write_capable"],
        proposedRiskLevel: "low",
        policyDraft: {
          toolRules: { git_push: "allow" },
          permissions: { canWrite: true },
          limits: { maxSteps: 3 },
        },
      });
      const service = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "model-policy-draft-key-0123456789abcdef",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
        },
        dataDir,
        now: () => "2026-08-30T10:00:00.000Z",
        modelProposer: proposer,
      });
      const generated = await service.generateAgent({
        name: "model-policy-agent",
        task: "publish a reviewed branch",
        requestedTools: ["git_push"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, {
        tenantId: "tenant_a",
        userId: "operator_a",
        permissions: ["*"],
      });
      const policy = await service.getEffectivePolicy(generated.agentId, "tenant_a");
      expect(policy?.toolDecisions.git_push).toBe("require_approval");
      expect(policy?.limits.maxSteps).toBe(3);
      const audit = await service.readAudit(generated.agentId, "tenant_a", 50);
      expect(audit.find((event) => event.eventType === "AGENT_CLASSIFIED")?.metadata).toMatchObject({
        proposalSource: "gateway_model",
        modelPolicyDraftProposed: true,
        modelPolicyDraftAdopted: true,
      });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("keeps explicit instanceRules authoritative and falls back on malformed custom drafts", async () => {
    const explicitDir = await mkdtemp(join(tmpdir(), "agent-model-explicit-rules-"));
    const fallbackDir = await mkdtemp(join(tmpdir(), "agent-model-invalid-draft-"));
    try {
      const modelWithDeny = createMockModelProposer({
        ...VALID_PROPOSAL,
        policyDraft: { toolRules: { file_read: "deny" } },
      });
      const explicitService = createAgentGovernanceService({
        env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "explicit-rules-key-0123456789abcdef" },
        dataDir: explicitDir,
        now: () => "2026-08-30T10:00:00.000Z",
        modelProposer: modelWithDeny,
      });
      const explicit = await explicitService.generateAgent({
        name: "explicit-rules-agent",
        task: "read",
        requestedTools: ["file_read"],
        ttlSeconds: 3_600,
        parentAgentId: null,
        instanceRules: { toolRules: { file_read: "allow" } },
      }, { tenantId: "tenant_a", userId: "operator_a", permissions: ["*"] });
      expect((await explicitService.getEffectivePolicy(explicit.agentId, "tenant_a"))?.toolDecisions.file_read)
        .toBe("allow");
      expect((await explicitService.readAudit(explicit.agentId, "tenant_a", 50))
        .find((event) => event.eventType === "AGENT_CLASSIFIED")?.metadata).toMatchObject({
          modelPolicyDraftProposed: true,
          modelPolicyDraftAdopted: false,
        });

      const malformedProposer: any = {
        async proposeClassification() {
          return { ...VALID_PROPOSAL, policyDraft: { limits: { unknownLimit: 1 } } };
        },
      };
      const fallbackService = createAgentGovernanceService({
        env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "fallback-rules-key-0123456789abcdef" },
        dataDir: fallbackDir,
        now: () => "2026-08-30T10:00:00.000Z",
        modelProposer: malformedProposer,
      });
      const fallback = await fallbackService.generateAgent({
        name: "fallback-agent",
        task: "read",
        requestedTools: ["file_read"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, { tenantId: "tenant_a", userId: "operator_a", permissions: ["*"] });
      expect((await fallbackService.getEffectivePolicy(fallback.agentId, "tenant_a"))?.toolDecisions.file_read)
        .toBe("allow");
      expect((await fallbackService.readAudit(fallback.agentId, "tenant_a", 50))
        .find((event) => event.eventType === "AGENT_CLASSIFIED")?.metadata).toMatchObject({
          proposalSource: "deterministic",
          modelProposalFailed: true,
          modelPolicyDraftProposed: true,
          modelPolicyDraftAdopted: false,
        });
    } finally {
      await Promise.all([
        rm(explicitDir, { recursive: true, force: true }),
        rm(fallbackDir, { recursive: true, force: true }),
      ]);
    }
  });

  it("cannot use a child PolicyDraft to exceed the parent tool ceiling", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "agent-model-parent-ceiling-"));
    try {
      const proposer: any = {
        async proposeClassification(task: string) {
          return {
            classification: { family: "execution", domain: "development", subclass: "worker" },
            proposedTraits: ["write_capable", "subagent_creator"],
            proposedRiskLevel: "medium",
            policyDraft: task === "parent"
              ? { toolRules: { file_write: "deny" }, permissions: { canCreateChildren: true } }
              : { toolRules: { file_write: "allow" }, permissions: { canWrite: true } },
          };
        },
      };
      const service = createAgentGovernanceService({
        env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "parent-ceiling-key-0123456789abcdef" },
        dataDir,
        now: () => "2026-08-30T10:00:00.000Z",
        modelProposer: proposer,
      });
      const parent = await service.generateAgent({
        name: "parent",
        task: "parent",
        requestedTools: ["file_read", "file_write"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, { tenantId: "tenant_a", userId: "operator_a", permissions: ["*"] });
      expect(parent.grantedTools).not.toContain("file_write");
      await expect(service.generateAgent({
        name: "child",
        task: "child",
        requestedTools: ["file_write"],
        ttlSeconds: 1_800,
        parentAgentId: parent.agentId,
      }, { tenantId: "tenant_a", userId: "operator_a", permissions: ["*"] }))
        .rejects.toMatchObject({ name: "AgentDraftRejected" });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
