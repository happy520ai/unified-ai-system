/**
 * Glob Tool — 文件模式匹配搜索
 *
 * 提供 Claude Code / Codex CLI 同款的文件搜索能力:
 * - 支持 glob 模式匹配 (*, **, ?, {})
 * - 返回匹配文件路径列表 (按修改时间排序)
 * - 自动跳过 node_modules, .git 等目录
 *
 * @module globTool
 */

import { readdir, stat } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, relative, extname, resolve, sep } from "node:path";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build",
  ".cache", "__pycache__", "venv", ".venv", "coverage",
]);

const MAX_RESULTS = 500;

/**
 * 将简单 glob 模式转为正则表达式。
 * 支持: *, **, ?, {a,b}
 */
export function globToRegex(pattern) {
  let regex = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // ** — match any path segments
        if (pattern[i + 2] === "/") {
          regex += "(?:.*/)?";
          i += 3;
        } else {
          regex += ".*";
          i += 2;
        }
      } else {
        // * — match anything except /
        regex += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      regex += "[^/]";
      i++;
    } else if (ch === "{") {
      const end = pattern.indexOf("}", i);
      if (end !== -1) {
        const alternatives = pattern.slice(i + 1, end).split(",");
        regex += "(?:" + alternatives.map(escapeRegex).join("|") + ")";
        i = end + 1;
      } else {
        regex += escapeRegexChar(ch);
        i++;
      }
    } else if (ch === "[") {
      const end = pattern.indexOf("]", i);
      if (end !== -1) {
        regex += pattern.slice(i, end + 1);
        i = end + 1;
      } else {
        regex += escapeRegexChar(ch);
        i++;
      }
    } else {
      regex += escapeRegexChar(ch);
      i++;
    }
  }

  return new RegExp("^" + regex + "$");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeRegexChar(ch) {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? "\\" + ch : ch;
}

/**
 * 递归扫描目录,返回匹配 glob 模式的文件路径列表。
 */
async function scanGlob(rootDir, pattern, regex, baseDir, results = [], depth = 0) {
  if (depth > 15 || results.length >= MAX_RESULTS) return results;

  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) break;
    const fullPath = join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        await scanGlob(fullPath, pattern, regex, baseDir, results, depth + 1);
      }
    } else if (entry.isFile()) {
      const relPath = relative(baseDir, fullPath).replace(/\\/g, "/");
      if (regex.test(relPath)) {
        try {
          const fileStat = await stat(fullPath);
          results.push({
            path: fullPath,
            relativePath: relPath,
            size: fileStat.size,
            modified: fileStat.mtime.toISOString(),
          });
        } catch {
          // skip
        }
      }
    }
  }

  return results;
}

/**
 * Validate that the resolved search path stays within the working directory.
 * Blocks path traversal attacks (e.g. searchPath: "/etc" or "../../sensitive").
 */
function validatePathSecurity(searchPath, workingDirectory) {
  const resolved = resolve(workingDirectory, searchPath);
  const resolvedWorkdir = resolve(workingDirectory);
  if (!resolved.startsWith(resolvedWorkdir + sep) && resolved !== resolvedWorkdir) {
    return { valid: false, error: "PATH_TRAVERSAL_BLOCKED" };
  }
  return { valid: true, resolvedPath: resolved };
}

/**
 * 创建 glob_tool。
 */
export function createGlobTool() {
  return buildTool({
    name: "glob",
    description: `Fast file pattern matching tool. Returns matching file paths sorted by modification time.
Supports glob patterns like "**/*.js", "src/**/*.ts", "*.md".
Use this to find files by name patterns before reading them.`,
    inputSchema: createInputSchema(
      {
        pattern: {
          type: "string",
          description: 'Glob pattern to match files (e.g. "**/*.js", "src/**/*.ts", "*.{js,ts}")',
        },
        path: {
          type: "string",
          description: "Directory to search in (defaults to project root)",
        },
        max_results: {
          type: "integer",
          description: "Maximum number of results (default 100, max 500)",
        },
      },
      ["pattern"]
    ),
    requiredPermissions: ["file:read"],
    isReadOnly: true,

    async execute(params) {
      const { pattern, path: searchPath, max_results = 100 } = params;

      // Input validation
      if (!pattern || typeof pattern !== "string") {
        return {
          status: "error",
          error: "pattern must be a non-empty string.",
          code: "INVALID_INPUT",
        };
      }
      if (searchPath && typeof searchPath !== "string") {
        return {
          status: "error",
          error: "path must be a string.",
          code: "INVALID_INPUT",
        };
      }

      const workingDirectory = process.cwd();
      const baseDir = searchPath
        ? resolve(workingDirectory, searchPath)
        : workingDirectory;

      // Path traversal protection
      if (searchPath) {
        const pathCheck = validatePathSecurity(searchPath, workingDirectory);
        if (!pathCheck.valid) {
          return {
            status: "error",
            error: "Path traversal blocked: searchPath must stay within working directory",
            code: "PATH_TRAVERSAL_BLOCKED",
          };
        }
      }

      // Directory existence check
      if (!existsSync(baseDir) || !statSync(baseDir).isDirectory()) {
        return {
          status: "error",
          error: `Search directory does not exist: ${baseDir}`,
          code: "DIRECTORY_NOT_FOUND",
        };
      }

      const safeMaxResults = typeof max_results === "number" && max_results > 0
        ? max_results : 100;
      const limit = Math.min(safeMaxResults, MAX_RESULTS);

      const regex = globToRegex(pattern);
      const results = await scanGlob(baseDir, pattern, regex, baseDir);

      // Sort by modification time (newest first)
      results.sort((a, b) => b.modified.localeCompare(a.modified));

      const limited = results.slice(0, limit);

      return {
        status: "success",
        pattern,
        searchPath: baseDir,
        matchCount: results.length,
        files: limited.map((f) => f.relativePath),
        truncated: results.length > limit,
        details: limited.map((f) => ({
          path: f.relativePath,
          size: f.size,
          modified: f.modified,
        })),
      };
    },
  });
}
