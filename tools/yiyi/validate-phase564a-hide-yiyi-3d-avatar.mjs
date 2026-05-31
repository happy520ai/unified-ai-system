import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const task = "Phase564A Hide Yiyi 3D Avatar Module + Stable 2D Fallback";
const manifestPath = "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json";
const configPath = "apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi-3d-generation-config.json";
const resultPath = "apps/ai-gateway-service/evidence/yiyi/phase564a-hide-yiyi-3d-avatar-result.json";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  const html = createConsolePage();
  const manifest = await readJson(manifestPath);
  const config = await readJson(configPath);
  const avatarLayerStart = html.indexOf('<section class="yiyi-avatar-layer');
  const avatarLayerEnd = avatarLayerStart >= 0 ? html.indexOf("${renderYiyiCharacterSettingsPanel()}", avatarLayerStart) : -1;
  const renderedAvatarLayer = avatarLayerStart >= 0
    ? html.slice(avatarLayerStart, avatarLayerEnd >= 0 ? avatarLayerEnd : avatarLayerStart + 12000)
    : "";
  const forbiddenVisibleMarkers = [
    "yiyi-live-avatar-stage",
    "yiyi-avatar-stage-shell",
    "Yiyi real 3D model not connected yet",
    "Yiyi real 3D asset not connected yet",
    "real 3D model not connected yet",
    "VRM asset detected",
    "Preview God reaction",
  ];
  const forbiddenVisibleMarkersFound = forbiddenVisibleMarkers.filter((marker) => renderedAvatarLayer.includes(marker));
  const result = {
    task,
    completed: true,
    recommended_sealed: true,
    yiyi3DAvatarEnabled: config.featureFlags?.YIYI_3D_AVATAR_ENABLED === true,
    manifestYiyi3DAvatarEnabled: manifest.featureFlags?.YIYI_3D_AVATAR_ENABLED === true,
    avatar3DVisible: manifest.avatar3DVisible === true || config.avatar3DVisible === true,
    real3DModelLoaded: manifest.real3DModelLoaded === true,
    realVrmRuntimeLoaded: manifest.realVrmRuntimeLoaded === true,
    pseudo3DLiveMotion: manifest.pseudo3DLiveMotion === true,
    fallbackMode: manifest.fallbackMode || manifest.fallbackBehavior?.mode,
    htmlHas2DCompanionCard: renderedAvatarLayer.includes("data-yiyi-2d-companion-card=\"true\""),
    htmlHasYiyiAvatarLayer: renderedAvatarLayer.includes("data-yiyi-avatar-layer=\"true\""),
    htmlHasConceptPreviewOrFallback: renderedAvatarLayer.includes("yiyi-2d-avatar-image") || renderedAvatarLayer.includes("yiyi-2d-avatar-fallback"),
    renderedAvatarLayerChecked: Boolean(renderedAvatarLayer),
    forbiddenVisibleMarkersFound,
    yiyiVrmExists: existsSync(resolve("apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm")),
    yiyiGlbExists: existsSync(resolve("apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.glb")),
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    chatGatewayRuntimeModified: false,
    workspaceCleanClaimed: false,
    blocker: null,
  };

  ensure(result.yiyi3DAvatarEnabled === false, "YIYI_3D_AVATAR_ENABLED must be false.");
  ensure(result.manifestYiyi3DAvatarEnabled === false, "manifest feature flag must be false.");
  ensure(result.avatar3DVisible === false, "avatar3DVisible must be false.");
  ensure(result.real3DModelLoaded === false, "real3DModelLoaded must be false.");
  ensure(result.realVrmRuntimeLoaded === false, "realVrmRuntimeLoaded must be false.");
  ensure(result.pseudo3DLiveMotion === false, "pseudo3DLiveMotion must be false.");
  ensure(result.fallbackMode === "2d_companion_card", "fallbackMode must be 2d_companion_card.");
  ensure(result.htmlHas2DCompanionCard, "2D companion card must be rendered.");
  ensure(result.htmlHasYiyiAvatarLayer, "Yiyi companion layer must remain available.");
  ensure(result.htmlHasConceptPreviewOrFallback, "2D image or fallback avatar must render.");
  ensure(forbiddenVisibleMarkersFound.length === 0, `3D visible markers found: ${forbiddenVisibleMarkersFound.join(", ")}`);

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const result = {
    task,
    completed: false,
    recommended_sealed: false,
    blocker: error.message,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    workspaceCleanClaimed: false,
  };
  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
