import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  boundary,
  buildProductionOpsPanelEvidence,
  collectBlocker,
  evidencePath,
  finalEvidencePath,
  loadProductionReadinessBaseline,
  repoRoot,
  tokenSavingEvidence,
  writeExecutionReport,
  writeJson,
  writePhaseDoc,
} from "./phase701_720_common.mjs";

const baseline = await loadProductionReadinessBaseline();
const deployAuthorization = await readEvidence("deploy-authorization-packet-result.json");
const environment = await readEvidence("environment-isolation-readiness-result.json");
const runtime = await readEvidence("runtime-config-freeze-result.json");
const canary = await readEvidence("canary-plan-finalization-result.json");
const rollback = await readEvidence("rollback-command-pack-result.json");
const emergency = await readEvidence("emergency-disable-drill-result.json");
const monitoring = await readEvidence("monitoring-config-pack-result.json");
const alerting = await readEvidence("alerting-config-pack-result.json");
const slo = await readEvidence("slo-sli-error-budget-result.json");
const cost = await readEvidence("cost-quota-guard-result.json");
const incident = await readEvidence("incident-operator-handbook-result.json");
const support = await readEvidence("support-troubleshooting-guide-result.json");
const compliance = await readEvidence("compliance-final-review-result.json");
const security = await readEvidence("security-final-review-result.json");
const route = await readEvidence("route-default-disabled-regression-result.json");
const deployCommand = await readEvidence("dry-run-deploy-command-boundary-result.json");
const goNoGo = await readEvidence("go-no-go-packet-result.json");
const postDeploy = await readEvidence("post-deploy-checklist-prepared-result.json");
const panelSource = await readText("apps/ai-gateway-service/src/ui/components/TaijiBeidouProductionOpsPanel.js");
const missionControl = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const panelAvailable =
  panelSource.includes('data-taiji-production-ops-panel="true"') &&
  missionControl.includes("renderTaijiBeidouProductionOpsPanel") &&
  !/立即部署|开启生产流量|上传 artifact|release now|tag now|deploy now/i.test(panelSource);

const panelEvidence = buildProductionOpsPanelEvidence(panelAvailable);
await writeJson(evidencePath("production-ops-panel-result.json"), panelEvidence);
await writePhaseDoc(718, "Mission Control Production Ops Panel", panelEvidence, [
  "## Mission Control Panel",
  "",
  "- The panel is read-only and shows deployment deferred, Go/No-Go pending, rollback, monitoring, alerting, and post-deploy checklist status.",
  "- It does not expose deployment, release, tag, artifact upload, or production traffic controls.",
]);

const checks = {
  phase683700Passed: baseline.passed,
  deployAuthorizationPacketReady: deployAuthorization.deployAuthorizationPacketReady === true,
  environmentIsolationReady: environment.environmentIsolationReady === true,
  runtimeConfigFrozen: runtime.runtimeConfigFrozen === true,
  canaryPlanReady: canary.canaryPlanReady === true,
  rollbackCommandPackReady: rollback.rollbackCommandPackReady === true,
  emergencyDisableDryRunPassed: emergency.emergencyDisableDryRunPassed === true,
  monitoringConfigReady: monitoring.monitoringConfigReady === true,
  alertingConfigReady: alerting.alertingConfigReady === true,
  sloSliErrorBudgetReady: slo.sloSliErrorBudgetReady === true,
  costQuotaGuardReady: cost.costQuotaGuardReady === true,
  incidentRunbookReady: incident.incidentRunbookReady === true,
  operatorHandbookReady: incident.operatorHandbookReady === true,
  supportTroubleshootingGuideReady: support.supportTroubleshootingGuideReady === true,
  complianceFinalReviewPassed: compliance.complianceFinalReviewPassed === true,
  securityFinalReviewPassed: security.securityFinalReviewPassed === true,
  routeDefaultDisabledRegressionPassed: route.routeDefaultDisabledRegressionPassed === true,
  dryRunDeployCommandBoundaryReady: deployCommand.dryRunDeployCommandBoundaryReady === true,
  deployCommandNotExecuted: deployCommand.deployCommandExecuted === false,
  goNoGoPacketReady: goNoGo.goNoGoPacketReady === true,
  goDecisionPending: goNoGo.goDecision === "pending",
  meetingNotHeld: goNoGo.meetingHeld === false,
  productionOpsPanelReady: panelEvidence.productionOpsPanelReady === true,
  postDeployChecklistPrepared: postDeploy.postDeployChecklistPrepared === true,
  postDeploySmokeNotExecuted: postDeploy.postDeploySmokeExecuted === false,
  productionTrafficNotObserved: postDeploy.productionTrafficObserved === false,
};
const blocker = collectBlocker(checks);
const passed = blocker === null;

