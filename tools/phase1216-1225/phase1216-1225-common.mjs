import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1216-1225-AIO";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1216-1225-taiji-beidou-main-chain-candidate-prep");
export const resultPath = resolve(evidenceDir, "taiji-beidou-main-chain-candidate-prep-result.json");
export const validationPath = resolve(evidenceDir, "taiji-beidou-main-chain-candidate-prep-validation-result.json");
export const docsPath = resolve(repoRoot, "docs/phase1216-1225-taiji-beidou-main-chain-candidate-prep.md");
export const executionReportPath = resolve(repoRoot, "docs/phase1216-1225-execution-report.md");

export const phaseEvidence = {
  phase1216: {
    phase: "Phase1216",
    title: "Main-chain Candidate Contract Design",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1216-taiji-beidou-main-chain-candidate-contract",
    resultFile: "main-chain-candidate-contract-design-result.json",
    validationFile: "main-chain-candidate-contract-design-validation-result.json",
    docsFile: "docs/phase1216-taiji-beidou-main-chain-candidate-contract.md",
  },
  phase1217: {
    phase: "Phase1217",
    title: "No-flag Regression Baseline",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1217-taiji-beidou-no-flag-regression-baseline",
    resultFile: "no-flag-regression-baseline-result.json",
    validationFile: "no-flag-regression-baseline-validation-result.json",
    docsFile: "docs/phase1217-taiji-beidou-no-flag-regression-baseline.md",
  },
  phase1218: {
    phase: "Phase1218",
    title: "Shadow Runtime Adapter Design",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1218-taiji-beidou-shadow-runtime-adapter-design",
    resultFile: "shadow-runtime-adapter-design-result.json",
    validationFile: "shadow-runtime-adapter-design-validation-result.json",
    docsFile: "docs/phase1218-taiji-beidou-shadow-runtime-adapter-design.md",
  },
  phase1219: {
    phase: "Phase1219",
    title: "Flag-gated Shadow Adapter Implementation",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1219-taiji-beidou-flag-gated-shadow-adapter",
    resultFile: "flag-gated-shadow-adapter-result.json",
    validationFile: "flag-gated-shadow-adapter-validation-result.json",
    docsFile: "docs/phase1219-taiji-beidou-flag-gated-shadow-adapter-implementation.md",
  },
  phase1220: {
    phase: "Phase1220",
    title: "Shadow Adapter Verifier + Rollback",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1220-taiji-beidou-shadow-adapter-verifier-rollback",
    resultFile: "shadow-adapter-verifier-rollback-result.json",
    validationFile: "shadow-adapter-verifier-rollback-validation-result.json",
    docsFile: "docs/phase1220-taiji-beidou-shadow-adapter-verifier-rollback.md",
  },
  phase1221: {
    phase: "Phase1221",
    title: "Main-chain Entry Approval Review",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1221-taiji-beidou-main-chain-entry-approval-review",
    resultFile: "main-chain-entry-approval-review-result.json",
    validationFile: "main-chain-entry-approval-review-validation-result.json",
    docsFile: "docs/phase1221-taiji-beidou-main-chain-entry-approval-review.md",
  },
  phase1222: {
    phase: "Phase1222",
    title: "/chat Candidate Gate Design",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1222-taiji-beidou-chat-candidate-gate-design",
    resultFile: "chat-candidate-gate-design-result.json",
    validationFile: "chat-candidate-gate-design-validation-result.json",
    docsFile: "docs/phase1222-taiji-beidou-chat-candidate-gate-design.md",
  },
  phase1223: {
    phase: "Phase1223",
    title: "/chat-gateway/execute Candidate Gate Design",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1223-taiji-beidou-chat-gateway-execute-candidate-gate-design",
    resultFile: "chat-gateway-execute-candidate-gate-design-result.json",
    validationFile: "chat-gateway-execute-candidate-gate-design-validation-result.json",
    docsFile: "docs/phase1223-taiji-beidou-chat-gateway-execute-candidate-gate-design.md",
  },
  phase1224: {
    phase: "Phase1224",
    title: "Guarded Main-chain Shadow Test Preparation",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1224-taiji-beidou-guarded-shadow-test-preparation",
    resultFile: "guarded-shadow-test-preparation-result.json",
    validationFile: "guarded-shadow-test-preparation-validation-result.json",
    docsFile: "docs/phase1224-taiji-beidou-guarded-shadow-test-preparation.md",
  },
  phase1225: {
    phase: "Phase1225",
    title: "Guarded Main-chain Shadow Test Authorization Gate",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1225-taiji-beidou-authorization-gate",
    resultFile: "authorization-gate-result.json",
    validationFile: "authorization-gate-validation-result.json",
    docsFile: "docs/phase1225-taiji-beidou-authorization-gate.md",
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
    chatModified: false,
    chatRuntimeModified: false,
    chatGatewayExecuteModified: false,
    chatGatewayExecuteRuntimeModified: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
    mainChainIntegrationExecuted: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    providerRuntimeEnabled: false,
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
