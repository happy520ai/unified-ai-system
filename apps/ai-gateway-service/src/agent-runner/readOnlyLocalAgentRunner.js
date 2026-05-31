import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  BLOCKED_COMMAND_PATTERNS,
  BLOCKED_PATHS,
  PERMISSION_MODES,
} from "./permissionModePolicy.js";
import {
  ALLOWED_TASK_ACTIONS,
  validateReadOnlyTask,
} from "./localAgentTaskSchema.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const MAX_FILE_BYTES = 64 * 1024;
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx", ".json", ".md"]);

export const READ_ONLY_TOOL_NAMES = [
  "listDir",
  "readTextFile",
  "searchText",
  "readPackageScripts",
  "gitStatusReadonly",
  "buildContextSummary",
  "proposePlan",
];

export const DISABLED_ACTIONS = {
  writeFile: false,
  applyPatch: false,
  deleteFile: false,
  runCommand: false,
};

export function createReadOnlyLocalAgentRunner(options = {}) {
  const mode = typeof options.mode === "string" ? options.mode : "manual";
  const policy = PERMISSION_MODES[mode] ?? PERMISSION_MODES.manual;

  return {
    mode: policy.id,
    policy,
    tools: READ_ONLY_TOOL_NAMES,
    disabledActions: DISABLED_ACTIONS,
    async listDir(target = ".") {
      const absolute = resolveAllowedPath(target);
      const entries = await readdir(absolute, { withFileTypes: true });
      return {
        path: toRepoRelative(absolute),
        entries: entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? "dir" : "file",
        })),
      };
    },
    async readTextFile(target) {
      const absolute = resolveAllowedPath(target);
      ensureTextFile(absolute);
      const content = await readFile(absolute, "utf8");
      return {
        path: toRepoRelative(absolute),
        content,
      };
    },
    async searchText(query, target = ".") {
      const root = resolveAllowedPath(target);
      const term = String(query ?? "").trim();
      if (!term) {
        return { query: "", matches: [] };
      }
      const files = await listSearchableFiles(root);
      const matches = [];
      for (const file of files) {
        const text = await safeReadText(file);
        if (!text) continue;
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          if (lines[i].includes(term)) {
            matches.push({
              path: toRepoRelative(file),
              lineNumber: i + 1,
              line: lines[i],
            });
            if (matches.length >= 50) {
              return { query: term, matches };
            }
          }
        }
      }
      return { query: term, matches };
    },
    readPackageScripts() {
      return {
        root: readPackageScriptsFrom(resolve(repoRoot, "package.json")),
        service: readPackageScriptsFrom(resolve(repoRoot, "apps/ai-gateway-service/package.json")),
      };
    },
    async gitStatusReadonly() {
      try {
        const { stdout } = await execFileAsync("git", ["status", "--short"], {
          cwd: repoRoot,
          windowsHide: true,
          timeout: 5000,
        });
        return {
          ok: true,
          output: stdout.trim(),
        };
      } catch (error) {
        return {
          ok: false,
          output: "",
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async buildContextSummary(input = {}) {
      const taskCheck = validateReadOnlyTask(input);
      const git = await this.gitStatusReadonly();
      return {
        mode: policy.id,
        goal: taskCheck.task.goal,
        taskOk: taskCheck.ok,
        taskErrors: taskCheck.errors,
        blockedPaths: BLOCKED_PATHS,
        blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
        tools: READ_ONLY_TOOL_NAMES,
        gitStatusReadonly: git,
      };
    },
    async proposePlan(input = {}) {
      const taskCheck = validateReadOnlyTask(input);
      return {
        mode: policy.id,
        goal: taskCheck.task.goal,
        status: taskCheck.ok ? "plan-ready" : "blocked",
        allowedActions: taskCheck.task.actions.filter((action) => ALLOWED_TASK_ACTIONS.includes(action)),
        blockedBy: taskCheck.errors,
        patchProposalOnly: true,
        writeEnabled: false,
        patchApplyEnabled: false,
        steps: [
          "Inspect allowed files and scripts within approved paths.",
          "Collect read-only context and summarize current state.",
          "Prepare plan and patch proposal text only.",
          "Stop before any write, patch apply, or dangerous command.",
        ],
        patchProposal: [
          "Suggested file targets must stay within approved read-only paths.",
          "Proposed changes are descriptive only and must not be applied automatically.",
          "Any actual patch apply remains blocked in Phase296A.",
        ],
      };
    },
  };
}

function resolveAllowedPath(target) {
  const absolute = resolve(repoRoot, String(target ?? "."));
  const relativePath = toRepoRelative(absolute);
  ensureAllowedRelativePath(relativePath);
  return absolute;
}

function ensureAllowedRelativePath(relativePath) {
  const normalized = String(relativePath).replace(/\\/g, "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Path escapes repository root: " + normalized);
  }
  for (const blocked of BLOCKED_PATHS) {
    if (normalized === blocked || normalized.startsWith(blocked) || normalized.includes("/" + blocked)) {
      throw new Error("Blocked path: " + normalized);
    }
  }
}

function ensureTextFile(filePath) {
  const extension = extname(filePath);
  if (!SOURCE_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported text file type: " + extension);
  }
  if (!existsSync(filePath)) {
    throw new Error("File not found: " + filePath);
  }
  const size = readFileSync(filePath).byteLength;
  if (size > MAX_FILE_BYTES) {
    throw new Error("File too large for read-only preview: " + filePath);
  }
}

async function listSearchableFiles(root) {
  const output = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) continue;
    const absolute = resolve(root, entry.name);
    const rel = toRepoRelative(absolute);
    ensureAllowedRelativePath(rel);
    if (entry.isDirectory()) {
      output.push(...await listSearchableFiles(absolute));
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      output.push(absolute);
    }
  }
  return output;
}

function shouldSkipEntry(name) {
  return [".git", "node_modules", "dist", "build", "coverage", ".next", ".cache"].includes(name);
}

async function safeReadText(filePath) {
  try {
    ensureTextFile(filePath);
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function readPackageScriptsFrom(filePath) {
  const pkg = JSON.parse(readFileSync(filePath, "utf8"));
  return pkg.scripts ?? {};
}

function toRepoRelative(target) {
  return relative(repoRoot, target).replace(/\\/g, "/") || ".";
}
