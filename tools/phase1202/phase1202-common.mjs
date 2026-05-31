import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phase = "Phase1202";
export const title = "Taiji / Beidou Task Concept Source Schema";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1202-task-concept-source-schema");
export const resultEvidencePath = resolve(evidenceDir, "task-concept-source-schema-result.json");
export const validationEvidencePath = resolve(evidenceDir, "task-concept-source-schema-validation-result.json");
export const schemaModulePath = resolve(repoRoot, "packages/taiji-beidou-engine/src/taskConceptSourceSchema.js");
export const runnerPath = resolve(repoRoot, "tools/phase1202/run-task-concept-source-schema.mjs");
export const validatorPath = resolve(repoRoot, "tools/phase1202/validate-task-concept-source-schema.mjs");
export const docsPath = resolve(repoRoot, "docs/phase1202-taiji-beidou-task-concept-source-schema.md");
export const examplesPath = resolve(repoRoot, "docs/phase1202-task-concept-source-schema-examples.json");
export const reportPath = resolve(repoRoot, "docs/phase1202-execution-report.md");

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

export function phase1202Boundary() {
  return {
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    gloveDownloaded: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    workspaceCleanClaimed: false,
    realSemanticValidationClaimed: false,
    syntheticOnly: true,
  };
}
