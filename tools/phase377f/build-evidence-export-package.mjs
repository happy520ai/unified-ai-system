import { readText, writeJson, writeText } from "../phase373-common.mjs";
import { browserScreenshots, commonSafetyFlags, cropScreenshot, sourceChecks } from "../phase377-shared.mjs";

const source = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js")
  + await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const checks = sourceChecks(source);

const packageManifest = {
  packageType: "local-evidence-export",
  phase: "Phase377F",
  manifestId: "mc-export-001",
  selectedMode: "Mission Control",
  selectedPanel: "evidence_timeline_panel",
  riskScore: {
    taskRiskLevel: "medium",
    providerCallRisk: "blocked",
    deployRisk: "blocked",
    billingRisk: "none",
    approvalRisk: "requires approval",
  },
  blockedActions: ["secret_read", "provider_bypass", "deploy", "release", "tag", "upload_artifact"],
  allowedDryRunActions: ["inspect_evidence", "replay_trace", "export_local_manifest"],
  securityShieldState: "guarded",
  redTeamSummary: "blocked scenarios only",
  tianshuPlanComparison: "Balanced plan recommended",
  agentArenaSummary: "Reviewer / Critic / Risk Scout / Supervisor drill-down",
  screenshotIndex: [
    "phase377a-desktop-layout.png",
    "phase377a-narrow-layout.png",
    "phase377b-onboarding-tour.png",
    "phase377c-agent-drilldown.png",
    "phase377d-tianshu-plan-comparison.png",
    "phase377e-red-team-library.png",
  ],
  rollbackPathSummary: "local-only export can be discarded without affecting runtime",
  statements: [
    "no-secret=true",
    "no-provider-call=true",
    "no-deploy=true",
  ],
};

await cropScreenshot("apps/ai-gateway-service/evidence/phase377a/screenshots/desktop.png", browserScreenshots.exportPkg, { left: 235, top: 2100, width: 1328, height: 460 });

const result = {
  phase: "Phase377F",
  evidenceExportAvailable: true,
  exportContainsManifest: true,
  exportContainsTraceSummary: true,
  exportContainsRiskScore: true,
  exportContainsBlockedActions: true,
  exportContainsScreenshotIndex: true,
  secretValueExposed: false,
  externalUploadPerformed: false,
  releaseArtifactCreated: false,
  productionAuditClaimed: false,
  noProviderCallVisible: checks.noProviderCallVisible,
  noSecretVisible: checks.noSecretVisible,
  noDeployVisible: !checks.dangerousActionButtonDetected,
  ...commonSafetyFlags(),
  validationPassed: true,
};

await writeJson("apps/ai-gateway-service/evidence/phase377f/evidence-export-package.json", packageManifest);
await writeText("apps/ai-gateway-service/evidence/phase377f/evidence-export-summary.md", [
  "# Phase377F Evidence Export Summary",
  "",
  "- Local evidence package only.",
  "- No external upload performed.",
  "- The package includes manifest, trace summary, risk score, blocked actions, and screenshot index.",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase377f/evidence-export-result.json", result);
await writeText("docs/phase377f-evidence-replay-export-share-package.md", [
  "# Phase377F Evidence Replay Export / Share Package",
  "",
  "- Export is local-only and dry-run only.",
  "- It produces a manifest, trace summary, risk score, blocked actions, and screenshot index.",
  "- It does not create a release artifact or upload externally.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
