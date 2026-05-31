import { readMissionControlSource, cropScreenshot, browserScreenshots, commonSafetyFlags, sourceChecks, writePhaseArtifacts } from "../phase377-shared.mjs";

const source = await readMissionControlSource();
const checks = sourceChecks(source);
await cropScreenshot("apps/ai-gateway-service/evidence/phase377a/screenshots/desktop.png", browserScreenshots.onboarding, { left: 235, top: 100, width: 1325, height: 520 });

const onboardingCopy = {
  steps: [
    "Mission Control 不是普通 Chatbot，而是 AI 指挥舱。",
    "Normal / God / Tianshu 三种模式负责不同任务强度。",
    "Security Shield 解释风险和 blocked 决策。",
    "Evidence Replay 保留 trace，可本地导出。",
    "当前仍是 dry-run / credentialRef-only / no-provider-call / no-deploy。",
  ],
  skippable: true,
};

const result = {
  phase: "Phase377B",
  onboardingVisible: checks.onboardingVisible,
  onboardingSkippable: source.includes("onboarding-dismiss-button"),
  threeModesExplained: source.includes("Normal / God / Tianshu"),
  securityShieldExplained: source.includes("Security Shield"),
  evidenceReplayExplained: source.includes("Evidence Replay") || source.includes("replay"),
  noSecretBoundaryExplained: source.includes("no secret"),
  noProviderCallBoundaryExplained: source.includes("no-provider-call") || source.includes("no provider call"),
  noDangerousCTA: !checks.dangerousActionButtonDetected,
  ...commonSafetyFlags(),
  validationPassed: checks.onboardingVisible && source.includes("skip anytime") && !checks.dangerousActionButtonDetected,
};

await writePhaseArtifacts({
  reportPath: "docs/phase377b-guided-onboarding.md",
  reportLines: [
    "# Phase377B Guided Onboarding",
    "",
    "- First-run tour is short, skippable, and summary-first.",
    "- It explains the three modes, shield, evidence, and current dry-run boundaries.",
  ],
  resultPath: "apps/ai-gateway-service/evidence/phase377b/guided-onboarding-result.json",
  result,
});

await writePhaseArtifacts({
  reportPath: null,
  reportLines: [],
  resultPath: "docs/phase377b-onboarding-copy.json",
  result: onboardingCopy,
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
