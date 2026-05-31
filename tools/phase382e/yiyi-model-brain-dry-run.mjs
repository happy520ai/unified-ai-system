import { runYiyiModelBrainDryRun, yiyiModelBrainDryRunScenarios } from "../../apps/ai-gateway-service/src/ui/yiyi/model-brain/yiyiModelBrainDryRunAdapter.js";
import { ensure, phase382Safety, readJson, writeJson, writeText } from "../phase382-common.mjs";

const scenarios = await readJson("docs/phase382e-yiyi-model-brain-dry-run-scenarios.json");
const scenarioResults = scenarios.map((scenario) => {
  const output = runYiyiModelBrainDryRun({ scenario });
  return {
    scenario,
    modelBackedDryRun: output.modelBackedDryRun,
    providerCallsMade: output.providerCallsMade,
    modelSelectedRef: output.modelSelectedRef,
    credentialRefChecked: output.credentialRefChecked,
    rawSecretAccessed: output.rawSecretAccessed,
    promptEnvelopeBuilt: output.promptEnvelopeBuilt,
    outputSafetyPassed: output.outputSafetyPassed,
    outputSafetyRewritten: output.outputSafetyRewritten,
    fallbackToMockBrain: output.fallbackToMockBrain,
    finalBrainResponsePresent: Boolean(output.finalBrainResponse?.speechBubble),
  };
});

ensure(yiyiModelBrainDryRunScenarios.length >= 12, "Dry-run adapter must support all required scenarios.");
ensure(scenarioResults.every((item) => item.modelBackedDryRun === true), "All scenarios must be modelBackedDryRun.");
ensure(scenarioResults.every((item) => item.providerCallsMade === false), "Dry-run must not call providers.");
ensure(scenarioResults.every((item) => item.promptEnvelopeBuilt === true), "Prompt envelope must be built for all scenarios.");

const result = {
  phase: "Phase382E",
  dryRunAdapterCreated: true,
  scenarioCount: scenarioResults.length,
  scenarioResults,
  validationPassed: true,
  ...phase382Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase382e/yiyi-model-brain-dry-run-result.json", result);
await writeText("docs/phase382e-yiyi-model-brain-dry-run.md", [
  "# Phase382E Model-backed Brain Dry-run",
  "",
  "- Simulated the full model-backed brain route without any provider call.",
  "- Covers welcome, planning, security, evidence, provider-unconfigured, quota/budget blocked, unsafe output rewrite, and fallback-to-mock cases.",
  "- credentialRef, provider policy, quota/budget, prompt envelope, and output safety are all exercised in dry-run form.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
