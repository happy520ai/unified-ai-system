import { describe, it, expect } from "vitest";
import { buildContextCodecRequest } from "./contextCodecRequestBuilder.js";
import { buildTaijiBeidouProductionReadinessGate } from "./taijiBeidouProductionReadinessGate.js";

describe("context-codec-request-builder", () => {
  it("builds request with defaults", () => {
    const result = buildContextCodecRequest();
    expect(result.source).toBe("main-gateway");
    expect(result.mode).toBe("normal");
    expect(result.userMessage).toBe("");
    expect(result.evidenceRefs).toEqual([]);
  });

  it("generates requestId when not provided", () => {
    const result = buildContextCodecRequest({ mode: "god" });
    expect(result.requestId).toContain("phase641r-god-dry-run");
  });

  it("uses provided requestId", () => {
    const result = buildContextCodecRequest({ requestId: "my-req-123" });
    expect(result.requestId).toBe("my-req-123");
  });

  it("sets safe defaults for missionState", () => {
    const result = buildContextCodecRequest();
    expect(result.missionState.noProviderCall).toBe(true);
    expect(result.missionState.mission).toBe("context codec dry-run");
  });

  it("merges custom missionState fields", () => {
    const result = buildContextCodecRequest({
      missionState: { mission: "custom mission", custom: true },
    });
    expect(result.missionState.mission).toBe("custom mission");
    expect(result.missionState.custom).toBe(true);
    expect(result.missionState.noProviderCall).toBe(true);
  });

  it("sets safe defaults for safetyBoundary", () => {
    const result = buildContextCodecRequest();
    expect(result.safetyBoundary.providerCallsAllowed).toBe(false);
    expect(result.safetyBoundary.secretReadAllowed).toBe(false);
    expect(result.safetyBoundary.deployAllowed).toBe(false);
    expect(result.safetyBoundary.chatMutationAllowed).toBe(false);
  });

  it("merges custom safetyBoundary fields", () => {
    const result = buildContextCodecRequest({
      safetyBoundary: { providerCallsAllowed: true },
    });
    expect(result.safetyBoundary.providerCallsAllowed).toBe(true);
    expect(result.safetyBoundary.secretReadAllowed).toBe(false);
  });

  it("passes through providerRef and credentialRef", () => {
    const result = buildContextCodecRequest({
      providerRef: "ref:openai",
      credentialRef: "ref:user-key",
    });
    expect(result.providerRef).toBe("ref:openai");
    expect(result.credentialRef).toBe("ref:user-key");
  });
});

describe("taiji-beidou-production-readiness-gate", () => {
  it("returns all checks passed by default", () => {
    const result = buildTaijiBeidouProductionReadinessGate();
    expect(result.productionReady).toBe(true);
    expect(result.productionDeployExecuted).toBe(false);
    expect(result.deployExecuted).toBe(false);
  });

  it("returns not ready when any check is false", () => {
    const result = buildTaijiBeidouProductionReadinessGate({
      sloDocument: false,
    });
    expect(result.productionReady).toBe(false);
    expect(result.checks.sloDocument).toBe(false);
  });

  it("returns not ready when multiple checks fail", () => {
    const result = buildTaijiBeidouProductionReadinessGate({
      monitoringPlanReady: false,
      alertPlanReady: false,
    });
    expect(result.productionReady).toBe(false);
  });

  it("all safety flags are false", () => {
    const result = buildTaijiBeidouProductionReadinessGate();
    expect(result.productionDeployExecuted).toBe(false);
    expect(result.deployExecuted).toBe(false);
    expect(result.releaseExecuted).toBe(false);
    expect(result.tagCreated).toBe(false);
    expect(result.artifactUploaded).toBe(false);
    expect(result.providerRuntimeDefaultEnabled).toBe(false);
    expect(result.mainChainDefaultEnabled).toBe(false);
    expect(result.chatDefaultEnabled).toBe(false);
  });

  it("contains all 14 readiness checks", () => {
    const result = buildTaijiBeidouProductionReadinessGate();
    const checkKeys = Object.keys(result.checks);
    expect(checkKeys).toHaveLength(14);
    expect(checkKeys).toContain("sloDocument");
    expect(checkKeys).toContain("rollbackRunbookReady");
    expect(checkKeys).toContain("evidenceComplete");
  });
});
