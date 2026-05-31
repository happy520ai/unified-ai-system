import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const finalEvidencePath = "apps/ai-gateway-service/evidence/phase683_700/taiji-beidou-production-readiness-final-result.json";

const requiredToolFiles = [
  "tools/phase683_700/run-real-provider-runtime-baseline-lock.mjs",
  "tools/phase683_700/run-real-provider-runtime-repeatability-pack.mjs",
  "tools/phase683_700/run-compliance-data-boundary-gate.mjs",
  "tools/phase683_700/run-rollback-emergency-disable-drill.mjs",
  "tools/phase683_700/run-main-chain-integration-contract.mjs",
  "tools/phase683_700/run-main-chain-disabled-hook-check.mjs",
  "tools/phase683_700/run-main-chain-shadow-trial.mjs",
  "tools/phase683_700/run-main-chain-readiness-seal.mjs",
  "tools/phase683_700/run-chat-gateway-execute-contract.mjs",
  "tools/phase683_700/run-chat-gateway-execute-preview-hook-check.mjs",
  "tools/phase683_700/run-chat-gateway-execute-shadow-trial.mjs",
  "tools/phase683_700/run-chat-gateway-execute-integration-seal.mjs",
  "tools/phase683_700/run-chat-integration-contract.mjs",
  "tools/phase683_700/run-chat-preview-shadow-trial.mjs",
  "tools/phase683_700/run-chat-integration-seal.mjs",
  "tools/phase683_700/run-production-readiness-gate.mjs",
  "tools/phase683_700/run-production-canary-plan.mjs",
  "tools/phase683_700/run-production-ready-final-seal.mjs",
  "tools/phase683_700/validate-production-readiness-final-seal.mjs",
];

const requiredGatewayFiles = [
  "apps/ai-gateway-service/src/gateway/taijiBeidouMainChainHook.js",
  "apps/ai-gateway-service/src/gateway/taijiBeidouMainChainPreview.js",
  "apps/ai-gateway-service/src/gateway/taijiBeidouChatGatewayExecutePreviewHook.js",
  "apps/ai-gateway-service/src/gateway/taijiBeidouChatPreviewHook.js",
  "apps/ai-gateway-service/src/gateway/taijiBeidouProductionReadinessGate.js",
];

const requiredUiFiles = [
  "apps/ai-gateway-service/src/ui/components/TaijiBeidouProductionReadinessPanel.js",
  "apps/ai-gateway-service/src/ui/copy/taijiBeidouProductionReadinessCopy.js",
];

const requiredDocs = [
  "docs/phase683-real-provider-runtime-baseline-lock.md",
  "docs/phase684-real-provider-runtime-repeatability-pack.md",
  "docs/phase685-compliance-data-boundary-gate.md",
  "docs/phase686-rollback-emergency-disable-drill.md",
  "docs/phase687-main-chain-integration-contract.md",
  "docs/phase688-main-chain-disabled-by-default-hook.md",
  "docs/phase689-main-chain-shadow-runtime-trial.md",
  "docs/phase690-main-chain-readiness-seal.md",
  "docs/phase691-chat-gateway-execute-integration-contract.md",
  "docs/phase692-chat-gateway-execute-disabled-preview-hook.md",
  "docs/phase693-chat-gateway-execute-shadow-internal-trial.md",
  "docs/phase694-chat-gateway-execute-integration-seal.md",
  "docs/phase695-chat-integration-contract.md",
  "docs/phase696-chat-disabled-preview-shadow-trial.md",
  "docs/phase697-chat-integration-seal.md",
  "docs/phase698-production-readiness-gate.md",
  "docs/phase699-production-canary-plan-no-deploy-closure.md",
  "docs/phase700-production-ready-final-seal.md",
  "docs/phase683-700-taiji-beidou-production-readiness-execution-report.md",
];

const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase683/real-provider-runtime-baseline-lock-result.json",
  "apps/ai-gateway-service/evidence/phase684/real-provider-runtime-repeatability-result.json",
  "apps/ai-gateway-service/evidence/phase685/compliance-data-boundary-result.json",
  "apps/ai-gateway-service/evidence/phase686/rollback-emergency-disable-drill-result.json",
  "apps/ai-gateway-service/evidence/phase687/main-chain-integration-contract-result.json",
  "apps/ai-gateway-service/evidence/phase688/main-chain-disabled-hook-result.json",
  "apps/ai-gateway-service/evidence/phase689/main-chain-shadow-runtime-trial-result.json",
  "apps/ai-gateway-service/evidence/phase690/main-chain-readiness-seal-result.json",
  "apps/ai-gateway-service/evidence/phase691/chat-gateway-execute-contract-result.json",
  "apps/ai-gateway-service/evidence/phase692/chat-gateway-execute-disabled-preview-hook-result.json",
  "apps/ai-gateway-service/evidence/phase693/chat-gateway-execute-shadow-internal-trial-result.json",
  "apps/ai-gateway-service/evidence/phase694/chat-gateway-execute-integration-seal-result.json",
  "apps/ai-gateway-service/evidence/phase695/chat-integration-contract-result.json",
  "apps/ai-gateway-service/evidence/phase696/chat-disabled-preview-shadow-trial-result.json",
  "apps/ai-gateway-service/evidence/phase697/chat-integration-seal-result.json",
  "apps/ai-gateway-service/evidence/phase698/production-readiness-gate-result.json",
  "apps/ai-gateway-service/evidence/phase699/production-canary-plan-result.json",
  "apps/ai-gateway-service/evidence/phase700/production-ready-final-seal-result.json",
];

