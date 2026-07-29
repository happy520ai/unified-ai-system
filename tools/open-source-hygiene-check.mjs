import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const errors = [];
const warnings = [];

const skippedDirs = new Set([
  ".git",
  "legacy",
  "node_modules",
  ".agent-memory",
  ".agent-sessions",
  ".data",
  ".forge",
  ".forge-worktrees",
]);
const sourceExts = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".jsonc",
  ".md",
  ".yaml",
  ".yml",
  ".toml",
  ".sh",
  ".xml",
  ".cmd",
  ".ps1",
  ".html",
  ".css",
  ".txt",
]);
const packageTargetRe = /(?:node|tsx)\s+(?:--check\s+)?([^\s;&|]+\.(?:mjs|js|cjs|ts))/g;
const localImportLineRe = /^\s*(?:import\b[^\n;]*(?:\bfrom\s*)?["'](\.{1,2}\/[^"']+)["']|export\b[^\n;]*\bfrom\s*["'](\.{1,2}\/[^"']+)["']|(?:await\s+)?import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\))/;
const deletedPackageNames = [
  "workforce-execution-fabric",
  "employee-communication-bus",
  "employee-communication-contracts",
  "employee-collaboration-protocol",
  "global-model-library",
  "gvc-permission-engine",
  "model-routing-engine",
  "neural-fabric-runtime",
];
const secretPatterns = [
  /(?<![A-Za-z])sk-(?:proj-|ant-api03-|or-v1-)?[A-Za-z0-9_-]{24,}/,
  /ghp_[A-Za-z0-9_]{30,}/,
  /xox[baprs]-[A-Za-z0-9-]{30,}/,
  /AIza[0-9A-Za-z_-]{25,}/,
  /OPENAI_API_KEY\s*=\s*[^\s#]+/,
  /ANTHROPIC_API_KEY\s*=\s*[^\s#]+/,
];
const machineSpecificPathPatterns = [
  {
    label: "personal Windows user directory",
    pattern: /C:[\\/]+Users[\\/]+Administrator(?:[\\/]|$)/i,
  },
  {
    label: "local E drive data directory",
    pattern: /E:[\\/]+AI-Data(?:[\\/]|$)/i,
  },
  {
    label: "private Qoder workspace directory",
    pattern: /\.qoderworkcn(?:[\\/]|$)/i,
  },
];

const requiredIgnoreEntries = [
  "node_modules/",
  ".env",
  ".env.*",
  ".data/",
  ".agent-memory/",
  ".agent-sessions/",
  ".forge/",
  ".forge-worktrees/",
  "legacy/",
  "*.input.json",
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skippedDirs.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else if (sourceExts.has(extname(entry.name)) || entry.name === "package.json") {
      out.push(fullPath);
    }
  }
  return out;
}

function rel(path) {
  return relative(root, path).replace(/\\/g, "/");
}

function read(path) {
  return readFileSync(path, "utf8");
}

function checkJsonAndPackageTargets() {
  const packageFiles = walk(root).filter((file) => file.endsWith("package.json"));
  let checkedTargets = 0;
  for (const packageFile of packageFiles) {
    let manifest;
    try {
      manifest = JSON.parse(read(packageFile));
    } catch (error) {
      errors.push(`${rel(packageFile)} is not valid JSON: ${error.message}`);
      continue;
    }
    const packageDir = resolve(packageFile, "..");
    const checkTarget = (label, target) => {
      checkedTargets += 1;
      if (!existsSync(resolve(packageDir, target))) {
        errors.push(`${rel(packageFile)} missing ${label}: ${target}`);
      }
    };
    if (manifest.main) checkTarget("main", manifest.main);
    for (const [key, value] of Object.entries(manifest.exports || {})) {
      if (typeof value === "string") checkTarget(`exports[${key}]`, value);
    }
    for (const [name, rawValue] of Object.entries(manifest.scripts || {})) {
      const value = String(rawValue);
      let match;
      while ((match = packageTargetRe.exec(value))) {
        const target = match[1].replace(/^["']|["']$/g, "");
        const localTarget = resolve(packageDir, target);
        const rootTarget = resolve(root, target);
        checkedTargets += 1;
        if (!existsSync(localTarget) && !existsSync(rootTarget)) {
          errors.push(`${rel(packageFile)} script ${name} points to missing target: ${target}`);
        }
      }
    }
  }
  return { packageFiles: packageFiles.length, checkedTargets };
}

function checkIgnoreFiles() {
  const gitignore = existsSync(join(root, ".gitignore")) ? read(join(root, ".gitignore")) : "";
  const dockerignore = existsSync(join(root, ".dockerignore")) ? read(join(root, ".dockerignore")) : "";
  for (const entry of requiredIgnoreEntries) {
    if (!gitignore.includes(entry)) errors.push(`.gitignore missing ${entry}`);
  }
  for (const entry of [
    ".env",
    "node_modules/",
    ".data/",
    ".agent-memory/",
    ".agent-sessions/",
    ".forge/",
    "**/*.input.json",
  ]) {
    if (!dockerignore.includes(entry)) warnings.push(`.dockerignore missing ${entry}`);
  }
}

function shouldScanSecrets(file) {
  const name = rel(file);
  return !name.includes("/evidence/") &&
    !name.endsWith("pnpm-lock.yaml") &&
    !name.startsWith(".env");
}

function checkSecretShapes(files) {
  let scanned = 0;
  for (const file of files) {
    if (!shouldScanSecrets(file)) continue;
    const text = read(file);
    scanned += 1;
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        errors.push(`secret-like literal found in ${rel(file)}`);
        break;
      }
    }
  }
  return scanned;
}

function checkDeletedPackageReferences(files) {
  let scanned = 0;
  for (const file of files) {
    const name = rel(file);
    if (name === "tools/open-source-hygiene-check.mjs") continue;
    if (!/^(apps|packages|tools|docs)\//.test(name) || name.includes("/evidence/")) continue;
    const text = read(file);
    scanned += 1;
    for (const packageName of deletedPackageNames) {
      if (text.includes(packageName)) {
        errors.push(`deleted package reference found in ${name}: ${packageName}`);
      }
    }
  }
  return scanned;
}

function checkMachineSpecificPaths(files) {
  let scanned = 0;
  for (const file of files) {
    const name = rel(file);
    if (name === "tools/open-source-hygiene-check.mjs") continue;
    const text = read(file);
    scanned += 1;
    for (const { label, pattern } of machineSpecificPathPatterns) {
      if (pattern.test(text)) {
        errors.push(`${label} found in ${name}`);
        break;
      }
    }
  }
  return scanned;
}

function checkUtf8(files) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let scanned = 0;
  for (const file of files) {
    scanned += 1;
    const bytes = readFileSync(file);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      errors.push(`UTF-8 BOM found in ${rel(file)}`);
    }
    try {
      decoder.decode(bytes);
    } catch {
      errors.push(`invalid UTF-8 found in ${rel(file)}`);
      continue;
    }
    if (bytes.toString("utf8").includes("\uFFFD?")) {
      errors.push(`corrupt replacement marker found in ${rel(file)}`);
    }
  }
  return scanned;
}

