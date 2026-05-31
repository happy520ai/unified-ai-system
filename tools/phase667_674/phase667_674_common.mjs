import { access, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseEvidenceDir = "apps/ai-gateway-service/evidence/phase667_674";
export const runtimeAdmittedDir = "capabilities/_runtime_admitted";
export const runtimeExecutionsDir = "capabilities/_runtime_executions";
export const runtimeEvidenceDir = "capabilities/_runtime_evidence";
export const runtimeDisabledDir = "capabilities/_runtime_disabled";

export function phaseBoundary() {
  return {
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    secretValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    yiyiRestored: false,
    characterModuleRestored: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
  };
}

export async function pathExists(path) {
  try {
    await access(resolve(repoRoot, path), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(path, fallback = "") {
  try {
    return String(await readFile(resolve(repoRoot, path), "utf8"));
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
  const fullPath = resolve(repoRoot, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  const fullPath = resolve(repoRoot, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${String(value).trimEnd()}\n`, "utf8");
}

export async function listJsonFiles(path) {
  try {
    const entries = await readdir(resolve(repoRoot, path), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => `${path}/${entry.name}`);
  } catch {
    return [];
  }
}

export function safeEvidenceBase(extra = {}) {
  return {
    phaseRange: "Phase667-674",
    sandboxLocalRuntimeOnly: true,
    productionReady: false,
    realProviderRuntimeReady: false,
    mainChainRuntimeReady: false,
    ...phaseBoundary(),
    ...extra,
  };
}
