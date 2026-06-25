/**
 * Auto Context Selector — 自动上下文选择引擎
 *
 * 对标 Codex CLI / Claude Code 的核心能力:
 * 自动判断"这个任务该读哪些文件来理解代码库"。
 *
 * 策略:
 *   1. 扫描项目结构 (目录树)
 *   2. 读取入口文件 (package.json, index.js, main 等)
 *   3. 关键词相关性评分 (从 goal 提取关键词,对文件路径和内容片段打分)
 *   4. 返回 top-N 最相关文件列表,供 agentic loop 注入上下文
 *
 * @module autoContext
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, extname, basename, dirname, resolve } from "node:path";

// 忽略的目录和文件
const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".nuxt", "dist", "build",
  ".cache", ".output", "__pycache__", "venv", ".venv",
  "legacy", ".codex-handoff", ".data", "coverage",
]);

const IGNORE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp",
  ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4",
  ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib",
  ".lock", ".map",
]);

const ENTRY_FILES = new Set([
  "package.json", "tsconfig.json", "Cargo.toml", "pyproject.toml",
  "go.mod", "Makefile", "Dockerfile", "docker-compose.yml",
  "README.md", "AGENTS.md", "CLAUDE.md", "INSTRUCTIONS.md",
  "index.js", "index.ts", "main.js", "main.ts",
  "app.js", "app.ts", "server.js", "server.ts",
]);

const HIGH_VALUE_EXTS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".rb",
  ".md", ".yaml", ".yml", ".json", ".toml",
]);

const MAX_SCAN_FILES = 5000;
const MAX_FILE_READ_BYTES = 50_000;

/**
 * 创建自动上下文选择器。
 *
 * @param {Object} [options]
 * @param {string} [options.workingDirectory] - 项目根目录
 * @param {number} [options.maxFiles=20] - 返回的最大文件数
 * @param {number} [options.maxScanDepth=5] - 最大扫描深度
 * @returns {Object} 上下文选择器
 */
