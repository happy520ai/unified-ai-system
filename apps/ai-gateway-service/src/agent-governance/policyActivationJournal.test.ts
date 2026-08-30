import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import {
  createPolicyActivationJournal,
  POLICY_ACTIVATION_JOURNAL_FILE,
} from "./policyActivationJournal.ts";

const SECRET = "unit-test-activation-journal-secret-0123456789";
const CTX = { tenantId: "tenant_a", userId: "user_1", permissions: ["*"] };

describe("policy activation recovery journal", () => {
  it("authenticates the complete recovery plan and rejects tampered phase/progress", async () => {
    const root = await mkdtemp(join(tmpdir(), "policy-activation-journal-"));
    try {
      const service = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
        },
        dataDir: root,
        now: () => "2026-08-30T10:00:00.000Z",
        activationFaultInjector(stage) {
          if (stage === "after-journal") {
            throw Object.assign(new Error("simulated crash"), {
              code: "POLICY_ACTIVATION_CRASH_SIMULATION",
            });
          }
        },
      });
      const agent = await service.generateAgent({
        name: "journal-integrity",
        task: "read",
        requestedTools: ["file_read"],
        ttlSeconds: 3600,
        parentAgentId: null,
      }, CTX);
      await service.createPolicyVersion({
        policyKey: "journal-integrity-subclass",
        version: 1,
        policyType: "subclass",
        scopeKey: "journal-integrity",
        content: { toolRules: { file_read: "deny" } },
      }, CTX);
      await expect(service.activatePolicyVersion("journal-integrity-subclass", 1, CTX)).rejects.toMatchObject({
        code: "POLICY_ACTIVATION_CRASH_SIMULATION",
      });

      const journal = createPolicyActivationJournal({ dataDir: root, secret: SECRET });
      const verified = await journal.load();
      expect(verified).toMatchObject({
        phase: "prepared",
        policyKey: "journal-integrity-subclass",
        oldPolicyBinding: { version: null, contentHash: null },
        nextPolicyBinding: { version: 1 },
        agents: [{ agentId: agent.agentId, oldPolicyHash: agent.policyHash }],
      });

      const path = join(root, POLICY_ACTIVATION_JOURNAL_FILE);
      const tampered = JSON.parse(await readFile(path, "utf8"));
      tampered.phase = "catalog-activated";
      tampered.registryWrittenAgentIds = [agent.agentId];
      await writeFile(path, JSON.stringify(tampered, null, 2), "utf8");
      await expect(journal.load()).rejects.toMatchObject({
        name: "PolicyActivationJournalError",
        code: "POLICY_ACTIVATION_JOURNAL_INVALID",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
