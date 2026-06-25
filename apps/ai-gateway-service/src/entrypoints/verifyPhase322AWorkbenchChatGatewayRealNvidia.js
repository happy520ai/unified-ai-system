import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const PHASE = "Phase322A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-322a-workbench-chat-gateway-real-nvidia.json");
const evidenceMdPath = resolve(evidenceDir, "phase-322a-workbench-chat-gateway-real-nvidia.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const evidence = readJson(evidenceJsonPath) ?? {};
const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const httpServer = readText("apps/ai-gateway-service/src/http/httpServer.js");
const docs = readText("docs/WORKBENCH_CHAT_GATEWAY_REAL_NVIDIA_CLOSURE.md");
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");

expect(evidence.phase === PHASE, "phase_marker", evidence.phase);
expect(evidence.status === "pass", "smoke_status_pass", evidence.status);
expect(evidence.realBrowserUsed === false, "real_browser_not_claimed");
expect(typeof evidence.manualRealBrowserVerificationRequired === "boolean", "manual_browser_requirement_flag_present");
expect(typeof evidence.manualBrowserVerified === "boolean", "manual_browser_verified_flag_present");
expect(
  evidence.manualRealBrowserVerificationRequired === false
    ? evidence.manualBrowserVerified === true
    : evidence.manualBrowserVerified === false,
  "manual_browser_status_consistent",
);
expect(
  evidence.manualRealBrowserVerificationRequired === false ? evidence.userConfirmedChatSuccess === true : true,
  "manual_browser_chat_success_when_verified",
);
expect(evidence.noKeyResult?.providerCalled === false, "no_key_provider_not_called");
expect(evidence.noKeyResult?.failureCode === "nvidia_api_key_missing", "no_key_failure_code", evidence.noKeyResult?.failureCode);
expect(evidence.uiPayloadBinding?.routeExecute === true, "ui_route_execute");
expect(evidence.uiPayloadBinding?.manualModelMode === true, "ui_manual_model_mode");
expect(evidence.uiPayloadBinding?.dryRunFalse === true, "ui_dry_run_false");
expect(evidence.uiPayloadBinding?.selectedModelObject === true, "ui_selected_model_object");
if (evidence.hasRuntimeKey) {
  expect(evidence.withKeyResult?.providerCalled === true, "with_key_provider_called");
  expect(evidence.withKeyResult?.completionVerified === true, "with_key_completion_verified");
  expect(evidence.withKeyResult?.hasFinalAnswer === true, "with_key_has_answer");
  expect(Boolean(evidence.withKeyResult?.evidenceId), "with_key_evidence_id");
}

expect(consolePage.includes('/chat-gateway/execute'), "source_chat_execute_route");
expect(consolePage.includes('mode: "manual_model"'), "source_manual_model_mode");
expect(consolePage.includes('dryRun: false'), "source_dry_run_false");
expect(consolePage.includes('selectedModel: {'), "source_selected_model_object");
expect(httpServer.includes('const requestedMode = normalizeGatewayMode(body?.mode);'), "server_requested_mode_marker");
expect(httpServer.includes('mode === "manual_model" ? selectedModel : null'), "server_manual_model_plan_gate");
expect(httpServer.includes('failureCode: execution.code ?? null'), "server_failure_code_exposed");
expect(rootPackage.includes("smoke:phase322a-workbench-chat-gateway-real-nvidia"), "root_smoke_script");
expect(rootPackage.includes("verify:phase322a-workbench-chat-gateway-real-nvidia"), "root_verify_script");
expect(servicePackage.includes("smoke:phase322a-workbench-chat-gateway-real-nvidia"), "service_smoke_script");
expect(servicePackage.includes("verify:phase322a-workbench-chat-gateway-real-nvidia"), "service_verify_script");
expect(docs.includes("Phase322A"), "docs_phase322a");
expect(docs.includes("provider-config/test") && docs.includes("/chat-gateway/execute"), "docs_root_cause_boundary");
expect(docs.includes("manualRealBrowserVerificationRequired"), "docs_manual_browser_boundary");
expect(docs.includes("manualBrowserVerified"), "docs_manual_browser_verified_boundary");

const failedChecks = checks.filter((item) => !item.pass);
const finalEvidence = {
  ...evidence,
  verifiedAt: new Date().toISOString(),
  verifierStatus: failedChecks.length === 0 ? "pass" : "fail",
  verifierBlocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  verifierChecks: checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(finalEvidence), "utf8");

console.log(JSON.stringify({
  status: finalEvidence.verifierStatus,
  blocker: finalEvidence.verifierBlocker,
  hasRuntimeKey: finalEvidence.hasRuntimeKey,
  checksFailed: failedChecks.length,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}



function renderMarkdown(data) {
  return [
    "# Phase322A Workbench Chat Gateway Real NVIDIA Verification",
    "",
    `- smokeStatus: ${data.status}`,
    `- verifierStatus: ${data.verifierStatus}`,
    `- blocker: ${data.verifierBlocker ? data.verifierBlocker.join("; ") : "none"}`,
    `- hasRuntimeKey: ${data.hasRuntimeKey}`,
    `- realBrowserUsed: ${data.realBrowserUsed}`,
    `- manualRealBrowserVerificationRequired: ${data.manualRealBrowserVerificationRequired}`,
    `- manualBrowserVerified: ${data.manualBrowserVerified ?? false}`,
    `- userConfirmedChatSuccess: ${data.userConfirmedChatSuccess ?? false}`,
    `- noKeyFailureCode: ${data.noKeyResult?.failureCode ?? "n/a"}`,
    `- withKeyProviderCalled: ${data.withKeyResult?.providerCalled ?? false}`,
    `- withKeyCompletionVerified: ${data.withKeyResult?.completionVerified ?? false}`,
    "",
  ].join("\n");
}
