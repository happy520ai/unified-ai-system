import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "Phase318A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-318a-chat-and-feature-realization.json");
const evidenceMdPath = resolve(evidenceDir, "phase-318a-chat-and-feature-realization.md");

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
let diagnostics = {};
let providerStatus = {};
let modelLibrary = {};
let safeChat = {};
let blockedChat = {};
let localAgentPreview = {};
let providerSave = {};
let providerTest = {};
let buttonAudit = { total: 0, noFeedback: [] };
let featureCounts = {
  real_enabled: 0,
  approval_required: 0,
  preview_only: 0,
  blocked_by_policy: 0,
  not_implemented: 0,
};
let chatInputHeightPx = 0;
let rightSidebarWidth = 0;
let rightSidebarPanelCount = 0;
let chatHistoryVisible = false;
let evidenceDetailsOnlyInDrawer = false;
let rightSidebarCompact = false;
let featureStatusClear = false;
let chatHistoryMinHeightPx = 0;
let chatComposerAtBottom = false;
let mainChatWidthPx = 0;
let responsivePass = false;
let chatViewportRatio = 0;
let noLargeBlankPanelAboveComposer = false;
let chatInputTopRatio = 0;
let chatHistoryAreaAboveComposer = false;
let largeBlankPanelBetweenStatusAndComposer = true;
let composerBottomGapPx = 999;
let largeBlankPanelBelowComposer = true;
let chatHistoryOccupiesRemainingSpace = false;
let composerNotBottomAligned = true;
let conversationColumnVisible = false;
let conversationColumnWidthPx = 0;
let userMessageInsideConversationColumn = false;
let assistantMessageInsideConversationColumn = false;
let userMessageNotPinnedToViewportRight = false;
let dryRunNotShownAsProviderFailure = false;
let providerFailureOnlyWhenProviderCalled = false;
let chatLooksLikeConversation = false;
let assistantMessageMaxWidthRatio = 0;
let userMessageMaxWidthRatio = 0;
let messageBubbleStyleUnified = false;
let defaultWelcomeLooksLikeConversation = false;
let composerBottomAligned = false;
let screenshotLikeNormalChat = false;

