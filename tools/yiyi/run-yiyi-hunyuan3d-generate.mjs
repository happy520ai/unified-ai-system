import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { spawn } from "node:child_process";

const task = "Yiyi-3D-Candidate-Generation-C";
const enginePath = "E:/AI-Data/AI-Engines/Hunyuan3D-2.1";
const defaultInput = "apps/ai-gateway-service/src/ui/assets/yiyi/generation/yiyi_reference.png";
const defaultOutput = "apps/ai-gateway-service/src/ui/assets/yiyi/generated/yiyi_candidate.glb";
const evidencePath = "apps/ai-gateway-service/evidence/yiyi/yiyi-3d-candidate-generation-result.json";
const apiBaseUrl = "http://127.0.0.1:8081";

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function writeEvidence(result) {
  await mkdir(dirname(resolve(evidencePath)), { recursive: true });
  await writeFile(resolve(evidencePath), `${JSON.stringify(result, null, 2)}\n`);
}

function baseResult({ inputPath, outputPath, dryRun, textureRequested }) {
  return {
    task,
    completed: false,
    generationAttempted: false,
    dryRun,
    apiBaseUrl,
    apiServerHealth: false,
    apiServerStartedByScript: false,
    inputImagePath: inputPath,
    inputImageExists: existsSync(resolve(inputPath)),
    outputCandidatePath: outputPath,
    outputFileExists: existsSync(resolve(outputPath)),
    outputFileSizeBytes: existsSync(resolve(outputPath)) ? statSync(resolve(outputPath)).size : 0,
    textureRequested,
    seed: 20260508,
    octreeResolution: 256,
    numInferenceSteps: 5,
    guidanceScale: 5.0,
    numChunks: 8000,
    faceCount: 40000,
    generatedAt: new Date().toISOString(),
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    real3DModelLoaded: false,
    realVrmRuntimeLoaded: false,
    yiyiVrmGenerated: false,
    workbenchRuntimeEnabled: false,
    blocker: null,
  };
}

async function healthCheck() {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, { method: "GET" });
    return { ok: response.ok, status: response.status, body: await response.text() };
  } catch (error) {
    return { ok: false, status: null, error: error.message };
  }
}

async function waitForHealth(timeoutMs = 45000) {
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < timeoutMs) {
    last = await healthCheck();
    if (last.ok) return last;
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1500));
  }
  return last || { ok: false, error: "health_check_timeout" };
}

function startServer() {
  const python = process.env.YIYI_HUNYUAN3D_PYTHON || "python";
  return spawn(python, ["api_server.py"], {
    cwd: resolve(enginePath),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const serverOnly = hasFlag("--server-only");
  const noStartServer = hasFlag("--no-start-server");
  const textureRequested = hasFlag("--texture");
  const inputPath = getArg("--input", defaultInput);
  const outputPath = getArg("--output", defaultOutput);
  const result = baseResult({ inputPath, outputPath, dryRun, textureRequested });
  result.enginePath = enginePath;
  result.enginePathExists = existsSync(resolve(enginePath));

  await mkdir(dirname(resolve(outputPath)), { recursive: true });

  if (!result.enginePathExists) {
    result.blocker = "HUNYUAN3D_ENGINE_MISSING";
    await writeEvidence(result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  if (!result.inputImageExists) {
    result.blocker = "YIYI_REFERENCE_IMAGE_MISSING";
    await writeEvidence(result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  if (extname(inputPath).toLowerCase() !== ".png") {
    result.blocker = "YIYI_REFERENCE_IMAGE_MUST_BE_PNG";
    await writeEvidence(result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  const imageBytes = await readFile(resolve(inputPath));
  result.inputImageBytes = imageBytes.length;
  result.inputDataUrlPrefix = "data:image/png;base64,";

  let health = await healthCheck();
  if (!health.ok && !noStartServer) {
    if (dryRun) {
      result.apiServerStartPreview = {
        cwd: enginePath,
        command: "python api_server.py",
      };
    } else {
      const child = startServer();
      result.apiServerStartedByScript = true;
      result.apiServerPid = child.pid;
      health = await waitForHealth();
    }
  }
  result.apiServerHealth = Boolean(health.ok);
  result.apiServerHealthDetail = health;

  if (serverOnly || dryRun) {
    result.completed = true;
    result.generationAttempted = false;
    result.requestPreview = {
      endpoint: `${apiBaseUrl}/generate`,
      remove_background: true,
      texture: textureRequested,
      seed: result.seed,
      octree_resolution: result.octreeResolution,
      num_inference_steps: result.numInferenceSteps,
      guidance_scale: result.guidanceScale,
      num_chunks: result.numChunks,
      face_count: result.faceCount,
      type: "glb",
    };
    await writeEvidence(result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.apiServerHealth) {
    result.blocker = "HUNYUAN3D_API_HEALTH_UNAVAILABLE";
    await writeEvidence(result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  result.generationAttempted = true;
  const body = {
    image: `data:image/png;base64,${imageBytes.toString("base64")}`,
    remove_background: true,
    texture: textureRequested,
    seed: result.seed,
    octree_resolution: result.octreeResolution,
    num_inference_steps: result.numInferenceSteps,
    guidance_scale: result.guidanceScale,
    num_chunks: result.numChunks,
    face_count: result.faceCount,
    type: "glb",
  };

  try {
    const response = await fetch(`${apiBaseUrl}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    result.generateStatus = response.status;
    result.generateOk = response.ok;
    if (!response.ok) {
      result.blocker = "HUNYUAN3D_GENERATE_FAILED";
      result.generateError = await response.text();
    } else {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(resolve(outputPath), buffer);
      result.outputFileExists = existsSync(resolve(outputPath));
      result.outputFileSizeBytes = result.outputFileExists ? statSync(resolve(outputPath)).size : 0;
      result.completed = result.outputFileSizeBytes > 0;
      if (!result.completed) result.blocker = "YIYI_CANDIDATE_GLB_EMPTY";
    }
  } catch (error) {
    result.blocker = "HUNYUAN3D_GENERATE_REQUEST_ERROR";
    result.generateError = error.message;
  }

  await writeEvidence(result);
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

main().catch(async (error) => {
  const result = baseResult({ inputPath: defaultInput, outputPath: defaultOutput, dryRun: false, textureRequested: false });
  result.blocker = "UNEXPECTED_GENERATION_SCRIPT_ERROR";
  result.error = error.message;
  await writeEvidence(result);
  console.error(error);
  process.exitCode = 1;
});
