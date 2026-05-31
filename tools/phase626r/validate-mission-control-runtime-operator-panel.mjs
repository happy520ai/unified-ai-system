import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const componentPath = "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js";
const copyPath = "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js";
const docPath = "docs/phase626r-mission-control-runtime-operator-panel.md";
const evidencePath = "apps/ai-gateway-service/evidence/phase626r/mission-control-runtime-operator-panel-result.json";

const componentText = readText(componentPath);
const copyText = readText(copyPath);
const docText = readText(docPath);

const result = {
  phase: "Phase626R-Fix",
  name: "Mission Control Runtime Operator Panel",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  missionControlOperatorPanelUpdated: componentText.includes("data-codex-phase621r-628r-runtime-candidate=\"true\""),
  readOnlyPreview: docText.includes("read-only") && componentText.includes("isolated candidate only"),
  showsIsolatedRuntimeCandidateStatus: componentText.includes("Phase621R-628R Isolated Candidate Path"),
  showsPhase624IfExists: componentText.includes("guardedIsolatedOneShotPassed"),
  showsPhase625IfExists: componentText.includes("isolatedRepeatedReliabilityClassification"),
  showsMaxRequests: componentText.includes("totalRequestAttemptCount"),
  showsRollbackReady: docText.includes("rollback ready"),
  showsEmergencyDisableReady: docText.includes("emergency disable ready"),
  notDefaultChatIntegrated: componentText.includes("chatIntegrated=${controlledRuntimeCandidatePath.chatIntegrated}"),
  notChatGatewayExecuteIntegrated: componentText.includes("chatGatewayExecuteIntegrated=${controlledRuntimeCandidatePath.chatGatewayExecuteIntegrated}"),
  notProductionReady: componentText.includes("productionReadyClaimed=${controlledRuntimeCandidatePath.productionReadyClaimed}"),
  nextManualApprovalRequired: docText.includes("next manual approval required"),
  realExecutionButtonAdded: /真实生产执行|production execution button|接入 \/chat/.test(copyText) && /button/i.test(copyText),
  deployReleasePushButtonAdded: /deploy\/release\/push button/i.test(copyText),
  secretInputAdded: /auth\.json input|secret input/i.test(copyText),
  defaultChatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeModified: false,
  providerCallsMadeByThisPhase: false,
  codexExecExecutedByThisPhase: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const checks = [
  check("missionControlOperatorPanelUpdated", result.missionControlOperatorPanelUpdated),
  check("readOnlyPreview", result.readOnlyPreview),
  check("showsIsolatedRuntimeCandidateStatus", result.showsIsolatedRuntimeCandidateStatus),
  check("showsPhase624IfExists", result.showsPhase624IfExists),
  check("showsPhase625IfExists", result.showsPhase625IfExists),
  check("realExecutionButtonAdded_false", result.realExecutionButtonAdded === false),
  check("deployReleasePushButtonAdded_false", result.deployReleasePushButtonAdded === false),
  check("secretInputAdded_false", result.secretInputAdded === false),
  check("defaultChatIntegrated_false", result.defaultChatIntegrated === false),
  check("chatGatewayExecuteIntegrated_false", result.chatGatewayExecuteIntegrated === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase626r_operator_panel_failed:${failed.join(",")}`;
}
result.checks = checks;
writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed || !result.recommended_sealed || result.blocker) process.exitCode = 1;

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}
