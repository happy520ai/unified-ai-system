import { buildBuiltInNeuronRegistry } from "./builtInNeuronRegistry.js";
import { compileNaturalLanguageCapabilities } from "./naturalLanguageNeurogenesisCompiler.js";
import { classifyImmuneRisk } from "./immuneRiskClassifier.js";
import { generateManifestDrafts } from "./manifestGenerator.js";
import { generateScaffoldPlans } from "./scaffoldPlanGenerator.js";
import { runSandboxDryRuns } from "./sandboxDryRunBuilder.js";
import { generateVerifierEvidenceRollbacks } from "./verifierEvidenceRollbackGenerator.js";
import { buildSynapseGraphRegistry } from "./synapseGraphRegistry.js";
import { applyHomeostasisPolicies } from "./homeostasisGovernor.js";
import { buildRegenerationPolicy } from "./regenerationPolicy.js";
import { buildPruningPolicy } from "./pruningPolicy.js";
import { buildReweightingPolicy } from "./reweightingPolicy.js";
import { sampleNaturalLanguageIntakes } from "./sampleNaturalLanguageIntakes.js";
import { buildTaijiEvidenceSummary } from "./taijiEvidenceBuilder.js";

export function createTaijiKernel(options = {}) {
  return {
    engineName: "Taiji / Beidou Engine",
    engineAlias: ["太极", "北斗引擎"],
    phaseRange: "Phase651-666",
    coreRole: "main-gateway-self-evolution-and-capability-regeneration-kernel",
    productionReady: false,
    runtimeAutoEnabled: false,
    selfApprovalAllowed: false,
    maxSpawnDepth: 1,
    recursiveSpawnBlocked: true,
    options,
  };
}

export function runTaijiBeidouSelfUseDryRun(intakes = sampleNaturalLanguageIntakes, options = {}) {
  const kernel = createTaijiKernel(options);
  const specs = compileNaturalLanguageCapabilities(intakes);
  const risks = specs.map((spec) => classifyImmuneRisk(spec));
  const manifests = generateManifestDrafts(specs, risks);
  const scaffoldPlans = generateScaffoldPlans(specs, manifests);
  const dryRunResults = runSandboxDryRuns(specs, manifests, scaffoldPlans);
  const verifierBundles = generateVerifierEvidenceRollbacks(specs, manifests, dryRunResults);
  const homeostasis = applyHomeostasisPolicies(manifests);
  const builtInRegistry = buildBuiltInNeuronRegistry();
  const allManifests = [...manifests, ...builtInRegistry.all];
  const synapseGraph = buildSynapseGraphRegistry(allManifests);
  const regenerationPolicy = buildRegenerationPolicy(allManifests);
  const pruningPolicy = buildPruningPolicy(allManifests);
  const reweightingPolicy = buildReweightingPolicy(allManifests);
  const trials = specs.map((spec, index) => ({
    spec,
    riskClassification: risks[index],
    manifest: manifests[index],
    scaffoldPlan: scaffoldPlans[index],
    dryRunResult: dryRunResults[index],
    verifier: verifierBundles[index],
    rollbackPlan: verifierBundles[index].rollbackPlan,
    registryPreview: {
      capabilityId: manifests[index].capabilityId,
      status: manifests[index].status,
      runtimeEnabled: false,
    },
  }));

  const run = {
    kernel,
    specs,
    risks,
    manifests,
    scaffoldPlans,
    dryRunResults,
    verifierBundles,
    homeostasis,
    builtInRegistry,
    synapseGraph,
    regenerationPolicy,
    pruningPolicy,
    reweightingPolicy,
    trials,
  };

  return {
    ...run,
    evidenceSummary: buildTaijiEvidenceSummary(run),
  };
}
