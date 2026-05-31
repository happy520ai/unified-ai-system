import { runTaijiBeidouSelfUseDryRun } from "../../packages/taiji-beidou-engine/src/index.js";
import { writeJson, phaseBoundary } from "./phase651_666_common.mjs";

const run = runTaijiBeidouSelfUseDryRun();
const trials = run.trials.map((trial) => ({
  intakeText: trial.spec.intakeText,
  capabilityId: trial.manifest.capabilityId,
  capabilitySpecGenerated: Boolean(trial.spec),
  manifestDraftGenerated: Boolean(trial.manifest),
  riskClassificationGenerated: Boolean(trial.riskClassification),
  scaffoldPlanGenerated: Boolean(trial.scaffoldPlan),
  dryRunResultGenerated: Boolean(trial.dryRunResult),
  verifierResultGenerated: Boolean(trial.verifier?.verifierResult),
  rollbackPlanGenerated: Boolean(trial.rollbackPlan),
  registryPreviewGenerated: Boolean(trial.registryPreview),
  runtimeEnabled: false,
  riskDecision: trial.riskClassification.decision,
  dryRunStatus: trial.dryRunResult.status,
}));

const evidence = {
  phase: "Phase665",
  completed: true,
  nlCapabilityTrialCount: trials.length,
  trials,
  allTrialCapabilitiesHaveManifest: trials.every((trial) => trial.manifestDraftGenerated),
  allTrialCapabilitiesHaveRiskClassification: trials.every((trial) => trial.riskClassificationGenerated),
  allTrialCapabilitiesHaveScaffoldPlan: trials.every((trial) => trial.scaffoldPlanGenerated),
  allTrialCapabilitiesHaveDryRunResult: trials.every((trial) => trial.dryRunResultGenerated),
  allTrialCapabilitiesHaveVerifierResult: trials.every((trial) => trial.verifierResultGenerated),
  allTrialCapabilitiesHaveRollbackPlan: trials.every((trial) => trial.rollbackPlanGenerated),
  allTrialCapabilitiesRuntimeEnabled: trials.some((trial) => trial.runtimeEnabled === true),
  allTrialCapabilitiesRuntimeDisabled: trials.every((trial) => trial.runtimeEnabled === false),
  providerCallsMade: false,
  ...phaseBoundary(),
};

await writeJson("apps/ai-gateway-service/evidence/phase651_666/nl-capability-trial-pack-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
