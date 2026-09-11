import { describe, expect, it, vi } from "vitest";
import { createSetupReadiness } from "./healthUtils.js";
import { createPriorityProviderSelectionPolicy } from "../../core/providerSelectionPolicy.js";

function fixture({ mode = "fake", real = false, providers = ["local-fake-provider"], defaultProvider = providers[0], enterpriseReady = true, routeMode = "fixed" }: {
  mode?: string;
  real?: boolean;
  providers?: string[];
  defaultProvider?: string;
  enterpriseReady?: boolean;
  routeMode?: string;
} = {}) {
  const unexpectedEffect = vi.fn(() => { throw new Error("Readiness must not execute an effect"); });
  const application = {
    config: { aiGatewayService: {
      providerMode: mode,
      realProviderEnabled: real,
      providerSelection: { mode: routeMode, defaultProviderId: defaultProvider },
    } },
    requestLogger: { getHealth: () => ({ status: "ready", durableWritesRequired: real }) },
    knowledgeService: { getHealth: () => ({ status: "ready", mode: "keyword" }), retrieve: unexpectedEffect },
    knowledgeInfra: { getReadiness: () => ({ status: "ready" }) },
    workflowService: { getHealth: () => ({ status: "ready" }), run: unexpectedEffect },
    workforceService: { getHealth: () => ({ status: "ready", ready: true, mode: "plan-preview", roleCount: 3 }), execute: unexpectedEffect },
    enterpriseGovernanceService: { getHealth: () => ({ status: enterpriseReady ? "ready" : "degraded" }) },
    gatewayService: { getProviderDescriptors: () => providers.map((id) => ({ id })), execute: unexpectedEffect },
    localClientExecutionReadiness: { requested: false },
    localClientManagedProtocolDispatchStatus: { enabled: false, ready: false, blockers: [] },
  };
  return { application, unexpectedEffect };
}

describe("setup readiness operator guidance", () => {
  it("describes the active fake route and usable terminal entry without requiring a key", () => {
    const { application, unexpectedEffect } = fixture();
    const originalConfig = JSON.stringify(application.config);
    const result = createSetupReadiness(application);
    expect(result.readiness.chat.defaultLane).toContain("fake");
    expect(result.readiness.chat.defaultLane).toContain("local-fake-provider");
    expect(result.readiness.chat.defaultLane).not.toContain("NVIDIA");
    expect(result.readiness.chat.nextAction).toContain("pnpm gateway chat");
    expect(result.readiness.chat.nextAction).not.toContain("--allow-real-provider");
    expect(JSON.stringify(result)).not.toMatch(/聊天框|点击识别|拖入文档|doctor:phase/);
    expect(result.readiness.chat.ready).toBe(true);
    expect(unexpectedEffect).not.toHaveBeenCalled();
    expect(JSON.stringify(application.config)).toBe(originalConfig);
  });

  it("identifies an actual non-NVIDIA real route and keeps explicit call authorization visible", () => {
    const { application, unexpectedEffect } = fixture({ mode: "real", real: true, providers: ["openai"] });
    const result = createSetupReadiness(application);
    expect(result.readiness.chat.defaultLane).toContain("real");
    expect(result.readiness.chat.defaultLane).toContain("openai");
    expect(result.readiness.chat.defaultLane).not.toContain("NVIDIA");
    expect(result.readiness.chat.nextAction).toContain("--allow-real-provider");
    expect(result.userMessage).toContain("不会调用模型");
    expect(unexpectedEffect).not.toHaveBeenCalled();
    expect(result.safety.providerProbeCalled).toBe(false);
  });

  it("shows auto mode with real calls disabled without inventing a default registered provider", () => {
    const { application } = fixture({ mode: "auto", defaultProvider: "not-registered" });
    const result = createSetupReadiness(application);
    expect(result.readiness.chat.defaultLane).toContain("auto");
    expect(result.readiness.chat.defaultLane).toContain("真实调用已禁用");
    expect(result.readiness.chat.defaultLane).not.toContain("not-registered");
    expect(result.readiness.chat.defaultLane).toContain("未注册");
    expect(result.readiness.chat.nextAction).toContain("路由配置");
    const policy = createPriorityProviderSelectionPolicy(application.config.aiGatewayService.providerSelection);
    expect(() => policy.select({ request: {}, candidates: [{ target: { providerId: "local-fake-provider", modelId: "fake" }, providerPriority: 1, modelPriority: 1 }] })).toThrow("No provider route available");
  });

  it("does not present a configured fixed default as the target of a policy-selected route", () => {
    const { application } = fixture({ providers: ["local-fake-provider", "openai"], defaultProvider: "openai", routeMode: "registry-default" });
    const result = createSetupReadiness(application);
    expect(result.readiness.chat.defaultLane).toContain("策略选择");
    expect(result.readiness.chat.defaultLane).not.toContain("默认 Provider：openai");
    const policy = createPriorityProviderSelectionPolicy(application.config.aiGatewayService.providerSelection);
    expect(policy.select({ request: {}, candidates: [
      { target: { providerId: "local-fake-provider", modelId: "fake" }, providerPriority: 1, modelPriority: 1 },
      { target: { providerId: "openai", modelId: "model" }, providerPriority: 2, modelPriority: 1 },
    ] }).selected.target.providerId).toBe("local-fake-provider");
  });

  it("reports unknown mode as unknown instead of forwarding untrusted configuration text", () => {
    const { application } = fixture({ mode: "unexpected-mode-value" });
    const result = createSetupReadiness(application);
    expect(result.readiness.chat.defaultLane).toContain("未知");
    expect(result.readiness.chat.defaultLane).not.toContain("unexpected-mode-value");
  });

  it("offers diagnostics when chat prerequisites are absent and preserves optional setup semantics", () => {
    const { application } = fixture({ providers: [], enterpriseReady: false });
    const result = createSetupReadiness(application);
    expect(result.status).toBe("ready");
    expect(result.readiness.chat.ready).toBe(false);
    expect(result.readiness.chat.nextAction).toContain("pnpm gateway status --json");
    expect(result.steps.find((step: any) => step.stepId === "service-health")?.nextAction).toContain("pnpm gateway doctor --json");
  });

  it("separates available import adapters and planning from real model verification and execution", () => {
    const { application, unexpectedEffect } = fixture();
    const result = createSetupReadiness(application);
    expect(result.readiness.modelImport.nextAction).toContain("目录");
    expect(result.steps.find((step: any) => step.stepId === "model-import")?.nextAction).toContain("可选");
    expect(result.readiness.workforce.nextAction).toContain("受治理执行");
    expect(result.limitations.join(" ")).toContain("separate approval-gated routes");
    expect(result.safety).toMatchObject({ providerProbeCalled: false, workforceExecution: false, projectFileWrites: false });
    expect(unexpectedEffect).not.toHaveBeenCalled();
  });
});
