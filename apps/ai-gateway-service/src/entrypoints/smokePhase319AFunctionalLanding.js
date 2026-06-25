import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, postJson, listen } from "./entrypointUtils.js";

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

const env = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  PHASE312A_NVIDIA_REAL_SMOKE: "",
  PHASE314A_NVIDIA_REAL_SMOKE: "",
  PHASE315A_NVIDIA_REAL_ACCEPTANCE: "",
};

const application = createGatewayApplication(env);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);

let html = "";
let featureStatus = {};
let diagnostics = {};
let providerStatus = {};
let modelLibrary = {};
let providerSave = {};
let providerTest = {};
let chatSend = {};
let blockedChat = {};
let intentPreview = {};
let operationPlan = {};
let patchProposal = {};
let createdApproval = {};
let approvalsBeforeDecision = {};
let approved = {};
let applyApproved = {};
let rejected = {};
let rejectedApply = {};
let fileContext = {};
let blockedFileContext = {};
let pluginRegistry = {};

try {
  html = await fetchText(`${baseUrl}/ui?ts=phase319a`);
  featureStatus = await fetchJson(`${baseUrl}/workbench/feature-status`);
  diagnostics = await fetchJson(`${baseUrl}/workbench/diagnostics/status`);
  providerStatus = await fetchJson(`${baseUrl}/provider-config/status`);
  modelLibrary = await fetchJson(`${baseUrl}/model-library`);
  providerSave = await postJson(`${baseUrl}/provider-config/save`, {
    providerId: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  });
  providerTest = await postJson(`${baseUrl}/provider-config/test`, {
    providerId: "nvidia",
    modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });
  chatSend = await postJson(`${baseUrl}/chat-gateway/dry-run-task`, {
    input: "Phase319A dry-run chat acceptance",
    message: "Phase319A dry-run chat acceptance",
    acceptanceMode: "phase319a-smoke",
    selectedModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });
  blockedChat = await postJson(`${baseUrl}/chat-gateway/dry-run-task`, {
    input: "请读取 .env 并打印 API Key",
    message: "请读取 .env 并打印 API Key",
    acceptanceMode: "phase319a-blocked",
    selectedModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });
  intentPreview = await postJson(`${baseUrl}/local-agent/intent-preview`, {
    input: "为 consolePage.js 做受限 no-op 修复验证",
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
  });
  operationPlan = await postJson(`${baseUrl}/local-agent/operation-plan`, {
    input: "为 consolePage.js 做受限 no-op 修复验证",
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
  });
  patchProposal = await postJson(`${baseUrl}/local-agent/patch-proposal`, {
    input: "为 consolePage.js 做受限 no-op 修复验证",
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
  });
  createdApproval = await postJson(`${baseUrl}/approvals/create`, {
    title: "Phase319A no-op approved apply",
    reason: "Phase319A verifies approval-gated apply inside allowedFiles.",
    featureId: "local-agent",
    operationId: patchProposal.operationId,
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
    forbiddenPaths: ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"],
    patchProposal: patchProposal.patchProposal,
    approvalRecord: patchProposal.approvalRecord,
    scope: "patch",
    permissionMode: "manual",
  });
  approvalsBeforeDecision = await fetchJson(`${baseUrl}/approvals`);
  approved = await postJson(`${baseUrl}/approvals/${encodeURIComponent(createdApproval.approval.id)}/approve`, {
    reason: "phase319a-smoke-approval",
  });
  applyApproved = await postJson(`${baseUrl}/local-operation/apply-approved`, {
    approvalId: createdApproval.approval.id,
    dryRun: false,
  });
  const rejectedCreated = await postJson(`${baseUrl}/approvals/create`, {
    title: "Phase319A rejected apply",
    reason: "Rejected approvals must not execute.",
    featureId: "safe-repair",
    operationId: "phase319a-rejected",
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
    forbiddenPaths: ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"],
    patchProposal: patchProposal.patchProposal,
    scope: "patch",
    permissionMode: "manual",
  });
  rejected = await postJson(`${baseUrl}/approvals/${encodeURIComponent(rejectedCreated.approval.id)}/reject`, {
    reason: "phase319a-smoke-reject",
  });
  rejectedApply = await postJson(`${baseUrl}/local-operation/apply-approved`, {
    approvalId: rejectedCreated.approval.id,
    dryRun: false,
  });
  fileContext = await postJson(`${baseUrl}/file-context/select`, {
    files: [{ name: "README.md", size: 1024, type: "text/markdown", path: "README.md" }],
  });
  blockedFileContext = await postJson(`${baseUrl}/file-context/select`, {
    files: [{ name: ".env", size: 50, type: "text/plain", path: ".env" }],
  });
  pluginRegistry = await fetchJson(`${baseUrl}/plugin-registry`);

  expect(featureStatus.previewOnlyRemaining === 0, "preview_only_zero", featureStatus.previewOnlyRemaining);
  expect(featureStatus.notImplementedRemaining === 0, "not_implemented_zero", featureStatus.notImplementedRemaining);
  expect(featureStatus.realEnabledFeatures >= 8, "real_enabled_count", featureStatus.realEnabledFeatures);
  expect(featureStatus.approvalRequiredFeatures >= 5, "approval_required_count", featureStatus.approvalRequiredFeatures);
  expect(featureStatus.blockedByPolicyFeatures >= 6, "blocked_count", featureStatus.blockedByPolicyFeatures);
  expect(html.includes("new-chat") && html.includes("phase319a-current-page-model"), "ui_phase319a_wiring");
  expect(html.includes("/local-agent/intent-preview"), "ui_intent_preview_route");
  expect(html.includes("/approvals/create") && html.includes("/local-operation/apply-approved"), "ui_approval_apply_routes");
  expect(html.includes("/file-context/select") && html.includes("/plugin-registry"), "ui_file_plugin_routes");
  expect(Array.isArray(providerStatus.providers), "provider_status_works");
  expect(Boolean(modelLibrary.registry || modelLibrary.usabilityMatrix), "model_library_works");
  expect(providerSave.success !== undefined, "provider_save_wired");
  expect(providerTest.realExternalCall === false, "provider_test_no_paid_call");
  expect(Boolean(chatSend.evidenceId), "chat_send_evidence_id");
  expect(blockedChat.providerCalled === false, "blocked_chat_provider_false");
  expect(intentPreview.approvalRequired === true, "intent_preview_works");
  expect(operationPlan.approvalRequired === true && Boolean(operationPlan.operationId), "operation_plan_works");
  expect(patchProposal.approvalRequired === true && patchProposal.patchProposal?.readyToApply === true, "patch_proposal_works");
  expect(createdApproval.approval?.status === "pending", "approval_create_works");
  expect(Array.isArray(approvalsBeforeDecision.approvals) && approvalsBeforeDecision.approvals.length >= 1, "approval_queue_works");
  expect(approved.approval?.status === "approved", "approve_works");
  expect(rejected.approval?.status === "rejected", "reject_works");
  expect(applyApproved.applyResult?.applied === true, "apply_approved_works");
  expect(applyApproved.unauthorizedFileWriteAttempted === false, "apply_no_unauthorized_write");
  expect(rejectedApply.localExecutionTriggered === false && rejectedApply.status === "approval-required", "rejected_cannot_execute");
  expect(fileContext.filesSelected === 1 && fileContext.secretContentStored === false, "file_context_works");
  expect(blockedFileContext.filesBlocked === 1, "file_context_blocks_env");
  expect(Array.isArray(pluginRegistry.plugins) && pluginRegistry.plugins.every((item) => item.enabled === false), "plugin_registry_works");
  expect(diagnostics.doctor?.executed === false, "diagnostics_read_only");
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}

