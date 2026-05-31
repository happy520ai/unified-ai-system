import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import os from "node:os";

const task = "Yiyi-Local-Hunyuan3D-Setup-B";
const enginePath = "E:/AI-Data/AI-Engines/Hunyuan3D-2.1";
const evidencePath = "apps/ai-gateway-service/evidence/yiyi/hunyuan3d-local-setup-preflight.json";
const docsPath = "docs/yiyi-hunyuan3d-local-setup-preflight.md";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    timeout: 120000,
    ...options,
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    ok: result.status === 0,
  };
}

function parseGpuInfo(csv) {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, memoryTotalMiB, driverVersion] = line.split(",").map((part) => part.trim());
      return {
        name,
        memoryTotalMiB: Number(memoryTotalMiB),
        memoryTotalGb: Number((Number(memoryTotalMiB) / 1024).toFixed(2)),
        driverVersion,
      };
    });
}

function parseDriveFree(psOutput) {
  const match = psOutput.match(/"freeBytes"\s*:\s*([0-9]+)/i);
  return match ? Number(match[1]) : null;
}

async function main() {
  const systemInfo = {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().map((cpu) => cpu.model).filter((value, index, array) => array.indexOf(value) === index),
    totalMemoryGb: Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(2)),
    freeMemoryGb: Number((os.freemem() / 1024 / 1024 / 1024).toFixed(2)),
  };
  const nvidiaSmi = run("nvidia-smi", ["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"]);
  const gpus = nvidiaSmi.ok ? parseGpuInfo(nvidiaSmi.stdout) : [];
  const pythonVersion = run("python", ["--version"]);
  const pyList = run("py", ["--list"]);
  const condaVersion = run("conda", ["--version"]);
  const gitVersion = run("git", ["--version"]);
  const torchCheck = run("python", [
    "-c",
    "import json\ntry:\n import torch\n print(json.dumps({'torchInstalled': True, 'torchVersion': torch.__version__, 'cudaAvailable': torch.cuda.is_available(), 'cudaVersion': torch.version.cuda, 'deviceCount': torch.cuda.device_count()}))\nexcept Exception as exc:\n print(json.dumps({'torchInstalled': False, 'error': str(exc)}))",
  ]);
  const driveCheck = run("powershell", [
    "-NoProfile",
    "-Command",
    "$d=Get-PSDrive -Name E; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; @{name=$d.Name; freeBytes=$d.Free; usedBytes=$d.Used} | ConvertTo-Json -Compress",
  ]);
  const freeBytes = driveCheck.ok ? parseDriveFree(driveCheck.stdout) : null;
  const freeGb = freeBytes == null ? null : Number((freeBytes / 1024 / 1024 / 1024).toFixed(2));
  const maxVramGb = gpus.reduce((max, gpu) => Math.max(max, gpu.memoryTotalGb), 0);
  const result = {
    task,
    completed: true,
    generatedAt: new Date().toISOString(),
    enginePath,
    enginePathExists: existsSync(resolve(enginePath)),
    aiEnginesRootExists: existsSync(resolve("E:/AI-Data/AI-Engines")),
    systemInfo,
    nvidiaSmi,
    gpus,
    pythonVersion,
    pyList,
    condaVersion,
    condaAvailable: condaVersion.ok,
    gitVersion,
    torchCheck,
    disk: {
      drive: "E:",
      freeBytes,
      freeGb,
      enoughForSourceAndEnv: freeGb == null ? false : freeGb > 30,
    },
    officialRequirementSummary: {
      testedPython: "3.10",
      testedTorch: "2.5.1+cu124",
      shapeGenerationVramGb: 10,
      textureGenerationVramGb: 21,
      fullPipelineVramGb: 29,
    },
    maxVramGb,
    shapeVramReady: maxVramGb >= 10,
    textureVramReady: maxVramGb >= 21,
    fullPipelineVramReady: maxVramGb >= 29,
    installAllowed: gitVersion.ok && (condaVersion.ok || pyList.ok) && (freeGb == null ? false : freeGb > 30),
    generationAllowedOnThisMachine: maxVramGb >= 10,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    rawPhotoStored: false,
    faceRecognitionPerformed: false,
    workspaceCleanClaimed: false,
    blocker: null,
  };
  if (!result.installAllowed) result.blocker = "local_install_prerequisite_missing";
  else if (!result.generationAllowedOnThisMachine) result.blocker = "insufficient_vram_for_hunyuan3d_generation";

  await mkdir(dirname(resolve(evidencePath)), { recursive: true });
  await writeFile(resolve(evidencePath), `${JSON.stringify(result, null, 2)}\n`);

  const gpuLines = gpus.map((gpu) => `- ${gpu.name}: ${gpu.memoryTotalGb} GB, driver ${gpu.driverVersion}`).join("\n") || "- not detected";
  const markdown = `# Yiyi Hunyuan3D Local Setup Preflight

## Result

- task: ${task}
- enginePath: ${enginePath}
- installAllowed: ${result.installAllowed}
- generationAllowedOnThisMachine: ${result.generationAllowedOnThisMachine}
- blocker: ${result.blocker || "none"}

## System

- platform: ${systemInfo.platform} ${systemInfo.release} ${systemInfo.arch}
- memory: ${systemInfo.freeMemoryGb} GB free / ${systemInfo.totalMemoryGb} GB total
- E drive free: ${freeGb ?? "unknown"} GB

## GPU

${gpuLines}

## Python / Conda / Git

- python: ${pythonVersion.ok ? pythonVersion.stdout : "not available"}
- py launcher: ${pyList.ok ? "available" : "not available"}
- conda: ${condaVersion.ok ? condaVersion.stdout : "not available"}
- git: ${gitVersion.ok ? gitVersion.stdout : "not available"}

## Torch CUDA

\`\`\`json
${torchCheck.stdout || torchCheck.stderr || "{}"}
\`\`\`

## Hunyuan3D Requirement Boundary

- shape generation VRAM target: about 10 GB
- texture generation VRAM target: about 21 GB
- full pipeline VRAM target: about 29 GB

Current machine max VRAM: ${maxVramGb} GB.

## Safety

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- rawPhotoStored=false
- faceRecognitionPerformed=false
- workspaceCleanClaimed=false
`;
  await writeFile(resolve(docsPath), markdown);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