const finalEvidence = boundary({
  phase: "Phase701-720-AIO",
  completed: passed,
  recommended_sealed: passed,
  blocker,
  ...tokenSavingEvidence,
  productionReady: baseline.phase683.productionReady === true,
  productionDeployExecuted: false,
  deployDeferred: true,
  deployAuthorized: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  mainChainRuntimeReady: baseline.phase683.mainChainRuntimeReady === true,
  chatIntegrated: baseline.phase683.chatIntegrated === true,
  chatGatewayExecuteIntegrated: baseline.phase683.chatGatewayExecuteIntegrated === true,
  mainChainDefaultEnabled: false,
  chatDefaultEnabled: false,
  chatGatewayExecuteDefaultEnabled: false,
  providerRuntimeDefaultEnabled: false,
  deployAuthorizationPacketReady: deployAuthorization.deployAuthorizationPacketReady === true,
  environmentIsolationReady: environment.environmentIsolationReady === true,
  runtimeConfigFrozen: runtime.runtimeConfigFrozen === true,
  canaryPlanReady: canary.canaryPlanReady === true,
  rollbackCommandPackReady: rollback.rollbackCommandPackReady === true,
  emergencyDisableDryRunPassed: emergency.emergencyDisableDryRunPassed === true,
  monitoringConfigReady: monitoring.monitoringConfigReady === true,
  alertingConfigReady: alerting.alertingConfigReady === true,
  sloSliErrorBudgetReady: slo.sloSliErrorBudgetReady === true,
  costQuotaGuardReady: cost.costQuotaGuardReady === true,
  incidentRunbookReady: incident.incidentRunbookReady === true,
  operatorHandbookReady: incident.operatorHandbookReady === true,
  supportTroubleshootingGuideReady: support.supportTroubleshootingGuideReady === true,
  complianceFinalReviewPassed: compliance.complianceFinalReviewPassed === true,
  securityFinalReviewPassed: security.securityFinalReviewPassed === true,
  routeDefaultDisabledRegressionPassed: route.routeDefaultDisabledRegressionPassed === true,
  dryRunDeployCommandBoundaryReady: deployCommand.dryRunDeployCommandBoundaryReady === true,
  goNoGoPacketReady: goNoGo.goNoGoPacketReady === true,
  goDecision: "pending",
  meetingHeld: false,
  productionOpsPanelReady: panelEvidence.productionOpsPanelReady === true,
  postDeployChecklistPrepared: postDeploy.postDeployChecklistPrepared === true,
  postDeploySmokeExecuted: false,
  productionTrafficObserved: false,
  checks,
});

await writeJson(finalEvidencePath, finalEvidence);
await writePhaseDoc(720, "No-deploy Production Operation Readiness Final Seal", finalEvidence, [
  "## Final Seal",
  "",
  "- All non-deploy production operation readiness packs are prepared.",
  "- Deployment is explicitly deferred and unauthorized.",
  "- Post-deploy smoke is prepared but not executed.",
  "- No production traffic is observed or claimed.",
]);
await writeExecutionReport(finalEvidence);

console.log(JSON.stringify(finalEvidence, null, 2));
if (!passed) process.exitCode = 1;

async function readEvidence(fileName) {
  return JSON.parse(await readText(evidencePath(fileName)));
}

async function readText(path) {
  return String(await readFile(resolve(repoRoot, path), "utf8"));
}
