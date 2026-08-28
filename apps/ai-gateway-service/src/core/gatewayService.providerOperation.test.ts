import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { GatewayService } from "./gatewayService.js";

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function operationInput(invoke: () => Promise<unknown>) {
  return {
    operationType: "image_generation",
    providerId: "openai",
    providerType: "openai",
    modelId: "gpt-image-1",
    path: "/v1/images/generations",
    requestFingerprint: fingerprint("image request"),
    enterpriseIdentity: { tenantId: "tenant-a", subject: "user-a" },
    invoke,
  };
}

describe("GatewayService governed provider operations", () => {
  it("orders policy, reservation, audit, usage start, adapter, and terminal usage", async () => {
    const events: string[] = [];
    const providerDispatchGate = {
      reserve: vi.fn(async (_input: Record<string, unknown>) => {
        events.push("dispatch");
        return { reserved: true, bypassed: false, reservationFingerprint: "0123456789abcdef" };
      }),
    };
    const requestLogger = {
      assertDurable: vi.fn(async () => {
        events.push("usage-ready");
        return true;
      }),
      log: vi.fn(async (entry: Record<string, unknown>) => {
        events.push(`usage-${entry.usageEventType}`);
      }),
    };
    const enterpriseAudit = {
      recordAudit: vi.fn(async () => events.push("audit")),
    };
    const invoke = vi.fn(async () => {
      events.push("adapter");
      return {
        data: {
          usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
          provider: "openai",
        },
      };
    });
    const service = new GatewayService({
      providerRegistry: {} as any,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["openai"],
        requireDurableUsageLedger: true,
        requireProviderDispatchGate: true,
      },
      providerDispatchGate,
      requestLogger,
      enterpriseAudit,
    });

    await expect(service.executeProviderOperation(operationInput(invoke), {
      providerDispatchKeyHash: fingerprint("client-key"),
      providerDispatchRoute: "/v1/images/generations",
      providerDispatchInvocation: 1,
    })).resolves.toMatchObject({ data: { provider: "openai" } });

    expect(events).toEqual([
      "usage-ready",
      "dispatch",
      "audit",
      "usage-attempt-started",
      "adapter",
      "usage-attempt-completed",
    ]);
    expect(providerDispatchGate.reserve).toHaveBeenCalledWith(expect.objectContaining({
      route: "/v1/images/generations",
      providerId: "openai",
      modelId: "gpt-image-1",
      requestFingerprint: fingerprint("image request"),
    }));
    expect(enterpriseAudit.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      path: "/provider-execution:image_generation",
      details: expect.objectContaining({
        operationType: "image_generation",
        promptContentRecorded: false,
        credentialRecorded: false,
      }),
    }));
    expect(requestLogger.log.mock.calls.map(([entry]) => ({
      event: entry.usageEventType,
      path: entry.path,
      attempted: entry.providerCallAttempted,
      totalTokens: entry.totalTokens,
    }))).toEqual([
      {
        event: "attempt-started",
        path: "/v1/images/generations",
        attempted: true,
        totalTokens: 0,
      },
      {
        event: "attempt-completed",
        path: "/v1/images/generations",
        attempted: true,
        totalTokens: 6,
      },
    ]);
  });

  it("never invokes the adapter when dispatch ownership is rejected", async () => {
    const invoke = vi.fn(async () => undefined);
    const providerDispatchGate = {
      reserve: vi.fn(async (_input: Record<string, unknown>) => {
        throw Object.assign(new Error("duplicate"), {
          code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
          category: "concurrency",
          statusCode: 409,
          retryable: false,
        });
      }),
    };
    const requestLogger = {
      assertDurable: vi.fn(async () => true),
      log: vi.fn(async (_entry: Record<string, unknown>) => undefined),
    };
    const service = new GatewayService({
      providerRegistry: {} as any,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["openai"],
        requireDurableUsageLedger: true,
        requireProviderDispatchGate: true,
      },
      providerDispatchGate,
      requestLogger,
      enterpriseAudit: { recordAudit: vi.fn(async () => undefined) },
    });

    await expect(service.executeProviderOperation(operationInput(invoke), {
      providerDispatchKeyHash: fingerprint("client-key"),
      providerDispatchRoute: "/v1/images/generations",
      providerDispatchInvocation: 1,
    })).rejects.toMatchObject({ code: "PROVIDER_DISPATCH_ALREADY_RESERVED" });
    expect(invoke).not.toHaveBeenCalled();
    expect(requestLogger.log).toHaveBeenCalledOnce();
    expect(requestLogger.log.mock.calls[0][0]).toMatchObject({
      usageEventType: "attempt-failed",
      providerCallAttempted: false,
      path: "/v1/images/generations",
    });
  });

  it("denies provider operations for a server-bound client without an operation binding", async () => {
    const invoke = vi.fn(async () => ({ ok: true }));
    const providerDispatchGate = {
      reserve: vi.fn(async () => ({
        reserved: true,
        bypassed: false,
        reservationFingerprint: "0123456789abcdef",
      })),
    };
    const service = new GatewayService({
      providerRegistry: {} as any,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["openai"],
        requireProviderDispatchGate: true,
      },
      providerDispatchGate,
    });
    const input = operationInput(invoke);
    input.enterpriseIdentity = {
      tenantId: "tenant-a",
      subject: "user-a",
      managedClientId: "desktop.alpha",
    } as any;

    await expect(service.executeProviderOperation(input, {
      providerDispatchKeyHash: fingerprint("client-key"),
      providerDispatchRoute: "/v1/images/generations",
      providerDispatchInvocation: 1,
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_ATTEMPT_DENIED",
    });
    expect(providerDispatchGate.reserve).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });
});
