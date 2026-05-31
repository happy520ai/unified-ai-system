import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const evidence = readJson(evidenceJsonPath) ?? {};
const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const httpServer = readText("apps/ai-gateway-service/src/http/httpServer.js");
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
const docs = readText("docs/CHAT_MAIN_AREA_AND_FEATURE_REALIZATION.md");

expect(evidence.phase === PHASE, "phase_marker", evidence.phase);
expect(evidence.status === "pass", "smoke_status_pass", evidence.status);
expect(evidence.chatMainAreaComfortable === true, "chat_main_area_comfortable");
expect(evidence.chatHistoryVisible === true, "chat_history_visible");
expect(Number(evidence.chatHistoryMinHeightPx) >= 520, "chat_history_min_height", evidence.chatHistoryMinHeightPx);
expect(evidence.chatComposerAtBottom === true, "chat_composer_at_bottom");
expect(Number(evidence.chatInputTopRatio) >= 0.72, "chat_input_top_ratio", evidence.chatInputTopRatio);
expect(evidence.chatHistoryAreaAboveComposer === true, "chat_history_area_above_composer");
expect(evidence.largeBlankPanelBetweenStatusAndComposer === false, "large_blank_panel_between_status_and_composer");
expect(Number(evidence.composerBottomGapPx) <= 16, "composer_bottom_gap_px", evidence.composerBottomGapPx);
expect(evidence.largeBlankPanelBelowComposer === false, "large_blank_panel_below_composer");
expect(evidence.chatHistoryOccupiesRemainingSpace === true, "chat_history_occupies_remaining_space");
expect(evidence.composerNotBottomAligned === false, "composer_not_bottom_aligned");
expect(evidence.conversationColumnVisible === true, "conversation_column_visible");
expect(Number(evidence.conversationColumnWidthPx) === 960, "conversation_column_width_px", evidence.conversationColumnWidthPx);
expect(Number(evidence.assistantMessageMaxWidthRatio) >= 0.72 && Number(evidence.assistantMessageMaxWidthRatio) <= 0.78, "assistant_message_max_width_ratio", evidence.assistantMessageMaxWidthRatio);
expect(Number(evidence.userMessageMaxWidthRatio) >= 0.38 && Number(evidence.userMessageMaxWidthRatio) <= 0.52, "user_message_max_width_ratio", evidence.userMessageMaxWidthRatio);
expect(evidence.messageBubbleStyleUnified === true, "message_bubble_style_unified");
expect(evidence.defaultWelcomeLooksLikeConversation === true, "default_welcome_looks_like_conversation");
expect(evidence.composerBottomAligned === true, "composer_bottom_aligned");
expect(evidence.userMessageInsideConversationColumn === true, "user_message_inside_conversation_column");
expect(evidence.assistantMessageInsideConversationColumn === true, "assistant_message_inside_conversation_column");
expect(evidence.userMessageNotPinnedToViewportRight === true, "user_message_not_pinned_to_viewport_right");
expect(evidence.dryRunNotShownAsProviderFailure === true, "dry_run_not_shown_as_provider_failure");
expect(evidence.providerFailureOnlyWhenProviderCalled === true, "provider_failure_only_when_provider_called");
expect(evidence.chatLooksLikeConversation === true, "chat_looks_like_conversation");
expect(evidence.screenshotLikeNormalChat === true, "screenshot_like_normal_chat");
expect(Number(evidence.chatInputHeightPx) >= 64 && Number(evidence.chatInputHeightPx) <= 96, "chat_input_height_range", evidence.chatInputHeightPx);
expect(Number(evidence.rightSidebarWidthPx) <= 320, "right_sidebar_width", evidence.rightSidebarWidthPx);
expect(Number(evidence.mainChatWidthPx) >= 900 || evidence.responsivePass === true, "main_chat_width_or_responsive", `main=${evidence.mainChatWidthPx} responsive=${evidence.responsivePass}`);
expect(Number(evidence.chatViewportRatio) >= 0.55, "chat_viewport_ratio", evidence.chatViewportRatio);
expect(evidence.noLargeBlankPanelAboveComposer === true, "no_large_blank_panel_above_composer");
expect(evidence.composerCompactButUsable === true, "composer_compact_usable");
expect(evidence.evidenceDetailsOnlyInDrawer === true, "evidence_drawer_only");
expect(evidence.rightSidebarCompact === true, "right_sidebar_compact");
expect(Number(evidence.realEnabledFeatures) >= 9, "real_enabled_minimum", evidence.realEnabledFeatures);
expect(Number(evidence.approvalRequiredFeatures) >= 5, "approval_required_minimum", evidence.approvalRequiredFeatures);
expect(Number(evidence.blockedByPolicyFeatures) >= 4, "blocked_minimum", evidence.blockedByPolicyFeatures);
expect(Number(evidence.totalPreviewFeaturesFound) === 0, "preview_features_zero", evidence.totalPreviewFeaturesFound);
expect(Number(evidence.notImplementedFeatures) === 0, "not_implemented_zero", evidence.notImplementedFeatures);
expect(Number(evidence.buttonsWithNoFeedback) === 0, "buttons_feedback_complete", evidence.buttonsWithNoFeedback);
expect(evidence.unsafeActionsBlocked === true, "unsafe_actions_blocked");
expect(evidence.localExecutionTriggered === false, "local_execution_not_triggered");
expect(evidence.providerCalledForBlockedAction === false, "provider_not_called_for_blocked");
expect(evidence.defaultChatChanged === false, "default_chat_unchanged");
expect(evidence.secretExposed === false, "secret_not_exposed");
expect(evidence.paidApiCalled === false, "paid_api_not_called");
expect(evidence.mimoCalled === false, "mimo_not_called");
expect(evidence.openaiCalled === false, "openai_not_called");
expect(evidence.claudeCalled === false, "claude_not_called");
expect(evidence.openrouterCalled === false, "openrouter_not_called");
expect(evidence.embeddingBatchTrainingCalled === false, "embedding_not_called");
expect(evidence.workspaceCleanClaimed === false, "workspace_clean_not_claimed");

