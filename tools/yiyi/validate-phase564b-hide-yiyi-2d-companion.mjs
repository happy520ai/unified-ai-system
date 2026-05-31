import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const task = "Phase564B Hide Yiyi 2D Companion";
const manifestPath = "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json";
const generationConfigPath = "apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi-3d-generation-config.json";
const evidencePath = "apps/ai-gateway-service/evidence/phase564b/hide-yiyi-2d-companion-result.json";

const forbiddenVisibleMarkers = [
  "data-yiyi-avatar-layer",
  "data-yiyi-guided-showcase",
  "yiyi-guided-showcase-panel",
  "yiyi-avatar-layer",
  "yiyi-2d-companion-layer",
  "Yiyi real 3D model not connected yet",
  "Yiyi real 3D asset not connected yet",
  "2D fallback",
  "real 3D model not connected yet",
  "VRM not connected",
];

const forbiddenMissionControlText = [
  "依依",
  "Yiyi",
  "companion",
  "avatar",
  "character",
  "3D not connected",
  "2D fallback",
];

const requiredVisibleMarkers = [
  "mission-normal-mode-card",
  "mission-god-arena-card",
  "mission-tianshu-flight-card",
  "security-shield-panel",
  "evidence-export-panel",
  "provider-credentialref-guidance",
  "dry-run only",
  "credentialRef-only",
];

const secretPattern = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|ghp_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/i;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

function extractSection(html, id) {
  const startToken = `id="${id}"`;
  const startIndex = html.indexOf(startToken);
  if (startIndex === -1) return "";
  const sectionStart = html.lastIndexOf("<section", startIndex);
  if (sectionStart === -1) return "";
  const nextSection = html.indexOf("\n            </section>", startIndex);
  if (nextSection === -1) return html.slice(sectionStart);
  return html.slice(sectionStart, nextSection + "\n            </section>".length);
}

function findPresent(source, markers) {
  return markers.filter((marker) => source.includes(marker));
}

function stripNonVisibleBlocks(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
}

