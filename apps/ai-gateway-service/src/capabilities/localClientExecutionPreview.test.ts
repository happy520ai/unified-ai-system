import { describe, expect, it, vi } from "vitest";

import {
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  createLocalClientAdapterRegistry,
  type LocalClientAdapter,
  type VerifiedLocalClientAdapterTarget,
} from "./localClientAdapterRegistry.ts";
import {
  createLocalClientExecutionPreview,
  type ResolvedVerifiedLocalClientPreviewTarget,
} from "./localClientExecutionPreview.ts";
import { createLocalClientRoutePlanStore } from "./localClientRoutePlanStore.ts";

const GOVERNED_ADAPTER_ID = "loopback.desktop-agent";
const GOVERNED_ADAPTER_TYPE = "loopback-hmac";
const GOVERNED_ADAPTER_VERSION = "1.2.0";

function governedAdapter(): LocalClientAdapter {
  return {
    descriptor: {
      descriptorVersion: "local-client-adapter-descriptor-v1",
      id: GOVERNED_ADAPTER_ID,
      type: GOVERNED_ADAPTER_TYPE,
      version: GOVERNED_ADAPTER_VERSION,
      actions: [{
        actionId: "open_document",
        capabilityId: "document_open",
        inputSchema: {
          schemaId: "local.desktop.open-document.v1",
          schemaVersion: 1,
          fields: [{ name: "documentId", valueType: "string", required: true }],
          additionalProperties: false,
        },
      }],
    },
    async execute(invocation) {
      return {
        receiptVersion: "local-client-adapter-receipt-v2",
        receiptId: "receipt_preview_test_0001",
        executionId: invocation.executionId,
        adapterId: GOVERNED_ADAPTER_ID,
        adapterType: GOVERNED_ADAPTER_TYPE,
        adapterVersion: GOVERNED_ADAPTER_VERSION,
        clientId: invocation.client.clientId,
        capabilityId: invocation.capabilityId,
        actionId: invocation.actionId,
        planFingerprint: "a".repeat(64),
        executionMode: "governed",
        externalEffectPerformed: true,
        status: "completed",
      };
    },
  };
}

function target(
  overrides: Partial<ResolvedVerifiedLocalClientPreviewTarget> = {},
): ResolvedVerifiedLocalClientPreviewTarget {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: "desktop-agent",
    revision: 7,
    state: "verified",
    trustDecision: "verified",
    adapter: {
      id: GOVERNED_ADAPTER_ID,
      type: GOVERNED_ADAPTER_TYPE,
      version: GOVERNED_ADAPTER_VERSION,
    },
    capabilityIds: ["document_open"],
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-a",
    subjectId: "operator-a",
    clientId: "desktop-agent",
    capabilityId: "document_open",
    actionId: "open_document",
    input: { documentId: "doc-public-id-17" },
    ...overrides,
  };
}

function harness(resolvedTarget: ResolvedVerifiedLocalClientPreviewTarget = target()) {
  const routePlanStore = createLocalClientRoutePlanStore({ ttlMs: 30_000 });
  const adapterRegistry = createLocalClientAdapterRegistry();
  adapterRegistry.register(governedAdapter());
  const resolveVerifiedTarget = vi.fn(async () => resolvedTarget);
  const preview = createLocalClientExecutionPreview({
    routePlanStore,
    adapterRegistry,
    resolveVerifiedTarget,
  }, {
    policyVersion: "local-client-policy-v2",
  });
  return { preview, routePlanStore, adapterRegistry, resolveVerifiedTarget };
}

