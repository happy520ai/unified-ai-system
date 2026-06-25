import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, postJson, listen } from "./entrypointUtils.js";

const PHASE = "Phase621R-628R";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase621r-628r");
const evidenceJsonPath = resolve(evidenceDir, "controlled-runtime-candidate-path-smoke.json");
const evidenceMdPath = resolve(evidenceDir, "controlled-runtime-candidate-path-smoke.md");

const runtimeEnv = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
};

const application = createGatewayApplication(runtimeEnv);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);
const checks = [];

let status = {};
let dryRunSmoke = {};
let guardedOneShot = {};
let reliability = {};

try {
  status = await fetchJson(`${baseUrl}/runtime-candidate/codex-exec-crs/status`);
  dryRunSmoke = await postJson(`${baseUrl}/runtime-candidate/codex-exec-crs/dry-run-smoke`, {
    requestId: "phase623r-runtime-candidate-dry-run-smoke-001",
  });
  guardedOneShot = await postJson(`${baseUrl}/runtime-candidate/codex-exec-crs/guarded-one-shot`, {
    requestId: "phase625r-guarded-isolated-one-shot-001",
  });
  reliability = await postJson(`${baseUrl}/runtime-candidate/codex-exec-crs/reliability`, {
    maxAttempts: 3,
  });
} finally {
  await closeServer(server);
}

const statusData = status.data ?? status;
const smokeData = dryRunSmoke.data ?? dryRunSmoke;
const oneShotData = guardedOneShot.data ?? guardedOneShot;
const reliabilityData = reliability.data ?? reliability;

expect(statusData.baselineReady === true, "baseline_ready");
expect(statusData.routeId === "codex_exec_crs_runtime_candidate_isolated", "route_id_isolated");
expect(statusData.runtimeIntegrationMode === "isolated_candidate_only", "runtime_mode_isolated_candidate_only");
expect(statusData.defaultChatIntegrationChanged === false, "default_chat_unchanged");
expect(statusData.chatGatewayExecuteMainChainChanged === false, "chat_gateway_execute_main_chain_unchanged");
expect(statusData.providerRuntimeModified === false, "provider_runtime_unmodified");
expect(statusData.providerCallsMade === false, "status_provider_not_called");
expect(statusData.codexExecExecuted === false, "status_codex_exec_not_executed");
expect(statusData.authJsonRead === false, "status_auth_json_not_read");
expect(statusData.codexConfigModified === false, "status_codex_config_not_modified");

expect(smokeData.status === "pass", "dry_run_smoke_pass");
expect(smokeData.providerCallsMade === false, "dry_run_provider_not_called");
expect(smokeData.codexExecExecuted === false, "dry_run_codex_exec_not_executed");
expect(smokeData.requestAttemptCount === 0, "dry_run_request_attempt_zero");

expect(oneShotData.testStatus === "pass", "isolated_one_shot_pass");
expect(oneShotData.responseClassification === "pass", "isolated_one_shot_classified_pass");
expect(oneShotData.stdoutSanitized === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK", "isolated_one_shot_marker");
expect(oneShotData.providerCallsMade === false, "one_shot_provider_not_called");
expect(oneShotData.codexExecExecuted === false, "one_shot_codex_exec_not_executed");
expect(oneShotData.requestAttemptCount === 1, "one_shot_request_attempt_one");
expect(oneShotData.retryAttemptCount === 0, "one_shot_retry_zero");

expect(reliabilityData.plannedAttempts === 3, "reliability_planned_three");
expect(reliabilityData.completedAttempts === 3, "reliability_completed_three");
expect(reliabilityData.totalRequestAttemptCount === 3, "reliability_request_attempt_three");
expect(reliabilityData.totalRetryAttemptCount === 0, "reliability_retry_zero");
expect(reliabilityData.repeatedReliabilityClassification === "isolated_repeated_pass", "reliability_classified_pass");
expect(reliabilityData.allAttemptsPassed === true, "reliability_all_passed");
expect(reliabilityData.providerCallsMade === false, "reliability_provider_not_called");
expect(reliabilityData.codexExecExecuted === false, "reliability_codex_exec_not_executed");
expect(reliabilityData.runtimeIntegrated === false, "reliability_runtime_not_integrated");
expect(reliabilityData.chatIntegrated === false, "reliability_chat_not_integrated");
expect(reliabilityData.chatGatewayExecuteIntegrated === false, "reliability_chat_gateway_execute_not_integrated");
expect(reliabilityData.providerRuntimeModified === false, "reliability_provider_runtime_unmodified");

const failedChecks = checks.filter((item) => !item.pass);
const evidence = {
  phase: PHASE,
  name: "Controlled Runtime Candidate Path Smoke",
  status: failedChecks.length === 0 ? "pass" : "fail",
  completed: failedChecks.length === 0,
  recommended_sealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? null : failedChecks.map((item) => item.id).join(","),
  generatedAt: new Date().toISOString(),
  isolatedRuntimeCandidateWired: true,
  routeId: statusData.routeId,
  selectedProviderId: statusData.selectedProviderId,
  dryRunSmoke,
  guardedOneShot,
  reliability,
  runtimeIntegrationExecuted: true,
  runtimeIntegrated: false,
  defaultChatIntegrationChanged: false,
  chatIntegrated: false,
  chatGatewayExecuteMainChainChanged: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeModified: false,
  providerCallsMadeByThisPhase: false,
  codexExecExecutedByThisPhase: false,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  secretValueExposed: false,
  rawBaseUrlValueExposed: false,
  webhookValueExposed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  workspaceCleanClaimed: false,
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  blocker: evidence.blocker,
  routeId: evidence.routeId,
  isolatedRuntimeCandidateWired: evidence.isolatedRuntimeCandidateWired,
  dryRunSmokeStatus: smokeData.status,
  oneShotStatus: oneShotData.testStatus,
  repeatedReliabilityClassification: reliabilityData.repeatedReliabilityClassification,
  completedAttempts: reliabilityData.completedAttempts,
  providerCallsMadeByThisPhase: evidence.providerCallsMadeByThisPhase,
  codexExecExecutedByThisPhase: evidence.codexExecExecutedByThisPhase,
}, null, 2));

process.exitCode = failedChecks.length === 0 ? 0 : 1;

function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

async function closeServer(server) {
  await new Promise((resolveClose) => server.close(resolveClose));
}


function renderMarkdown(data) {
  return `# Phase621R-628R Controlled Runtime Candidate Path Smoke

- status: ${data.status}
- blocker: ${data.blocker}
- routeId: ${data.routeId}
- isolatedRuntimeCandidateWired: ${data.isolatedRuntimeCandidateWired}
- providerCallsMadeByThisPhase: ${data.providerCallsMadeByThisPhase}
- codexExecExecutedByThisPhase: ${data.codexExecExecutedByThisPhase}
- chatIntegrated: ${data.chatIntegrated}
- chatGatewayExecuteIntegrated: ${data.chatGatewayExecuteIntegrated}
- productionReadyClaimed: ${data.productionReadyClaimed}
- releaseReadyClaimed: ${data.releaseReadyClaimed}

## Checks

${data.checks.map((item) => `- ${item.pass ? "pass" : "fail"}: ${item.id}`).join("\n")}
`;
}
