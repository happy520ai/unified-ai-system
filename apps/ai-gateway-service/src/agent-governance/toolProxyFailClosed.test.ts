import { describe, expect, it, vi } from "vitest";
import { createAgentGovernanceToolProxy } from "./toolProxy.ts";
import { freezeWorkforceRoleExecutionProfile } from "../workforce/workforceRoleExecutionProfile.ts";

function workforceResult() {
  const profile = freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required", profileId: "counter-fixture",
    maxTotalRequests: 1, maxConcurrentRoles: 1, bindings: [{ roleId: "ceo", employeeId: "employee-ceo", providerId: "fixture", modelId: "fixture-model",
      maxRequests: 1, maxInputTokens: 4096, maxOutputTokens: 1024, timeoutMs: 5000 }] });
  const receipt = () => ({ version: 1, level: "gateway-provider-operation", status: "succeeded", executionMode: "fake", gatewayRequestId: "req_fixture",
    providerId: "fixture", modelId: "fixture-model", providerCallAttempted: true, inputTokens: null, outputTokens: 0,
    totalTokens: 23, estimatedCostUsd: null, errorCode: null });
  const executionId = `wf-scope-${"a".repeat(64)}`;
  return { success: true, phase: "PhaseC001", mode: "controlled-workforce-execution", planId: "plan-fixture", executionId, agentRunId: "agr_fixture",
    roleResults: { ceo: { workforceContribution: { version: 1, roleId: "ceo", employeeId: "employee-ceo", governedAgentId: "agt_proxy",
      agentRunId: "agr_fixture", executionId, taskId: "task-fixture", planId: "plan-fixture", planDigest: "b".repeat(64), profileHash: profile.profileHash,
      contributionText: "One actual contribution", receipt: receipt() } } },
    roleExecution: { profile, receipts: [{ roleId: "ceo", employeeId: "employee-ceo", taskId: "task-fixture", receipt: receipt() }] },
    metadata: { inputTokens: 123, accessToken: "ARBITRARY_TOKEN_CANARY" },
  };
}

