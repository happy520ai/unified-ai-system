import { describe, expect, it } from "vitest";
import type {
  AgentDraft,
  AgentPolicyManifest,
  AgentRegistryRecord,
  EffectiveAgentPolicy,
  PolicyLayerContent,
  PolicyRecord,
  ToolGovernanceDescriptor,
} from "@unified-ai-system/shared-contracts";
import type { CompileEffectivePolicyInput } from "./compiler.ts";
import {
  PolicyCompilationError,
  buildManifest,
  compileEffectivePolicy,
  computeAgentHash,
  computePolicyContentHash,
  computePolicyDeltaHash,
  computePolicyHash,
  evaluateResourceScope,
  getEffectiveToolDecision,
  isPolicyExpired,
  recompileWithoutExpansion,
  validateAgentDraft,
  validateNoSelfModification,
  validatePolicyLayerContent,
  validatePolicyLayerStack,
  verifyEffectivePolicyIntegrity,
  verifyManifestSignature,
} from "./index.ts";

const NOW = "2026-08-30T10:00:00.000Z";
const SECRET = "security-hardening-test-secret";
const READ_TOOL: ToolGovernanceDescriptor = {
  name: "orders.search",
  actionType: "read",
  riskTraits: [],
  riskLevel: "low",
  defaultDecision: "allow",
  credentialMode: "server_side",
};
const WRITE_TOOL: ToolGovernanceDescriptor = {
  name: "reports.create",
  actionType: "write",
  riskTraits: [],
  riskLevel: "medium",
  defaultDecision: "allow",
  credentialMode: "server_side",
};
const TOOLS = { "orders.search": READ_TOOL };

function layer(content: PolicyLayerContent, overrides: Partial<PolicyRecord> = {}): PolicyRecord {
  return {
    policyKey: "root-policy",
    version: 1,
    policyType: "root",
    scopeKey: "global",
    content,
    contentHash: computePolicyContentHash(content),
    status: "active",
    createdAt: NOW,
    activatedAt: NOW,
    ...overrides,
  };
}

function compile(
  content: PolicyLayerContent = {},
  overrides: Partial<CompileEffectivePolicyInput> = {},
): EffectiveAgentPolicy {
  return compileEffectivePolicy({
    agentId: "agt_security",
    classification: { family: "analysis", domain: "finance", subclass: "orders" },
    traits: ["read_only"],
    riskLevel: "low",
    requestedTools: ["orders.search"],
    ttlSeconds: 3600,
    layerStack: [layer(content)],
    toolDescriptors: TOOLS,
    creatorEntitlements: {
      allowedTools: ["orders.search"],
      permissions: { canCreateChildren: false, canWrite: false, canSendExternalMessage: false, canExecuteCode: false },
    },
    now: NOW,
    ...overrides,
  });
}

function recordFor(policy: EffectiveAgentPolicy): AgentRegistryRecord {
  return {
    agentId: policy.agentId,
    name: "security-agent",
    purpose: "attack regression tests",
    tenantId: "tenant_a",
    ownerUserId: "user_a",
    createdBy: "user_a",
    parentAgentId: null,
    generationDepth: 0,
    classification: policy.classification,
    traits: policy.traits,
    riskLevel: policy.riskLevel,
    requestedTools: ["orders.search"],
    grantedTools: policy.grantedTools,
    policyHash: policy.policyHash,
    status: "ACTIVE",
    createdAt: NOW,
    expiresAt: policy.expiresAt,
  };
}

