import { describe, expect, it } from "vitest";

import type { ManagedLocalClientPopVerification } from "../capabilities/localClientPopIdentityAuthority.ts";
import {
  LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARIES,
  createLocalClientProviderDispatchBinding,
} from "./localClientProviderDispatchBinding.ts";
import {
  evaluateLocalClientProviderPolicy,
  type LocalClientProviderCandidate,
  type LocalClientProviderPolicy,
} from "./localClientProviderPolicy.ts";
import type { LocalClientProviderRuntimeDecision } from "./localClientProviderRuntimeRouter.ts";

const TENANT_ID = "tenant-secret@example.invalid";
const SUBJECT_ID = "subject-secret-001";
const CLIENT_ID = "desktop-agent";
const PROOF_FINGERPRINT = "a".repeat(64);

describe("local-client provider dispatch binding", () => {
  it("creates an immutable, redacted single-target binding before dispatch", () => {
    const binding = createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: runtimeDecision(),
    });

    expect(binding).toMatchObject({
      bindingVersion: "local-client-provider-dispatch-binding-v1",
      clientId: CLIENT_ID,
      clientRevision: 7,
      policyRevision: "tenant-policy-r7",
      providerId: "provider-alpha",
      modelId: "model-fast",
      actualDispatchPerformed: false,
      boundaries: {
        ...LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARIES,
        actualDispatchPerformed: false,
        assertBeforeEveryProviderAttempt: true,
        weightedDispatchAllowed: false,
        fallbackDispatchAllowed: false,
        shadowDispatchAllowed: false,
        decisionCarriesIdentityBinding: false,
        exactClientRevisionMatch: true,
      },
    });
    expect(binding.identityFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(binding.decisionDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(binding.boundaries)).toBe(true);

    const publicJson = JSON.stringify(binding);
    expect(publicJson).not.toContain(TENANT_ID);
    expect(publicJson).not.toContain(SUBJECT_ID);
    expect(publicJson).not.toContain(PROOF_FINGERPRINT);

    const assertion = binding.assertAttempt({
      providerId: "provider-alpha",
      modelId: "model-fast",
    });
    expect(assertion).toEqual({
      allowed: true,
      bindingVersion: "local-client-provider-dispatch-binding-v1",
      providerId: "provider-alpha",
      modelId: "model-fast",
      decisionDigest: binding.decisionDigest,
      actualDispatchPerformed: false,
    });
    expect(Object.isFrozen(assertion)).toBe(true);
  });

  it("rejects a decision with no selected target", () => {
    const decision = runtimeDecision({
      policy: { dataClass: "internal", allowedProviders: [] },
    });

    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: decision,
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARY_VIOLATION",
    }));
  });

  it("rejects multiple selection, fanout, or fusion decisions", () => {
    const candidates = [candidate(), candidate({
      provider: "provider-beta",
      model: "model-accurate",
      costUsd: 0.2,
    })];
    const multiple = runtimeDecision({
      candidates,
      policy: {
        dataClass: "public",
        allowedProviders: ["provider-alpha", "provider-beta"],
        maxFanout: 2,
        fusionAllowed: true,
      },
      requestedFanout: 2,
      fusionRequested: true,
    });
    expect(multiple.decision.selected).toHaveLength(2);

    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: multiple,
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARY_VIOLATION",
    }));
  });

  it.each([
    {
      label: "dispatch already performed",
      mutate: (decision: Record<string, unknown>) => { decision.dispatchPerformed = true; },
    },
    {
      label: "boundary dispatch marker",
      mutate: (decision: Record<string, unknown>) => {
        (decision.boundaries as Record<string, unknown>).dispatchPerformed = true;
      },
    },
    {
      label: "fallback extension",
      mutate: (decision: Record<string, unknown>) => {
        (decision.decision as Record<string, unknown>).fallback = { provider: "provider-beta" };
      },
    },
    {
      label: "weighted selected candidate",
      mutate: (decision: Record<string, unknown>) => {
        const selected = (decision.decision as { selected: Array<Record<string, unknown>> }).selected;
        selected[0].weight = 1;
      },
    },
    {
      label: "shadow root extension",
      mutate: (decision: Record<string, unknown>) => { decision.shadow = true; },
    },
  ])("rejects $label", ({ mutate }) => {
    const decision = structuredClone(runtimeDecision()) as unknown as Record<string, unknown>;
    mutate(decision);

    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: decision as unknown as LocalClientProviderRuntimeDecision,
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARY_VIOLATION",
    }));
  });

  it("rejects selected target tampering that no longer matches the selected evaluation", () => {
    const decision = structuredClone(runtimeDecision());
    (decision.decision.selected[0] as { model: string }).model = "model-tampered";

    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: decision,
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_DECISION_INVALID",
    }));
  });

  it.each([
    { providerId: "provider-beta", modelId: "model-fast" },
    { providerId: "provider-alpha", modelId: "model-other" },
    { providerId: "provider beta", modelId: "model-fast" },
    { providerId: "provider-alpha", modelId: "" },
    { providerId: "provider-alpha", modelId: "model-fast", weight: 1 },
    { providerId: "provider-alpha", modelId: "model-fast", fallback: true },
    { providerId: "provider-alpha", modelId: "model-fast", shadow: true },
  ])("denies cross-target or extended attempt %# with one fixed code", (attempt) => {
    const binding = createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: runtimeDecision(),
    });

    expect(() => binding.assertAttempt(attempt as never)).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_ATTEMPT_DENIED",
      category: "authorization",
      statusCode: 403,
    }));
  });

  it.each([
    { label: "unverified", mutate: (value: Record<string, unknown>) => { value.verified = false; } },
    {
      label: "zero revision",
      mutate: (value: Record<string, unknown>) => {
        (value.identity as Record<string, unknown>).clientRevision = 0;
      },
    },
    {
      label: "fractional revision",
      mutate: (value: Record<string, unknown>) => {
        (value.identity as Record<string, unknown>).clientRevision = 1.5;
      },
    },
    {
      label: "bad proof fingerprint",
      mutate: (value: Record<string, unknown>) => { value.proofFingerprint = "not-a-digest"; },
    },
    {
      label: "identity extension",
      mutate: (value: Record<string, unknown>) => {
        (value.identity as Record<string, unknown>).role = "admin";
      },
    },
  ])("rejects invalid PoP identity: $label", ({ mutate }) => {
    const raw = structuredClone(verification()) as unknown as Record<string, unknown>;
    mutate(raw);
    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: raw as unknown as ManagedLocalClientPopVerification,
      runtimeDecision: runtimeDecision(),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_IDENTITY_INVALID",
    }));
  });

  it("copies identity revision immutably and binds revision changes into both digests", () => {
    const source = verification();
    const first = createLocalClientProviderDispatchBinding({
      popVerification: source,
      runtimeDecision: runtimeDecision(),
    });
    (source.identity as { clientRevision: number }).clientRevision = 8;
    expect(first.clientRevision).toBe(7);

    const second = createLocalClientProviderDispatchBinding({
      popVerification: verification({ clientRevision: 8 }),
      runtimeDecision: runtimeDecision({ clientRevision: 8 }),
    });
    expect(second.clientRevision).toBe(8);
    expect(second.identityFingerprint).not.toBe(first.identityFingerprint);
    expect(second.decisionDigest).not.toBe(first.decisionDigest);
    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification({ clientRevision: 8 }),
      runtimeDecision: runtimeDecision({ clientRevision: 7 }),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_IDENTITY_INVALID",
    }));
  });

  it("is deterministic for the exact pair and changes digest across identity or policy", () => {
    const first = createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: runtimeDecision(),
    });
    const same = createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: runtimeDecision(),
    });
    const otherSubject = createLocalClientProviderDispatchBinding({
      popVerification: verification({ subjectId: "subject-other" }),
      runtimeDecision: runtimeDecision(),
    });
    const otherPolicy = createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: runtimeDecision({ policyRevision: "tenant-policy-r8" }),
    });

    expect(same.identityFingerprint).toBe(first.identityFingerprint);
    expect(same.decisionDigest).toBe(first.decisionDigest);
    expect(otherSubject.identityFingerprint).not.toBe(first.identityFingerprint);
    expect(otherSubject.decisionDigest).not.toBe(first.decisionDigest);
    expect(otherPolicy.decisionDigest).not.toBe(first.decisionDigest);
  });

  it("rejects malformed policy revision, selected ids, and input extensions", () => {
    const badRevision = runtimeDecision({ policyRevision: "bad policy revision" });
    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: badRevision,
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_DECISION_INVALID",
    }));

    const badProvider = structuredClone(runtimeDecision());
    (badProvider.decision.selected[0] as { provider: string }).provider = "bad provider";
    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: badProvider,
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_DECISION_INVALID",
    }));

    expect(() => createLocalClientProviderDispatchBinding({
      popVerification: verification(),
      runtimeDecision: runtimeDecision(),
      fallback: true,
    } as never)).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARY_VIOLATION",
    }));
  });
});

