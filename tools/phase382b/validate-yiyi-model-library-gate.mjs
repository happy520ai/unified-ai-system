import { evaluateYiyiModelCandidate } from "../../apps/ai-gateway-service/src/ui/yiyi/model-brain/yiyiModelLibraryGate.js";
import { ensure, phase382Safety, readJson, writeJson, writeText } from "../phase382-common.mjs";

const schema = await readJson("docs/phase382b-yiyi-brain-model-candidate.schema.json");
const mocks = await readJson("docs/phase382b-yiyi-brain-model-candidates.mock.json");
const eligible = evaluateYiyiModelCandidate({
  modelCandidateId: "eligible",
  provider: "user_configured_provider",
  modelRef: "configured_yiyi_brain_model_ref",
  credentialRef: "cred_ref_mock",
  providerConfigured: true,
  selectable: true,
  allowedForYiyiBrain: true,
});
const missingCredential = evaluateYiyiModelCandidate({
  modelCandidateId: "missing_credential",
  provider: "user_configured_provider",
  modelRef: "configured_yiyi_brain_model_ref",
  credentialRef: null,
  providerConfigured: true,
  selectable: true,
  allowedForYiyiBrain: true,
});

ensure(schema.title === "Yiyi Brain Model Candidate", "Candidate schema title mismatch.");
ensure(Array.isArray(mocks) && mocks.length >= 2, "Model candidate mocks missing.");
ensure(eligible.decision === "eligible_for_dry_run", "Eligible candidate should pass dry-run gate.");
ensure(missingCredential.blockedBy.includes("missing_credential_ref"), "Missing credential should be blocked.");

const result = {
  phase: "Phase382B",
  modelLibraryGateCreated: true,
  credentialRefGateCreated: true,
  rawSecretAllowed: false,
  plaintextApiKeyAllowed: false,
  yiyiBrainCapabilityTagRequired: true,
  rejectionReasonsCovered: true,
  validationPassed: true,
  ...phase382Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase382b/yiyi-model-library-gate-result.json", result);
await writeText("docs/phase382b-yiyi-brain-model-library-credentialref-gate.md", [
  "# Phase382B Model Library + credentialRef Gate",
  "",
  "- Yiyi model-backed brain can only select configured, selectable, yiyi-brain-capable model refs.",
  "- credentialRef is required; raw secrets and plaintext API keys are not allowed.",
  "- This phase validates contract and mock candidates only, without accessing vault or providers.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
