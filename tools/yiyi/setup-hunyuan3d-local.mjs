import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { defaultConfig, taskName } from "./hunyuan3d-local-config.mjs";

const resultPath = `${defaultConfig.resultDir}/hunyuan3d-local-setup-result.json`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
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

function parseFlagValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function flagEnabled(name) {
  return process.argv.includes(name) || parseFlagValue(name) === "true";
}

async function readPackageName(sourceDir) {
  const readme = resolve(sourceDir, "README.md");
  if (!existsSync(readme)) return null;
  const text = await readFile(readme, "utf8");
  return text.includes("Hunyuan3D") ? "Hunyuan3D-2.1" : null;
}

async function main() {
  const sourceDir = parseFlagValue("--source-dir") || process.env.YIYI_HUNYUAN3D_SOURCE_DIR || defaultConfig.sourceDir;
  const clone = flagEnabled("--clone") || process.env.YIYI_HUNYUAN3D_CLONE === "true";
  const createVenv = flagEnabled("--create-venv") || process.env.YIYI_HUNYUAN3D_CREATE_VENV === "true";
  const installDeps = flagEnabled("--install-deps") || process.env.YIYI_HUNYUAN3D_INSTALL_DEPS === "true";
  const pythonCommand = parseFlagValue("--python") || process.env.YIYI_HUNYUAN3D_PYTHON || "python";

  await mkdir(resolve(defaultConfig.resultDir), { recursive: true });
  await mkdir(resolve(defaultConfig.generatedDir), { recursive: true });
  await mkdir(resolve(defaultConfig.modelDir), { recursive: true });

  const sourceExistsBefore = existsSync(resolve(sourceDir));
  const steps = [];
  if (clone && !sourceExistsBefore) {
    await mkdir(dirname(resolve(sourceDir)), { recursive: true });
    steps.push(run("git", ["clone", "--depth=1", defaultConfig.repositoryUrl, resolve(sourceDir)]));
  }

  const sourceExistsAfter = existsSync(resolve(sourceDir));
  if (createVenv && sourceExistsAfter) {
    steps.push(run(pythonCommand, ["-m", "venv", resolve(sourceDir, ".venv")]));
  }

  const venvPython = resolve(sourceDir, ".venv", "Scripts", "python.exe");
  if (installDeps && existsSync(venvPython) && sourceExistsAfter) {
    steps.push(run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], { timeout: 600000 }));
    steps.push(run(venvPython, ["-m", "pip", "install", "-r", resolve(sourceDir, "requirements.txt")], { timeout: 1800000 }));
  }

  const result = {
    task: taskName,
    completed: true,
    setupAttempted: true,
    repositoryUrl: defaultConfig.repositoryUrl,
    sourceDir,
    sourceDirExistsBefore: sourceExistsBefore,
    sourceDirExistsAfter: sourceExistsAfter,
    packageDetected: sourceExistsAfter ? await readPackageName(sourceDir) : null,
    cloneRequested: clone,
    createVenvRequested: createVenv,
    installDepsRequested: installDeps,
    dependencyInstallExecuted: installDeps && existsSync(venvPython),
    venvPython,
    venvExists: existsSync(venvPython),
    steps,
    installStatus: sourceExistsAfter ? "source_ready" : "source_missing",
    smokeStatus: "preflight_required",
    realModelGenerated: false,
    yiyiVrmGenerated: false,
    ...defaultConfig.safety,
    recommended_sealed: true,
    blocker: sourceExistsAfter ? null : "hunyuan3d_source_missing",
  };

  await writeFile(resolve(resultPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