describe("policy compiler fail-closed boundaries", () => {
  it("rejects sandboxRequired until an effect-bound runtime attestation lane exists", () => {
    const validation = validatePolicyLayerContent({
      requirements: { sandboxRequired: true },
    }, "sandbox-policy");
    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.code))
      .toContain("POLICY_SANDBOX_ATTESTATION_UNAVAILABLE");
  });

  it("treats absent or null creator entitlements as an empty delegation ceiling", () => {
    const base = {
      agentId: "agt_security",
      classification: { family: "analysis", domain: "finance", subclass: "orders" },
      traits: ["read_only"],
      riskLevel: "low",
      requestedTools: ["orders.search"],
      ttlSeconds: 3600,
      layerStack: [layer({})],
      toolDescriptors: TOOLS,
      now: NOW,
    } as unknown as CompileEffectivePolicyInput;
    expect(compileEffectivePolicy(base).grantedTools).toEqual([]);
    expect(compile({}, { creatorEntitlements: null }).grantedTools).toEqual([]);
  });

  it("materializes mandatory rules with closed defaults and carries audit into requirements", () => {
    const defaults = compile();
    expect(defaults.mandatory).toEqual({
      auditRequired: true,
      credentialsExposedToAgent: false,
      crossTenantAccess: "deny",
      selfPolicyModification: "deny",
      gatewayBypass: "deny",
      permissionExpansion: "deny",
    });
    expect(defaults.requirements.auditRequired).toBe(true);

    const explicit = compile({ mandatory: { credentialsExposedToAgent: false, gatewayBypass: "deny" } });
    expect(explicit.mandatory.credentialsExposedToAgent).toBe(false);
    expect(explicit.mandatory.gatewayBypass).toBe("deny");
    const unsafe = layer({ mandatory: { credentialsExposedToAgent: true } });
    expect(validatePolicyLayerStack([unsafe]).errors.map((error) => error.code))
      .toContain("POLICY_MANDATORY_UNSAFE");
  });

  it("binds descriptor risk to closed permission booleans", () => {
    const compileWrite = (permissions?: PolicyLayerContent["permissions"]) => compileEffectivePolicy({
      agentId: "agt_writer",
      classification: { family: "execution", domain: "reports", subclass: "writer" },
      traits: ["write_capable"],
      riskLevel: "medium",
      requestedTools: ["reports.create"],
      ttlSeconds: 60,
      layerStack: [layer({ permissions })],
      toolDescriptors: { "reports.create": WRITE_TOOL },
      creatorEntitlements: {
        allowedTools: ["reports.create"],
        permissions: { canCreateChildren: false, canWrite: permissions?.canWrite === true, canSendExternalMessage: false, canExecuteCode: false },
      },
      now: NOW,
    });
    expect(compileWrite().toolDecisions["reports.create"]).toBe("deny");
    expect(compileWrite().grantedTools).toEqual([]);
    expect(compileWrite({ canWrite: true }).toolDecisions["reports.create"]).toBe("allow");
  });

  it("rejects draft/superseded layers and content-hash mismatches before compilation", () => {
    expect(validatePolicyLayerStack([]).errors.map((error) => error.code)).toContain("POLICY_ROOT_REQUIRED");
    const draft = layer({}, { status: "draft" });
    expect(validatePolicyLayerStack([draft]).errors.map((error) => error.code)).toContain("POLICY_NOT_ACTIVE");
    expect(() => compileEffectivePolicy({
      agentId: "agt_security",
      classification: { family: "analysis", domain: "finance", subclass: "orders" },
      traits: [],
      riskLevel: "low",
      requestedTools: ["orders.search"],
      ttlSeconds: 60,
      layerStack: [draft],
      toolDescriptors: TOOLS,
      creatorEntitlements: {
        allowedTools: ["orders.search"],
        permissions: { canCreateChildren: false, canWrite: false, canSendExternalMessage: false, canExecuteCode: false },
      },
      now: NOW,
    })).toThrow(PolicyCompilationError);

    const corrupt = layer({}, { contentHash: `sha256:${"0".repeat(64)}` });
    expect(validatePolicyLayerStack([corrupt]).errors.map((error) => error.code)).toContain("POLICY_CONTENT_HASH_MISMATCH");
  });

  it("rejects prototype keys and resolves inherited decisions to deny", () => {
    const maliciousRules = JSON.parse('{"__proto__":"allow","toString":"allow"}') as Record<string, "allow">;
    const malicious = layer({ toolRules: maliciousRules });
    expect(validatePolicyLayerStack([malicious]).errors.map((error) => error.code)).toContain("POLICY_TOOL_RULES_INVALID");

    const fake = {
      toolDecisions: {},
      grantedTools: ["toString", "constructor", "__proto__"],
    } as Pick<EffectiveAgentPolicy, "toolDecisions" | "grantedTools">;
    expect(getEffectiveToolDecision(fake, "toString")).toBe("deny");
    expect(getEffectiveToolDecision(fake, "constructor")).toBe("deny");
    expect(getEffectiveToolDecision(fake, "__proto__")).toBe("deny");
  });
});

