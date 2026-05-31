export function exportTianshuReviewerAuditTrail(events = []) {
  const payload = {
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    events: events.map((event) => ({
      eventId: event.eventId,
      proposalId: event.proposalId,
      action: event.action,
      reviewerIdRef: event.reviewerIdRef,
      secretValueExposed: false,
    })),
  };
  return {
    json: JSON.stringify(payload, null, 2),
    markdown: renderMarkdown(payload),
  };
}

function renderMarkdown(payload) {
  return [
    "# Tianshu Reviewer Audit Trail",
    "",
    `- exportedAt: ${payload.exportedAt}`,
    `- eventCount: ${payload.eventCount}`,
    "",
  ].join("\n");
}
