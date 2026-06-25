/**
 * Grep Tool — 内容搜索工具
 *
 * 提供 Claude Code / Codex CLI 同款的内容搜索能力:
 * - 正则表达式搜索文件内容
 * - 支持文件类型过滤
 * - 返回匹配行 + 上下文
 * - 自动跳过 node_modules, .git 等目录
 *
 * @module grepTool
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, extname, resolve, sep } from "node:path";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build",
  ".cache", "__pycache__", "venv", ".venv", "coverage",
]);

const IGNORE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp",
  ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4",
  ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib",
  ".lock", ".map", ".pdf",
]);

const MAX_FILE_SIZE = 500_000; // skip files > 500KB
const MAX_RESULTS = 200;
const MAX_FILES_SCANNED = 3000;

/**
 * 递归搜索文件内容。
 */
async function searchFiles(rootDir, regex, options, results, stats) {
  if (stats.filesScanned >= MAX_FILES_SCANNED || results.length >= MAX_RESULTS) return;

  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (stats.filesScanned >= MAX_FILES_SCANNED || results.length >= MAX_RESULTS) break;
    const fullPath = join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        await searchFiles(fullPath, regex, options, results, stats);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (IGNORE_EXTS.has(ext)) continue;

      // File type filter
      if (options.fileFilter && !options.fileFilter.test(entry.name) && !options.fileFilter.test(ext)) {
        continue;
      }

      try {
        const fileStat = await stat(fullPath);
        if (fileStat.size > MAX_FILE_SIZE) continue;

        stats.filesScanned++;
        const content = await readFile(fullPath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= MAX_RESULTS) break;
          const match = regex.test(lines[i]);
          if (match) {
            const contextBefore = options.contextLines > 0
              ? lines.slice(Math.max(0, i - options.contextLines), i)
              : [];
            const contextAfter = options.contextLines > 0
              ? lines.slice(i + 1, i + 1 + options.contextLines)
              : [];

            results.push({
              file: relative(options.baseDir, fullPath),
              line: i + 1,
              content: lines[i],
              contextBefore,
              contextAfter,
            });
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  }
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
 * 创建 grep_tool。
 */
export function createGrepTool() {
  return buildTool({
    name: "grep",
    description: `A powerful content search tool using regular expressions.
Searches file contents and returns matching lines with optional context.
Use this to find code patterns, function usages, imports, etc.`,
    inputSchema: createInputSchema(
      {
        pattern: {
          type: "string",
          description: "Regular expression pattern to search for (e.g. 'function\\s+\\w+', 'import.*from')",
        },
        path: {
          type: "string",
          description: "Directory or file to search in (defaults to project root)",
        },
        file_filter: {
          type: "string",
          description: "Filter files by glob pattern (e.g. '*.js', '*.ts', '*.{js,ts}')",
        },
        case_insensitive: {
          type: "boolean",
          description: "Case insensitive search (default false)",
        },
        context_lines: {
          type: "integer",
          description: "Number of context lines before and after each match (default 0)",
        },
        max_results: {
          type: "integer",
          description: "Maximum results to return (default 50, max 200)",
        },
      },
      ["pattern"]
    ),
    requiredPermissions: ["file:read"],
    isReadOnly: true,

    async execute(params) {
      const {
        pattern,
        path: searchPath,
        file_filter,
        case_insensitive = false,
        context_lines = 0,
        max_results = 50,
      } = params;

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

      // Path existence check
      if (!existsSync(baseDir)) {
        return {
          status: "error",
          error: `Search path does not exist: ${baseDir}`,
          code: "PATH_NOT_FOUND",
        };
      }

      const limit = Math.min(max_results, MAX_RESULTS);
      const safeContextLines = Math.max(0, context_lines || 0);

      // Build regex
      let regex;
      try {
        const flags = case_insensitive ? "i" : "";
        regex = new RegExp(pattern, flags);
      } catch (err) {
        return {
          status: "error",
          error: `Invalid regex pattern: ${err.message}`,
          code: "INVALID_REGEX",
        };
      }

      // Build file filter
      let fileFilter = null;
      if (file_filter) {
        try {
          const escaped = file_filter
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");
          fileFilter = new RegExp(escaped);
        } catch {
          // ignore invalid file filter
        }
      }

      const results = [];
      const stats = { filesScanned: 0 };

      await searchFiles(baseDir, regex, { baseDir, fileFilter, contextLines: safeContextLines }, results, stats);

      return {
        status: "success",
        pattern,
        searchPath: baseDir,
        filesScanned: stats.filesScanned,
        matchCount: results.length,
        matches: results.slice(0, limit).map((r) => ({
          file: r.file,
          line: r.line,
          content: r.content,
          ...(r.contextBefore.length > 0 ? { contextBefore: r.contextBefore } : {}),
          ...(r.contextAfter.length > 0 ? { contextAfter: r.contextAfter } : {}),
        })),
        truncated: results.length > limit,
      };
    },
  });
}
