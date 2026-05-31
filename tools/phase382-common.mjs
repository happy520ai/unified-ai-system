import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { captureScreenshot } from "./phase378-common.mjs";

export const phase382Safety = {
  modelBackedRuntimeEnabled: false,
  modelBackedDryRun: true,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  directProviderCallAllowed: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  actionExecuted: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  evidenceModified: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
  noHiddenSystemPromptLeakage: true,
  noMedicalClaim: true,
  noTherapyClaim: true,
  noSensitiveHealthInference: true,
};

export const phase382Screenshots = {
  status: "apps/ai-gateway-service/evidence/phase382g/screenshots/yiyi-model-brain-status.png",
  dryRun: "apps/ai-gateway-service/evidence/phase382g/screenshots/yiyi-model-brain-dry-run.png",
  credentialRefGate: "apps/ai-gateway-service/evidence/phase382g/screenshots/yiyi-credentialref-gate.png",
  providerQuotaBudgetGate: "apps/ai-gateway-service/evidence/phase382g/screenshots/yiyi-provider-quota-budget-gate.png",
  outputSafetyGate: "apps/ai-gateway-service/evidence/phase382g/screenshots/yiyi-output-safety-gate.png",
  providerTestAuthorizationBlocked: "apps/ai-gateway-service/evidence/phase382g/screenshots/yiyi-provider-test-authorization-blocked.png",
};

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export async function readText(path) {
  return readFile(resolve(path), "utf8");
}

export async function readJson(path) {
  return JSON.parse(await readText(path));
}

export async function writeText(path, content) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

export async function writeJson(path, value) {
  await writeText(path, JSON.stringify(value, null, 2));
}

export function fileExists(path) {
  return existsSync(resolve(path));
}

export function fileSize(path) {
  return statSync(resolve(path)).size;
}

export async function fetchUi(url) {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, text: await response.text(), error: null };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: error.message };
  }
}

export async function capturePhase382Screenshot({ url, outputPath, viewport = "1800,3400" }) {
  return captureScreenshot({ url, outputPath, viewport });
}
