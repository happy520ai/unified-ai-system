import { compileNaturalLanguageCapability, classifyImmuneRisk, generateManifestDraft, generateScaffoldPlan } from "../../../../packages/taiji-beidou-engine/src/index.js";

export function buildTaijiBeidouCapabilityIntake(intakeText, options = {}) {
  const spec = compileNaturalLanguageCapability(intakeText, options);
  const riskClassification = classifyImmuneRisk(spec);
  const manifest = generateManifestDraft(spec, riskClassification);
  const scaffoldPlan = generateScaffoldPlan(spec, manifest);

  return {
    phase: "Phase651-666-AIO",
    dryRunOnly: true,
    naturalLanguageCapabilityIntakeAvailable: true,
    runtimeAutoEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    codexConfigModified: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    spec,
    riskClassification,
    manifest,
    scaffoldPlan,
  };
}
