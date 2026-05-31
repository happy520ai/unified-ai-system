import { performance } from "node:perf_hooks";
import { readJson, readJsonIfExists, writeJson, writeText } from "../phase365-common.mjs";

const gate = await readJson("docs/phase365c-deploy-execution-gate-state.json");
const confirmation = await readJsonIfExists("docs/approvals/phase365/final-manual-deploy-execution-confirmation.json");
const safety = await readJson("docs/phase365b-deploy-command-final-safety-state.json");

const state = {
  phase: "Phase365D",
  deployAttempted: false,
  deployExecuted: false,
  deploySucceeded: false,
  deployFailed: false,
  deploySkippedReason: null,
  approvedCommandRef: confirmation?.approvedCommandRef || null,
  commandExecuted: null,
  exitCode: null,
  durationMs: null,
  logsRedacted: true,
  secretValueExposed: false,
  rollbackRecommended: false,
  rollbackExecuted: false,
};

if (gate.deployExecutionAllowed !== true) {
  state.deploySkippedReason = "deploy_gate_closed";
} else if (!confirmation || confirmation.executeDeploy !== true) {
  state.deploySkippedReason = "confirmation_missing_or_execute_false";
} else if (safety.finalSafetyCheckPassed !== true) {
  state.deploySkippedReason = "final_safety_check_failed";
} else {
  state.deploySkippedReason = "approved_command_ref_has_no_executable_command_in_phase364_boundary";
}

const startedAt = performance.now();
state.durationMs = Math.round(performance.now() - startedAt);

await writeText("docs/phase365d-deploy-execution-report.md", [
  "# Phase365D Deploy Execution Report",
  "",
  `- deployAttempted: ${state.deployAttempted}`,
  `- deployExecuted: ${state.deployExecuted}`,
  `- deploySkippedReason: ${state.deploySkippedReason}`,
].join("\n"));
await writeJson("docs/phase365d-deploy-execution-state.json", state);
await writeText("docs/phase365d-execution-report.md", [
  "# Phase365D Execution Report",
  "",
  `- deployExecuted: ${state.deployExecuted}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase365d/deploy-execution-result.json", state);

console.log(JSON.stringify(state, null, 2));
