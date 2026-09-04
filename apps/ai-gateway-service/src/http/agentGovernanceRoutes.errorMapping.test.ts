import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { dispatchAgentGovernanceRoutes } from "./agentGovernanceRoutes.ts";

const HUMAN_IDENTITY = {
  tenantId: "tenant-a",
  userId: "operator-a",
  role: "admin",
  permissions: ["*"],
};

function responseRecorder() {
  const response = new EventEmitter() as EventEmitter & Record<string, any>;
  response.statusCode = null;
  response.body = null;
  response.writeHead = (statusCode: number) => { response.statusCode = statusCode; };
  response.end = (body?: unknown) => { response.body = body ? JSON.parse(String(body)) : null; };
  return response;
}

async function dispatch(
  path: string,
  method: "GET" | "POST",
  service: Record<string, any>,
  body: unknown = {},
  identity: Record<string, unknown> = HUMAN_IDENTITY,
) {
  const request = Readable.from(method === "POST" ? [Buffer.from(JSON.stringify(body))] : []) as any;
  request.method = method;
  request.enterpriseIdentity = identity;
  const response = responseRecorder();
  await dispatchAgentGovernanceRoutes({
    request,
    response: response as any,
    startedAt: Date.now(),
    url: new URL(path, "http://gateway.local"),
    application: { agentGovernance: { service: service as any } },
    writeServiceLog: vi.fn(),
    requestId: "governance-error-map-1",
  });
  return response;
}

describe("Agent Governance HTTP error mapping", () => {
  it("maps service not-found errors to HTTP 404", async () => {
    const response = await dispatch("/v1/approvals/decide", "POST", {
      decideApproval: vi.fn(async () => { throw Object.assign(new Error("Approval not found."), { name: "NotFound" }); }),
    }, { approvalId: "appr_missing", decision: "approve" });
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toMatchObject({ code: "NotFound", category: "governance" });
  });

  it("maps stale lifecycle decisions to HTTP 409", async () => {
    const response = await dispatch("/v1/approvals/decide", "POST", {
      decideApproval: vi.fn(async () => {
        throw Object.assign(new Error("Approval is stale."), { code: "APPROVAL_STALE" });
      }),
    }, { approvalId: "appr_stale", decision: "approve" });
    expect(response.statusCode).toBe(409);
    expect(response.body.error).toMatchObject({ code: "APPROVAL_STALE", category: "governance" });
  });

  it("passes only the trusted identity Agent actor into governance context", async () => {
    const guardedRevoke = vi.fn(async (_agentId, _input, context) => {
      expect(context.actorAgentId).toBe("agt_authenticated_actor");
      throw Object.assign(new Error("self lifecycle mutation denied"), {
        code: "SELF_LIFECYCLE_MODIFICATION_DENIED",
        statusCode: 403,
      });
    });
    const guarded = await dispatch(
      "/v1/agents/agt_authenticated_actor/revoke",
      "POST",
      { revokeAgent: guardedRevoke },
      { cascade: true, actorAgentId: "agt_body_spoof" },
      { ...HUMAN_IDENTITY, actorAgentId: "agt_authenticated_actor" },
    );
    expect(guarded.statusCode).toBe(403);
    expect(guarded.body.error).toMatchObject({
      code: "SELF_LIFECYCLE_MODIFICATION_DENIED",
      category: "authorization",
    });

    const humanRevoke = vi.fn(async (_agentId, _input, context) => {
      expect(context).not.toHaveProperty("actorAgentId");
      return { revoked: ["agt_target"] };
    });
    const human = await dispatch(
      "/v1/agents/agt_target/revoke",
      "POST",
      { revokeAgent: humanRevoke },
      { cascade: true, actorAgentId: "agt_body_spoof" },
    );
    expect(human.statusCode).toBe(200);
    expect(humanRevoke).toHaveBeenCalledOnce();
  });

  it("marks canonical Agent generation recovery as unknown and never exposes raw recovery details", async () => {
    const response = await dispatch("/v1/agents/generate", "POST", {
      generateAgent: vi.fn(async () => {
        throw Object.assign(new Error("sensitive persistence path must not escape"), {
          code: "AGENT_GENERATION_RECOVERY_REQUIRED",
          agentId: "agt_recovery_fixture",
          recoveryError: "E:/private/governance/agent-generation.journal.json",
        });
      }),
    }, {
      name: "recovery-fixture",
      task: "read one report",
      requestedTools: ["file_read"],
      ttlSeconds: 3_600,
    });

    expect(response.statusCode).toBe(503);
    expect(response.body.error).toEqual({
      code: "AGENT_GENERATION_RECOVERY_REQUIRED",
      message: "Agent generation may have committed; reconcile the Agent before issuing another generation request.",
      category: "governance",
      retryable: false,
      details: {
        outcomeUnknown: true,
        retrySafe: false,
        reconciliation: {
          required: true,
          operation: "agent-generation",
          agentId: "agt_recovery_fixture",
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/sensitive persistence|private\/governance|recoveryError/iu);
  });

  it("omits a malformed recovery Agent identity from reconciliation metadata", async () => {
    const response = await dispatch("/v1/agents/generate", "POST", {
      generateAgent: vi.fn(async () => {
        throw Object.assign(new Error("unknown generation outcome"), {
          code: "AGENT_GENERATION_RECOVERY_REQUIRED",
          agentId: "../../escaped-agent",
        });
      }),
    }, { name: "fixture", task: "read", requestedTools: ["file_read"], ttlSeconds: 3_600 });

    expect(response.body.error.details.reconciliation).toEqual({
      required: true,
      operation: "agent-generation",
    });
  });

  it("wraps policy validation failures in ContractMetadata instead of returning a raw details array", async () => {
    const response = await dispatch("/v1/policies", "POST", {
      createPolicyVersion: vi.fn(async () => {
        throw Object.assign(new Error("invalid policy"), {
          name: "PolicyContentInvalid",
          errors: [{
            code: "POLICY_LIMIT_INVALID",
            message: "maxSteps is invalid",
            secret: "must-not-leak",
          }],
        });
      }),
    }, {
      policyKey: "task:reporting",
      version: 1,
      policyType: "task",
      scopeKey: "reporting",
      content: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatchObject({
      category: "validation",
      details: {
        validationErrors: [{ code: "POLICY_LIMIT_INVALID", message: "maxSteps is invalid" }],
      },
    });
    expect(JSON.stringify(response.body.error.details)).not.toContain("must-not-leak");
  });

  it.each([
    ["POLICY_ACTIVATION_RECOVERY_REQUIRED", "PolicyActivationRecoveryError", 503, "governance"],
    ["POLICY_ACTIVATION_TRANSACTION_FAILED", "PolicyActivationTransactionFailed", 500, "internal"],
  ])("maps %s to its operational HTTP class", async (code, name, status, category) => {
    const response = await dispatch("/v1/policies/list", "GET", {
      listPolicies: vi.fn(async () => { throw Object.assign(new Error("control-plane failure"), { code, name }); }),
    });
    expect(response.statusCode).toBe(status);
    expect(response.body.error).toMatchObject({ code, category });
  });
});
