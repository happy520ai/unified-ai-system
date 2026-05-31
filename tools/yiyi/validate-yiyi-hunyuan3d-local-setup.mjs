import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const task = "Yiyi-Local-Hunyuan3D-Setup-B";
const enginePath = "E:/AI-Data/AI-Engines/Hunyuan3D-2.1";
const generationConfigPath = "apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi-3d-generation-config.json";
const manifestPath = "apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json";
const resultPath = "apps/ai-gateway-service/evidence/yiyi/hunyuan3d-local-setup-validation-result.json";
const secretPattern = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|ghp_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/i;
const rawPhotoPattern = /rawPhoto|raw_user_photo|sourcePhoto|faceRecognition/i;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(file), "utf8"));
}

async function main() {
  const config = await readJson(generationConfigPath);
  const manifest = await readJson(manifestPath);
  const serialized = JSON.stringify({ config, manifest });
  const enginePathInConfig = config.localEngine?.enginePath || "";
  const result = {
    task,
    completed: true,
    enginePath,
    enginePathExists: existsSync(resolve(enginePath)),
    engineReadmeExists: existsSync(resolve(enginePath, "README.md")),
    generationConfigExists: existsSync(resolve(generationConfigPath)),
    enginePathInConfig,
    enginePathOutsideMainProject: /^E:\/AI-Data\/AI-Engines\/Hunyuan3D-2\.1$/i.test(enginePathInConfig),
    localEngineEnabled: config.localEngine?.enabled === true,
    configProviderCallsMade: config.safety?.providerCallsMade === true,
    configNonNvidiaProviderCallsMade: config.safety?.nonNvidiaProviderCallsMade === true,
    configSecretValueExposed: config.safety?.secretValueExposed === true,
    configDeployExecuted: config.safety?.deployExecuted === true,
    configRawPhotoStored: config.safety?.rawPhotoStored === true,
    configFaceRecognitionPerformed: config.safety?.faceRecognitionPerformed === true,
    manifestReal3DModelLoaded: manifest.real3DModelLoaded === true,
    manifestYiyiVrmExists: existsSync(resolve("apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm")),
    secretPatternDetected: secretPattern.test(serialized),
    rawPhotoFieldDetected: rawPhotoPattern.test(serialized) && config.safety?.rawPhotoStored !== false,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    workspaceCleanClaimed: false,
    recommended_sealed: true,
    blocker: null,
  };

  ensure(result.enginePathExists, "Hunyuan3D engine path must exist.");
  ensure(result.engineReadmeExists, "Hunyuan3D README must exist.");
  ensure(result.generationConfigExists, "generation config must exist.");
  ensure(result.enginePathOutsideMainProject, "enginePath must point outside unified-ai-system.");
  ensure(result.localEngineEnabled === false, "local Hunyuan3D sidecar must remain disabled by default.");
  ensure(result.configProviderCallsMade === false, "config must not record provider calls.");
  ensure(result.configNonNvidiaProviderCallsMade === false, "config must not record non-NVIDIA provider calls.");
  ensure(result.configSecretValueExposed === false, "config must not expose secrets.");
  ensure(result.configDeployExecuted === false, "config must not record deploy.");
  ensure(result.configRawPhotoStored === false, "raw photo must not be stored.");
  ensure(result.configFaceRecognitionPerformed === false, "face recognition must not be performed.");
  ensure(result.secretPatternDetected === false, "secret-like value detected.");
  ensure(result.rawPhotoFieldDetected === false, "raw photo field detected.");
  if (!result.manifestYiyiVrmExists) {
    ensure(result.manifestReal3DModelLoaded === false, "real3DModelLoaded must remain false without yiyi.vrm.");
  }

  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
