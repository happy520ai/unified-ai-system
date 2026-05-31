export function createSessionLedger({ sessionId } = {}) {
  const ledger = {
    sessionId: String(sessionId || `session-${Date.now()}`),
    timeline: [],
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    addEvent(event) {
      const entry = {
        index: this.timeline.length + 1,
        type: String(event.type || "event"),
        summary: String(event.summary || "").slice(0, 500),
        ref: String(event.ref || ""),
        generatedAt: event.generatedAt || new Date().toISOString(),
      };
      this.timeline.push(entry);
      return entry;
    },
  };
  return ledger;
}
