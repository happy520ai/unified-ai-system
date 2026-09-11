// @test-isolation process
/**
 * Agent governance runtime tests — service, proxy and registry seam.
 *
 * Covers the runtime-side mandatory tests from the governance
 * specification (十五、必须通过的测试): immutable policy versions (11),
 * tamper detection on disk (9-runtime), expiry (12), cascade revocation
 * (13), approval gating and argument locking (16/17), usage ceilings
 * (18), policy activation recompilation with old+new hash audit
 * (19/20/21) and the Tool Proxy seam inside the agent tool registry.
 */

import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAgentGovernanceService,
  type PolicyActivationCommitStage,
} from "./agentGovernanceService.ts";
import { createAgentFileStore } from "./agentFileStore.ts";
import { createGovernanceAuditLog } from "./governanceAuditLog.ts";
import { createAgentGovernanceToolProxy } from "./toolProxy.ts";
import { createAgentToolRegistry } from "../claude-code-patterns/toolRegistryEngine.js";

const T0 = "2026-08-30T10:00:00.000Z";
const SECRET = "unit-test-governance-secret-0123456789";
const CTX = { tenantId: "tenant_a", userId: "user_1", role: "admin", permissions: ["*"] };

function gitPushReviewContext(branch = "main") {
  return {
    approvalReview: {
      schemaVersion: 1 as const,
      reviewable: true,
      effectType: "git:push",
      repository: { displayName: "test-repo", fingerprint: `sha256:${"a".repeat(64)}` },
      remote: { name: "origin", target: "example/test-repo", urlFingerprint: `sha256:${"b".repeat(64)}` },
      source: { branch, commit: "c".repeat(40) },
      destination: { branch },
      options: { setUpstream: false, forceMode: "none" as const },
    },
  };
}

let dataDir: string;
let clockIso = T0;

function newService() {
  return newServiceFor(dataDir);
}

function newServiceFor(directory: string) {
  return createAgentGovernanceService({
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
    },
    dataDir: directory,
    now: () => clockIso,
  });
}

function newToolProxy(service: ReturnType<typeof createAgentGovernanceService>) {
  return createAgentGovernanceToolProxy({ service, now: () => clockIso });
}

function advanceTo(iso: string) {
  clockIso = iso;
}

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "agent-governance-test-"));
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

async function generateExecutionAgent(name: string, overrides: Record<string, unknown> = {}) {
  const service = newService();
  return service.generateAgent({
    name,
    task: "执行代码修改任务",
    requestedTools: ["file_read", "file_write", "git_commit", "git_push"],
    ttlSeconds: 3600,
    parentAgentId: null,
    proposedTraits: ["write_capable", "subagent_creator"],
    proposedRiskLevel: "medium",
    ...overrides,
  }, CTX);
}

describe("agent generation flow", () => {
  it("generates an ACTIVE agent with the five-file bundle, registry record and audit trail", async () => {
    const service = newService();
    const result = await generateExecutionAgent("builder");
    expect(result.status).toBe("ACTIVE");
    expect(result.grantedTools).toContain("file_read");
    // git_push is granted but gated behind approval by the layer stack.
    expect(result.grantedTools).toContain("git_push");

    const dir = join(dataDir, "agents", result.agentId);
    for (const file of ["agent.json", "policy-delta.json", "effective-policy.json", "manifest.json", "audit.ndjson"]) {
      expect(existsSync(join(dir, file))).toBe(true);
    }
    expect(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")).deltaHash)
      .toMatch(/^sha256:[a-f0-9]{64}$/u);
    await expect(service.verifyAllAgentBundles()).resolves.toMatchObject({
      verifiedAgentCount: expect.any(Number),
    });

    const record = await service.getAgent(result.agentId, "tenant_a");
    expect(record?.status).toBe("ACTIVE");
    expect(record?.tenantId).toBe("tenant_a");

    // Cross-tenant reads fail closed.
    expect(await service.getAgent(result.agentId, "tenant_b")).toBeNull();

    const audit = await service.readAudit(result.agentId, "tenant_a", 50);
    const types = audit.map((event) => event.eventType);
    expect(types).toContain("AGENT_DRAFT_CREATED");
    expect(types).toContain("AGENT_CLASSIFIED");
    expect(types).toContain("POLICY_VALIDATED");
    expect(types).toContain("AGENT_ACTIVATED");

    // Sensitive internals stay out of the agent-facing view.
    const view = await service.getEffectivePolicyView(result.agentId, "tenant_a");
    expect(view).not.toHaveProperty("lineage");
    expect(view).not.toHaveProperty("scope");
  });

  it("11. 同一 policy 版本不可覆盖", async () => {
    const service = newService();
    await expect(service.createPolicyVersion({
      policyKey: "root-policy", version: 1, policyType: "root", scopeKey: "global", content: {},
    }, CTX)).rejects.toThrow(/immutable/);
  });

  it("binds execution to the Agent owner and a verified ACTIVE manifest", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("owned-execution");
    const authorized = await service.authorizeAgentExecution(agent.agentId, CTX);
    expect(authorized.record.ownerUserId).toBe(CTX.userId);
    expect(authorized.policy.policyHash).toBe(agent.policyHash);
    authorized.executionLease.release();

    await expect(service.authorizeAgentExecution(agent.agentId, {
      tenantId: CTX.tenantId,
      userId: "different_user",
      role: "operator",
      permissions: ["workflow:run"],
    })).rejects.toMatchObject({ code: "AGENT_EXECUTION_OWNER_REQUIRED", statusCode: 403 });
  });

  it("does not let workflow:run self-classification grant git writes or code execution", async () => {
    const service = newService();
    const agent = await service.generateAgent({
      name: "self-classified-executor",
      task: "try privileged tools",
      requestedTools: ["git_branch", "type_check"],
      ttlSeconds: 3600,
      parentAgentId: null,
      classification: { family: "execution", domain: "general", subclass: "executor" },
      proposedTraits: ["write_capable", "code_execution"],
      proposedRiskLevel: "critical",
    }, {
      tenantId: CTX.tenantId,
      userId: "operator_only",
      role: "operator",
      permissions: ["workflow:run"],
    });
    expect(agent.grantedTools).toEqual([]);
    const effective = await service.getEffectivePolicy(agent.agentId, CTX.tenantId);
    expect(effective?.permissions.canWrite).toBe(false);
    expect(effective?.permissions.canExecuteCode).toBe(false);
    expect(effective?.toolDecisions.git_branch ?? "deny").toBe("deny");
    expect(effective?.toolDecisions.type_check ?? "deny").toBe("deny");
  });
});

