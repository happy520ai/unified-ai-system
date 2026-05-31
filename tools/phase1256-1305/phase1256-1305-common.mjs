import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1256-1305-AIO";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1256-1305-taiji-beidou-limited-enable-to-default-readiness");
export const resultPath = resolve(evidenceDir, "taiji-beidou-limited-enable-to-default-readiness-result.json");
export const validationPath = resolve(evidenceDir, "taiji-beidou-limited-enable-to-default-readiness-validation-result.json");
export const reportPath = resolve(repoRoot, "docs/phase1256-1305-taiji-beidou-limited-enable-to-default-readiness-report.md");
export const approvalPath = resolve(repoRoot, "docs/approvals/phase1256-1305/limited-enable-to-default-readiness-approval.json");
export const upstreamProxyPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1246-1255-codex-delegated-owner-review-proxy/codex-delegated-owner-review-proxy-result.json");

export const batchRanges = [
  ["phase1256To1265", 1256, 1265],
  ["phase1266To1275", 1266, 1275],
  ["phase1276To1285", 1276, 1285],
  ["phase1286To1295", 1286, 1295],
  ["phase1296To1305", 1296, 1305],
];

export function approvalTemplate() {
  return {
    phaseRange: "Phase1256-1305",
    decision: "approved_limited_enable_behind_flag_and_default_readiness_assessment_only",
    ownerApproved: true,
    allowApprovalFinalization: true,
    allowLimitedEnablePreparation: true,
    allowGuardedLimitedEnableBehindFlag: true,
    allowLimitedEnableResultClosure: true,
    allowDefaultEnableReadinessAssessment: true,
    allowDefaultEnableExecution: false,
    allowProviderCall: false,
    allowSecretRead: false,
    allowAuthJsonRead: false,
    allowRawCredentialRefRead: false,
    allowCredentialRefBypass: false,
    allowQuotaBypass: false,
    allowBudgetBypass: false,
    allowSelectableGateBypass: false,
    allowChatDefaultChange: false,
    allowChatGatewayExecuteDefaultChange: false,
    allowMainChainDefaultEnable: false,
    allowProviderRuntimeDefaultEnable: false,
    allowDeploy: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowCommit: false,
    allowPush: false,
    allowWorkspaceCleanClaim: false,
    allowProductionReadyClaim: false,
    allowRealSemanticValidationClaim: false,
  };
}

export function boundary() {
  return {
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    secretValueExposed: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    defaultEnableExecuted: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    characterModuleRestored: false,
    realSemanticValidationClaimed: false,
    productionReadyClaimed: false,
  };
}

export async function readTextIfExists(path, fallback = "") {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

export async function readJsonIfExists(path, fallback = null) {
  const text = await readTextIfExists(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${String(value).trimEnd()}\n`, "utf8");
}

export function phaseDocPath(phaseNumber) {
  return resolve(repoRoot, `docs/phase${phaseNumber}-taiji-beidou-limited-enable-to-default-readiness.md`);
}

export function matchesBoundary(value) {
  if (!value) return false;
  return Object.entries(boundary()).every(([key, expected]) => value[key] === expected);
}

export function findBlocker(checks) {
  for (const [key, passed] of Object.entries(checks)) {
    if (passed !== true) return key;
  }
  return null;
}
