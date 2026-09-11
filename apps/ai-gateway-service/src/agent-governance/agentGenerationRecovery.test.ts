import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createAgentGovernanceService,
  type AgentGenerationCommitStage,
  type GovernanceContext,
} from "./agentGovernanceService.ts";
import { AGENT_GENERATION_JOURNAL_FILE } from "./agentGenerationJournal.ts";
import { createGovernanceAuditLog, type GovernanceAuditLog } from "./governanceAuditLog.ts";

const SECRET = "agent-generation-recovery-secret-0123456789";
const NOW = "2026-08-30T08:00:00.000Z";
const CONTEXT: GovernanceContext = {
  tenantId: "tenant_a",
  userId: "user_a",
  role: "admin",
  permissions: ["*"],
  requestId: "generation-recovery-test",
};
const INPUT = {
  name: "recovered-agent",
  task: "read one governed file",
  requestedTools: ["file_read"],
  ttlSeconds: 3_600,
  parentAgentId: null,
};

const CRASH_STAGES: readonly AgentGenerationCommitStage[] = [
  "after-generation-journal",
  "after-generation-usage",
  "after-generation-bundle",
  "after-generation-registry",
  "after-generation-audit",
  "after-generation-active",
];

async function journalState(root: string): Promise<{
  operationId: string;
  registryAuthority: string;
  record: { agentId: string };
}> {
  return JSON.parse(await readFile(join(root, AGENT_GENERATION_JOURNAL_FILE), "utf8"));
}

async function expectJournalMissing(root: string): Promise<void> {
  await expect(stat(join(root, AGENT_GENERATION_JOURNAL_FILE)))
    .rejects.toMatchObject({ code: "ENOENT" });
}

