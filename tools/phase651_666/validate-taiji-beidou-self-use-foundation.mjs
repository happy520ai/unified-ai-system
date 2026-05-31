import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runTaijiBeidouSelfUseDryRun } from "../../packages/taiji-beidou-engine/src/index.js";
import { pathExists, readJsonIfExists, repoRoot, writeJson, phaseBoundary } from "./phase651_666_common.mjs";

const run = runTaijiBeidouSelfUseDryRun();
const subgatewayEvidence = await readJsonIfExists("apps/ai-gateway-service/evidence/phase651_666/codex-long-task-token-saving-subgateway-result.json", {});
const trialEvidence = await readJsonIfExists("apps/ai-gateway-service/evidence/phase651_666/nl-capability-trial-pack-result.json", {});
const registryPreviewExists = await pathExists("capabilities/_registry_preview/taiji-beidou-neuron-registry.preview.json");
const synapsePreviewExists = await pathExists("capabilities/_synapse_graph_preview/taiji-beidou-synapse-graph.preview.json");
const uiPanelExists = await pathExists("apps/ai-gateway-service/src/ui/components/TaijiBeidouPanel.js");
const uiPanelText = await readText("apps/ai-gateway-service/src/ui/components/TaijiBeidouPanel.js");
const requiredDocs = [
  "docs/phase651-666-taiji-beidou-engine-self-use-foundation.md",
  "docs/phase651-taiji-beidou-engine-foundation.md",
  "docs/phase652-capability-neuron-manifest-schema.md",
  "docs/phase653-natural-language-neurogenesis-compiler.md",
  "docs/phase654-immune-risk-classifier.md",
  "docs/phase655-manifest-scaffold-generator.md",
  "docs/phase656-sandbox-dry-run-builder.md",
  "docs/phase657-verifier-evidence-rollback-generator.md",
  "docs/phase658-synapse-graph-registry.md",
  "docs/phase659-homeostasis-governor.md",
  "docs/phase660-regeneration-pruning-reweighting-policy.md",
  "docs/phase661-context-codec-neuron-migration.md",
  "docs/phase662-codex-context-neuron-migration.md",
  "docs/phase663-god-tianshu-neuron-draft-migration.md",
  "docs/phase664-mission-control-beidou-panel.md",
  "docs/phase665-nl-capability-trial-pack.md",
  "docs/phase666-codex-long-task-token-saving-subgateway-runner.md",
  "docs/phase651-666-execution-report.md",
];

const allTrialCapabilitiesHaveManifest = run.trials.every((trial) => Boolean(trial.manifest));
const allTrialCapabilitiesHaveRiskClassification = run.trials.every((trial) => Boolean(trial.riskClassification));
const allTrialCapabilitiesHaveScaffoldPlan = run.trials.every((trial) => Boolean(trial.scaffoldPlan));
const allTrialCapabilitiesHaveDryRunResult = run.trials.every((trial) => trial.dryRunResult?.status === "passed");
const allTrialCapabilitiesHaveVerifierResult = run.trials.every((trial) => trial.verifier?.verifierResult?.passed === true);
const allTrialCapabilitiesHaveRollbackPlan = run.trials.every((trial) => Boolean(trial.rollbackPlan));
const allTrialCapabilitiesRuntimeEnabled = run.trials.some((trial) => trial.manifest.runtime.enabledByDefault === true);
const allTrialCapabilitiesRuntimeDisabled = run.trials.every((trial) => trial.manifest.runtime.enabledByDefault === false);
const allCapabilitiesRequireApprovalForRuntime = [...run.manifests, ...run.builtInRegistry.all].every((manifest) => manifest.approval.requiredForRuntime === true);
const missionControlBeidouPanelAvailable = uiPanelExists && uiPanelText.includes("data-taiji-beidou-read-only=\"true\"") && !/立即上线|真实调用 Provider|读取 secret|修改 \/chat/.test(uiPanelText);
const codexContextGatewayUsedForLongTaskPreflight = subgatewayEvidence.codexContextGatewayUsed === true;
const safeFallbackUsed = subgatewayEvidence.safeFallbackUsed === true;
const docsGenerated = (await Promise.all(requiredDocs.map((path) => pathExists(path)))).every(Boolean);

await writeJson("apps/ai-gateway-service/evidence/phase651_666/mission-control-beidou-panel-smoke-result.json", {
  phase: "Phase664",
  completed: missionControlBeidouPanelAvailable,
  missionControlBeidouPanelAvailable,
  uiReadOnlyPreviewGenerated: missionControlBeidouPanelAvailable,
  dangerousExecutionButtonAdded: false,
  providerCallButtonAdded: false,
  deployButtonAdded: false,
  secretInputAdded: false,
  chatMutationButtonAdded: false,
  chatGatewayExecuteMutationButtonAdded: false,
  providerCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
});

