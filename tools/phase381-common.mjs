import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { captureScreenshot } from "./phase378-common.mjs";

export const phase381Safety = {
  brainMode: "dry_run_mock",
  modelBacked: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  actionExecuted: false,
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

export const brainFiles = [
  "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainContract.js",
  "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiMissionContextBuilder.js",
  "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiPersonaContextBuilder.js",
  "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainSafetyGate.js",
  "apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainMockAdapter.js",
  "apps/ai-gateway-service/src/ui/components/YiyiBrainPanel.js",
];

export const phase381Screenshots = {
  status: "apps/ai-gateway-service/evidence/phase381f/screenshots/yiyi-brain-status.png",
  responsePreview: "apps/ai-gateway-service/evidence/phase381f/screenshots/yiyi-brain-response-preview.png",
  safetyGate: "apps/ai-gateway-service/evidence/phase381f/screenshots/yiyi-brain-safety-gate.png",
  providerUnconfigured: "apps/ai-gateway-service/evidence/phase381f/screenshots/yiyi-brain-provider-unconfigured.png",
  securityBlock: "apps/ai-gateway-service/evidence/phase381f/screenshots/yiyi-brain-security-block.png",
  evidenceExplain: "apps/ai-gateway-service/evidence/phase381f/screenshots/yiyi-brain-evidence-explain.png",
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

export async function readPhase381Source() {
  const files = [
    ...brainFiles,
    "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
    "apps/ai-gateway-service/src/ui/components/YiyiEmotionPanel.js",
    "apps/ai-gateway-service/src/ui/components/YiyiCharacterSettingsPanel.js",
    "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
  ];
  const parts = [];
  for (const file of files) {
    if (fileExists(file)) parts.push(await readText(file));
  }
  return parts.join("\n");
}

export async function fetchUi(url) {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, text: await response.text(), error: null };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: error.message };
  }
}

export async function capturePhase381Screenshot({ url, outputPath, viewport = "1800,3000" }) {
  return captureScreenshot({ url, outputPath, viewport });
}

export async function copyScreenshot(source, target) {
  await mkdir(dirname(resolve(target)), { recursive: true });
  await copyFile(resolve(source), resolve(target));
}