export function createAutoContext(options = {}) {
  const workingDir = options.workingDirectory || process.cwd();
  const maxFiles = options.maxFiles ?? 20;
  const maxScanDepth = options.maxScanDepth ?? 5;

  /**
   * 扫描项目结构,返回文件清单。
   * @param {string} [rootDir]
   * @param {number} [depth=0]
   * @returns {{ path: string, relativePath: string, size: number, ext: string }[]}
   */
  async function scanProject(rootDir, depth = 0) {
    const results = [];
    if (depth > maxScanDepth || results.length > MAX_SCAN_FILES) return results;

    const dir = rootDir || workingDir;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (results.length > MAX_SCAN_FILES) break;
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          const subResults = await scanProject(fullPath, depth + 1);
            results.push(...subResults);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!IGNORE_EXTS.has(ext) && HIGH_VALUE_EXTS.has(ext)) {
          try {
            const fileStat = await stat(fullPath);
            results.push({
              path: fullPath,
              relativePath: relative(workingDir, fullPath),
              size: fileStat.size,
              ext,
              name: entry.name,
            });
          } catch {
            // skip unreadable files
          }
        }
      }
    }

    return results;
  }

  /**
   * 从 goal 中提取关键词。
   * 简单的分词 + 停用词过滤。
   */
  function extractKeywords(goal) {
    const stopwords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been",
      "to", "of", "in", "for", "on", "with", "at", "by", "from",
      "and", "or", "not", "this", "that", "it", "as", "if", "do",
      "请", "帮", "我", "把", "的", "了", "和", "是", "在", "有",
      "实现", "添加", "创建", "修改", "修复", "删除", "增加",
    ]);

    // Split on non-alphanumeric and non-CJK boundaries
    const tokens = goal
      .replace(/[.,!?;:'"()\[\]{}<>]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !stopwords.has(t.toLowerCase()));

    // Deduplicate and lowercase
    return [...new Set(tokens.map((t) => t.toLowerCase()))];
  }

  /**
   * 计算文件与关键词的相关性分数。
   */
  function scoreFile(file, keywords) {
    let score = 0;
    const relPath = file.relativePath.toLowerCase();
    const name = file.name.toLowerCase();

    // Entry files get high base score
    if (ENTRY_FILES.has(file.name)) {
      score += 50;
    }

    // Path keyword matching
    for (const kw of keywords) {
      if (relPath.includes(kw)) {
        score += 10;
      }
      if (name.includes(kw)) {
        score += 15; // filename match is stronger
      }
    }

    // Prefer smaller files (likely more focused)
    if (file.size < 5000) score += 5;
    else if (file.size < 20000) score += 3;

    // Prefer source files over config
    if ([".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".rs"].includes(file.ext)) {
      score += 3;
    }

    return score;
  }

  /**
   * 读取文件的头部内容 (最多 MAX_FILE_READ_BYTES 字节)。
   */
  async function readFileHead(filePath) {
    try {
      const { stat: fileStat } = await import("node:fs/promises");
      const st = await fileStat(filePath);
      if (st.size > MAX_FILE_READ_BYTES * 4) {
        // For very large files, use bounded stream read
        const { createReadStream } = await import("node:fs");
        return new Promise((resolve) => {
          let data = "";
          const rs = createReadStream(filePath, { encoding: "utf-8", end: MAX_FILE_READ_BYTES - 1 });
          rs.on("data", (chunk) => { data += chunk; });
          rs.on("end", () => resolve(data));
          rs.on("error", () => resolve(""));
        });
      }
      const content = await readFile(filePath, "utf-8");
      return content.slice(0, MAX_FILE_READ_BYTES);
    } catch {
      return "";
    }
  }

  /**
   * 根据用户目标自动选择最相关的文件。
   *
   * @param {string} goal - 用户目标/任务描述
   * @param {Object} [hints] - 额外提示
   * @param {string[]} [hints.changedFiles] - 已知变更的文件
   * @param {string[]} [hints.focusDirs] - 聚焦目录列表
   * @returns {Object} 自动上下文选择结果
   */
  async function selectContext(goal, hints = {}) {
    const keywords = extractKeywords(goal);
    const allFiles = await scanProject();

    // Score all files
    const scored = allFiles.map((f) => ({
      ...f,
      score: scoreFile(f, keywords),
    }));

    // Boost files in focus directories
    if (Array.isArray(hints.focusDirs)) {
      for (const f of scored) {
        for (const dir of hints.focusDirs) {
          if (f.relativePath.startsWith(dir)) {
            f.score += 20;
          }
        }
      }
    }

    // Boost changed files
    if (Array.isArray(hints.changedFiles)) {
      const changedSet = new Set(hints.changedFiles.map((p) => p.toLowerCase()));
      for (const f of scored) {
        if (changedSet.has(f.relativePath.toLowerCase()) || changedSet.has(f.path.toLowerCase())) {
          f.score += 30;
        }
      }
    }

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, maxFiles).filter((f) => f.score > 0);

    // Build context summary
    const directoryTree = buildDirectorySummary(allFiles);
    const entryFiles = allFiles.filter((f) => ENTRY_FILES.has(f.name));

    return {
      goal,
      keywords,
      totalFilesScanned: allFiles.length,
      selectedFiles: selected.map((f) => ({
        path: f.path,
        relativePath: f.relativePath,
        score: f.score,
        size: f.size,
      })),
      selectedCount: selected.length,
      directoryTree,
      entryFiles: entryFiles.map((f) => f.relativePath),
      suggestions: generateSuggestions(keywords, allFiles, selected),
    };
  }

  /**
   * 构建目录结构摘要。
   */
  function buildDirectorySummary(files) {
    const dirs = new Map();
    for (const f of files) {
      const dir = dirname(f.relativePath);
      if (!dirs.has(dir)) dirs.set(dir, 0);
      dirs.set(dir, dirs.get(dir) + 1);
    }
    return [...dirs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([dir, count]) => `${dir}/ (${count} files)`);
  }

  /**
   * 生成上下文建议 (给 LLM 的提示文本)。
   */
  function generateSuggestions(keywords, allFiles, selected) {
    const suggestions = [];

    if (selected.length === 0) {
      suggestions.push("No highly relevant files found. Consider reading entry files (package.json, index.js) first to understand the project structure.");
    }

    // Check if there are test files
    const testFiles = allFiles.filter((f) =>
      f.name.includes("test") || f.name.includes("spec") ||
      f.relativePath.includes("__tests__") || f.relativePath.includes("/test/")
    );
    if (testFiles.length > 0) {
      suggestions.push(`${testFiles.length} test files found. Consider reading relevant tests for context.`);
    }

    // Check for config files
    const configFiles = allFiles.filter((f) =>
      f.name.endsWith(".json") || f.name.endsWith(".yaml") || f.name.endsWith(".yml") || f.name.endsWith(".toml")
    );
    if (configFiles.length > 0 && keywords.some((k) => ["config", "配置", "setting", "设置"].includes(k))) {
      suggestions.push(`Configuration files found: ${configFiles.slice(0, 5).map((f) => f.relativePath).join(", ")}`);
    }

    return suggestions;
  }

  /**
   * 生成可直接注入 system prompt 的上下文文本。
   *
   * @param {string} goal
   * @param {Object} [hints]
   * @returns {string} 注入文本
   */
  async function buildContextPrompt(goal, hints) {
    const ctx = await selectContext(goal, hints);
    const parts = [];

    parts.push(`## Project Context (auto-selected ${ctx.selectedCount} files from ${ctx.totalFilesScanned})`);
    parts.push("");

    if (ctx.directoryTree.length > 0) {
      parts.push("### Directory Structure");
      parts.push(ctx.directoryTree.slice(0, 15).join("\n"));
      parts.push("");
    }

    if (ctx.selectedFiles.length > 0) {
      parts.push("### Most Relevant Files (read these first)");
      for (const f of ctx.selectedFiles.slice(0, 10)) {
        parts.push(`- ${f.relativePath} (score: ${f.score}, ${f.size} bytes)`);
      }
      parts.push("");
    }

    if (ctx.suggestions.length > 0) {
      parts.push("### Suggestions");
      parts.push(ctx.suggestions.join("\n"));
    }

    return parts.join("\n");
  }

  return {
    selectContext,
    buildContextPrompt,
    scanProject,
    extractKeywords,
  };
}
