import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const layeredAssetDir = resolve(currentDir, "../../assets/yiyi/layered");

function svgDataUrl(fileName) {
  const path = resolve(layeredAssetDir, fileName);
  if (!existsSync(path)) return "";
  const svg = readFileSync(path, "utf8");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export const yiyiAvatarAssetManifest = {
  currentAvatarMode: "disabled_experimental_3d",
  real3DModelLoaded: false,
  realVrmRuntimeLoaded: false,
  pseudo3DLiveMotion: false,
  avatar3DVisible: false,
  layeredAvatarEnabled: false,
  yiyi3DAvatarEnabled: false,
  futureModelFormats: ["glb", "gltf", "vrm"],
  futureModelFormat: "glb_or_vrm",
  futureLoader: "threejs_or_react_three_fiber",
  fallbackMode: "2d_companion_card",
  palette: {
    pearlWhite: "#FFFFFF",
    mistWhite: "#E6F2FF",
    seaBlue: "#AEE2FF",
    silverGray: "#C7D2E3",
    blackHair: "#101827",
    strawWhite: "#FFFDF4",
  },
  visualClaims: {
    snowmanLike: false,
    blackBlobFace: false,
    backViewOnly: false,
    oversizedHairBlock: false,
    roundSnowBody: false,
    hatLooksLikeHalo: false,
    longBlackHairVisible: true,
    whiteHatVisible: true,
    faceVisible: true,
    lightBlueOutfitVisible: true,
    slimmerSilhouette: true,
    seaBreezePaletteVisible: true,
    missionCompanionStyle: true,
  },
  assets: {
    aura: svgDataUrl("aura.svg"),
    hairBack: svgDataUrl("hair-back.svg"),
    hairLeft: svgDataUrl("hair-left.svg"),
    hairRight: svgDataUrl("hair-right.svg"),
    hat: svgDataUrl("hat.svg"),
    face: svgDataUrl("face.svg"),
    body: svgDataUrl("body.svg"),
    arms: svgDataUrl("arms.svg"),
    shield: svgDataUrl("shield.svg"),
    orbitDots: svgDataUrl("orbit-dots.svg"),
    pathGlow: svgDataUrl("path-glow.svg"),
    noteBoard: svgDataUrl("note-board.svg"),
  },
  sourceAssetFiles: {
    aura: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/aura.svg",
    hairBack: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/hair-back.svg",
    hairLeft: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/hair-left.svg",
    hairRight: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/hair-right.svg",
    hat: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/hat.svg",
    face: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/face.svg",
    body: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/body.svg",
    arms: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/arms.svg",
    shield: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/shield.svg",
    orbitDots: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/orbit-dots.svg",
    pathGlow: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/path-glow.svg",
    noteBoard: "apps/ai-gateway-service/src/ui/assets/yiyi/layered/note-board.svg",
  },
  safety: {
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    productionGaClaimed: false,
  },
};