function checkLocalImports(files) {
  let checked = 0;
  const codeFiles = files.filter((file) => /\.(js|mjs|cjs|ts)$/.test(file));
  for (const file of codeFiles) {
    const lines = read(file).split(/\r?\n/);
    let insideTemplate = false;
    for (const line of lines) {
      const wasInsideTemplate = insideTemplate;
      insideTemplate = updateTemplateState(line, insideTemplate);
      if (wasInsideTemplate || /^\s*(?:\/\/|\*)/.test(line)) continue;
      const match = localImportLineRe.exec(line);
      if (!match) continue;
      const specifier = match[1] ?? match[2] ?? match[3];
      checked += 1;
      const base = resolve(dirname(file), specifier);
      const candidates = extname(base)
        ? [base, ...typescriptCandidates(base)]
        : [
            base,
            `${base}.js`,
            `${base}.mjs`,
            `${base}.cjs`,
            `${base}.ts`,
            join(base, "index.js"),
            join(base, "index.mjs"),
          ];
      if (!candidates.some((candidate) => existsSync(candidate))) {
        errors.push(`missing local import in ${rel(file)}: ${specifier}`);
      }
    }
  }
  return checked;
}

function typescriptCandidates(base) {
  if (!base.endsWith(".js")) return [];
  return [`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`];
}

function updateTemplateState(line, current) {
  let inside = current;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "`") continue;
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) inside = !inside;
  }
  return inside;
}

function checkUntrackedRuntimeState() {
  const git = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });
  if (git.status !== 0) {
    warnings.push("unable to inspect untracked files with git");
    return 0;
  }
  const untracked = git.stdout.split(/\r?\n/).filter(Boolean);
  for (const file of untracked) {
    if (/(^|\/)\.(agent-memory|agent-sessions|forge)(\/|$)/.test(file)) {
      errors.push(`untracked runtime state file: ${file}`);
    }
  }
  return untracked.length;
}

function checkTrackedOperatorInputs() {
  const git = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (git.status !== 0) {
    warnings.push("unable to inspect tracked operator input files with git");
    return 0;
  }
  const trackedInputs = git.stdout
    .split("\0")
    .filter((file) => file.endsWith(".input.json") && existsSync(resolve(root, file)));
  for (const file of trackedInputs) {
    errors.push(`tracked operator input must be replaced by an example or template: ${file}`);
  }
  return trackedInputs.length;
}

function checkTrackedBackupArtifacts() {
  const git = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (git.status !== 0) {
    warnings.push("unable to inspect tracked backup artifacts with git");
    return 0;
  }
  const backupPattern =
    /(?:\.bak(?:[.-]|$)|\.backup(?:[.-]|$)|\.tmp(?:[.-]|$)|\.temp(?:[.-]|$)|\.orig$|\.rej$|~$|\.sw[op]$)/i;
  const trackedBackups = git.stdout
    .split("\0")
    .filter((file) => backupPattern.test(file) && existsSync(resolve(root, file)));
  for (const file of trackedBackups) {
    errors.push(`tracked backup or temporary artifact: ${file}`);
  }
  return trackedBackups.length;
}