describe("tool proxy enforcement", () => {
  it("16. require_approval 工具在审批前不能执行", async () => {
    const service = newService();
    const proxy = newToolProxy(service);
    const agent = await generateExecutionAgent("approvals");
    const verdict = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { remote: "origin", branch: "main" },
      resourceContext: gitPushReviewContext(),
    });
    expect(verdict.outcome).toBe("approval_required");
    expect(verdict.approvalId).toBeTruthy();

    // Cross-tenant identity is rejected before any approval is created.
    const crossTenant = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_b" },
      toolName: "file_read",
      params: { path: "a.txt" },
    });
    expect(crossTenant.outcome).toBe("deny");
    expect(crossTenant.code).toBe("AGENT_NOT_FOUND");
  });

  it("17. 审批通过后修改参数必须重新审批；原始参数可执行", async () => {
    const service = newService();
    const proxy = newToolProxy(service);
    const agent = await generateExecutionAgent("locked-args");
    const original = { remote: "origin", branch: "main" };
    const first = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: original,
      resourceContext: gitPushReviewContext(),
    });
    expect(first.outcome).toBe("approval_required");
    await service.decideApproval(first.approvalId as string, "approve", CTX);

    const same = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { branch: "main", remote: "origin" },
      resourceContext: gitPushReviewContext(),
    });
    expect(same.outcome).toBe("allow");

    const repeated = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { branch: "main", remote: "origin" },
      resourceContext: gitPushReviewContext(),
    });
    expect(repeated.outcome).toBe("approval_required");
    expect(repeated.approvalId).not.toBe(first.approvalId);

    const changed = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { remote: "origin", branch: "develop" },
      resourceContext: gitPushReviewContext("develop"),
    });
    expect(changed.outcome).toBe("approval_required");
    expect(changed.approvalId).not.toBe(first.approvalId);
  });

  it("9-runtime. 篡改 effective-policy.json 后完整性校验失败并审计", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("tampered");
    const policyPath = join(dataDir, "agents", agent.agentId, "effective-policy.json");
    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    policy.grantedTools = [...policy.grantedTools, "shell_exec"];
    writeFileSync(policyPath, JSON.stringify(policy, null, 2));

    expect(await service.loadVerifiedPolicy(agent.agentId)).toBeNull();
    const audit = await service.readAudit(agent.agentId, "tenant_a", 10);
    expect(audit.some((event) => event.eventType === "POLICY_SIGNATURE_FAILED")).toBe(true);
  });

  it("fails closed when policy-delta.json is changed after manifest signing", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("tampered-delta", {
      instanceRules: { limits: { maxToolCalls: 7 } },
    });
    const deltaPath = join(dataDir, "agents", agent.agentId, "policy-delta.json");
    const delta = JSON.parse(readFileSync(deltaPath, "utf8"));
    delta.instanceRules = { toolRules: { file_read: "deny" } };
    writeFileSync(deltaPath, JSON.stringify(delta, null, 2));

    await expect(service.verifyAllAgentBundles()).rejects.toMatchObject({
      code: "AGENT_GOVERNANCE_BUNDLE_INTEGRITY_FAILED",
    });
    expect(await service.loadVerifiedPolicy(agent.agentId)).toBeNull();
    const audit = await service.readAudit(agent.agentId, CTX.tenantId, 20);
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "POLICY_SIGNATURE_FAILED",
        reason: "MANIFEST_DELTA_HASH_MISMATCH",
      }),
    ]));
  });

  it("rejects legacy manifests without deltaHash instead of minting trust for an unsigned delta", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("legacy-unsigned-delta");
    const manifestPath = join(dataDir, "agents", agent.agentId, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    delete manifest.deltaHash;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    expect(await service.loadVerifiedPolicy(agent.agentId)).toBeNull();
    const audit = await service.readAudit(agent.agentId, CTX.tenantId, 20);
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "POLICY_SIGNATURE_FAILED",
        reason: "MANIFEST_DELTA_HASH_MISSING",
      }),
    ]));
  });

  it("deeply verifies terminal Registry Agents without treating expected lifecycle drift as tampering", async () => {
    const isolatedDir = mkdtempSync(join(tmpdir(), "agent-governance-deep-terminal-"));
    try {
      const service = newServiceFor(isolatedDir);
      const agent = await service.generateAgent({
        name: "deep-terminal",
        task: "read then revoke",
        requestedTools: ["file_read"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, CTX);
      await service.revokeAgent(agent.agentId, { reason: "test complete", cascade: false }, CTX);
      await expect(service.verifyAllAgentBundles()).resolves.toEqual({ verifiedAgentCount: 1 });
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true });
    }
  });

  it("rejects registry tenant/status tampering even when policy bytes are unchanged", async () => {
    const isolatedDir = mkdtempSync(join(tmpdir(), "agent-governance-registry-tamper-"));
    try {
      const service = newServiceFor(isolatedDir);
      const agent = await service.generateAgent({
        name: "registry-tamper",
        task: "执行代码修改任务",
        requestedTools: ["file_read", "file_write", "git_commit", "git_push"],
        ttlSeconds: 3600,
        parentAgentId: null,
        proposedTraits: ["write_capable", "subagent_creator"],
        proposedRiskLevel: "medium",
      }, CTX);
      await service.revokeAgent(agent.agentId, { reason: "test", cascade: true }, CTX);

      const registryPath = join(isolatedDir, "agents.json");
      const registry = JSON.parse(readFileSync(registryPath, "utf8"));
      registry.agents[agent.agentId].status = "ACTIVE";
      registry.agents[agent.agentId].tenantId = "tenant_b";
      writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      const restarted = newServiceFor(isolatedDir);
      const proxy = newToolProxy(restarted);
      await expect(proxy.enforce({
        context: { agentId: agent.agentId, tenantId: "tenant_b" },
        toolName: "file_read",
        params: { path: "README.md" },
      })).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });
      await expect(restarted.getAgent(agent.agentId, "tenant_b")).rejects.toMatchObject({
        name: "GovernanceStateIntegrityError",
      });
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true });
    }
  });

  it("12-runtime. Agent 过期后禁止调用", async () => {
    const service = newService();
    const proxy = newToolProxy(service);
    const agent = await generateExecutionAgent("shortlived", { ttlSeconds: 60 });
    advanceTo("2026-08-30T10:01:01.000Z");
    const verdict = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "a.txt" },
    });
    expect(verdict.outcome).toBe("deny");
    expect(verdict.code).toBe("AGENT_EXPIRED");
    advanceTo(T0);
  });

  it("18-runtime. 达到最大工具调用次数后拒绝", async () => {
    const service = newService();
    const proxy = newToolProxy(service);
    const agent = await generateExecutionAgent("capped", {
      instanceRules: { limits: { maxToolCalls: 1 } },
    });
    const first = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "a.txt" },
    });
    expect(first.outcome).toBe("allow");
    const second = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "b.txt" },
    });
    expect(second.outcome).toBe("deny");
    expect(second.code).toBe("TOOL_CALL_LIMIT_REACHED");
  });

  it("reserves maxToolCalls atomically under concurrent proxy calls", async () => {
    const service = newService();
    const proxy = newToolProxy(service);
    const agent = await generateExecutionAgent("concurrent-cap", {
      instanceRules: { limits: { maxToolCalls: 1 } },
    });
    const verdicts = await Promise.all(Array.from({ length: 16 }, (_, index) => proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: `${index}.txt` },
    })));
    expect(verdicts.filter((verdict) => verdict.outcome === "allow")).toHaveLength(1);
    expect(verdicts.filter((verdict) => verdict.code === "TOOL_CALL_LIMIT_REACHED")).toHaveLength(15);
    expect((await service.getUsage(agent.agentId)).toolCalls).toBe(1);
  });
});