type RuntimeDecisionOptions = Readonly<{
  candidates?: readonly LocalClientProviderCandidate[];
  policy?: LocalClientProviderPolicy;
  requestedFanout?: number;
  fusionRequested?: boolean;
  policyRevision?: string;
  clientRevision?: number;
}>;

function runtimeDecision(
  options: RuntimeDecisionOptions = {},
): LocalClientProviderRuntimeDecision {
  const candidates = options.candidates ?? [
    candidate(),
    candidate({
      provider: "provider-beta",
      model: "model-accurate",
      costUsd: 0.2,
      latencyMs: 600,
    }),
  ];
  const policy = options.policy ?? {
    dataClass: "internal",
    allowedProviders: ["provider-alpha", "provider-beta"],
    maxFanout: 1,
    fusionAllowed: false,
    maxCostUsd: 0.5,
  };
  const decision = evaluateLocalClientProviderPolicy({
    policy,
    candidates,
    requiredCapabilities: ["chat"],
    requestedFanout: options.requestedFanout ?? 1,
    fusionRequested: options.fusionRequested ?? false,
  });
  return Object.freeze({
    runtimeRouterVersion: "local-client-provider-runtime-router-v1" as const,
    clientRevision: options.clientRevision ?? 7,
    policyRevision: options.policyRevision ?? "tenant-policy-r7",
    dispatchPerformed: false as const,
    inventory: Object.freeze({
      providerCount: new Set(candidates.map((entry) => entry.provider)).size,
      modelCount: candidates.length,
      observedModelCount: candidates.length,
      unknownRegionCount: candidates.filter((entry) => entry.region === null).length,
      unknownCostCount: candidates.filter((entry) => entry.costUsd === null).length,
      unknownQuotaCount: candidates.filter((entry) => entry.quotaRemaining === null).length,
    }),
    decision,
    boundaries: Object.freeze({
      verifiedClientRequired: true as const,
      candidatesFromTrustedRegistry: true as const,
      policyFromTrustedResolver: true as const,
      requestSuppliedFactsDenied: true as const,
      clientRevisionBound: true as const,
      dispatchPerformed: false as const,
    }),
  });
}

function candidate(
  overrides: Partial<LocalClientProviderCandidate> = {},
): LocalClientProviderCandidate {
  return Object.freeze({
    provider: "provider-alpha",
    model: "model-fast",
    region: "cn-east",
    capabilities: Object.freeze(["chat", "reasoning"]),
    health: 0.92,
    reliability: 0.95,
    latencyMs: 250,
    costUsd: 0.05,
    quotaRemaining: 0.8,
    free: false,
    available: true,
    ...overrides,
  });
}

function verification(
  identityOverrides: Partial<ManagedLocalClientPopVerification["identity"]> = {},
): ManagedLocalClientPopVerification {
  return {
    verified: true,
    identity: {
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      clientId: CLIENT_ID,
      clientRevision: 7,
      ...identityOverrides,
    },
    proofFingerprint: PROOF_FINGERPRINT,
    issuedAtMs: 1_000,
    expiresAtMs: 31_000,
  };
}
