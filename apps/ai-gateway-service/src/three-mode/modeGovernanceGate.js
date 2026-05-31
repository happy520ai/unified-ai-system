import { buildModelUsabilityMatrix } from "../model-library/modelUsabilityMatrix.js";
import { THREE_MODE_ERROR_CODES, ThreeModeRuntimeError } from "./threeModeErrors.js";

const ENABLED_MODES = new Set(["normal", "god", "tianshu"]);
const HARD_REJECTED_STATUSES = new Set([
  "unverified",
  "smoke_failed",
  "blocked",
  "wrong_endpoint",
  "rate_limited",
  "not_supported",
  "skipped_by_policy",
  "deprecated",
  "manual_review_required",
]);

export function createModeGovernanceGate({ application } = {}) {
  function matrix() {
    return buildModelUsabilityMatrix({ registry: application.modelLibraryStore.getRegistry() });
  }

  function assertNoSecretValue(payload = {}) {
    const json = JSON.stringify(payload);
    if (/"secretValue"\s*:|"apiKey"\s*:|"token"\s*:|"credential"\s*:\s*"[A-Za-z0-9._-]{12,}"/i.test(json)) {
      throw new ThreeModeRuntimeError(
        THREE_MODE_ERROR_CODES.SECRET_VALUE_FORBIDDEN,
        "Secret values are forbidden in Three Mode runtime requests.",
      );
    }
  }

  function assertModeEnabled(mode) {
    if (!ENABLED_MODES.has(mode)) {
      throw new ThreeModeRuntimeError(THREE_MODE_ERROR_CODES.MODE_NOT_ENABLED, `Mode ${mode} is not enabled.`);
    }
  }

  function getSelectableRecord(modelId) {
    const records = matrix().records ?? [];
    const record = records.find((item) => item.modelId === modelId && item.providerId === "nvidia");
    if (!record) {
      throw new ThreeModeRuntimeError(THREE_MODE_ERROR_CODES.MODEL_NOT_CONFIGURED, `Model ${modelId} is not configured.`);
    }
    if (HARD_REJECTED_STATUSES.has(record.verificationStatus)) {
      throw new ThreeModeRuntimeError(
        record.verificationStatus === "smoke_failed" ? THREE_MODE_ERROR_CODES.MODEL_HIGH_RISK : THREE_MODE_ERROR_CODES.MODEL_NOT_SELECTABLE,
        `Model ${modelId} is not eligible: ${record.verificationStatus}.`,
        { verificationStatus: record.verificationStatus },
      );
    }
    if (record.selectable !== true || record.directChatAllowed !== true || !record.evidenceId) {
      throw new ThreeModeRuntimeError(
        THREE_MODE_ERROR_CODES.MODEL_NOT_SELECTABLE,
        `Model ${modelId} is not selectable for direct chat.`,
        { selectableReason: record.selectableReason, evidenceId: record.evidenceId ?? null },
      );
    }
    return record;
  }

  function assertProviderAllowed(record, request = {}) {
    if (record.providerId === "nvidia") return;
    const credentialRef = request?.credentialRefContext?.credentialRef ?? request?.userCredentialContext?.credentialRef ?? "";
    if (!credentialRef) {
      throw new ThreeModeRuntimeError(THREE_MODE_ERROR_CODES.USER_CREDENTIAL_MISSING, "User-owned provider calls require credentialRef.");
    }
    throw new ThreeModeRuntimeError(
      THREE_MODE_ERROR_CODES.USER_CREDENTIAL_RUNTIME_NOT_READY,
      "User credential runtime is not ready for non-NVIDIA real calls.",
      { providerId: record.providerId },
    );
  }

  function assertParticipantCount(modelIds = [], { min = 2, max = 5 } = {}) {
    if (modelIds.length < min) {
      throw new ThreeModeRuntimeError(
        THREE_MODE_ERROR_CODES.GOD_MODE_INSUFFICIENT_PARTICIPANTS,
        `God Mode requires at least ${min} eligible participant models.`,
        { participantCount: modelIds.length },
      );
    }
    if (modelIds.length > max) {
      throw new ThreeModeRuntimeError(
        THREE_MODE_ERROR_CODES.VALIDATION_ERROR,
        `God Mode participant count must be <= ${max}.`,
        { participantCount: modelIds.length },
      );
    }
  }

  function selectableRecords() {
    return (matrix().chatSelectableModels ?? []).filter((item) => item.providerId === "nvidia");
  }

  return {
    assertNoSecretValue,
    assertModeEnabled,
    getSelectableRecord,
    assertProviderAllowed,
    assertParticipantCount,
    selectableRecords,
  };
}
