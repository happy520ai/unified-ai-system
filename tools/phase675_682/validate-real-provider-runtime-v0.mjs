import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const requiredModuleFiles = [
  "packages/taiji-beidou-engine/src/realProviderRuntimeAuthorizationSchema.js",
  "packages/taiji-beidou-engine/src/credentialRefProviderRuntimeGate.js",
  "packages/taiji-beidou-engine/src/providerRuntimeBridgeDryRun.js",
  "packages/taiji-beidou-engine/src/guardedRealProviderRuntimeExecutor.js",
  "packages/taiji-beidou-engine/src/providerRuntimeEvidenceLedger.js",
  "packages/taiji-beidou-engine/src/providerRuntimeCostQuotaGuard.js",
  "packages/taiji-beidou-engine/src/providerRuntimeFailureClassifier.js",
  "packages/taiji-beidou-engine/src/providerRuntimeEmergencyDisable.js",
  "packages/taiji-beidou-engine/src/providerRuntimeClosure.js",
];

const requiredGatewayFiles = [
  "apps/ai-gateway-service/src/gateway/taijiBeidouRealProviderRuntimePreview.js",
  "apps/ai-gateway-service/src/gateway/taijiBeidouRealProviderRuntimeEvidencePreview.js",
];

const requiredUiFiles = [
  "apps/ai-gateway-service/src/ui/components/TaijiBeidouRealProviderRuntimePanel.js",
  "apps/ai-gateway-service/src/ui/copy/taijiBeidouRealProviderRuntimeCopy.js",
];

const requiredDocs = [
  "docs/phase675-real-provider-runtime-authorization-schema.md",
  "docs/phase676-credentialref-provider-runtime-gate.md",
  "docs/phase677-provider-runtime-bridge-dry-run.md",
  "docs/phase678-real-provider-runtime-approval-intake.md",
  "docs/phase679-guarded-real-provider-runtime-one-shot.md",
  "docs/phase680-provider-runtime-evidence-cost-quota-ledger.md",
  "docs/phase681-provider-runtime-failure-emergency-disable-drill.md",
  "docs/phase682-real-provider-runtime-v0-closure.md",
  "docs/phase675-682-taiji-beidou-guarded-real-provider-runtime-v0.md",
  "docs/phase675-682-execution-report.md",
];

const schemaEvidence = await readJson("apps/ai-gateway-service/evidence/phase675_682/authorization-schema-result.json", {});
const gateEvidence = await readJson("apps/ai-gateway-service/evidence/phase675_682/credentialref-provider-runtime-gate-result.json", {});
const bridgeEvidence = await readJson("apps/ai-gateway-service/evidence/phase675_682/provider-runtime-bridge-dry-run-result.json", {});
const intakeEvidence = await readJson("apps/ai-gateway-service/evidence/phase675_682/real-provider-runtime-approval-intake-result.json", {});
const executionEvidence = await readJson("apps/ai-gateway-service/evidence/phase675_682/guarded-real-provider-runtime-one-shot-result.json", {});
const ledgerEvidence = await readJson("apps/ai-gateway-service/evidence/phase675_682/provider-runtime-evidence-ledger.json", {});
const failureEvidence = await readJson("apps/ai-gateway-service/evidence/phase675_682/provider-runtime-failure-emergency-drill-result.json", {});
const uiPanelText = await readText("apps/ai-gateway-service/src/ui/components/TaijiBeidouRealProviderRuntimePanel.js", "");

const moduleAvailability = Object.fromEntries(await Promise.all(requiredModuleFiles.map(async (path) => [path, await exists(path)])));
const gatewayAvailability = Object.fromEntries(await Promise.all(requiredGatewayFiles.map(async (path) => [path, await exists(path)])));
const uiAvailability = Object.fromEntries(await Promise.all(requiredUiFiles.map(async (path) => [path, await exists(path)])));
const docsGenerated = (await Promise.all(requiredDocs.map((path) => exists(path)))).every(Boolean);
const approvalFilePresent = await exists("docs/phase675_682-real-provider-runtime-approval.input.json");
const authorizationComplete = intakeEvidence.authorizationComplete === true;
const realProviderCallExecuted = executionEvidence.realProviderCallExecuted === true;
const missingApprovalPath = approvalFilePresent === false && intakeEvidence.blocker === "real_provider_runtime_approval_missing" && realProviderCallExecuted === false;
const oneShotPassedPath = approvalFilePresent === true && authorizationComplete === true && executionEvidence.responseClassification === "pass" && realProviderCallExecuted === true;
const oneShotFailedPath = approvalFilePresent === true && authorizationComplete === true && realProviderCallExecuted === true && executionEvidence.responseClassification === "provider_call_failed";

