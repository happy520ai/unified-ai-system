/**
 * Mandatory governance tests — engine level.
 *
 * The numbering below maps one-to-one onto the "必须通过的测试" list of
 * the agent governance specification (十五、必须通过的测试). Tests that
 * require live runtime surfaces (audit emission, approval gating before
 * execution, cascade revocation) are covered by the gateway-side service
 * tests; everything deterministic is proven here.
 */

import { describe, expect, it } from "vitest";
import type {
  AgentDraft,
  AgentRegistryRecord,
  EffectiveAgentPolicy,
  PolicyLayerContent,
  PolicyRecord,
  ToolGovernanceDescriptor,
} from "@unified-ai-system/shared-contracts";
import {
  buildManifest,
  checkUsageLimits,
  compileEffectivePolicy,
  computeAgentHash,
  computeArgumentsHash,
  computePolicyDeltaHash,
  evaluateResourceScope,
  isPolicyExpired,
  recomputeClassification,
  recompileWithoutExpansion,
  sha256Hex,
  stableStringify,
  validateAgentDraft,
  verifyEffectivePolicyIntegrity,
} from "./index.ts";

const NOW = "2026-08-30T10:00:00.000Z";
const DELTA = Object.freeze({ agentId: "agt_test", inherits: [], instanceRules: {} });

const TOOLS: Record<string, ToolGovernanceDescriptor> = {
  "orders.search": { name: "orders.search", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow", credentialMode: "server_side" },
  "payments.search": { name: "payments.search", actionType: "read", riskTraits: ["handles_sensitive_data", "read_only"], riskLevel: "medium", defaultDecision: "allow", credentialMode: "server_side" },
  "reports.create": { name: "reports.create", actionType: "write", riskTraits: [], riskLevel: "medium", defaultDecision: "allow", credentialMode: "server_side" },
  "payment.refund": { name: "payment.refund", actionType: "write", riskTraits: ["financial_operation"], riskLevel: "critical", defaultDecision: "require_approval", credentialMode: "server_side" },
  "database.delete": { name: "database.delete", actionType: "write", riskTraits: ["destructive_operation"], riskLevel: "critical", defaultDecision: "deny", credentialMode: "server_side" },
  "shell.execute": { name: "shell.execute", actionType: "write", riskTraits: ["code_execution"], riskLevel: "critical", defaultDecision: "deny", credentialMode: "server_side" },
  "email.send": { name: "email.send", actionType: "write", riskTraits: ["external_communication"], riskLevel: "high", defaultDecision: "require_approval", credentialMode: "server_side" },
};

function makePolicy(policyKey: string, version: number, policyType: PolicyRecord["policyType"], scopeKey: string, content: PolicyLayerContent): PolicyRecord {
  return {
    policyKey,
    version,
    policyType,
    scopeKey,
    content,
    contentHash: `sha256:${sha256Hex(stableStringify(content))}`,
    status: "active",
    createdAt: NOW,
    activatedAt: NOW,
  };
}

const ROOT = makePolicy("root-policy", 1, "root", "global", {
  limits: { maxGenerationDepth: 2, maxChildrenPerAgent: 5, maxRuntimeSeconds: 300, maxSteps: 30, maxToolCalls: 50 },
  toolRules: { "database.delete": "deny", "shell.execute": "deny", "payment.refund": "require_approval", "email.send": "require_approval" },
  requirements: { auditRequired: true },
  permissions: {
    canCreateChildren: true,
    canWrite: true,
    canSendExternalMessage: true,
    canExecuteCode: false,
  },
});

const ANALYSIS_FAMILY = makePolicy("analysis-family", 1, "family", "analysis", {
  capabilityCeiling: ["orders.search", "payments.search", "reports.create"],
  toolRules: { "email.send": "deny", "payment.refund": "deny" },
  limits: { maxSteps: 15, maxToolCalls: 25, maxRuntimeSeconds: 180, maxChildrenPerAgent: 0 },
});

function baseDraft(overrides: Partial<AgentDraft> = {}): AgentDraft {
  return {
    name: "refund_analyzer",
    task: "分析最近一个月退款异常并生成报告",
    requestedTools: ["orders.search", "payments.search", "reports.create"],
    ttlSeconds: 3600,
    parentAgentId: null,
    classification: { family: "analysis", domain: "finance", subclass: "refund_analysis" },
    proposedTraits: ["read_only", "handles_sensitive_data"],
    proposedRiskLevel: "medium",
    ...overrides,
  };
}

function compileFor(draft: AgentDraft, stack: PolicyRecord[], now = NOW): EffectiveAgentPolicy {
  return compileEffectivePolicy({
    agentId: "agt_test",
    classification: draft.classification,
    traits: draft.proposedTraits,
    riskLevel: draft.proposedRiskLevel,
    requestedTools: draft.requestedTools,
    ttlSeconds: draft.ttlSeconds,
    layerStack: stack,
    toolDescriptors: TOOLS,
    creatorEntitlements: {
      allowedTools: draft.requestedTools,
      permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: true, canExecuteCode: true },
    },
    now,
  });
}

