import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { captureScreenshot } from "./phase378-common.mjs";
import { readJson, readText, writeJson, writeText } from "./phase373-common.mjs";

export const yiyiAssetPath = "apps/ai-gateway-service/src/ui/assets/yiyi/yiyi-concept-board.png";
export const yiyiManifestPath = "apps/ai-gateway-service/src/ui/assets/yiyi/yiyi-asset-manifest.json";
export const yiyiTokensPath = "apps/ai-gateway-service/src/ui/assets/yiyi/yiyi-visual-tokens.json";
export const yiyiCopyPath = "apps/ai-gateway-service/src/ui/copy/yiyiCopy.js";

export const phase379Safety = {
  originalUserPhotoStored: false,
  rawPhotoStored: false,
  externalUploadPerformed: false,
  faceRecognitionPerformed: false,
  sensitiveAttributeInferencePerformed: false,
  photoInEvidence: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
};

export const phase379ModelBoundary = {
  generatedConceptAssetIntegrated: existsSync(resolve(yiyiAssetPath)),
  real3DModelLoaded: false,
  pseudo3DPrototype: true,
  gltfIntegrationReserved: true,
};

export const screenshotPaths = {
  characterCard: "apps/ai-gateway-service/evidence/phase379f/screenshots/yiyi-character-card.png",
  conceptPreview: "apps/ai-gateway-service/evidence/phase379f/screenshots/yiyi-concept-preview.png",
  avatarWithConceptStyle: "apps/ai-gateway-service/evidence/phase379f/screenshots/yiyi-avatar-with-concept-style.png",
  settingsAvatarReference: "apps/ai-gateway-service/evidence/phase379f/screenshots/yiyi-settings-avatar-reference.png",
  visualBoundaryCopy: "apps/ai-gateway-service/evidence/phase379f/screenshots/yiyi-visual-boundary-copy.png",
  phase379dConceptPreview: "apps/ai-gateway-service/evidence/phase379d/screenshots/yiyi-concept-preview.png",
};

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export async function hashFile(relativePath) {
  const buffer = await readFile(resolve(relativePath));
  return createHash("sha256").update(buffer).digest("hex");
}

export function fileSize(relativePath) {
  return statSync(resolve(relativePath)).size;
}

export async function readPhase379Source() {
  return [
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
    "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
    "apps/ai-gateway-service/src/ui/components/YiyiEmotionPanel.js",
    yiyiCopyPath,
  ].map((path) => readText(path)).reduce(async (acc, item) => `${await acc}\n${await item}`, "");
}

export async function writeReportAndResult({ reportPath, reportLines, resultPath, result }) {
  if (reportPath) await writeText(reportPath, reportLines.join("\n"));
  await writeJson(resultPath, result);
}

export async function writeMarkdown(relativePath, lines) {
  await writeText(relativePath, lines.join("\n"));
}

export async function writeJsonFile(relativePath, value) {
  await writeJson(relativePath, value);
}

export async function readJsonFile(relativePath) {
  return readJson(relativePath);
}

export async function ensureDirFor(relativePath) {
  await mkdir(dirname(resolve(relativePath)), { recursive: true });
}

export async function writeTextFile(relativePath, value) {
  await mkdir(dirname(resolve(relativePath)), { recursive: true });
  await writeFile(resolve(relativePath), value, "utf8");
}

export async function fetchUi(url) {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, text: await response.text(), error: null };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: error.message };
  }
}

export async function capturePhase379Screenshot(url, outputPath, viewport = "1600,2600") {
  return captureScreenshot({ url, outputPath, viewport });
}

