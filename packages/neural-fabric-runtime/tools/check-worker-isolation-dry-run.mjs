import { runWorkerIsolationDryRun } from "../src/index.js";

const result = await runWorkerIsolationDryRun({
  taskType: "mock-hard-timeout",
  timeoutMs: 50,
});

const checks = [
  ["exports_run_worker_isolation_dry_run", typeof runWorkerIsolationDryRun === "function"],
  ["worker_timeout_terminates", result.workerTimeoutTerminates === true],
  ["main_thread_survives", result.mainThreadSurvives === true],
  ["execution_transcript_written", result.executionTranscriptWritten === true],
  ["mock_worker_only", result.mockWorkerOnly === true],
  ["user_code_not_executed", result.userCodeExecuted === false],
  ["real_model_not_executed", result.realModelExecuted === false],
  ["provider_not_called", result.providerCallsMade === false],
  ["main_chain_not_integrated", result.mainChainIntegrated === false],
  ["chat_not_modified", result.chatModified === false],
  ["chat_gateway_execute_not_modified", result.chatGatewayExecuteModified === false],
  ["transcript_has_timeout_event", result.executionTranscript.some((entry) => entry.event === "hard-timeout-reached")],
  ["transcript_has_terminated_event", result.executionTranscript.some((entry) => entry.event === "worker-terminated")],
];

const failed = checks.filter(([, passed]) => passed !== true);
if (failed.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    failed: failed.map(([id]) => id),
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "passed",
    phase: "Phase1312A",
    workerTimeoutTerminates: result.workerTimeoutTerminates,
    mainThreadSurvives: result.mainThreadSurvives,
    executionTranscriptWritten: result.executionTranscriptWritten,
  }, null, 2));
}