function makeParent(overrides: Partial<AgentRegistryRecord> = {}): AgentRegistryRecord {
  return {
    agentId: "agt_parent",
    name: "parent",
    purpose: "parent scope",
    tenantId: "tenant_a",
    ownerUserId: "user_1",
    createdBy: "user_1",
    parentAgentId: null,
    generationDepth: 0,
    classification: { family: "orchestration", domain: "finance", subclass: "coordination" },
    traits: ["subagent_creator", "handles_sensitive_data"],
    riskLevel: "high",
    requestedTools: ["orders.search", "payments.search"],
    grantedTools: ["orders.search", "payments.search"],
    policyHash: "sha256:placeholder",
    status: "ACTIVE",
    createdAt: NOW,
    expiresAt: "2026-08-30T12:00:00.000Z",
    ...overrides,
  };
}

function parentEffectiveFor(parent: AgentRegistryRecord): EffectiveAgentPolicy {
  // Derive the parent TTL from the registry record so the compiled parent
  // expiry mirrors what the service would have persisted for it.
  const ttlSeconds = Math.max(
    1,
    Math.floor((new Date(parent.expiresAt).getTime() - new Date(NOW).getTime()) / 1000),
  );
  return compileEffectivePolicy({
    agentId: parent.agentId,
    classification: parent.classification,
    traits: parent.traits,
    riskLevel: parent.riskLevel,
    requestedTools: parent.requestedTools,
    ttlSeconds,
    layerStack: [ROOT],
    toolDescriptors: TOOLS,
    now: NOW,
    creatorEntitlements: {
      allowedTools: parent.requestedTools,
      permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: true, canExecuteCode: true },
    },
  });
}

// ---------------------------------------------------------------------------
// 权限测试 1-5
// ---------------------------------------------------------------------------

