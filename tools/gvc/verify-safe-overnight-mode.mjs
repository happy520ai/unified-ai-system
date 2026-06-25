import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const repoRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}


const policyPath = "docs/project-brain/safe-overnight-policy.json";
const runnerPath = "tools/gvc/run-timed-local-runner.mjs";
const packagePath = "package.json";

assert(existsSync(path.join(repoRoot, policyPath)), "missing safe overnight policy");
assert(existsSync(path.join(repoRoot, runnerPath)), "missing timed runner");

const policy = readJson(policyPath);
const packageJson = readJson(packagePath);
const runnerSource = readFileSync(path.join(repoRoot, runnerPath), "utf8");

const checks = [
  ["policy_enabled", policy.enabled === true],
  ["interval_30000", policy.intervalMs === 30000],
  ["daily_loop_limit_500", policy.dailyLoopLimit === 500],
  ["real_mutation_loop_limit_30", policy.realMutationLoopLimit === 30],
  ["max_tasks_per_loop_1", policy.maxTasksPerLoop === 1],
  ["emergency_stop_file_runner_control", policy.emergencyStopFile === "docs/project-brain/runner-control.json"],
  ["consecutive_noop_stop_3", policy.stopConditions?.consecutiveNoOpLimit === 3],
  ["verifier_fail_stop_2", policy.stopConditions?.consecutiveVerifierFailLimit === 2],
  ["rollback_fail_stop", policy.stopConditions?.rollbackFailureLimit === 0],
  ["same_file_touch_limit_3", policy.stopConditions?.sameFileTouchLimitPerDay === 3],
  ["low_value_blocked_stop_2", policy.stopConditions?.consecutiveLowValueBlockedLimit === 2],
  ["provider_secret_deploy_chat_risk_stop", policy.stopConditions?.providerSecretDeployChatRiskStopsImmediately === true],
  ["provider_forbidden", policy.forbiddenActions?.includes("provider_call")],
  ["secret_forbidden", policy.forbiddenActions?.includes("secret_read")],
  ["deploy_forbidden", policy.forbiddenActions?.includes("deploy")],
  ["push_commit_forbidden", policy.forbiddenActions?.includes("push") && policy.forbiddenActions?.includes("commit")],
  ["legacy_forbidden", policy.forbiddenPaths?.includes("legacy/")],
  ["project_context_forbidden", policy.forbiddenPaths?.includes("PROJECT_CONTEXT.md")],
  ["chat_route_forbidden", policy.forbiddenPaths?.includes("/chat") && policy.forbiddenPaths?.includes("/chat-gateway/execute")],
  ["mutation_summary_required", policy.mutationSummaryRequiredEveryLoop === true],
  ["runner_reads_safe_policy", runnerSource.includes("readSafeOvernightPolicy")],
  ["runner_writes_mutation_summary", runnerSource.includes("writeMutationSummaryEvidence")],
  ["runner_tracks_noop", runnerSource.includes("consecutiveNoOpLoops")],
  ["runner_tracks_low_value", runnerSource.includes("consecutiveLowValueBlockedLoops")],
  ["runner_tracks_same_file_touch", runnerSource.includes("same_file_touch_limit_reached")],
  ["runner_stops_on_rollback_fail", runnerSource.includes("rollback_failed")],
  ["runner_keeps_paused_stop_control", runnerSource.includes("ownerControl.paused") && runnerSource.includes("ownerControl.stopRequested")],
  ["script_registered", packageJson.scripts?.["verify:gvc-safe-overnight-mode"] === "node tools/gvc/verify-safe-overnight-mode.mjs"],
];

const failed = checks.filter(([, passed]) => !passed);
const result = {
  phaseId: "SafeOvernightMode",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  policyPath,
  runnerPath,
  intervalMs: policy.intervalMs,
  dailyLoopLimit: policy.dailyLoopLimit,
  realMutationLoopLimit: policy.realMutationLoopLimit,
  maxTasksPerLoop: policy.maxTasksPerLoop,
  emergencyStopFile: policy.emergencyStopFile,
  checks: checks.map(([id, passed]) => ({ id, passed })),
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map(([id]) => id).join(", "),
  workspaceCleanClaimed: false,
};

writeEvidenceFile("apps/ai-gateway-service/evidence/safe-overnight-mode/safe-overnight-mode-verify-result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));

if (failed.length > 0) process.exit(1);
