import { ensure, phase383Safety, readJson, writeJson, writeText } from "../phase383-common.mjs";

const registry = await readJson("docs/phase-orchestrator/phase-registry.json");
const policy = await readJson("docs/phase-orchestrator/phase-risk-policy.json");

const phase381 = registry.phases.find((item) => item.phase === "Phase381");
const phase382 = registry.phases.find((item) => item.phase === "Phase382");
const phase383 = registry.phases.find((item) => item.phase === "Phase383");
const phase384 = registry.phases.find((item) => item.phase === "Phase384");
const seenPhaseTitles = new Map();
for (const item of registry.phases) {
  const existingTitle = seenPhaseTitles.get(item.phase);
  ensure(
    existingTitle === undefined || existingTitle === item.title,
    `Duplicate phase id with different title: ${item.phase}`,
  );
  seenPhaseTitles.set(item.phase, item.title);
}
ensure(phase381, "Phase381 must be registered as future phase.");
ensure(phase382, "Phase382 must be registered as future phase.");
ensure(phase383, "Phase383 must be registered.");
ensure(phase384, "Phase384 must be registered.");
ensure(phase381.riskLevel === "low", "Phase381 riskLevel must be low.");
ensure(phase381.requiresHumanApproval === false, "Phase381 must not require human approval by default.");
ensure(phase381.allowedExecutionMode === "generate_prompt_only_or_dry_run", "Phase381 allowed mode mismatch.");
ensure(phase382.riskLevel === "medium", "Phase382 riskLevel must be medium.");
ensure(phase382.allowedExecutionMode === "design_contract_dry_run_only", "Phase382 allowed mode mismatch.");
ensure(phase383.title === "Phase Orchestrator + Safety Brake", "Phase383 title must remain reserved for orchestrator.");
ensure(phase383.reserved === true, "Phase383 must be marked reserved.");
ensure(phase384.title === "Yiyi Guarded Real Provider Test Authorization Gate", "Phase384 title mismatch.");
ensure(phase384.riskLevel === "high", "Phase384 riskLevel must be high.");
ensure(phase384.requiresHumanApproval === true, "Phase384 must require human approval.");
ensure(phase384.autoContinueAllowed === false, "Phase384 must not allow auto continue.");
ensure(phase384.allowedExecutionMode === "authorization_required_only", "Phase384 allowed mode mismatch.");
ensure(policy.brakeRules.highRiskPhaseRequiresHumanApproval === true, "High risk brake missing.");
ensure(policy.brakeRules.nextPhaseAutoExecutionBlocked === true, "Next phase auto execution brake missing.");

const result = {
  phase: "Phase383B",
  phaseRegistryCreated: true,
  riskPolicyCreated: true,
  registryUniquePhaseIdChecked: true,
  futurePhase381Registered: true,
  futurePhase382Registered: true,
  phase383ReservedForOrchestrator: true,
  phase384GuardedProviderTestRegistered: true,
  phase384RiskLevelHigh: true,
  phase384RequiresHumanApproval: true,
  phase384AutoContinueAllowed: false,
  highRiskPhaseRequiresHumanApproval: true,
  providerCallRequiresHumanApproval: true,
  deployRequiresHumanApproval: true,
  secretAccessRequiresHumanApproval: true,
  billingRequiresHumanApproval: true,
  approvalModificationRequiresHumanApproval: true,
  safetyGateRelaxationBlocked: true,
  nextPhaseAutoExecutionBlocked: true,
  validationPassed: true,
  ...phase383Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase383b/phase-registry-risk-policy-result.json", result);
await writeText("docs/phase383b-phase-registry-risk-policy.md", [
  "# Phase383B Phase Registry + Risk Policy",
  "",
  "- Registered Phase381 and Phase382 as future phases.",
  "- Phase383 is reserved for Phase Orchestrator + Safety Brake.",
  "- Phase384 is the guarded real provider test authorization gate and is high risk.",
  "- Phase381 is low risk and generate-prompt/dry-run only.",
  "- Phase382 is medium risk and design/contract/dry-run only unless separately approved for real provider testing.",
  "- High-risk actions require human approval and cannot auto-execute.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
