export function renderModelConfigRepairLoopEvidence(body) {
  return `# Phase 92A Web Chat Model Config Repair Loop Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Recovery mode: ${body.ui?.repairOpenState?.recoveryMode ?? "n/a"}
- Select value: ${body.ui?.repairOpenState?.selectValue ?? "n/a"}
- Provider hint: ${body.ui?.repairOpenState?.providerHint ?? "n/a"}
- Manual model ID: ${body.ui?.repairOpenState?.manualModelId ?? "n/a"}
- Base URL prefilled: ${body.ui?.repairOpenState?.baseUrl ? "yes" : "no"}
- Primary action: ${body.ui?.repairOpenState?.primaryButtonText ?? "n/a"}
- Probe after repair: ${body.ui?.repairedState?.modelProbeStatus ?? "n/a"}
- Recovery required after repair: ${body.ui?.repairedState?.modelRecoveryRequired ?? "n/a"}
- Fetches: ${(body.ui?.repairedState?.fetches ?? []).join(", ")}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Real provider calls: ${body.safety?.realProviderCalls}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}

export function renderComposerPolishEvidence(body) {
  return `# Phase 72A Web Chat Composer Polish Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Prompt: ${body.ui?.prompt ?? "n/a"}
- Initial send disabled: ${body.ui?.initial?.sendButtonDisabled}
- Shortcut hint includes Enter: ${body.ui?.initial?.shortcutHintIncludesEnter}
- Shortcut hint includes Shift: ${body.ui?.initial?.shortcutHintIncludesShift}
- Short input send disabled: ${body.ui?.afterShortInput?.sendButtonDisabled}
- Short input height: ${body.ui?.afterShortInput?.inputHeight ?? "n/a"}
- Multiline input height: ${body.ui?.afterMultiLineInput?.inputHeight ?? "n/a"}
- Shift+Enter RAG stream count: ${body.ui?.afterShiftEnter?.ragStreamCount ?? "n/a"}
- Accelerator send RAG stream count: ${body.ui?.ragStreamCount ?? "n/a"}
- After send input value length: ${body.ui?.afterAcceleratorSend?.inputValue?.length ?? "n/a"}
- After send active element: ${body.ui?.afterAcceleratorSend?.activeElementId ?? "n/a"}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser interaction: ${body.safety?.browserInteraction}
- Simulated stream only: ${body.safety?.simulatedStreamOnly}
- Composer behavior only: ${body.safety?.composerBehaviorOnly}
- Auto resize: ${body.safety?.autoResize}
- Empty send disabled: ${body.safety?.emptySendDisabled}
- Shortcut hint present: ${body.safety?.shortcutHintPresent}
- Shift+Enter does not send: ${body.safety?.shiftEnterDoesNotSend}
- Accelerator Enter sends: ${body.safety?.acceleratorEnterSends}
- Focus restored after send: ${body.safety?.focusRestoredAfterSend}
- Fake provider only: ${body.safety?.fakeProviderOnly}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Conclusion: ${body.conclusion}
`;
}

export function renderModelConfigReadyToChatEvidence(body) {
  return `# Phase 95A Web Chat Model Config Ready To Chat Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Provider select value: ${body.ui?.readyState?.providerSelectValue ?? "n/a"}
- Model probe status: ${body.ui?.readyState?.modelProbeStatus ?? "n/a"}
- Input focused: ${body.ui?.readyState?.focusReturnedToChatInput}
- Input placeholder: ${body.ui?.readyState?.inputPlaceholder ?? "n/a"}
- Composer guidance kind: ${body.ui?.readyState?.composerGuidanceKind ?? "n/a"}
- Session status: ${body.ui?.readyState?.sessionStatusText ?? "n/a"}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Real provider calls: ${body.safety?.realProviderCalls}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}
