import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const finalEvidencePath = "apps/ai-gateway-service/evidence/phase701_720/no-deploy-production-ops-final-result.json";

const requiredToolFiles = [
  "tools/phase701_720/run-deploy-authorization-packet.mjs",
  "tools/phase701_720/run-environment-isolation-readiness.mjs",
  "tools/phase701_720/run-runtime-config-freeze.mjs",
  "tools/phase701_720/run-canary-plan-finalization.mjs",
  "tools/phase701_720/run-rollback-command-pack.mjs",
  "tools/phase701_720/run-emergency-disable-drill.mjs",
  "tools/phase701_720/run-monitoring-config-pack.mjs",
  "tools/phase701_720/run-alerting-config-pack.mjs",
  "tools/phase701_720/run-slo-sli-error-budget-pack.mjs",
  "tools/phase701_720/run-cost-quota-guard-finalization.mjs",
  "tools/phase701_720/run-incident-operator-handbook.mjs",
  "tools/phase701_720/run-support-troubleshooting-guide.mjs",
  "tools/phase701_720/run-compliance-final-review.mjs",
  "tools/phase701_720/run-security-final-review.mjs",
  "tools/phase701_720/run-route-default-disabled-regression.mjs",
  "tools/phase701_720/run-dry-run-deploy-command-boundary.mjs",
  "tools/phase701_720/run-go-no-go-packet.mjs",
  "tools/phase701_720/run-post-deploy-checklist-prepared.mjs",
  "tools/phase701_720/run-no-deploy-production-ops-final-seal.mjs",
  "tools/phase701_720/validate-no-deploy-production-ops-readiness.mjs",
];

const requiredGatewayUiFiles = [
  "apps/ai-gateway-service/src/gateway/taijiBeidouProductionOpsReadiness.js",
  "apps/ai-gateway-service/src/ui/components/TaijiBeidouProductionOpsPanel.js",
  "apps/ai-gateway-service/src/ui/copy/taijiBeidouProductionOpsCopy.js",
];

const requiredDocs = [
  "docs/phase701-deploy-authorization-packet.md",
  "docs/phase702-environment-isolation-readiness.md",
  "docs/phase703-runtime-config-freeze.md",
  "docs/phase704-canary-plan-finalization.md",
  "docs/phase705-rollback-window-command-pack.md",
  "docs/phase706-emergency-disable-kill-switch-drill.md",
  "docs/phase707-monitoring-config-pack.md",
  "docs/phase708-alerting-config-pack.md",
  "docs/phase709-slo-sli-error-budget-pack.md",
  "docs/phase710-cost-cap-quota-guard-finalization.md",
  "docs/phase711-incident-runbook-operator-handbook.md",
  "docs/phase712-support-troubleshooting-guide.md",
  "docs/phase713-compliance-final-review.md",
  "docs/phase714-security-final-review.md",
  "docs/phase715-route-default-disabled-regression.md",
  "docs/phase716-dry-run-deploy-command-boundary.md",
  "docs/phase717-go-no-go-packet.md",
  "docs/phase718-mission-control-production-ops-panel.md",
  "docs/phase719-post-deploy-checklist-prepared-not-executed.md",
  "docs/phase720-no-deploy-production-operation-readiness-final-seal.md",
  "docs/phase701-720-no-deploy-production-ops-execution-report.md",
];

const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase701_720/deploy-authorization-packet-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/environment-isolation-readiness-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/runtime-config-freeze-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/canary-plan-finalization-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/rollback-command-pack-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/emergency-disable-drill-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/monitoring-config-pack-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/alerting-config-pack-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/slo-sli-error-budget-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/cost-quota-guard-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/incident-operator-handbook-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/support-troubleshooting-guide-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/compliance-final-review-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/security-final-review-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/route-default-disabled-regression-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/dry-run-deploy-command-boundary-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/go-no-go-packet-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/production-ops-panel-result.json",
  "apps/ai-gateway-service/evidence/phase701_720/post-deploy-checklist-prepared-result.json",
  finalEvidencePath,
];

const finalEvidence = await readJson(finalEvidencePath, {});
const phase683 = await readJson("apps/ai-gateway-service/evidence/phase683_700/taiji-beidou-production-readiness-final-result.json", {});
const missionControl = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js", "");
const panel = await readText("apps/ai-gateway-service/src/ui/components/TaijiBeidouProductionOpsPanel.js", "");
const rootPackage = await readJson("package.json", {});

const fileChecks = Object.fromEntries(
  await Promise.all(
    [...requiredToolFiles, ...requiredGatewayUiFiles, ...requiredDocs, ...requiredEvidence].map(async (path) => [
      path,
      await exists(path),
    ]),
  ),
);