function policy(overrides: Record<string, unknown> = {}) {
  return {
    agentId: "agt_proxy",
    classification: { family: "analysis", domain: "general", subclass: "reader" },
    traits: [],
    riskLevel: "low",
    toolDecisions: Object.assign(Object.create(null), { file_read: "allow" }),
    grantedTools: ["file_read"],
    mandatory: {
      auditRequired: true,
      credentialsExposedToAgent: false,
      crossTenantAccess: "deny",
      selfPolicyModification: "deny",
      gatewayBypass: "deny",
      permissionExpansion: "deny",
    },
    limits: { maxToolCalls: 5 },
    requirements: { auditRequired: true },
    permissions: {
      canCreateChildren: false,
      canWrite: false,
      canSendExternalMessage: false,
      canExecuteCode: false,
    },
    scope: {},
    expiresAt: "2099-01-01T00:00:00.000Z",
    lineage: [],
    policyHash: "sha256:test",
    compiledAt: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

function serviceFor(effectivePolicy: ReturnType<typeof policy>, emitAudit = vi.fn(async () => undefined)) {
  return {
    expireAgents: vi.fn(async () => 0),
    getAgent: vi.fn(async () => ({ status: "ACTIVE" })),
    loadVerifiedPolicy: vi.fn(async () => ({ policy: effectivePolicy, manifest: {} })),
    emitAudit,
    reserveUsage: vi.fn(async () => ({ allowed: true })),
    releaseUsage: vi.fn(async () => undefined),
    acquireToolExecutionLease: vi.fn(async () => ({ release: vi.fn() })),
    getUsage: vi.fn(async () => ({ toolCalls: 0, steps: 0, records: 0 })),
    findApprovedArguments: vi.fn(async () => null),
    consumeApprovedArguments: vi.fn(async () => null),
    createApproval: vi.fn(async () => ({ id: "apr_test" })),
  } as never;
}

describe("Agent Governance Tool Proxy fail-closed runtime", () => {
  it("preserves validated Workforce receipt counters and bound token budgets only at the server DTO paths", async () => {
    const selectedPolicy = policy(); const proxy = createAgentGovernanceToolProxy({ service: serviceFor(selectedPolicy) });
    const verdict = await proxy.enforceResult({ context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "workforce_execute", policy: selectedPolicy as never, result: workforceResult() });
    const result = verdict.result as any;
    for (const receipt of [result.roleResults.ceo.workforceContribution.receipt, result.roleExecution.receipts[0].receipt]) {
      expect(receipt).toMatchObject({ inputTokens: null, outputTokens: 0, totalTokens: 23 });
    }
    expect(result.roleExecution.profile.bindings[0]).toMatchObject({ maxInputTokens: 4096, maxOutputTokens: 1024 });
    expect(result.metadata).toMatchObject({ inputTokens: "***REDACTED***", accessToken: "***REDACTED***" });
    expect(JSON.stringify(result)).not.toContain("ARBITRARY_TOKEN_CANARY");
  });

  it("does not exempt other tools, arbitrary token paths, string counters, forged bindings or getters", async () => {
    const selectedPolicy = policy(); const proxy = createAgentGovernanceToolProxy({ service: serviceFor(selectedPolicy) });
    const getter = vi.fn(() => "ACCESSOR_TOKEN_CANARY");
    const cases = [
      { toolName: "file_read", mutate: (_result: any) => {} },
      { toolName: "workforce_execute", mutate: (result: any) => { result.roleResults.ceo.workforceContribution.receipt.inputTokens = "123"; } },
      { toolName: "workforce_execute", mutate: (result: any) => { result.roleResults.ceo.workforceContribution.employeeId = "other-employee"; } },
      { toolName: "workforce_execute", mutate: (result: any) => { result.roleResults.ceo.workforceContribution.receipt.providerCallAttempted = false; } },
      { toolName: "workforce_execute", mutate: (result: any) => { result.roleResults.ceo.workforceContribution.receipt.gatewayRequestId = null; } },
      { toolName: "workforce_execute", mutate: (result: any) => { result.roleExecution.profile = { ...result.roleExecution.profile, profileHash: `sha256:${"f".repeat(64)}` }; } },
      { toolName: "workforce_execute", mutate: (result: any) => { Object.defineProperty(result.roleResults.ceo.workforceContribution.receipt, "inputTokens", { enumerable: true, get: getter }); } },
    ];
    for (const entry of cases) {
      const source = workforceResult(); entry.mutate(source);
      const verdict = await proxy.enforceResult({ context: { agentId: "agt_proxy", tenantId: "tenant_a" }, toolName: entry.toolName,
        policy: selectedPolicy as never, result: source });
      const receipt = (verdict.result as any).roleResults.ceo.workforceContribution.receipt;
      expect(receipt.inputTokens === undefined || receipt.inputTokens === "***REDACTED***").toBe(true);
      expect(JSON.stringify(verdict.result)).not.toContain("ACCESSOR_TOKEN_CANARY");
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("keeps explicit deniedOutputFields authoritative over recognized Workforce token counters", async () => {
    const selectedPolicy = policy({ scope: { deniedOutputFields: ["inputTokens", "totalTokens"] } });
    const proxy = createAgentGovernanceToolProxy({ service: serviceFor(selectedPolicy) });
    const verdict = await proxy.enforceResult({ context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "workforce_execute", policy: selectedPolicy as never, result: workforceResult() });
    const result = verdict.result as any;
    expect(result.roleResults.ceo.workforceContribution.receipt).toMatchObject({ inputTokens: "***REDACTED***", outputTokens: 0, totalTokens: "***REDACTED***" });
    expect(result.roleExecution.profile.bindings[0]).toMatchObject({ maxInputTokens: "***REDACTED***", maxOutputTokens: 1024 });
  });

  it("denies execution when a mandatory audit event cannot persist", async () => {
    const reserveUsage = vi.fn(async () => ({ allowed: true }));
    const service = serviceFor(policy(), vi.fn(async () => { throw new Error("disk unavailable"); })) as never;
    (service as { reserveUsage: typeof reserveUsage }).reserveUsage = reserveUsage;
    const proxy = createAgentGovernanceToolProxy({ service });
    const verdict = await proxy.enforce({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "README.md" },
    });
    expect(verdict).toMatchObject({ outcome: "deny", code: "GOVERNANCE_AUDIT_REQUIRED" });
    expect(reserveUsage).not.toHaveBeenCalled();
  });

  it("requires every policy-constrained resource dimension", async () => {
    const service = serviceFor(policy({
      scope: {
        allowedResourceSets: { region: ["eu-west-1"] },
        resourceRanges: { day: { from: "2026-08-01", to: "2026-08-31" } },
      },
    }));
    const proxy = createAgentGovernanceToolProxy({ service });
    const missing = await proxy.enforce({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "README.md" },
    });
    expect(missing).toMatchObject({ outcome: "deny", code: "TOOL_SCOPE_DENIED" });
    expect(missing.reason).toContain("RESOURCE_KEY_REQUIRED:region");

    const allowed = await proxy.enforce({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "README.md", region: "eu-west-1", day: "2026-08-15" },
    });
    expect(allowed.outcome).toBe("allow");
  });

  it("denies inherited Object prototype names even if a malformed policy is loaded", async () => {
    const malformed = policy({ toolDecisions: {}, grantedTools: ["constructor"] });
    const proxy = createAgentGovernanceToolProxy({ service: serviceFor(malformed) });
    const verdict = await proxy.enforce({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "constructor",
      params: {},
    });
    expect(verdict).toMatchObject({ outcome: "deny", code: "TOOL_DENIED_BY_POLICY" });
  });

  it("upgrades allow to reviewable approval when the effective policy requires approval", async () => {
    const service = serviceFor(policy({
      requirements: { auditRequired: true, approvalRequired: true },
    }));
    const proxy = createAgentGovernanceToolProxy({ service });
    const unavailable = await proxy.enforce({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "README.md" },
    });
    expect(unavailable).toMatchObject({ outcome: "deny", code: "APPROVAL_REVIEW_UNAVAILABLE" });

    const reviewable = await proxy.enforce({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "file_read",
      params: { path: "README.md" },
      resourceContext: {
        approvalReview: {
          schemaVersion: 1,
          reviewable: true,
          effectType: "file_read",
          repository: { displayName: "workspace", fingerprint: `sha256:${"a".repeat(64)}` },
        },
      },
    });
    expect(reviewable).toMatchObject({ outcome: "approval_required", approvalId: "apr_test" });
  });

  it("fails closed without a server sandbox attestation when the policy requires one", async () => {
    const service = serviceFor(policy({
      requirements: { auditRequired: true, sandboxRequired: true },
    }));
    const proxy = createAgentGovernanceToolProxy({ service });
    const context = { agentId: "agt_proxy", tenantId: "tenant_a", requestId: "req_sandbox_1" };
    const missing = await proxy.enforce({
      context,
      toolName: "file_read",
      params: { path: "README.md" },
    });
    expect(missing).toMatchObject({ outcome: "deny", code: "GOVERNANCE_SANDBOX_REQUIRED" });

    const attestation = proxy.mintSandboxAttestation({
      context,
      toolName: "file_read",
      isolation: "read-only",
    });
    const attested = await proxy.enforce({
      context,
      toolName: "file_read",
      params: { path: "README.md" },
      resourceContext: {
        sandboxAttestation: attestation,
      },
    });
    expect(attested.outcome).toBe("allow");

    const replayed = await proxy.enforce({
      context,
      toolName: "file_read",
      params: { path: "README.md" },
      resourceContext: { sandboxAttestation: attestation },
    });
    expect(replayed).toMatchObject({ outcome: "deny", code: "GOVERNANCE_SANDBOX_REQUIRED" });

    const forged = await proxy.enforce({
      context,
      toolName: "file_read",
      params: { path: "README.md" },
      resourceContext: {
        sandboxAttestation: { kind: "agent-governance-sandbox-attestation" },
      },
    });
    expect(forged).toMatchObject({ outcome: "deny", code: "GOVERNANCE_SANDBOX_REQUIRED" });

    const wrongRequestAttestation = proxy.mintSandboxAttestation({
      context,
      toolName: "file_read",
      isolation: "read-only",
    });
    const wrongRequest = await proxy.enforce({
      context: { ...context, requestId: "req_sandbox_2" },
      toolName: "file_read",
      params: { path: "README.md" },
      resourceContext: { sandboxAttestation: wrongRequestAttestation },
    });
    expect(wrongRequest).toMatchObject({ outcome: "deny", code: "GOVERNANCE_SANDBOX_REQUIRED" });
  });

  it("requires full sandbox isolation for write and unknown tools", async () => {
    const writePolicy = policy({
      toolDecisions: Object.assign(Object.create(null), { file_write: "allow", custom_mutation: "allow" }),
      grantedTools: ["file_write", "custom_mutation"],
      permissions: { canWrite: true },
      requirements: { auditRequired: true, sandboxRequired: true },
    });
    const proxy = createAgentGovernanceToolProxy({ service: serviceFor(writePolicy) });
    const context = { agentId: "agt_proxy", tenantId: "tenant_a", requestId: "req_write_sandbox" };
    for (const toolName of ["file_write", "custom_mutation"]) {
      const readOnly = proxy.mintSandboxAttestation({ context, toolName, isolation: "read-only" });
      await expect(proxy.enforce({
        context,
        toolName,
        params: { path: "README.md" },
        resourceContext: { sandboxAttestation: readOnly },
      })).resolves.toMatchObject({ outcome: "deny", code: "GOVERNANCE_SANDBOX_REQUIRED" });

      const full = proxy.mintSandboxAttestation({ context, toolName, isolation: "full" });
      await expect(proxy.enforce({
        context,
        toolName,
        params: { path: "README.md" },
        resourceContext: { sandboxAttestation: full },
      })).resolves.toMatchObject({ outcome: "allow" });
    }
  });

  it("replaces over-deep result subtrees instead of returning unvisited secrets", async () => {
    const service = serviceFor(policy());
    const proxy = createAgentGovernanceToolProxy({ service });
    let nested: Record<string, unknown> = { token: "canary-secret-value" };
    for (let depth = 0; depth < 15; depth += 1) nested = { child: nested };

    const verdict = await proxy.enforceResult({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "file_read",
      policy: policy() as never,
      result: nested,
    });
    expect(JSON.stringify(verdict.result)).not.toContain("canary-secret-value");
    expect(JSON.stringify(verdict.result)).toContain("governed output depth limit reached");
  });

  it("redacts unsafe result keys without invoking accessors or changing the output prototype", async () => {
    const proxy = createAgentGovernanceToolProxy({ service: serviceFor(policy()) });
    const result = Object.create(null) as Record<string, unknown>;
    result.status = "success";
    result[`Authorization: Bearer ${"K".repeat(24)}`] = "RESULT_KEY_CANARY";
    Object.defineProperty(result, "constructor", { value: "CONSTRUCTOR_CANARY", enumerable: true });
    Object.defineProperty(result, "prototype", { value: "PROTOTYPE_CANARY", enumerable: true });
    Object.defineProperty(result, "__proto__", {
      value: { polluted: "PROTO_CANARY" },
      enumerable: true,
    });
    Object.defineProperty(result, "accessor", {
      get() { throw new Error("ACCESSOR_CANARY"); },
      enumerable: true,
    });
    Object.defineProperty(result, "toJSON", {
      value: () => ({ leaked: "TOJSON_RESULT_CANARY" }),
      enumerable: true,
    });

    const verdict = await proxy.enforceResult({
      context: { agentId: "agt_proxy", tenantId: "tenant_a" },
      toolName: "file_read",
      policy: policy() as never,
      result,
    });
    const serialized = JSON.stringify(verdict.result);
    expect(serialized).not.toMatch(/RESULT_KEY_CANARY|CONSTRUCTOR_CANARY|PROTOTYPE_CANARY|PROTO_CANARY|ACCESSOR_CANARY|TOJSON_RESULT_CANARY/u);
    expect(serialized).not.toContain("K".repeat(24));
    expect(serialized).toContain("[redacted-key-");
    expect(Object.getPrototypeOf(verdict.result)).toBeNull();
    expect(Object.hasOwn(verdict.result as object, "__proto__")).toBe(false);
    expect(Object.hasOwn(verdict.result as object, "toJSON")).toBe(false);
  });
});
