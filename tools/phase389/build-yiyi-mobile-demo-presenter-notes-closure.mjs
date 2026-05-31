import {
  ensure,
  fileInfo,
  makePhase389Result,
  phase389Safety,
  writeJson,
  writeText,
} from "../phase389-common.mjs";

const requiredFiles = [
  "docs/phase389a-yiyi-mobile-demo-review-checklist.json",
  "docs/phase389a-yiyi-mobile-demo-adaptation.md",
  "docs/phase389a-yiyi-presenter-notes.md",
  "apps/ai-gateway-service/evidence/phase389a/yiyi-mobile-demo-presenter-notes-result.json",
];

for (const path of requiredFiles) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Missing Phase389 prerequisite: ${path}`);
}

const result = makePhase389Result({
  mobileDemoAdaptationCreated: true,
  presenterNotesCreated: true,
  mobileReviewChecklistCreated: true,
  manualMobileBrowserReviewRequired: true,
  providerRuntimeModified: false,
  chatGatewayExecuteModified: false,
  chatSendMainChainModified: false,
  ...phase389Safety,
});

await writeText(
  "docs/phase389-yiyi-mobile-demo-adaptation-presenter-notes-closure.md",
  [
    "# Phase389 Yiyi Mobile Demo Adaptation + Presenter Notes Closure",
    "",
    "Phase389 completes a low-risk mobile demo adaptation and presenter notes pack for the Yiyi guided commercial showcase.",
    "",
    "Completed:",
    "- Mobile and tablet manual review checklist.",
    "- Presenter notes for opening, three modes, security shield, red team, evidence replay, brain status, and closing.",
    "- Safety wording for local dry-run demo use.",
    "",
    "Boundary:",
    "- No provider call.",
    "- No secret access.",
    "- No deploy/release/tag/artifact upload.",
    "- No billing/invoice.",
    "- No production GA claim.",
    "- No provider runtime, /chat-gateway/execute route, or Chat send main-chain modification.",
    "",
    "Next recommended phase: Phase390 Yiyi Commercial Demo Final QA Index + Sales Handoff Pack.",
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase389/yiyi-mobile-demo-adaptation-presenter-notes-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
