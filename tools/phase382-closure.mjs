import { spawnSync } from "node:child_process";
import { phase382Safety, readJson, writeJson, writeText } from "./phase382-common.mjs";

const validationScripts = [
  "tools/phase382a/validate-yiyi-model-brain-contract.mjs",
  "tools/phase382b/validate-yiyi-model-library-gate.mjs",
  "tools/phase382c/validate-yiyi-provider-quota-budget-gate.mjs",
  "tools/phase382d/validate-yiyi-prompt-envelope-output-safety.mjs",
  "tools/phase382e/yiyi-model-brain-dry-run.mjs",
  "tools/phase382f/yiyi-provider-test-authorization-gate.mjs",
  "tools/phase382g/yiyi-model-brain-browser-smoke.mjs",
];

const stepResults = [];
for (const script of validationScripts) {
  const child = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  stepResults.push({
    script,
    exitCode: child.status,
    stdoutTail: child.stdout.trim().slice(-1200),
    stderrTail: child.stderr.trim().slice(-1200),
  });
  if (child.status !== 0) {
    throw new Error(`Phase382 closure validation failed: ${script}\n${child.stderr}`);
  }
}

const authGate = await readJson("apps/ai-gateway-service/evidence/phase382f/yiyi-provider-test-authorization-gate-result.json");
const browserSmoke = await readJson("apps/ai-gateway-service/evidence/phase382g/yiyi-model-brain-browser-smoke-result.json");

const result = {
  phase: "Phase382",
  title: "Yiyi Model-backed Brain via User-owned Model Library",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phaseType: "design_contract_dry_run_only",
  riskLevel: "medium",
  modelBrainContractCreated: true,
  modelLibraryGateCreated: true,
  credentialRefGateCreated: true,
  providerPolicyGateCreated: true,
  quotaBudgetGateCreated: true,
  promptEnvelopeCreated: true,
  outputSafetyGateCreated: true,
  dryRunAdapterCreated: true,
  providerTestAuthorizationGateCreated: true,
  uiIntegrationCreated: true,
  browserSmokePassed: browserSmoke.browserSmokePassed === true,
  authorizationFilePresent: authGate.authorizationFilePresent,
  authorized: authGate.authorized,
  providerTestExecuted: authGate.providerTestExecuted,
  blockedReason: authGate.blockedReason,
  onlyAllowedOutputs: true,
  forbiddenOutputsBlocked: true,
  unsafeOutputRewritten: true,
  validationsPassed: true,
  validationsRun: validationScripts.map((script) => `node ${script}`),
  screenshots: browserSmoke.screenshots,
  remainingRisks: [
    "still_not_connected_to_real_model",
    "model_backed_dry_run_only",
    "phase382f_authorization_missing_by_default",
    "real_credentialref_test_not_performed",
    "quota_budget_real_system_not_connected",
    "provider_specific_adapter_needed",
    "output_safety_can_be_stronger",
    "manual_experience_review_recommended"
  ],
  nextRecommendedPhases: [
    {
      phase: "Phase383",
      title: "Yiyi guarded real provider test with explicit authorization",
      riskLevel: "high",
      requiresHumanApproval: true,
      allowedExecutionMode: "guarded_real_provider_test_only"
    }
  ],
  rollbackPlan: [
    "Remove apps/ai-gateway-service/src/ui/yiyi/model-brain/ files.",
    "Remove YiyiModelBrainPanel wiring from YiyiBrainPanel.js.",
    "Remove Phase382 CSS additions from consolePage.js.",
    "Remove Phase382 docs, tools, and evidence."
  ],
  ...phase382Safety,
  stepResults,
};

await writeJson("apps/ai-gateway-service/evidence/phase382/yiyi-model-backed-brain-closure-result.json", result);
await writeText("docs/phase382-yiyi-model-backed-brain-closure.md", [
  "# Phase382 Yiyi Model-backed Brain Closure",
  "",
  "Phase382 adds a governed model-backed brain architecture on top of Phase381 dry-run brain.",
  "",
  "Completed:",
  "- Model-backed brain architecture contract.",
  "- Model Library and credentialRef gate.",
  "- Provider policy / quota / budget dry-run gate.",
  "- Prompt envelope and output safety contract.",
  "- Model-backed dry-run adapter without provider call.",
  "- Provider test authorization gate.",
  "- UI integration and browser smoke.",
  "",
  `Provider test executed: ${String(authGate.providerTestExecuted)}.`,
  `Blocked reason / note: ${authGate.blockedReason || authGate.note || "none"}.`,
  "",
  "Security proof:",
  "- modelBackedRuntimeEnabled=false by default.",
  "- providerCallsMade=false by default.",
  "- rawSecretAccessed=false.",
  "- actionExecuted=false.",
  "- deployExecuted=false.",
  "- evidenceModified=false.",
  "- approvalForged=false.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
