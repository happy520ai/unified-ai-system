import {
  assertNoDangerousDemoCopy,
  assertPhase386SafetyFlags,
  ensure,
  makeResult,
  phase386Contract,
  phase386Safety,
  readText,
  writeJson,
  writeText,
} from "../phase386-common.mjs";

const component = await readText("apps/ai-gateway-service/src/ui/components/YiyiGuidedShowcasePanel.js");
const missionControl = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const consolePage = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const source = `${component}\n${missionControl}\n${consolePage}`;

assertNoDangerousDemoCopy(source);

const requiredMarkers = [
  "id=\"yiyi-guided-showcase-panel\"",
  "data-yiyi-guided-showcase=\"true\"",
  "id=\"guided-showcase-stepper\"",
  "id=\"demo-safety-bar\"",
  "Start Guided Showcase / 进入依依演示",
  "dry-run only",
  "model brain disabled by default",
  "no provider call",
  "no secret",
  "no deploy",
  "evidence recorded",
  "closing_summary",
];
for (const marker of requiredMarkers) {
  ensure(source.includes(marker), `Missing guided showcase UI marker: ${marker}`);
}

for (const step of phase386Contract.showcaseSteps) {
  ensure(source.includes(`data-yiyi-showcase-step="${step}"`) || source.includes(`${step}: {`), `Missing UI step: ${step}`);
  ensure(source.includes(`data-showcase-scene="${step}"`) || source.includes(`${step}: {`), `Missing scene marker: ${step}`);
}

const result = makeResult({
  phase: "Phase386B",
  guidedShowcaseCreated: true,
  guidedShowcaseVisible: true,
  guidedShowcaseStepperVisible: true,
  demoSafetyBarVisible: true,
  closingSummaryVisible: true,
  forbiddenDemoActionCopyDetected: false,
  ...phase386Safety,
});
assertPhase386SafetyFlags(result);

await writeText(
  "docs/phase386b-yiyi-guided-showcase-ui-flow.md",
  [
    "# Phase386B Yiyi Guided Showcase UI Flow",
    "",
    "Guided Showcase is embedded in Mission Control as a local demo flow.",
    "",
    "UI flow:",
    "- Start Guided Showcase / 进入依依演示 starts the local stepper.",
    "- Ten steps cover welcome, overview, Normal, God, Tianshu, Security Shield, Red Team, Evidence Replay, Yiyi Brain status, and closing summary.",
    "- Back / Next / Skip are local UI controls only.",
    "- Demo Safety Bar keeps dry-run, model brain disabled, no provider call, no secret, no deploy, and evidence recorded visible.",
    "",
    "Boundary:",
    "- No provider runtime is called.",
    "- No chat send route is changed.",
    "- No deploy, release, billing, invoice, artifact, or tag action is exposed.",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase386b/yiyi-guided-showcase-ui-result.json", result);

console.log(JSON.stringify(result, null, 2));
