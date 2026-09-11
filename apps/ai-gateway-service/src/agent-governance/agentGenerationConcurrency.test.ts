// @test-isolation process
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createAgentGovernanceService,
  type ModelProposer,
} from "./agentGovernanceService.ts";

const CTX = {
  tenantId: "tenant_a",
  userId: "operator_a",
  role: "admin",
  permissions: ["*"],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Agent generation concurrency", () => {
  it("does not hold the control-plane mutation lock while waiting for a model proposal", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "agent-governance-generation-concurrency-"));
    const proposalStarted = deferred<void>();
    const proposalResult = deferred<Awaited<ReturnType<ModelProposer["proposeClassification"]>>>();
    const modelProposer: ModelProposer = {
      async proposeClassification() {
        proposalStarted.resolve();
        return proposalResult.promise;
      },
    };

    try {
      const service = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "generation-concurrency-test-key-0123456789abcdef",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
        },
        dataDir,
        now: () => "2026-08-30T10:00:00.000Z",
        modelProposer,
      });

      const victim = await service.generateAgent({
        name: "revocation-target",
        task: "read a bounded report",
        requestedTools: ["file_read"],
        ttlSeconds: 3_600,
        parentAgentId: null,
        classification: { family: "analysis", domain: "general", subclass: "reader" },
        proposedTraits: ["read_only"],
        proposedRiskLevel: "low",
      }, CTX);

      const slowGeneration = service.generateAgent({
        name: "slow-model-proposal",
        task: "classify this task through the configured gateway model",
        requestedTools: ["file_read"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, CTX);
      await proposalStarted.promise;

      const revocation = service.revokeAgent(victim.agentId, {
        reason: "emergency policy response",
        cascade: true,
      }, CTX);
      const revocationOutcome = await Promise.race([
        revocation.then(() => "revoked" as const),
        new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 500)),
      ]);

      proposalResult.resolve({
        classification: { family: "analysis", domain: "general", subclass: "reader" },
        proposedTraits: ["read_only"],
        proposedRiskLevel: "low",
      });
      await expect(slowGeneration).resolves.toMatchObject({ status: "ACTIVE" });
      await expect(revocation).resolves.toEqual({ revoked: [victim.agentId] });
      expect(revocationOutcome).toBe("revoked");
    } finally {
      proposalResult.resolve(null);
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
