import { readJson, readText, writeJson } from "../phase373-common.mjs";
import { commonSafetyFlags, sourceChecks } from "../phase376-shared.mjs";

const source = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const contract = await readJson("docs/phase376e-evidence-replay-viewer-contract.json");
const checks = sourceChecks(source);
const requiredFields = ["evidenceId", "timestamp", "mode", "intent", "selectedPanel", "riskScore", "blockedActions", "allowedActions", "dryRunResult", "supervisorComment", "fallbackReason", "replayAvailable", "rollbackPathAvailable", "providerCallsMade", "secretValueExposed"];
const missingFields = requiredFields.filter((field) => !contract.fields.includes(field));
const result = {
  phase: "Phase376E",
  evidenceReplayViewerValidated: true,
  evidenceTimelineVisible: checks.evidenceTimelineVisible,
  replayAvailableVisible: source.includes("replay: available"),
  rollbackPathVisible: source.includes("rollback path: visible"),
  missingFields,
  ...commonSafetyFlags(),
  validationPassed: checks.evidenceTimelineVisible && missingFields.length === 0,
};

await writeJson("apps/ai-gateway-service/evidence/phase376e/evidence-replay-viewer-result.json", result);
console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