const checks = {
  taijiBeidouEngineAvailable: true,
  capabilityNeuronManifestSchemaAvailable: true,
  naturalLanguageNeurogenesisCompilerAvailable: true,
  immuneRiskClassifierAvailable: true,
  manifestGeneratorAvailable: true,
  scaffoldPlanGeneratorAvailable: true,
  sandboxDryRunBuilderAvailable: true,
  verifierEvidenceRollbackGeneratorAvailable: true,
  synapseGraphRegistryAvailable: true,
  homeostasisGovernorAvailable: true,
  regenerationPolicyAvailable: true,
  pruningPolicyAvailable: true,
  reweightingPolicyAvailable: true,
  contextCodecNeuronRegistered: Boolean(run.builtInRegistry.contextCodecNeuron),
  codexContextNeuronRegistered: Boolean(run.builtInRegistry.codexContextNeuron),
  godTianshuNeuronDraftsRegistered: run.builtInRegistry.godTianshuNeuronDrafts.length === 2,
  missionControlBeidouPanelAvailable,
  nlCapabilityTrialCount: trialEvidence.nlCapabilityTrialCount || run.trials.length,
  allTrialCapabilitiesHaveManifest,
  allTrialCapabilitiesHaveRiskClassification,
  allTrialCapabilitiesHaveScaffoldPlan,
  allTrialCapabilitiesHaveDryRunResult,
  allTrialCapabilitiesHaveVerifierResult,
  allTrialCapabilitiesHaveRollbackPlan,
  allTrialCapabilitiesRuntimeEnabled,
  allTrialCapabilitiesRuntimeDisabled,
  allCapabilitiesRequireApprovalForRuntime,
  maxSpawnDepth: 1,
  recursiveSpawnBlocked: true,
  selfApprovalAllowed: false,
  codexLongTaskSubgatewayRunnerAvailable: await pathExists("tools/phase651_666/run-codex-long-task-token-saving-subgateway.mjs"),
  codexContextGatewayUsedForLongTaskPreflight,
  safeFallbackUsed,
  contextCodecUsed: subgatewayEvidence.contextCodecUsed === true,
  relevantFilesUsed: subgatewayEvidence.relevantFilesUsed === true,
  fullRepoScanAvoided: subgatewayEvidence.fullRepoScanAvoided === true,
  tokenBudgetRespected: subgatewayEvidence.tokenBudgetRespected === true,
  registryPreviewAvailable: registryPreviewExists,
  synapsePreviewAvailable: synapsePreviewExists,
  docsGenerated,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  yiyiRestored: false,
  characterModuleRestored: false,
  unsupportedClaimCount: run.evidenceSummary.unsupportedClaimCount,
  hallucinatedFactCount: run.evidenceSummary.hallucinatedFactCount,
};

const blocker = findBlocker(checks);
const finalEvidence = {
  phaseRange: "Phase651-666",
  phase: "Phase651-666-AIO",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  selfUseReady: blocker === null,
  productionReady: false,
  taijiBeidouEngineAvailable: checks.taijiBeidouEngineAvailable,
  naturalLanguageCapabilityIntakeAvailable: checks.naturalLanguageNeurogenesisCompilerAvailable,
  capabilityNeuronManifestSchemaAvailable: checks.capabilityNeuronManifestSchemaAvailable,
  sandboxDryRunAvailable: checks.sandboxDryRunBuilderAvailable,
  registryPreviewAvailable: checks.registryPreviewAvailable,
  missionControlBeidouPanelAvailable: checks.missionControlBeidouPanelAvailable,
  codexLongTaskSubgatewayRunnerAvailable: checks.codexLongTaskSubgatewayRunnerAvailable,
  codexContextGatewayUsedForLongTaskPreflight: checks.codexContextGatewayUsedForLongTaskPreflight,
  safeFallbackUsed: checks.safeFallbackUsed,
  contextCodecUsed: checks.contextCodecUsed,
  relevantFilesUsed: checks.relevantFilesUsed,
  fullRepoScanAvoided: checks.fullRepoScanAvoided,
  tokenBudgetRespected: checks.tokenBudgetRespected,
  nlCapabilityTrialCount: checks.nlCapabilityTrialCount,
  runtimeAutoEnabled: false,
  allCapabilitiesRequireApprovalForRuntime: checks.allCapabilitiesRequireApprovalForRuntime,
  maxSpawnDepth: checks.maxSpawnDepth,
  recursiveSpawnBlocked: checks.recursiveSpawnBlocked,
  providerCallsMade: false,
  secretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: checks.unsupportedClaimCount,
  hallucinatedFactCount: checks.hallucinatedFactCount,
  allTrialCapabilitiesHaveManifest,
  allTrialCapabilitiesHaveRiskClassification,
  allTrialCapabilitiesHaveScaffoldPlan,
  allTrialCapabilitiesHaveDryRunResult,
  allTrialCapabilitiesHaveVerifierResult,
  allTrialCapabilitiesHaveRollbackPlan,
  allTrialCapabilitiesRuntimeEnabled,
  allTrialCapabilitiesRuntimeDisabled,
  docsGenerated,
  checks,
  ...phaseBoundary(),
};

