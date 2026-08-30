import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "./toolProxy.ts";

const SECRET = "ancestor-execution-fence-test-secret-0123456789";
const NOW = "2026-08-30T10:00:00.000Z";
const CTX = { tenantId: "tenant_a", userId: "owner", role: "admin", permissions: ["*"] };
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })));
});

function createService(dataDir: string) {
  return createAgentGovernanceService({
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
    },
    dataDir,
    now: () => NOW,
  });
}

async function fixture() {
  const dataDir = await mkdtemp(join(tmpdir(), "agent-ancestor-fence-"));
  roots.push(dataDir);
  const service = createService(dataDir);
  const parent = await service.generateAgent({
    name: "ancestor-parent",
    task: "coordinate child work",
    requestedTools: ["file_read", "file_write"],
    ttlSeconds: 7200,
    parentAgentId: null,
    proposedTraits: ["write_capable", "subagent_creator"],
    proposedRiskLevel: "medium",
  }, CTX);
  const child = await service.generateAgent({
    name: "ancestor-child",
    task: "read one file",
    requestedTools: ["file_read"],
    ttlSeconds: 1800,
    parentAgentId: parent.agentId,
    proposedTraits: ["write_capable"],
    proposedRiskLevel: "medium",
  }, CTX);
  return { dataDir, service, parent, child };
}

describe("authoritative ancestor execution fence", () => {
  it("denies a new Tool Proxy lease below a durably revoked non-cascade parent after restart", async () => {
    const setup = await fixture();
    await setup.service.revokeAgent(setup.parent.agentId, { cascade: false }, CTX);
    expect((await setup.service.getAgent(setup.child.agentId, CTX.tenantId))?.status).toBe("ACTIVE");

    // Restart removes every in-memory descendant fence. The durable parent
    // lifecycle must still close a new Tool Proxy execution lease.
    const restarted = createService(setup.dataDir);
    const proxy = createAgentGovernanceToolProxy({ service: restarted, now: () => NOW });
    const verdict = await proxy.enforce({
      context: {
        agentId: setup.child.agentId,
        tenantId: CTX.tenantId,
        userId: CTX.userId,
        requestId: "req_ancestor_tool_proxy_restart",
      },
      toolName: "file_read",
      params: { path: "README.md" },
    });

    expect(verdict).toMatchObject({ outcome: "deny", code: "AGENT_EXECUTION_FENCED" });
  }, 60_000);

  it("aborts and rejects an issued child run fence when its parent is revoked without cascade", async () => {
    const setup = await fixture();
    const run = await setup.service.authorizeAgentExecution(setup.child.agentId, CTX);
    const aborted = new Promise<void>((resolve) => {
      run.executionLease.signal.addEventListener("abort", () => resolve(), { once: true });
    });

    const revocation = setup.service.revokeAgent(setup.parent.agentId, { cascade: false }, CTX);
    await aborted;
    expect(run.executionLease.signal.aborted).toBe(true);
    await expect(run.executionLease.assertActive("commit")).rejects.toMatchObject({
      code: "AGENT_EXECUTION_FENCED",
    });
    run.executionLease.release();
    const result = await revocation;
    expect(result.revoked).toEqual([setup.parent.agentId]);
    expect((await setup.service.getAgent(setup.child.agentId, CTX.tenantId))?.status).toBe("ACTIVE");
  }, 60_000);

  it("denies a restarted child Tool Proxy lease when its ACTIVE parent's signed bundle is corrupt", async () => {
    const setup = await fixture();
    await writeFile(
      join(setup.dataDir, "agents", setup.parent.agentId, "manifest.json"),
      "{}",
      "utf8",
    );

    const restarted = createService(setup.dataDir);
    const proxy = createAgentGovernanceToolProxy({ service: restarted, now: () => NOW });
    const verdict = await proxy.enforce({
      context: {
        agentId: setup.child.agentId,
        tenantId: CTX.tenantId,
        userId: CTX.userId,
        requestId: "req_ancestor_integrity_restart",
      },
      toolName: "file_read",
      params: { path: "README.md" },
    });

    expect(verdict).toMatchObject({ outcome: "deny", code: "AGENT_EXECUTION_FENCED" });
    expect((await restarted.getAgent(setup.parent.agentId, CTX.tenantId))?.status).toBe("FAILED");
  }, 60_000);

  it("aborts an issued child run and rejects commit when an ancestor bundle loses integrity", async () => {
    const setup = await fixture();
    const run = await setup.service.authorizeAgentExecution(setup.child.agentId, CTX);
    await writeFile(
      join(setup.dataDir, "agents", setup.parent.agentId, "effective-policy.json"),
      "{}",
      "utf8",
    );

    await expect(run.executionLease.assertActive("commit")).rejects.toMatchObject({
      code: "AGENT_ANCESTOR_INTEGRITY_REQUIRED",
    });
    expect(run.executionLease.signal.aborted).toBe(true);
    run.executionLease.release();
  }, 60_000);
});
