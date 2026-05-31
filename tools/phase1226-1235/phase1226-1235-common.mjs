import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1226-1235-AIO";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1226-1235-taiji-beidou-guarded-shadow-integration");
export const resultPath = resolve(evidenceDir, "taiji-beidou-guarded-shadow-integration-result.json");
export const validationPath = resolve(evidenceDir, "taiji-beidou-guarded-shadow-integration-validation-result.json");
export const docsPath = resolve(repoRoot, "docs/phase1226-1235-taiji-beidou-guarded-shadow-integration-closure.md");
export const executionReportPath = resolve(repoRoot, "docs/phase1226-1235-execution-report.md");
export const approvalPath = resolve(repoRoot, "docs/approvals/phase1226-1235/guarded-shadow-integration-approval.json");

export const phaseEvidence = {
  phase1226: {
    phase: "Phase1226",
    title: "Execute Guarded Shadow Test",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1226-taiji-beidou-guarded-shadow-test",
    resultFile: "guarded-shadow-test-result.json",
    validationFile: "guarded-shadow-test-validation-result.json",
    docsFile: "docs/phase1226-taiji-beidou-guarded-shadow-test.md",
  },
  phase1227: {
    phase: "Phase1227",
    title: "Shadow Test Result Intake",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1227-taiji-beidou-shadow-test-result",
    resultFile: "shadow-test-result-collection-result.json",
    validationFile: "shadow-test-result-collection-validation-result.json",
    docsFile: "docs/phase1227-taiji-beidou-shadow-test-result-collection.md",
  },
  phase1228: {
    phase: "Phase1228",
    title: "Failure Classification + Rollback Verification",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1228-taiji-beidou-failure-classification-rollback-verification",
    resultFile: "failure-classification-rollback-verification-result.json",
    validationFile: "failure-classification-rollback-verification-validation-result.json",
    docsFile: "docs/phase1228-taiji-beidou-failure-classification-rollback-verification.md",
  },
  phase1229: {
    phase: "Phase1229",
    title: "No-flag Regression Recheck",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1229-taiji-beidou-no-flag-regression-recheck",
    resultFile: "no-flag-regression-recheck-result.json",
    validationFile: "no-flag-regression-recheck-validation-result.json",
    docsFile: "docs/phase1229-taiji-beidou-no-flag-regression-recheck.md",
  },
  phase1230: {
    phase: "Phase1230",
    title: "Limited Main-chain Candidate Integration Behind Flag",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1230-taiji-beidou-limited-main-chain-candidate-integration",
    resultFile: "limited-main-chain-candidate-integration-result.json",
    validationFile: "limited-main-chain-candidate-integration-validation-result.json",
    docsFile: "docs/phase1230-taiji-beidou-limited-main-chain-candidate-integration.md",
  },
  phase1231: {
    phase: "Phase1231",
    title: "/chat No-default-change Integration Verifier",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1231-taiji-beidou-chat-no-default-change",
    resultFile: "chat-no-default-change-result.json",
    validationFile: "chat-no-default-change-validation-result.json",
    docsFile: "docs/phase1231-taiji-beidou-chat-no-default-change.md",
  },
  phase1232: {
    phase: "Phase1232",
    title: "/chat-gateway/execute No-default-change Integration Verifier",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1232-taiji-beidou-chat-gateway-execute-no-default-change",
    resultFile: "chat-gateway-execute-no-default-change-result.json",
    validationFile: "chat-gateway-execute-no-default-change-validation-result.json",
    docsFile: "docs/phase1232-taiji-beidou-chat-gateway-execute-no-default-change.md",
  },
  phase1233: {
    phase: "Phase1233",
    title: "Provider / CredentialRef Boundary Verifier",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1233-taiji-beidou-provider-credential-boundary",
    resultFile: "provider-credential-boundary-result.json",
    validationFile: "provider-credential-boundary-validation-result.json",
    docsFile: "docs/phase1233-taiji-beidou-provider-credential-boundary.md",
  },
  phase1234: {
    phase: "Phase1234",
    title: "Mission Control Main-chain Candidate Status Preview",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1234-taiji-beidou-mission-control-candidate-status-preview",
    resultFile: "mission-control-candidate-status-preview-result.json",
    validationFile: "mission-control-candidate-status-preview-validation-result.json",
    docsFile: "docs/phase1234-taiji-beidou-mission-control-candidate-status-preview.md",
  },
  phase1235: {
    phase: "Phase1235",
    title: "Main-chain Candidate Closure Report",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1235-taiji-beidou-main-chain-candidate-closure",
    resultFile: "main-chain-candidate-closure-result.json",
    validationFile: "main-chain-candidate-closure-validation-result.json",
    docsFile: "docs/phase1235-taiji-beidou-main-chain-candidate-closure.md",
  },
};

export const phaseKeys = Object.keys(phaseEvidence);

export function boundary() {
  return {
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    gloveDownloaded: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    chatModified: false,
    chatRuntimeModified: false,
    chatGatewayExecuteModified: false,
    chatGatewayExecuteRuntimeModified: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    realSemanticValidationClaimed: false,
    productionReadyClaimed: false,
    syntheticOnly: true,
  };
}

export function phaseResultPath(key) {
  const config = phaseEvidence[key];
  return resolve(repoRoot, config.evidenceDir, config.resultFile);
}

export function phaseValidationPath(key) {
  const config = phaseEvidence[key];
  return resolve(repoRoot, config.evidenceDir, config.validationFile);
}

export function phaseDocsPath(key) {
  return resolve(repoRoot, phaseEvidence[key].docsFile);
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
