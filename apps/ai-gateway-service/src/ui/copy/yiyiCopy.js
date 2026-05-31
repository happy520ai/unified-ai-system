import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const yiyiAssetDir = resolve(currentDir, "../assets/yiyi");
const yiyiConceptBoardPath = resolve(yiyiAssetDir, "yiyi-concept-board.png");
const yiyiCharacterDir = resolve(yiyiAssetDir, "character");
const yiyiCharacterCanonPath = resolve(yiyiCharacterDir, "yiyi-character-canon.json");
const yiyiScenarioLinesPath = resolve(yiyiCharacterDir, "yiyi-scenario-lines.json");
const yiyiEmotionBehaviorCanonMapPath = resolve(yiyiCharacterDir, "yiyi-emotion-behavior-canon-map.json");

let cachedConceptBoardDataUrl = null;

export const yiyiVisualTokens = {
  avatarName: "依依",
  themeName: "sea_breeze_white_hat",
  displayName: "依依 · YIYI",
  role: "AI Mission Companion",
  version: "v1.0 海风白帽",
  palette: {
    pearlWhite: "#FFFFFF",
    mistWhite: "#E6F2FF",
    seaBlue: "#AEE2FF",
    silverGray: "#C7D2E3",
    softBlue: "#9ECDFF",
  },
  materials: [
    "soft_hat",
    "translucent_jacket",
    "light_orbit",
    "shield_glass",
    "mission_glow",
  ],
  motionStyle: [
    "soft_pulse",
    "gentle_orbit",
    "light_hover",
    "calm_attention",
  ],
  personalityKeywords: ["温柔", "灵动", "聪明", "可靠", "陪伴", "守护"],
  forbiddenStyle: [
    "over_neon",
    "heavy_cyberpunk",
    "overly_childish",
    "realistic_identity_claim",
  ],
};

export const yiyiAssetBoundary = {
  originalUserPhotoStored: false,
  rawPhotoStored: false,
  externalUploadPerformed: false,
  faceRecognitionPerformed: false,
  sensitiveAttributeInferencePerformed: false,
  photoInEvidence: false,
  generatedConceptAssetIntegrated: existsSync(yiyiConceptBoardPath),
  real3DModelLoaded: false,
  pseudo3DPrototype: true,
  gltfIntegrationReserved: true,
};

export const yiyiCharacterCardCopy = {
  title: "依依 · YIYI",
  subtitle: "AI Mission Companion",
  lead: "你的智能体陪伴伙伴",
  role: "可视化智能体伴生体",
  abilities: ["陪伴", "引导", "守护", "解释"],
  currentVersion: yiyiVisualTokens.version,
  currentImplementation: "pseudo-3D prototype",
  futureReserved: "real 3D model / glTF / animation clips",
  safetyBoundaries: [
    "不读取 secret",
    "不调用 provider",
    "不执行 deploy",
    "不修改 evidence",
    "不伪造 approval",
  ],
};

export const yiyiConceptPreviewCopy = {
  label: "generated concept board",
  alt: "Yiyi generated concept board visual reference, not a raw photo and not a real 3D model",
  assetFile: "apps/ai-gateway-service/src/ui/assets/yiyi/yiyi-concept-board.png",
  boundary: "visual reference only · not raw photo · not real 3D model",
  real3DModelLoaded: "real3DModelLoaded=false",
  gltfIntegrationReserved: "gltfIntegrationReserved=true",
};

export function getYiyiConceptBoardDataUrl() {
  if (cachedConceptBoardDataUrl !== null) return cachedConceptBoardDataUrl;
  if (!existsSync(yiyiConceptBoardPath)) {
    cachedConceptBoardDataUrl = "";
    return cachedConceptBoardDataUrl;
  }
  const image = readFileSync(yiyiConceptBoardPath);
  cachedConceptBoardDataUrl = `data:image/png;base64,${image.toString("base64")}`;
  return cachedConceptBoardDataUrl;
}

export function hasYiyiConceptBoardAsset() {
  return existsSync(yiyiConceptBoardPath);
}

function readJsonAsset(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function getYiyiCharacterCanon() {
  return readJsonAsset(yiyiCharacterCanonPath, null);
}

export function getYiyiScenarioLines() {
  return readJsonAsset(yiyiScenarioLinesPath, []);
}

export function getYiyiEmotionBehaviorCanonMap() {
  return readJsonAsset(yiyiEmotionBehaviorCanonMapPath, []);
}