const checks = {
  phaseRange: finalEvidence.phaseRange === "Phase701-720",
  completed: finalEvidence.completed === true,
  recommended_sealed: finalEvidence.recommended_sealed === true,
  blocker: finalEvidence.blocker === null,
  phase683700Passed:
    phase683.productionReady === true &&
    phase683.productionDeployExecuted === false &&
    phase683.mainChainRuntimeReady === true &&
    phase683.chatIntegrated === true &&
    phase683.chatGatewayExecuteIntegrated === true,
  productionReady: finalEvidence.productionReady === true,
  productionDeployExecuted: finalEvidence.productionDeployExecuted === false,
  deployDeferred: finalEvidence.deployDeferred === true,
  deployAuthorized: finalEvidence.deployAuthorized === false,
  releaseExecuted: finalEvidence.releaseExecuted === false,
  tagCreated: finalEvidence.tagCreated === false,
  artifactUploaded: finalEvidence.artifactUploaded === false,
  mainChainRuntimeReady: finalEvidence.mainChainRuntimeReady === true,
  chatIntegrated: finalEvidence.chatIntegrated === true,
  chatGatewayExecuteIntegrated: finalEvidence.chatGatewayExecuteIntegrated === true,
  mainChainDefaultEnabled: finalEvidence.mainChainDefaultEnabled === false,
  chatDefaultEnabled: finalEvidence.chatDefaultEnabled === false,
  chatGatewayExecuteDefaultEnabled: finalEvidence.chatGatewayExecuteDefaultEnabled === false,
  providerRuntimeDefaultEnabled: finalEvidence.providerRuntimeDefaultEnabled === false,
  deployAuthorizationPacketReady: finalEvidence.deployAuthorizationPacketReady === true,
  environmentIsolationReady: finalEvidence.environmentIsolationReady === true,
  runtimeConfigFrozen: finalEvidence.runtimeConfigFrozen === true,
  canaryPlanReady: finalEvidence.canaryPlanReady === true,
  rollbackCommandPackReady: finalEvidence.rollbackCommandPackReady === true,
  emergencyDisableDryRunPassed: finalEvidence.emergencyDisableDryRunPassed === true,
  monitoringConfigReady: finalEvidence.monitoringConfigReady === true,
  alertingConfigReady: finalEvidence.alertingConfigReady === true,
  sloSliErrorBudgetReady: finalEvidence.sloSliErrorBudgetReady === true,
  costQuotaGuardReady: finalEvidence.costQuotaGuardReady === true,
  incidentRunbookReady: finalEvidence.incidentRunbookReady === true,
  operatorHandbookReady: finalEvidence.operatorHandbookReady === true,
  supportTroubleshootingGuideReady: finalEvidence.supportTroubleshootingGuideReady === true,
  complianceFinalReviewPassed: finalEvidence.complianceFinalReviewPassed === true,
  securityFinalReviewPassed: finalEvidence.securityFinalReviewPassed === true,
  routeDefaultDisabledRegressionPassed: finalEvidence.routeDefaultDisabledRegressionPassed === true,
  dryRunDeployCommandBoundaryReady: finalEvidence.dryRunDeployCommandBoundaryReady === true,
  goNoGoPacketReady: finalEvidence.goNoGoPacketReady === true,
  goDecision: finalEvidence.goDecision === "pending",
  meetingHeld: finalEvidence.meetingHeld === false,
  postDeployChecklistPrepared: finalEvidence.postDeployChecklistPrepared === true,
  postDeploySmokeExecuted: finalEvidence.postDeploySmokeExecuted === false,
  productionTrafficObserved: finalEvidence.productionTrafficObserved === false,
  rawSecretRead: finalEvidence.rawSecretRead === false,
  secretValueExposed: finalEvidence.secretValueExposed === false,
  authJsonRead: finalEvidence.authJsonRead === false,
  codexConfigModified: finalEvidence.codexConfigModified === false,
  codexBaseUrlModified: finalEvidence.codexBaseUrlModified === false,
  chatBehaviorChangedByDefault: finalEvidence.chatBehaviorChangedByDefault === false,
  chatGatewayExecuteBehaviorChangedByDefault: finalEvidence.chatGatewayExecuteBehaviorChangedByDefault === false,
  unsupportedClaimCount: finalEvidence.unsupportedClaimCount === 0,
  hallucinatedFactCount: finalEvidence.hallucinatedFactCount === 0,
  requiredFilesPresent: Object.values(fileChecks).every(Boolean),
  missionControlProductionOpsPanelAvailable:
    missionControl.includes("renderTaijiBeidouProductionOpsPanel") &&
    panel.includes('data-taiji-production-ops-panel="true"') &&
    !/立即部署|开启生产流量|上传 artifact|release now|tag now|deploy now/i.test(panel),
  packageScriptPresent:
    rootPackage.scripts?.["verify:phase701-720-no-deploy-production-ops"] ===
    "node tools/phase701_720/validate-no-deploy-production-ops-readiness.mjs",
};

const blocker = firstFailed(checks);
const output = {
  ...finalEvidence,
  phaseRange: "Phase701-720",
  completed: blocker === null && finalEvidence.completed === true,
  recommended_sealed: blocker === null && finalEvidence.recommended_sealed === true,
  blocker,
  checks,
  fileChecks,
};

if (
  output.completed !== finalEvidence.completed ||
  output.recommended_sealed !== finalEvidence.recommended_sealed ||
  output.blocker !== finalEvidence.blocker
) {
  await writeJson(finalEvidencePath, output);
}

console.log(JSON.stringify(output, null, 2));
if (blocker !== null) process.exitCode = 1;

async function exists(path) {
  try {
    await access(resolve(repoRoot, path), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path, fallback) {
  try {
    return String(await readFile(resolve(repoRoot, path), "utf8"));
  } catch {
    return fallback;
  }
}

async function readJson(path, fallback) {
  const text = await readText(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  const fullPath = resolve(repoRoot, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function firstFailed(checksObject) {
  for (const [key, value] of Object.entries(checksObject)) {
    if (value !== true) return key;
  }
  return null;
}
