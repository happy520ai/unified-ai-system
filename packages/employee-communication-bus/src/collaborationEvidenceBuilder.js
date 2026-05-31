export function buildInternalCollaborationEvidence({ scenarioId, thread, messages = [], handoff = null, rejectedEmployees = [] } = {}) {
  return {
    evidenceId: `evidence.phase587.${scenarioId || "internal-communication"}`,
    phase: "Phase587",
    threadId: thread?.threadId || null,
    messageIds: messages.map((message) => message.messageId),
    handoffId: handoff?.handoffId || null,
    rejectedEmployees,
    timeline: [
      "scheduler_selected_active_employees",
      "internal_thread_created",
      "internal_messages_routed",
      handoff ? "handoff_recorded" : "handoff_not_required",
      "dry_run_evidence_recorded",
    ],
    credentialRefOnly: true,
    externalImConnectorUsed: false,
    realFeishuMessageSent: false,
    realWeComMessageSent: false,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    dryRunOnly: true,
  };
}
