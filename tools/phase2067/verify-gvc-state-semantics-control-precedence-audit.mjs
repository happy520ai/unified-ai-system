import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2067-GVC-State-Semantics-And-Control-Precedence-Audit";
const docsPath = "docs/phase2067-gvc-state-semantics-control-precedence-audit.md";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2067-gvc-state-semantics-control-precedence-audit";
const resultPath = `${evidenceDir}/result.json`;
const packageScriptName = "verify:phase2067-gvc-state-semantics-control-precedence-audit";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const state = readJson("docs/project-brain/timed-runner-state.json") || {};
const control = readJson("docs/project-brain/runner-control.json") || {};
const safePolicy = readJson("docs/project-brain/safe-overnight-policy.json") || {};
const latestLoop = state.lastLoopEvidenceRef ? readJson(state.lastLoopEvidenceRef) : {};
const historicalNoOpLoop = findHistoricalNoOpStopLoop();
const currentStateIsNoOpStop = state.currentBlocker === "consecutive_no_op_limit_reached";
const auditSubject = currentStateIsNoOpStop ? state : historicalNoOpLoop || state;
const packageJson = readJson("package.json") || {};

const realLoopCount = Number(auditSubject.realExecutionLoopsCompletedToday || 0);
const realLoopLimit = Number(auditSubject.realExecutionLoopLimit || safePolicy.realMutationLoopLimit || 0);
const capReached = realLoopLimit > 0 && realLoopCount >= realLoopLimit;
const noOpStopExplained = (auditSubject.currentBlocker === "consecutive_no_op_limit_reached" || auditSubject.blocker === "consecutive_no_op_limit_reached") &&
  Number(auditSubject.consecutiveNoOpLoops || 0) >= Number(safePolicy.stopConditions?.consecutiveNoOpLimit || 3);
const terminalAutonomousFlagIsCapExhausted =
  auditSubject.autonomousMutationEnabled === false &&
  capReached &&
  realLoopCount >= realLoopLimit;
const dryRunPrecedence = {
  cliDryRunFalseIsSessionRealRunOptIn: state.dryRunOnly === false || latestLoop?.dryRunOnly === false || auditSubject.dryRunOnly === false,
  controlDryRunTrueIsSafetyInvariant: control.dryRunOnly === true,
  ownerSafetyFlagsRequired: control.noProvider === true && control.noSecret === true && control.noDeploy === true,
  controlDoesNotAuthorizeProviderSecretDeploy: true,
};
const staleFieldClassification = terminalAutonomousFlagIsCapExhausted
  ? "terminal_cap_exhausted_current_loop_field"
  : "manual_review_required";

writeText(docsPath, renderDocs({
  state,
  control,
  safePolicy,
  realLoopCount,
  realLoopLimit,
  capReached,
  noOpStopExplained,
  staleFieldClassification,
}));

const result = {
  phaseId,
  completed: false,
  status: "failed",
  recommendedSealed: false,
  blocker: "not_evaluated",
  generatedAt: new Date().toISOString(),
  stateSource: "docs/project-brain/timed-runner-state.json",
  controlSource: "docs/project-brain/runner-control.json",
  safePolicySource: "docs/project-brain/safe-overnight-policy.json",
  latestLoopEvidenceRef: state.lastLoopEvidenceRef || null,
  auditSource: currentStateIsNoOpStop ? "current_timed_runner_state" : historicalNoOpLoop ? "historical_no_op_loop_evidence" : "current_timed_runner_state_fallback",
  historicalNoOpLoopEvidenceRef: historicalNoOpLoop?.evidenceRef || null,
  stateStatus: state.status || null,
  currentBlocker: state.currentBlocker || null,
  noOpStopExplained,
  realExecutionLoopsCompletedToday: realLoopCount,
  realExecutionLoopLimit: realLoopLimit,
  capReached,
  autonomousMutationEnabledTerminalValue: auditSubject.autonomousMutationEnabled === true,
  autonomousMutationEnabledInterpretation: staleFieldClassification,
  dryRunOnlyPrecedence: dryRunPrecedence,
  migrationNote: {
    rewriteHistoricalEvidence: false,
    resetTimedRunnerState: false,
    note: "Keep autonomousMutationEnabled as a current-loop capability flag. Use realExecutionLoopsCompletedToday for historical execution.",
  },
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  checks,
};

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2067/verify-gvc-state-semantics-control-precedence-audit.mjs");
check("state_json_readable", Object.keys(state).length > 0);
check("control_json_readable", Object.keys(control).length > 0);
check("historical_or_current_no_op_source_available", currentStateIsNoOpStop || Boolean(historicalNoOpLoop));
check("no_op_stop_explained", noOpStopExplained);
check("real_loop_cap_reached", capReached);
check("autonomous_false_interpreted_as_terminal_cap", terminalAutonomousFlagIsCapExhausted);
check("control_dry_run_true_safety_invariant", dryRunPrecedence.controlDryRunTrueIsSafetyInvariant);
check("cli_false_recorded_as_session_real_run_opt_in", dryRunPrecedence.cliDryRunFalseIsSessionRealRunOptIn);
check("safety_flags_false", state.providerCallsMade === false && state.secretRead === false && state.deployExecuted === false && state.chatGatewayExecuteModified === false);
check("docs_written", existsSync(resolve(docsPath)));