describe("no-expansion algebra", () => {
  it("preserves sparse old ceilings and clamps permissions, decisions, mandatory rules and scope", () => {
    const compiledPrevious = compile({
      limits: { maxToolCalls: 1, maxSteps: 2, maxWorkforceRoles: 7 },
      requirements: { auditRequired: true },
      permissions: { canWrite: false, canExecuteCode: false },
      dataRules: { allowedTenants: ["tenant_a"], deniedResources: ["secret"] },
      toolRules: { "orders.search": "require_approval" },
      mandatory: { gatewayBypass: "deny", permissionExpansion: "deny" },
    });
    // Legacy policies may already carry this stricter bit. Recompilation must
    // preserve it even though new policy content cannot activate it yet.
    const previous = {
      ...compiledPrevious,
      requirements: { ...compiledPrevious.requirements, sandboxRequired: true },
    };
    const { policyHash: _hash, ...nextBase } = previous;
    const next = {
      ...nextBase,
      toolDecisions: { "orders.search": "allow" as const },
      grantedTools: ["orders.search"],
      limits: {},
      requirements: {},
      permissions: { canWrite: true, canExecuteCode: true },
      scope: { allowedTenants: ["tenant_a", "tenant_b"], deniedResources: [] },
      mandatory: { ...previous.mandatory, gatewayBypass: "allow" as const, permissionExpansion: "allow" as const },
    };
    const result = recompileWithoutExpansion(next, previous);
    expect(result.policy.toolDecisions["orders.search"]).toBe("require_approval");
    expect(result.policy.limits).toMatchObject({ maxToolCalls: 1, maxSteps: 2, maxWorkforceRoles: 7 });
    expect(result.policy.requirements).toMatchObject({ auditRequired: true, sandboxRequired: true });
    expect(result.policy.permissions).toMatchObject({ canWrite: false, canExecuteCode: false });
    expect(result.policy.scope.allowedTenants).toEqual(["tenant_a"]);
    expect(result.policy.scope.deniedResources).toEqual(["secret"]);
    expect(result.policy.mandatory.gatewayBypass).toBe("deny");
    expect(result.policy.mandatory.permissionExpansion).toBe("deny");
    expect(result.clamped.map((item) => item.field)).toEqual(expect.arrayContaining([
      "toolDecision", "limits.maxToolCalls", "requirements.sandboxRequired", "permissions.canWrite",
    ]));
  });

  it("treats malformed expiry as expired instead of granting an unbounded lifetime", () => {
    expect(isPolicyExpired({ expiresAt: "not-a-date" }, NOW)).toBe(true);
    expect(isPolicyExpired({ expiresAt: "2026-08-30T11:00:00.000Z" }, "not-a-date")).toBe(true);
  });

  it("strips a runtime policyHash before hashing the recompiled content", () => {
    const previous = compile();
    const nextRaw = compile({}, { now: "2026-08-30T10:01:00.000Z" });
    const { policy } = recompileWithoutExpansion(nextRaw, previous);
    const { policyHash, ...content } = policy;
    expect(policyHash).toBe(computePolicyHash(content));
  });
});

