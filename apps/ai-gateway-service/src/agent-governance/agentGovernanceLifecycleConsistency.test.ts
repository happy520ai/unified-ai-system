import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { PolicyActivationJournal, PolicyActivationRecoveryPlan } from "./policyActivationJournal.ts";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createAgentRegistryStore } from "./agentRegistryStore.ts";

const SECRET = "lifecycle-consistency-test-secret-0123456789";
const CTX = { tenantId: "tenant_a", userId: "owner", role: "admin", permissions: ["*"] };
const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

type TestActivationJournal = PolicyActivationJournal & { failNextClear(): void };

function memoryActivationJournal(): TestActivationJournal {
  let pending: PolicyActivationRecoveryPlan | null = null;
  let failClear = false;
  const journal: TestActivationJournal = {
    path: "memory://activation-journal",
    failNextClear() { failClear = true; },
    create: vi.fn(async (input: any) => {
      pending = {
        ...structuredClone(input),
        operationId: "00000000-0000-4000-8000-000000000001",
        createdAt: "2026-08-30T10:00:00.000Z",
      } as PolicyActivationRecoveryPlan;
      return structuredClone(pending);
    }),
    save: vi.fn(async (plan) => { pending = structuredClone(plan); }),
    load: vi.fn(async () => pending ? structuredClone(pending) : null),
    clear: vi.fn(async () => {
      if (failClear) {
        failClear = false;
        throw new Error("injected one-shot activation WAL clear failure");
      }
      pending = null;
    }),
  };
  return journal;
}

async function fixture(options: { drainTimeoutMs?: number } = {}) {
  const root = await mkdtemp(join(tmpdir(), "agent-governance-lifecycle-"));
  roots.push(root);
  let nowIso = "2026-08-30T10:00:00.000Z";
  const registry = createAgentRegistryStore({
    storePath: join(root, "agents.json"),
    secret: SECRET,
    now: () => nowIso,
  });
  const activationJournal = memoryActivationJournal();
  const service = createAgentGovernanceService({
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
    },
    dataDir: root,
    now: () => nowIso,
    executionDrainTimeoutMs: options.drainTimeoutMs,
    activationJournal,
    stores: { registry },
  });
  return {
    activationJournal,
    registry,
    service,
    setNow(value: string) { nowIso = value; },
  };
}

async function generateParentAndChild(setup: Awaited<ReturnType<typeof fixture>>) {
  const parent = await setup.service.generateAgent({
    name: "lifecycle-parent",
    task: "coordinate child work",
    requestedTools: ["file_read", "file_write"],
    ttlSeconds: 7200,
    parentAgentId: null,
    proposedTraits: ["write_capable", "subagent_creator"],
    proposedRiskLevel: "medium",
  }, CTX);
  const child = await setup.service.generateAgent({
    name: "lifecycle-child",
    task: "read one file",
    requestedTools: ["file_read"],
    ttlSeconds: 1800,
    parentAgentId: parent.agentId,
    proposedTraits: ["write_capable"],
    proposedRiskLevel: "medium",
  }, CTX);
  return { parent, child };
}

