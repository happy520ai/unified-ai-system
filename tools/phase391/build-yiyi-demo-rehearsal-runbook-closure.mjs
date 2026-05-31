import {
  ensure,
  fileInfo,
  makePhase391Result,
  phase391Safety,
  writeJson,
  writeText,
} from "../phase391-common.mjs";

const requiredFiles = [
  "docs/phase391a-yiyi-demo-operator-checklist.json",
  "docs/phase391a-yiyi-demo-rehearsal-runbook.md",
  "apps/ai-gateway-service/evidence/phase391a/yiyi-demo-rehearsal-runbook-result.json",
];

for (const path of requiredFiles) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Missing Phase391 prerequisite: ${path}`);
}

const result = makePhase391Result({
  rehearsalRunbookCreated: true,
  operatorChecklistCreated: true,
  fallbackCardsCreated: true,
  providerRuntimeModified: false,
  chatGatewayExecuteModified: false,
  chatSendMainChainModified: false,
  ...phase391Safety,
});

await writeText(
  "docs/phase391-yiyi-demo-rehearsal-runbook-closure.md",
  [
    "# Phase391 Yiyi Commercial Demo Rehearsal Runbook + Operator Checklist Closure",
    "",
    "Phase391 adds a low-risk manual rehearsal layer on top of the sealed commercial demo package.",
    "",
    "Completed:",
    "- Operator checklist for guided rehearsal.",
    "- Rehearsal runbook sections for short and long demo paths.",
    "- Fallback cards for provider, secret, and deploy questions.",
    "",
    "Boundary:",
    "- No provider call.",
    "- No secret access.",
    "- No deploy/release/tag/artifact upload.",
    "- No billing/invoice.",
    "- No production GA claim.",
    "- No provider runtime, /chat-gateway/execute route, or Chat send main-chain modification.",
    "",
    "Next recommended phase: Phase392 Yiyi Demo FAQ Pack + Objection Handling Cards.",
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase391/yiyi-demo-rehearsal-runbook-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
