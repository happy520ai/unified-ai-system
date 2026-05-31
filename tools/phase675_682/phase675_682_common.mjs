import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const approvalInputPath = "docs/phase675_682-real-provider-runtime-approval.input.json";
export const approvalTemplatePath = "docs/phase675_682-real-provider-runtime-approval.template.json";
export const phaseEvidenceDir = "apps/ai-gateway-service/evidence/phase675_682";

export function phaseBoundary(extra = {}) {
  return {
    phaseRange: "Phase675-682",
    productionReady: false,
    mainChainRuntimeReady: false,
    providerRuntimeDefaultEnabled: false,
    providerIdAllowedList: ["nvidia"],
    rawSecretRead: false,
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
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    ...extra,
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