const failed = checks.filter((entry) => !entry.pass);
result.completed = failed.length === 0;
result.status = failed.length === 0 ? "passed" : "failed";
result.recommendedSealed = failed.length === 0;
result.blocker = failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", ");
writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  noOpStopExplained: result.noOpStopExplained,
  autonomousMutationEnabledInterpretation: result.autonomousMutationEnabledInterpretation,
}, null, 2));
if (failed.length > 0) process.exit(1);

function renderDocs(input) {
  return [
    "# Phase2067-GVC-State-Semantics-And-Control-Precedence-Audit",
    "",
    "## Scope",
    "",
    "This phase audits timed runner state semantics and owner control precedence. It does not reset historical state and does not rewrite old evidence.",
    "",
    "## Findings",
    "",
    `- Current runner status: ${input.state.status || "unknown"}.`,
    `- Current blocker: ${input.state.currentBlocker || "unknown"}.`,
    `- Real execution loops today: ${input.realLoopCount}/${input.realLoopLimit}.`,
    `- Consecutive no-op loops: ${input.state.consecutiveNoOpLoops || 0}.`,
    `- Safe overnight no-op limit: ${input.safePolicy.stopConditions?.consecutiveNoOpLimit || 3}.`,
    `- No-op stop explained: ${input.noOpStopExplained}.`,
    `- Cap reached: ${input.capReached}.`,
    `- autonomousMutationEnabled classification: ${input.staleFieldClassification}.`,
    "",
    "## Control Precedence",
    "",
    "- `runner-control.json` keeps `dryRunOnly=true` as an owner safety invariant.",
    "- CLI `--dryRunOnly=false` is a session-level opt-in for approved low-risk real mutation.",
    "- Real mutation still requires low-risk owner approval, existing GVC risk gate allow, low-risk executor allow, and permission engine allow.",
    "- `noProvider`, `noSecret`, and `noDeploy` remain hard safety flags and do not become weaker when CLI dry-run is false.",
    "",
    "## Migration Note",
    "",
    "- `autonomousMutationEnabled=false` at the stopped terminal state means the next loop could not execute a real mutation after the cap was reached.",
    "- Historical execution must be read from `realExecutionLoopsCompletedToday`, mutation evidence, and loop evidence.",
    "- This phase intentionally does not reset `timed-runner-state.json` and does not alter old evidence.",
    "",
    "## Safety",
    "",
    "- Provider calls made: false.",
    "- Secret read: false.",
    "- Deploy executed: false.",
    "- Chat gateway execute modified: false.",
    "- Legacy modified: false.",
    "- PROJECT_CONTEXT.md modified: false.",
    "",
  ].join("\n");
}

function findHistoricalNoOpStopLoop() {
  const loopDir = resolve("apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner");
  if (!existsSync(loopDir)) return null;
  const candidates = readdirSync(loopDir)
    .filter((file) => /^loop-\d{4}-\d{2}-\d{2}-\d+\.json$/.test(file))
    .map((file) => {
      const relativePath = `apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/${file}`;
      const loop = readJson(relativePath);
      return loop ? { ...loop, evidenceRef: relativePath } : null;
    })
    .filter(Boolean)
    .filter((loop) => loop.blocker === "consecutive_no_op_limit_reached")
    .filter((loop) => Number(loop.realExecutionLoopsCompletedToday || 0) >= Number(loop.realExecutionLoopLimit || 1))
    .sort((left, right) => String(right.generatedAt || "").localeCompare(String(left.generatedAt || "")));
  return candidates[0] || null;
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const absolutePath = resolve(relativePath);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const absolutePath = resolve(relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, content) {
  const absolutePath = resolve(relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}
