import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createAgentGovernanceToolProxy, computeArgumentsHash } from "../agent-governance/toolProxy.ts";
import { createAgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import { executeGovernedMcpCall } from "./governedMcpExecution.ts";
import { createMcpGatewayService, type McpGovernedServerConfig } from "./mcpGatewayService.ts";

const IDENTITY = {
  tenantId: "tenant-a",
  userId: "owner-a",
  role: "operator",
  permissions: ["workflow:run"],
};

function policy(decision: "allow" | "require_approval" = "allow", maxRecords?: number) {
  return {
    agentId: "agt-mcp",
    classification: { family: "analysis", domain: "operations", subclass: "operator" },
    traits: [],
    riskLevel: "medium",
    toolDecisions: { mcp: decision },
    grantedTools: ["mcp"],
    mandatory: {
      auditRequired: true,
      credentialsExposedToAgent: false,
      crossTenantAccess: "deny",
      selfPolicyModification: "deny",
      gatewayBypass: "deny",
      permissionExpansion: "deny",
    },
    limits: { maxToolCalls: 10, ...(maxRecords === undefined ? {} : { maxRecords }) },
    requirements: { auditRequired: true },
    permissions: {
      canCreateChildren: false,
      canWrite: true,
      canSendExternalMessage: true,
      canExecuteCode: false,
    },
    scope: {},
    expiresAt: "2099-01-01T00:00:00.000Z",
    lineage: [],
    policyHash: "sha256:mcp-policy",
    compiledAt: "2026-08-30T00:00:00.000Z",
  } as const;
}

function createUpstream({
  mutation = false,
  result,
  approvalReviewFields,
}: {
  mutation?: boolean;
  result?: unknown;
  approvalReviewFields?: Record<string, string[]>;
} = {}) {
  const callTool = vi.fn(async (
    _toolName: string,
    _args: Record<string, unknown>,
    _execution?: { signal?: AbortSignal },
  ) => (
    result ?? { content: [{ type: "text", text: "ok" }] }
  ));
  const config: McpGovernedServerConfig = {
    transport: "http",
    id: "ops",
    url: "https://mcp.example.test/mcp",
    allowedTools: ["create_ticket"],
    ...(mutation ? {} : { readOnlyTools: ["create_ticket"] }),
    allowedTenants: ["tenant-a"],
    allowedRoles: ["operator"],
    ...(approvalReviewFields ? { approvalReviewFields } : {}),
  };
  return {
    callTool,
    upstream: {
      config,
      client: {
        listTools: vi.fn(async () => [{ name: "create_ticket" }]),
        callTool,
        close: vi.fn(),
      },
    } as never,
  };
}

function createGovernance(effectivePolicy = policy()) {
  const runRelease = vi.fn();
  const toolRelease = vi.fn();
  const assertActive = vi.fn(async () => true as const);
  const service = {
    authorizeAgentExecution: vi.fn(async () => ({
      record: { status: "ACTIVE", tenantId: "tenant-a", ownerUserId: "owner-a" },
      policy: effectivePolicy,
      executionLease: {
        signal: new AbortController().signal,
        fingerprint: "a".repeat(64),
        assertActive,
        release: runRelease,
      },
    })),
    expireAgents: vi.fn(async () => 0),
    getAgent: vi.fn(async () => ({ status: "ACTIVE" })),
    loadVerifiedPolicy: vi.fn(async () => ({ policy: effectivePolicy, manifest: {} })),
    emitAudit: vi.fn(async () => undefined),
    reserveUsage: vi.fn(async () => ({ allowed: true })),
    releaseUsage: vi.fn(async () => undefined),
    acquireToolExecutionLease: vi.fn(async () => ({ release: toolRelease })),
    getUsage: vi.fn(async () => ({ toolCalls: 0, steps: 0, records: 0 })),
    findApprovedArguments: vi.fn(async (_input?: unknown): Promise<any> => null),
    consumeApprovedArguments: vi.fn(async (_input?: unknown): Promise<any> => null),
    createApproval: vi.fn(async (
      _agentId?: unknown,
      _toolName?: unknown,
      _args?: unknown,
      _tenantId?: unknown,
      _review?: unknown,
      _reason?: unknown,
    ): Promise<any> => ({ id: "approval-1" })),
  };
  return {
    service,
    toolProxy: createAgentGovernanceToolProxy({ service: service as never }),
    runRelease,
    toolRelease,
    assertActive,
  };
}

describe("governed reverse MCP execution", () => {
  it("stops a pre-aborted HTTP request before Agent authorization or MCP preparation", async () => {
    const { upstream, callTool } = createUpstream();
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance();
    const controller = new AbortController();
    controller.abort(Object.assign(new Error("client disconnected"), {
      code: "CLIENT_DISCONNECTED",
      statusCode: 499,
    }));

    await expect(executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: {} },
      signal: controller.signal,
    })).rejects.toMatchObject({ code: "CLIENT_DISCONNECTED", statusCode: 499 });
    expect(governance.service.authorizeAgentExecution).not.toHaveBeenCalled();
    expect(callTool).not.toHaveBeenCalled();
  });

  it("releases returned leases and stays pre-dispatch when HTTP cancellation lands during Tool Proxy admission", async () => {
    const { upstream, callTool } = createUpstream();
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance();
    const controller = new AbortController();
    const returnedToolRelease = vi.fn();
    let resolveAdmission!: (value: unknown) => void;
    governance.toolProxy.enforce = vi.fn(() => new Promise((resolve) => {
      resolveAdmission = resolve;
    })) as never;

    const pending = executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: {} },
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(governance.toolProxy.enforce).toHaveBeenCalledOnce());
    controller.abort(Object.assign(new Error("gateway deadline"), {
      code: "GATEWAY_DEADLINE_EXCEEDED",
      statusCode: 504,
    }));
    resolveAdmission({
      outcome: "allow",
      policy: policy(),
      executionLease: { release: returnedToolRelease },
    });

    await expect(pending).rejects.toMatchObject({ code: "GATEWAY_DEADLINE_EXCEEDED", statusCode: 504 });
    expect(callTool).not.toHaveBeenCalled();
    expect(returnedToolRelease).toHaveBeenCalledOnce();
    expect(governance.runRelease).toHaveBeenCalledOnce();
  });

  it("requires agentId and server-binds tenant, user and owner authorization", async () => {
    const { upstream, callTool } = createUpstream({
      approvalReviewFields: { create_ticket: ["channel", "recipient"] },
    });
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance();

    await expect(executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { server: "ops", tool: "create_ticket", arguments: { title: "safe" } },
    })).rejects.toMatchObject({ code: "MCP_AGENT_ID_REQUIRED", statusCode: 400 });
    expect(governance.service.authorizeAgentExecution).not.toHaveBeenCalled();
    expect(callTool).not.toHaveBeenCalled();

    await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: {
        agentId: "agt-mcp",
        server: "ops",
        tool: "create_ticket",
        arguments: { title: "safe" },
        tenantId: "attacker-tenant",
        userId: "attacker-user",
        ownerUserId: "attacker-owner",
      } as never,
      requestId: "request-1",
    });
    expect(governance.service.authorizeAgentExecution).toHaveBeenCalledWith("agt-mcp", {
      tenantId: "tenant-a",
      userId: "owner-a",
      permissions: ["workflow:run"],
      requestId: "request-1",
    });
    expect(callTool).toHaveBeenCalledOnce();
    expect(governance.runRelease).toHaveBeenCalledOnce();
    expect(governance.toolRelease).toHaveBeenCalledOnce();
  });

  it.each([
    ["cross-tenant", Object.assign(new Error("not found"), { code: "AGENT_NOT_FOUND", statusCode: 404 })],
    ["revoked", Object.assign(new Error("revoked"), { code: "AGENT_NOT_ACTIVE", statusCode: 403 })],
  ])("stops %s agents before upstream execution", async (_label, denial) => {
    const { upstream, callTool } = createUpstream();
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance();
    governance.service.authorizeAgentExecution.mockRejectedValueOnce(denial);

    await expect(executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: {} },
    })).rejects.toBe(denial);
    expect(callTool).not.toHaveBeenCalled();
  });

  it("locks approval parameters, uses the decrypted store copy once, and returns no raw arguments", async () => {
    const { upstream, callTool } = createUpstream({
      approvalReviewFields: { create_ticket: ["channel", "recipient"] },
    });
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance(policy("require_approval"));
    const original = {
      serverName: "ops",
      toolName: "create_ticket",
      args: { channel: "alerts", recipient: "opaque-recipient" },
    };
    const storedCopy = {
      serverName: "ops",
      toolName: "create_ticket",
      args: { channel: "alerts", recipient: "opaque-recipient" },
    };
    let approved = false;
    let consumed = false;
    let approvalCounter = 0;
    governance.service.findApprovedArguments.mockImplementation(async (input: any) => (
      approved && !consumed && computeArgumentsHash(input.args) === computeArgumentsHash(original)
        ? { approvalId: "approval-1" }
        : null
    ));
    governance.service.consumeApprovedArguments.mockImplementation(async () => {
      if (consumed) return null;
      consumed = true;
      return {
        approvalId: "approval-1",
        args: storedCopy,
        review: { schemaVersion: 1, reviewable: true, effectType: "mcp:upstream-tool-call", policyHash: "sha256:mcp-policy" },
      };
    });
    governance.service.createApproval.mockImplementation(async () => ({ id: `approval-${++approvalCounter}` }));

    const first = await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: original.args },
    });
    expect(first).toMatchObject({ outcome: "approval_required", approvalId: "approval-1" });
    expect(JSON.stringify(first)).not.toContain("opaque-recipient");
    expect(callTool).not.toHaveBeenCalled();
    expect(governance.service.createApproval.mock.calls[0][4]).toMatchObject({
      reviewable: true,
      effectType: "mcp:upstream-tool-call",
      mcp: {
        serverId: "ops",
        toolName: "create_ticket",
        target: "mcp://ops/create_ticket",
        targetFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        argumentsHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        argumentsBytes: expect.any(Number),
        externalEffectRequired: false,
        reviewedArguments: { channel: "alerts", recipient: "opaque-recipient" },
        omittedArgumentKeys: [],
      },
    });
    approved = true;

    const changed = await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: {
        agentId: "agt-mcp",
        server: "ops",
        tool: "create_ticket",
        arguments: { channel: "alerts", recipient: "changed" },
      },
    });
    expect(changed).toMatchObject({ outcome: "approval_required", approvalId: "approval-2" });
    expect(callTool).not.toHaveBeenCalled();

    const approvedResult = await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: original.args },
    });
    expect(approvedResult.outcome).toBe("executed");
    expect(callTool).toHaveBeenCalledWith(
      "create_ticket",
      storedCopy.args,
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(callTool.mock.calls[0][1]).toEqual(storedCopy.args);

    const replay = await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: original.args },
    });
    expect(replay).toMatchObject({ outcome: "approval_required", approvalId: "approval-3" });
    expect(callTool).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing review config", undefined, { title: "blind" }],
    ["nested reviewed value", { create_ticket: ["title"] }, { title: { nested: true } }],
    ["sensitive field", { create_ticket: ["credential"] }, { credential: "must-not-leak" }],
    ["secret-bearing scalar", { create_ticket: ["title"] }, { title: "Authorization: Bearer must-not-leak-value" }],
  ])("rejects %s instead of creating a blind approval", async (_label, approvalReviewFields, args) => {
    const { upstream, callTool } = createUpstream({ approvalReviewFields });
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance(policy("require_approval"));

    await expect(executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: args },
    })).rejects.toMatchObject({ code: "APPROVAL_REVIEW_UNAVAILABLE", statusCode: 403 });
    expect(governance.service.createApproval).not.toHaveBeenCalled();
    expect(callTool).not.toHaveBeenCalled();
  });

  it("allows a reviewable zero-argument MCP approval without field disclosure config", async () => {
    const { upstream, callTool } = createUpstream();
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance(policy("require_approval"));

    const result = await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: {} },
    });
    expect(result).toMatchObject({ outcome: "approval_required", approvalId: "approval-1" });
    expect(governance.service.createApproval.mock.calls[0][4]).toMatchObject({
      reviewable: true,
      mcp: { reviewedArguments: {}, omittedArgumentKeys: [], argumentsBytes: 2 },
    });
    expect(callTool).not.toHaveBeenCalled();
  });

  it("runs the real encrypted approval store as a one-shot MCP approval", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "governed-mcp-store-"));
    const { upstream, callTool } = createUpstream({
      approvalReviewFields: { create_ticket: ["channel", "recipient"] },
    });
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const service = createAgentGovernanceService({
      env: {
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "governed-mcp-integration-secret-0123456789",
        PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant-a",
      },
      dataDir,
    });
    const toolProxy = createAgentGovernanceToolProxy({ service });
    try {
      const agent = await service.generateAgent({
        name: "reverse-mcp-agent",
        task: "Call one reviewed MCP target",
        requestedTools: ["mcp"],
        ttlSeconds: 3600,
        parentAgentId: null,
      }, { ...IDENTITY, permissions: ["*"] });
      const request = {
        governance: { service, toolProxy },
        mcpGatewayService,
        identity: { ...IDENTITY, permissions: ["*"] },
        body: {
          agentId: agent.agentId,
          server: "ops",
          tool: "create_ticket",
          arguments: { channel: "alerts", recipient: "team-a" },
        },
      };

      const pending = await executeGovernedMcpCall(request);
      expect(pending).toMatchObject({ outcome: "approval_required", approvalId: expect.any(String) });
      expect(callTool).not.toHaveBeenCalled();
      await service.decideApproval(
        (pending as { approvalId: string }).approvalId,
        "approve",
        { ...IDENTITY, permissions: ["*"] },
      );

      const executed = await executeGovernedMcpCall(request);
      expect(executed.outcome).toBe("executed");
      expect(callTool).toHaveBeenCalledOnce();
      const replay = await executeGovernedMcpCall(request);
      expect(replay.outcome).toBe("approval_required");
      expect(callTool).toHaveBeenCalledOnce();
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("passes the run lease into the durable effect gate and fences a revoke before upstream", async () => {
    const { upstream, callTool } = createUpstream({ mutation: true });
    const reserve = vi.fn(async (input: any) => {
      await input.assertFence("reserve");
      return {
        reservationFingerprint: "0123456789abcdef",
        commit: vi.fn(async () => input.assertFence("commit")),
      };
    });
    const mcpGatewayService = createMcpGatewayService({
      upstreams: [upstream],
      externalEffectGate: { reserve, status: { enabled: true, mode: "sqlite" } } as never,
    });
    const governance = createGovernance();
    governance.assertActive
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(Object.assign(new Error("revoked"), { code: "AGENT_EXECUTION_FENCED" }));

    await expect(executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: { title: "x" } },
      externalEffect: { effectKeyHash: "b".repeat(64) },
    })).rejects.toMatchObject({ code: "AGENT_EXECUTION_FENCED" });
    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({
      fenceRequired: true,
      fenceFingerprint: "a".repeat(64),
      assertFence: expect.any(Function),
    }));
    expect(callTool).not.toHaveBeenCalled();
    expect(governance.runRelease).toHaveBeenCalledOnce();
    expect(governance.toolRelease).toHaveBeenCalledOnce();
  });

  it("marks a dispatched mutation outcome unknown when HTTP cancellation aborts the upstream call", async () => {
    const { upstream, callTool } = createUpstream({ mutation: true });
    const mcpGatewayService = createMcpGatewayService({
      upstreams: [upstream],
      externalEffectGate: {
        reserve: vi.fn(async () => ({
          reservationFingerprint: "aborted1234567890",
          commit: vi.fn(async () => undefined),
        })),
        status: { enabled: true, mode: "sqlite" },
      } as never,
    });
    const governance = createGovernance();
    const controller = new AbortController();
    callTool.mockImplementationOnce(async (_tool, _args, execution) => new Promise<Record<string, unknown>>((_resolve, reject) => {
      const onAbort = () => reject(execution?.signal?.reason);
      if (execution?.signal?.aborted) onAbort();
      else execution?.signal?.addEventListener("abort", onAbort, { once: true });
    }));

    const pending = executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: { title: "x" } },
      externalEffect: { effectKeyHash: "d".repeat(64) },
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(callTool).toHaveBeenCalledOnce());
    controller.abort(Object.assign(new Error("client disconnected after dispatch"), {
      code: "CLIENT_DISCONNECTED",
      statusCode: 499,
    }));

    await expect(pending).rejects.toMatchObject({
      code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
      outcomeUnknown: true,
      retryable: false,
      reservationFingerprint: "aborted1234567890",
    });
    expect(governance.runRelease).toHaveBeenCalledOnce();
    expect(governance.toolRelease).toHaveBeenCalledOnce();
  });

  it.each([
    ["result-enforcement", "result-enforcement"],
    ["lease-release", "lease-release"],
  ] as const)("marks a completed mutation unknown when %s fails", async (failure, expectedPhase) => {
    const { upstream, callTool } = createUpstream({ mutation: true });
    const mcpGatewayService = createMcpGatewayService({
      upstreams: [upstream],
      externalEffectGate: {
        reserve: vi.fn(async () => ({
          reservationFingerprint: "fedcba9876543210",
          commit: vi.fn(async () => undefined),
        })),
        status: { enabled: true, mode: "sqlite" },
      } as never,
    });
    const governance = createGovernance();
    if (failure === "result-enforcement") {
      governance.toolProxy.enforceResult = vi.fn(async () => {
        throw Object.assign(new Error("usage state unavailable"), { code: "USAGE_STATE_UNAVAILABLE" });
      }) as never;
    } else {
      governance.toolRelease.mockImplementationOnce(() => {
        throw new Error("tool lease release failed");
      });
    }

    await expect(executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: { title: "x" } },
      externalEffect: { effectKeyHash: "c".repeat(64) },
    })).rejects.toMatchObject({
      code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
      outcomeUnknown: true,
      retryable: false,
      reservationFingerprint: "fedcba9876543210",
      details: expect.objectContaining({
        outcomeUnknown: true,
        phase: expectedPhase,
        reconciliation: expect.any(String),
      }),
    });
    expect(callTool).toHaveBeenCalledOnce();
  });

  it("fails closed on maxRecords when MCP has no trusted result descriptor", async () => {
    const rawResult = { content: [{ type: "text", text: "model-visible" }] };
    const { upstream, callTool } = createUpstream({ result: rawResult });
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance(policy("allow", 1));

    const result = await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: {} },
    });
    expect(callTool).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      outcome: "executed",
      result: { status: "denied", code: "RECORD_METER_DESCRIPTOR_REQUIRED" },
      governance: { resultVerdict: "replace", resultCode: "RECORD_METER_DESCRIPTOR_REQUIRED" },
    });
    expect(JSON.stringify(result)).not.toContain("model-visible");
  });

  it("redacts credential fields and bearer text before an MCP result reaches the caller", async () => {
    const rawResult = {
      apiToken: "api-token-must-not-leak",
      message: "Authorization: Bearer abcdefghijklmnop",
      nested: { private_key: "private-key-must-not-leak" },
    };
    const { upstream } = createUpstream({ result: rawResult });
    const mcpGatewayService = createMcpGatewayService({ upstreams: [upstream] });
    const governance = createGovernance(policy("allow"));

    const result = await executeGovernedMcpCall({
      governance: governance as never,
      mcpGatewayService,
      identity: IDENTITY,
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: {} },
    });
    expect(result).toMatchObject({
      outcome: "executed",
      result: {
        apiToken: "***REDACTED***",
        nested: { private_key: "***REDACTED***" },
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("api-token-must-not-leak");
    expect(serialized).not.toContain("abcdefghijklmnop");
    expect(serialized).not.toContain("private-key-must-not-leak");
    expect(serialized).toContain("***REDACTED***");
  });
});
