import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase651_666");
export const generatedDir = resolve(repoRoot, "capabilities/_generated_dry_run");
export const registryPreviewDir = resolve(repoRoot, "capabilities/_registry_preview");
export const synapsePreviewDir = resolve(repoRoot, "capabilities/_synapse_graph_preview");

export async function pathExists(path) {
  try {
    await access(resolve(repoRoot, path), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(path, fallback = "") {
  const fullPath = resolve(repoRoot, path);
  try {
    return String(await readFile(fullPath, "utf8"));
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

export function sanitizePreview(text, maxLength = 1200) {
  return String(text || "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET_LIKE]")
    .replace(/api[_-]?key\s*[:=]\s*\S+/gi, "api_key=[REDACTED]")
    .replace(/base_url\s*[:=]\s*\S+/gi, "base_url=[REDACTED]")
    .slice(0, maxLength);
}

export function phaseBoundary() {
  return {
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretRead: false,
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
    yiyiRestored: false,
    characterModuleRestored: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
  };
}