describe("local-client execution preview", () => {
  it("creates a subject-bound immutable one-time plan from server-resolved verified state", async () => {
    const setup = harness();
    const result = await setup.preview.preview(request());

    expect(setup.resolveVerifiedTarget).toHaveBeenCalledWith({
      identity: { tenantId: "tenant-a", subjectId: "operator-a" },
      clientId: "desktop-agent",
    });
    expect(result).toMatchObject({
      previewVersion: "local-client-execution-preview-v1",
      status: "approval-required",
      executionPerformed: false,
      plan: {
        tenantId: "tenant-a",
        subjectId: "operator-a",
        clientId: "desktop-agent",
        clientRevision: 7,
        clientState: "verified",
        clientTrustDecision: "verified",
        adapterId: GOVERNED_ADAPTER_ID,
        adapterType: GOVERNED_ADAPTER_TYPE,
        adapterVersion: GOVERNED_ADAPTER_VERSION,
        capabilityId: "document_open",
        actionId: "open_document",
        policyVersion: "local-client-policy-v2",
      },
      approval: {
        required: true,
        scopes: [
          "local-client:execute",
          "local-client:external-effect",
          expect.stringMatching(/^local-client:plan:/u),
        ],
      },
      boundaries: {
        targetResolvedFromTrustedState: true,
        adapterSelectionFromRequestDenied: true,
        oneTimePlan: true,
        planGrantsApproval: false,
        executionPerformed: false,
      },
    });
    expect(result.approval.planDigest).toBe(result.plan.planId);
    expect(result).not.toHaveProperty("input");
    expect(setup.routePlanStore.verifyInput({
      tenantId: "tenant-a",
      subjectId: "operator-a",
      planId: result.plan.planId,
    }, { documentId: "doc-public-id-17" })).toEqual({ documentId: "doc-public-id-17" });
  });

  it("rejects request-body attempts to supply adapter, revision or trust authority", async () => {
    const setup = harness();
    await expect(setup.preview.preview(request({
      adapterId: GOVERNED_ADAPTER_ID,
      revision: 7,
      trustDecision: "verified",
    }) as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_REQUEST_INVALID",
      statusCode: 400,
    });
    expect(setup.resolveVerifiedTarget).not.toHaveBeenCalled();
  });

  it("preserves bounded opaque enterprise tenant and subject identities", async () => {
    const setup = harness();
    const result = await setup.preview.preview(request({
      tenantId: "Tenant-A",
      subjectId: "oidc:user@example.com",
    }));
    expect(result.plan).toMatchObject({
      tenantId: "Tenant-A",
      subjectId: "oidc:user@example.com",
    });
    expect(setup.resolveVerifiedTarget).toHaveBeenCalledWith({
      identity: { tenantId: "Tenant-A", subjectId: "oidc:user@example.com" },
      clientId: "desktop-agent",
    });
  });

  it("rejects stale target identity and adapter descriptor changes before plan creation", async () => {
    const staleClient = harness(target({ clientId: "another-client" }));
    await expect(staleClient.preview.preview(request())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_MISMATCH",
    });

    const staleAdapter = harness(target({
      adapter: {
        id: GOVERNED_ADAPTER_ID,
        type: GOVERNED_ADAPTER_TYPE,
        version: "1.1.0",
      },
    }));
    await expect(staleAdapter.preview.preview(request())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_MISMATCH",
    });
  });

  it("denies fake adapters even when a resolver incorrectly labels them verified", async () => {
    const fakeTarget: ResolvedVerifiedLocalClientPreviewTarget = {
      ...target(),
      adapter: {
        id: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
        type: "fake",
        version: "1.0.0",
      },
      capabilityIds: ["local_application"],
    };
    const setup = harness(fakeTarget);
    await expect(setup.preview.preview(request({
      capabilityId: "local_application",
      actionId: "simulate",
    }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_FAKE_ADAPTER_DENIED",
      statusCode: 409,
    });
  });

  it("requires the exact capability/action pair exposed by the verified adapter", async () => {
    const setup = harness();
    await expect(setup.preview.preview(request({ actionId: "delete_document" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_ACTION_UNAVAILABLE",
      statusCode: 409,
    });
    await expect(setup.preview.preview(request({ capabilityId: "shell_execute" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_ACTION_UNAVAILABLE",
      statusCode: 409,
    });
  });

  it.each([
    [{ documentId: { nested: true } }, "wrong primitive type"],
    [{ unknown: "field" }, "unknown field"],
    [{}, "missing required field"],
    [{ documentId: "doc-1", planFingerprint: "a".repeat(64) }, "caller plan fingerprint"],
  ])("rejects %s input before creating an approval-required plan (%s)", async (input, _label) => {
    const setup = harness();
    await expect(setup.preview.preview(request({ input }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_INPUT_INVALID",
      statusCode: 400,
    });
  });

  it("fails closed for malformed dependencies, policy version and resolver output", async () => {
    expect(() => createLocalClientExecutionPreview({} as never, {
      policyVersion: "local-client-policy-v2",
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_CONFIG_INVALID",
    }));
    const setup = harness();
    expect(() => createLocalClientExecutionPreview({
      routePlanStore: setup.routePlanStore,
      adapterRegistry: setup.adapterRegistry,
      resolveVerifiedTarget: setup.resolveVerifiedTarget,
    }, { policyVersion: "bad policy with spaces" })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_CONFIG_INVALID",
    }));

    const invalidTarget = harness({
      ...(target() as VerifiedLocalClientAdapterTarget),
      revision: 0,
    });
    await expect(invalidTarget.preview.preview(request())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_INVALID",
    });
  });
});
