import {
  buildBlockedPhase911OneShotResult,
  selectPhase911Model,
  validatePhase911Approval,
} from "../../packages/model-routing-engine/src/index.js";
import { approvalPath, ensurePhase911Dirs, oneShotPath, readJsonIfPresent, writeJson } from "./phase911-common.mjs";

ensurePhase911Dirs();

const approval = readJsonIfPresent(approvalPath);
const validation = approval ? validatePhase911Approval(approval) : {
  authorizationComplete: false,
  failures: ["approval_missing"],
};
const usabilityMatrix = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json") || {};
const verificationState = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json") || {};
const selection = approval ? selectPhase911Model({ approval, usabilityMatrix, verificationState }) : {
  selectedModel: null,
  selectionBlockedReason: "approval_missing",
};

let result;
if (!approval) {
  result = buildBlockedPhase911OneShotResult({ blocker: "approval_missing" });
} else if (validation.authorizationComplete !== true) {
  result = buildBlockedPhase911OneShotResult({
    approval,
    model: selection.selectedModel,
    blocker: `approval_invalid:${validation.failures.join(",")}`,
  });
} else if (!selection.selectedModel) {
  result = buildBlockedPhase911OneShotResult({
    approval,
    blocker: selection.selectionBlockedReason || "no_selectable_smoke_passed_nvidia_model",
  });
} else if (!hasSafeCredentialRefProviderAdapter()) {
  result = buildBlockedPhase911OneShotResult({
    approval,
    model: selection.selectedModel,
    blocker: "credential_ref_resolution_not_available_without_secret_read",
  });
} else {
  result = buildBlockedPhase911OneShotResult({
    approval,
    model: selection.selectedModel,
    blocker: "safe_credential_ref_provider_adapter_not_wired",
  });
}

writeJson(oneShotPath, result);
console.log(JSON.stringify({
  responseClassification: result.responseClassification,
  providerCallAttempted: result.providerCallAttempted,
  networkAttemptRecorded: result.networkAttemptRecorded,
  providerResponseReceived: result.providerResponseReceived,
  responseSource: result.responseSource,
  modelId: result.modelId,
  blocker: result.blocker || null,
}, null, 2));

function hasSafeCredentialRefProviderAdapter() {
  return false;
}