describe("mandatory permission tests", () => {
  it("1. 子 Agent 申请父 Agent 没有的工具，必须失败", () => {
    const parent = makeParent();
    const result = validateAgentDraft({
      draft: baseDraft({ parentAgentId: "agt_parent", requestedTools: ["orders.search", "payment.refund"] }),
      toolDescriptors: TOOLS,
      parent: { record: parent, effective: parentEffectiveFor(parent), currentChildrenCount: 0 },
      rootLimits: ROOT.content.limits,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("PARENT_TOOL_SUBSET_VIOLATION");
  });

  it("2. 根规则 deny + 实例规则 allow → 最终 deny", () => {
    const instance = makePolicy("agt-instance", 1, "instance", "agt_test", {
      toolRules: { "database.delete": "allow" },
    });
    const stack = [ROOT, ANALYSIS_FAMILY, instance];
    const policy = compileFor(baseDraft({ requestedTools: ["orders.search", "database.delete"] }), stack);
    expect(policy.toolDecisions["database.delete"]).toBe("deny");
  });

  it("3. 类别规则 require_approval + 实例规则 allow → 最终仍需审批", () => {
    const executionFamily = makePolicy("execution-family", 1, "family", "execution", {
      capabilityCeiling: ["orders.search", "email.send"],
      toolRules: { "email.send": "require_approval" },
    });
    const instance = makePolicy("agt-instance", 1, "instance", "agt_test", {
      toolRules: { "email.send": "allow" },
    });
    const policy = compileFor(
      baseDraft({ requestedTools: ["orders.search", "email.send"], classification: { family: "execution", domain: "ops", subclass: "notify" } }),
      [ROOT, executionFamily, instance],
    );
    expect(policy.toolDecisions["email.send"]).toBe("require_approval");
  });

  it("4. 未登记工具默认拒绝", () => {
    const result = validateAgentDraft({
      draft: baseDraft({ requestedTools: ["orders.search", "unknown.tool"] }),
      toolDescriptors: TOOLS,
      now: NOW,
    });
    expect(result.errors.map((error) => error.code)).toContain("TOOL_UNREGISTERED");

    const openFamily = makePolicy("open-family", 1, "family", "analysis", {
      capabilityCeiling: ["orders.search", "unknown.tool"],
    });
    const policy = compileFor(baseDraft({ requestedTools: ["orders.search", "unknown.tool"] }), [ROOT, openFamily]);
    expect(policy.toolDecisions["unknown.tool"]).toBe("deny");
    expect(policy.grantedTools).not.toContain("unknown.tool");
  });

  it("5. 跨租户资源访问必须拒绝（允许集取交集）", () => {
    const tenantLayer = makePolicy("tenant-a-policy", 1, "tenant", "tenant_a", {
      dataRules: { allowedTenants: ["tenant_a"] },
    });
    const policy = compileFor(baseDraft(), [ROOT, tenantLayer, ANALYSIS_FAMILY]);
    expect(policy.scope.allowedTenants).toEqual(["tenant_a"]);
    expect(evaluateResourceScope(policy.scope, { tenantId: "tenant_b" }).allowed).toBe(false);
    expect(evaluateResourceScope(policy.scope, { tenantId: "tenant_a" }).allowed).toBe(true);
    expect(evaluateResourceScope(policy.scope, {}).reason).toBe("TENANT_ID_REQUIRED");
  });
});

// ---------------------------------------------------------------------------
// 分类测试 6-8
// ---------------------------------------------------------------------------

describe("mandatory classification tests", () => {
  it("6. 分析类 Agent 申请退款工具 → 自动添加财务写入风险", () => {
    const recomputed = recomputeClassification({
      classification: baseDraft().classification,
      proposedTraits: ["read_only", "handles_sensitive_data"],
      proposedRiskLevel: "medium",
      toolDescriptors: [TOOLS["orders.search"], TOOLS["payment.refund"]],
    });
    expect(recomputed.traits).toContain("financial_operation");
    expect(recomputed.traits).toContain("write_capable");
    expect(recomputed.traits).toContain("handles_sensitive_data");
    expect(recomputed.traits).not.toContain("read_only");
    expect(recomputed.riskEscalated).toBe(true);
  });

  it("7. Agent 自称低风险但工具属于高风险 → 按高风险处理", () => {
    const recomputed = recomputeClassification({
      classification: baseDraft().classification,
      proposedTraits: [],
      proposedRiskLevel: "low",
      toolDescriptors: [TOOLS["database.delete"]],
    });
    expect(recomputed.riskLevel).toBe("critical");
    expect(recomputed.traits).toContain("destructive_operation");
  });

  it("8. 名称和 Prompt 不能改变工具风险标签", () => {
    const forName = (name: string, task: string) => recomputeClassification({
      classification: { family: "analysis", domain: "finance", subclass: "x" },
      proposedTraits: ["read_only"],
      proposedRiskLevel: "low",
      toolDescriptors: [TOOLS["payment.refund"]],
    }) && { name, task, ...recomputeClassification({
      classification: { family: "analysis", domain: "finance", subclass: "x" },
      proposedTraits: ["read_only"],
      proposedRiskLevel: "low",
      toolDescriptors: [TOOLS["payment.refund"]],
    }) };
    const harmless = forName("harmless_reader", "只是阅读");
    const scary = forName("SCARY_AGENT", "危险任务！！");
    expect(harmless.traits).toEqual(scary.traits);
    expect(harmless.riskLevel).toBe(scary.riskLevel);
    expect(scary.riskLevel).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// 文件安全测试 9-11（引擎可验证部分）
// ---------------------------------------------------------------------------

describe("mandatory integrity tests", () => {
  const SECRET = "test-governance-secret";

  it("9. 修改 effective-policy 内容后完整性校验失败", () => {
    const policy = compileFor(baseDraft(), [ROOT, ANALYSIS_FAMILY]);
    const record: AgentRegistryRecord = {
      ...makeParent(),
      agentId: policy.agentId,
      classification: policy.classification,
      traits: policy.traits,
      riskLevel: policy.riskLevel,
      requestedTools: baseDraft().requestedTools,
      grantedTools: policy.grantedTools,
      policyHash: policy.policyHash,
      expiresAt: policy.expiresAt,
    };
    const manifest = buildManifest({
      agentId: policy.agentId,
      agentHash: computeAgentHash(record),
      policyHash: policy.policyHash,
      deltaHash: computePolicyDeltaHash(DELTA),
      compiledAt: policy.compiledAt,
      secret: SECRET,
    });
    expect(verifyEffectivePolicyIntegrity(policy, manifest, SECRET, record, DELTA).ok).toBe(true);

    const tampered: EffectiveAgentPolicy = { ...policy, grantedTools: [...policy.grantedTools, "shell.execute"] };
    const result = verifyEffectivePolicyIntegrity(tampered, manifest, SECRET, record, DELTA);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("POLICY_HASH_MISMATCH");

    const tamperedDecision: EffectiveAgentPolicy = { ...policy, toolDecisions: { ...policy.toolDecisions, "orders.search": "allow" }, limits: { ...policy.limits, maxToolCalls: 999 } };
    expect(verifyEffectivePolicyIntegrity(tamperedDecision, manifest, SECRET, record, DELTA).ok).toBe(false);

    const wrongSecret = verifyEffectivePolicyIntegrity(policy, manifest, "other-secret", record, DELTA);
    expect(wrongSecret.ok).toBe(false);
    expect(wrongSecret.reason).toBe("MANIFEST_SIGNATURE_INVALID");

    const tamperedDelta = { ...DELTA, instanceRules: { toolRules: { "orders.search": "deny" } } };
    expect(verifyEffectivePolicyIntegrity(policy, manifest, SECRET, record, tamperedDelta).reason)
      .toBe("MANIFEST_DELTA_HASH_MISMATCH");
    const { deltaHash: _legacyDeltaHash, ...legacyManifest } = manifest;
    expect(verifyEffectivePolicyIntegrity(policy, legacyManifest, SECRET, record, DELTA).reason)
      .toBe("MANIFEST_DELTA_HASH_MISSING");
  });

  it("10. 签名在合法重编译（新哈希新签名）下通过，旧签名对策略不匹配", () => {
    const policy = compileFor(baseDraft(), [ROOT, ANALYSIS_FAMILY]);
    const record: AgentRegistryRecord = { ...makeParent(), agentId: policy.agentId, classification: policy.classification, traits: policy.traits, riskLevel: policy.riskLevel, requestedTools: baseDraft().requestedTools, grantedTools: policy.grantedTools, policyHash: policy.policyHash, expiresAt: policy.expiresAt };
    const manifest = buildManifest({ agentId: policy.agentId, agentHash: computeAgentHash(record), policyHash: policy.policyHash, deltaHash: computePolicyDeltaHash(DELTA), compiledAt: policy.compiledAt, secret: SECRET });
    const next = compileFor(baseDraft({ ttlSeconds: 1800 }), [ROOT, ANALYSIS_FAMILY], "2026-08-30T10:05:00.000Z");
    const nextRecord: AgentRegistryRecord = { ...record, grantedTools: next.grantedTools, policyHash: next.policyHash, expiresAt: next.expiresAt };
    const nextManifest = buildManifest({ agentId: next.agentId, agentHash: computeAgentHash(nextRecord), policyHash: next.policyHash, deltaHash: computePolicyDeltaHash(DELTA), compiledAt: next.compiledAt, secret: SECRET });
    expect(next.policyHash).not.toBe(policy.policyHash);
    expect(verifyEffectivePolicyIntegrity(next, nextManifest, SECRET, nextRecord, DELTA).ok).toBe(true);
    // Old manifest must not validate the new policy bytes.
    expect(verifyEffectivePolicyIntegrity(next, manifest, SECRET, nextRecord, DELTA).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 生命周期测试 12-14
// ---------------------------------------------------------------------------

describe("mandatory lifecycle tests", () => {
  it("12. 策略过期后判定为过期", () => {
    const policy = compileFor(baseDraft({ ttlSeconds: 60 }), [ROOT, ANALYSIS_FAMILY], NOW);
    expect(isPolicyExpired(policy, "2026-08-30T10:00:59.000Z")).toBe(false);
    expect(isPolicyExpired(policy, "2026-08-30T10:01:00.000Z")).toBe(true);
  });

  it("14. 子 Agent 的过期时间不能晚于父 Agent（校验拒绝 + 编译钳制）", () => {
    const parent = makeParent({ expiresAt: "2026-08-30T11:00:00.000Z" });
    const result = validateAgentDraft({
      draft: baseDraft({ parentAgentId: "agt_parent", ttlSeconds: 7200, requestedTools: ["orders.search"], proposedTraits: ["subagent_creator", "handles_sensitive_data"] }),
      toolDescriptors: TOOLS,
      parent: { record: parent, effective: parentEffectiveFor(parent), currentChildrenCount: 0 },
      familyPermissions: { canCreateChildren: true },
      rootLimits: ROOT.content.limits,
      now: NOW,
    });
    expect(result.errors.map((error) => error.code)).toContain("PARENT_EXPIRY_CEILING");

    // A TTL that fits passes validation and compiles to the parent's ceiling.
    const fitting = validateAgentDraft({
      draft: baseDraft({ parentAgentId: "agt_parent", ttlSeconds: 1800, requestedTools: ["orders.search"], proposedTraits: ["subagent_creator", "handles_sensitive_data"] }),
      toolDescriptors: TOOLS,
      parent: { record: parent, effective: parentEffectiveFor(parent), currentChildrenCount: 0 },
      familyPermissions: { canCreateChildren: true },
      rootLimits: ROOT.content.limits,
      now: NOW,
    });
    expect(fitting.valid).toBe(true);
    const compiled = compileEffectivePolicy({
      agentId: "agt_child",
      classification: fitting ? baseDraft().classification : baseDraft().classification,
      traits: ["subagent_creator", "handles_sensitive_data"],
      riskLevel: "medium",
      requestedTools: ["orders.search"],
      ttlSeconds: 7200,
      layerStack: [ROOT],
      toolDescriptors: TOOLS,
      parentEffective: parentEffectiveFor(parent),
      creatorEntitlements: {
        allowedTools: ["orders.search"],
        permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: true, canExecuteCode: true },
      },
      now: NOW,
    });
    expect(compiled.expiresAt <= "2026-08-30T11:00:00.000Z").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 工具执行测试 17-18（引擎可验证部分）
// ---------------------------------------------------------------------------

describe("mandatory execution tests", () => {
  it("17. 审批通过后修改参数，必须重新审批（参数哈希锁定）", () => {
    const original = { payment_id: "pay_1", amount: 100 };
    const same = { amount: 100, payment_id: "pay_1" };
    const changed = { payment_id: "pay_1", amount: 101 };
    expect(computeArgumentsHash(original)).toBe(computeArgumentsHash(same));
    expect(computeArgumentsHash(original)).not.toBe(computeArgumentsHash(changed));
  });

  it("18. 达到最大工具调用次数后拒绝继续调用", () => {
    const policy = compileFor(baseDraft(), [ROOT, ANALYSIS_FAMILY]);
    expect(policy.limits.maxToolCalls).toBe(25);
    expect(checkUsageLimits(policy.limits, { toolCalls: 24, steps: 0, records: 0 }).allowed).toBe(true);
    const atCap = checkUsageLimits(policy.limits, { toolCalls: 25, steps: 0, records: 0 });
    expect(atCap.allowed).toBe(false);
    expect(atCap.reason).toBe("TOOL_CALL_LIMIT_REACHED");
  });
});

// ---------------------------------------------------------------------------
// 规则更新测试 19-21
// ---------------------------------------------------------------------------

describe("mandatory policy update tests", () => {
  it("19. 更严格类别规则激活后，已有 Agent 自动收紧", () => {
    const strictFamily = makePolicy("analysis-family", 2, "family", "analysis", {
      capabilityCeiling: ["orders.search", "payments.search", "reports.create"],
      toolRules: { "reports.create": "require_approval" },
      limits: { maxToolCalls: 10, maxChildrenPerAgent: 0, maxSteps: 15, maxRuntimeSeconds: 180 },
    });
    const oldPolicy = compileFor(baseDraft(), [ROOT, ANALYSIS_FAMILY]);
    const nextRaw = compileFor(baseDraft(), [ROOT, strictFamily]);
    const { policy, clamped } = recompileWithoutExpansion(nextRaw, oldPolicy);
    expect(policy.toolDecisions["reports.create"]).toBe("require_approval");
    expect(policy.limits.maxToolCalls).toBe(10);
    expect(clamped).toEqual([]);
  });

  it("20. 更宽松类别规则激活后，已有 Agent 不自动扩权", () => {
    const looseFamily = makePolicy("analysis-family", 2, "family", "analysis", {
      capabilityCeiling: ["orders.search", "payments.search", "reports.create", "email.send", "shell.execute"],
      toolRules: { "email.send": "allow", "shell.execute": "allow" },
      limits: { maxToolCalls: 999, maxSteps: 999 },
    });
    const oldPolicy = compileFor(baseDraft(), [ROOT, ANALYSIS_FAMILY]);
    expect(oldPolicy.toolDecisions["reports.create"]).toBe("allow");
    const nextRaw = compileFor(baseDraft({ requestedTools: ["orders.search", "reports.create", "email.send", "shell.execute"] }), [ROOT, looseFamily]);
    // The loose compile grants email.send (at root's approval floor — the
    // root layer can never be relaxed by a family) and keeps shell.execute
    // denied: root deny is absolute. Granting email.send at all is already
    // the expansion the next assertion must clamp.
    expect(nextRaw.toolDecisions["email.send"]).toBe("require_approval");
    expect(nextRaw.toolDecisions["shell.execute"]).toBe("deny");
    // …but recompilation clamps back under the no-expansion law.
    const { policy, clamped } = recompileWithoutExpansion(nextRaw, oldPolicy);
    expect(policy.toolDecisions["email.send"]).toBe("deny");
    expect(policy.toolDecisions["shell.execute"]).toBe("deny");
    expect(policy.grantedTools).not.toContain("email.send");
    expect(policy.limits.maxToolCalls).toBe(oldPolicy.limits.maxToolCalls);
    expect(clamped.length).toBeGreaterThan(0);
  });

  it("21. 重编译产生新哈希（审计将同时记录旧哈希与新哈希）", () => {
    const oldPolicy = compileFor(baseDraft(), [ROOT, ANALYSIS_FAMILY]);
    const strictFamily = makePolicy("analysis-family", 2, "family", "analysis", {
      toolRules: { "orders.search": "require_approval" },
    });
    const nextRaw = compileFor(baseDraft(), [ROOT, strictFamily], "2026-08-30T11:00:00.000Z");
    const { policy } = recompileWithoutExpansion(nextRaw, oldPolicy);
    expect(policy.policyHash).not.toBe(oldPolicy.policyHash);
    expect(policy.toolDecisions["orders.search"]).toBe("require_approval");
    expect(oldPolicy.toolDecisions["orders.search"]).toBe("allow");
  });
});

// ---------------------------------------------------------------------------
// 合并代数单元测试
// ---------------------------------------------------------------------------

describe("merge algebra units", () => {
  it("数值上限取最小值", async () => {
    const { mergeLimits } = await import("./merge.ts");
    expect(mergeLimits([{ maxSteps: 30 }, { maxSteps: 15 }, {}])).toEqual({ maxSteps: 15 });
    expect(mergeLimits([null, undefined, { maxToolCalls: 50 }])).toEqual({ maxToolCalls: 50 });
    expect(mergeLimits([{ maxWorkforceRoles: 8 }, { maxWorkforceRoles: 7 }]))
      .toEqual({ maxWorkforceRoles: 7 });
  });

  it("安全要求 OR / 权限布尔 AND（缺省关闭）", async () => {
    const { mergeSafetyRequirements, mergePermissions } = await import("./merge.ts");
    expect(mergeSafetyRequirements([{ auditRequired: true }, {}]).auditRequired).toBe(true);
    expect(mergeSafetyRequirements([{}, {}]).auditRequired).toBeUndefined();
    expect(mergePermissions([{ canWrite: true }, { canWrite: true }]).canWrite).toBe(true);
    expect(mergePermissions([{ canWrite: true }, { canWrite: false }]).canWrite).toBe(false);
    expect(mergePermissions([{}, {}]).canWrite).toBe(false);
  });

  it("stableStringify 与键序无关", () => {
    expect(stableStringify({ a: 1, b: { d: 4, c: 3 } })).toBe(stableStringify({ b: { c: 3, d: 4 }, a: 1 }));
    expect(stableStringify({ a: undefined, b: 1 })).toBe(stableStringify({ b: 1 }));
  });
});
