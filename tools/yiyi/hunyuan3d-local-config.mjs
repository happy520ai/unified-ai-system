import { resolve } from "node:path";

export const taskName = "Yiyi-Local-Hunyuan3D-Setup-B";

export const defaultConfig = {
  engine: "hunyuan3d",
  engineName: "Hunyuan3D-2.1",
  repositoryUrl: "https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1.git",
  sourceDir: ".tool-external/hunyuan3d-2.1",
  venvDir: ".tool-external/hunyuan3d-2.1/.venv",
  generatedDir: "apps/ai-gateway-service/src/ui/assets/yiyi/generated",
  modelDir: "apps/ai-gateway-service/src/ui/assets/yiyi/model",
  resultDir: "apps/ai-gateway-service/evidence/yiyi-local-hunyuan3d-setup",
  minShapeVramGb: 10,
  minTextureVramGb: 21,
  minFullPipelineVramGb: 29,
  preferredPythonMajorMinor: "3.10",
  acceptedPythonMajorMinors: ["3.10", "3.11"],
  installMode: "preflight_first",
  workbenchRuntimeGeneration: false,
  sidecarToolingOnly: true,
  safety: {
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    cloudPhotoTo3DCalled: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    sensitiveAttributeInferencePerformed: false,
    secretValueExposed: false,
    deployExecuted: false,
    workspaceCleanClaimed: false,
  },
};

export function abs(path) {
  return resolve(path);
}

export function commandToString(command) {
  return command.filter(Boolean).join(" ");
}
