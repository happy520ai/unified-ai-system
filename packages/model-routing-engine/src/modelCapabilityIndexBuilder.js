import { assignModelRoles } from "./modelRoleAssignment.js";

export function buildModelCapabilityIndex(input = {}) {
  const matrix = input.usabilityMatrix || {};
  const verificationRecords = Object.values(input.verificationState?.records || {});
  const selectableIds = new Set(matrix.chatDropdownModels || []);
  const runtimeCandidates = verificationRecords
    .filter((record) => record.verificationStatus === "smoke_passed")
    .filter((record) => selectableIds.size === 0 || selectableIds.has(record.modelId))
    .map((record) => normalizeRuntimeModel(record));

  const seedModels = Array.isArray(input.globalSeed?.models) ? input.globalSeed.models : [];
  const runtimeIdSet = new Set(runtimeCandidates.map((model) => model.modelId));
  const dryRunCandidates = seedModels
    .filter((model) => model.status === "selectable_candidate")
    .filter((model) => !runtimeIdSet.has(model.modelId))
    .map((model) => normalizeDryRunCandidate(model));

  const excludedModels = [
    ...verificationRecords
      .filter((record) => record.verificationStatus !== "smoke_passed")
      .map((record) => ({
        modelId: record.modelId,
        providerId: record.providerId,
        reason: `verificationStatus=${record.verificationStatus}`,
      })),
    ...seedModels
      .filter((model) => ["cataloged", "credential_missing", "smoke_pending", "failed", "high_risk", "blocked", "deprecated"].includes(model.status))
      .slice(0, 50)
      .map((model) => ({
        modelId: model.modelId,
        providerId: model.providerId,
        reason: `status=${model.status}`,
      })),
  ];

  const models = [...runtimeCandidates, ...dryRunCandidates].map((model) => ({
    ...model,
    roles: assignModelRoles(model),
  }));

  return {
    phase: "Phase804",
    modelCapabilityIndexReady: true,
    selectableModelCount: matrix.selectableModels ?? runtimeCandidates.length,
    smokePassedModelCount: matrix.smokePassedModels ?? runtimeCandidates.length,
    candidateModelCount: dryRunCandidates.length,
    runtimeCandidates,
    dryRunCandidates,
    models,
    excludedModels,
    providerCallsMade: false,
    secretRead: false,
  };
}

function normalizeRuntimeModel(record) {
  const id = String(record.modelId || "");
  const capabilities = inferCapabilities(id);
  return {
    modelId: id,
    providerId: record.providerId || "nvidia",
    verificationStatus: record.verificationStatus,
    selectable: true,
    smokePassed: true,
    runtimeEligible: true,
    notRuntimeEligible: false,
    blocked: false,
    highRisk: false,
    deprecated: false,
    evidenceId: record.evidenceId || "phase-313a-model-usability-matrix",
    lastVerifiedAt: record.lastVerifiedAt || null,
    capabilities,
  };
}

function normalizeDryRunCandidate(model) {
  return {
    modelId: model.modelId,
    providerId: model.providerId,
    verificationStatus: "selectable_candidate",
    selectable: false,
    smokePassed: false,
    runtimeEligible: false,
    notRuntimeEligible: true,
    blocked: false,
    highRisk: false,
    deprecated: false,
    evidenceId: model.evidence?.smokeRef || model.evidence?.discoveryRef || null,
    capabilities: model.capabilities || inferCapabilities(model.modelId),
  };
}

export function inferCapabilities(modelId = "") {
  const id = modelId.toLowerCase();
  return {
    chat: true,
    reasoning: /reason|deepseek|nemotron|qwen|qwq|kimi|mistral/.test(id),
    coding: /code|coder|codegemma/.test(id),
    chineseOptimized: /qwen|deepseek|kimi|minimax|glm|yi|baichuan/.test(id),
    longContext: /128k|long/.test(id),
    jsonMode: false,
    toolCalling: false,
    lowLatency: /mini|nano|flash|1b|3b|4b|8b/.test(id),
    lowCost: /mini|nano|flash|1b|3b|4b|8b/.test(id),
  };
}
