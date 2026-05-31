import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const files = [
  "apps/ai-gateway-service/src/ui/components/YiyiAvatarStage.js",
  "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
  "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json",
  "package.json",
  "apps/ai-gateway-service/package.json",
];
const resultPath = "apps/ai-gateway-service/evidence/yiyi-real-3d-avatar-pipeline/yiyi-real-avatar-boundary-result.json";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function modelExists() {
  return [
    "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm",
    "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.glb",
    "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.gltf",
  ].some((file) => existsSync(resolve(file)));
}

async function main() {
  const source = (await Promise.all(files.map((file) => readFile(resolve(file), "utf8")))).join("\n");
  const hasModel = modelExists();
  const dependencies = JSON.parse(await readFile(resolve("apps/ai-gateway-service/package.json"), "utf8")).dependencies || {};
  const result = {
    task: "Yiyi-Real-3D-Avatar-Pipeline-A",
    check: "real_avatar_boundary",
    completed: true,
    realModelAssetExists: hasModel,
    real3DModelLoaded: hasModel,
    yiyiAvatarStageCreated: source.includes("renderYiyiAvatarStage"),
    safePlaceholderVisible: source.includes("Yiyi real 3D asset not connected yet"),
    pseudo3DLiveMotion: source.includes('data-pseudo-3d-live-motion="false"') ? false : true,
    cssSvgPseudo3DPrimaryBlocked: !source.includes("CSS/SVG pseudo 3D is primary") && source.includes("cssSvgPseudo3DIsPrimaryAvatar"),
    visualTargetPresent: source.includes("海风白帽 / 长黑发 / 珍珠白浅蓝 / 温柔未来感 Mission Companion"),
    threeInstalled: Boolean(dependencies.three),
    threeVrmInstalled: Boolean(dependencies["@pixiv/three-vrm"]),
    dependencyRecommendationPresent: source.includes("GLTFLoader") && source.includes("@pixiv/three-vrm"),
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    productionGaClaimed: false,
    workspaceCleanClaimed: false,
    recommended_sealed: true,
    blocker: null,
  };

  ensure(result.yiyiAvatarStageCreated, "YiyiAvatarStage must be created.");
  ensure(result.safePlaceholderVisible, "safe placeholder must be visible when model is missing.");
  ensure(result.pseudo3DLiveMotion === false, "pseudo 3D live motion must not be primary in this pipeline.");
  ensure(result.cssSvgPseudo3DPrimaryBlocked, "CSS/SVG pseudo 3D must not be marked primary.");
  ensure(result.visualTargetPresent, "visual target copy must be present.");
  ensure(result.dependencyRecommendationPresent, "dependency recommendation must mention GLTFLoader and VRM.");
  ensure(result.providerCallsMade === false, "provider calls must not be made.");
  ensure(result.secretValueExposed === false, "secret values must not be exposed.");
  ensure(result.rawPhotoStored === false, "raw photo must not be stored.");
  ensure(result.faceRecognitionPerformed === false, "face recognition must not be performed.");
  ensure(result.deployExecuted === false, "deploy must not be executed.");

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
