import { buildPhase913AuthenticityEvidence } from "../../packages/model-routing-engine/src/index.js";
import {
  baseSafety,
  ensurePhaseDirs,
  phase913AuthenticityPath,
  phase913OneShotPath,
  phase912InjectionDryRunPath,
  phaseDoc,
  readJsonIfPresent,
  writeJson,
  writePhaseDoc,
} from "./phase912-915-common.mjs";

ensurePhaseDirs();

const oneShot = readJsonIfPresent(phase913OneShotPath) || {};
const phase912 = readJsonIfPresent(phase912InjectionDryRunPath) || {};
const result = {
  ...buildPhase913AuthenticityEvidence({ oneShot, phase912 }),
  ...baseSafety(),
};

writeJson(phase913AuthenticityPath, result);
writePhaseDoc("phase913-rerun-phase911-real-external-provider-one-shot.md", phaseDoc({
  title: "Phase913 Rerun Phase911 Real External Provider One-shot",
  goal: "Rerun the Phase911 one-shot through the Phase912 credentialRef secure injection boundary.",
  facts: [
    `externalProviderApiCallConfirmed=${result.externalProviderApiCallConfirmed}`,
    `networkAttemptRecorded=${result.networkAttemptRecorded}`,
    `providerResponseReceived=${result.providerResponseReceived}`,
    `responseClassification=${result.responseClassification}`,
  ],
  boundaries: [
    "Exactly one Provider request maximum.",
    "No retries.",
    "No non-NVIDIA Provider.",
  ],
  outputs: [phase913OneShotPath, phase913AuthenticityPath],
}));

console.log(JSON.stringify(result, null, 2));