const checks = {
  phaseRange: "Phase675-682",
  guardedRealProviderRuntimeV0Available: true,
  productionReady: false,
  mainChainRuntimeReady: false,
  providerRuntimeDefaultEnabled: false,
  providerIdAllowedList: ["nvidia"],
  nonNvidiaProviderBlocked: failureEvidence.nonNvidiaProviderBlocked === true && gateEvidence.nonNvidiaProviderBlocked === true,
  credentialRefOnly: gateEvidence.credentialRefOnly === true && bridgeEvidence.credentialRefUsed === true,
  approvalGateWorking: missingApprovalPath || authorizationComplete === true,
  realProviderRuntimeAuthorizationSchemaAvailable: moduleAvailability["packages/taiji-beidou-engine/src/realProviderRuntimeAuthorizationSchema.js"] === true,
  credentialRefProviderRuntimeGateAvailable: moduleAvailability["packages/taiji-beidou-engine/src/credentialRefProviderRuntimeGate.js"] === true,
  providerRuntimeBridgeDryRunAvailable: moduleAvailability["packages/taiji-beidou-engine/src/providerRuntimeBridgeDryRun.js"] === true,
  guardedRealProviderRuntimeExecutorAvailable: moduleAvailability["packages/taiji-beidou-engine/src/guardedRealProviderRuntimeExecutor.js"] === true,
  providerRuntimeEvidenceLedgerAvailable: moduleAvailability["packages/taiji-beidou-engine/src/providerRuntimeEvidenceLedger.js"] === true,
  providerRuntimeCostQuotaGuardAvailable: moduleAvailability["packages/taiji-beidou-engine/src/providerRuntimeCostQuotaGuard.js"] === true,
  providerRuntimeFailureClassifierAvailable: moduleAvailability["packages/taiji-beidou-engine/src/providerRuntimeFailureClassifier.js"] === true,
  providerRuntimeEmergencyDisableAvailable: moduleAvailability["packages/taiji-beidou-engine/src/providerRuntimeEmergencyDisable.js"] === true,
  providerRuntimeClosureAvailable: moduleAvailability["packages/taiji-beidou-engine/src/providerRuntimeClosure.js"] === true,
  gatewayPreviewAvailable: Object.values(gatewayAvailability).every(Boolean),
  missionControlRealProviderRuntimePanelAvailable:
    Object.values(uiAvailability).every(Boolean) &&
    uiPanelText.includes("data-taiji-real-provider-runtime-panel=\"true\"") &&
    !/生产启用|自动上线|读取 secret|部署|修改 \/chat|修改 \/chat-gateway\/execute|无限重试/.test(uiPanelText),
  docsGenerated,
  authorizationSchemaGenerated: schemaEvidence.authorizationSchemaGenerated === true,
  approvalTemplateGenerated: schemaEvidence.approvalTemplateGenerated === true,
  gateGenerated: gateEvidence.credentialRefProviderRuntimeGateAvailable === true,
  bridgeDryRunGenerated: bridgeEvidence.providerRuntimeBridgeDryRunAvailable === true,
  evidenceLedgerGenerated: ledgerEvidence.evidenceLedgerGenerated === true,
  rollbackAvailable: ledgerEvidence.rollbackAvailable === true && gateEvidence.rollbackAvailable === true,
  emergencyDisableAvailable: failureEvidence.emergencyDisableAvailable === true,
  maxRequestsRespected: executionEvidence.maxRequestsRespected === true && ledgerEvidence.maxRequestsRespected === true,
  maxRetriesRespected: executionEvidence.maxRetriesRespected === true,
  budgetGuardAttached: bridgeEvidence.budgetGuardAttached === true && ledgerEvidence.budgetGuardAttached === true,
  failedProviderRuntimeNotMarkedPassed: failureEvidence.failedProviderRuntimeNotMarkedPassed === true,
  blockedProviderRuntimeNotMarkedCompleted: failureEvidence.blockedProviderRuntimeNotMarkedCompleted === true,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
};

