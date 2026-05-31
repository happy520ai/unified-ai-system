import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseId = "Phase1201";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1201-physics-field");
export const finalEvidencePath = resolve(evidenceDir, "taiji-beidou-minimal-field-result.json");
export const validationEvidencePath = resolve(evidenceDir, "taiji-beidou-minimal-field-validation-result.json");
export const dryRunEvidencePath = resolve(evidenceDir, "taiji-beidou-minimal-field-dry-run-result.json");
export const executionBoundaryEvidencePath = resolve(evidenceDir, "taiji-beidou-minimal-field-execution-boundary-note.json");
export const docsPath = resolve(repoRoot, "docs/phase1201-taiji-beidou-minimal-field-prototype.md");
export const modulePath = resolve(repoRoot, "packages/taiji-beidou-engine/src/minimalFieldPrototype.js");
export const runnerPath = resolve(repoRoot, "tools/phase1201-physics-field/run-minimal-field-prototype.mjs");
export const validatorPath = resolve(repoRoot, "tools/phase1201-physics-field/validate-minimal-field-prototype.mjs");

export async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
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

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${String(value).trimEnd()}\n`, "utf8");
}

export function phase1201Boundary() {
  return {
    dryRunOnly: true,
    syntheticDatasetUsed: true,
    gloveDownloadAllowed: process.env.ALLOW_TAIJI_GLOVE_DOWNLOAD === "true",
    gloveDownloaded: false,
    externalNetworkUsed: false,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    openaiCalled: false,
    claudeCalled: false,
    openRouterCalled: false,
    mimoCalled: false,
    nvidiaCalled: false,
    volcengineCalled: false,
    secretRead: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    legacyModified: false,
    projectContextCreated: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
  };
}
