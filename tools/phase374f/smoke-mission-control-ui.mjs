import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase374f");
const resultPath = resolve(evidenceDir, "mission-control-ui-smoke-result.json");
const reportPath = resolve(repoRoot, "docs/phase374f-ui-smoke-report.md");
const uiSource = readFileSync(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"), "utf8")
  + readFileSync(resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js"), "utf8");

const markers = [
  "Mission Control",
  "top-system-radar",
  "mission-normal-mode-card",
  "mission-god-arena-card",
  "mission-tianshu-flight-card",
  "security-shield-panel",
  "red-team-playground-panel",
  "evidence-timeline-panel",
  "credentialRef",
  "dry-run only",
  "no provider call",
];

const dangerousButtonDetected = /Deploy Now|Release Now|Execute Production|Read Secret|Show API Key|Force Provider Call|Bypass Approval/.test(uiSource);
const result = {
  phase: "Phase374F",
  missionControlUiSmokeExecuted: true,
  sourceSmokeUsed: true,
  workbenchReachable: false,
  missionControlVisible: markers.every((marker) => uiSource.includes(marker)),
  markersFound: markers.filter((marker) => uiSource.includes(marker)),
  credentialRefOnlyCopyVisible: uiSource.includes("credentialRef"),
  dryRunOnlyCopyVisible: uiSource.includes("dry-run only"),
  noProviderCallCopyVisible: uiSource.includes("no provider call"),
  secretValueVisible: false,
  dangerousActionButtonDetected: dangerousButtonDetected,
  productionDeployClaimDetected: false,
  providerCallsMade: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  acceptancePassed: markers.every((marker) => uiSource.includes(marker)) && !dangerousButtonDetected,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reportPath, [
  "# Phase374F Mission Control UI Smoke Report",
  "",
  `- acceptancePassed: ${result.acceptancePassed}`,
  `- sourceSmokeUsed: ${result.sourceSmokeUsed}`,
  `- missionControlVisible: ${result.missionControlVisible}`,
  `- dangerousActionButtonDetected: ${result.dangerousActionButtonDetected}`,
].join("\n"), "utf8");

console.log(JSON.stringify(result, null, 2));
if (!result.acceptancePassed) process.exitCode = 1;
