import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const PHASE = "Phase319A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-319a-functional-landing.json");
const evidenceMdPath = resolve(evidenceDir, "phase-319a-functional-landing.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const evidence = readJson(evidenceJsonPath) ?? {};
const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const httpServer = readText("apps/ai-gateway-service/src/http/httpServer.js");
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
const docs = readText("docs/APPROVAL_GATED_FUNCTIONAL_LANDING.md");

expect(evidence.phase === PHASE, "phase_marker", evidence.phase);
expect(evidence.status === "pass", "smoke_status_pass", evidence.status);
expect(evidence.previewOnlyRemaining === 0, "preview_only_zero", evidence.previewOnlyRemaining);
expect(evidence.notImplementedRemaining === 0, "not_implemented_zero", evidence.notImplementedRemaining);
expect(evidence.realEnabledFeatures >= 8, "real_enabled_minimum", evidence.realEnabledFeatures);
expect(evidence.approvalRequiredFeatures >= 5, "approval_required_minimum", evidence.approvalRequiredFeatures);
expect(evidence.blockedByPolicyFeatures >= 6, "blocked_minimum", evidence.blockedByPolicyFeatures);
expect(evidence.newSessionWorks === true, "new_session_works");
expect(evidence.modelConfigWorks === true, "model_config_works");
expect(evidence.chatSendWorks === true, "chat_send_works");
expect(evidence.quickSearchWorks === true, "quick_search_works");
expect(evidence.helpWorks === true, "help_works");
expect(evidence.diagnosticsWorks === true, "diagnostics_works");
expect(evidence.settingsWorks === true, "settings_works");
expect(evidence.providerConfigWorks === true, "provider_config_works");
expect(evidence.localAgentIntentPreviewWorks === true, "intent_preview_works");
expect(evidence.operationPlanWorks === true, "operation_plan_works");
expect(evidence.patchProposalWorks === true, "patch_proposal_works");
expect(evidence.approvalQueueWorks === true, "approval_queue_works");
expect(evidence.approveRejectWorks === true, "approve_reject_works");
expect(evidence.applyApprovedWorks === true, "apply_approved_works");
expect(evidence.fileContextWorks === true, "file_context_works");
expect(evidence.pluginRegistryWorks === true, "plugin_registry_works");
expect(evidence.blockedFullOpen === true, "blocked_full_open");
expect(evidence.blockedSecretRead === true, "blocked_secret_read");
expect(evidence.blockedCommitPushDeployRelease === true, "blocked_release_actions");
expect(evidence.blockedPaidApi === true, "blocked_paid_api");
expect(evidence.blockedEmbeddingBatchTraining === true, "blocked_embedding");
expect(evidence.providerCalledForBlockedAction === false, "blocked_provider_not_called");
expect(evidence.localExecutionTriggeredWithoutApproval === false, "no_unapproved_local_execution");
expect(evidence.unauthorizedFileWriteAttempted === false, "no_unauthorized_file_write");
expect(evidence.secretExposed === false, "secret_not_exposed");
expect(evidence.defaultChatChanged === false, "default_chat_unchanged");
expect(evidence.paidApiCalled === false, "paid_api_not_called");
expect(evidence.embeddingBatchTrainingCalled === false, "embedding_not_called");
expect(evidence.workspaceCleanClaimed === false, "workspace_clean_not_claimed");

expect(httpServer.includes('url.pathname === "/workbench/feature-status"'), "server_feature_status");
expect(httpServer.includes('url.pathname === "/local-agent/intent-preview"'), "server_intent_preview");
expect(httpServer.includes('url.pathname === "/local-agent/operation-plan"'), "server_operation_plan");
expect(httpServer.includes('url.pathname === "/local-agent/patch-proposal"'), "server_patch_proposal");
expect(httpServer.includes('url.pathname === "/approvals/create"'), "server_approvals_create");
expect(httpServer.includes('"/local-operation/apply-approved"'), "server_apply_approved");
expect(httpServer.includes('url.pathname === "/file-context/select"'), "server_file_context");
expect(httpServer.includes('url.pathname === "/plugin-registry"'), "server_plugin_registry");
expect(httpServer.includes("buildPhase319FeatureStatus"), "server_feature_status_builder");

expect(consolePage.includes("/local-agent/intent-preview"), "ui_intent_preview");
expect(consolePage.includes("/local-agent/operation-plan"), "ui_operation_plan");
expect(consolePage.includes("/local-agent/patch-proposal"), "ui_patch_proposal");
expect(consolePage.includes("/approvals/create"), "ui_approval_create");
expect(consolePage.includes("/local-operation/apply-approved"), "ui_apply_approved");
expect(consolePage.includes("/file-context/select"), "ui_file_context");
expect(consolePage.includes("/plugin-registry"), "ui_plugin_registry");
expect(consolePage.includes("phase319a-current-page-model"), "ui_model_local_storage");
expect(!consolePage.includes("审批动作只记录 UI 状态"), "ui_no_memory_only_approval_copy");

expect(rootPackage.includes("smoke:phase319a-functional-landing"), "root_smoke_script");
expect(rootPackage.includes("verify:phase319a-functional-landing"), "root_verify_script");
expect(servicePackage.includes("smoke:phase319a-functional-landing"), "service_smoke_script");
expect(servicePackage.includes("verify:phase319a-functional-landing"), "service_verify_script");
expect(docs.includes("Phase319A"), "docs_phase319a");
expect(docs.includes("real_enabled"), "docs_real_enabled");
expect(docs.includes("approval_required"), "docs_approval_required");
expect(docs.includes("blocked_by_policy"), "docs_blocked_by_policy");
expect(docs.includes("workspace dirty"), "docs_dirty_boundary");
expect(existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/approval/approvalStore.js")), "approval_store_exists");
expect(existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/local-operation/phase319LocalOperationService.js")), "operation_service_exists");
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
  previewOnlyRemaining: finalEvidence.previewOnlyRemaining,
  notImplementedRemaining: finalEvidence.notImplementedRemaining,
  checksFailed: failedChecks.length,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}



function containsSecretLikeValue(value) {
  return /sk-[a-z0-9]{16,}|nvapi-[a-z0-9_-]{16,}|api[_-]?key["']?\s*:\s*["'][^"']{8,}/i.test(String(value || ""));
}

function renderEvidenceMarkdown(evidence) {
  return [
    `# ${PHASE} Functional Landing Verification`,
    "",
    `- smokeStatus: ${evidence.status}`,
    `- verifierStatus: ${evidence.verifierStatus}`,
    `- verifierBlocker: ${evidence.verifierBlocker ? evidence.verifierBlocker.join("; ") : "none"}`,
    `- previewOnlyRemaining: ${evidence.previewOnlyRemaining}`,
    `- notImplementedRemaining: ${evidence.notImplementedRemaining}`,
    `- localExecutionTriggeredWithoutApproval: ${evidence.localExecutionTriggeredWithoutApproval}`,
    `- providerCalledForBlockedAction: ${evidence.providerCalledForBlockedAction}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}
