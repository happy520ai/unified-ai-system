import {
  ensure,
  fileInfo,
  makePhase393Result,
  phase393Safety,
  writeJson,
  writeText,
} from "../phase393-common.mjs";

const requiredFiles = [
  "docs/phase393a-yiyi-demo-terminology-lock.json",
  "docs/phase393a-yiyi-demo-localization-copy-qa.md",
  "apps/ai-gateway-service/evidence/phase393a/yiyi-demo-localization-copy-qa-result.json",
];

for (const path of requiredFiles) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Missing Phase393 prerequisite: ${path}`);
}

const result = makePhase393Result({
  localizationCopyQaCreated: true,
  terminologyLockCreated: true,
  providerRuntimeModified: false,
  chatGatewayExecuteModified: false,
  chatSendMainChainModified: false,
  phase384StillRequiresHumanApproval: true,
  ...phase393Safety,
});

await writeText(
  "docs/phase393-yiyi-demo-localization-copy-qa-closure.md",
  [
    "# Phase393 Yiyi Demo Localization Copy QA + Terminology Lock Closure",
    "",
    "Phase393 adds a low-risk terminology lock and copy QA layer for the Yiyi commercial demo package.",
    "",
    "Completed:",
    "- Locked bilingual terminology for Yiyi, Mission Control, Guided Showcase, dry-run, and Evidence Replay.",
    "- Listed forbidden claims around production GA, real provider execution, API key display, deployment, billing, and workspace cleanliness.",
    "- Restated safe commercial demo wording.",
    "",
    "Boundary:",
    "- No provider call.",
    "- No secret access.",
    "- No deploy/release/tag/artifact upload.",
    "- No billing/invoice.",
    "- No production GA claim.",
    "- No provider runtime, /chat-gateway/execute route, or Chat send main-chain modification.",
    "",
    "Next recommended phase: Phase394 Yiyi Demo Stakeholder Review Packet + Signoff Checklist.",
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase393/yiyi-demo-localization-copy-qa-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
