// @test-isolation process
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createAgentGovernanceService } from "./agentGovernanceService.ts";

const SECRET = "agent-self-modification-guard-key-0123456789";
const NOW = "2026-08-30T10:00:00.000Z";
const HUMAN = {
  tenantId: "tenant_a",
  userId: "owner_a",
  role: "admin",
  permissions: ["*"],
};

function service(root: string) {
  return createAgentGovernanceService({
    dataDir: root,
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: HUMAN.tenantId,
    },
    now: () => NOW,
  });
}

async function createParent(governance: ReturnType<typeof service>) {
  return governance.generateAgent({
    name: "self-guard-parent",
    task: "create bounded read-only children",
    requestedTools: ["file_read", "file_write"],
    ttlSeconds: 3_600,
    parentAgentId: null,
    proposedTraits: ["write_capable", "subagent_creator"],
    proposedRiskLevel: "medium",
  }, HUMAN);
}

describe("Agent control-plane self-modification guard", () => {
  it("denies self policy, approval, activation and lifecycle mutations while preserving human control", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-self-guard-"));
    try {
      const governance = service(root);
      const agent = await createParent(governance);
      const actor = { ...HUMAN, actorAgentId: agent.agentId };

      await expect(governance.decideApproval("appr_not_disclosed", "approve", actor))
        .rejects.toMatchObject({
          code: "AGENT_ACTOR_APPROVAL_DECISION_DENIED",
          statusCode: 403,
        });
      await expect(governance.activatePolicyVersion("missing-policy", 1, actor))
        .rejects.toMatchObject({
          code: "AGENT_ACTOR_POLICY_ACTIVATION_DENIED",
          statusCode: 403,
        });
      await expect(governance.createPolicyVersion({
        policyKey: `agent:${agent.agentId}`,
        version: 1,
        policyType: "instance",
        scopeKey: agent.agentId,
        content: { toolRules: { file_write: "deny" } },
      }, actor)).rejects.toMatchObject({
        code: "SELF_POLICY_MODIFICATION_DENIED",
        statusCode: 403,
      });
      await expect(governance.revokeAgent(agent.agentId, { cascade: true }, actor))
        .rejects.toMatchObject({
          code: "SELF_LIFECYCLE_MODIFICATION_DENIED",
          statusCode: 403,
        });
      await expect(governance.getAgent(agent.agentId, HUMAN.tenantId)).resolves.toMatchObject({
        status: "ACTIVE",
      });

      await expect(governance.createPolicyVersion({
        policyKey: `agent:${agent.agentId}`,
        version: 1,
        policyType: "instance",
        scopeKey: agent.agentId,
        content: { toolRules: { file_write: "deny" } },
      }, HUMAN)).resolves.toMatchObject({ policyKey: `agent:${agent.agentId}`, version: 1 });
      await expect(governance.activatePolicyVersion(`agent:${agent.agentId}`, 1, HUMAN))
        .resolves.toMatchObject({
          affected: expect.arrayContaining([expect.objectContaining({ agentId: agent.agentId })]),
        });
      await expect(governance.revokeAgent(agent.agentId, { cascade: true }, HUMAN))
        .resolves.toEqual({ revoked: [agent.agentId] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows a capable parent Agent to generate its child but denies ancestor targeting", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-child-self-guard-"));
    try {
      const governance = service(root);
      const parent = await createParent(governance);
      const parentActor = { ...HUMAN, actorAgentId: parent.agentId };
      const child = await governance.generateAgent({
        name: "bounded-child",
        task: "read one bounded file",
        requestedTools: ["file_read"],
        ttlSeconds: 1_800,
        parentAgentId: parent.agentId,
        proposedTraits: ["write_capable"],
        proposedRiskLevel: "medium",
      }, parentActor);
      expect(child.status).toBe("ACTIVE");
      await expect(governance.getAgent(child.agentId, HUMAN.tenantId)).resolves.toMatchObject({
        parentAgentId: parent.agentId,
      });

      const childActor = { ...HUMAN, actorAgentId: child.agentId };
      await expect(governance.createPolicyVersion({
        policyKey: `agent:${parent.agentId}`,
        version: 1,
        policyType: "instance",
        scopeKey: parent.agentId,
        content: { toolRules: { file_read: "deny" } },
      }, childActor)).rejects.toMatchObject({
        code: "SELF_POLICY_MODIFICATION_DENIED",
        statusCode: 403,
      });
      await expect(governance.revokeAgent(parent.agentId, { cascade: true }, childActor))
        .rejects.toMatchObject({
          code: "SELF_LIFECYCLE_MODIFICATION_DENIED",
          statusCode: 403,
        });
      await expect(governance.generateAgent({
        name: "forbidden-root",
        task: "escape the parent boundary",
        requestedTools: ["file_read"],
        ttlSeconds: 600,
        parentAgentId: null,
      }, childActor)).rejects.toMatchObject({
        code: "AGENT_ACTOR_CHILD_PARENT_REQUIRED",
        statusCode: 403,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
