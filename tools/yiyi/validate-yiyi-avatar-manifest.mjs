import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const manifestPath = "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json";
const resultPath = "apps/ai-gateway-service/evidence/yiyi-real-3d-avatar-pipeline/yiyi-avatar-manifest-result.json";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function hasRealModelAsset() {
  return [
    "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm",
    "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.glb",
    "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.gltf",
  ].some((file) => existsSync(resolve(file)));
}

async function main() {
  const raw = await readFile(resolve(manifestPath), "utf8");
  const manifest = JSON.parse(raw);
  const modelExists = hasRealModelAsset();
  const serialized = JSON.stringify(manifest);
  const result = {
    task: "Yiyi-Real-3D-Avatar-Pipeline-A",
    check: "avatar_manifest",
    completed: true,
    manifestJsonParsed: true,
    characterId: manifest.characterId,
    displayName: manifest.displayName,
    assetType: manifest.assetType,
    preferredFormat: manifest.preferredFormat,
    realModelAssetExists: modelExists,
    real3DModelLoaded: manifest.real3DModelLoaded === true,
    rawPhotoStored: manifest.safetyBoundary?.rawPhotoStored === true,
    faceRecognitionPerformed: manifest.safetyBoundary?.faceRecognitionPerformed === true,
    providerCallsMade: manifest.safetyBoundary?.providerCallsMade === true,
    secretValueExposed: manifest.safetyBoundary?.secretValueExposed === true,
    deployExecuted: manifest.safetyBoundary?.deployExecuted === true,
    secretFieldDetected: /api[_-]?key|token|credentialValue|privateKey/i.test(serialized),
    secretValuePatternDetected: /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,})\b/i.test(serialized),
    cssSvgPseudo3DIsPrimaryAvatar: manifest.fallbackBehavior?.cssSvgPseudo3DIsPrimaryAvatar === true,
    production3DClaimedWithoutModel: manifest.real3DModelLoaded === true && !modelExists,
    recommended_sealed: true,
    blocker: null,
  };

  ensure(result.characterId === "yiyi", "characterId must be yiyi.");
  ensure(result.assetType === "vrm_or_glb", "assetType must be vrm_or_glb.");
  ensure(result.preferredFormat === "vrm", "preferredFormat must be vrm.");
  ensure(result.rawPhotoStored === false, "raw user photo must not be stored.");
  ensure(result.faceRecognitionPerformed === false, "face recognition must not be performed.");
  ensure(result.providerCallsMade === false, "provider calls must not be made.");
  ensure(result.secretValueExposed === false, "secret values must not be exposed.");
  ensure(result.deployExecuted === false, "deploy must not be executed.");
  ensure(result.secretFieldDetected === false, "manifest must not contain credential-bearing fields.");
  ensure(result.secretValuePatternDetected === false, "manifest must not contain secret-like values.");
  ensure(result.cssSvgPseudo3DIsPrimaryAvatar === false, "CSS/SVG pseudo 3D must not be primary avatar.");
  ensure(result.production3DClaimedWithoutModel === false, "real3DModelLoaded cannot be true without a real model asset.");

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