expect(consolePage.includes('data-phase="phase317c-workbench-main"'), "source_phase317_marker");
expect(consolePage.includes('data-phase317-runtime-repair="true"'), "source_phase317_runtime_marker");
expect(consolePage.includes('id="chat-history"'), "source_chat_history");
expect(consolePage.includes('id="chat-conversation"'), "source_chat_conversation");
expect(/\.chat-conversation\s*\{[\s\S]*?width:\s*min\(960px,\s*100%\)/i.test(consolePage), "source_chat_conversation_width");
expect(/\.message\.system,[\s\S]*?\.message\.assistant\s*\{[\s\S]*?max-width:\s*74%/i.test(consolePage), "source_assistant_message_width");
expect(/\.message\.user\s*\{[\s\S]*?max-width:\s*48%/i.test(consolePage), "source_user_message_width");
expect(/\.message\s*\{[\s\S]*?padding:\s*12px\s+14px[\s\S]*?border-radius:\s*14px[\s\S]*?line-height:\s*1\.55/i.test(consolePage), "source_message_bubble_unified");
expect(consolePage.includes("可以直接开始对话。"), "source_default_welcome_compact");
expect(/function appendMessage\(role,\s*text\)\s*\{[\s\S]*?const conversation = byId\("chat-conversation"\) \|\| history;[\s\S]*?conversation\.appendChild\(message\)/i.test(consolePage), "source_append_message_to_conversation");
expect(/const providerFailure = providerCalled &&/i.test(consolePage), "source_provider_failure_requires_provider_called");
expect(consolePage.includes("Dry-run 验收完成，未调用 Provider。"), "source_dry_run_not_provider_failure_copy");
expect(!consolePage.includes("Provider 调用失败。Dry-run：未调用 provider"), "source_no_dry_run_provider_failure_conflict");
expect(/\.chat-page\s*\{[\s\S]*?grid-template-rows:\s*30px\s+minmax\(0,\s*1fr\)/i.test(consolePage), "source_chat_page_two_rows");
expect(/\.workbench-page\.chat-page\.is-active\s*\{[\s\S]*?height:\s*calc\(100dvh - 44px\)/i.test(consolePage), "source_chat_active_full_height");
expect(/\.chat-shell\s*\{[\s\S]*?height:\s*100%[\s\S]*?min-height:\s*0/i.test(consolePage), "source_chat_shell_full_height");
expect(/\.chat-shell\s*\{[\s\S]*?grid-template-rows:\s*minmax\(520px,\s*1fr\)\s+auto/i.test(consolePage), "source_chat_shell_history_composer_rows");
expect(/<div class="chat-shell" id="chat-shell">[\s\S]*?<div class="chat-history" id="chat-history">[\s\S]*?<\/div>\s*<form class="composer" id="chat-form">/i.test(consolePage), "source_composer_inside_chat_shell");
expect(/\.chat-history\s*\{[\s\S]*?height:\s*auto[\s\S]*?min-height:\s*520px/i.test(consolePage), "source_chat_history_min_height");
expect(/\.composer\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:\s*0/i.test(consolePage), "source_composer_bottom");
expect(/\.composer\s*\{[\s\S]*?align-self:\s*end/i.test(consolePage), "source_composer_align_end");
expect(/grid-template-columns:\s*184px\s+minmax\(900px,\s*1fr\)\s+minmax\(280px,\s*320px\)/i.test(consolePage), "source_chat_main_grid_widths");
expect(consolePage.includes('id="chat-input"'), "source_chat_input");
expect(consolePage.includes('id="send-button"'), "source_send_button");
expect(consolePage.includes('data-workbench-drawer="gateway-evidence"'), "source_evidence_drawer");
expect(consolePage.includes('id="search-results"'), "source_search_results");
expect(consolePage.includes('id="local-agent-output"'), "source_local_agent_output");
expect(consolePage.includes('id="repair-output"'), "source_repair_output");
expect(consolePage.includes('id="approval-list"'), "source_approval_list");
expect(consolePage.includes('id="settings-output"'), "source_settings_output");
expect(consolePage.includes('id="diagnostics-health-output"'), "source_diagnostics_output");
expect(consolePage.includes('approval_required'), "source_approval_status");
expect(consolePage.includes('blocked_by_policy'), "source_blocked_status");
expect(consolePage.includes('/workbench/diagnostics/status'), "source_diagnostics_route_client");
expect(consolePage.includes('/chat-gateway/dry-run-task'), "source_chat_dry_run_route");
expect(consolePage.includes('/provider-config/save'), "source_provider_save_route");
expect(consolePage.includes('/provider-config/test'), "source_provider_test_route");
expect(consolePage.includes('/agent-runner/intent-approval-preview'), "source_local_agent_route");

expect(httpServer.includes('url.pathname === "/workbench/diagnostics/status"'), "server_diagnostics_route");
expect(httpServer.includes('pathname === "/workbench/diagnostics/status"'), "server_diagnostics_public_route");

expect(rootPackage.includes("smoke:phase318a-chat-feature-realization"), "root_script_smoke_318a");
expect(rootPackage.includes("verify:phase318a-chat-feature-realization"), "root_script_verify_318a");
expect(servicePackage.includes("smoke:phase318a-chat-feature-realization"), "service_script_smoke_318a");
expect(servicePackage.includes("verify:phase318a-chat-feature-realization"), "service_script_verify_318a");

expect(docs.includes("Phase318A"), "docs_phase318a");
expect(docs.includes("real_enabled"), "docs_real_enabled");
expect(docs.includes("approval_required"), "docs_approval_required");
expect(docs.includes("blocked_by_policy"), "docs_blocked_by_policy");
expect(docs.includes("workspace dirty"), "docs_workspace_dirty");

expect(existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints/smokePhase318AChatAndFeatureRealization.js")), "smoke_file_exists");
expect(existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints/verifyPhase318AChatAndFeatureRealization.js")), "verify_file_exists");
expect(existsSync(resolve(repoRoot, "docs/CHAT_MAIN_AREA_AND_FEATURE_REALIZATION.md")), "docs_file_exists");
expect(!containsSecretLikeValue(JSON.stringify(evidence)), "evidence_no_secret");

const failedChecks = checks.filter((item) => !item.pass);
const finalEvidence = {
  ...evidence,
  phase: PHASE,
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
  smokeStatus: finalEvidence.status,
  chatHistoryMinHeightPx: finalEvidence.chatHistoryMinHeightPx,
  chatInputTopRatio: finalEvidence.chatInputTopRatio,
  chatViewportRatio: finalEvidence.chatViewportRatio,
  largeBlankPanelBetweenStatusAndComposer: finalEvidence.largeBlankPanelBetweenStatusAndComposer,
  composerBottomGapPx: finalEvidence.composerBottomGapPx,
  largeBlankPanelBelowComposer: finalEvidence.largeBlankPanelBelowComposer,
  chatHistoryOccupiesRemainingSpace: finalEvidence.chatHistoryOccupiesRemainingSpace,
  composerNotBottomAligned: finalEvidence.composerNotBottomAligned,
  conversationColumnVisible: finalEvidence.conversationColumnVisible,
  conversationColumnWidthPx: finalEvidence.conversationColumnWidthPx,
  assistantMessageMaxWidthRatio: finalEvidence.assistantMessageMaxWidthRatio,
  userMessageMaxWidthRatio: finalEvidence.userMessageMaxWidthRatio,
  messageBubbleStyleUnified: finalEvidence.messageBubbleStyleUnified,
  defaultWelcomeLooksLikeConversation: finalEvidence.defaultWelcomeLooksLikeConversation,
  composerBottomAligned: finalEvidence.composerBottomAligned,
  userMessageInsideConversationColumn: finalEvidence.userMessageInsideConversationColumn,
  assistantMessageInsideConversationColumn: finalEvidence.assistantMessageInsideConversationColumn,
  userMessageNotPinnedToViewportRight: finalEvidence.userMessageNotPinnedToViewportRight,
  dryRunNotShownAsProviderFailure: finalEvidence.dryRunNotShownAsProviderFailure,
  providerFailureOnlyWhenProviderCalled: finalEvidence.providerFailureOnlyWhenProviderCalled,
  chatLooksLikeConversation: finalEvidence.chatLooksLikeConversation,
  rightSidebarWidthPx: finalEvidence.rightSidebarWidthPx,
  checksTotal: checks.length,
  checksFailed: failedChecks.length,
}, null, 2));

process.exitCode = finalEvidence.verifierStatus === "pass" ? 0 : 1;

function readText(relativePath) {
  const absolute = resolve(repoRoot, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function renderEvidenceMarkdown(data) {
  return `# Phase318A Chat Main Area Normalization And Preview Feature Realization Verification

- Phase: ${data.phase}
- Verifier status: ${data.verifierStatus}
- Smoke status: ${data.status}
- Blocker: ${JSON.stringify(data.verifierBlocker)}
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
