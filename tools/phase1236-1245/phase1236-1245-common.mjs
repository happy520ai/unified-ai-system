import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1236-1245-AIO";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1236-1245-taiji-beidou-candidate-hardening");
export const resultPath = resolve(evidenceDir, "taiji-beidou-candidate-hardening-result.json");
export const validationPath = resolve(evidenceDir, "taiji-beidou-candidate-hardening-validation-result.json");
export const ownerReviewResultPath = resolve(evidenceDir, "owner-review-packet-result.json");
export const extendedNoFlagResultPath = resolve(evidenceDir, "extended-no-flag-regression-result.json");
export const rollbackRehearsalResultPath = resolve(evidenceDir, "rollback-rehearsal-result.json");
export const evidenceAuditResultPath = resolve(evidenceDir, "evidence-completeness-audit-result.json");
export const riskLedgerResultPath = resolve(evidenceDir, "risk-ledger-result.json");
export const executionReportPath = resolve(repoRoot, "docs/phase1236-1245-taiji-beidou-candidate-hardening-execution-report.md");
export const nextApprovalTemplatePath = resolve(repoRoot, "docs/approvals/phase1246-1255/limited-enable-owner-review-template.json");
export const reviewPacketPath = resolve(repoRoot, "docs/reviews/phase1236-1245/owner-review-packet.md");
export const manualTrialScriptPath = resolve(repoRoot, "docs/reviews/phase1236-1245/owner-manual-trial-script.md");
export const riskLedgerDocPath = resolve(repoRoot, "docs/reviews/phase1236-1245/risk-ledger.md");
export const upstreamResultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1226-1235-taiji-beidou-guarded-shadow-integration/taiji-beidou-guarded-shadow-integration-result.json");

export const phaseDocs = {
  phase1236: "docs/phase1236-candidate-boundary-hardening.md",
  phase1237: "docs/phase1237-owner-review-packet.md",
  phase1238: "docs/phase1238-owner-manual-trial-script.md",
  phase1239: "docs/phase1239-mission-control-candidate-status-ux-hardening.md",
  phase1240: "docs/phase1240-extended-no-flag-regression-matrix.md",
  phase1241: "docs/phase1241-rollback-emergency-disable-rehearsal.md",
  phase1242: "docs/phase1242-evidence-completeness-hardening.md",
  phase1243: "docs/phase1243-limited-enable-readiness-assessment.md",
  phase1244: "docs/phase1244-risk-ledger-p0-p1-review.md",
  phase1245: "docs/phase1245-candidate-hardening-closure-next-approval-gate.md",
};

export const phaseKeys = Object.keys(phaseDocs);

export function boundary() {
  return {
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    secretValueExposed: false,
    rawCredentialRefRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    chatDefaultChanged: false,
    chatModified: false,
    chatGatewayExecuteDefaultChanged: false,
    chatGatewayExecuteModified: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    limitedEnableExecuted: false,
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

export function nextApprovalTemplate() {
  return {
    phaseRange: "Phase1246-1255",
    decision: "pending_owner_manual_review",
    ownerManualReviewCompleted: false,
    ownerApprovedLimitedEnable: false,
    allowLimitedEnableBehindFlag: false,
    providerCallAllowed: false,
    secretReadAllowed: false,
    chatDefaultChangeAllowed: false,
    chatGatewayExecuteDefaultChangeAllowed: false,
    mainChainDefaultEnableAllowed: false,
    deploymentAllowed: false,
    productionReadyClaimAllowed: false,
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

export function phaseDocPath(key) {
  return resolve(repoRoot, phaseDocs[key]);
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
