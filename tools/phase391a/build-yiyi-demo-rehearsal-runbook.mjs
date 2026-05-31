import {
  ensure,
  fileInfo,
  makePhase391Result,
  phase391RunbookSections,
  phase391Safety,
  writeJson,
  writeText,
} from "../phase391-common.mjs";

const phase390Closure = fileInfo("apps/ai-gateway-service/evidence/phase390/yiyi-commercial-demo-final-qa-sales-handoff-closure-result.json");
ensure(phase390Closure.exists && phase390Closure.sizeBytes > 20, "Phase390 closure is required before Phase391.");

const operatorChecklist = [
  "Open Mission Control and confirm Guided Showcase assets are available locally.",
  "Confirm Yiyi visuals, safety bar, and evidence screenshots are ready for rehearsal use.",
  "Do not claim production GA, real provider execution, billing, or deployment.",
  "If asked about real models, state that Phase384 authorization is required before any real provider test.",
  "If the UI lags or a panel is off-screen, switch to the prepared screenshot pack and continue the guided explanation.",
];

const fallbackCards = [
  {
    scenario: "audience_asks_for_real_provider_call",
    response: "Current session stays in dry-run commercial demo mode. Real provider testing is gated behind explicit Phase384 authorization.",
  },
  {
    scenario: "audience_asks_for_secret_or_api_key",
    response: "Secrets are intentionally not exposed. The demo is designed to prove safety boundaries, not bypass them.",
  },
  {
    scenario: "audience_asks_for_deploy_now",
    response: "This package is a local commercial demo and rehearsal pack. Deployment is outside this phase and not performed here.",
  },
];

await writeJson("docs/phase391a-yiyi-demo-operator-checklist.json", {
  phase: "Phase391A",
  title: "Yiyi Demo Operator Checklist",
  operatorChecklist,
  fallbackCards,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
});

await writeText(
  "docs/phase391a-yiyi-demo-rehearsal-runbook.md",
  [
    "# Phase391A Yiyi Demo Rehearsal Runbook",
    "",
    "This runbook turns the commercial demo package into a repeatable manual rehearsal flow.",
    "",
    ...phase391RunbookSections.map((section, index) => `## ${index + 1}. ${section}\n\n- Keep the flow concise.\n- Keep the safety language explicit.\n- Stay in dry-run demo mode.`),
  ].join("\n"),
);

const result = makePhase391Result({
  phase: "Phase391A",
  rehearsalRunbookCreated: true,
  operatorChecklistCreated: true,
  fallbackCardsCreated: true,
  sectionCount: phase391RunbookSections.length,
  operatorChecklistCount: operatorChecklist.length,
  ...phase391Safety,
});

await writeJson("apps/ai-gateway-service/evidence/phase391a/yiyi-demo-rehearsal-runbook-result.json", result);
console.log(JSON.stringify(result, null, 2));
