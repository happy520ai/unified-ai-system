export const internalEmployeeCommunicationCopy = Object.freeze({
  title: "Internal Employee Communication Bus",
  subtitle: "Virtual employees exchange structured dry-run messages, threads, mentions, handoffs, reviews, objections, and evidence.",
  boundaryBadges: [
    "Employee Threads",
    "Inbox / Outbox",
    "Mentions",
    "Handoff",
    "Review Requests",
    "Evidence Timeline",
    "no-provider-call",
    "no-secret",
    "no-external-IM-send",
  ],
  cards: [
    ["Unified Employee Message Protocol", "Internal message envelopes are the source of truth before any external IM adapter exists."],
    ["Thread / Room / Inbox / Outbox", "Threads keep task context; inbox and outbox route dry-run messages between active employees only."],
    ["Mention / Handoff / Review", "Mentions and handoffs are structured records with evidence, not free-form hidden side effects."],
    ["Scheduler Boundary", "The bus cannot expand participants by itself; new participants require Scheduler approval."],
  ],
  previews: {
    thread: "Thread created: Product Chief asks UX Researcher to review sample dry-run onboarding friction; reply created; evidence timeline recorded.",
    mention: "@AI Gateway Engineer routed for provider_routing_audit; schedulerApprovalRequiredForNewParticipants=true; maxBrainCalls=0.",
    handoff: "UX Researcher -> AI Gateway Engineer handoff recorded; accepted=true dry-run; reason preserved.",
    objection: "Security Chief objection: riskLevel=high; providerCallsMade=false; secretValueExposed=false.",
    summary: "Council summary created with final recommendation; no provider call; no external IM send.",
  },
});
