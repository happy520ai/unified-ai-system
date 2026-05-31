import {
  selectPhase911Model,
  validatePhase911Approval,
} from "../../packages/model-routing-engine/src/index.js";
import { approvalPath, ensurePhase911Dirs, readJson, readJsonIfPresent, writeJson } from "./phase911-common.mjs";

ensurePhase911Dirs();

const approval = readJsonIfPresent(approvalPath);
const validation = approval ? validatePhase911Approval(approval) : {
  realExternalProviderOneShotApprovalPresent: false,
  authorizationComplete: false,
  failures: ["approval_missing"],
  credentialRefOnly: false,
};
const usabilityMatrix = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json") || {};
const verificationState = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json") || {};
const selection = approval ? selectPhase911Model({ approval, usabilityMatrix, verificationState }) : {
  selectedModel: null,
  eligibleModels: [],
  eligibleModelCount: 0,
  selectionBlockedReason: "approval_missing",
};
const phase901910 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json") || {};
const evidence = {
  phase: "Phase911",
  completed: true,
  ...validation,
  providerId: approval?.providerId || "nvidia",
  credentialRefOnly: approval?.credentialRefOnly === true,
  selectedModel: selection.selectedModel,
  eligibleModelCount: selection.eligibleModelCount,
  selectionBlockedReason: selection.selectionBlockedReason,
  previousPhase821900Classification: phase901910.authenticityClassification || "unknown",
  phase901910CorrectionPreserved: phase901910.authenticityClassification === "simulated_response",
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
};

writeJson("apps/ai-gateway-service/evidence/phase911/real-external-provider-authenticity-intake-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