describe("sub-agents and cascade revocation", () => {
  async function generateParentAndChild() {
    const service = newService();
    const parent = await service.generateAgent({
      name: "coordinator",
      task: "协调子任务",
      requestedTools: ["file_read", "file_write", "git_commit", "git_push"],
      ttlSeconds: 7200,
      parentAgentId: null,
      proposedTraits: ["write_capable", "subagent_creator"],
      proposedRiskLevel: "medium",
    }, CTX);
    const child = await service.generateAgent({
      name: "worker",
      task: "执行文件读取",
      requestedTools: ["file_read"],
      ttlSeconds: 1800,
      parentAgentId: parent.agentId,
      // Children inherit the parent's risk labels — external_communication
      // comes from the parent's git_push entitlement and may not be dropped.
      proposedTraits: ["write_capable", "external_communication"],
      proposedRiskLevel: "low",
    }, CTX);
    return { service, parent, child };
  }

  it("1-runtime. 子 Agent 申请父 Agent 没有的工具必须失败", async () => {
    const service = newService();
    const parent = await service.generateAgent({
      name: "reader",
      task: "只读",
      requestedTools: ["file_read", "file_write"],
      ttlSeconds: 3600,
      parentAgentId: null,
      proposedTraits: ["write_capable", "subagent_creator"],
      proposedRiskLevel: "low",
    }, CTX);
    await expect(service.generateAgent({
      name: "greedy-child",
      task: "越权",
      requestedTools: ["file_read", "file_write", "shell_exec"],
      ttlSeconds: 1800,
      parentAgentId: parent.agentId,
      proposedTraits: ["write_capable"],
      proposedRiskLevel: "low",
    }, CTX)).rejects.toThrow(/PARENT_TOOL_SUBSET_VIOLATION/);
  });

  it("13. 父 Agent 撤销后子 Agent 级联失效", async () => {
    const { service, parent, child } = await generateParentAndChild();
    const proxy = newToolProxy(service);
    const result = await service.revokeAgent(parent.agentId, { reason: "安全规则更新", cascade: true }, CTX);
    expect(result.revoked).toContain(parent.agentId);
    expect(result.revoked).toContain(child.agentId);

    const verdict = await proxy.enforce({
      context: { agentId: child.agentId, tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "a.txt" },
    });
    expect(verdict.outcome).toBe("deny");
    expect(verdict.code).toBe("AGENT_REVOKED");
  });

  it("atomically enforces maxChildrenPerAgent under concurrent generation", async () => {
    const service = newService();
    const parent = await service.generateAgent({
      name: "single-child-parent",
      task: "delegate one child",
      requestedTools: ["file_read", "file_write"],
      ttlSeconds: 3600,
      parentAgentId: null,
      proposedTraits: ["write_capable", "subagent_creator"],
      proposedRiskLevel: "medium",
      instanceRules: { limits: { maxChildrenPerAgent: 1 } },
    }, CTX);
    const createChild = (name: string) => service.generateAgent({
      name,
      task: "read one file",
      requestedTools: ["file_read"],
      ttlSeconds: 1800,
      parentAgentId: parent.agentId,
      proposedTraits: ["write_capable"],
      proposedRiskLevel: "medium",
    }, CTX);
    const results = await Promise.allSettled([createChild("child-a"), createChild("child-b")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: expect.stringContaining("PARENT_CHILDREN_LIMIT_EXCEEDED") }),
    });
  });

  it("fences new tool executions and waits for an in-flight lease before revocation", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("lease-revocation");
    const lease = await service.acquireToolExecutionLease({
      agentId: agent.agentId,
      tenantId: CTX.tenantId,
      policyHash: agent.policyHash,
    });
    expect(lease).not.toBeNull();

    let revoked = false;
    const revokePromise = service.revokeAgent(agent.agentId, { reason: "fence", cascade: true }, CTX)
      .then((result) => { revoked = true; return result; });
    let fenced = false;
    for (let attempt = 0; attempt < 50 && !fenced; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      const candidate = await service.acquireToolExecutionLease({
        agentId: agent.agentId,
        tenantId: CTX.tenantId,
        policyHash: agent.policyHash,
      });
      fenced = candidate === null;
      candidate?.release();
    }
    expect(revoked).toBe(false);
    expect(fenced).toBe(true);

    lease?.release();
    await expect(revokePromise).resolves.toMatchObject({ revoked: [agent.agentId] });
    expect((await service.getAgent(agent.agentId, CTX.tenantId))?.status).toBe("REVOKED");
  });
});

