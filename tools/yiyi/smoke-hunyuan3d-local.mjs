import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { defaultConfig, taskName } from "./hunyuan3d-local-config.mjs";

const preflightPath = `${defaultConfig.resultDir}/hunyuan3d-local-preflight-result.json`;
const resultPath = `${defaultConfig.resultDir}/hunyuan3d-local-smoke-result.json`;

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

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  await mkdir(resolve(defaultConfig.resultDir), { recursive: true });
  const preflight = existsSync(resolve(preflightPath)) ? await readJson(preflightPath) : null;
  const sourceDir = process.env.YIYI_HUNYUAN3D_SOURCE_DIR || defaultConfig.sourceDir;
  const venvPython = resolve(sourceDir, ".venv", "Scripts", "python.exe");
  const sourceReady = existsSync(resolve(sourceDir, "README.md"));
  const generationBlocked = !preflight?.generationAllowedOnThisMachine;
  const importSmoke = existsSync(venvPython)
    ? run(venvPython, ["-c", "import sys; print(sys.version)"])
    : null;
  const result = {
    task: taskName,
    completed: true,
    smokeType: "local_preflight_smoke",
    sourceReady,
    venvExists: existsSync(venvPython),
    importSmoke,
    generationAttempted: false,
    generationSkippedReason: generationBlocked
      ? "insufficient_vram_for_hunyuan3d_shape_generation"
      : "model_weights_not_installed_and_real_generation_not_requested",
    realModelGenerated: false,
    yiyiCandidateGenerated: false,
    yiyiVrmGenerated: false,
    smokeStatus: sourceReady && !generationBlocked ? "ready_for_manual_generation_assets" : "blocked_before_real_generation",
    preflightBlocker: preflight?.blocker || null,
    ...defaultConfig.safety,
    recommended_sealed: sourceReady,
    blocker: sourceReady ? null : "hunyuan3d_source_missing",
  };

  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