describe("Agent Governance lifecycle consistency", () => {
  it("caches successful startup maintenance instead of reloading it for ordinary calls", async () => {
    const setup = await fixture();
    await setup.service.listPolicies();
    await setup.service.stats();
    await setup.service.getUsage("agt_missing");
    expect(setup.activationJournal.load).toHaveBeenCalledTimes(1);
  });

  it("persists an expiry batch and returns without waiting for an aborted run lease", async () => {
    const setup = await fixture();
    const agent = await setup.service.generateAgent({
      name: "expiring-run",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 1,
      parentAgentId: null,
    }, CTX);
    const authorized = await setup.service.authorizeAgentExecution(agent.agentId, CTX);
    setup.setNow("2026-08-30T10:00:02.000Z");

    await expect(setup.service.expireAgents()).resolves.toBe(1);
    expect(authorized.executionLease.signal.aborted).toBe(true);
    expect((await setup.registry.get(agent.agentId, CTX.tenantId))?.status).toBe("EXPIRED");
    authorized.executionLease.release();
  });

  it("atomically persists a cascade before audit and bounds the aborted lease drain", async () => {
    const setup = await fixture({ drainTimeoutMs: 20 });
    const { parent, child } = await generateParentAndChild(setup);
    const authorized = await setup.service.authorizeAgentExecution(child.agentId, CTX);
    const batch = vi.spyOn(setup.registry, "upsertMany");
    batch.mockClear();

    const revoke = setup.service.revokeAgent(parent.agentId, { reason: "cascade", cascade: true }, CTX);
    const result = await Promise.race([
      revoke,
      // The service-side drain is 20 ms. Keep the harness bound generous enough
      // for the full repository's highly parallel Windows test runner.
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("revoke did not drain within bound")), 15_000)),
    ]);

    expect(result.revoked.sort()).toEqual([child.agentId, parent.agentId].sort());
    expect(authorized.executionLease.signal.aborted).toBe(true);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]?.[0].map((item) => item.status)).toEqual(["REVOKED", "REVOKED"]);
    expect((await setup.registry.get(parent.agentId, CTX.tenantId))?.status).toBe("REVOKED");
    expect((await setup.registry.get(child.agentId, CTX.tenantId))?.status).toBe("REVOKED");
    authorized.executionLease.release();
  });

  it("requires parent ownership delegation and refuses execution below a non-ACTIVE ancestor", async () => {
    const setup = await fixture();
    const { parent } = await generateParentAndChild(setup);
    const outsider = {
      tenantId: CTX.tenantId,
      userId: "outsider",
      permissions: ["workflow:run"],
    };
    const childInput = {
      name: "delegated-child",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 1200,
      parentAgentId: parent.agentId,
      proposedTraits: ["write_capable"],
      proposedRiskLevel: "medium" as const,
    };
    await expect(setup.service.generateAgent(childInput, outsider)).rejects.toMatchObject({
      code: "AGENT_CHILD_CREATION_OWNER_REQUIRED",
    });

    const delegated = { ...outsider, permissions: ["workflow:run", "agent:create-child:any"] };
    const child = await setup.service.generateAgent(childInput, delegated);
    const parentRecord = await setup.registry.get(parent.agentId, CTX.tenantId);
    await setup.registry.upsert({ ...parentRecord!, status: "REVOKED" });
    await expect(setup.service.authorizeAgentExecution(child.agentId, delegated)).rejects.toMatchObject({
      code: "AGENT_ANCESTOR_NOT_ACTIVE",
    });
  });

  it("serializes cascade enumeration so a concurrent child cannot escape revocation", async () => {
    const setup = await fixture();
    const { parent } = await generateParentAndChild(setup);
    const original = setup.registry.listByParent.bind(setup.registry);
    let releaseEnumeration!: () => void;
    const enumerationGate = new Promise<void>((resolve) => { releaseEnumeration = resolve; });
    let enteredEnumeration!: () => void;
    const entered = new Promise<void>((resolve) => { enteredEnumeration = resolve; });
    vi.spyOn(setup.registry, "listByParent").mockImplementation(async (agentId) => {
      if (agentId === parent.agentId) {
        enteredEnumeration();
        await enumerationGate;
      }
      return original(agentId);
    });

    const revoke = setup.service.revokeAgent(parent.agentId, { cascade: true }, CTX);
    await entered;
    const generation = setup.service.generateAgent({
      name: "racing-child",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 1200,
      parentAgentId: parent.agentId,
      proposedTraits: ["write_capable"],
      proposedRiskLevel: "medium",
    }, CTX);
    releaseEnumeration();
    await revoke;
    await expect(generation).rejects.toThrow(/PARENT_NOT_ACTIVE|PARENT_UNAVAILABLE|policy integrity/u);
  });

  it("re-reads an activation target and never writes nextRecord over a non-ACTIVE lifecycle state", async () => {
    const setup = await fixture();
    const agent = await setup.service.generateAgent({
      name: "activation-reread",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX);
    await setup.service.createPolicyVersion({
      policyKey: "activation-reread-subclass",
      version: 1,
      policyType: "subclass",
      scopeKey: "activation-reread",
      content: { toolRules: { file_read: "deny" } },
    }, CTX);
    const current = await setup.registry.get(agent.agentId, CTX.tenantId);
    const originalGetUnscoped = setup.registry.getUnscoped.bind(setup.registry);
    vi.spyOn(setup.registry, "getUnscoped").mockImplementation(async (agentId) => (
      agentId === agent.agentId ? { ...current!, status: "EXPIRED" } : originalGetUnscoped(agentId)
    ));
    const writes = vi.spyOn(setup.registry, "upsert");
    writes.mockClear();

    await expect(setup.service.activatePolicyVersion("activation-reread-subclass", 1, CTX))
      .rejects.toMatchObject({ code: "POLICY_ACTIVATION_TRANSACTION_FAILED", rolledBack: true });
    expect(writes.mock.calls.some(([record]) => (
      record.status === "ACTIVE" && record.policyHash !== agent.policyHash
    ))).toBe(false);
    expect((await setup.registry.get(agent.agentId, CTX.tenantId))?.policyHash).toBe(agent.policyHash);
  });

  it("keeps a committed activation intact when the first WAL clear fails, then verifies and clears it", async () => {
    const setup = await fixture();
    const agent = await setup.service.generateAgent({
      name: "completion-clear",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX);
    await setup.service.createPolicyVersion({
      policyKey: "completion-clear-subclass",
      version: 1,
      policyType: "subclass",
      scopeKey: "completion-clear",
      content: { toolRules: { file_read: "deny" } },
    }, CTX);
    setup.activationJournal.failNextClear();

    const activated = await setup.service.activatePolicyVersion("completion-clear-subclass", 1, CTX);
    expect(activated.affected).toContainEqual(expect.objectContaining({ agentId: agent.agentId }));
    expect(await setup.activationJournal.load()).toMatchObject({ phase: "auditing" });
    const committed = await setup.registry.get(agent.agentId, CTX.tenantId);
    expect(committed).toMatchObject({ status: "ACTIVE" });
    expect(committed?.policyHash).not.toBe(agent.policyHash);

    const policies = await setup.service.listPolicies();
    expect(policies).toContainEqual(expect.objectContaining({
      policyKey: "completion-clear-subclass",
      version: 1,
      status: "active",
    }));
    expect((await setup.registry.get(agent.agentId, CTX.tenantId))?.policyHash).toBe(committed?.policyHash);
    expect(await setup.activationJournal.load()).toBeNull();
  });

  it("bounds activation, rollback and recovery drain waits while retaining the execution fence", async () => {
    const setup = await fixture({ drainTimeoutMs: 20 });
    const agent = await setup.service.generateAgent({
      name: "bounded-drain",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX);
    await setup.service.createPolicyVersion({
      policyKey: "bounded-drain-subclass",
      version: 1,
      policyType: "subclass",
      scopeKey: "bounded-drain",
      content: { toolRules: { file_read: "deny" } },
    }, CTX);
    const run = await setup.service.authorizeAgentExecution(agent.agentId, CTX);

    const activation = setup.service.activatePolicyVersion("bounded-drain-subclass", 1, CTX);
    await expect(Promise.race([
      activation,
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("activation drain exceeded bound")), 25_000)),
    ])).rejects.toMatchObject({
      code: "POLICY_ACTIVATION_TRANSACTION_FAILED",
      rolledBack: false,
    });
    expect(run.executionLease.signal.aborted).toBe(true);
    await expect(run.executionLease.assertActive("commit")).rejects.toMatchObject({
      code: "AGENT_EXECUTION_FENCED",
    });

    await expect(Promise.race([
      setup.service.listPolicies(),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("recovery drain exceeded bound")), 25_000)),
    ])).rejects.toMatchObject({ code: "POLICY_ACTIVATION_RECOVERY_REQUIRED" });
    run.executionLease.release();
    await expect(setup.service.listPolicies()).resolves.toBeInstanceOf(Array);
    expect((await setup.registry.get(agent.agentId, CTX.tenantId))?.status).toBe("ACTIVE");
  }, 60_000);

  it("expires and aborts a run lease directly at commit time without a prior sweep", async () => {
    const setup = await fixture();
    const agent = await setup.service.generateAgent({
      name: "lease-self-expiry",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 1,
      parentAgentId: null,
    }, CTX);
    const run = await setup.service.authorizeAgentExecution(agent.agentId, CTX);
    setup.setNow("2026-08-30T10:00:02.000Z");

    await expect(run.executionLease.assertActive("commit")).rejects.toMatchObject({
      code: "AGENT_EXPIRED",
    });
    expect(run.executionLease.signal.aborted).toBe(true);
    expect((await setup.registry.get(agent.agentId, CTX.tenantId))?.status).toBe("EXPIRED");
    run.executionLease.release();
  });
});
