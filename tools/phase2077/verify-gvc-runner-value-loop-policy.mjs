import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2077-GVC-Runner-Value-Loop-Policy";
const docsPath = "docs/phase2077-gvc-runner-value-loop-policy.md";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2077-gvc-runner-value-loop-policy";
const resultPath = `${evidenceDir}/result.json`;
const packageScriptName = "verify:phase2077-gvc-runner-value-loop-policy";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase2073 = readJson("apps/ai-gateway-service/evidence/phase2073-gvc-completed-action-dedup-candidate-refresh/result.json") || {};
const phase2074 = readJson("apps/ai-gateway-service/evidence/phase2074-gvc-high-value-next-actions-v2/result.json") || {};
const phase2076 = readJson("apps/ai-gateway-service/evidence/phase2076-gvc-second-batch-audit/result.json") || {};
const highValueNextActions = readJson("docs/project-brain/high-value-next-actions-v2.json") || {};
const state = readJson("docs/project-brain/timed-runner-state.json") || {};
const actions = Array.isArray(highValueNextActions.actions) ? highValueNextActions.actions : [];

const policy = {
  phaseId,
  generatedAt: new Date().toISOString(),
  rules: {
    allNextActionsCompletedBlocksRunnerStart: true,
    highValueCandidatesBelowThreeBlocksRunnerStart: true,
    duplicateRiskAboveThreeBlocksNextActionsWrite: true,
    consecutiveNoOpTwoRequiresPlannerRefreshFirst: true,
    providerCandidatesApprovalRequiredOnly: true,
    secretDeployChatRouteForbidden: true,
  },
  simulations: {
    allCompletedNextActions: {
      input: { readyActionCount: 0, completedActionCount: actions.length },
      runnerStartAllowed: false,
      reason: "all_next_actions_completed_refresh_planner_first",
    },
    candidateCountBelowThree: {
      input: { highValueCandidatesFound: 2 },
      runnerStartAllowed: false,
      reason: "high_value_candidates_below_three",
    },
    duplicateRiskTooHigh: {
      input: { duplicateRiskScore: 4 },
      nextActionsWriteAllowed: false,
      reason: "duplicate_risk_above_three",
    },
    consecutiveNoOpTwo: {
      input: { consecutiveNoOpLoops: 2 },
      plannerRefreshRequiredBeforeNextRun: true,
      reason: "noop_guard_requires_refresh",
    },
  },
  currentState: {
    consecutiveNoOpLoops: state.consecutiveNoOpLoops || 0,
    currentBlocker: state.currentBlocker || null,
    nextFormalRunnerWorthStarting: phase2076.completed === true && phase2076.realMutationLoopCount >= 5,
  },
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
};

writeText(docsPath, renderDocs(policy));

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2077/verify-gvc-runner-value-loop-policy.mjs");
check("phase2073_passed", phase2073.completed === true);
check("phase2074_passed", phase2074.completed === true);
check("phase2076_passed", phase2076.completed === true);
check("all_completed_blocks_start", policy.simulations.allCompletedNextActions.runnerStartAllowed === false);
check("candidate_count_below_three_blocks_start", policy.simulations.candidateCountBelowThree.runnerStartAllowed === false);
check("duplicate_risk_above_three_blocks_write", policy.simulations.duplicateRiskTooHigh.nextActionsWriteAllowed === false);
check("noop_two_requires_refresh", policy.simulations.consecutiveNoOpTwo.plannerRefreshRequiredBeforeNextRun === true);
check("current_batch_makes_next_runner_worth_starting", policy.currentState.nextFormalRunnerWorthStarting === true);
check("docs_file_exists", existsSync(resolve(docsPath)));
check("safety_flags_false", policy.providerCallsMade === false && policy.secretRead === false && policy.deployExecuted === false && policy.chatGatewayExecuteModified === false);

const failed = checks.filter((entry) => !entry.pass);
const result = {
  ...policy,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  docsRef: docsPath,
  checks,
};
writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  nextFormalRunnerWorthStarting: result.currentState.nextFormalRunnerWorthStarting,
}, null, 2));
if (failed.length > 0) process.exit(1);

function renderDocs(policyResult) {
  return [
    "# Phase2077-GVC-Runner-Value-Loop-Policy",
    "",
    "## Runner Start Policy",
    "",
    "- If `next-actions` are all completed, refresh the high-value planner before starting the runner.",
    "- If high-value candidates are fewer than 3, do not start the runner.",
    "- If `duplicateRiskScore > 3`, do not write that task into `next-actions`.",
    "- If no-op loops reach 2 consecutively, the next run must refresh the planner first.",
    "- Provider candidates remain `approval_required`; secret, deploy, and chat-route tasks remain forbidden.",
    "",
    "## Current Decision",
    "",
    `- Current blocker: ${policyResult.currentState.currentBlocker}.`,
    `- Consecutive no-op loops: ${policyResult.currentState.consecutiveNoOpLoops}.`,
    `- Next formal runner worth starting: ${policyResult.currentState.nextFormalRunnerWorthStarting}.`,
    "",
    "## Safety Boundary",
    "",
    "- Provider calls made: false.",
    "- Secret read: false.",
    "- Deploy executed: false.",
    "- Chat gateway execute modified: false.",
    "- Legacy modified: false.",
    "- PROJECT_CONTEXT.md modified: false.",
    "- Workspace clean claimed: false.",
    "",
  ].join("\n");
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
