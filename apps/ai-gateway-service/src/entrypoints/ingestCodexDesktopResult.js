import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const inboxDir = resolve(repoRoot, ".codex-handoff/inbox");
const inboxMarkdownPath = resolve(inboxDir, "latest-codex-result.md");
const inboxJsonPath = resolve(inboxDir, "latest-codex-result.json");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.source === "clipboard") {
    const content = await readClipboard();
    if (!content.trim()) {
      printJson({
        status: "blocked",
        blocker: "clipboard_empty",
        imported: false,
        codexCliInvoked: false,
        codexExecInvoked: false,
      });
      return;
    }
    await writeInboxResult({ content, source: "clipboard" });
    return;
  }

  const sourcePath = resolve(repoRoot, options.filePath);
  const sourceStats = await safeStat(sourcePath);
  if (!sourceStats.exists) {
    throw new Error(`Missing result file: ${options.filePath}`);
  }
  const content = await readFile(sourcePath, "utf8");
  await writeInboxResult({ content, source: "file", sourcePath });
}

function parseArgs(args) {
  const options = {
    source: null,
    filePath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--from-clipboard") {
      options.source = "clipboard";
      continue;
    }
    if (arg === "--from-file") {
      options.source = "file";
      options.filePath = args[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.source === "file" && !options.filePath) {
    throw new Error("--from-file requires a file path.");
  }
  if (!options.source) {
    throw new Error("Use --from-clipboard or --from-file <path>.");
  }
  return options;
}

async function writeInboxResult({ content, source, sourcePath = null }) {
  if (containsPlaintextSecret(content)) {
    throw new Error("Refusing to import result because it appears to contain a plaintext secret.");
  }

  await mkdir(inboxDir, { recursive: true });
  const sourceResolved = sourcePath ? resolve(sourcePath) : null;
  const inboxResolved = resolve(inboxMarkdownPath);
  if (source !== "file" || sourceResolved !== inboxResolved) {
    await writeFile(inboxMarkdownPath, content, "utf8");
  }

  const importedAt = new Date().toISOString();
  const metadata = {
    importedAt,
    source,
    sourcePath: sourcePath ? relativeFromRoot(sourcePath) : null,
    resultPath: relativeFromRoot(inboxMarkdownPath),
    metadataPath: relativeFromRoot(inboxJsonPath),
    contentLength: content.length,
    requiresReview: true,
    goNoGo: "pending-review",
    executionEnabled: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: "Imported Codex Desktop result into inbox. This does not mark the result as passed; run codex:desktop:review next.",
  };
  await writeFile(inboxJsonPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  printJson({
    status: "imported",
    imported: true,
    source,
    contentLength: content.length,
    resultPath: metadata.resultPath,
    metadataPath: metadata.metadataPath,
    requiresReview: true,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });
}

async function readClipboard() {
  return runPowerShell({
    script: "Get-Clipboard -Raw -ErrorAction Stop",
  });
}

function runPowerShell({ script }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }
      rejectPromise(new Error(stderr || `PowerShell exited with code ${code}`));
    });
  });
}

async function safeStat(pathValue) {
  try {
    const info = await stat(pathValue);
    return {
      exists: info.isFile(),
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    };
  } catch {
    return {
      exists: false,
      sizeBytes: 0,
      modifiedAt: null,
    };
  }
}

function containsPlaintextSecret(value) {
  return /(?:sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY)/i.test(String(value || ""));
}

function relativeFromRoot(pathValue) {
  return resolve(pathValue).replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