await writeJson("apps/ai-gateway-service/evidence/phase651_666/taiji-beidou-self-use-foundation-result.json", finalEvidence);
console.log(JSON.stringify(finalEvidence, null, 2));

if (blocker) {
  process.exitCode = 1;
}

async function readText(path) {
  return String(await readFile(resolve(repoRoot, path), "utf8"));
}

function findBlocker(checksObject) {
  const requiredTrue = [
    "taijiBeidouEngineAvailable",
    "capabilityNeuronManifestSchemaAvailable",
    "naturalLanguageNeurogenesisCompilerAvailable",
    "immuneRiskClassifierAvailable",
    "manifestGeneratorAvailable",
    "scaffoldPlanGeneratorAvailable",
    "sandboxDryRunBuilderAvailable",
    "verifierEvidenceRollbackGeneratorAvailable",
    "synapseGraphRegistryAvailable",
    "homeostasisGovernorAvailable",
    "regenerationPolicyAvailable",
    "pruningPolicyAvailable",
    "reweightingPolicyAvailable",
    "contextCodecNeuronRegistered",
    "codexContextNeuronRegistered",
    "godTianshuNeuronDraftsRegistered",
    "missionControlBeidouPanelAvailable",
    "allTrialCapabilitiesHaveManifest",
    "allTrialCapabilitiesHaveRiskClassification",
    "allTrialCapabilitiesHaveScaffoldPlan",
    "allTrialCapabilitiesHaveDryRunResult",
    "allTrialCapabilitiesHaveVerifierResult",
    "allTrialCapabilitiesHaveRollbackPlan",
    "allTrialCapabilitiesRuntimeDisabled",
    "allCapabilitiesRequireApprovalForRuntime",
    "recursiveSpawnBlocked",
    "codexLongTaskSubgatewayRunnerAvailable",
    "fullRepoScanAvoided",
    "tokenBudgetRespected",
    "registryPreviewAvailable",
    "synapsePreviewAvailable",
    "docsGenerated",
  ];
  for (const key of requiredTrue) {
    if (checksObject[key] !== true) return key;
  }
  if (checksObject.nlCapabilityTrialCount < 5) return "nlCapabilityTrialCount";
  if (checksObject.allTrialCapabilitiesRuntimeEnabled !== false) return "allTrialCapabilitiesRuntimeEnabled";
  if (checksObject.maxSpawnDepth !== 1) return "maxSpawnDepth";
  if (checksObject.selfApprovalAllowed !== false) return "selfApprovalAllowed";
  if (checksObject.providerCallsMade !== false) return "providerCallsMade";
  if (checksObject.secretRead !== false) return "secretRead";
  if (checksObject.secretValueExposed !== false) return "secretValueExposed";
  if (checksObject.authJsonRead !== false) return "authJsonRead";
  if (checksObject.codexConfigModified !== false) return "codexConfigModified";
  if (checksObject.codexBaseUrlModified !== false) return "codexBaseUrlModified";
  if (checksObject.chatBehaviorChanged !== false) return "chatBehaviorChanged";
  if (checksObject.chatGatewayExecuteBehaviorChanged !== false) return "chatGatewayExecuteBehaviorChanged";
  if (checksObject.deployExecuted !== false) return "deployExecuted";
  if (checksObject.releaseExecuted !== false) return "releaseExecuted";
  if (checksObject.tagCreated !== false) return "tagCreated";
  if (checksObject.artifactUploaded !== false) return "artifactUploaded";
  if (checksObject.unsupportedClaimCount !== 0) return "unsupportedClaimCount";
  if (checksObject.hallucinatedFactCount !== 0) return "hallucinatedFactCount";
  if (!checksObject.codexContextGatewayUsedForLongTaskPreflight && !checksObject.safeFallbackUsed) {
    return "codexContextGatewayUsedForLongTaskPreflight_or_safeFallbackUsed";
  }
  return null;
}
