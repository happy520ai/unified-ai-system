// Helper utilities for smokePhase318AChatAndFeatureRealization.js
// Extracted to keep the main smoke file under 500 lines (Anti-Entropy Layering Law).

export function countFeatureStatuses(source) {
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

export function auditButtons(source) {
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

export function summarizeEvidence(data) {
  return {
    evidenceId: data?.evidenceId ?? null,
    intent: data?.intent ?? null,
    routeDecision: data?.routeDecision ?? null,
    safetyDecision: data?.safetyDecision ?? null,
    providerCalled: data?.providerCalled ?? null,
    completionVerified: data?.completionVerified ?? null,
  };
}

export function summarizeFlat(data) {
  return JSON.parse(JSON.stringify(data ?? null, (_key, value) => {
    if (typeof value === "string" && value.length > 180) return `${value.slice(0, 180)}...`;
    return value;
  }));
}

export async function closeServer(server) {
  await new Promise((resolvePromise) => {
    server.close(() => resolvePromise());
  });
}

export function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

export function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function renderEvidenceMarkdown(data) {
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
