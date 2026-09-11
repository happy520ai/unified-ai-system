// @test-isolation process
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { AGENT_GENERATION_JOURNAL_FILE } from "./agentGenerationJournal.ts";

const SECRET = "agent-generation-authority-isolation-secret-0123456789";
const CONTEXT = {
  tenantId: "tenant_a",
  userId: "operator_a",
  role: "admin",
  permissions: ["*"],
};

function service(dataDir: string, crashAfterJournal = false) {
  return createAgentGovernanceService({
    dataDir,
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
    },
    now: () => "2026-08-30T10:00:00.000Z",
    ...(crashAfterJournal ? {
      generationFaultInjector(stage: string) {
        if (stage === "after-generation-journal") {
          throw Object.assign(new Error("simulated crash after generation journal"), {
            code: "AGENT_GENERATION_CRASH_SIMULATION",
          });
        }
      },
    } : {}),
  });
}

describe("Agent generation Registry authority isolation", () => {
  it("rejects a valid same-key WAL transplanted into a different governance installation", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "agent-generation-authority-source-"));
    const targetRoot = await mkdtemp(join(tmpdir(), "agent-generation-authority-target-"));
    try {
      const source = service(sourceRoot, true);
      let crashed: unknown;
      try {
        await source.generateAgent({
          name: "transplant-source",
          task: "read a bounded file",
          requestedTools: ["file_read"],
          ttlSeconds: 3_600,
          parentAgentId: null,
        }, CONTEXT);
      } catch (error) {
        crashed = error;
      }
      expect(crashed).toMatchObject({ code: "AGENT_GENERATION_CRASH_SIMULATION" });
      const agentId = (crashed as { agentId?: string }).agentId;
      // Crash-simulation errors intentionally do not expose the id; recover it
      // from the signed journal only for this local persistence test.
      const journal = JSON.parse(
        await readFile(join(sourceRoot, AGENT_GENERATION_JOURNAL_FILE), "utf8"),
      ) as { record: { agentId: string }; registryAuthority: string };
      expect(agentId ?? journal.record.agentId).toMatch(/^agt_/u);

      await copyFile(
        join(sourceRoot, AGENT_GENERATION_JOURNAL_FILE),
        join(targetRoot, AGENT_GENERATION_JOURNAL_FILE),
      );
      const target = service(targetRoot);
      await expect(target.getAgent(journal.record.agentId, CONTEXT.tenantId)).rejects.toMatchObject({
        code: "AGENT_GENERATION_RECOVERY_AUTHORITY_MISMATCH",
      });
    } finally {
      await Promise.all([
        rm(sourceRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }),
        rm(targetRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 }),
      ]);
    }
  }, 60_000);
});