describe("policy activation recompilation", () => {
  it("rejects global policy mutation from a non-platform tenant even for admin", async () => {
    const service = newService();
    await expect(service.createPolicyVersion({
      policyKey: "tenant-b-attempt",
      version: 1,
      policyType: "tenant",
      scopeKey: "tenant_b",
      content: {},
    }, {
      tenantId: "tenant_b",
      userId: "tenant_b_admin",
      role: "admin",
      permissions: ["*"],
    })).rejects.toMatchObject({ code: "PLATFORM_TENANT_REQUIRED", statusCode: 403 });
  });

  it("fences in-flight tool leases before activating a stricter matching policy", async () => {
    const service = newService();
    const agent = await service.generateAgent({
      name: "activation-lease",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX);
    const lease = await service.acquireToolExecutionLease({
      agentId: agent.agentId,
      tenantId: CTX.tenantId,
      policyHash: agent.policyHash,
    });
    await service.createPolicyVersion({
      policyKey: "activation-lease-subclass",
      version: 1,
      policyType: "subclass",
      scopeKey: "activation-lease",
      content: { toolRules: { file_read: "deny" } },
    }, CTX);
    let completed = false;
    const activation = service.activatePolicyVersion("activation-lease-subclass", 1, CTX)
      .then((result) => { completed = true; return result; });
    await new Promise((resolve) => setImmediate(resolve));
    expect(completed).toBe(false);
    lease?.release();
    await expect(activation).resolves.toMatchObject({
      affected: expect.arrayContaining([expect.objectContaining({ agentId: agent.agentId })]),
    });
    const policy = await service.getEffectivePolicy(agent.agentId, CTX.tenantId);
    expect(policy?.toolDecisions.file_read).toBe("deny");
    const nextLease = await service.acquireToolExecutionLease({
      agentId: agent.agentId,
      tenantId: CTX.tenantId,
      policyHash: policy!.policyHash,
    });
    expect(nextLease).not.toBeNull();
    nextLease?.release();
  });

  it("serializes generation behind an in-progress activation so a stricter stack cannot be missed", async () => {
    const service = newService();
    const existing = await service.generateAgent({
      name: "activation-generation-race",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX);
    const lease = await service.acquireToolExecutionLease({
      agentId: existing.agentId,
      tenantId: CTX.tenantId,
      policyHash: existing.policyHash,
    });
    await service.createPolicyVersion({
      policyKey: "activation-generation-race-subclass",
      version: 1,
      policyType: "subclass",
      scopeKey: "activation-generation-race",
      content: { toolRules: { file_read: "deny" } },
    }, CTX);

    const activation = service.activatePolicyVersion("activation-generation-race-subclass", 1, CTX);
    await new Promise((resolve) => setImmediate(resolve));
    let generationSettled = false;
    const generation = service.generateAgent({
      name: "activation-generation-race",
      task: "read after activation",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX).then((result) => {
      generationSettled = true;
      return result;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(generationSettled).toBe(false);

    lease?.release();
    await activation;
    const generated = await generation;
    const policy = await service.getEffectivePolicy(generated.agentId, CTX.tenantId);
    expect(policy?.toolDecisions.file_read).toBe("deny");
    expect(generated.grantedTools).not.toContain("file_read");
  });

  for (const crashStage of [
    "after-journal",
    "after-fence",
    "after-agent-bundle",
    "after-agent-registry",
    "after-catalog",
    "after-audit",
  ] as const satisfies readonly PolicyActivationCommitStage[]) {
    it(`recovers a simulated process crash at ${crashStage} before exposing service state`, async () => {
      const root = mkdtempSync(join(tmpdir(), `agent-governance-crash-${crashStage}-`));
      try {
        const name = `crash-${crashStage}`;
        let injected = false;
        const crashing = createAgentGovernanceService({
          env: {
            AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
            PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
          },
          dataDir: root,
          now: () => clockIso,
          activationFaultInjector(stage) {
            if (!injected && stage === crashStage) {
              injected = true;
              throw Object.assign(new Error(`simulated crash at ${stage}`), {
                code: "POLICY_ACTIVATION_CRASH_SIMULATION",
              });
            }
          },
        });
        const agent = await crashing.generateAgent({
          name,
          task: "read",
          requestedTools: ["file_read"],
          ttlSeconds: 3600,
          parentAgentId: null,
        }, CTX);
        const policyKey = `${name}-subclass`;
        await crashing.createPolicyVersion({
          policyKey,
          version: 1,
          policyType: "subclass",
          scopeKey: name,
          content: { toolRules: { file_read: "deny" } },
        }, CTX);

        await expect(crashing.activatePolicyVersion(policyKey, 1, CTX)).rejects.toMatchObject({
          code: "POLICY_ACTIVATION_CRASH_SIMULATION",
        });
        expect(existsSync(join(root, "policy-activation.journal.json"))).toBe(true);
        const rawCatalog = JSON.parse(readFileSync(join(root, "policies.json"), "utf8"));
        const rawRegistry = JSON.parse(readFileSync(join(root, "agents.json"), "utf8"));
        if (crashStage === "after-catalog" || crashStage === "after-audit") {
          expect(rawCatalog.activeByPolicyKey[policyKey]).toBe(1);
          // The unsafe state (new catalog + old ACTIVE Agent) is impossible:
          // catalog is committed only after every registry record is stricter.
          expect(rawRegistry.agents[agent.agentId].policyHash).not.toBe(agent.policyHash);
        } else {
          expect(rawCatalog.activeByPolicyKey[policyKey]).toBeUndefined();
        }

        const restarted = createAgentGovernanceService({
          env: {
            AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
            PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
          },
          dataDir: root,
          now: () => clockIso,
        });
        const recoveredRecord = await restarted.getAgent(agent.agentId, CTX.tenantId);
        const recoveredPolicy = await restarted.getEffectivePolicy(agent.agentId, CTX.tenantId);
        expect(recoveredRecord?.status).toBe("ACTIVE");
        expect(recoveredRecord?.policyHash).not.toBe(agent.policyHash);
        expect(recoveredPolicy?.toolDecisions.file_read).toBe("deny");
        expect((await restarted.listPolicies()).find((item) => item.policyKey === policyKey && item.status === "active")?.version)
          .toBe(1);
        expect(existsSync(join(root, "policy-activation.journal.json"))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("rolls catalog and Agent state back when Agent bundle commit fails once", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-activation-bundle-"));
    try {
      const backingFiles = createAgentFileStore({ dataDir: root, secret: SECRET });
      let failNextBundle = false;
      const service = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
        },
        dataDir: root,
        now: () => clockIso,
        stores: {
          files: {
            ...backingFiles,
            async writeAgentBundle(input) {
              if (failNextBundle) {
                failNextBundle = false;
                throw new Error("injected Agent bundle commit failure");
              }
              await backingFiles.writeAgentBundle(input);
            },
          },
        },
      });
      const agent = await service.generateAgent({
        name: "bundle-rollback",
        task: "read",
        requestedTools: ["file_read"],
        ttlSeconds: 3600,
        parentAgentId: null,
      }, CTX);
      await service.createPolicyVersion({
        policyKey: "bundle-rollback-subclass",
        version: 1,
        policyType: "subclass",
        scopeKey: "bundle-rollback",
        content: { toolRules: { file_read: "deny" } },
      }, CTX);
      failNextBundle = true;

      await expect(service.activatePolicyVersion("bundle-rollback-subclass", 1, CTX)).rejects.toMatchObject({
        name: "PolicyActivationTransactionFailed",
        code: "POLICY_ACTIVATION_TRANSACTION_FAILED",
        rolledBack: true,
        rollbackErrors: [],
      });
      expect((await service.listPolicies()).find((item) => item.policyKey === "bundle-rollback-subclass")?.status)
        .toBe("draft");
      expect((await service.getAgent(agent.agentId, CTX.tenantId))?.status).toBe("ACTIVE");
      expect((await service.getEffectivePolicy(agent.agentId, CTX.tenantId))?.policyHash).toBe(agent.policyHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls catalog and Agent state back when the activation audit fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-activation-audit-"));
    try {
      const backingAudit = createGovernanceAuditLog({
        logPath: join(root, "audit-events.jsonl"),
        secret: SECRET,
      });
      let failRecompileAudit = false;
      const service = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
        },
        dataDir: root,
        now: () => clockIso,
        stores: {
          auditLog: {
            ...backingAudit,
            async record(event) {
              if (failRecompileAudit && event.eventType === "POLICY_RECOMPILED") {
                failRecompileAudit = false;
                throw new Error("injected activation audit failure");
              }
              await backingAudit.record(event);
            },
          },
        },
      });
      const agent = await service.generateAgent({
        name: "audit-rollback",
        task: "read",
        requestedTools: ["file_read"],
        ttlSeconds: 3600,
        parentAgentId: null,
      }, CTX);
      await service.createPolicyVersion({
        policyKey: "audit-rollback-subclass",
        version: 1,
        policyType: "subclass",
        scopeKey: "audit-rollback",
        content: { toolRules: { file_read: "deny" } },
      }, CTX);
      failRecompileAudit = true;

      await expect(service.activatePolicyVersion("audit-rollback-subclass", 1, CTX)).rejects.toMatchObject({
        name: "PolicyActivationTransactionFailed",
        rolledBack: true,
      });
      expect((await service.listPolicies()).find((item) => item.policyKey === "audit-rollback-subclass")?.status)
        .toBe("draft");
      expect((await service.getAgent(agent.agentId, CTX.tenantId))?.status).toBe("ACTIVE");
      expect((await service.getEffectivePolicy(agent.agentId, CTX.tenantId))?.policyHash).toBe(agent.policyHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("persists FAILED and retains the execution fence when rollback storage is unavailable", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-activation-failed-"));
    try {
      const backingFiles = createAgentFileStore({ dataDir: root, secret: SECRET });
      let rejectBundleWrites = false;
      const service = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
        },
        dataDir: root,
        now: () => clockIso,
        stores: {
          files: {
            ...backingFiles,
            async writeAgentBundle(input) {
              if (rejectBundleWrites) throw new Error("injected persistent bundle failure");
              await backingFiles.writeAgentBundle(input);
            },
          },
        },
      });
      const agent = await service.generateAgent({
        name: "fail-closed-recovery",
        task: "read",
        requestedTools: ["file_read"],
        ttlSeconds: 3600,
        parentAgentId: null,
      }, CTX);
      await service.createPolicyVersion({
        policyKey: "fail-closed-recovery-subclass",
        version: 1,
        policyType: "subclass",
        scopeKey: "fail-closed-recovery",
        content: { toolRules: { file_read: "deny" } },
      }, CTX);
      rejectBundleWrites = true;

      await expect(service.activatePolicyVersion("fail-closed-recovery-subclass", 1, CTX)).rejects.toMatchObject({
        name: "PolicyActivationTransactionFailed",
        rolledBack: false,
        failClosedAgentIds: [agent.agentId],
      });
      const failedRegistry = JSON.parse(readFileSync(join(root, "agents.json"), "utf8"));
      expect(failedRegistry.agents[agent.agentId].status).toBe("FAILED");
      const replayableRollingBackJournal = readFileSync(
        join(root, "policy-activation.journal.json"),
        "utf8",
      );
      await expect(service.getAgent(agent.agentId, CTX.tenantId)).rejects.toThrow(/persistent bundle failure/u);

      // Once storage is repaired, the first operation on a restarted service
      // consumes the retained rolling-back WAL before exposing any state.
      rejectBundleWrites = false;
      const restarted = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
        },
        dataDir: root,
        now: () => clockIso,
      });
      expect((await restarted.getAgent(agent.agentId, CTX.tenantId))?.status).toBe("ACTIVE");
      expect((await restarted.getEffectivePolicy(agent.agentId, CTX.tenantId))?.policyHash).toBe(agent.policyHash);

      await restarted.activatePolicyVersion("fail-closed-recovery-subclass", 1, CTX);
      const tightened = await restarted.getEffectivePolicy(agent.agentId, CTX.tenantId);
      expect(tightened?.toolDecisions.file_read).toBe("deny");
      writeFileSync(join(root, "policy-activation.journal.json"), replayableRollingBackJournal, "utf8");
      const replayAttempt = createAgentGovernanceService({
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
          PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
        },
        dataDir: root,
        now: () => clockIso,
      });
      await expect(replayAttempt.listPolicies()).rejects.toMatchObject({
        code: "POLICY_ACTIVATION_RECOVERY_REQUIRED",
      });
      const afterReplay = JSON.parse(readFileSync(join(root, "policies.json"), "utf8"));
      expect(afterReplay.activeByPolicyKey["fail-closed-recovery-subclass"]).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("loads versioned Task and Agent Instance policies into the effective stack", async () => {
    const service = newService();
    await service.createPolicyVersion({
      policyKey: "task:reporting",
      version: 1,
      policyType: "task",
      scopeKey: "reporting",
      content: { toolRules: { file_write: "deny" }, limits: { maxSteps: 5 } },
    }, CTX);
    await service.activatePolicyVersion("task:reporting", 1, CTX);

    const agent = await service.generateAgent({
      name: "versioned-specific-policy",
      task: "execute one reporting task",
      requestedTools: ["file_read", "file_write", "git_commit", "git_push"],
      ttlSeconds: 3_600,
      parentAgentId: null,
      proposedTraits: ["write_capable", "subagent_creator"],
      proposedRiskLevel: "medium",
      taskPolicyKeys: ["reporting"],
    }, CTX);
    let effective = await service.getEffectivePolicy(agent.agentId, CTX.tenantId);
    expect(effective?.lineage).toEqual(expect.arrayContaining([
      expect.objectContaining({ policyKey: "task:reporting", version: 1, bindingType: "task" }),
    ]));
    expect(effective?.toolDecisions.file_write).toBe("deny");
    expect(effective?.limits.maxSteps).toBe(5);

    await service.createPolicyVersion({
      policyKey: `agent:${agent.agentId}`,
      version: 1,
      policyType: "instance",
      scopeKey: agent.agentId,
      content: { toolRules: { git_commit: "deny" } },
    }, CTX);
    const instanceActivation = await service.activatePolicyVersion(`agent:${agent.agentId}`, 1, CTX);
    expect(instanceActivation.affected).toEqual(expect.arrayContaining([
      expect.objectContaining({ agentId: agent.agentId }),
    ]));
    effective = await service.getEffectivePolicy(agent.agentId, CTX.tenantId);
    expect(effective?.lineage).toEqual(expect.arrayContaining([
      expect.objectContaining({ policyKey: `agent:${agent.agentId}`, version: 1, bindingType: "instance" }),
    ]));
    expect(effective?.toolDecisions.git_commit).toBe("deny");

    await service.createPolicyVersion({
      policyKey: "task:reporting",
      version: 2,
      policyType: "task",
      scopeKey: "reporting",
      content: { toolRules: { file_read: "require_approval", file_write: "deny" }, limits: { maxSteps: 3 } },
    }, CTX);
    const taskActivation = await service.activatePolicyVersion("task:reporting", 2, CTX);
    expect(taskActivation.affected).toEqual(expect.arrayContaining([
      expect.objectContaining({ agentId: agent.agentId }),
    ]));
    effective = await service.getEffectivePolicy(agent.agentId, CTX.tenantId);
    expect(effective?.toolDecisions.file_read).toBe("require_approval");
    expect(effective?.limits.maxSteps).toBe(3);
  });

  it("19/20/21-runtime. 严格版自动收紧、宽松版不扩权、审计记录新旧哈希", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("recompile-target");
    const before = await service.getEffectivePolicy(agent.agentId, "tenant_a");
    expect(before?.toolDecisions["file_write"]).toBe("allow");

    await service.createPolicyVersion({
      policyKey: "execution-family",
      version: 3,
      policyType: "family",
      scopeKey: "execution",
      content: {
        capabilityCeiling: ["file_read", "glob", "grep", "file_write", "file_edit", "file_insert", "git_status", "git_diff", "git_log", "git_branch", "git_commit", "git_push", "git_create_pr", "shell_exec"],
        toolRules: {
          "shell_exec": "deny",
          "code_run": "deny",
          "git_push": "require_approval",
          "git_create_pr": "require_approval",
          "file_write": "require_approval",
        },
        limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 240 },
        permissions: {
          canCreateChildren: true,
          canWrite: true,
          canSendExternalMessage: true,
          canExecuteCode: false,
        },
      },
    }, CTX);
    const stricter = await service.activatePolicyVersion("execution-family", 3, CTX);
    expect(stricter.affected.some((item) => item.agentId === agent.agentId)).toBe(true);

    const after = await service.getEffectivePolicy(agent.agentId, "tenant_a");
    expect(after?.toolDecisions["file_write"]).toBe("require_approval");
    expect(after?.policyHash).not.toBe(before?.policyHash);

    const audit = await service.readAudit(agent.agentId, "tenant_a", 20);
    const recompiled = audit.find((event) => event.eventType === "POLICY_RECOMPILED");
    expect(recompiled?.previousPolicyHash).toBe(before?.policyHash);
    expect(recompiled?.policyHash).toBe(after?.policyHash);

    // Loosening back to built-in v2 must not re-expand the agent.
    const loose = await service.activatePolicyVersion("execution-family", 2, CTX);
    const loosened = loose.affected.find((item) => item.agentId === agent.agentId);
    expect(loosened?.clamped).toBeGreaterThan(0);
    const finalPolicy = await service.getEffectivePolicy(agent.agentId, "tenant_a");
    expect(finalPolicy?.toolDecisions["file_write"]).toBe("require_approval");
  });
});

describe("per-call audit events (mandatory test 15)", () => {
  it("15. 所有工具调用都产生 TOOL_REQUESTED 及对应结果事件（allow/deny/approval 三路径）", async () => {
    const service = newService();
    const proxy = newToolProxy(service);
    const agent = await generateExecutionAgent("audited-calls");

    // Allow path: TOOL_REQUESTED + TOOL_ALLOWED.
    const allowed = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "a.txt" },
    });
    expect(allowed.outcome).toBe("allow");
    let events = await service.readAudit(agent.agentId, "tenant_a", 50);
    let requested = events.filter((event) => event.eventType === "TOOL_REQUESTED" && event.toolName === "file_read");
    let allowedEvents = events.filter((event) => event.eventType === "TOOL_ALLOWED" && event.toolName === "file_read");
    expect(requested.length).toBe(1);
    expect(requested[0]).toMatchObject({ agentId: agent.agentId, tenantId: "tenant_a" });
    expect(allowedEvents.length).toBe(1);
    expect(allowedEvents[0]?.decision).toBe("allow");

    // Deny path: TOOL_REQUESTED + TOOL_DENIED with the denial code.
    const denied = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "shell_exec",
      params: { command: "rm -rf /" },
    });
    expect(denied.outcome).toBe("deny");
    events = await service.readAudit(agent.agentId, "tenant_a", 50);
    const deniedEvents = events.filter((event) => event.eventType === "TOOL_DENIED" && event.toolName === "shell_exec");
    expect(deniedEvents.length).toBe(1);
    expect(deniedEvents[0]?.decision).toBe("deny");
    expect(deniedEvents[0]?.reason).toBe("TOOL_DENIED_BY_POLICY");
    expect(events.filter((event) => event.eventType === "TOOL_REQUESTED" && event.toolName === "shell_exec").length).toBe(1);

    // Approval path: TOOL_REQUESTED + APPROVAL_REQUESTED (no outcome event
    // until a decision lands), then TOOL_ALLOWED after approval executes.
    const gated = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { remote: "origin", branch: "main" },
      resourceContext: gitPushReviewContext(),
    });
    expect(gated.outcome).toBe("approval_required");
    events = await service.readAudit(agent.agentId, "tenant_a", 50);
    expect(events.filter((event) => event.eventType === "TOOL_REQUESTED" && event.toolName === "git_push").length).toBe(1);
    expect(events.filter((event) => event.eventType === "APPROVAL_REQUESTED" && event.toolName === "git_push").length).toBe(1);
    expect(events.filter((event) => event.eventType === "TOOL_ALLOWED" && event.toolName === "git_push").length).toBe(0);

    await service.decideApproval(gated.approvalId as string, "approve", CTX);
    const approvedRun = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { remote: "origin", branch: "main" },
      resourceContext: gitPushReviewContext(),
    });
    expect(approvedRun.outcome).toBe("allow");
    events = await service.readAudit(agent.agentId, "tenant_a", 50);
    const approvedAllowed = events.filter((event) => event.eventType === "TOOL_ALLOWED" && event.toolName === "git_push");
    expect(approvedAllowed.length).toBe(1);
    expect(approvedAllowed[0]?.decision).toBe("require_approval");
    expect(String(approvedAllowed[0]?.reason ?? "")).toContain("approved execution");

    // Unverified identity claims emit nothing into the governance stream.
    const unverified = await proxy.enforce({
      context: { agentId: "agt_does_not_exist", tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "a.txt" },
    });
    expect(unverified.outcome).toBe("deny");
    expect(await service.readAudit("agt_does_not_exist", "tenant_a", 10)).toEqual([]);
  });
});