async function rawRegistryStatus(root: string, agentId: string): Promise<string | null> {
  try {
    const registry = JSON.parse(await readFile(join(root, "agents.json"), "utf8"));
    return registry.agents?.[agentId]?.status ?? null;
  } catch (error) {
    if (error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT") return null;
    throw error;
  }
}

describe("Agent generation cross-store recovery", () => {
  for (const crashStage of CRASH_STAGES) {
    it(`recovers ${crashStage} without exposing an unaudited ACTIVE Agent`, async () => {
      const root = await mkdtemp(join(tmpdir(), `agent-generation-${crashStage}-`));
      try {
        let injected = false;
        const crashing = createAgentGovernanceService({
          dataDir: root,
          env: {
            AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
            PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
          },
          now: () => NOW,
          generationFaultInjector(stage) {
            if (!injected && stage === crashStage) {
              injected = true;
              throw Object.assign(new Error(`simulated generation crash at ${stage}`), {
                code: "AGENT_GENERATION_CRASH_SIMULATION",
              });
            }
          },
        });

        await expect(crashing.generateAgent(INPUT, CONTEXT)).rejects.toMatchObject({
          code: "AGENT_GENERATION_CRASH_SIMULATION",
        });
        const pending = await journalState(root);
        const persistedStatus = await rawRegistryStatus(root, pending.record.agentId);
        if (persistedStatus === "ACTIVE") {
          const rawAudit = createGovernanceAuditLog({
            logPath: join(root, "audit-events.jsonl"),
            secret: SECRET,
            now: () => NOW,
          });
          expect((await rawAudit.readForAgent(pending.record.agentId, 200)).some((event) => (
            event.eventType === "AGENT_ACTIVATED"
            && event.metadata?.generationOperationId === pending.operationId
          ))).toBe(true);
        } else {
          expect(persistedStatus).not.toBe("ACTIVE");
        }
        const restarted = createAgentGovernanceService({
          dataDir: root,
          env: {
            AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
            PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
          },
          now: () => NOW,
        });

        // Every public service method first awaits startup reconciliation.
        const recovered = await restarted.getAgent(pending.record.agentId, CONTEXT.tenantId);
        expect(recovered).toMatchObject({
          agentId: pending.record.agentId,
          status: "ACTIVE",
          tenantId: CONTEXT.tenantId,
        });
        expect(await restarted.loadVerifiedPolicy(pending.record.agentId)).not.toBeNull();
        const audit = await restarted.readAudit(pending.record.agentId, CONTEXT.tenantId, 200);
        const activations = audit.filter((event) => (
          event.eventType === "AGENT_ACTIVATED"
          && event.metadata?.generationOperationId === pending.operationId
        ));
        expect(activations).toHaveLength(1);
        await expectJournalMissing(root);

        // A second restart is idempotent and never duplicates activation.
        const secondRestart = createAgentGovernanceService({
          dataDir: root,
          env: {
            AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
            PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
          },
          now: () => NOW,
        });
        const secondAudit = await secondRestart.readAudit(pending.record.agentId, CONTEXT.tenantId, 200);
        expect(secondAudit.filter((event) => (
          event.eventType === "AGENT_ACTIVATED"
          && event.metadata?.generationOperationId === pending.operationId
        ))).toHaveLength(1);
      } finally {
        await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
      }
    }, 60_000);
  }

  it("fails closed before exposing service state when the pending generation WAL is tampered", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-generation-tampered-wal-"));
    try {
      const crashing = createAgentGovernanceService({
        dataDir: root,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
        },
        now: () => NOW,
        generationFaultInjector(stage) {
          if (stage === "after-generation-registry") {
            throw Object.assign(new Error("simulated crash before audit"), {
              code: "AGENT_GENERATION_CRASH_SIMULATION",
            });
          }
        },
      });
      await expect(crashing.generateAgent(INPUT, CONTEXT)).rejects.toMatchObject({
        code: "AGENT_GENERATION_CRASH_SIMULATION",
      });
      const journalPath = join(root, AGENT_GENERATION_JOURNAL_FILE);
      const pending = JSON.parse(await readFile(journalPath, "utf8"));
      pending.phase = "active";
      await writeFile(journalPath, JSON.stringify(pending), "utf8");

      const restarted = createAgentGovernanceService({
        dataDir: root,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
        },
        now: () => NOW,
      });
      await expect(restarted.getAgent(pending.record.agentId, CONTEXT.tenantId))
        .rejects.toMatchObject({ code: "AGENT_GENERATION_JOURNAL_INVALID" });
      const registry = JSON.parse(await readFile(join(root, "agents.json"), "utf8"));
      expect(registry.agents[pending.record.agentId].status).toBe("VALIDATED");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  }, 60_000);

  it("refuses to replay a valid pending WAL into a different Registry authority", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-generation-authority-mismatch-"));
    try {
      const crashing = createAgentGovernanceService({
        dataDir: root,
        registryAuthority: "signed-json-authority-a",
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
        },
        now: () => NOW,
        generationFaultInjector(stage) {
          if (stage === "after-generation-journal") {
            throw Object.assign(new Error("simulated crash before authority commit"), {
              code: "AGENT_GENERATION_CRASH_SIMULATION",
            });
          }
        },
      });
      await expect(crashing.generateAgent(INPUT, CONTEXT)).rejects.toMatchObject({
        code: "AGENT_GENERATION_CRASH_SIMULATION",
      });
      const pending = await journalState(root);
      const wrongAuthority = createAgentGovernanceService({
        dataDir: root,
        registryAuthority: "signed-json-authority-b",
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
        },
        now: () => NOW,
      });

      await expect(wrongAuthority.getAgent(pending.record.agentId, CONTEXT.tenantId))
        .rejects.toMatchObject({ code: "AGENT_GENERATION_RECOVERY_AUTHORITY_MISMATCH" });
      expect(await rawRegistryStatus(root, pending.record.agentId)).not.toBe("ACTIVE");
      expect(await journalState(root)).toMatchObject({
        operationId: pending.operationId,
        registryAuthority: pending.registryAuthority,
      });
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  }, 60_000);

  it("persists FAILED plus rejection audit and clears the WAL when activation auditing fails normally", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-generation-audit-failure-"));
    try {
      const backing = createGovernanceAuditLog({
        logPath: join(root, "audit-events.jsonl"),
        secret: SECRET,
        now: () => NOW,
      });
      let rejectActivation = true;
      const auditLog: GovernanceAuditLog = {
        async record(event) {
          if (rejectActivation && event.eventType === "AGENT_ACTIVATED") {
            rejectActivation = false;
            throw new Error("simulated activation audit failure");
          }
          await backing.record(event);
        },
        read(limit) {
          return backing.read(limit);
        },
        readForAgent(agentId, limit) {
          return backing.readForAgent(agentId, limit);
        },
      };
      const service = createAgentGovernanceService({
        dataDir: root,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
        },
        now: () => NOW,
        stores: { auditLog },
      });

      let failure: unknown;
      try {
        await service.generateAgent(INPUT, CONTEXT);
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        code: "AGENT_GENERATION_TRANSACTION_FAILED",
        failClosed: true,
      });
      const agentId = (failure as { agentId: string }).agentId;
      expect(await service.getAgent(agentId, CONTEXT.tenantId)).toMatchObject({ status: "FAILED" });
      const audit = await service.readAudit(agentId, CONTEXT.tenantId, 200);
      expect(audit.some((event) => event.eventType === "AGENT_ACTIVATED")).toBe(false);
      expect(audit.some((event) => (
        event.eventType === "POLICY_REJECTED"
        && event.metadata?.generationOutcome === "failed"
      ))).toBe(true);
      await expectJournalMissing(root);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  }, 60_000);
});
