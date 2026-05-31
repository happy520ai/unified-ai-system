import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const generatedDir = "apps/ai-gateway-service/src/ui/assets/yiyi/generated";
const modelDir = "apps/ai-gateway-service/src/ui/assets/yiyi/model";
const manifestPath = `${modelDir}/yiyi-avatar-manifest.json`;
const generationConfigPath = "apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi-3d-generation-config.json";
const resultPath = "apps/ai-gateway-service/evidence/yiyi-local-3d-generation/yiyi-3d-candidate-validation-result.json";

const allowedCandidateExtensions = new Set([".glb", ".gltf", ".obj", ".fbx", ".vrm"]);
const allowedNonCandidateFiles = new Set([".gitkeep"]);
const rawPhotoNamePattern = /(^|[-_.\s])(raw|source|user|face|photo|portrait|selfie)([-_.\s]|$)/i;
const secretValuePattern = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|ghp_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/i;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function listFilesRecursive(root) {
  if (!existsSync(resolve(root))) return [];
  const entries = await readdir(resolve(root), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(child));
    } else {
      files.push(child);
    }
  }
  return files;
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(file), "utf8"));
}

function hasRealYiyiModel() {
  return [
    `${modelDir}/yiyi.vrm`,
    `${modelDir}/yiyi.glb`,
    `${modelDir}/yiyi.gltf`,
  ].some((file) => existsSync(resolve(file)));
}

function isCandidateFile(file) {
  return allowedCandidateExtensions.has(extname(file).toLowerCase());
}

async function main() {
  const generatedDirExists = existsSync(resolve(generatedDir));
  const manifest = await readJson(manifestPath);
  const generationConfig = await readJson(generationConfigPath);
  const generatedFiles = await listFilesRecursive(generatedDir);
  const candidateFiles = generatedFiles.filter(isCandidateFile);
  const disallowedGeneratedFiles = generatedFiles.filter((file) => {
    const name = file.split(/[\\/]/).pop();
    if (allowedNonCandidateFiles.has(name)) return false;
    return !isCandidateFile(file);
  });
  const rawPhotoOutputs = generatedFiles.filter((file) => rawPhotoNamePattern.test(file));
  const serialized = JSON.stringify({ manifest, generationConfig });
  const realModelExists = hasRealYiyiModel();
  const conceptBoardRefs = [manifest.conceptBoardRef, generationConfig.conceptBoardRef].filter(Boolean);
  const conceptBoardTreatedAsModel = conceptBoardRefs.some((ref) => {
    const normalized = String(ref).toLowerCase();
    return [".vrm", ".glb", ".gltf", ".obj", ".fbx"].some((extension) => normalized.endsWith(extension));
  });
  const cssSvgPseudo3DProductionClaimed =
    manifest.fallbackBehavior?.cssSvgPseudo3DIsPrimaryAvatar === true ||
    manifest.currentAvatarMode === "css_svg_production_avatar" ||
    manifest.currentAvatarMode === "layered_2_5d_production";

  const result = {
    task: "Yiyi-Local-3D-Generation-Engine-A",
    check: "yiyi_3d_candidate",
    completed: true,
    generatedDirExists,
    generatedDir,
    generatedFiles,
    candidateFiles,
    allowedCandidateExtensions: [...allowedCandidateExtensions],
    disallowedGeneratedFiles,
    rawPhotoOutputs,
    manifestJsonParsed: true,
    generationConfigJsonParsed: true,
    generationPipelineEnabled: manifest.generationPipelineEnabled === true,
    currentAvatarMode: manifest.currentAvatarMode,
    realModelExists,
    yiyiVrmFound: existsSync(resolve(`${modelDir}/yiyi.vrm`)),
    real3DModelLoaded: manifest.real3DModelLoaded === true,
    realVrmRuntimeLoaded: manifest.realVrmRuntimeLoaded === true,
    pseudo3DLiveMotion: manifest.pseudo3DLiveMotion === true,
    conceptBoardTreatedAsModel,
    cssSvgPseudo3DProductionClaimed,
    providerCallsMade: manifest.safetyBoundary?.providerCallsMade === true || generationConfig.safety?.providerCallsMade === true,
    nonNvidiaProviderCallsMade: manifest.safetyBoundary?.nonNvidiaProviderCallsMade === true || generationConfig.safety?.nonNvidiaProviderCallsMade === true,
    secretValueExposed: manifest.safetyBoundary?.secretValueExposed === true || generationConfig.safety?.secretValueExposed === true,
    rawPhotoStored: manifest.safetyBoundary?.rawPhotoStored === true || generationConfig.safety?.rawPhotoStored === true,
    faceRecognitionPerformed: manifest.safetyBoundary?.faceRecognitionPerformed === true || generationConfig.safety?.faceRecognitionPerformed === true,
    deployExecuted: manifest.safetyBoundary?.deployExecuted === true || generationConfig.safety?.deployExecuted === true,
    secretValuePatternDetected: secretValuePattern.test(serialized),
    recommended_sealed: true,
    blocker: null,
  };

  ensure(generatedDirExists, "generated directory must exist.");
  ensure(result.generationPipelineEnabled, "generationPipelineEnabled must be true.");
  ensure(disallowedGeneratedFiles.length === 0, "generated directory contains disallowed file types.");
  ensure(rawPhotoOutputs.length === 0, "generated directory must not contain raw/source/photo-like files.");
  ensure(result.providerCallsMade === false, "provider calls must not be recorded.");
  ensure(result.nonNvidiaProviderCallsMade === false, "non-NVIDIA provider calls must not be recorded.");
  ensure(result.secretValueExposed === false, "secret values must not be exposed.");
  ensure(result.rawPhotoStored === false, "raw user photos must not be stored.");
  ensure(result.faceRecognitionPerformed === false, "face recognition must not be performed.");
  ensure(result.deployExecuted === false, "deploy must not be executed.");
  ensure(result.secretValuePatternDetected === false, "secret-like values must not appear in avatar generation config.");
  ensure(result.conceptBoardTreatedAsModel === false, "concept board must not be treated as a 3D model.");
  ensure(result.cssSvgPseudo3DProductionClaimed === false, "CSS/SVG pseudo 3D must not be marked as production avatar.");
  if (!realModelExists) {
    ensure(result.real3DModelLoaded === false, "real3DModelLoaded must be false without yiyi.vrm/yiyi.glb/yiyi.gltf.");
    ensure(result.realVrmRuntimeLoaded === false, "realVrmRuntimeLoaded must be false without yiyi.vrm.");
  }

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
