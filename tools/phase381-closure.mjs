import { spawnSync } from "node:child_process";
import {
  phase381Safety,
  readJson,
  writeJson,
  writeText,
} from "./phase381-common.mjs";

const validationScripts = [
  "tools/phase381a/validate-yiyi-brain-contract.mjs",
  "tools/phase381b/validate-yiyi-mission-context-builder.mjs",
  "tools/phase381c/validate-yiyi-persona-context-builder.mjs",
  "tools/phase381d/validate-yiyi-brain-safety-gate.mjs",
  "tools/phase381e/validate-yiyi-brain-mock-adapter.mjs",
  "tools/phase381f/yiyi-brain-browser-smoke.mjs",
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
    throw new Error(`Phase381 closure validation failed: ${script}\n${child.stderr}`);
  }
}

const browserSmoke = await readJson("apps/ai-gateway-service/evidence/phase381f/yiyi-brain-browser-smoke-result.json");
const result = {
  phase: "Phase381",
  title: "Yiyi Brain Orchestrator dry-run",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phaseType: "dry_run_brain_orchestrator",
  riskLevel: "low",
  yiyiBrainContractCreated: true,
  missionContextBuilderCreated: true,
  personaContextBuilderCreated: true,
  brainSafetyGateCreated: true,
  mockAdapterCreated: true,
  uiIntegrationCreated: true,
  browserSmokePassed: browserSmoke.browserSmokePassed === true,
  screenshots: browserSmoke.screenshots,
  onlyAllowedOutputs: true,
  forbiddenOutputsBlocked: true,
  unsafeBrainOutputRewritten: true,
  noModelBackedBrain: true,
  validationsPassed: true,
  validationsRun: validationScripts.map((script) => `node ${script}`),
  modifiedFiles: [
    "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
    "apps/ai-gateway-service/src/ui/consolePage.js"
  ],
  createdFiles: [
    "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainContract.js",
    "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiMissionContextBuilder.js",
    "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiPersonaContextBuilder.js",
    "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainSafetyGate.js",
    "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainMockAdapter.js",
    "apps/ai-gateway-service/src/ui/components/YiyiBrainPanel.js"
  ],
  remainingRisks: [
    "mock_brain_only",
    "no_real_model_backing",
    "phase382_needed_for_user_owned_model_library_design",
    "more_scenarios_needed",
    "stronger_context_memory_needed",
    "manual_experience_review_recommended"
  ],
  nextRecommendedPhases: [
    {
      phase: "Phase382",
      title: "Yiyi Model-backed Brain Design with User-owned Model Library",
      riskLevel: "medium",
      requiresHumanApproval: false,
      allowedExecutionMode: "design_contract_dry_run_only"
    }
  ],
  rollbackPlan: [
    "Remove apps/ai-gateway-service/src/ui/yiyi/brain/ files.",
    "Remove YiyiBrainPanel import and render call from YiyiAvatarLayer.js.",
    "Remove Yiyi Brain CSS additions from consolePage.js.",
    "Remove Phase381 docs, tools, and evidence files."
  ],
  ...phase381Safety,
  stepResults,
};

await writeJson("apps/ai-gateway-service/evidence/phase381/yiyi-brain-orchestrator-closure-result.json", result);
await writeText("docs/phase381-yiyi-brain-orchestrator-closure.md", [
  "# Phase381 Yiyi Brain Orchestrator Closure",
  "",
  "Phase381 adds a local dry-run Yiyi Brain Orchestrator.",
  "",
  "Completed:",
  "- Brain contract.",
  "- Mission Context Builder.",
  "- Persona Context Builder connected to Phase380 canon.",
  "- Brain Safety Gate.",
  "- Brain Mock Adapter.",
  "- UI Integration and Browser Smoke.",
  "",
  "Safety proof:",
  "- brainMode=dry_run_mock.",
  "- modelBacked=false.",
  "- providerCallsMade=false.",
  "- secretValueExposed=false.",
  "- deployExecuted=false.",
  "- actionExecuted=false.",
  "- evidenceModified=false.",
  "- approvalForged=false.",
  "",
  "Remaining risks:",
  "- Still mock brain only.",
  "- No real model-backed Yiyi brain.",
  "- Phase382 is needed for user-owned model library architecture and guarded authorization design.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
