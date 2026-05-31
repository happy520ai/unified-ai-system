import { reauditPhase821900RouteEvidence } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadPhase821900Evidence, phaseDoc, readJsonIfPresent, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const finalEvidence = loadPhase821900Evidence();
if (!finalEvidence) {
  const blocked = {
    phase: "Phase906",
    phase821900Reaudited: false,
    blocker: "phase821_900_evidence_missing",
    ...baseSafety(),
  };
  writeJson("apps/ai-gateway-service/evidence/phase901_910/phase821-900-route-evidence-reaudit-result.json", blocked);
  console.log(JSON.stringify(blocked, null, 2));
  process.exit(0);
}
const proof = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/external-provider-response-proof-gate-result.json") || {};
const result = {
  ...reauditPhase821900RouteEvidence({ finalEvidence, proof }),
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase901_910/phase821-900-route-evidence-reaudit-result.json", result);
writePhaseDoc("phase906-phase821-900-route-evidence-reaudit.md", phaseDoc({
  phase: "Phase906",
  title: "Phase821-900 Route Evidence Re-audit",
  goal: "Re-audit Phase821-900 providerCallsMade evidence without deleting original evidence.",
  facts: [
    `previousProviderCallsMade=${result.previousProviderCallsMade}`,
    `reauditedAuthenticityClassification=${result.reauditedAuthenticityClassification}`,
    `correctionRequired=${result.correctionRequired}`,
  ],
  boundaries: ["adds re-audit evidence only", "does not rewrite original claim"],
  outputs: ["apps/ai-gateway-service/evidence/phase901_910/phase821-900-route-evidence-reaudit-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
