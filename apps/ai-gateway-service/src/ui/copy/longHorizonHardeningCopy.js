export const longHorizonHardeningCopy = Object.freeze({
  title: "Long-Horizon Hardening Preview",
  subtitle:
    "Scenario matrix, load governance, debug trace, safety gates, adapter readiness, soak, architecture lock, and operator acceptance stay dry-run and provider-free.",
  boundaryBadges: [
    "scenario-matrix",
    "load-pressure",
    "trace-debug",
    "security-gates",
    "adapter-readiness",
    "observability",
    "soak-chaos",
    "test-expansion",
    "no-provider-call",
    "no-external-send",
  ],
  cards: [
    ["Scenario Matrix", "Simple, role-pack, complex, high-risk, urgent, background, employee, conflict, and invalid-input previews."],
    ["Load Governance", "100/500/1000 input dry-run simulations, lane capacity, backpressure, and no full broadcast under pressure."],
    ["Debug Trace", "TraceRef, evidence query, failure taxonomy, maintenance ledger, snapshots, and rollback runbooks."],
    ["Security Gates", "Provider, credentialRef, webhook, external IM, deploy, billing, invoice, chat route, and scheduler bypass gates."],
    ["Adapter Readiness", "Feishu, WeCom, Web, and API adapters remain contract previews with no raw webhook read and no real send."],
    ["Operator UX", "Mission Control viewers expose unified input/output, employee threads, lanes, merger, safety, load, trace, and runbooks."],
  ],
  previews: {
    scenario:
      "Scenario matrix preview: simple/standard/complex/high-risk/urgent/background/employee/conflict/invalid/duplicate/fallback cases all carry traceRef, laneId, and evidenceId.",
    load:
      "Load preview: accepted/deferred/rejected pressure states are visible, high priority is protected, background flood cannot block foreground, no full broadcast is allowed.",
    trace:
      "Trace preview: inputId, threadId, laneId, evidenceId, outputId, failure classification, and rollback location are linked for debugging.",
    safety:
      "Safety preview: provider, raw secret, webhook, external IM, deploy, release, tag, artifact, billing, invoice, /chat, and /chat-gateway/execute actions are blocked.",
    adapter:
      "Adapter preview: Feishu, WeCom, Web, and API input/output plans use credentialRef and idempotency mapping; realFeishuMessageSent=false and realWeComMessageSent=false.",
    soak:
      "Soak preview: random input, lane failure, employee unavailable, output failure, conflict injection, safety block, evidence loop, trace loop, and drift guards remain dry-run.",
  },
});
