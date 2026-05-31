import { buildProviderCallAuthenticityContract } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadPhase821900Evidence, phaseDoc, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const phase821 = loadPhase821900Evidence() || {};
const result = {
  ...buildProviderCallAuthenticityContract({
    providerCallClaimed: phase821.providerCallsMade === true,
    providerCallsMade: phase821.providerCallsMade === true,
    credentialRefOnly: phase821.credentialRefOnly === true,
    rawSecretRead: phase821.rawSecretRead === true,
    authJsonRead: phase821.authJsonRead === true,
  }),
  providerCallAuthenticityContractReady: true,
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-contract-result.json", result);
writePhaseDoc("phase901-provider-call-authenticity-contract.md", phaseDoc({
  phase: "Phase901",
  title: "Provider Call Authenticity Contract",
  goal: "Define the evidence fields required to distinguish local executor attempts from external Provider API calls.",
  facts: [`providerCallClaimed=${result.providerCallClaimed}`, `authenticityClassification=${result.authenticityClassification}`],
  boundaries: ["no Provider call", "no secret/auth.json read"],
  outputs: ["apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-contract-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
