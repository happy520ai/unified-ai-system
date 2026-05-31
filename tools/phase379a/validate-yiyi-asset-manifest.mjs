import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ensure,
  fileSize,
  hashFile,
  phase379ModelBoundary,
  phase379Safety,
  readJsonFile,
  writeReportAndResult,
  yiyiAssetPath,
  yiyiManifestPath,
} from "../phase379-common.mjs";

const manifest = await readJsonFile(yiyiManifestPath);
ensure(existsSync(resolve(yiyiAssetPath)), "Missing yiyi concept board asset.");
ensure(manifest.assetId === "yiyi_concept_board_v1", "Invalid assetId.");
ensure(manifest.assetType === "generated_concept_board", "Invalid assetType.");
ensure(manifest.sourceType === "generated_visual_reference", "Invalid sourceType.");
ensure(manifest.file === "yiyi-concept-board.png", "Invalid asset file.");
ensure(manifest.originalUserPhotoStored === false, "originalUserPhotoStored must be false.");
ensure(manifest.rawPhotoStored === false, "rawPhotoStored must be false.");
ensure(manifest.externalUploadPerformed === false, "externalUploadPerformed must be false.");
ensure(manifest.faceRecognitionPerformed === false, "faceRecognitionPerformed must be false.");
ensure(manifest.sensitiveAttributeInferencePerformed === false, "sensitiveAttributeInferencePerformed must be false.");
ensure(manifest.real3DModelLoaded === false, "real3DModelLoaded must be false.");
ensure(manifest.isProduction3DModel === false, "isProduction3DModel must be false.");
ensure(manifest.isGltfOrGlb === false, "isGltfOrGlb must be false.");
ensure(manifest.binaryEmbeddedInJson === false, "binaryEmbeddedInJson must be false.");

const result = {
  phase: "Phase379A",
  yiyiConceptAssetExists: true,
  assetManifestValid: true,
  yiyiConceptAssetLoaded: true,
  fileSizeBytes: fileSize(yiyiAssetPath),
  sha256: await hashFile(yiyiAssetPath),
  manifest,
  ...phase379Safety,
  ...phase379ModelBoundary,
  validationPassed: true,
};

await writeReportAndResult({
  reportPath: "docs/phase379a-yiyi-visual-asset-manifest.md",
  resultPath: "apps/ai-gateway-service/evidence/phase379a/yiyi-asset-manifest-result.json",
  result,
  reportLines: [
    "# Phase379A Yiyi Visual Asset Manifest",
    "",
    "- Created/validated Yiyi visual asset manifest.",
    "- Asset is a generated concept board visual reference.",
    "- It is not a raw user photo, not a glTF/GLB file, and not a production 3D model.",
    "- Safety boundary: rawPhotoStored=false, externalUploadPerformed=false, faceRecognitionPerformed=false, providerCallsMade=false.",
  ],
});

console.log(JSON.stringify(result, null, 2));

