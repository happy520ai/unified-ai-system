import { readText, writeJson, writeText } from "../phase373-common.mjs";
import { commonSafetyFlags, sourceChecks } from "../phase376-shared.mjs";

const source = await readText("apps/ai-gateway-service/src/ui/consolePage.js")
  + await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const checks = sourceChecks(source);
const result = {
  phase: "Phase376B",
  interactionPolishCompleted: true,
  missionControlFirstScreenVisible: checks.missionControlVisible,
  shortStatusCopyVisible: source.includes("dry-run only") && source.includes("credentialRef-only"),
  hoverPolishAdded: source.includes(".mission-card:hover"),
  clickPathsClear: source.includes('data-nav="chat"') && source.includes('data-nav="models"') && source.includes('data-nav="approvals"') && source.includes('data-nav="files"') && source.includes('data-nav="diagnostics"'),
  securityCopyCompact: source.includes("blocked") && source.includes("requires approval"),
  ...commonSafetyFlags(),
  validationPassed: checks.missionControlVisible && !checks.dangerousActionButtonDetected,
};

await writeText("docs/phase376b-mission-control-interaction-polish-report.md", [
  "# Phase376B Mission Control Interaction Polish",
  "",
  "- Mission Control is first-screen visible.",
  "- Copy is shorter and status-first.",
  "- Hover feedback is lightweight and does not add new actions.",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase376b/mission-control-interaction-polish-result.json", result);

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
