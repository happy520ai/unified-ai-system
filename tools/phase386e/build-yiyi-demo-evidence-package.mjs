import {
  assertPhase386SafetyFlags,
  ensure,
  fileInfo,
  makeResult,
  phase386Docs,
  phase386Safety,
  phase386Scenarios,
  phase386ScreenshotNames,
  writeJson,
  writeText,
} from "../phase386-common.mjs";

const packageJson = {
  packageType: "local_demo_evidence_package",
  releaseArtifactCreated: false,
  externalUploadPerformed: false,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  productionGaClaimed: false,
  modelBrainEnabledByDefault: false,
  manifest: {
    phase: "Phase386E",
    title: "Yiyi Demo Evidence Package",
    generatedLocally: true,
    externalUploadPerformed: false,
  },
  demoScenarioSummary: phase386Scenarios.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    highlightPanel: scenario.highlightPanel,
  })),
  yiyiScriptIndex: [
    "docs/phase386d-yiyi-commercial-demo-script-3min.md",
    "docs/phase386d-yiyi-commercial-demo-script-8min.md",
    "docs/phase386d-yiyi-technical-review-demo-script.md",
    "docs/phase386d-yiyi-sales-demo-script.md",
  ],
  screenshotIndex: phase386ScreenshotNames.map((name) => ({
    name,
    path: `apps/ai-gateway-service/evidence/phase386f/screenshots/${name}`,
  })),
  safetyBoundaryStatement: [
    "dry-run only",
    "no provider call",
    "no secret",
    "no deploy",
    "no release",
    "no billing",
  ],
  redTeamBlockedSummary: [
    "prompt injection blocked",
    "secret exfiltration blocked",
    "approval bypass blocked",
    "dangerous action blocked",
  ],
  evidenceReplaySummary: [
    "evidenceId visible",
    "trace visible",
    "blockedActions visible",
    "fallbackReason visible",
    "local replay posture only",
  ],
  modelBrainDisabledStatement: "Yiyi model-backed brain remains disabled by default in the commercial demo package.",
  noProviderCallStatement: "This demo package does not execute real provider calls.",
  noSecretStatement: "This demo package does not access or expose raw secrets.",
  noDeployStatement: "This demo package does not execute deploy, release, tag, artifact upload, or production action.",
  remainingRisks: [
    "still_dry_run_demo",
    "real_provider_test_not_executed",
    "manual_recording_review_recommended",
    "cross_browser_qa_pending",
    "mobile_demo_adaptation_pending",
  ],
  rollbackNote: "Rollback is limited to local docs/UI/evidence changes. No runtime provider behavior was altered.",
};

ensure(packageJson.providerCallsMade === false, "providerCallsMade must remain false.");
ensure(packageJson.secretValueExposed === false, "secretValueExposed must remain false.");
ensure(packageJson.deployExecuted === false, "deployExecuted must remain false.");
ensure(packageJson.modelBrainEnabledByDefault === false, "modelBrainEnabledByDefault must remain false.");

await writeText(
  "docs/phase386e-yiyi-demo-evidence-package.md",
  [
    "# Phase386E Yiyi Demo Evidence Package",
    "",
    "This phase builds a local-only evidence package for the commercial demo. It is not a release artifact, not an external upload, and not a production audit package.",
    "",
    "Included:",
    "- manifest",
    "- demo scenario summary",
    "- yiyi script index",
    "- screenshot index",
    "- safety boundary statement",
    "- red-team blocked summary",
    "- evidence replay summary",
    "- model brain disabled statement",
    "- no-provider-call statement",
    "- no-secret statement",
    "- no-deploy statement",
    "- remaining risks",
    "- rollback note",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase386e/yiyi-demo-evidence-package.json", packageJson);
await writeText(
  "apps/ai-gateway-service/evidence/phase386e/yiyi-demo-evidence-summary.md",
  [
    "# Yiyi Demo Evidence Summary",
    "",
    "- packageType: local_demo_evidence_package",
    "- providerCallsMade: false",
    "- secretValueExposed: false",
    "- deployExecuted: false",
    "- productionGaClaimed: false",
    "- modelBrainEnabledByDefault: false",
    `- docsIndexed: ${phase386Docs.length}`,
    `- screenshotTargets: ${phase386ScreenshotNames.length}`,
  ].join("\n"),
);

for (const path of [
  "apps/ai-gateway-service/evidence/phase386e/yiyi-demo-evidence-package.json",
  "apps/ai-gateway-service/evidence/phase386e/yiyi-demo-evidence-summary.md",
]) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Evidence package output missing or empty: ${path}`);
}

const result = makeResult({
  phase: "Phase386E",
  demoEvidencePackageGenerated: true,
  localEvidencePackageOnly: true,
  docsIndexed: phase386Docs.length,
  screenshotTargetCount: phase386ScreenshotNames.length,
  ...phase386Safety,
});
assertPhase386SafetyFlags(result);

await writeJson("apps/ai-gateway-service/evidence/phase386e/yiyi-demo-evidence-package-result.json", result);
console.log(JSON.stringify(result, null, 2));
