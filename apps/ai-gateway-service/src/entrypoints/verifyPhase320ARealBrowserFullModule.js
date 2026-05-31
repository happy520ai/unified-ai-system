import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "Phase320A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-320a-real-browser-full-module-acceptance.json");
const evidenceMdPath = resolve(evidenceDir, "phase-320a-real-browser-full-module-acceptance.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const evidence = readJson(evidenceJsonPath) ?? {};
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");

expect(evidence.phase === PHASE, "phase_marker", evidence.phase);
expect(evidence.realBrowserUsed === true, "real_browser_used_required", evidence.browserPluginFailureReason);
expect(evidence.browserPluginAvailable === true, "browser_plugin_available_required", evidence.browserPluginFailureReason);
expect(evidence.chatFlowWorks === true, "chat_flow_works");
expect(evidence.modelConfigWorks === true, "model_config_works");
expect(evidence.searchWorks === true, "search_works");
expect(evidence.knowledgePageWorks === true, "knowledge_page_works");
expect(evidence.localAgentApprovalFlowWorks === true, "local_agent_approval_flow_works");
expect(evidence.approvalQueueWorks === true, "approval_queue_works");
expect(evidence.safeRepairApprovalFlowWorks === true, "safe_repair_approval_flow_works");
expect(evidence.fileContextWorks === true, "file_context_works");
expect(evidence.pluginRegistryWorks === true, "plugin_registry_works");
expect(evidence.helpWorks === true, "help_works");
expect(evidence.settingsWorks === true, "settings_works");
expect(evidence.diagnosticsWorks === true, "diagnostics_works");
expect(evidence.evidenceDrawerWorks === true, "evidence_drawer_works");
expect(evidence.blockedPolicyWorks === true, "blocked_policy_works");
expect(Array.isArray(evidence.failedButtons) && evidence.failedButtons.length === 0, "failed_buttons_zero", JSON.stringify(evidence.failedButtons));
expect(evidence.jsErrorsFound === 0, "js_errors_zero", evidence.jsErrorsFound);
expect(Array.isArray(evidence.consoleErrors) && evidence.consoleErrors.length === 0, "console_errors_zero", JSON.stringify(evidence.consoleErrors));
expect(evidence.emptyPagesFound === 0, "empty_pages_zero", evidence.emptyPagesFound);
expect(evidence.secretExposed === false, "secret_not_exposed");
expect(evidence.defaultChatChanged === false, "default_chat_unchanged");
expect(evidence.paidApiCalled === false, "paid_api_not_called");
expect(evidence.localExecutionTriggeredWithoutApproval === false, "no_unapproved_local_execution");
expect(evidence.providerCalledForBlockedAction === false, "blocked_provider_not_called");
expect(evidence.workspaceCleanClaimed === false, "workspace_clean_not_claimed");
expect(rootPackage.includes("smoke:phase320a-real-browser-full-module"), "root_smoke_script");
expect(rootPackage.includes("verify:phase320a-real-browser-full-module"), "root_verify_script");
expect(servicePackage.includes("smoke:phase320a-real-browser-full-module"), "service_smoke_script");
expect(servicePackage.includes("verify:phase320a-real-browser-full-module"), "service_verify_script");

const failedChecks = checks.filter((item) => !item.pass);
const finalEvidence = {
  ...evidence,
  verifiedAt: new Date().toISOString(),
  verifierStatus: failedChecks.length === 0 ? "pass" : "fail",
  verifierBlocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  verifierChecks: checks,
  status: failedChecks.length === 0 ? "pass" : "fail",
  sealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? null : (evidence.blocker || "real_browser_plugin_unavailable"),
  workspaceCleanClaimed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(finalEvidence), "utf8");

console.log(JSON.stringify({
  status: finalEvidence.verifierStatus,
  blocker: finalEvidence.blocker,
  realBrowserUsed: finalEvidence.realBrowserUsed,
  browserPluginAvailable: finalEvidence.browserPluginAvailable,
  checksFailed: failedChecks.length,
}, null, 2));

process.exitCode = finalEvidence.verifierStatus === "pass" ? 0 : 1;

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readText(relativePath) {
  const absolute = resolve(repoRoot, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function renderEvidenceMarkdown(data) {
  return [
    "# Phase320A Real Browser Full Module Acceptance Verification",
    "",
    `- smokeStatus: ${data.status}`,
    `- verifierStatus: ${data.verifierStatus}`,
    `- blocker: ${data.blocker}`,
    `- realBrowserUsed: ${data.realBrowserUsed}`,
    `- browserPluginAvailable: ${data.browserPluginAvailable}`,
    `- browserPluginFailureReason: ${data.browserPluginFailureReason}`,
    `- failedButtons: ${Array.isArray(data.failedButtons) ? data.failedButtons.length : "unknown"}`,
    `- jsErrorsFound: ${data.jsErrorsFound}`,
    `- emptyPagesFound: ${data.emptyPagesFound}`,
    `- workspaceCleanClaimed: ${data.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}
