import { buildRoutingAuthenticityEvidenceRebind } from "../../packages/model-routing-engine/src/index.js";
import {
  baseSafety,
  ensurePhaseDirs,
  phase913AuthenticityPath,
  phase914RebindPath,
  phaseDoc,
  readJsonIfPresent,
  writeJson,
  writePhaseDoc,
} from "./phase912-915-common.mjs";

ensurePhaseDirs();

const phase913 = readJsonIfPresent(phase913AuthenticityPath) || {};
const phase901910 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json") || {};
const result = {
  ...buildRoutingAuthenticityEvidenceRebind({ phase913, phase901910 }),
  ...baseSafety(),
};

writeJson(phase914RebindPath, result);
writePhaseDoc("phase914-authenticity-confirmed-routing-evidence-rebind.md", phaseDoc({
  title: "Phase914 Authenticity Confirmed Routing Evidence Rebind",
  goal: "Bind Phase913 external Provider authenticity proof as later supplemental routing evidence without mutating Phase821-900 original evidence.",
  facts: [
    `rebindPerformed=${result.rebindPerformed}`,
    `previousPhase821900Classification=${result.previousPhase821900Classification}`,
    "originalEvidenceMutated=false",
  ],
  boundaries: [
    "Correction from Phase901-910 remains preserved.",
    "The original Phase821-900 evidence is not rewritten.",
  ],
  outputs: [phase914RebindPath],
}));

console.log(JSON.stringify(result, null, 2));
