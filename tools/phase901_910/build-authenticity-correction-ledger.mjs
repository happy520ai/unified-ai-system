import { buildAuthenticityCorrectionLedger } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJsonIfPresent, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const reaudit = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/phase821-900-route-evidence-reaudit-result.json") || {};
const proof = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/external-provider-response-proof-gate-result.json") || {};
const result = {
  ...buildAuthenticityCorrectionLedger({ reaudit, proof }),
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase901_910/authenticity-correction-ledger.json", result);
writePhaseDoc("phase907-authenticity-downgrade-correction-ledger.md", phaseDoc({
  phase: "Phase907",
  title: "Authenticity Downgrade / Correction Ledger",
  goal: "Record conservative wording when Phase821-900 evidence does not prove an external Provider API call.",
  facts: [`correctionRequired=${result.correctionRequired}`, `correctionLedgerGenerated=${result.correctionLedgerGenerated}`],
  boundaries: ["does not delete original evidence", "does not force confirmed status"],
  outputs: ["apps/ai-gateway-service/evidence/phase901_910/authenticity-correction-ledger.json"],
}));
console.log(JSON.stringify(result, null, 2));
