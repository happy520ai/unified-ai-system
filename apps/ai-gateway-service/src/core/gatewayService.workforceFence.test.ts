import { describe, expect, it, vi } from "vitest";
import { GatewayService } from "./gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";

function fixture() {
  const provider = createFakeProvider({ providerId: "wf-provider", modelId: "wf-model", providerType: "openai",
    capabilities: ["chat"], enabled: true, fixedLatencyMs: 0 } as any);
  const generate = vi.spyOn(provider, "generate");
  const registry = new (ProviderRegistry as any)({ enabledProviders: ["wf-provider"] });
  registry.register(provider);
  const audit = { recordAudit: vi.fn(async () => undefined) };
  const logger = { assertDurable: vi.fn(async () => true), log: vi.fn(async (_entry: Record<string, unknown>) => undefined) };
  const dispatch = { reserve: vi.fn(async () => ({ reserved: true, bypassed: false, reservationFingerprint: "fixture" })) };
  const gateway = new GatewayService({ providerRegistry: registry, requestLogger: logger, enterpriseAudit: audit,
    providerDispatchGate: dispatch, runtimeConfig: { providerMode: "real", realProviderEnabled: true,
      enabledProviders: ["wf-provider"], requireDurableUsageLedger: true, requireProviderDispatchGate: true } });
  const fence = { providerId: "wf-provider", modelId: "wf-model",
    assertActive: vi.fn(async (_phase?: "reserve" | "commit") => true), onDispatch: vi.fn() };
  const request = { taskType: "chat" as const, providerId: "wf-provider", model: "wf-model",
    messages: [{ role: "user" as const, content: "synthetic workforce task" }],
    enterpriseIdentity: { tenantId: "tenant-a", userId: "owner-a" } };
  const execution = { providerDispatchKeyHash: "a".repeat(64), providerDispatchRoute: "/workforce/execute",
    workforceDispatchFence: fence };
  return { gateway, request, execution, fence, generate, audit, logger, dispatch };
}

describe("Workforce fence at the gateway Provider boundary", () => {
  it.each(["dispatch", "usage"])("rechecks after the asynchronous %s boundary", async (boundary) => {
    const f = fixture();
    let active = true;
    f.fence.assertActive.mockImplementation(async () => {
      if (!active) throw new Error("synthetic lease revoked");
      return true;
    });
    if (boundary === "dispatch") f.dispatch.reserve.mockImplementationOnce(async () => {
      active = false;
      return { reserved: true, bypassed: false, reservationFingerprint: "fixture" };
    });
    else f.audit.recordAudit.mockImplementationOnce(async () => { active = false; });
    const result = await f.gateway.execute(f.request, f.execution as any);
    expect(result.success).toBe(false);
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.fence.onDispatch).not.toHaveBeenCalled();
    expect(f.logger.log.mock.calls.at(-1)?.[0]).toMatchObject({ providerCallAttempted: false, billable: false });
  });

  it("rejects target drift and shadow requests before reserving a Provider operation", async () => {
    const f = fixture();
    for (const extra of [{ workforceDispatchFence: { ...f.fence, modelId: "other-model" } }, { shadow: true }]) {
      const result = await f.gateway.execute(f.request, { ...f.execution, ...extra } as any);
      expect(result.success).toBe(false);
    }
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.dispatch.reserve).not.toHaveBeenCalled();
  });

  it("rejects a JSON-shaped fence instead of treating it as authority", async () => {
    const f = fixture();
    const result = await f.gateway.execute(f.request, { ...f.execution,
      workforceDispatchFence: { providerId: "wf-provider", modelId: "wf-model", authorized: true },
    } as any);
    expect(result.success).toBe(false);
    expect(f.generate).not.toHaveBeenCalled();
  });

  it("leaves the existing path without a Workforce fence unchanged", async () => {
    const f = fixture();
    const { workforceDispatchFence: _fence, ...execution } = f.execution;
    expect((await f.gateway.execute(f.request, execution)).success).toBe(true);
    expect(f.generate).toHaveBeenCalledOnce();
  });

  it("keeps unsupported streaming and multimodal Workforce calls pre-dispatch", async () => {
    const f = fixture();
    await expect(f.gateway.executeStream(f.request, f.execution as any).next())
      .rejects.toMatchObject({ code: "WORKFORCE_PROVIDER_STREAM_UNSUPPORTED" });
    await expect(f.gateway.executeProviderOperation({ operationType: "embedding", providerId: "wf-provider",
      modelId: "wf-model", path: "/fixture", requestFingerprint: "a".repeat(64), invoke: vi.fn() }, f.execution as any))
      .rejects.toMatchObject({ code: "WORKFORCE_PROVIDER_OPERATION_UNSUPPORTED" });
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.dispatch.reserve).not.toHaveBeenCalled();
  });
});