describe("registry seam", () => {
  it("uses the effective governance grant as the authoritative permission for a real built-in tool", async () => {
    const service = newService();
    const agent = await service.generateAgent({
      name: "real-file-reader",
      task: "read the public README",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX);
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      governanceRequired: true,
      governanceToolProxy: newToolProxy(service),
    });
    const result = await registry.executeTool("file_read", { file_path: "README.md", limit: 3 }, {
      agentGovernance: { agentId: agent.agentId, tenantId: CTX.tenantId, requestId: "real-read" },
    }) as { status?: string; content?: string };
    expect(result.status).toBe("success");
    expect(result.content).toContain("#");
    const events = await service.readAudit(agent.agentId, CTX.tenantId, 50);
    const completed = events.find((event) => (
      event.eventType === "TOOL_COMPLETED" && event.toolName === "file_read"
    ));
    expect(completed).toMatchObject({
      id: expect.stringMatching(/^age_/u),
      requestId: "real-read",
      resultStatus: "success",
      argumentsRedacted: true,
    });
    const perAgentEvents = await createAgentFileStore({ dataDir, secret: SECRET })
      .readAudit(agent.agentId, 50);
    expect(perAgentEvents.some((event) => event.id === completed?.id)).toBe(true);
  });

  it("canonicalizes equivalent file path aliases before denied-resource enforcement", async () => {
    const service = newService();
    const agent = await service.generateAgent({
      name: "denied-read-alias",
      task: "must not read denied resource",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
      instanceRules: { dataRules: { deniedResources: ["README.md"] } },
    }, CTX);
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      governanceRequired: true,
      governanceToolProxy: newToolProxy(service),
    });
    const result = await registry.executeTool("file_read", { file_path: "./README.md", limit: 1 }, {
      agentGovernance: { agentId: agent.agentId, tenantId: CTX.tenantId, requestId: "denied-alias" },
    }) as { status?: string; code?: string };
    expect(result).toMatchObject({ status: "denied", code: "TOOL_SCOPE_DENIED" });
  });

  it("governed identity routes every call through the Tool Proxy", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("seam");
    const proxy = newToolProxy(service);
    let executed = 0;
    const registry = createAgentToolRegistry({
      workingDirectory: process.cwd(),
      governanceToolProxy: proxy,
    });
    registry.registerTool({
      name: "file_read_probe",
      description: "probe",
      requiredPermissions: ["probe:read"],
      isReadOnly: true,
      readOnlyAttested: true,
      inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      execute: async () => {
        executed += 1;
        return { status: "success" };
      },
    });

    // The tool is not in the agent's granted set → denied by policy.
    const denied = await registry.executeTool("file_read_probe", { path: "a.txt" }, {
      agentGovernance: { agentId: agent.agentId, tenantId: "tenant_a" },
    }) as { status?: string; code?: string };
    expect(denied.status).toBe("denied");
    expect(denied.code).toBe("TOOL_DENIED_BY_POLICY");
    expect(executed).toBe(0);

    // Legacy callers without governed identity keep working untouched.
    const legacy = await registry.executeTool("file_read_probe", { path: "a.txt" }) as { status?: string; code?: string };
    // Without a permission checker the registry itself fails closed for
    // permission-declaring tools; that is the pre-existing behavior.
    expect(legacy.status).toBe("denied");
    expect(legacy.code).toBe("TOOL_PERMISSION_CHECKER_REQUIRED");
  });
});

