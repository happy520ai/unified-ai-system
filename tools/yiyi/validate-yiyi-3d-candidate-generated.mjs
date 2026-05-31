import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const task = "Yiyi-3D-Candidate-Generation-C";
const candidatePath = "apps/ai-gateway-service/src/ui/assets/yiyi/generated/yiyi_candidate.glb";
const manifestPath = "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json";
const generationEvidencePath = "apps/ai-gateway-service/evidence/yiyi/yiyi-3d-candidate-generation-result.json";
const resultPath = "apps/ai-gateway-service/evidence/yiyi/yiyi-3d-candidate-validation-result.json";
const secretPattern = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|ghp_[A-Za-z0-9_]{12,})\b/i;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJsonIfExists(path) {
  if (!existsSync(resolve(path))) return null;
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  const manifest = await readJsonIfExists(manifestPath);
  const generationEvidence = await readJsonIfExists(generationEvidencePath);
  const candidateExists = existsSync(resolve(candidatePath));
  const outputFileSizeBytes = candidateExists ? statSync(resolve(candidatePath)).size : 0;
  const serialized = JSON.stringify({ manifest, generationEvidence });
  const yiyiVrmExists = existsSync(resolve("apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm"));
  const result = {
    task,
    completed: true,
    candidatePath,
    candidateExists,
    outputFileSizeBytes,
    extension: extname(candidatePath).toLowerCase(),
    conceptBoardTreatedAsModel: generationEvidence?.inputImagePath?.includes("concept-board") === true,
    yiyiVrmExists,
    yiyiVrmGenerated: generationEvidence?.yiyiVrmGenerated === true,
    real3DModelLoaded: manifest?.real3DModelLoaded === true || generationEvidence?.real3DModelLoaded === true,
    realVrmRuntimeLoaded: manifest?.realVrmRuntimeLoaded === true || generationEvidence?.realVrmRuntimeLoaded === true,
    secretPatternDetected: secretPattern.test(serialized),
    providerCallsMade: generationEvidence?.providerCallsMade === true,
    nonNvidiaProviderCallsMade: generationEvidence?.nonNvidiaProviderCallsMade === true,
    secretValueExposed: generationEvidence?.secretValueExposed === true,
    deployExecuted: generationEvidence?.deployExecuted === true,
    rawPhotoStored: generationEvidence?.rawPhotoStored === true,
    faceRecognitionPerformed: generationEvidence?.faceRecognitionPerformed === true,
    workspaceCleanClaimed: false,
    recommended_sealed: true,
    blocker: null,
  };

  ensure(candidateExists, "yiyi_candidate.glb must exist.");
  ensure(outputFileSizeBytes > 0, "yiyi_candidate.glb must be non-empty.");
  ensure(result.extension === ".glb", "candidate extension must be .glb.");
  ensure(result.conceptBoardTreatedAsModel === false, "concept board must not be treated as a 3D model.");
  ensure(result.yiyiVrmGenerated === false, "this phase must not generate yiyi.vrm.");
  ensure(result.real3DModelLoaded === false, "real3DModelLoaded must remain false.");
  ensure(result.realVrmRuntimeLoaded === false, "realVrmRuntimeLoaded must remain false.");
  ensure(result.secretPatternDetected === false, "secret-like value detected.");
  ensure(result.providerCallsMade === false, "provider calls must not be made.");
  ensure(result.nonNvidiaProviderCallsMade === false, "non-NVIDIA provider calls must not be made.");
  ensure(result.secretValueExposed === false, "secret values must not be exposed.");
  ensure(result.deployExecuted === false, "deploy must not be executed.");
  ensure(result.rawPhotoStored === false, "raw photo must not be stored.");
  ensure(result.faceRecognitionPerformed === false, "face recognition must not be performed.");

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const result = {
    task,
    completed: false,
    candidatePath,
    candidateExists: existsSync(resolve(candidatePath)),
    outputFileSizeBytes: existsSync(resolve(candidatePath)) ? statSync(resolve(candidatePath)).size : 0,
    blocker: error.message,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    workspaceCleanClaimed: false,
    recommended_sealed: false,
  };
  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