const finalEvidence = await readJson(finalEvidencePath, {});
const phase675 = await readJson("apps/ai-gateway-service/evidence/phase675_682/taiji-beidou-real-provider-runtime-v0-result.json", {});
const httpServer = await readText("apps/ai-gateway-service/src/http/httpServer.js", "");
const missionControl = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js", "");
const uiPanel = await readText("apps/ai-gateway-service/src/ui/components/TaijiBeidouProductionReadinessPanel.js", "");
const rootPackage = await readJson("package.json", {});

const fileChecks = Object.fromEntries(
  await Promise.all(
    [...requiredToolFiles, ...requiredGatewayFiles, ...requiredUiFiles, ...requiredDocs, ...requiredEvidence].map(async (path) => [
      path,
      await exists(path),
    ]),
  ),
);

const checks = {
  phaseRange: finalEvidence.phaseRange === "Phase683-700",
  completed: finalEvidence.completed === true,
  recommended_sealed: finalEvidence.recommended_sealed === true,
  blocker: finalEvidence.blocker === null,
  productionReady: finalEvidence.productionReady === true,
  productionDeployExecuted: finalEvidence.productionDeployExecuted === false,
  mainChainRuntimeReady: finalEvidence.mainChainRuntimeReady === true,
  mainChainDefaultEnabled: finalEvidence.mainChainDefaultEnabled === false,
  chatIntegrated: finalEvidence.chatIntegrated === true,
  chatDefaultEnabled: finalEvidence.chatDefaultEnabled === false,
  chatGatewayExecuteIntegrated: finalEvidence.chatGatewayExecuteIntegrated === true,
  chatGatewayExecuteDefaultEnabled: finalEvidence.chatGatewayExecuteDefaultEnabled === false,
  guardedRealProviderRuntimeV0Passed:
    finalEvidence.guardedRealProviderRuntimeV0Passed === true &&
    phase675.guardedRealProviderRuntimeV0Available === true &&
    phase675.realProviderCallExecuted === true &&
    phase675.responseClassification === "pass",
  providerRuntimeDefaultEnabled: finalEvidence.providerRuntimeDefaultEnabled === false,
  credentialRefOnly: finalEvidence.credentialRefOnly === true,
  rawSecretRead: finalEvidence.rawSecretRead === false,
  secretValueExposed: finalEvidence.secretValueExposed === false,
  authJsonRead: finalEvidence.authJsonRead === false,
  nonNvidiaProviderBlocked: finalEvidence.nonNvidiaProviderBlocked === true,
  rollbackReady: finalEvidence.rollbackReady === true,
  emergencyDisableReady: finalEvidence.emergencyDisableReady === true,
  killSwitchReady: finalEvidence.killSwitchReady === true,
  complianceGatePassed: finalEvidence.complianceGatePassed === true,
  costBoundaryPassed: finalEvidence.costBoundaryPassed === true,
  monitoringPlanReady: finalEvidence.monitoringPlanReady === true,
  alertPlanReady: finalEvidence.alertPlanReady === true,
  runbookReady: finalEvidence.runbookReady === true,
  canaryPlanReady: finalEvidence.canaryPlanReady === true,
  chatNoFlagRegressionPassed: finalEvidence.chatNoFlagRegressionPassed === true,
  chatGatewayExecuteNoFlagRegressionPassed: finalEvidence.chatGatewayExecuteNoFlagRegressionPassed === true,
  chatBehaviorChangedByDefault: finalEvidence.chatBehaviorChangedByDefault === false,
  chatGatewayExecuteBehaviorChangedByDefault: finalEvidence.chatGatewayExecuteBehaviorChangedByDefault === false,
  deployExecuted: finalEvidence.deployExecuted === false,
  releaseExecuted: finalEvidence.releaseExecuted === false,
  tagCreated: finalEvidence.tagCreated === false,
  artifactUploaded: finalEvidence.artifactUploaded === false,
  unsupportedClaimCount: finalEvidence.unsupportedClaimCount === 0,
  hallucinatedFactCount: finalEvidence.hallucinatedFactCount === 0,
  requiredFilesPresent: Object.values(fileChecks).every(Boolean),
  httpServerChatHookImported:
    httpServer.includes("evaluateTaijiBeidouChatPreviewHook") &&
    httpServer.includes("evaluateTaijiBeidouChatGatewayExecutePreviewHook"),
  httpServerDefaultPathPreserved:
    httpServer.includes("const result = await runPhase312AChatGateway") &&
    httpServer.includes("const result = await gatewayService.execute"),
  missionControlProductionPanelAvailable:
    missionControl.includes("renderTaijiBeidouProductionReadinessPanel") &&
    uiPanel.includes('data-taiji-production-readiness-panel="true"') &&
    !/deploy now|release now|read secret|modify \/chat|modify \/chat-gateway\/execute|auto launch/i.test(uiPanel),
  packageScriptPresent:
    rootPackage.scripts?.["verify:phase683-700-taiji-beidou-production-readiness"] ===
    "node tools/phase683_700/validate-production-readiness-final-seal.mjs",
};

const blocker = firstFailed(checks);
const output = {
  ...finalEvidence,
  phaseRange: "Phase683-700",
  completed: blocker === null && finalEvidence.completed === true,
  recommended_sealed: blocker === null && finalEvidence.recommended_sealed === true,
  blocker,
  checks,
  fileChecks,
};

if (blocker !== finalEvidence.blocker || output.completed !== finalEvidence.completed || output.recommended_sealed !== finalEvidence.recommended_sealed) {
  await writeJson(finalEvidencePath, output);
}

console.log(JSON.stringify(output, null, 2));

if (blocker !== null) {
  process.exitCode = 1;
}

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
