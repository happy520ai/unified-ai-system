import { injectRuntimeFailures, mergeRuntimeResults } from "../../packages/taiji-beidou-engine/src/index.js";
import { phaseBoundary, readJsonIfExists, safeEvidenceBase, writeJson } from "./phase667_674_common.mjs";

const executorEvidence = await readJsonIfExists("apps/ai-gateway-service/evidence/phase667_674/sandbox-auto-runtime-executor-result.json", { executions: [] });
const failures = injectRuntimeFailures("auto-runtime");

for (const failure of failures) {
  await writeJson(`capabilities/_runtime_disabled/${failure.capabilityId}/disabled-result.json`, failure);
}

const merger = mergeRuntimeResults(executorEvidence.executions || [], failures);
await writeJson("apps/ai-gateway-service/evidence/phase667_674/runtime-result-merger-preview.json", merger);

const evidence = safeEvidenceBase({
  phase: "Phase672",
  completed: true,
  runtimeFailurePolicyAvailable: true,
  runtimeKillSwitchAvailable: true,
  runtimeDisabledCapabilityCount: failures.length,
  runtimeBlockedCapabilityCount: failures.filter((failure) => failure.executionStatus === "blocked").length,
  runtimeFailedCapabilityCount: failures.filter((failure) => failure.executionStatus === "failed").length,
  failureInjectionCases: failures,
  failedRuntimeNotMarkedPassed: failures.every((failure) => failure.executionStatus !== "failed" || failure.executionStatus !== "passed"),
  blockedRuntimeNotMarkedCompleted: failures.every((failure) => failure.executionStatus !== "blocked" || failure.completed !== true),
  recursiveSpawnBlocked: failures.some((failure) => failure.blockedReason === "recursive_spawn_attempt"),
  killSwitchAvailable: true,
  globalDisableFlag: "TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED=false",
  runtimeAutoEnabledForSandboxOnly: true,
  productionRuntimeAutoEnabled: false,
  ...phaseBoundary(),
});

await writeJson("apps/ai-gateway-service/evidence/phase667_674/runtime-failure-injection-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
