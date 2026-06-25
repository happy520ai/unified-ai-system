import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const PHASE = "Phase321A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-321a-workbench-product-recovery.json");
const evidenceMdPath = resolve(evidenceDir, "phase-321a-workbench-product-recovery.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const evidence = readJson(evidenceJsonPath) ?? {};
const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const httpServer = readText("apps/ai-gateway-service/src/http/httpServer.js");
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
const docs = readText("docs/WORKBENCH_PRODUCT_RECOVERY_AND_REAL_ACCEPTANCE.md");

expect(evidence.phase === PHASE, "phase_marker", evidence.phase);
expect(evidence.status === "pass", "smoke_status_pass", evidence.status);
expect(Array.isArray(evidence.currentFiveModules) && evidence.currentFiveModules.length === 5, "five_modules_only");
expect(evidence.realChatDefaultUsesExecuteRoute === true, "chat_default_execute_route");
expect(evidence.approvalBeforeApproveBlocked === true, "approval_before_approve_blocked");
expect(evidence.approvalAfterApproveApplied === true, "approval_after_approve_applied");
expect(evidence.fileRegisterResult?.filesSelected === 1, "file_register_selected");
expect(evidence.sensitiveFileBlockResult?.filesBlocked === 1, "file_register_blocked_sensitive");
expect(evidence.realBrowserUsed === false, "real_browser_not_claimed");
expect(typeof evidence.manualRealBrowserVerificationRequired === "boolean", "manual_browser_requirement_flag_present");
expect(
  evidence.manualRealBrowserVerificationRequired === false
    ? evidence.manualBrowserVerified === true
    : true,
  "manual_browser_status_consistent",
);
expect(evidence.defaultChatChanged === false, "default_chat_unchanged");
expect(evidence.secretExposed === false, "secret_not_exposed");
expect(evidence.paidApiCalled === false, "paid_api_not_called");
expect(evidence.workspaceCleanClaimed === false, "workspace_clean_not_claimed");

expect(consolePage.includes('data-phase="phase321a-workbench-product-recovery"'), "source_phase321a_marker");
expect(consolePage.includes('data-nav="chat"') && consolePage.includes('data-nav="models"') && consolePage.includes('data-nav="approvals"') && consolePage.includes('data-nav="files"') && consolePage.includes('data-nav="diagnostics"'), "source_five_nav_modules");
expect(!consolePage.includes('data-nav="search"'), "source_search_hidden");
expect(!consolePage.includes('data-nav="local-agent"'), "source_local_agent_hidden");
expect(!consolePage.includes('data-nav="repair"'), "source_repair_hidden");
expect(!consolePage.includes('data-nav="help"'), "source_help_hidden");
expect(!consolePage.includes('data-nav="settings"'), "source_settings_hidden");
expect(consolePage.includes('/chat-gateway/execute'), "source_chat_execute_route");
expect(consolePage.includes('/chat-gateway/dry-run-task'), "source_dry_run_route_retained_for_diagnostics");
expect(consolePage.includes('id="open-evidence-button"'), "source_evidence_button");
expect(consolePage.includes('id="evidence-drawer"'), "source_evidence_drawer");
expect(consolePage.includes('type="password"'), "source_password_input");
expect(consolePage.includes('/provider-config/save'), "source_provider_save_route");
expect(consolePage.includes('/provider-config/test'), "source_provider_test_route");
expect(consolePage.includes('/approvals/create'), "source_approval_create_route");
expect(consolePage.includes('/local-operation/apply-approved'), "source_apply_approved_route");
expect(consolePage.includes('/file-context/select'), "source_file_context_route");
expect(consolePage.includes('/workbench/diagnostics/status'), "source_diagnostics_route");
expect(!/preview only|not implemented|仅用于页面预览/i.test(consolePage), "source_no_preview_copy");
expect(!/full_open|commit|push|deploy|release/i.test(consolePage), "source_no_dangerous_buttons");

expect(httpServer.includes('url.pathname === "/chat-gateway/execute"') || httpServer.includes('url.pathname === "/chat/gateway"'), "server_chat_execute_route");
expect(httpServer.includes('url.pathname === "/provider-config/test"'), "server_provider_test_route");
expect(rootPackage.includes("smoke:phase321a-workbench-product-recovery"), "root_smoke_script");
expect(rootPackage.includes("verify:phase321a-workbench-product-recovery"), "root_verify_script");
expect(servicePackage.includes("smoke:phase321a-workbench-product-recovery"), "service_smoke_script");
expect(servicePackage.includes("verify:phase321a-workbench-product-recovery"), "service_verify_script");
expect(docs.includes("Phase321A"), "docs_phase321a");
expect(docs.includes("manualRealBrowserVerificationRequired"), "docs_browser_boundary");
expect(docs.includes("manualBrowserVerified"), "docs_manual_browser_verified_boundary");
expect(docs.includes("默认优先走真实 Provider"), "docs_real_chat_priority");
expect(docs.includes("仅登记 / 预览"), "docs_file_boundary");
expect(docs.includes("workspace dirty"), "docs_workspace_dirty");
expect(!containsSecretLikeValue(JSON.stringify(evidence)), "evidence_no_secret");

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
await writeFile(evidenceMdPath, renderEvidenceMarkdown(finalEvidence), "utf8");

console.log(JSON.stringify({
  status: finalEvidence.verifierStatus,
  blocker: finalEvidence.verifierBlocker,
  realBrowserUsed: finalEvidence.realBrowserUsed,
  manualRealBrowserVerificationRequired: finalEvidence.manualRealBrowserVerificationRequired,
  checksFailed: failedChecks.length,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}



function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function renderEvidenceMarkdown(data) {
  return [
    "# Phase321A Workbench Product Recovery Verification",
    "",
    `- smokeStatus: ${data.status}`,
    `- verifierStatus: ${data.verifierStatus}`,
    `- blocker: ${data.verifierBlocker ? data.verifierBlocker.join("; ") : "none"}`,
    `- realBrowserUsed: ${data.realBrowserUsed}`,
    `- manualRealBrowserVerificationRequired: ${data.manualRealBrowserVerificationRequired}`,
    `- manualBrowserVerified: ${data.manualBrowserVerified ?? false}`,
    `- currentFiveModules: ${(data.currentFiveModules || []).join(" / ")}`,
    `- realChatDefaultUsesExecuteRoute: ${data.realChatDefaultUsesExecuteRoute}`,
    `- approvalBeforeApproveBlocked: ${data.approvalBeforeApproveBlocked}`,
    `- approvalAfterApproveApplied: ${data.approvalAfterApproveApplied}`,
    `- workspaceCleanClaimed: ${data.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}
