import { describe, expect, it, vi } from "vitest";

import {
  BUILTIN_FAKE_LOCAL_CLIENT_ACTION_ID,
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_VERSION,
  BUILTIN_FAKE_LOCAL_CLIENT_CAPABILITY_ID,
  LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION,
  LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
  LocalClientAdapterRegistry,
  type LocalClientAdapter,
  type LocalClientAdapterDescriptor,
  type LocalClientAdapterExecutionRequest,
  type LocalClientAdapterInvocation,
  type LocalClientAdapterReceipt,
  type VerifiedLocalClientAdapterTarget,
} from "./localClientAdapterRegistry.ts";

function createVerifiedTarget(
  descriptor: LocalClientAdapterDescriptor,
  capabilityIds = descriptor.actions.map((action) => action.capabilityId),
): VerifiedLocalClientAdapterTarget {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: "verified.local-client",
    state: "verified",
    trustDecision: "verified",
    adapter: {
      id: descriptor.id,
      type: descriptor.type,
      version: descriptor.version,
    },
    capabilityIds,
  };
}

function createCustomAdapter(
  id = "test.local-client-adapter",
  executeOverride?: LocalClientAdapter["execute"],
): LocalClientAdapter {
  const descriptor: LocalClientAdapterDescriptor = {
    descriptorVersion: LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION,
    id,
    type: "test",
    version: "1.2.3",
    actions: [{
      actionId: "inspect",
      capabilityId: "local_inspection",
      inputSchema: {
        schemaId: "test.local-inspection.input",
        schemaVersion: 1,
        fields: [{ name: "label", valueType: "string", required: false }],
        additionalProperties: false,
      },
    }],
  };
  return {
    descriptor,
    execute: executeOverride ?? (async (invocation) => createReceipt(invocation, {
      executionMode: "governed",
      externalEffectPerformed: false,
      status: "completed",
    })),
  };
}

function createReceipt(
  invocation: LocalClientAdapterInvocation,
  outcome: Pick<LocalClientAdapterReceipt, "executionMode" | "externalEffectPerformed" | "status">,
): LocalClientAdapterReceipt {
  return {
    receiptVersion: LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
    receiptId: "test:receipt.0001",
    executionId: invocation.executionId,
    adapterId: invocation.adapterDescriptor.id,
    adapterType: invocation.adapterDescriptor.type,
    adapterVersion: invocation.adapterDescriptor.version,
    clientId: invocation.client.clientId,
    capabilityId: invocation.capabilityId,
    actionId: invocation.actionId,
    planFingerprint: outcome.executionMode === "governed" ? "f".repeat(64) : null,
    ...outcome,
  };
}

function createExecutionRequest(
  descriptor: LocalClientAdapterDescriptor,
  overrides: Partial<LocalClientAdapterExecutionRequest> = {},
): LocalClientAdapterExecutionRequest {
  return {
    executionId: `lc-exec-${"1".repeat(64)}`,
    tenantId: "tenant-a",
    subjectId: "subject-a",
    client: createVerifiedTarget(descriptor),
    capabilityId: descriptor.actions[0].capabilityId,
    actionId: descriptor.actions[0].actionId,
    input: {},
    receiptReconciliation: descriptor.type === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE
      ? null
      : { intent: {} as never, confirmReceipt: async () => true },
    signal: new AbortController().signal,
    assertAuthority: async () => true,
    ...overrides,
  };
}

