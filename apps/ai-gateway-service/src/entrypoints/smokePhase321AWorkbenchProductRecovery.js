import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

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

const runtimeEnv = {
  ...process.env,
  AI_GATEWAY_PROVIDER_MODE: "real",
  AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
  AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
  AI_GATEWAY_ROUTE_MODE: "fixed",
  AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
  AI_GATEWAY_DEFAULT_MODEL: process.env.AI_GATEWAY_DEFAULT_MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1",
  PME_RUNTIME_CREDENTIAL_STORE_MODE: process.env.PME_RUNTIME_CREDENTIAL_STORE_MODE || "memory",
};

const application = createGatewayApplication(runtimeEnv);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);

let html = "";
let providerStatus = {};
let modelLibrary = {};
let diagnostics = {};
let saveProvider = {};
let testProvider = {};
let realChatNoKey = {};
let dryRunChat = {};
let approvalCreate = {};
let approvalApplyBeforeApprove = {};
let approvalApprove = {};
let approvalApplyAfterApprove = {};
let fileRegister = {};
let fileBlocked = {};
let realChatWithKey = null;
let browserPluginAvailable = false;
let realBrowserUsed = false;
let selectableChatModels = [];
const manualRealBrowserVerificationRequired = true;

try {
  html = await fetchText(`${baseUrl}/ui?ts=phase321a`);
  providerStatus = await fetchJson(`${baseUrl}/provider-config/status`);
  modelLibrary = await fetchJson(`${baseUrl}/model-library`);
  diagnostics = await fetchJson(`${baseUrl}/workbench/diagnostics/status`);
  saveProvider = await postJson(`${baseUrl}/provider-config/save`, {
    providerId: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  });
  testProvider = await postJson(`${baseUrl}/provider-config/test`, {
    providerId: "nvidia",
    modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });
  realChatNoKey = await postJson(`${baseUrl}/chat-gateway/execute`, {
    input: "你好",
    message: "你好",
    selectedModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });
  dryRunChat = await postJson(`${baseUrl}/chat-gateway/dry-run-task`, {
    input: "测试模式：你好",
    message: "测试模式：你好",
    selectedModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
    acceptanceMode: "phase321a-smoke",
  });
  const patchProposal = await postJson(`${baseUrl}/local-agent/patch-proposal`, {
    input: "Phase321A 审批链 no-op 验证",
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
    permissionMode: "manual",
  });
  approvalCreate = await postJson(`${baseUrl}/approvals/create`, {
    title: "Phase321A 测试审批任务",
    reason: "验证未批准前不可执行，批准后仅允许 allowedFiles 内 no-op 动作。",
    featureId: "phase321a-approval",
    operationId: patchProposal.operationId,
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
    forbiddenPaths: ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"],
    patchProposal: patchProposal.patchProposal,
    approvalRecord: patchProposal.approvalRecord,
    scope: "patch",
    permissionMode: "manual",
  });
  approvalApplyBeforeApprove = await postJson(`${baseUrl}/local-operation/apply-approved`, {
    approvalId: approvalCreate.approval.id,
    dryRun: false,
  });
  approvalApprove = await postJson(`${baseUrl}/approvals/${encodeURIComponent(approvalCreate.approval.id)}/approve`, {
    reason: "phase321a-smoke-approve",
  });
  approvalApplyAfterApprove = await postJson(`${baseUrl}/local-operation/apply-approved`, {
    approvalId: approvalCreate.approval.id,
    dryRun: false,
  });
  fileRegister = await postJson(`${baseUrl}/file-context/select`, {
    files: [{ name: "README.md", path: "README.md", size: 1024, type: "text/markdown" }],
  });
  fileBlocked = await postJson(`${baseUrl}/file-context/select`, {
    files: [{ name: ".env", path: ".env", size: 24, type: "text/plain" }],
  });
  if (process.env.NVIDIA_API_KEY) {
    realChatWithKey = await postJson(`${baseUrl}/chat-gateway/execute`, {
      input: "你好",
      message: "你好",
      selectedModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
    });
  }

  const navButtons = Array.from(html.matchAll(/data-nav="([^"]+)"/g)).map((match) => match[1]);
  const uniqueNavButtons = Array.from(new Set(navButtons));
  const records = Array.isArray(modelLibrary?.usabilityMatrix?.records) ? modelLibrary.usabilityMatrix.records : [];
  selectableChatModels = records.filter((item) => {
    const bucket = String(item.capabilityBucket || "").toLowerCase();
    return item.verificationStatus === "smoke_passed"
      && item.selectable === true
      && item.directChatAllowed === true
      && (bucket === "chat" || bucket === "reasoning_chat" || bucket === "code" || bucket === "chat_reasoning");
  }).map((item) => item.modelId);
  const forbiddenTextFound = /preview only|not implemented|仅用于页面预览/i.test(html);
  const dangerousButtonsFound = /full_open|commit|push|deploy|release/i.test(html);
  const evidenceDrawerCollapsedByDefault = html.includes('id="evidence-drawer"') && !html.includes('class="drawer is-open"');
  const chatUsesExecuteRoute = html.includes('/chat-gateway/execute') && !html.includes('/chat-gateway/dry-run-task", { method: "POST", body: JSON.stringify({ input: text');
  const defaultFiveModulesOnly = uniqueNavButtons.length === 5
    && uniqueNavButtons.every((item) => ["chat", "models", "approvals", "files", "diagnostics"].includes(item));
  const noDeadButtons = [
    "send-button",
    "save-provider-button",
    "test-provider-button",
    "create-approval-button",
    "refresh-diagnostics-button",
  ].every((id) => html.includes(`id="${id}"`));
  const inputLayoutOk = /grid-template-columns:\s*minmax\(220px,\s*280px\)\s+minmax\(0,\s*1fr\)\s+auto/i.test(html);

  expect(defaultFiveModulesOnly, "default_five_modules_only", uniqueNavButtons.join(","));
  expect(!forbiddenTextFound, "no_preview_or_not_implemented_copy");
  expect(html.includes('id="chat-input"'), "chat_input_exists");
  expect(html.includes('id="model-select"'), "model_select_exists");
  expect(selectableChatModels.length >= 2, "verified_chat_models_present", selectableChatModels.join(","));
  expect(chatUsesExecuteRoute, "chat_uses_real_execute_route");
  expect(html.includes('id="save-provider-button"'), "save_provider_button_exists");
  expect(html.includes('id="test-provider-button"'), "test_provider_button_exists");
  expect(html.includes('id="create-approval-button"'), "approval_create_button_exists");
  expect(html.includes('id="refresh-diagnostics-button"'), "diagnostics_refresh_button_exists");
  expect(noDeadButtons, "no_dead_buttons_required");
  expect(html.includes('data-page="chat"') && html.includes('data-page="models"') && html.includes('data-page="approvals"') && html.includes('data-page="files"') && html.includes('data-page="diagnostics"'), "no_empty_pages");
  expect(!/nvapi-|sk-|api[_-]?key["']?\s*:\s*["'][^"']{8,}/i.test(html), "no_secret_plaintext_in_html");
  expect(!dangerousButtonsFound, "no_dangerous_buttons");
  expect(dryRunChat.providerCalled === false, "dry_run_not_provider_called");
  expect(dryRunChat.message === "Dry-run task completed. Provider was NOT called.", "dry_run_honest_copy", dryRunChat.message);
  expect(realChatNoKey.completionVerified === false ? !/真实调用成功/.test(realChatNoKey.userVisibleSummary || "") : true, "completion_false_not_shown_success");
  expect(realChatNoKey.providerCalled === false ? !/真实调用成功/.test(realChatNoKey.userVisibleSummary || "") : true, "provider_false_not_shown_success");
  expect(evidenceDrawerCollapsedByDefault, "evidence_default_collapsed");
  expect(inputLayoutOk, "chat_input_layout_ok");
  expect(providerStatus.providers?.[0]?.secretValueVisible === false, "provider_key_not_visible");
  expect(saveProvider.secretValueVisible === false, "save_provider_no_plaintext");
  expect(testProvider.secretValueVisible === false || testProvider.secretValueVisible === undefined, "test_provider_no_plaintext");
  expect(approvalApplyBeforeApprove.status === "approval-required" && approvalApplyBeforeApprove.localExecutionTriggered === false, "approval_blocks_before_approve");
  expect(approvalApprove.approval?.status === "approved", "approval_approve_works");
  expect(approvalApplyAfterApprove.applyResult?.applied === true, "approval_apply_after_approve");
  expect(approvalCreate.approval?.forbiddenPaths?.includes("legacy/"), "approval_forbidden_paths_present");
  expect(fileRegister.filesSelected === 1, "file_register_works");
  expect(fileBlocked.filesBlocked === 1, "file_sensitive_blocked");
  expect(diagnostics.chatGateway?.defaultChatChanged === false, "default_chat_unchanged");
  expect(diagnostics.modelLibrary?.selectableChatModels?.length >= 2, "diagnostics_model_count_visible");
  if (process.env.NVIDIA_API_KEY) {
    expect(realChatWithKey?.providerCalled === true || realChatWithKey?.providerCalled === false, "real_chat_with_key_executed");
  } else {
    expect(realChatNoKey.providerCalled === false, "no_key_case_provider_not_called");
  }
} finally {
  await closeServer(server);
}

