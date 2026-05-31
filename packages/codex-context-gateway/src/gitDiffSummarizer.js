import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sanitizePath } from "./safetyBoundaryChecker.js";

const execFileAsync = promisify(execFile);

export async function summarizeGitDiff({ repoRoot }) {
  const status = await runGit(repoRoot, ["status", "--short"]);
  const unstaged = await runGit(repoRoot, ["diff", "--name-only"]);
  const staged = await runGit(repoRoot, ["diff", "--cached", "--name-only"]);
  const changedFiles = parseStatus(status.stdout);
  return {
    completed: true,
    mode: "metadata-only-no-diff-content",
    statusAvailable: status.exitCode === 0,
    diffContentRead: false,
    workspaceCleanClaimed: false,
    changedFileCount: changedFiles.length,
    changedFiles,
    unstagedFiles: parseNameList(unstaged.stdout),
    stagedFiles: parseNameList(staged.stdout),
    commandWarnings: [status, unstaged, staged].filter((item) => item.exitCode !== 0).map((item) => item.stderrTail),
  };
}

async function runGit(repoRoot, args) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return { exitCode: 0, stdout: result.stdout, stderrTail: "" };
  } catch (error) {
    return {
      exitCode: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout || "",
      stderrTail: String(error.stderr || error.message || "").slice(-600),
    };
  }
}

function parseStatus(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 300)
    .map((line) => ({
      status: line.slice(0, 2).trim() || "unknown",
      path: sanitizePath(line.slice(3).trim()),
    }));
}

function parseNameList(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 300)
    .map((line) => sanitizePath(line.trim()));
}
