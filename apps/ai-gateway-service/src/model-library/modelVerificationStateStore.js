import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bucketForModel } from "./modelCapabilityBuckets.js";
import { evaluateModelSelectable, normalizeVerificationStatus } from "./modelSelectableGate.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
export const DEFAULT_MODEL_VERIFICATION_STATE_PATH = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json",
);

export function createModelVerificationStateStore({ storagePath = DEFAULT_MODEL_VERIFICATION_STATE_PATH } = {}) {
  let state = loadState(storagePath);

  function buildVerificationRecords(registry) {
    return (registry?.models ?? []).map((model) => buildVerificationRecord(model, state.records?.[recordKey(model)]));
  }

  function recordSmokeResult({ providerId = "nvidia", modelId, model = {}, result = {}, smokeMode = "real_smoke", evidenceId = "phase-313a-nvidia-model-usability" } = {}) {
    if (!modelId) {
      throw new Error("modelId is required to record Phase313A smoke result.");
    }

    const now = new Date().toISOString();
    const status = classifySmokeResultToVerificationStatus(result, model);
    const key = `${providerId}:${modelId}`;
    state = {
      ...state,
      updatedAt: now,
      records: {
        ...(state.records ?? {}),
        [key]: {
          modelId,
          providerId,
          verificationStatus: status,
          lastVerifiedAt: now,
          lastSmokeMode: smokeMode,
          lastSmokeResult: sanitizeSmokeResult(result),
          failureCode: result?.success === true ? null : failureCodeForResult(result),
          failureReason: result?.success === true ? null : redactSecrets(result?.message ?? result?.error?.message ?? ""),
          providerCalled: result?.meta?.providerCalled === true,
          endpointUsed: result?.meta?.endpointType ?? model.endpointType ?? null,
          evidenceId,
        },
      },
    };
    saveState(storagePath, state);
    return state.records[key];
  }

  function recordRealSmokeRun(run) {
    state = {
      ...state,
      updatedAt: new Date().toISOString(),
      lastRealSmokeRun: sanitizeRealSmokeRun(run),
    };
    saveState(storagePath, state);
    return state.lastRealSmokeRun;
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  return {
    buildVerificationRecords,
    recordSmokeResult,
    recordRealSmokeRun,
    getState,
    storagePath,
  };
}

export function buildVerificationRecord(model = {}, persisted = {}) {
  const capabilityBucket = bucketForModel(model);
  const verificationStatus = resolveVerificationStatus(model, persisted);
  const lastSmokeResult = persisted.lastSmokeResult ?? sanitizeSmokeResult(model.lastSmokeResult ?? {});
  const evidenceId = resolveEvidenceId({ model, persisted, verificationStatus });
  const baseRecord = {
    modelId: model.modelId,
    providerId: model.providerId,
    source: model.source,
    capabilityBucket,
    declaredCapabilities: Array.isArray(model.capabilities) ? [...model.capabilities] : [],
    verificationStatus,
    selectable: false,
    selectableReason: "",
    directChatAllowed: false,
    taskToolAllowed: false,
    lastVerifiedAt: persisted.lastVerifiedAt ?? model.lastSmokeAt ?? null,
    lastSmokeMode: persisted.lastSmokeMode ?? (model.lastSmokeAt ? "phase312a_real_smoke" : null),
    lastSmokeResult,
    failureCode: persisted.failureCode ?? failureCodeFromModel(model, verificationStatus),
    failureReason: persisted.failureReason ?? failureReasonFromModel(model, verificationStatus),
    providerCalled: Boolean(persisted.providerCalled ?? lastSmokeResult.providerCalled),
    endpointUsed: persisted.endpointUsed ?? model.endpointPath ?? model.endpointType ?? null,
    evidenceId,
    displayName: model.displayName,
    endpointType: model.endpointType,
    endpointPath: model.endpointPath,
    deprecatedSoon: model.deprecatedSoon === true,
    downloadableOnly: model.downloadableOnly === true,
    requiresSpecialPayload: model.requiresSpecialPayload === true,
    freeEndpoint: model.freeEndpoint === true,
    partnerEndpoint: model.partnerEndpoint === true,
  };
  const gate = evaluateModelSelectable(baseRecord);

  return {
    ...baseRecord,
    verificationStatus: gate.verificationStatus,
    capabilityBucket: gate.capabilityBucket,
    selectable: gate.selectable,
    selectableReason: gate.selectableReason,
    directChatAllowed: gate.directChatAllowed,
    taskToolAllowed: gate.taskToolAllowed,
    chatDropdownSelectable: gate.chatDropdownSelectable,
    taskToolSelectable: gate.taskToolSelectable,
  };
}

export function classifySmokeResultToVerificationStatus(result = {}, model = {}) {
  if (result?.success === true) return "smoke_passed";
  const code = failureCodeForResult(result);
  if (code === "nvidia_rate_limited") return "rate_limited";
  if (code === "endpoint_type_mismatch" || code === "endpoint_not_smoke_enabled") return "wrong_endpoint";
  if (code === "downloadable_only_blocked" || code === "special_payload_not_enabled") return "not_supported";
  if (model.deprecatedSoon === true) return "deprecated";
  if (code === "real_smoke_not_enabled") return "skipped_by_policy";
  if (code === "nvidia_api_key_missing" || code === "fetch_unavailable") return "blocked";
  return "smoke_failed";
}

function resolveVerificationStatus(model, persisted) {
  if (persisted?.verificationStatus) {
    return normalizeVerificationStatus(persisted.verificationStatus);
  }
  if (model?.lastSmokeResult?.success === true || model?.testStatus === "smoke_passed") {
    return "smoke_passed";
  }
  if (model?.testStatus === "smoke_failed" || model?.lastSmokeResult?.success === false) {
    return classifySmokeResultToVerificationStatus(model.lastSmokeResult, model);
  }
  if (model?.deprecatedSoon === true) {
    return "deprecated";
  }
  return "unverified";
}

function resolveEvidenceId({ model, persisted, verificationStatus }) {
  if (persisted?.evidenceId) return persisted.evidenceId;
  if (verificationStatus === "smoke_passed" && model?.lastSmokeAt) return "phase-312a-nvidia-real-smoke";
  return null;
}

function failureCodeForResult(result = {}) {
  return String(result?.code ?? result?.error?.code ?? (result?.success ? "none" : "smoke_failed"));
}

function failureCodeFromModel(model, verificationStatus) {
  if (verificationStatus === "smoke_passed" || verificationStatus === "unverified") return null;
  if (verificationStatus === "deprecated") return "deprecated";
  return failureCodeForResult(model.lastSmokeResult ?? {});
}

function failureReasonFromModel(model, verificationStatus) {
  if (verificationStatus === "smoke_passed" || verificationStatus === "unverified") return null;
  if (verificationStatus === "deprecated") return "Model is marked deprecated in the catalog.";
  return redactSecrets(model.lastSmokeResult?.message ?? "");
}

function recordKey(model = {}) {
  return `${model.providerId}:${model.modelId}`;
}

function loadState(storagePath) {
  if (!existsSync(storagePath)) return createEmptyState();
  try {
    return {
      ...createEmptyState(),
      ...JSON.parse(readFileSync(storagePath, "utf8")),
    };
  } catch {
    return createEmptyState();
  }
}

function createEmptyState() {
  return {
    version: 1,
    phase: "Phase313A",
    warning: "No plaintext provider API keys are stored in this model verification state file.",
    records: {},
    lastRealSmokeRun: null,
    updatedAt: null,
  };
}

function saveState(storagePath, value) {
  mkdirSync(dirname(storagePath), { recursive: true });
  const tmpPath = `${storagePath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmpPath, storagePath);
}

function sanitizeSmokeResult(result = {}) {
  return {
    success: Boolean(result.success),
    code: String(result.code ?? (result.success ? "smoke_passed" : "smoke_failed")),
    message: redactSecrets(result.message ?? result.error?.message ?? ""),
    httpStatus: Number(result.data?.httpStatus ?? result.httpStatus ?? 0),
    endpointType: result.meta?.endpointType ?? result.endpointType ?? null,
    providerCalled: result.meta?.providerCalled === true,
    modelCalled: result.meta?.modelCalled ?? null,
    realExternalCall: result.meta?.realExternalCall === true,
    durationMs: Number(result.meta?.durationMs ?? 0),
    outputPreview: redactSecrets(String(result.data?.outputText ?? result.data?.text ?? "").slice(0, 160)),
  };
}

function sanitizeRealSmokeRun(run = {}) {
  return {
    phase: "Phase313A",
    status: run.status ?? "unknown",
    generatedAt: run.generatedAt ?? new Date().toISOString(),
    realSmokeEnabled: run.realSmokeEnabled === true,
    providerCalledInRealSmoke: run.providerCalledInRealSmoke === true,
    realSmokeModelLimit: Number(run.realSmokeModelLimit ?? 0),
    rpmLimit: Number(run.rpmLimit ?? 40),
    rateLimitHit: run.rateLimitHit === true,
    providerUnavailable: run.providerUnavailable === true,
    results: Array.isArray(run.results) ? run.results.map((item) => ({
      providerId: item.providerId,
      modelId: item.modelId,
      usable: item.usable === true,
      providerCalled: item.providerCalled === true,
      httpStatus: Number(item.httpStatus ?? 0),
      failureCode: item.failureCode ?? null,
      endpointUsed: item.endpointUsed ?? null,
      responseShapeOk: item.responseShapeOk === true,
      verifiedCompleted: item.verifiedCompleted === true,
      selectableAfterSmoke: item.selectableAfterSmoke === true,
      verificationStatus: item.verificationStatus ?? "manual_review_required",
    })) : [],
    blockers: Array.isArray(run.blockers) ? run.blockers.map((item) => String(item)) : [],
  };
}

function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}
