import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1246-1255-AIO";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1246-1255-codex-delegated-owner-review-proxy");
export const resultPath = resolve(evidenceDir, "codex-delegated-owner-review-proxy-result.json");
export const validationPath = resolve(evidenceDir, "codex-delegated-owner-review-proxy-validation-result.json");
export const executionReportPath = resolve(repoRoot, "docs/phase1246-1255-codex-delegated-owner-review-proxy-execution-report.md");
export const codexProxyReviewReportPath = resolve(repoRoot, "docs/reviews/phase1246-1255/codex-proxy-review-report.md");
export const ownerDecisionChecklistPath = resolve(repoRoot, "docs/reviews/phase1246-1255/owner-final-decision-checklist.md");
export const postReviewActionLedgerPath = resolve(repoRoot, "docs/reviews/phase1246-1255/post-review-action-ledger.md");
export const approvalDraftPath = resolve(repoRoot, "docs/approvals/phase1256-1265/limited-enable-approval-draft.json");

export const upstreamResultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1236-1245-taiji-beidou-candidate-hardening/taiji-beidou-candidate-hardening-result.json");
export const ownerReviewPackPath = resolve(repoRoot, "docs/reviews/phase1236-1245/owner-review-packet.md");
export const manualTrialScriptPath = resolve(repoRoot, "docs/reviews/phase1236-1245/owner-manual-trial-script.md");
export const riskLedgerPath = resolve(repoRoot, "docs/reviews/phase1236-1245/risk-ledger.md");
export const limitedEnableTemplatePath = resolve(repoRoot, "docs/approvals/phase1246-1255/limited-enable-owner-review-template.json");

export const phaseDocs = {
  phase1246: "docs/phase1246-owner-review-pack-intake.md",
  phase1247: "docs/phase1247-codex-proxy-review-checklist.md",
  phase1248: "docs/phase1248-evidence-risk-ledger-recheck.md",
  phase1249: "docs/phase1249-mission-control-candidate-ux-review-proxy.md",
  phase1250: "docs/phase1250-limited-enable-readiness-reevaluation.md",
  phase1251: "docs/phase1251-approval-draft-json-generation.md",
  phase1252: "docs/phase1252-owner-decision-checklist-generation.md",
  phase1253: "docs/phase1253-limited-enable-blocker-classification.md",
  phase1254: "docs/phase1254-post-review-action-ledger.md",
  phase1255: "docs/phase1255-owner-final-decision-gate-closure.md",
};

export const phaseKeys = Object.keys(phaseDocs);

export function approvalDraftTemplate() {
  return {
    phaseRange: "Phase1256-1265",
    decision: "draft_pending_owner_final_decision",
    ownerPersonallyApproved: false,
    ownerManualReviewCompleted: false,
    allowLimitedEnableBehindFlag: false,
    allowProviderCall: false,
    allowSecretRead: false,
    allowChatDefaultChange: false,
    allowChatGatewayExecuteDefaultChange: false,
    allowMainChainDefaultEnable: false,
    allowProviderRuntimeDefaultEnable: false,
    allowDeploy: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowCommitPush: false,
    allowProductionReadyClaim: false,
  };
}

export function boundary() {
  return {
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
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
    realOwnerFeedbackCollected: false,
    ownerManualReviewCompleted: false,
    codexSelfTestCountedAsOwnerFeedback: false,
    ownerPersonallyApproved: false,
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
