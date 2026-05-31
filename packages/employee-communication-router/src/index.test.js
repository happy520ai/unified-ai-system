import { describe, it, expect } from "vitest";
import {
  registerConnector,
  unregisterConnector,
  listRegisteredConnectors,
  resolveRoutingTargets,
  routeToExternal,
  routeFromExternal,
  getRouterHealth,
} from "./index.js";

describe("employee-communication-router", () => {
  const mockEnvelope = {
    messageId: "msg-1",
    threadId: "thread-1",
    fromEmployeeId: "emp-1",
    toEmployeeIds: ["emp-2"],
    ccEmployeeIds: [],
    messageType: "ask",
    intent: "request_review",
    title: "Test",
    body: "Hello",
    taskRef: null,
    evidenceRef: null,
    requiresResponse: true,
    responseDeadlineMs: 3600000,
    riskLevel: "low",
    dryRunOnly: true,
    createdAt: new Date().toISOString(),
  };

  it("reports health with zero connectors", () => {
    const h = getRouterHealth();
    expect(h.status).toBe("ready");
    expect(h.connectorCount).toBe(0);
  });

  it("registers and lists connectors", () => {
    const mock = { sendMessage: async () => ({ delivered: true }) };
    registerConnector("test-conn", mock);
    const list = listRegisteredConnectors();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((c) => c.connectorId === "test-conn")).toBe(true);
    unregisterConnector("test-conn");
  });

  it("resolves routing targets from envelope", () => {
    const result = resolveRoutingTargets(mockEnvelope, {
      "emp-2": { connectorId: "feishu", targetId: "ou_xxx" },
    });
    expect(result.valid).toBe(true);
    expect(result.targets.length).toBe(1);
    expect(result.targets[0].connectorId).toBe("feishu");
  });

  it("returns unmapped employees when no mapping exists", () => {
    const result = resolveRoutingTargets(mockEnvelope, {});
    expect(result.valid).toBe(false);
    expect(result.unmappedEmployees).toContain("emp-2");
  });

  it("routes to external in dry-run mode", async () => {
    registerConnector("dry-test", {
      sendMessage: async () => ({ delivered: false, dryRun: true }),
    });
    const results = await routeToExternal(mockEnvelope, {
      employeeTargetMap: {
        "emp-2": { connectorId: "dry-test", targetId: "t1" },
      },
      dryRun: true,
    });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe("dry-run");
    unregisterConnector("dry-test");
  });

  it("routes from external to internal envelope", () => {
    const result = routeFromExternal(
      { connectorId: "feishu", externalUserId: "ou_123", text: "hi" },
      { ou_123: { employeeId: "emp-ext-1", routeTo: ["emp-1"] } }
    );
    expect(result.accepted).toBe(true);
    expect(result.envelope.fromEmployeeId).toBe("emp-ext-1");
    expect(result.envelope.body).toBe("hi");
  });

  it("rejects external message without mapping", () => {
    const result = routeFromExternal(
      { connectorId: "feishu", externalUserId: "unknown", text: "hi" },
      {}
    );
    expect(result.accepted).toBe(false);
    expect(result.error).toBe("no_internal_employee_mapping");
  });
});