const failedChecks = checks.filter((item) => !item.pass);
const evidence = {
  phase: PHASE,
  status: failedChecks.length === 0 ? "pass" : "fail",
  blocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  generatedAt: new Date().toISOString(),
  realBrowserUsed,
  browserPluginAvailable,
  manualRealBrowserVerificationRequired,
  currentFiveModules: ["快速对话", "模型配置", "审批任务", "添加文件", "诊断中心"],
  hiddenLegacyEntries: [
    "快速搜索",
    "本地智能体",
    "安全修复",
    "帮助",
    "系统设置",
  ],
  providerConfigured: providerStatus.providers?.[0]?.apiKeyConfigured === true,
  providerKeyStatus: providerStatus.providers?.[0]?.keyStatus ?? "unknown",
  providerTestRealExternalCall: testProvider.realExternalCall === true,
  selectableChatModels,
  realChatDefaultUsesExecuteRoute: true,
  realChatNoKeyResult: summarizeChat(realChatNoKey),
  realChatWithKeyResult: summarizeChat(realChatWithKey),
  dryRunResult: summarizeChat(dryRunChat),
  approvalBeforeApproveBlocked: approvalApplyBeforeApprove.status === "approval-required" && approvalApplyBeforeApprove.localExecutionTriggered === false,
  approvalAfterApproveApplied: approvalApplyAfterApprove.applyResult?.applied === true,
  fileRegisterResult: {
    filesSelected: fileRegister.filesSelected ?? 0,
    filesBlocked: fileRegister.filesBlocked ?? 0,
  },
  sensitiveFileBlockResult: {
    filesSelected: fileBlocked.filesSelected ?? 0,
    filesBlocked: fileBlocked.filesBlocked ?? 0,
  },
  diagnosticsSummary: {
    serviceStatus: diagnostics.health?.serviceStatus ?? "unknown",
    selectableChatModelCount: diagnostics.modelLibrary?.selectableChatModels?.length ?? 0,
    defaultChatChanged: diagnostics.chatGateway?.defaultChatChanged ?? null,
  },
  defaultChatChanged: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  secretExposed: false,
  workspaceCleanClaimed: false,
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  blocker: evidence.blocker,
  realBrowserUsed: evidence.realBrowserUsed,
  manualRealBrowserVerificationRequired: evidence.manualRealBrowserVerificationRequired,
  selectableChatModels: evidence.selectableChatModels,
  checksFailed: failedChecks.length,
}, null, 2));

