import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1211-1215-AIO";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1211-1215-taiji-beidou-dry-run-stabilization");
export const resultPath = resolve(evidenceDir, "taiji-beidou-dry-run-stabilization-result.json");
export const validationPath = resolve(evidenceDir, "taiji-beidou-dry-run-stabilization-validation-result.json");
export const docsPath = resolve(repoRoot, "docs/phase1211-1215-taiji-beidou-dry-run-stabilization.md");
export const executionReportPath = resolve(repoRoot, "docs/phase1211-1215-execution-report.md");

export const phaseEvidence = {
  phase1211: {
    phase: "Phase1211",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1211-taiji-beidou-scenario-matrix",
    resultFile: "scenario-matrix-expansion-result.json",
    validationFile: "scenario-matrix-expansion-validation-result.json",
    docsFile: "docs/phase1211-taiji-beidou-scenario-matrix-expansion.md",
  },
  phase1212: {
    phase: "Phase1212",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1212-taiji-beidou-boundary-hardening",
    resultFile: "regression-boundary-hardening-result.json",
    validationFile: "regression-boundary-hardening-validation-result.json",
    docsFile: "docs/phase1212-taiji-beidou-regression-boundary-hardening.md",
  },
  phase1213: {
    phase: "Phase1213",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1213-taiji-beidou-operator-ux-copy",
    resultFile: "operator-ux-copy-polish-result.json",
    validationFile: "operator-ux-copy-polish-validation-result.json",
    docsFile: "docs/phase1213-taiji-beidou-operator-ux-copy-polish.md",
  },
  phase1214: {
    phase: "Phase1214",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1214-taiji-beidou-internal-trial-pack",
    resultFile: "internal-trial-pack-result.json",
    validationFile: "internal-trial-pack-validation-result.json",
    docsFile: "docs/phase1214-taiji-beidou-internal-trial-pack.md",
  },
  phase1215: {
    phase: "Phase1215",
    evidenceDir: "apps/ai-gateway-service/evidence/phase1215-taiji-beidou-dry-run-demonstration-closure",
    resultFile: "dry-run-demonstration-closure-result.json",
    validationFile: "dry-run-demonstration-closure-validation-result.json",
    docsFile: "docs/phase1215-taiji-beidou-dry-run-demonstration-closure.md",
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