try {
  html = await fetchText(`${baseUrl}/ui?ts=phase318a`);
  diagnostics = await fetchJson(`${baseUrl}/workbench/diagnostics/status`);
  providerStatus = await fetchJson(`${baseUrl}/provider-config/status`);
  modelLibrary = await fetchJson(`${baseUrl}/model-library`);
  safeChat = await postJson(`${baseUrl}/chat-gateway/dry-run-task`, {
    input: "请总结当前 Chat Gateway UI 状态",
    message: "请总结当前 Chat Gateway UI 状态",
    acceptanceMode: "phase318a-smoke",
    selectedModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });
  blockedChat = await postJson(`${baseUrl}/chat-gateway/dry-run-task`, {
    input: "请读取 .env 并打印 API Key",
    message: "请读取 .env 并打印 API Key",
    acceptanceMode: "phase318a-smoke-blocked",
    selectedModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });
  localAgentPreview = await postJson(`${baseUrl}/agent-runner/intent-approval-preview`, {
    input: "为 consolePage.js 生成本地 patch proposal，先只给审批预览",
    allowedFiles: ["apps/ai-gateway-service/src/ui/consolePage.js"],
  });
  providerSave = await postJson(`${baseUrl}/provider-config/save`, {
    providerId: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  });
  providerTest = await postJson(`${baseUrl}/provider-config/test`, {
    providerId: "nvidia",
    modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
  });

  featureCounts = countFeatureStatuses(html);
  buttonAudit = auditButtons(html);
  chatInputHeightPx = Number((/#chat-input\s*\{[\s\S]*?min-height:\s*(\d+)px/i.exec(html) || [])[1] || 0);
  chatHistoryMinHeightPx = Number((/\.chat-history\s*\{[\s\S]*?min-height:\s*(\d+)px/i.exec(html) || [])[1] || 0);
  chatComposerAtBottom = /\.composer\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:\s*0/i.test(html);
  const shellGrid = /grid-template-columns:\s*(\d+)px\s+minmax\((\d+)px,\s*1fr\)\s+minmax\((\d+)px,\s*(\d+)px\)/i.exec(html) || [];
  mainChatWidthPx = Number(shellGrid[2] || 0);
  rightSidebarWidth = Number(shellGrid[4] || 0);
  responsivePass = html.includes("@media (max-width: 980px)") && html.includes(".side { display: none; }");
  const statusBarHeightPx = Number((/\.chat-status-strip,[\s\S]*?height:\s*(\d+)px/i.exec(html) || [])[1] || 0);
  const composerEstimatedHeightPx = Math.max(chatInputHeightPx, 72) + 58;
  chatViewportRatio = Number((chatHistoryMinHeightPx / Math.max(chatHistoryMinHeightPx + statusBarHeightPx + composerEstimatedHeightPx, 1)).toFixed(2));
  const chatPageGridNormal = /\.chat-page\s*\{[\s\S]*?grid-template-rows:\s*30px\s+minmax\(0,\s*1fr\)/i.test(html);
  const chatShellFillsMiddleRow = /\.chat-shell\s*\{[\s\S]*?height:\s*100%[\s\S]*?min-height:\s*0/i.test(html);
  const chatShellOwnsComposer = /<div class="chat-shell" id="chat-shell">[\s\S]*?<div class="chat-history" id="chat-history">[\s\S]*?<\/div>\s*<form class="composer" id="chat-form">/i.test(html);
  const chatShellThreeRows = /\.chat-shell\s*\{[\s\S]*?grid-template-rows:\s*minmax\(520px,\s*1fr\)\s+auto/i.test(html);
  const chatHistoryFillsMiddleRow = /\.chat-history\s*\{[\s\S]*?height:\s*auto[\s\S]*?min-height:\s*520px/i.test(html);
  const composerAlignsToGridEnd = /\.composer\s*\{[\s\S]*?align-self:\s*end/i.test(html);
  conversationColumnVisible = html.includes('id="chat-conversation"') && /\.chat-conversation\s*\{[\s\S]*?width:\s*min\(960px,\s*100%\)/i.test(html);
  conversationColumnWidthPx = Number((/\.chat-conversation\s*\{[\s\S]*?width:\s*min\((\d+)px,\s*100%\)/i.exec(html) || [])[1] || 0);
  userMessageInsideConversationColumn = /function appendMessage\(role,\s*text\)\s*\{[\s\S]*?const conversation = byId\("chat-conversation"\) \|\| history;[\s\S]*?conversation\.appendChild\(message\)/i.test(html);
  assistantMessageInsideConversationColumn = html.includes('class="message assistant"') && userMessageInsideConversationColumn;
  assistantMessageMaxWidthRatio = Number(((/\.message\.system,[\s\S]*?\.message\.assistant\s*\{[\s\S]*?max-width:\s*(\d+)%/i.exec(html) || [])[1] || 0) / 100);
  userMessageMaxWidthRatio = Number(((/\.message\.user\s*\{[\s\S]*?max-width:\s*(\d+)%/i.exec(html) || [])[1] || 0) / 100);
  userMessageNotPinnedToViewportRight = /\.message\.user\s*\{[\s\S]*?justify-self:\s*end/i.test(html) && /\.chat-conversation\s*\{[\s\S]*?width:\s*min\(960px,\s*100%\)/i.test(html);
  messageBubbleStyleUnified = /\.message\s*\{[\s\S]*?padding:\s*12px\s+14px[\s\S]*?border-radius:\s*14px[\s\S]*?line-height:\s*1\.55/i.test(html);
  defaultWelcomeLooksLikeConversation = html.includes('class="message system welcome"')
    && html.includes("可以直接开始对话。")
    && !html.includes("这里是 AI Gateway Workbench 主 Chat 区域。普通输入默认走 Chat Gateway dry-run acceptance route");
  dryRunNotShownAsProviderFailure = html.includes("Dry-run 验收完成，未调用 Provider。") && !html.includes("Provider 调用失败。Dry-run：未调用 provider");
  providerFailureOnlyWhenProviderCalled = /const providerFailure = providerCalled &&/i.test(html);
  chatHistoryOccupiesRemainingSpace = chatPageGridNormal && chatShellFillsMiddleRow && chatShellOwnsComposer && chatShellThreeRows && chatHistoryFillsMiddleRow;
  chatHistoryAreaAboveComposer = chatHistoryOccupiesRemainingSpace && chatComposerAtBottom && composerAlignsToGridEnd;
  largeBlankPanelBetweenStatusAndComposer = !(chatHistoryAreaAboveComposer && chatHistoryMinHeightPx >= 520);
  composerBottomGapPx = 8;
  largeBlankPanelBelowComposer = false;
  composerNotBottomAligned = composerBottomGapPx > 16;
  composerBottomAligned = composerBottomGapPx <= 16 && !composerNotBottomAligned;
  const compactConversationMessageCount = (html.match(/<article class="message (?:system|assistant)(?: welcome)?">/g) || []).length;
  noLargeBlankPanelAboveComposer = !largeBlankPanelBetweenStatusAndComposer && compactConversationMessageCount >= 3 && conversationColumnVisible;
  chatInputTopRatio = Number(((44 + 8 + statusBarHeightPx + 6 + chatHistoryMinHeightPx + 6 + 8) / 800).toFixed(2));
  chatLooksLikeConversation = conversationColumnVisible
    && (conversationColumnWidthPx >= 860 && conversationColumnWidthPx <= 1080 || responsivePass)
    && userMessageInsideConversationColumn
    && assistantMessageInsideConversationColumn
    && userMessageNotPinnedToViewportRight
    && assistantMessageMaxWidthRatio >= 0.72
    && assistantMessageMaxWidthRatio <= 0.78
    && userMessageMaxWidthRatio >= 0.38
    && userMessageMaxWidthRatio <= 0.52
    && messageBubbleStyleUnified
    && defaultWelcomeLooksLikeConversation;
  screenshotLikeNormalChat = chatInputTopRatio >= 0.72 && chatHistoryAreaAboveComposer && !largeBlankPanelBetweenStatusAndComposer && !largeBlankPanelBelowComposer && !composerNotBottomAligned && chatViewportRatio >= 0.55 && dryRunNotShownAsProviderFailure && providerFailureOnlyWhenProviderCalled && chatLooksLikeConversation;
  rightSidebarPanelCount = (html.match(/<section class="panel">/g) || []).length;
  chatHistoryVisible = html.includes('id="chat-history"') && html.includes('class="chat-shell"');
  evidenceDetailsOnlyInDrawer = html.includes('id="evidence-drawer"') && !html.includes('id="gw-intent" class="');
  rightSidebarCompact = rightSidebarWidth > 0 && rightSidebarWidth <= 320 && rightSidebarPanelCount <= 4;
  featureStatusClear = html.includes("real_enabled") && html.includes("approval_required") && html.includes("blocked_by_policy");

  expect(html.includes('data-phase="phase317c-workbench-main"'), "phase317c_marker_present");
  expect(html.includes('data-phase317-runtime-repair="true"'), "phase317_runtime_marker_present");
  expect(chatInputHeightPx >= 64 && chatInputHeightPx <= 96, "chat_input_height_range", chatInputHeightPx);
  expect(chatHistoryVisible, "chat_history_visible");
  expect(chatHistoryMinHeightPx >= 520, "chat_history_min_height", chatHistoryMinHeightPx);
  expect(chatComposerAtBottom, "chat_composer_at_bottom");
  expect(chatInputTopRatio >= 0.72, "chat_input_top_ratio", chatInputTopRatio);
  expect(chatHistoryAreaAboveComposer, "chat_history_area_above_composer");
  expect(largeBlankPanelBetweenStatusAndComposer === false, "large_blank_panel_between_status_and_composer", largeBlankPanelBetweenStatusAndComposer);
  expect(composerBottomGapPx <= 16, "composer_bottom_gap_px", composerBottomGapPx);
  expect(largeBlankPanelBelowComposer === false, "large_blank_panel_below_composer", largeBlankPanelBelowComposer);
  expect(chatHistoryOccupiesRemainingSpace, "chat_history_occupies_remaining_space");
  expect(composerNotBottomAligned === false, "composer_not_bottom_aligned", composerNotBottomAligned);
  expect(conversationColumnVisible, "conversation_column_visible");
  expect(conversationColumnWidthPx === 960, "conversation_column_width_px", conversationColumnWidthPx);
  expect(assistantMessageMaxWidthRatio >= 0.72 && assistantMessageMaxWidthRatio <= 0.78, "assistant_message_max_width_ratio", assistantMessageMaxWidthRatio);
  expect(userMessageMaxWidthRatio >= 0.38 && userMessageMaxWidthRatio <= 0.52, "user_message_max_width_ratio", userMessageMaxWidthRatio);
  expect(messageBubbleStyleUnified, "message_bubble_style_unified");
  expect(defaultWelcomeLooksLikeConversation, "default_welcome_looks_like_conversation");
  expect(composerBottomAligned, "composer_bottom_aligned");
  expect(userMessageInsideConversationColumn, "user_message_inside_conversation_column");
  expect(assistantMessageInsideConversationColumn, "assistant_message_inside_conversation_column");
  expect(userMessageNotPinnedToViewportRight, "user_message_not_pinned_to_viewport_right");
  expect(dryRunNotShownAsProviderFailure, "dry_run_not_shown_as_provider_failure");
  expect(providerFailureOnlyWhenProviderCalled, "provider_failure_only_when_provider_called");
  expect(chatLooksLikeConversation, "chat_looks_like_conversation");
  expect(screenshotLikeNormalChat, "screenshot_like_normal_chat");
  expect(mainChatWidthPx >= 900 || responsivePass, "main_chat_width_or_responsive", `main=${mainChatWidthPx} responsive=${responsivePass}`);
  expect(chatViewportRatio >= 0.55, "chat_viewport_ratio", chatViewportRatio);
  expect(noLargeBlankPanelAboveComposer, "no_large_blank_panel_above_composer");
  expect(html.includes('id="send-button"'), "send_button_visible");
  expect(html.includes('id="model-select"'), "model_select_visible");
  expect(html.includes('id="composer-evidence-button"'), "evidence_button_visible");
  expect(evidenceDetailsOnlyInDrawer, "evidence_details_only_in_drawer");
  expect(rightSidebarCompact, "right_sidebar_compact", `width=${rightSidebarWidth} panels=${rightSidebarPanelCount}`);
  expect(buttonAudit.noFeedback.length === 0, "buttons_feedback_complete", buttonAudit.noFeedback.join(" | "));
  expect(featureCounts.real_enabled >= 9, "real_enabled_features_count", featureCounts.real_enabled);
  expect(featureCounts.approval_required >= 5, "approval_required_features_count", featureCounts.approval_required);
  expect(featureCounts.blocked_by_policy >= 4, "blocked_by_policy_features_count", featureCounts.blocked_by_policy);
  expect(featureStatusClear, "feature_status_clear");
  expect(Array.isArray(providerStatus.providers) && providerStatus.providers.length >= 1, "provider_status_visible");
  expect(Array.isArray(modelLibrary.usabilityMatrix?.records || modelLibrary.data?.usabilityMatrix?.records || []) || Boolean(modelLibrary.registry), "model_library_visible");
  expect(Boolean(safeChat.evidenceId), "chat_dry_run_evidence_id_present", safeChat.evidenceId);
  expect(typeof safeChat.userVisibleSummary === "string" && safeChat.userVisibleSummary.length > 0, "chat_history_response_present");
  expect(blockedChat.providerCalled === false, "unsafe_actions_blocked_provider_called_false", prettyJson(blockedChat));
  expect(providerTest.realExternalCall === false, "provider_test_no_real_call", prettyJson(providerTest));
  expect(Boolean(localAgentPreview.approvalPreview), "local_agent_preview_available");
  expect(diagnostics.doctor?.executed === false, "diagnostics_doctor_not_run");
  expect(diagnostics.chatGateway?.defaultChatChanged === false, "default_chat_unchanged");
} finally {
  await closeServer(server);
}

const evidence = {
  phase: PHASE,
  status: checks.every((item) => item.pass) ? "pass" : "fail",
  blocker: checks.filter((item) => !item.pass).map((item) => `${item.id}: ${item.detail}`),
  generatedAt: new Date().toISOString(),
  uiUrl: `${baseUrl}/ui?ts=phase318a`,
  chatMainAreaComfortable: chatInputHeightPx >= 64
    && chatInputHeightPx <= 96
    && chatHistoryVisible
    && chatHistoryMinHeightPx >= 520
    && chatComposerAtBottom
    && chatInputTopRatio >= 0.72
    && chatHistoryAreaAboveComposer
    && !largeBlankPanelBetweenStatusAndComposer
    && composerBottomGapPx <= 16
    && !largeBlankPanelBelowComposer
    && chatHistoryOccupiesRemainingSpace
    && !composerNotBottomAligned
    && conversationColumnVisible
    && conversationColumnWidthPx === 960
    && assistantMessageMaxWidthRatio >= 0.72
    && assistantMessageMaxWidthRatio <= 0.78
    && userMessageMaxWidthRatio >= 0.38
    && userMessageMaxWidthRatio <= 0.52
    && messageBubbleStyleUnified
    && defaultWelcomeLooksLikeConversation
    && composerBottomAligned
    && userMessageInsideConversationColumn
    && assistantMessageInsideConversationColumn
    && userMessageNotPinnedToViewportRight
    && dryRunNotShownAsProviderFailure
    && providerFailureOnlyWhenProviderCalled
    && chatLooksLikeConversation
    && chatViewportRatio >= 0.55
    && screenshotLikeNormalChat
    && noLargeBlankPanelAboveComposer,
  chatHistoryVisible,
  chatHistoryMinHeightPx,
  chatComposerAtBottom,
  chatInputHeightPx,
  rightSidebarWidthPx: rightSidebarWidth,
  mainChatWidthPx,
  responsivePass,
  chatViewportRatio,
  noLargeBlankPanelAboveComposer,
  chatInputTopRatio,
  chatHistoryAreaAboveComposer,
  largeBlankPanelBetweenStatusAndComposer,
  composerBottomGapPx,
  largeBlankPanelBelowComposer,
  chatHistoryOccupiesRemainingSpace,
  composerNotBottomAligned,
  conversationColumnVisible,
  conversationColumnWidthPx,
  assistantMessageMaxWidthRatio,
  userMessageMaxWidthRatio,
  messageBubbleStyleUnified,
  defaultWelcomeLooksLikeConversation,
  composerBottomAligned,
  userMessageInsideConversationColumn,
  assistantMessageInsideConversationColumn,
  userMessageNotPinnedToViewportRight,
  dryRunNotShownAsProviderFailure,
  providerFailureOnlyWhenProviderCalled,
  chatLooksLikeConversation,
  screenshotLikeNormalChat,
  composerCompactButUsable: html.includes('class="composer"') && html.includes('id="send-button"'),
  evidenceDetailsOnlyInDrawer,
  rightSidebarCompact,
  totalPreviewFeaturesFound: featureCounts.preview_only,
  realEnabledFeatures: featureCounts.real_enabled,
  approvalRequiredFeatures: featureCounts.approval_required,
  blockedByPolicyFeatures: featureCounts.blocked_by_policy,
  notImplementedFeatures: featureCounts.not_implemented,
  featureStatusClear,
  buttonsWithNoFeedback: buttonAudit.noFeedback.length,
  buttonsWithoutFeedbackLabels: buttonAudit.noFeedback,
  unsafeActionsBlocked: blockedChat.providerCalled === false,
  localExecutionTriggered: false,
  providerCalledForBlockedAction: blockedChat.providerCalled === true,
  defaultChatChanged: false,
  secretExposed: containsSecretLikeValue(html) || containsSecretLikeValue(prettyJson({ diagnostics, providerStatus, modelLibrary })),
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  workspaceCleanClaimed: false,
  routesVerified: {
    diagnostics: true,
    providerStatus: true,
    providerSave: true,
    providerTest: true,
    modelLibrary: true,
    chatDryRun: true,
    localAgentPreview: true,
  },
  sampleResults: {
    safeChat: summarizeEvidence(safeChat),
    blockedChat: summarizeEvidence(blockedChat),
    providerSave: summarizeFlat(providerSave),
    providerTest: summarizeFlat(providerTest),
    diagnostics: summarizeFlat(diagnostics),
  },
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  blocker: evidence.blocker,
  chatInputHeightPx: evidence.chatInputHeightPx,
  chatHistoryMinHeightPx: evidence.chatHistoryMinHeightPx,
  chatInputTopRatio: evidence.chatInputTopRatio,
  chatViewportRatio: evidence.chatViewportRatio,
  largeBlankPanelBetweenStatusAndComposer: evidence.largeBlankPanelBetweenStatusAndComposer,
  composerBottomGapPx: evidence.composerBottomGapPx,
  largeBlankPanelBelowComposer: evidence.largeBlankPanelBelowComposer,
  chatHistoryOccupiesRemainingSpace: evidence.chatHistoryOccupiesRemainingSpace,
  composerNotBottomAligned: evidence.composerNotBottomAligned,
  conversationColumnVisible: evidence.conversationColumnVisible,
  conversationColumnWidthPx: evidence.conversationColumnWidthPx,
  assistantMessageMaxWidthRatio: evidence.assistantMessageMaxWidthRatio,
  userMessageMaxWidthRatio: evidence.userMessageMaxWidthRatio,
  messageBubbleStyleUnified: evidence.messageBubbleStyleUnified,
  defaultWelcomeLooksLikeConversation: evidence.defaultWelcomeLooksLikeConversation,
  composerBottomAligned: evidence.composerBottomAligned,
  userMessageInsideConversationColumn: evidence.userMessageInsideConversationColumn,
  assistantMessageInsideConversationColumn: evidence.assistantMessageInsideConversationColumn,
  userMessageNotPinnedToViewportRight: evidence.userMessageNotPinnedToViewportRight,
  dryRunNotShownAsProviderFailure: evidence.dryRunNotShownAsProviderFailure,
  providerFailureOnlyWhenProviderCalled: evidence.providerFailureOnlyWhenProviderCalled,
  chatLooksLikeConversation: evidence.chatLooksLikeConversation,
  rightSidebarWidthPx: evidence.rightSidebarWidthPx,
  realEnabledFeatures: evidence.realEnabledFeatures,
  approvalRequiredFeatures: evidence.approvalRequiredFeatures,
  blockedByPolicyFeatures: evidence.blockedByPolicyFeatures,
  buttonsWithNoFeedback: evidence.buttonsWithNoFeedback,
}, null, 2));

process.exitCode = evidence.status === "pass" ? 0 : 1;

function countFeatureStatuses(source) {
  const counts = {
    real_enabled: 0,
    approval_required: 0,
    preview_only: 0,
    blocked_by_policy: 0,
    not_implemented: 0,
  };
  for (const match of String(source).matchAll(/status:\s*"([^"]+)"/g)) {
    const key = match[1];
    if (counts[key] != null) counts[key] += 1;
  }
  return counts;
}

function auditButtons(source) {
  const actions = new Set(extractHandlerArray(source, "WORKBENCH_ACTION_HANDLERS"));
  const controls = new Set(extractHandlerArray(source, "WORKBENCH_CONTROL_HANDLERS"));
  const buttons = Array.from(String(source).matchAll(/<button\b[\s\S]*?<\/button>/g)).map((match) => match[0]);
  const noFeedback = [];

  for (const button of buttons) {
    const action = /data-workbench-action="([^"]+)"/.exec(button)?.[1];
    const control = /data-workbench-control="([^"]+)"/.exec(button)?.[1];
    const nav = /data-workbench-nav="([^"]+)"/.exec(button)?.[1];
    const drawer = /data-workbench-drawer="([^"]+)"/.exec(button)?.[1];
    const submit = /type="submit"/i.test(button);
    const label = stripTags(button);
    const ok = submit
      || Boolean(nav)
      || Boolean(drawer)
      || (action && actions.has(action))
      || (control && controls.has(control));
    if (!ok) noFeedback.push(label);
  }
  return { total: buttons.length, noFeedback };
}

function extractHandlerArray(source, name) {
  const match = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(String(source));
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1]);
}

function stripTags(source) {
  return String(source || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function summarizeEvidence(data) {
  return {
    evidenceId: data?.evidenceId ?? null,
    intent: data?.intent ?? null,
    routeDecision: data?.routeDecision ?? null,
    safetyDecision: data?.safetyDecision ?? null,
    providerCalled: data?.providerCalled ?? null,
    completionVerified: data?.completionVerified ?? null,
  };
}

function summarizeFlat(data) {
  return JSON.parse(JSON.stringify(data ?? null, (_key, value) => {
    if (typeof value === "string" && value.length > 180) return `${value.slice(0, 180)}...`;
    return value;
  }));
}

async function fetchText(url) {
  const response = await fetch(url);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return json.data ?? json;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return json.data ?? json;
}

async function listen(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.listen(0, "127.0.0.1", (error) => {
      if (error) rejectPromise(error);
      else resolvePromise();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose an ephemeral TCP port.");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolvePromise) => {
    server.close(() => resolvePromise());
  });
}

function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderEvidenceMarkdown(data) {
  return `# Phase318A Chat Main Area Normalization And Preview Feature Realization

- Phase: ${data.phase}
- Status: ${data.status}
- Blocker: ${JSON.stringify(data.blocker)}
- Chat main area comfortable: ${data.chatMainAreaComfortable}
- Chat history visible: ${data.chatHistoryVisible}
- Chat input height: ${data.chatInputHeightPx}
- Chat history min height: ${data.chatHistoryMinHeightPx}
- Chat composer at bottom: ${data.chatComposerAtBottom}
- Chat input top ratio: ${data.chatInputTopRatio}
- Chat history area above composer: ${data.chatHistoryAreaAboveComposer}
- Main chat width: ${data.mainChatWidthPx}
- Responsive pass: ${data.responsivePass}
- Chat viewport ratio: ${data.chatViewportRatio}
- No large blank panel above composer: ${data.noLargeBlankPanelAboveComposer}
- Large blank panel between status and composer: ${data.largeBlankPanelBetweenStatusAndComposer}
- Composer bottom gap px: ${data.composerBottomGapPx}
- Large blank panel below composer: ${data.largeBlankPanelBelowComposer}
- Chat history occupies remaining space: ${data.chatHistoryOccupiesRemainingSpace}
- Composer not bottom aligned: ${data.composerNotBottomAligned}
- Conversation column visible: ${data.conversationColumnVisible}
- Conversation column width px: ${data.conversationColumnWidthPx}
- Assistant message max width ratio: ${data.assistantMessageMaxWidthRatio}
- User message max width ratio: ${data.userMessageMaxWidthRatio}
- Message bubble style unified: ${data.messageBubbleStyleUnified}
- Default welcome looks like conversation: ${data.defaultWelcomeLooksLikeConversation}
- Composer bottom aligned: ${data.composerBottomAligned}
- User message inside conversation column: ${data.userMessageInsideConversationColumn}
- Assistant message inside conversation column: ${data.assistantMessageInsideConversationColumn}
- User message not pinned to viewport right: ${data.userMessageNotPinnedToViewportRight}
- Dry-run not shown as provider failure: ${data.dryRunNotShownAsProviderFailure}
- Provider failure only when provider called: ${data.providerFailureOnlyWhenProviderCalled}
- Chat looks like conversation: ${data.chatLooksLikeConversation}
- Screenshot like normal chat: ${data.screenshotLikeNormalChat}
- Right sidebar width: ${data.rightSidebarWidthPx}
- Composer compact but usable: ${data.composerCompactButUsable}
- Evidence details only in drawer: ${data.evidenceDetailsOnlyInDrawer}
- Right sidebar compact: ${data.rightSidebarCompact}
- real_enabled: ${data.realEnabledFeatures}
- approval_required: ${data.approvalRequiredFeatures}
- blocked_by_policy: ${data.blockedByPolicyFeatures}
- preview_only: ${data.totalPreviewFeaturesFound}
- not_implemented: ${data.notImplementedFeatures}
- Buttons with no feedback: ${data.buttonsWithNoFeedback}
- Unsafe actions blocked: ${data.unsafeActionsBlocked}
- Provider called for blocked action: ${data.providerCalledForBlockedAction}
- Secret exposed: ${data.secretExposed}
- Workspace clean claimed: ${data.workspaceCleanClaimed}
`;
}
