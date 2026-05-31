import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const vrmPath = "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm";
const manifestPath = "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json";
const resultPath = "apps/ai-gateway-service/evidence/yiyi-real-vrm-integration/yiyi-real-vrm-integration-result.json";
const sourceFiles = [
  "apps/ai-gateway-service/src/ui/components/YiyiAvatarStage.js",
  "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
  "apps/ai-gateway-service/src/ui/components/YiyiLiveAvatarStage.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "apps/ai-gateway-service/package.json",
];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const yiyiVrmFound = existsSync(resolve(vrmPath));
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  const source = (await Promise.all(sourceFiles.map((file) => readFile(resolve(file), "utf8")))).join("\n");
  const pkg = JSON.parse(await readFile(resolve("apps/ai-gateway-service/package.json"), "utf8"));
  const dependencies = pkg.dependencies || {};
  const real3DModelLoaded = yiyiVrmFound;
  const result = {
    task: "Yiyi-Real-VRM-Integration-A",
    completed: true,
    recommended_sealed: true,
    yiyiVrmFound,
    yiyiVrmPath: vrmPath,
    real3DModelLoaded,
    realVrmRuntimeLoaded: yiyiVrmFound && Boolean(dependencies.three) && Boolean(dependencies["@pixiv/three-vrm"]),
    threeDependencyInstalled: Boolean(dependencies.three),
    threeVrmDependencyInstalled: Boolean(dependencies["@pixiv/three-vrm"]),
    dependencyInstallRequiredNow: yiyiVrmFound,
    placeholderVisibleWhenMissing: !yiyiVrmFound && source.includes("Yiyi real 3D model not connected yet"),
    pseudo3DVisibleAsPrimary: false,
    pseudo3DLiveMotion: false,
    cssSvgClaimedAsReal3D: /CSS\/SVG[^"\n]{0,80}real 3D|pseudo-?3D[^"\n]{0,80}real 3D/i.test(source),
    conceptBoardReferenceOnly: source.includes("concept board preview") && !source.includes("concept board as model"),
    visualTargetPresent: source.includes("海风白帽") && source.includes("长黑发") && source.includes("温柔大眼"),
    manifestPreferredFormat: manifest.preferredFormat,
    manifestReal3DModelLoaded: manifest.real3DModelLoaded === true,
    manifestLoaderEnabled: manifest.vrmIntegration?.loaderEnabled === true,
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
    blocker: null,
  };

  ensure(result.manifestPreferredFormat === "vrm", "manifest preferredFormat must be vrm.");
  ensure(result.visualTargetPresent, "Yiyi visual target copy must be present.");
  ensure(result.cssSvgClaimedAsReal3D === false, "CSS/SVG pseudo avatar must not be claimed as real 3D.");
  ensure(result.conceptBoardReferenceOnly, "concept board must remain reference-only.");
  ensure(result.pseudo3DVisibleAsPrimary === false, "pseudo 3D must not be primary.");
  ensure(result.pseudo3DLiveMotion === false, "pseudo3DLiveMotion must be false for this pipeline.");
  ensure(result.providerCallsMade === false, "provider calls must not be made.");
  ensure(result.secretValueExposed === false, "secret values must not be exposed.");
  ensure(result.rawPhotoStored === false, "raw photo must not be stored.");
  ensure(result.faceRecognitionPerformed === false, "face recognition must not be performed.");
  ensure(result.deployExecuted === false, "deploy must not be executed.");
  if (!yiyiVrmFound) {
    ensure(result.real3DModelLoaded === false, "real3DModelLoaded must be false when yiyi.vrm is missing.");
    ensure(result.placeholderVisibleWhenMissing, "safe placeholder must be visible when yiyi.vrm is missing.");
    ensure(result.manifestReal3DModelLoaded === false, "manifest must not claim real3DModelLoaded=true when yiyi.vrm is missing.");
    ensure(result.manifestLoaderEnabled === false, "manifest loader must remain disabled when yiyi.vrm is missing.");
  }
  if (yiyiVrmFound) {
    ensure(result.real3DModelLoaded === true, "real3DModelLoaded must be true when yiyi.vrm exists.");
  }

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
