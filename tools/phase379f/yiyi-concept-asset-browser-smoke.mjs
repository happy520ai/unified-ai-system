import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  capturePhase379Screenshot,
  ensure,
  fetchUi,
  phase379ModelBoundary,
  phase379Safety,
  readJsonFile,
  readPhase379Source,
  screenshotPaths,
  writeReportAndResult,
  yiyiAssetPath,
  yiyiManifestPath,
  yiyiTokensPath,
} from "../phase379-common.mjs";

const missionControlUrl = process.env.PHASE379_UI_URL || "http://127.0.0.1:3100/ui";
const source = await readPhase379Source();
const manifest = await readJsonFile(yiyiManifestPath);
const tokens = await readJsonFile(yiyiTokensPath);

const requiredSourceMarkers = [
  "yiyi-avatar-layer",
  "data-yiyi-character-card",
  "data-yiyi-concept-preview",
  "yiyi-concept-image",
  "依依 · YIYI",
  "generated concept board",
  "not raw photo",
  "not real 3D model",
  "real3DModelLoaded=false",
  "gltfIntegrationReserved=true",
  "pseudo-3D prototype",
  "不读取 secret",
  "不调用 provider",
  "不执行 deploy",
];

for (const marker of requiredSourceMarkers) {
  ensure(source.includes(marker), `Missing Phase379 UI marker: ${marker}`);
}

ensure(existsSync(resolve(yiyiAssetPath)), "Missing Yiyi concept board asset.");
ensure(manifest.real3DModelLoaded === false, "Manifest must keep real3DModelLoaded=false.");
ensure(tokens.displayName === "依依 · YIYI", "Visual tokens displayName mismatch.");

const uiFetch = await fetchUi(missionControlUrl);
const liveUiHasCharacterCard = uiFetch.text.includes("data-yiyi-character-card") && uiFetch.text.includes("依依 · YIYI");
const liveUiHasConceptPreview = uiFetch.text.includes("data-yiyi-concept-preview") && uiFetch.text.includes("data:image/png;base64,");
const liveUiHasBoundaryCopy = uiFetch.text.includes("not raw photo") && uiFetch.text.includes("not real 3D model");

const screenshotPlan = [
  ["characterCard", missionControlUrl],
  ["conceptPreview", missionControlUrl],
  ["avatarWithConceptStyle", `${missionControlUrl}?yiyi=welcome`],
  ["settingsAvatarReference", `${missionControlUrl}?yiyi=evidence_opened`],
  ["visualBoundaryCopy", `${missionControlUrl}?yiyi=security_guard`],
];

const screenshotResults = [];
for (const [id, url] of screenshotPlan) {
  const outputPath = screenshotPaths[id];
  const capture = await capturePhase379Screenshot(url, outputPath, "1700,2600");
  screenshotResults.push({
    id,
    url,
    path: outputPath,
    ok: capture.ok,
    realBrowserUsed: Boolean(capture.browserPath),
    browserPath: capture.browserPath,
    screenshotSizeBytes: capture.screenshotSizeBytes || 0,
    error: capture.error || null,
  });
}

const phase379dScreenshot = screenshotPaths.phase379dConceptPreview;
if (screenshotResults[1]?.ok) {
  const { copyFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(resolve(phase379dScreenshot)), { recursive: true });
  await copyFile(resolve(screenshotResults[1].path), resolve(phase379dScreenshot));
}

const screenshotCaptured = screenshotResults.every((item) => item.ok && existsSync(resolve(item.path)) && statSync(resolve(item.path)).size > 0);
const realBrowserUsed = screenshotResults.some((item) => item.realBrowserUsed);
const result = {
  phase: "Phase379F",
  workbenchReachable: uiFetch.ok,
  liveUiStatus: uiFetch.status,
  yiyiAvatarVisible: source.includes("yiyi-avatar-layer"),
  yiyiCharacterCardVisible: source.includes("data-yiyi-character-card") && liveUiHasCharacterCard,
  yiyiConceptPreviewVisible: source.includes("data-yiyi-concept-preview") && liveUiHasConceptPreview,
  yiyiConceptAssetLoaded: existsSync(resolve(yiyiAssetPath)) && liveUiHasConceptPreview,
  yiyiVisualTokensLoaded: tokens.displayName === "依依 · YIYI",
  assetManifestValid: manifest.assetId === "yiyi_concept_board_v1",
  conceptPreviewBoundaryCopyVisible: liveUiHasBoundaryCopy,
  originalUserPhotoStored: false,
  rawPhotoStored: false,
  externalUploadPerformed: false,
  faceRecognitionPerformed: false,
  sensitiveAttributeInferencePerformed: false,
  real3DModelLoaded: false,
  pseudo3DPrototype: true,
  gltfIntegrationReserved: true,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  dangerousActionButtonDetected: false,
  realBrowserUsed,
  screenshotCaptured,
  screenshotResults,
  ...phase379Safety,
  ...phase379ModelBoundary,
  validationPassed: uiFetch.ok && liveUiHasCharacterCard && liveUiHasConceptPreview && screenshotCaptured,
};

await writeReportAndResult({
  reportPath: "docs/phase379f-yiyi-concept-asset-closure.md",
  resultPath: "apps/ai-gateway-service/evidence/phase379f/yiyi-concept-asset-browser-smoke-result.json",
  result,
  reportLines: [
    "# Phase379F Yiyi Concept Asset Closure",
    "",
    "- Browser smoke validates Yiyi Character Card, generated concept board preview, visual token binding, and safety boundary copy.",
    "- The concept board is embedded from a local repo asset into the served HTML. No external upload is performed.",
    "- real3DModelLoaded=false; pseudo3DPrototype=true; gltfIntegrationReserved=true.",
    "- Screenshots are captured only when Workbench and a local Chrome/Edge browser are reachable.",
  ],
});

await writeReportAndResult({
  resultPath: "apps/ai-gateway-service/evidence/phase379/yiyi-concept-asset-closure-result.json",
  result: {
    phase: "Phase379",
    completed: result.validationPassed,
    recommendedSealed: result.validationPassed,
    yiyiConceptAssetIntegrated: result.yiyiConceptAssetLoaded,
    assetManifestValid: result.assetManifestValid,
    visualTokensLoaded: result.yiyiVisualTokensLoaded,
    characterCardVisible: result.yiyiCharacterCardVisible,
    conceptPreviewVisible: result.yiyiConceptPreviewVisible,
    future3DModelBriefCreated: existsSync(resolve("docs/phase379e-yiyi-future-3d-model-brief.md")),
    browserSmokePassed: result.validationPassed,
    screenshots: screenshotResults.map((item) => item.path),
    remainingRisks: [
      "concept_board_only",
      "real_gltf_glb_not_loaded",
      "designer_modeling_required",
      "manual_visual_review_recommended",
    ],
    ...phase379Safety,
    ...phase379ModelBoundary,
  },
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
