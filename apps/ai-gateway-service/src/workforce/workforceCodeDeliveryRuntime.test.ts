import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAgentGovernanceToolProxy, readWorkforceCodeDeliveryToolProxy } from "../agent-governance/toolProxy.ts";
import { createWorkforceCodeDeliveryFactory, isWorkforceCodeDeliveryFactory,
  preflightWorkforceCodeDelivery, runWorkforceCodeDelivery, consumeWorkforceSnapshotCapability } from "./workforceCodeDeliveryRuntime.ts";
import { assertWorkforceCodeTaskFence, executeWorkforceDag } from "./workforceDagExecutor.ts";
import { createToolRiskCatalog } from "../agent-governance/toolRiskCatalog.ts";

describe("code delivery implementation provenance", () => {
  it("expires the genuine task capability after callback settlement and rejects other bindings or copied callbacks", async () => {
    const agentFence = { assertActive: vi.fn(async () => true) };
    const context = { executionId: "execution", governedAgentId: "agt_fixture", agentRunId: "agr_fixture" };
    const taskQueue = { claimTask: async () => ({ claimToken: "claim", claim: { fencingToken: "fence" } }),
      updateTaskStatus: async () => {}, assertTaskClaimActive: vi.fn(async () => true), completeTask: async () => {} };
    const expected = { executionId: "execution", agentId: "agt_fixture", agentRunId: "agr_fixture", taskId: "task", roleId: "ceo", agentFence };
    let captured: unknown;
    await executeWorkforceDag({ tasks: [{ queueTaskId: "task", roleId: "ceo" }], taskQueue, context, agentExecutionFence: agentFence,
      executeRole: async (_role, taskContext) => {
        captured = taskContext.externalEffectFence;
        for (const key of ["executionId", "agentId", "agentRunId", "taskId", "roleId", "agentFence"]) {
          await expect(assertWorkforceCodeTaskFence(captured, { ...expected, [key]: key === "agentFence" ? {} : "wrong" })).rejects.toMatchObject({ code: "WORKFORCE_CODE_TASK_FENCE_INVALID" });
        }
        await expect(assertWorkforceCodeTaskFence({ ...captured as object }, expected)).rejects.toMatchObject({ code: "WORKFORCE_CODE_TASK_FENCE_INVALID" });
        expect(taskQueue.assertTaskClaimActive).not.toHaveBeenCalled();
        await assertWorkforceCodeTaskFence(captured, expected); return { success: true };
      } });
    await expect(assertWorkforceCodeTaskFence(captured, expected)).rejects.toMatchObject({ code: "WORKFORCE_CODE_TASK_FENCE_INVALID" });
    expect(taskQueue.assertTaskClaimActive).toHaveBeenCalledOnce();
  });

  it("requires the private snapshot capability despite a policy grant, observe mode, JSON or namespace tricks", async () => {
    const policy: any = { agentId: "agt_fixture", expiresAt: "2099-01-01T00:00:00Z", policyHash: "sha256:" + "f".repeat(64),
      grantedTools: ["workforce_verify_snapshot"], toolDecisions: { workforce_verify_snapshot: "allow" },
      permissions: { canWrite: true, canExecuteCode: true }, requirements: {}, limits: {}, scope: {} };
    const reserveUsage = vi.fn(async () => ({ allowed: true }));
    const service: any = { expireAgents: async () => {}, getAgent: async () => ({ status: "ACTIVE" }),
      loadVerifiedPolicy: async () => ({ policy }), emitAudit: async () => {}, reserveUsage };
    for (const mode of ["enforce", "observe"] as const) for (const capability of [undefined, { admitted: true, used: false }]) {
      const proxy = createAgentGovernanceToolProxy({ service, mode });
      const denied = await proxy.enforce({ context: { agentId: "agt_fixture", tenantId: "tenant", userId: "owner" },
        toolName: "workforce_verify_snapshot", params: {}, resourceContext: { workforceSnapshotCapability: capability } });
      expect(denied).toMatchObject({ outcome: "deny", code: "WORKFORCE_SNAPSHOT_CAPABILITY_REQUIRED" });
      expect((await proxy.enforce({ context: { agentId: "agt_fixture", tenantId: "tenant" }, toolName: "workforce_verify_snapshot:child", params: {} })).outcome).toBe("deny");
    }
    expect(reserveUsage).not.toHaveBeenCalled();
    const catalog = createToolRiskCatalog(), baseline = catalog.lookup("workforce_verify_snapshot")!;
    expect(Object.isFrozen(baseline)).toBe(true); expect(catalog.lookup("workforce_verify_snapshot:child")).toBeNull();
    for (const name of ["workforce_verify_snapshot", "workforce_verify_snapshot:child"]) {
      expect(() => catalog.register({ ...baseline, name })).toThrow();
      expect(() => createToolRiskCatalog({ extra: [{ ...baseline, name }] })).toThrow();
    }
    expect(catalog.lookup("shell_exec")?.defaultDecision).toBe("deny"); expect(catalog.lookup("code_run")?.defaultDecision).toBe("deny");
  });
  it("rejects JSON factories, implementation callbacks and unissued preflight/snapshot capabilities", async () => {
    const options = { repoRoot: resolve("fixture-repository"), enginePath: resolve("fixture-engine") };
    const factory = createWorkforceCodeDeliveryFactory(options);
    expect(isWorkforceCodeDeliveryFactory(factory)).toBe(true);
    expect(isWorkforceCodeDeliveryFactory(JSON.parse(JSON.stringify(factory)))).toBe(false);
    expect(Object.isFrozen(factory)).toBe(true);
    expect(() => createWorkforceCodeDeliveryFactory({ ...options, run: () => ({ success: true }) } as any)).toThrow();
    await expect(preflightWorkforceCodeDelivery({ kind: factory.kind }, {} as any)).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_IMPLEMENTATION_UNAVAILABLE" });
    await expect(runWorkforceCodeDelivery(factory, { kind: "workforce-code-delivery-preflight" }, {} as any)).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_PREFLIGHT_REQUIRED" });
    expect(await consumeWorkforceSnapshotCapability({ admitted: true, snapshotHash: "f".repeat(64) },
      { agentId: "agt_fixture", tenantId: "fixture", userId: "owner" }, {}, "sha256:" + "a".repeat(64))).toBe(false);
  });

  it("uses actual enforcing Tool Proxy methods captured before public replacement", async () => {
    const service: any = { expireAgents: vi.fn(async () => {}), getAgent: vi.fn(async () => ({ status: "ACTIVE" })),
      loadVerifiedPolicy: vi.fn(async () => null), emitAudit: vi.fn(async () => {}) };
    const proxy = createAgentGovernanceToolProxy({ service });
    const operations = readWorkforceCodeDeliveryToolProxy(proxy);
    expect(operations).not.toBeNull();
    expect(readWorkforceCodeDeliveryToolProxy({ enforce: () => ({ outcome: "allow" }), enforceResult: () => ({ result: {} }) })).toBeNull();
    expect(readWorkforceCodeDeliveryToolProxy(createAgentGovernanceToolProxy({ service, mode: "observe" }))).toBeNull();
    const replacement = vi.fn(async () => ({ outcome: "allow" as const }));
    proxy.enforce = replacement;
    const result = await operations!.enforce({ context: { agentId: "agt_fixture", tenantId: "fixture", userId: "owner" },
      toolName: "file_write", params: { file_path: "src/value.mjs", content: "value" } });
    expect(result.outcome).toBe("deny"); expect(service.loadVerifiedPolicy).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
  });

  it("rejects a structural proxy before any filesystem, model or container preflight", async () => {
    const factory = createWorkforceCodeDeliveryFactory({ repoRoot: resolve("does-not-exist"), enginePath: resolve("does-not-exist-engine") });
    const allow = vi.fn(async () => ({ outcome: "allow", result: {} }));
    await expect(preflightWorkforceCodeDelivery(factory, { toolProxy: { enforce: allow, enforceResult: allow } } as any))
      .rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_TOOL_PROXY_REQUIRED" });
    expect(allow).not.toHaveBeenCalled();
  });
});