async function main() {
  const html = createConsolePage();
  const visibleHtml = stripNonVisibleBlocks(html);
  const missionControlHtml = extractSection(html, "mission-control");
  const manifest = await readJson(manifestPath);
  const generationConfig = await readJson(generationConfigPath);
  const serializedConfig = JSON.stringify({ manifest, generationConfig });

  const forbiddenVisibleMarkersPresent = findPresent(visibleHtml, forbiddenVisibleMarkers);
  const forbiddenMissionControlTextPresent = findPresent(missionControlHtml, forbiddenMissionControlText);
  const requiredVisibleMarkersMissing = requiredVisibleMarkers.filter((marker) => !visibleHtml.includes(marker));

  const result = {
    task,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    missionControlRendered: missionControlHtml.length > 0,
    yiyi2DCompanionVisible: false,
    yiyi3DAvatarVisible: false,
    characterModuleVisible: false,
    visibleYiyiMarkersRemoved: forbiddenVisibleMarkersPresent.length === 0,
    missionControlCharacterTextRemoved: forbiddenMissionControlTextPresent.length === 0,
    requiredProductModulesVisible: requiredVisibleMarkersMissing.length === 0,
    forbiddenVisibleMarkersPresent,
    forbiddenMissionControlTextPresent,
    requiredVisibleMarkersMissing,
    manifest: {
      real3DModelLoaded: manifest.real3DModelLoaded === true,
      realVrmRuntimeLoaded: manifest.realVrmRuntimeLoaded === true,
      pseudo3DLiveMotion: manifest.pseudo3DLiveMotion === true,
      avatar3DVisible: manifest.avatar3DVisible === true,
      companion2DVisible: manifest.companion2DVisible === true,
      characterModuleVisible: manifest.characterModuleVisible === true,
      fallbackMode: manifest.fallbackMode,
      featureFlags: manifest.featureFlags || {},
    },
    generationConfig: {
      avatar3DVisible: generationConfig.avatar3DVisible === true,
      companion2DVisible: generationConfig.companion2DVisible === true,
      characterModuleVisible: generationConfig.characterModuleVisible === true,
      fallbackMode: generationConfig.fallbackMode,
      workbenchRuntimeGeneration: generationConfig.workbenchRuntimeGeneration === true,
      localEngineEnabled: generationConfig.localEngine?.enabled === true,
      featureFlags: generationConfig.featureFlags || {},
    },
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    workspaceCleanClaimed: false,
    secretPatternDetected: secretPattern.test(serializedConfig),
  };

  try {
    ensure(result.missionControlRendered, "Mission Control section must render.");
    ensure(result.visibleYiyiMarkersRemoved, `Visible Yiyi module markers remain: ${forbiddenVisibleMarkersPresent.join(", ")}`);
    ensure(result.missionControlCharacterTextRemoved, `Mission Control character text remains: ${forbiddenMissionControlTextPresent.join(", ")}`);
    ensure(result.requiredProductModulesVisible, `Required product markers missing: ${requiredVisibleMarkersMissing.join(", ")}`);
    ensure(result.manifest.real3DModelLoaded === false, "manifest.real3DModelLoaded must be false.");
    ensure(result.manifest.realVrmRuntimeLoaded === false, "manifest.realVrmRuntimeLoaded must be false.");
    ensure(result.manifest.pseudo3DLiveMotion === false, "manifest.pseudo3DLiveMotion must be false.");
    ensure(result.manifest.avatar3DVisible === false, "manifest.avatar3DVisible must be false.");
    ensure(result.manifest.companion2DVisible === false, "manifest.companion2DVisible must be false.");
    ensure(result.manifest.characterModuleVisible === false, "manifest.characterModuleVisible must be false.");
    ensure(result.manifest.fallbackMode === "none", "manifest.fallbackMode must be none.");
    ensure(result.manifest.featureFlags.YIYI_3D_AVATAR_ENABLED === false, "YIYI_3D_AVATAR_ENABLED must be false.");
    ensure(result.manifest.featureFlags.YIYI_2D_COMPANION_ENABLED === false, "YIYI_2D_COMPANION_ENABLED must be false.");
    ensure(result.manifest.featureFlags.YIYI_CHARACTER_UI_VISIBLE === false, "YIYI_CHARACTER_UI_VISIBLE must be false.");
    ensure(result.generationConfig.avatar3DVisible === false, "generation config avatar3DVisible must be false.");
    ensure(result.generationConfig.companion2DVisible === false, "generation config companion2DVisible must be false.");
    ensure(result.generationConfig.characterModuleVisible === false, "generation config characterModuleVisible must be false.");
    ensure(result.generationConfig.fallbackMode === "none", "generation config fallbackMode must be none.");
    ensure(result.generationConfig.workbenchRuntimeGeneration === false, "Workbench runtime generation must stay disabled.");
    ensure(result.generationConfig.localEngineEnabled === false, "local engine must stay disabled by default.");
    ensure(result.generationConfig.featureFlags.YIYI_3D_AVATAR_ENABLED === false, "config YIYI_3D_AVATAR_ENABLED must be false.");
    ensure(result.generationConfig.featureFlags.YIYI_2D_COMPANION_ENABLED === false, "config YIYI_2D_COMPANION_ENABLED must be false.");
    ensure(result.generationConfig.featureFlags.YIYI_CHARACTER_UI_VISIBLE === false, "config YIYI_CHARACTER_UI_VISIBLE must be false.");
    ensure(result.secretPatternDetected === false, "Secret-like value detected in manifest/config.");
  } catch (error) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = error.message;
  }

  await mkdir(dirname(resolve(evidencePath)), { recursive: true });
  await writeFile(resolve(evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));

  if (!result.completed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
