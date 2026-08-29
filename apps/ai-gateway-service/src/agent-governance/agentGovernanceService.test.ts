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
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "./toolProxy.ts";
import { createAgentToolRegistry } from "../claude-code-patterns/toolRegistryEngine.js";

const T0 = "2026-08-30T10:00:00.000Z";
const SECRET = "unit-test-governance-secret-0123456789";
const CTX = { tenantId: "tenant_a", userId: "user_1" };

let dataDir: string;
let clockIso = T0;

function newService() {
  return createAgentGovernanceService({
    env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET },
    dataDir,
    now: () => clockIso,
  });
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
});

describe("tool proxy enforcement", () => {
  it("16. require_approval 工具在审批前不能执行", async () => {
    const service = newService();
    const proxy = createAgentGovernanceToolProxy({ service });
    const agent = await generateExecutionAgent("approvals");
    const verdict = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { remote: "origin", branch: "main" },
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
    const proxy = createAgentGovernanceToolProxy({ service });
    const agent = await generateExecutionAgent("locked-args");
    const original = { remote: "origin", branch: "main" };
    const first = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: original,
    });
    expect(first.outcome).toBe("approval_required");
    await service.decideApproval(first.approvalId as string, "approve", CTX);

    const same = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { branch: "main", remote: "origin" },
    });
    expect(same.outcome).toBe("allow");

    const changed = await proxy.enforce({
      context: { agentId: agent.agentId, tenantId: "tenant_a" },
      toolName: "git_push",
      params: { remote: "origin", branch: "develop" },
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

  it("12-runtime. Agent 过期后禁止调用", async () => {
    const service = newService();
    const proxy = createAgentGovernanceToolProxy({ service });
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
    const proxy = createAgentGovernanceToolProxy({ service });
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
      proposedTraits: ["write_capable", "subagent_creator", "external_communication"],
      proposedRiskLevel: "low",
    }, CTX);
    return { service, parent, child };
  }

  it("1-runtime. 子 Agent 申请父 Agent 没有的工具必须失败", async () => {
    const service = newService();
    const parent = await service.generateAgent({
      name: "reader",
      task: "只读",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
      parentAgentId: null,
      proposedTraits: ["write_capable", "subagent_creator"],
      proposedRiskLevel: "low",
    }, CTX);
    await expect(service.generateAgent({
      name: "greedy-child",
      task: "越权",
      requestedTools: ["file_read", "shell_exec"],
      ttlSeconds: 1800,
      parentAgentId: parent.agentId,
      proposedTraits: ["write_capable", "subagent_creator"],
      proposedRiskLevel: "low",
    }, CTX)).rejects.toThrow(/PARENT_TOOL_SUBSET_VIOLATION/);
  });

  it("13. 父 Agent 撤销后子 Agent 级联失效", async () => {
    const { service, parent, child } = await generateParentAndChild();
    const proxy = createAgentGovernanceToolProxy({ service });
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
});

describe("policy activation recompilation", () => {
  it("19/20/21-runtime. 严格版自动收紧、宽松版不扩权、审计记录新旧哈希", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("recompile-target");
    const before = await service.getEffectivePolicy(agent.agentId, "tenant_a");
    expect(before?.toolDecisions["file_write"]).toBe("allow");

    await service.createPolicyVersion({
      policyKey: "execution-family",
      version: 2,
      policyType: "family",
      scopeKey: "execution",
      content: {
        capabilityCeiling: ["file_read", "file_glob", "grep_search", "file_write", "file_edit", "file_insert", "git_status", "git_diff", "git_log", "git_branch", "git_commit", "git_push", "git_create_pr", "shell_exec"],
        toolRules: {
          "shell_exec": "deny",
          "code_run": "deny",
          "git_push": "require_approval",
          "git_create_pr": "require_approval",
          "file_write": "require_approval",
        },
        limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 240 },
      },
    }, CTX);
    const stricter = await service.activatePolicyVersion("execution-family", 2, CTX);
    expect(stricter.affected.some((item) => item.agentId === agent.agentId)).toBe(true);

    const after = await service.getEffectivePolicy(agent.agentId, "tenant_a");
    expect(after?.toolDecisions["file_write"]).toBe("require_approval");
    expect(after?.policyHash).not.toBe(before?.policyHash);

    const audit = await service.readAudit(agent.agentId, "tenant_a", 20);
    const recompiled = audit.find((event) => event.eventType === "POLICY_RECOMPILED");
    expect(recompiled?.previousPolicyHash).toBe(before?.policyHash);
    expect(recompiled?.policyHash).toBe(after?.policyHash);

    // Loosening back to v1 must not re-expand the agent.
    const loose = await service.activatePolicyVersion("execution-family", 1, CTX);
    const loosened = loose.affected.find((item) => item.agentId === agent.agentId);
    expect(loosened?.clamped).toBeGreaterThan(0);
    const finalPolicy = await service.getEffectivePolicy(agent.agentId, "tenant_a");
    expect(finalPolicy?.toolDecisions["file_write"]).toBe("require_approval");
  });
});

describe("per-call audit events (mandatory test 15)", () => {
  it("15. 所有工具调用都产生 TOOL_REQUESTED 及对应结果事件（allow/deny/approval 三路径）", async () => {
    const service = newService();
    const proxy = createAgentGovernanceToolProxy({ service });
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
  it("governed identity routes every call through the Tool Proxy", async () => {
    const service = newService();
    const agent = await generateExecutionAgent("seam");
    const proxy = createAgentGovernanceToolProxy({ service });
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
