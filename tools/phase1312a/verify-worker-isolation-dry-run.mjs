import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1312A";
const phaseKey = "phase1312a";
const packageJsonPath = resolve(repoRoot, "package.json");
const docsPath = resolve(repoRoot, "docs/phase1312a-worker-isolation-design-mock-hard-timeout.md");
const srcPath = resolve(repoRoot, "packages/neural-fabric-runtime/src/workerIsolationDryRun.js");
const workerPath = resolve(repoRoot, "packages/neural-fabric-runtime/src/mockWorkerTask.js");
const indexPath = resolve(repoRoot, "packages/neural-fabric-runtime/src/index.js");
const packageCheckPath = resolve(repoRoot, "packages/neural-fabric-runtime/tools/check-specs.mjs");
const dryRunCheckPath = resolve(repoRoot, "packages/neural-fabric-runtime/tools/check-worker-isolation-dry-run.mjs");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1312a/worker-isolation-dry-run-result.json");

const result = await buildResult();
await writeJson(evidencePath, result);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  checksFailed: result.checks.filter((check) => check.passed !== true).length,
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}

async function buildResult() {
  const packageJson = await readJson(packageJsonPath, {});
  const docsText = await readText(docsPath, "");
  const srcText = await readText(srcPath, "");
  const workerText = await readText(workerPath, "");
  const indexText = await readText(indexPath, "");
  const packageCheckText = await readText(packageCheckPath, "");
  const dryRunCheckText = await readText(dryRunCheckPath, "");
  const runtime = await import("../..//packages/neural-fabric-runtime/src/index.js");
  const dryRun = await runtime.runWorkerIsolationDryRun({
    taskType: "mock-hard-timeout",
    timeoutMs: 50,
  });
  const combinedRuntimeText = `${srcText}\n${workerText}`;

  const checks = [
    check("package_script_exists", packageJson.scripts?.["verify:phase1312a-worker-isolation-dry-run"] === "node tools/phase1312a/verify-worker-isolation-dry-run.mjs"),
    check("docs_exists", await exists(docsPath)),
    check("src_exists", await exists(srcPath)),
    check("worker_exists", await exists(workerPath)),
    check("dry_run_check_exists", await exists(dryRunCheckPath)),
    check("exports_run_worker_isolation_dry_run", indexText.includes("runWorkerIsolationDryRun") && typeof runtime.runWorkerIsolationDryRun === "function"),
    check("package_check_runs_worker_dry_run", packageCheckText.includes("check-worker-isolation-dry-run.mjs")),
    check("worker_timeout_terminates", dryRun.workerTimeoutTerminates === true),
    check("main_thread_survives", dryRun.mainThreadSurvives === true),
    check("execution_transcript_written", dryRun.executionTranscriptWritten === true && Array.isArray(dryRun.executionTranscript) && dryRun.executionTranscript.length >= 5),
    check("transcript_has_timeout_and_terminate", ["hard-timeout-reached", "terminate-requested", "worker-terminated", "main-thread-survived"].every((event) => dryRun.executionTranscript.some((entry) => entry.event === event))),
    check("transcript_content_addressed", dryRun.transcriptAddress?.algorithm === "sha256" && /^sha256:[a-f0-9]{64}$/.test(dryRun.transcriptAddress?.uri ?? "")),
    check("mock_worker_only", dryRun.mockWorkerOnly === true),
    check("user_code_not_executed", dryRun.userCodeExecuted === false),
    check("real_model_not_executed", dryRun.realModelExecuted === false),
    check("training_not_executed", dryRun.trainingExecuted === false),
    check("provider_not_called", dryRun.providerCallsMade === false),
    check("secret_not_read", dryRun.secretRead === false),
    check("secret_value_not_exposed", dryRun.secretValueExposed === false),
    check("network_not_used", dryRun.networkUsed === false),
    check("main_chain_not_integrated", dryRun.mainChainIntegrated === false),
    check("chat_not_modified", dryRun.chatModified === false),
    check("chat_gateway_execute_not_modified", dryRun.chatGatewayExecuteModified === false),
    check("no_eval_detected", !/(^|[^\w])eval\s*\(/u.test(combinedRuntimeText)),
    check("no_new_function_detected", !/\bnew\s+Function\s*\(/u.test(combinedRuntimeText)),
    check("no_vm2_detected", !/\bvm2\b/u.test(combinedRuntimeText)),
    check("no_child_process_exec_detected", !/\bexec\s*\(|\bexecFile\s*\(|\bexecSync\s*\(|\bspawn\s*\(|\bspawnSync\s*\(/u.test(combinedRuntimeText)),
    check("no_provider_marker_detected_in_worker", !/\bProvider\b|\bproviderCall\b/u.test(workerText)),
    check("no_secret_reads_detected", !/process\.env|\.env|auth\.json|API_KEY|SECRET|TOKEN/u.test(combinedRuntimeText)),
    check("no_network_apis_detected", !/(node:https|node:http|fetch\s*\(|XMLHttpRequest|WebSocket)/u.test(combinedRuntimeText)),
    check("no_chat_routes_detected", !/\/chat|\/chat-gateway\/execute/u.test(combinedRuntimeText)),
    check("docs_records_boundaries", ["Mock worker only", "No arbitrary user code execution", "No real model execution", "No Provider calls", "No `/chat` or `/chat-gateway/execute` integration"].every((marker) => docsText.includes(marker))),
    check("dry_run_check_asserts_required_flags", ["workerTimeoutTerminates", "mainThreadSurvives", "executionTranscriptWritten"].every((marker) => dryRunCheckText.includes(marker))),
  ];

  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;
  return {
    phase,
    phaseKey,
    name: "Worker Isolation Design + Mock Hard Timeout",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    docs: "docs/phase1312a-worker-isolation-design-mock-hard-timeout.md",
    files: [
      "packages/neural-fabric-runtime/src/workerIsolationDryRun.js",
      "packages/neural-fabric-runtime/src/mockWorkerTask.js",
      "packages/neural-fabric-runtime/src/index.js",
      "packages/neural-fabric-runtime/tools/check-worker-isolation-dry-run.mjs",
      "packages/neural-fabric-runtime/tools/check-specs.mjs",
    ],
    verifier: "tools/phase1312a/verify-worker-isolation-dry-run.mjs",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1312a/worker-isolation-dry-run-result.json",
    dryRun: {
      workerTimeoutTerminates: dryRun.workerTimeoutTerminates,
      mainThreadSurvives: dryRun.mainThreadSurvives,
      executionTranscriptWritten: dryRun.executionTranscriptWritten,
      transcriptEventCount: dryRun.executionTranscript.length,
      transcriptAddress: dryRun.transcriptAddress.uri,
      workerExitCode: dryRun.workerExitCode,
    },
    safety: {
      mockWorkerOnly: dryRun.mockWorkerOnly,
      userCodeExecuted: dryRun.userCodeExecuted,
      realModelExecuted: dryRun.realModelExecuted,
      trainingExecuted: dryRun.trainingExecuted,
      providerCallsMade: dryRun.providerCallsMade,
      secretRead: dryRun.secretRead,
      secretValueExposed: dryRun.secretValueExposed,
      networkUsed: dryRun.networkUsed,
      mainChainIntegrated: dryRun.mainChainIntegrated,
      chatModified: dryRun.chatModified,
      chatGatewayExecuteModified: dryRun.chatGatewayExecuteModified,
      workspaceCleanClaimed: false,
    },
    executionTranscript: dryRun.executionTranscript,
    checks,
  };
}

function check(id, passed) {
  return { id, passed: passed === true };
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path, fallback) {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJson(path, fallback) {
  const text = await readText(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