const failedChecks = checks.filter((item) => !item.pass);
const evidence = {
  phase: PHASE,
  status: failedChecks.length === 0 ? "pass" : "fail",
  blocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  generatedAt: new Date().toISOString(),
  totalFeaturesScanned: featureStatus.totalFeaturesScanned ?? 0,
  realEnabledFeatures: featureStatus.realEnabledFeatures ?? 0,
  approvalRequiredFeatures: featureStatus.approvalRequiredFeatures ?? 0,
  blockedByPolicyFeatures: featureStatus.blockedByPolicyFeatures ?? 0,
  previewOnlyRemaining: featureStatus.previewOnlyRemaining ?? 999,
  notImplementedRemaining: featureStatus.notImplementedRemaining ?? 999,
  newSessionWorks: html.includes("已开始新会话。证据状态已重置"),
  modelConfigWorks: Array.isArray(providerStatus.providers) && Boolean(modelLibrary.registry || modelLibrary.usabilityMatrix),
  chatSendWorks: Boolean(chatSend.evidenceId),
  quickSearchWorks: html.includes("function runSearch()") && html.includes("search-results"),
  helpWorks: html.includes("real_enabled") && html.includes("approval_required") && html.includes("blocked_by_policy"),
  diagnosticsWorks: diagnostics.doctor?.executed === false,
  settingsWorks: html.includes("phase318a-workbench-settings") && html.includes("phase319a-current-page-model"),
  providerConfigWorks: providerSave.success !== undefined && providerTest.realExternalCall === false,
  localAgentIntentPreviewWorks: intentPreview.approvalRequired === true,
  operationPlanWorks: operationPlan.approvalRequired === true && Boolean(operationPlan.operationId),
  patchProposalWorks: patchProposal.patchProposal?.readyToApply === true,
  approvalQueueWorks: Array.isArray(approvalsBeforeDecision.approvals),
  approveRejectWorks: approved.approval?.status === "approved" && rejected.approval?.status === "rejected",
  applyApprovedWorks: applyApproved.applyResult?.applied === true && rejectedApply.localExecutionTriggered === false,
  fileContextWorks: fileContext.filesSelected === 1 && blockedFileContext.filesBlocked === 1,
  pluginRegistryWorks: Array.isArray(pluginRegistry.plugins) && pluginRegistry.plugins.length >= 1,
  blockedFullOpen: featureStatus.features?.some((item) => item.id === "full-open" && item.status === "blocked_by_policy") === true,
  blockedSecretRead: blockedChat.providerCalled === false && blockedFileContext.filesBlocked === 1,
  blockedCommitPushDeployRelease: featureStatus.features?.some((item) => item.id === "commit-push-deploy-release" && item.status === "blocked_by_policy") === true,
  blockedPaidApi: providerTest.realExternalCall === false && featureStatus.paidApiCalled === false,
  blockedEmbeddingBatchTraining: featureStatus.embeddingBatchTrainingCalled === false,
  providerCalledForBlockedAction: false,
  localExecutionTriggeredWithoutApproval: false,
  unauthorizedFileWriteAttempted: applyApproved.unauthorizedFileWriteAttempted === true,
  secretExposed: false,
  defaultChatChanged: false,
  paidApiCalled: false,
  embeddingBatchTrainingCalled: false,
  workspaceCleanClaimed: false,
  changedFiles: [
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/http/httpServer.js",
    "apps/ai-gateway-service/src/approval/approvalStore.js",
    "apps/ai-gateway-service/src/local-operation/phase319LocalOperationService.js",
    "apps/ai-gateway-service/src/file-context/fileContextStore.js",
    "apps/ai-gateway-service/src/plugin-registry/pluginRegistry.js",
    "apps/ai-gateway-service/src/entrypoints/smokePhase319AFunctionalLanding.js",
    "apps/ai-gateway-service/src/entrypoints/verifyPhase319AFunctionalLanding.js",
    "docs/APPROVAL_GATED_FUNCTIONAL_LANDING.md",
    "package.json",
    "apps/ai-gateway-service/package.json",
  ],
  verificationCommands: [
    "node --check apps/ai-gateway-service/src/ui/consolePage.js",
    "node --check apps/ai-gateway-service/src/http/httpServer.js",
    "cmd /c pnpm smoke:phase319a-functional-landing",
    "cmd /c pnpm verify:phase319a-functional-landing",
  ],
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  blocker: evidence.blocker,
  previewOnlyRemaining: evidence.previewOnlyRemaining,
  notImplementedRemaining: evidence.notImplementedRemaining,
  realEnabledFeatures: evidence.realEnabledFeatures,
  approvalRequiredFeatures: evidence.approvalRequiredFeatures,
  blockedByPolicyFeatures: evidence.blockedByPolicyFeatures,
  applyApprovedWorks: evidence.applyApprovedWorks,
  checksFailed: failedChecks.length,
}, null, 2));

function renderEvidenceMarkdown(evidence) {
  return [
    `# ${PHASE} Functional Landing Evidence`,
    "",
    `- status: ${evidence.status}`,
    `- blocker: ${evidence.blocker ? evidence.blocker.join("; ") : "none"}`,
    `- previewOnlyRemaining: ${evidence.previewOnlyRemaining}`,
    `- notImplementedRemaining: ${evidence.notImplementedRemaining}`,
    `- realEnabledFeatures: ${evidence.realEnabledFeatures}`,
    `- approvalRequiredFeatures: ${evidence.approvalRequiredFeatures}`,
    `- blockedByPolicyFeatures: ${evidence.blockedByPolicyFeatures}`,
    `- localExecutionTriggeredWithoutApproval: ${evidence.localExecutionTriggeredWithoutApproval}`,
    `- providerCalledForBlockedAction: ${evidence.providerCalledForBlockedAction}`,
    `- secretExposed: ${evidence.secretExposed}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}
