import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { defaultConfig, taskName } from "./hunyuan3d-local-config.mjs";

const resultPath = `${defaultConfig.resultDir}/hunyuan3d-local-preflight-result.json`;

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  return {
    command: [command, ...args].join(" "),
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    ok: result.status === 0,
  };
}

function parseGpuInfo(nvidiaSmiOutput) {
  const lines = nvidiaSmiOutput.split(/\r?\n/).filter(Boolean);
  const gpus = [];
  for (const line of lines) {
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
      gpus.push({
        name: parts[0],
        memoryTotalMiB: Number(parts[1]),
        driverVersion: parts[2],
        memoryTotalGb: Number((Number(parts[1]) / 1024).toFixed(2)),
      });
    }
  }
  return gpus;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  await mkdir(resolve(defaultConfig.resultDir), { recursive: true });
  const sourceDir = process.env.YIYI_HUNYUAN3D_SOURCE_DIR || defaultConfig.sourceDir;
  const sourceAbs = resolve(sourceDir);
  const python = run("python", ["--version"]);
  const pyLaunchers = run("py", ["-0p"]);
  const git = run("git", ["--version"]);
  const nvidiaSmi = run("nvidia-smi", ["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"]);
  const gpus = nvidiaSmi.ok ? parseGpuInfo(nvidiaSmi.stdout) : [];
  const maxVramGb = gpus.reduce((max, gpu) => Math.max(max, gpu.memoryTotalGb), 0);
  const shapeVramReady = maxVramGb >= defaultConfig.minShapeVramGb;
  const textureVramReady = maxVramGb >= defaultConfig.minTextureVramGb;
  const fullPipelineVramReady = maxVramGb >= defaultConfig.minFullPipelineVramGb;
  const manifest = await readJson("apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi-avatar-manifest.json");

  const result = {
    task: taskName,
    completed: true,
    sourceDir,
    sourceDirExists: existsSync(sourceAbs),
    readmeExists: existsSync(resolve(sourceDir, "README.md")),
    requirementsExists: existsSync(resolve(sourceDir, "requirements.txt")),
    venvExists: existsSync(resolve(sourceDir, ".venv", "Scripts", "python.exe")),
    python,
    pyLaunchers,
    git,
    nvidiaSmiAvailable: nvidiaSmi.ok,
    gpus,
    maxVramGb,
    officialRequirementSummary: {
      testedPython: "3.10",
      testedTorch: "2.5.1+cu124",
      shapeGenerationVramGb: defaultConfig.minShapeVramGb,
      textureGenerationVramGb: defaultConfig.minTextureVramGb,
      fullPipelineVramGb: defaultConfig.minFullPipelineVramGb,
    },
    shapeVramReady,
    textureVramReady,
    fullPipelineVramReady,
    generationAllowedOnThisMachine: shapeVramReady,
    workbenchRuntimeGeneration: false,
    currentAvatarMode: manifest.currentAvatarMode,
    real3DModelLoaded: manifest.real3DModelLoaded === true,
    pseudo3DLiveMotion: manifest.pseudo3DLiveMotion === true,
    ...defaultConfig.safety,
    recommended_sealed: true,
    blocker: null,
  };

  if (!result.sourceDirExists) result.blocker = "hunyuan3d_source_missing";
  else if (!shapeVramReady) result.blocker = "insufficient_vram_for_hunyuan3d_shape_generation";

  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