function checkIgnoredActiveSource() {
  const git = spawnSync(
    "git",
    ["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", "apps", "packages", "tools"],
    { cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
  );
  if (git.status !== 0) {
    warnings.push("unable to inspect ignored active source files with git");
    return 0;
  }
  const generatedDirPattern = /(^|\/)(?:node_modules|dist|build|coverage|test-results)(\/|$)/;
  const ignoredSource = git.stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => /^(?:(?:apps|packages)\/[^/]+\/src\/|tools\/)/.test(file))
    .filter((file) => !generatedDirPattern.test(file))
    .filter((file) => sourceExts.has(extname(file)));
  for (const file of ignoredSource) {
    errors.push(`active source file is hidden by .gitignore: ${file}`);
  }
  return ignoredSource.length;
}

function checkAutopilotQueue() {
  const queueFile = join(root, "docs/automation/opencode-autopilot-task-queue.json");
  const policyFile = join(root, "docs/project-brain/opencode-autopilot-policy.json");
  const stateFile = join(root, "docs/project-brain/opencode-autopilot-state.json");
  const packageFile = join(root, "package.json");
  const files = [queueFile, policyFile, stateFile, packageFile];
  if (!files.every(existsSync)) {
    warnings.push("OpenCode autopilot queue validation skipped because a required file is missing");
    return { tasks: 0, commands: 0, allowedFiles: 0, stateTaskRefs: 0 };
  }

  const queue = JSON.parse(read(queueFile));
  const policy = JSON.parse(read(policyFile));
  const state = JSON.parse(read(stateFile));
  const manifest = JSON.parse(read(packageFile));
  const tasks = Array.isArray(queue.tasks) ? queue.tasks : [];
  const taskIds = new Set(tasks.map((task) => task.taskId).filter(Boolean));
  const commandPrefixes = Array.isArray(policy.commandWhitelist) ? policy.commandWhitelist : [];
  const stageKeys = ["preflightCommands", "diagnoseCommands", "executeCommands", "reviewCommands", "verifyCommands"];
  let commands = 0;
  let allowedFiles = 0;

  for (const task of tasks) {
    for (const file of task.allowedFiles || []) {
      allowedFiles += 1;
      if (!existsSync(resolve(root, file))) {
        errors.push(`autopilot task ${task.taskId} allows missing file: ${file}`);
      }
    }
    for (const stageKey of stageKeys) {
      for (const command of task[stageKey] || []) {
        commands += 1;
        if (!commandPrefixes.some((prefix) => command.startsWith(prefix))) {
          errors.push(`autopilot task ${task.taskId} has non-whitelisted command: ${command}`);
        }
        const scriptName = /\bpnpm run ([^\s]+)/.exec(command)?.[1];
        if (scriptName && !Object.hasOwn(manifest.scripts || {}, scriptName)) {
          errors.push(`autopilot task ${task.taskId} points to missing package script: ${scriptName}`);
        }
        const checkTarget = /^node --check\s+([^\s]+)$/.exec(command)?.[1];
        if (checkTarget && !existsSync(resolve(root, checkTarget))) {
          errors.push(`autopilot task ${task.taskId} checks missing target: ${checkTarget}`);
        }
      }
    }
  }

  const stateTaskRefs = [
    ...(state.completedTaskIds || []),
    ...(state.blockedTaskIds || []),
    state.currentTaskId,
    state.nextTaskId,
  ].filter(Boolean);
  for (const taskId of stateTaskRefs) {
    if (!taskIds.has(taskId)) errors.push(`autopilot state references unknown task: ${taskId}`);
  }

  return { tasks: tasks.length, commands, allowedFiles, stateTaskRefs: stateTaskRefs.length };
}

const files = walk(root).filter((file) => {
  try {
    return statSync(file).size < 2_000_000;
  } catch {
    return false;
  }
});

const packageSummary = checkJsonAndPackageTargets();
checkIgnoreFiles();
const secretScanned = checkSecretShapes(files);
const deletedRefScanned = checkDeletedPackageReferences(files);
const machinePathScanned = checkMachineSpecificPaths(files);
const utf8Scanned = checkUtf8(files);
const localImportsChecked = checkLocalImports(files);
const untrackedCount = checkUntrackedRuntimeState();
const trackedOperatorInputs = checkTrackedOperatorInputs();
const trackedBackupArtifacts = checkTrackedBackupArtifacts();
const ignoredActiveSource = checkIgnoredActiveSource();
const autopilotQueue = checkAutopilotQueue();

const result = {
  ok: errors.length === 0,
  errors,
  warnings,
  packageSummary,
  secretScanned,
  deletedRefScanned,
  machinePathScanned,
  utf8Scanned,
  localImportsChecked,
  untrackedCount,
  trackedOperatorInputs,
  trackedBackupArtifacts,
  ignoredActiveSource,
  autopilotQueue,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
