import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { dispatchAgentGovernanceRoutes } from "./agentGovernanceRoutes.ts";

function responseRecorder() {
  const response = new EventEmitter() as EventEmitter & Record<string, any>;
  response.statusCode = null;
  response.body = null;
  response.writeHead = (statusCode: number) => { response.statusCode = statusCode; };
  response.end = (body?: unknown) => { response.body = body ? JSON.parse(String(body)) : null; };
  return response;
}

async function dispatch(path: string, method: "GET" | "POST", service: Record<string, any>, body: unknown = {}) {
  const request = Readable.from(method === "POST" ? [Buffer.from(JSON.stringify(body))] : []) as any;
  request.method = method;
  request.enterpriseIdentity = {
    tenantId: "tenant-a",
    userId: "operator-a",
    role: "admin",
    permissions: ["*"],
  };
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
    expect(response.body.error).toMatchObject({ code: "NotFound", category: "not_found" });
  });

  it("maps stale lifecycle decisions to HTTP 409", async () => {
    const response = await dispatch("/v1/approvals/decide", "POST", {
      decideApproval: vi.fn(async () => {
        throw Object.assign(new Error("Approval is stale."), { code: "APPROVAL_STALE" });
      }),
    }, { approvalId: "appr_stale", decision: "approve" });
    expect(response.statusCode).toBe(409);
    expect(response.body.error).toMatchObject({ code: "APPROVAL_STALE", category: "conflict" });
  });

  it.each([
    ["POLICY_ACTIVATION_RECOVERY_REQUIRED", "PolicyActivationRecoveryError", 503, "availability"],
    ["POLICY_ACTIVATION_TRANSACTION_FAILED", "PolicyActivationTransactionFailed", 500, "integrity"],
  ])("maps %s to its operational HTTP class", async (code, name, status, category) => {
    const response = await dispatch("/v1/policies/list", "GET", {
      listPolicies: vi.fn(async () => { throw Object.assign(new Error("control-plane failure"), { code, name }); }),
    });
    expect(response.statusCode).toBe(status);
    expect(response.body.error).toMatchObject({ code, category });
  });
});