describe("new policy layer activation", () => {
  it("assembles and recompiles a canonical tenant layer without crossing tenants", async () => {
    const service = newService();
    const tenantB = {
      tenantId: "tenant_b",
      userId: "tenant_b_operator",
      role: "operator",
      permissions: ["workflow:run"],
    };
    const agent = await service.generateAgent({
      name: "tenant-b-reader",
      task: "read",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, tenantB);
    await service.createPolicyVersion({
      policyKey: "tenant:tenant_b",
      version: 1,
      policyType: "tenant",
      scopeKey: "tenant_b",
      content: { toolRules: { file_read: "deny" } },
    }, CTX);
    const activated = await service.activatePolicyVersion("tenant:tenant_b", 1, CTX);
    expect(activated.affected.some((item) => item.agentId === agent.agentId)).toBe(true);
    expect((await service.getEffectivePolicy(agent.agentId, "tenant_b"))?.toolDecisions.file_read).toBe("deny");
  });

  it("applies a newly introduced matching domain layer to existing ACTIVE Agents", async () => {
    const service = newService();
    const agent = await service.generateAgent({
      name: "domain-existing",
      task: "read a report",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, CTX);
    expect((await service.getEffectivePolicy(agent.agentId, CTX.tenantId))?.toolDecisions.file_read).toBe("allow");
    await service.createPolicyVersion({
      policyKey: "general-domain",
      version: 1,
      policyType: "domain",
      scopeKey: "general",
      content: { toolRules: { file_read: "deny" } },
    }, CTX);
    const activated = await service.activatePolicyVersion("general-domain", 1, CTX);
    expect(activated.affected.some((item) => item.agentId === agent.agentId)).toBe(true);
    expect((await service.getEffectivePolicy(agent.agentId, CTX.tenantId))?.toolDecisions.file_read).toBe("deny");
  });
});
