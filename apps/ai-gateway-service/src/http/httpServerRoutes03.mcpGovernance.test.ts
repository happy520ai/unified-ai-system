import { describe, expect, it, vi } from "vitest";

import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";

async function dispatch({
  body,
  governance,
  callResult,
}: {
  body: Record<string, unknown>;
  governance: Record<string, unknown> | null;
  callResult?: unknown;
}) {
  const response: Record<string, any> = {};
  const requestController = new AbortController();
  const callTool = vi.fn(async () => ({
    serverId: "ops",
    toolName: "create_ticket",
    result: callResult ?? { content: [] },
    externalEffect: { required: false, reservationFingerprint: null },
  }));
  const prepareToolCall = vi.fn(async () => ({
    serverId: "ops",
    toolName: "create_ticket",
    arguments: body.arguments ?? {},
    argumentsChars: 2,
    externalEffectRequired: false,
    targetFingerprint: "c".repeat(64),
    approvalReview: {
      reviewable: true,
      reviewedArguments: body.arguments ?? {},
      omittedArgumentKeys: [],
    },
  }));
  await dispatchHttpRoutes03({
    application: {
      agentGovernance: governance,
      mcpGatewayService: { callTool, prepareToolCall },
    },
    request: {
      method: "POST",
      headers: { "x-request-id": "request-mcp-1" },
      enterpriseIdentity: { tenantId: "tenant-a", userId: "owner-a", role: "operator" },
    },
    response,
    requestExecution: { signal: requestController.signal },
    requestId: "request-mcp-1",
    url: new URL("http://gateway.local/mcp/call"),
    startedAt: Date.now(),
    readCapabilityJson: async () => body,
    createOkEnvelope: (data: unknown) => ({ status: "success", data }),
    writeJson: (target: Record<string, any>, statusCode: number, payload: unknown) => {
      target.statusCode = statusCode;
      target.payload = payload;
    },
    writeCapabilityError: ({ response: target, error, fallbackCode }: Record<string, any>) => {
      target.statusCode = error?.statusCode ?? 422;
      target.payload = { status: "error", error: { code: error?.code ?? fallbackCode } };
    },
  } as any);
  return { response, callTool, prepareToolCall, requestController };
}

describe("POST /mcp/call Agent Governance switch", () => {
  it("cannot omit agentId while governance is enabled", async () => {
    const authorizeAgentExecution = vi.fn();
    const { response, callTool, prepareToolCall } = await dispatch({
      body: { server: "ops", tool: "create_ticket", arguments: { title: "x" } },
      governance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce: vi.fn(), enforceResult: vi.fn() },
      },
    });
    expect(response).toMatchObject({
      statusCode: 400,
      payload: { error: { code: "MCP_AGENT_ID_REQUIRED" } },
    });
    expect(authorizeAgentExecution).not.toHaveBeenCalled();
    expect(prepareToolCall).not.toHaveBeenCalled();
    expect(callTool).not.toHaveBeenCalled();
  });

  it("keeps the legacy route unchanged when governance is disabled", async () => {
    const body = { server: "ops", tool: "create_ticket", arguments: { title: "legacy" } };
    const { response, callTool, prepareToolCall } = await dispatch({ body, governance: null });
    expect(response.statusCode).toBe(200);
    expect(prepareToolCall).not.toHaveBeenCalled();
    expect(callTool).toHaveBeenCalledWith(
      { tenantId: "tenant-a", userId: "owner-a", role: "operator" },
      expect.objectContaining({
        server: "ops",
        tool: "create_ticket",
        arguments: body.arguments,
        signal: expect.anything(),
      }),
    );
  });

  it("returns approval_required without invoking the upstream", async () => {
    const releaseRun = vi.fn();
    const enforce = vi.fn(async (input: any) => {
      expect(input).toMatchObject({
        toolName: "mcp",
        context: { agentId: "agt-mcp", tenantId: "tenant-a", userId: "owner-a" },
        params: { serverName: "ops", toolName: "create_ticket", args: { title: "review" } },
        resourceContext: {
          resourceKeys: { serverName: "ops", toolName: "create_ticket" },
          resources: ["mcp://ops/create_ticket"],
        },
      });
      return { outcome: "approval_required", code: "TOOL_APPROVAL_REQUIRED", approvalId: "approval-1" };
    });
    const { response, callTool } = await dispatch({
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: { title: "review" } },
      governance: {
        service: {
          authorizeAgentExecution: vi.fn(async () => ({
            executionLease: {
              signal: new AbortController().signal,
              fingerprint: "a".repeat(64),
              assertActive: vi.fn(async () => true),
              release: releaseRun,
            },
          })),
        },
        toolProxy: { enforce, enforceResult: vi.fn() },
      },
    });
    expect(response).toMatchObject({
      statusCode: 202,
      payload: { data: { outcome: "approval_required", approvalId: "approval-1" } },
    });
    expect(callTool).not.toHaveBeenCalled();
    expect(releaseRun).toHaveBeenCalledOnce();
  });

  it("returns an HTTP envelope with recursive MCP result secret redaction", async () => {
    const effectivePolicy = {
      agentId: "agt-mcp",
      classification: { family: "analysis", domain: "operations", subclass: "operator" },
      traits: [],
      riskLevel: "medium",
      toolDecisions: { mcp: "allow" },
      grantedTools: ["mcp"],
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
        canWrite: true,
        canSendExternalMessage: true,
        canExecuteCode: false,
      },
      scope: {},
      expiresAt: "2099-01-01T00:00:00.000Z",
      lineage: [],
      policyHash: "sha256:http-mcp-policy",
      compiledAt: "2026-08-30T00:00:00.000Z",
    } as const;
    const service = {
      authorizeAgentExecution: vi.fn(async () => ({
        executionLease: {
          signal: new AbortController().signal,
          fingerprint: "a".repeat(64),
          assertActive: vi.fn(async () => true),
          release: vi.fn(),
        },
      })),
      expireAgents: vi.fn(async () => 0),
      getAgent: vi.fn(async () => ({ status: "ACTIVE" })),
      loadVerifiedPolicy: vi.fn(async () => ({ policy: effectivePolicy, manifest: {} })),
      emitAudit: vi.fn(async () => undefined),
      reserveUsage: vi.fn(async () => ({ allowed: true })),
      releaseUsage: vi.fn(async () => undefined),
      acquireToolExecutionLease: vi.fn(async () => ({ release: vi.fn() })),
      getUsage: vi.fn(async () => ({ toolCalls: 0, steps: 0, records: 0 })),
    };
    const { response } = await dispatch({
      body: { agentId: "agt-mcp", server: "ops", tool: "create_ticket", arguments: {} },
      governance: {
        service,
        toolProxy: createAgentGovernanceToolProxy({ service: service as never }),
      },
      callResult: {
        apiToken: "api-token-must-not-leak",
        message: "Bearer abcdefghijklmnop",
        nested: { private_key: "private-key-must-not-leak" },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.payload).toMatchObject({
      data: {
        result: {
          apiToken: "***REDACTED***",
          nested: { private_key: "***REDACTED***" },
        },
      },
    });
    const serialized = JSON.stringify(response.payload);
    expect(serialized).not.toContain("api-token-must-not-leak");
    expect(serialized).not.toContain("abcdefghijklmnop");
    expect(serialized).not.toContain("private-key-must-not-leak");
  });
});