describe("draft and ancestry validation attack cases", () => {
  it("returns schema rejection instead of throwing on malformed arrays", () => {
    const malformed = {
      name: "x",
      task: "x",
      requestedTools: {},
      ttlSeconds: 60,
      parentAgentId: null,
      classification: { family: "analysis", domain: "d", subclass: "s" },
      proposedTraits: {},
      proposedRiskLevel: "low",
    };
    expect(() => validateAgentDraft({ draft: malformed, toolDescriptors: TOOLS, now: NOW })).not.toThrow();
    const result = validateAgentDraft({ draft: malformed, toolDescriptors: TOOLS, now: NOW });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("DRAFT_SCHEMA_INVALID");
  });

  it("uses the tightest parent/root depth and requires a trusted child count", () => {
    const parentPolicy = compile({
      limits: { maxGenerationDepth: 1, maxChildrenPerAgent: 0 },
      permissions: { canCreateChildren: true },
    }, {
      creatorEntitlements: {
        allowedTools: ["orders.search"],
        permissions: { canCreateChildren: true, canWrite: false, canSendExternalMessage: false, canExecuteCode: false },
      },
    });
    const parent = recordFor(parentPolicy);
    parent.traits = ["subagent_creator"];
    parent.generationDepth = 1;
    const draft: AgentDraft = {
      name: "child",
      task: "child task",
      requestedTools: ["orders.search"],
      ttlSeconds: 60,
      parentAgentId: parent.agentId,
      classification: { family: "analysis", domain: "finance", subclass: "orders" },
      proposedTraits: ["subagent_creator"],
      proposedRiskLevel: "low",
    };
    const result = validateAgentDraft({
      draft,
      toolDescriptors: TOOLS,
      parent: { record: parent, effective: parentPolicy },
      familyPermissions: { canCreateChildren: true },
      rootLimits: { maxGenerationDepth: 9, maxChildrenPerAgent: 9 },
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      "PARENT_DEPTH_EXCEEDED",
      "PARENT_CHILDREN_COUNT_REQUIRED",
    ]));
  });

  it("denies modification of the actor's ancestor", () => {
    expect(validateNoSelfModification({
      actorAgentId: "agt_child",
      targetAgentId: "agt_parent",
      ancestry: ["agt_parent", "agt_root"],
    })?.code).toBe("SELF_POLICY_MODIFICATION_DENIED");
  });

  it("does not let a root draft self-assign subagent_creator", () => {
    const draft: AgentDraft = {
      name: "root-orchestrator",
      task: "coordinate work",
      requestedTools: ["orders.search"],
      ttlSeconds: 60,
      parentAgentId: null,
      classification: { family: "orchestration", domain: "ops", subclass: "coordinator" },
      proposedTraits: ["subagent_creator"],
      proposedRiskLevel: "low",
    };
    const denied = validateAgentDraft({
      draft,
      toolDescriptors: TOOLS,
      familyPermissions: { canCreateChildren: true },
      now: NOW,
    });
    expect(denied.errors.map((error) => error.code)).toContain("SUBAGENT_CREATOR_ENTITLEMENT_REQUIRED");
    const allowed = validateAgentDraft({
      draft,
      toolDescriptors: TOOLS,
      familyPermissions: { canCreateChildren: true },
      creatorEntitlements: {
        allowedTools: ["orders.search"],
        permissions: { canCreateChildren: true },
      },
      now: NOW,
    });
    expect(allowed.valid).toBe(true);
  });
});

describe("manifest-to-registry binding", () => {
  it("rejects malformed signatures without throwing and binds the current registry hash", () => {
    const policy = compile();
    const record = recordFor(policy);
    const delta = { agentId: policy.agentId, inherits: [], instanceRules: {} };
    const manifest = buildManifest({
      agentId: policy.agentId,
      agentHash: computeAgentHash(record),
      policyHash: policy.policyHash,
      deltaHash: computePolicyDeltaHash(delta),
      compiledAt: policy.compiledAt,
      secret: SECRET,
    });
    expect(verifyEffectivePolicyIntegrity(policy, manifest, SECRET, record, delta)).toEqual({ ok: true });
    expect(verifyEffectivePolicyIntegrity(policy, manifest, SECRET, undefined, delta).reason).toBe("CURRENT_AGENT_REQUIRED");

    const movedTenant = { ...record, tenantId: "tenant_b" };
    expect(verifyEffectivePolicyIntegrity(policy, manifest, SECRET, movedTenant, delta).reason)
      .toBe("MANIFEST_AGENT_HASH_MISMATCH");

    const malformed = { ...manifest, signature: { injected: true } } as unknown as AgentPolicyManifest;
    expect(() => verifyManifestSignature(malformed, SECRET)).not.toThrow();
    expect(verifyManifestSignature(malformed, SECRET)).toBe(false);
    expect(verifyEffectivePolicyIntegrity(policy, malformed, SECRET, record, delta).reason)
      .toBe("MANIFEST_SIGNATURE_INVALID");
  });
});

describe("resource scope completeness", () => {
  it("fails closed when a constrained dimension or resource identity is omitted", () => {
    const scope = {
      allowedResourceSets: { region: ["eu-west-1"] },
      resourceRanges: { day: { from: "2026-08-01", to: "2026-08-31" } },
      deniedResources: ["secret.txt"],
    };
    expect(evaluateResourceScope(scope, {}).reason).toBe("RESOURCE_KEY_REQUIRED:region");
    expect(evaluateResourceScope(scope, {
      resourceKeys: { region: "eu-west-1" },
      rangeValues: { day: "2026-08-15" },
    }).reason).toBe("RESOURCE_IDENTIFIERS_REQUIRED");
    expect(evaluateResourceScope(scope, {
      resourceKeys: { region: "eu-west-1" },
      rangeValues: { day: "2026-08-15" },
      resources: ["public.txt"],
    })).toEqual({ allowed: true });
  });
});
