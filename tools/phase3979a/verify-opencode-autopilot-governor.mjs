import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runOpencodeAutopilotGovernor } from "./run-opencode-autopilot-governor.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function hasScript(packageJson, name) {
  return Boolean(packageJson.scripts && packageJson.scripts[name]);
}

async function main() {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  assert(hasScript(packageJson, "run:phase3979a-opencode-autopilot-governor"), "missing run:phase3979a-opencode-autopilot-governor");
  assert(hasScript(packageJson, "verify:phase3979a-opencode-autopilot-governor"), "missing verify:phase3979a-opencode-autopilot-governor");
  assert(hasScript(packageJson, "status:phase3979a-opencode-autopilot"), "missing status:phase3979a-opencode-autopilot");

  const queueFile = path.join(repoRoot, "docs/automation/opencode-autopilot-task-queue.json");
  const policyFile = path.join(repoRoot, "docs/project-brain/opencode-autopilot-policy.json");
  const stateFile = path.join(repoRoot, "docs/project-brain/opencode-autopilot-state.json");
  const docFile = path.join(repoRoot, "docs/phase3979a-opencode-autopilot-governor.md");
  const latestRunFile = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase3979a-opencode-autopilot-governor/latest-run.json");
  const opencodeConfig = path.join(repoRoot, "opencode.jsonc");

  assert(existsSync(queueFile), "missing autopilot queue file");
  assert(existsSync(policyFile), "missing autopilot policy file");
  assert(existsSync(stateFile), "missing autopilot state file");
  assert(existsSync(docFile), "missing phase3979a doc file");
  assert(existsSync(opencodeConfig), "missing opencode config");

  const queue = readJson(queueFile);
  const policy = readJson(policyFile);
  assert(Array.isArray(queue.tasks) && queue.tasks.length >= 3, "queue must contain at least 3 tasks");
  assert(policy.enabled === true, "autopilot policy must be enabled");
  assert(policy.stopOnVerifierFailure === true, "verifier failure stop must be enabled");
  assert(policy.stopOnOutOfScopeMutation === true, "out-of-scope stop must be enabled");
  assert(policy.stopOnBudgetExceeded === true, "budget stop must be enabled");
  assert(Array.isArray(policy.commandWhitelist) && policy.commandWhitelist.length >= 4, "command whitelist missing");

  const result = runOpencodeAutopilotGovernor({
    repoRoot,
    dryRun: true,
    maxRounds: 1,
    resetState: true
  });

  assert(result.phaseId === "Phase3979A-OpenCode-Autopilot-Governor", "phase id mismatch");
  assert(["passed", "stopped", "blocked"].includes(result.status), "unexpected run status");
  if (result.status === "passed") {
    assert(result.taskId === "phase3979a-autopilot-baseline-preflight", "first selected task should be baseline preflight");
    assert(result.commandWhitelistViolation === false, "whitelist should pass for seeded task");
    assert(result.outOfScopeMutationDetected === false, "seeded task must not cause out-of-scope mutation");
    assert(result.budgetExceeded === false, "seeded task must not hit budget");
  } else if (result.blocker === "git_status_snapshot_failed_before") {
    assert(result.snapshotFailureDetails, "git snapshot blocker must record details");
    assert(
      String(result.snapshotFailureDetails.error || result.snapshotFailureDetails.stderr || "").length > 0,
      "git snapshot blocker must include an error message"
    );
  } else {
    throw new Error(`unexpected blocker: ${result.blocker || "unknown"}`);
  }
  assert(result.providerCallsMade === false, "must not call providers");
  assert(result.secretRead === false, "must not read secrets");
  assert(result.deployExecuted === false, "must not deploy");
  assert(result.workspaceCleanClaimed === false, "must not claim workspace clean");
  assert(existsSync(latestRunFile), "latest run evidence must exist");

  const latestRun = readJson(latestRunFile);
  const state = readJson(stateFile);
  if (result.status === "passed") {
    assert(latestRun.taskId === "phase3979a-autopilot-baseline-preflight", "latest run task mismatch");
    assert(Array.isArray(latestRun.stageResults) && latestRun.stageResults.length === 5, "all 5 stages must be recorded");
    assert(state.nextTaskId === "phase3979a-autopilot-queue-health", "next task pointer mismatch after one round");
  } else {
    assert(latestRun.blocker === "git_status_snapshot_failed_before", "latest run blocker mismatch");
  }
  assert(state.resumeReady === true, "resume state must stay ready");
  assert(state.lastReportPath, "state must keep latest report path");

  const opencodeText = readFileSync(opencodeConfig, "utf8");
  assert(opencodeText.includes("\"phase-autopilot-once\""), "missing phase-autopilot-once command");
  assert(opencodeText.includes("\"phase-autopilot-resume\""), "missing phase-autopilot-resume command");

  console.log("Phase3979A OpenCode autopilot governor verifier passed");
}

main().catch((error) => {
  console.error(`Phase3979A verifier failed: ${error.message}`);
  process.exit(1);
});