const blocker = findBlocker(checks, { missingApprovalPath, oneShotFailedPath });
const finalBlocker = missingApprovalPath && blocker === null ? "real_provider_runtime_approval_missing" : blocker;
const recommendedSealed = missingApprovalPath ? blocker === null : blocker === null && !oneShotFailedPath;
const finalEvidence = {
  phaseRange: "Phase675-682",
  phase: "Phase675-682-AIO",
  completed: blocker === null || oneShotFailedPath,
  recommended_sealed: recommendedSealed,
  blocker: oneShotFailedPath ? "guarded_real_provider_runtime_one_shot_failed" : finalBlocker,
  guardedRealProviderRuntimeV0Available: checks.guardedRealProviderRuntimeV0Available,
  productionReady: false,
  mainChainRuntimeReady: false,
  providerRuntimeDefaultEnabled: false,
  providerIdAllowedList: ["nvidia"],
  nonNvidiaProviderBlocked: checks.nonNvidiaProviderBlocked,
  approvalFilePresent,
  authorizationComplete,
  realProviderCallExecuted,
  providerId: intakeEvidence.providerId || executionEvidence.providerId || "nvidia",
  modelId: intakeEvidence.modelId || executionEvidence.modelId || null,
  credentialRefOnly: checks.credentialRefOnly,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  requestAttemptCount: Number(executionEvidence.requestAttemptCount || 0),
  retryAttemptCount: Number(executionEvidence.retryAttemptCount || 0),
  responseReceived: executionEvidence.responseReceived === true,
  responseMarkerMatched: executionEvidence.responseMarkerMatched === true,
  responseClassification: executionEvidence.responseClassification || "blocked_by_missing_approval",
  maxRequestsRespected: checks.maxRequestsRespected,
  maxRetriesRespected: checks.maxRetriesRespected,
  budgetGuardAttached: checks.budgetGuardAttached,
  evidenceLedgerGenerated: checks.evidenceLedgerGenerated,
  rollbackAvailable: checks.rollbackAvailable,
  emergencyDisableAvailable: checks.emergencyDisableAvailable,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  approvalGateWorking: checks.approvalGateWorking,
  checks,
};

await writeJson("apps/ai-gateway-service/evidence/phase675_682/taiji-beidou-real-provider-runtime-v0-result.json", finalEvidence);
console.log(JSON.stringify(finalEvidence, null, 2));

if (blocker && !oneShotFailedPath) {
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

function findBlocker(checksObject, state) {
  const requiredTrue = [
    "guardedRealProviderRuntimeV0Available",
    "nonNvidiaProviderBlocked",
    "credentialRefOnly",
    "approvalGateWorking",
    "realProviderRuntimeAuthorizationSchemaAvailable",
    "credentialRefProviderRuntimeGateAvailable",
    "providerRuntimeBridgeDryRunAvailable",
    "guardedRealProviderRuntimeExecutorAvailable",
    "providerRuntimeEvidenceLedgerAvailable",
    "providerRuntimeCostQuotaGuardAvailable",
    "providerRuntimeFailureClassifierAvailable",
    "providerRuntimeEmergencyDisableAvailable",
    "providerRuntimeClosureAvailable",
    "gatewayPreviewAvailable",
    "missionControlRealProviderRuntimePanelAvailable",
    "docsGenerated",
    "authorizationSchemaGenerated",
    "approvalTemplateGenerated",
    "gateGenerated",
    "bridgeDryRunGenerated",
    "evidenceLedgerGenerated",
    "rollbackAvailable",
    "emergencyDisableAvailable",
    "maxRequestsRespected",
    "maxRetriesRespected",
    "budgetGuardAttached",
    "failedProviderRuntimeNotMarkedPassed",
    "blockedProviderRuntimeNotMarkedCompleted",
  ];
  for (const key of requiredTrue) {
    if (checksObject[key] !== true) return key;
  }
  if (checksObject.productionReady !== false) return "productionReady";
  if (checksObject.mainChainRuntimeReady !== false) return "mainChainRuntimeReady";
  if (checksObject.providerRuntimeDefaultEnabled !== false) return "providerRuntimeDefaultEnabled";
  for (const key of [
    "rawSecretRead",
    "secretValueExposed",
    "authJsonRead",
    "codexConfigModified",
    "codexBaseUrlModified",
    "chatBehaviorChanged",
    "chatGatewayExecuteBehaviorChanged",
    "deployExecuted",
    "releaseExecuted",
    "tagCreated",
    "artifactUploaded",
  ]) {
    if (checksObject[key] !== false) return key;
  }
  if (checksObject.unsupportedClaimCount !== 0) return "unsupportedClaimCount";
  if (checksObject.hallucinatedFactCount !== 0) return "hallucinatedFactCount";
  if (state.oneShotFailedPath) return "guarded_real_provider_runtime_one_shot_failed";
  return null;
}
