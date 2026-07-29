export function stripScriptsAndStyles(source) {
  return String(source)
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
}

export function stripTags(source) {
  return String(source ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsSecretLikeValue(source) {
  const secretShape = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i;
  return secretShape.test(String(source ?? ""));
}

export function safePrettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function renderUiClickabilityEvidenceMarkdown(data) {
  return `# Phase316A Actual UI Clickability Repair & Acceptance

- Phase: ${data.phase}
- Status: ${data.status}
- Blocker: ${JSON.stringify(data.blocker)}
- Real browser used: ${data.realBrowserUsed}
- Programmatic click used: ${data.programmaticClickUsed}
- Total buttons scanned: ${data.totalButtonsScanned}
- Total buttons clicked: ${data.totalButtonsClicked}
- Dead buttons found: ${data.deadButtonsFound}
- Disabled without reason: ${data.disabledButtonsWithoutReason}
- Pages tested: ${data.pagesTested}
- Empty pages found: ${data.emptyPagesFound}
- Page switch pass: ${data.pageSwitchPassCount} / fail: ${data.pageSwitchFailCount}
- Model dropdown verified: ${data.modelDropdownVerified}
- Chat send chain verified: ${data.chatSendChainVerified}
- Unsafe secret blocked: ${data.unsafeSecretUiBlocked}
- Unsafe release blocked: ${data.unsafeReleaseUiBlocked}
- Unsupported non-chat blocked: ${data.unsupportedNonChatUiBlocked}
- Key plaintext visible: ${data.keyPlaintextVisible}
- Secret exposed: ${data.secretExposed}
- Default /chat changed: ${data.defaultChatChanged}
- Business source modified: ${data.businessSourceModified}
- Workspace clean claimed: ${data.workspaceCleanClaimed}
`;
}