describe("local client adapter registry", () => {
  it("registers code adapters, fails closed on duplicate ids, and exposes descriptor projections only", () => {
    const registry = new LocalClientAdapterRegistry();
    const adapter = createCustomAdapter();

    const registered = registry.register(adapter);
    const lookedUp = registry.lookup(adapter.descriptor.id);
    const listed = registry.list();

    expect(registered).toEqual(adapter.descriptor);
    expect(lookedUp).toBe(registered);
    expect(lookedUp).not.toBe(adapter);
    expect(lookedUp).not.toHaveProperty("execute");
    expect(listed).toContain(registered);
    expect(listed).not.toContain(adapter);
    expect(Object.isFrozen(registered)).toBe(true);
    expect(Object.isFrozen(registered.actions)).toBe(true);
    expect(Object.isFrozen(registered.actions[0].inputSchema.fields)).toBe(true);

    (adapter.descriptor as { version: string }).version = "9.9.9";
    expect(registry.lookup("test.local-client-adapter")?.version).toBe("1.2.3");
    expect(() => registry.register(adapter)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ADAPTER_DUPLICATE",
      statusCode: 409,
    }));
  });

  it("requires a code implementation and rejects transport-shaped action schemas", () => {
    const registry = new LocalClientAdapterRegistry();
    const withoutCode = {
      descriptor: createCustomAdapter("test.no-code").descriptor,
      execute: "not-a-function",
    } as unknown as LocalClientAdapter;
    expect(() => registry.register(withoutCode)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID",
    }));

    const withTransport = {
      ...createCustomAdapter("test.transport-object"),
      endpoint: "https://forbidden.example",
    } as unknown as LocalClientAdapter;
    expect(() => registry.register(withTransport)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID",
    }));

    for (const fieldName of ["command", "executable", "endpoint", "executionId"]) {
      const adapter = createCustomAdapter(`test.forbidden-${fieldName}`);
      const action = adapter.descriptor.actions[0] as any;
      action.inputSchema.fields = [{ name: fieldName, valueType: "string", required: false }];
      expect(() => registry.register(adapter)).toThrowError(expect.objectContaining({
        code: "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID",
      }));
    }
  });

  it("fails closed for unknown adapters, unknown actions, and non-exact capabilities", async () => {
    const registry = new LocalClientAdapterRegistry();
    const fakeDescriptor = registry.lookup(BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID)!;
    const unknownTarget = createVerifiedTarget({
      ...fakeDescriptor,
      id: "missing.local-client-adapter",
    });

    await expect(registry.execute(createExecutionRequest(fakeDescriptor, {
      client: unknownTarget,
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_UNKNOWN", statusCode: 404 });

    await expect(registry.execute(createExecutionRequest(fakeDescriptor, {
      actionId: "missing-action",
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_ACTION_UNKNOWN", statusCode: 404 });

    await expect(registry.execute(createExecutionRequest(fakeDescriptor, {
      client: createVerifiedTarget(fakeDescriptor, ["browser"]),
      capabilityId: "browser",
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_CAPABILITY_MISMATCH" });
  });

  it("requires both verified state and a descriptor matching id, type, and version", async () => {
    const registry = new LocalClientAdapterRegistry();
    const descriptor = registry.lookup(BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID)!;
    const declaredTarget = {
      ...createVerifiedTarget(descriptor),
      state: "declared",
      trustDecision: "declared",
    } as unknown as VerifiedLocalClientAdapterTarget;
    await expect(registry.execute(createExecutionRequest(descriptor, {
      client: declaredTarget,
    }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ADAPTER_TARGET_UNVERIFIED",
      statusCode: 403,
    });

    const mismatchedTarget = createVerifiedTarget({
      ...descriptor,
      version: "9.9.9",
    });
    await expect(registry.execute(createExecutionRequest(descriptor, {
      client: mismatchedTarget,
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_TARGET_MISMATCH" });
  });

  it("requires tenant, subject, and AbortSignal before invoking an adapter", async () => {
    const registry = new LocalClientAdapterRegistry();
    const descriptor = registry.lookup(BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID)!;

    await expect(registry.execute(createExecutionRequest(descriptor, {
      executionId: "",
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_INPUT_INVALID" });
    await expect(registry.execute(createExecutionRequest(descriptor, {
      tenantId: "",
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_IDENTITY_REQUIRED" });
    await expect(registry.execute(createExecutionRequest(descriptor, {
      subjectId: "",
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_IDENTITY_REQUIRED" });
    await expect(registry.execute(createExecutionRequest(descriptor, {
      signal: null as unknown as AbortSignal,
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_SIGNAL_REQUIRED" });
  });

  it("rejects a receipt that is not bound to the exact execution id", async () => {
    const registry = new LocalClientAdapterRegistry();
    const adapter = createCustomAdapter("test.execution-receipt-mismatch", async (invocation) => ({
      ...createReceipt(invocation, {
        executionMode: "governed",
        externalEffectPerformed: true,
        status: "completed",
      }),
      executionId: "lc-exec-other-execution-0001",
    }));
    const descriptor = registry.register(adapter);

    await expect(registry.execute(createExecutionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ADAPTER_RECEIPT_INVALID",
      category: "integrity",
      statusCode: 502,
      outcomeUnknown: true,
    });
  });

  it("rejects extra, symbol, non-enumerable, or accessor receipt fields", async () => {
    const variants = [
      (receipt: LocalClientAdapterReceipt) => ({ ...receipt, extra: "forbidden" }),
      (receipt: LocalClientAdapterReceipt) => {
        const candidate = { ...receipt } as Record<PropertyKey, unknown>;
        candidate[Symbol("forbidden")] = true;
        return candidate;
      },
      (receipt: LocalClientAdapterReceipt) => {
        const candidate = { ...receipt } as Record<PropertyKey, unknown>;
        Object.defineProperty(candidate, "hidden", { value: true, enumerable: false });
        return candidate;
      },
      (receipt: LocalClientAdapterReceipt) => {
        const candidate = { ...receipt } as Record<PropertyKey, unknown>;
        Object.defineProperty(candidate, "executionId", {
          enumerable: true,
          get: () => receipt.executionId,
        });
        return candidate;
      },
    ];

    for (const [index, mutate] of variants.entries()) {
      const registry = new LocalClientAdapterRegistry();
      const adapter = createCustomAdapter(`test.receipt-shape-${index}`, async (invocation) => (
        mutate(createReceipt(invocation, {
          executionMode: "governed",
          externalEffectPerformed: true,
          status: "completed",
        })) as unknown as LocalClientAdapterReceipt
      ));
      const descriptor = registry.register(adapter);
      await expect(registry.execute(createExecutionRequest(descriptor))).rejects.toMatchObject({
        code: "LOCAL_CLIENT_ADAPTER_RECEIPT_INVALID",
        category: "integrity",
        statusCode: 502,
        outcomeUnknown: true,
      });
    }
  });

  it("cancels an in-flight adapter through the required signal", async () => {
    const registry = new LocalClientAdapterRegistry();
    let observedSignal: AbortSignal | null = null;
    const execute = vi.fn(async (invocation: LocalClientAdapterInvocation) => {
      observedSignal = invocation.signal;
      return await new Promise<LocalClientAdapterReceipt>(() => {});
    });
    const adapter = createCustomAdapter("test.blocking-adapter", execute);
    const descriptor = registry.register(adapter);
    const controller = new AbortController();

    const execution = registry.execute(createExecutionRequest(descriptor, {
      signal: controller.signal,
    }));
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    controller.abort();

    await expect(execution).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ADAPTER_EXECUTION_ABORTED",
      category: "cancellation",
      statusCode: 499,
      outcomeUnknown: true,
    });
    expect(observedSignal).toBe(controller.signal);
  });

  it("returns a deterministic fake receipt without echoing identity or input", async () => {
    const registry = new LocalClientAdapterRegistry();
    const descriptor = registry.lookup(BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID)!;
    expect(descriptor).toMatchObject({
      id: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
      type: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
      version: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_VERSION,
      actions: [{
        actionId: BUILTIN_FAKE_LOCAL_CLIENT_ACTION_ID,
        capabilityId: BUILTIN_FAKE_LOCAL_CLIENT_CAPABILITY_ID,
      }],
    });
    const secretInput = "do-not-echo-this-input";
    const request = createExecutionRequest(descriptor, {
      tenantId: "tenant-secret-value",
      subjectId: "subject-secret-value",
      input: { requestTag: secretInput, sequence: 7 },
    });

    const first = await registry.execute(request);
    const second = await registry.execute(request);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      receiptVersion: LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
      adapterId: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
      adapterType: "fake",
      adapterVersion: "1.0.0",
      planFingerprint: null,
      executionMode: "fake",
      externalEffectPerformed: false,
      status: "simulated",
    });
    expect(Object.isFrozen(first)).toBe(true);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain(secretInput);
    expect(serialized).not.toContain(request.tenantId);
    expect(serialized).not.toContain(request.subjectId);
    expect(first).not.toHaveProperty("input");
  });

  it.each(["command", "executable", "endpoint", "executionId"])(
    "rejects the transport field %s before adapter execution",
    async (fieldName) => {
      const registry = new LocalClientAdapterRegistry();
      const descriptor = registry.lookup(BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID)!;
      await expect(registry.execute(createExecutionRequest(descriptor, {
        input: { [fieldName]: "sensitive-value" },
      }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_ADAPTER_INPUT_INVALID" });
    },
  );
});
