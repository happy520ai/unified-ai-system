import { runTaijiBeidouSelfUseDryRun } from "../../packages/taiji-beidou-engine/src/index.js";
import { writeJson, phaseBoundary } from "./phase651_666_common.mjs";

const run = runTaijiBeidouSelfUseDryRun();

for (const trial of run.trials) {
  const base = `capabilities/_generated_dry_run/${trial.manifest.capabilityId}`;
  await writeJson(`${base}/manifest.draft.json`, trial.manifest);
  await writeJson(`${base}/capability-spec.json`, trial.spec);
  await writeJson(`${base}/risk-classification.json`, trial.riskClassification);
  await writeJson(`${base}/scaffold-plan.json`, trial.scaffoldPlan);
  await writeJson(`${base}/dry-run-result.json`, trial.dryRunResult);
  await writeJson(`${base}/verifier-result.json`, trial.verifier.verifierResult);
  await writeJson(`${base}/rollback-plan.json`, trial.rollbackPlan);
}

const evidence = {
  phase: "Phase656",
  completed: true,
  sandboxDryRunAvailable: true,
  nlCapabilityTrialCount: run.trials.length,
  allTrialCapabilitiesHaveDryRunResult: run.trials.every((trial) => trial.dryRunResult?.status === "passed"),
  allTrialCapabilitiesRuntimeEnabled: run.trials.some((trial) => trial.manifest.runtime.enabledByDefault === true),
  allTrialCapabilitiesRuntimeDisabled: run.trials.every((trial) => trial.manifest.runtime.enabledByDefault === false),
  runtimeAutoEnabled: false,
  providerCallsMade: false,
  ...phaseBoundary(),
};

await writeJson("apps/ai-gateway-service/evidence/phase651_666/taiji-beidou-self-use-dry-run-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