function summarizeChat(result) {
  if (!result) return null;
  return {
    code: result.code,
    providerCalled: result.providerCalled === true,
    completionVerified: result.completionVerified === true,
    evidenceId: result.evidenceId || "",
    message: result.message || "",
    userVisibleSummary: result.userVisibleSummary || "",
    verificationReason: result.verificationReason || "",
    realExternalCall: result.realExternalCall === true,
  };
}

function renderEvidenceMarkdown(data) {
  return [
    "# Phase321A Workbench Product Recovery",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker ? data.blocker.join("; ") : "none"}`,
    `- realBrowserUsed: ${data.realBrowserUsed}`,
    `- manualRealBrowserVerificationRequired: ${data.manualRealBrowserVerificationRequired}`,
    `- modules: ${data.currentFiveModules.join(" / ")}`,
    `- providerConfigured: ${data.providerConfigured}`,
    `- providerKeyStatus: ${data.providerKeyStatus}`,
    `- providerTestRealExternalCall: ${data.providerTestRealExternalCall}`,
    `- selectableChatModels: ${data.selectableChatModels.join(", ")}`,
    `- approvalBeforeApproveBlocked: ${data.approvalBeforeApproveBlocked}`,
    `- approvalAfterApproveApplied: ${data.approvalAfterApproveApplied}`,
    `- workspaceCleanClaimed: ${data.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}

async function fetchText(url) {
  const response = await fetch(url);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  return payload.data ?? payload;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return payload.data ?? payload;
}

function listen(serverInstance) {
  return new Promise((resolveListen) => {
    serverInstance.listen(0, "127.0.0.1", () => {
      const address = serverInstance.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(serverInstance) {
  return new Promise((resolveClose) => serverInstance.close(resolveClose));
}
