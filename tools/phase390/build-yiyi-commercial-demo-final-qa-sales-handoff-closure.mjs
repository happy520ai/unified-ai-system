import {
  ensure,
  fileInfo,
  makePhase390Result,
  phase390Safety,
  writeJson,
  writeText,
} from "../phase390-common.mjs";

const requiredFiles = [
  "docs/phase390a-yiyi-commercial-demo-final-qa-index.json",
  "docs/phase390a-yiyi-sales-handoff-pack.md",
  "apps/ai-gateway-service/evidence/phase390a/yiyi-commercial-demo-final-qa-index-result.json",
];

for (const path of requiredFiles) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Missing Phase390 prerequisite: ${path}`);
}

const result = makePhase390Result({
  finalQaIndexCreated: true,
  salesHandoffPackCreated: true,
  lowRiskDemoChainClosed: true,
  phase384StillRequiresHumanApproval: true,
  providerRuntimeModified: false,
  chatGatewayExecuteModified: false,
  chatSendMainChainModified: false,
  ...phase390Safety,
});

await writeText(
  "docs/phase390-yiyi-commercial-demo-final-qa-sales-handoff-closure.md",
  [
    "# Phase390 Yiyi Commercial Demo Final QA Index + Sales Handoff Closure",
    "",
    "Phase390 closes the low-risk commercial demo packaging run with a final QA index and sales handoff pack.",
    "",
    "Completed:",
    "- Indexed Phase386 guided showcase assets.",
    "- Indexed Phase387 visual QA preparation.",
    "- Indexed Phase388 recording asset pack.",
    "- Indexed Phase389 mobile adaptation and presenter notes.",
    "- Restated safe sales language and prohibited claims.",
    "",
    "Boundary:",
    "- No provider call.",
    "- No secret access.",
    "- No deploy/release/tag/artifact upload.",
    "- No billing/invoice.",
    "- No production GA claim.",
    "- No provider runtime, /chat-gateway/execute route, or Chat send main-chain modification.",
    "",
    "Next route:",
    "- The remaining next recommended phase is Phase384.",
    "- Phase384 is high risk and must not auto-execute.",
    "- Real provider testing still requires specific provider/model/credential/request/cost authorization.",
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase390/yiyi-commercial-demo-final-qa-sales-handoff-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
