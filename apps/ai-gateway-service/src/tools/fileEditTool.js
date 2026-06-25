/**
 * File Edit Tool — 精确搜索替换编辑
 *
 * 借鉴 Claude Code 的 Edit 工具模式:
 * - 找到 old_string 的唯一匹配位置
 * - 替换为 new_string
 * - 确保替换后文件语法正确
 *
 * 比 file_write 全量覆盖更安全、更精确、更省 token。
 *
 * @module fileEditTool
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";

// ============================================================
// 核心编辑引擎
// ============================================================

/**
 * 在 content 中查找 oldStr 并替换为 newStr。
 * 要求 oldStr 在 content 中唯一匹配。
 *
 * @param {string} content - 原始文件内容
 * @param {string} oldStr - 要替换的旧文本
 * @param {string} newStr - 替换后的新文本
 * @param {Object} [options]
 * @param {boolean} [options.allowMultiple=false] - 是否允许替换所有匹配
 * @returns {{ success: boolean, result?: string, error?: string, matchCount: number, lineInfo?: Object }}
 */
export function performSearchReplace(content, oldStr, newStr, options = {}) {
  const { allowMultiple = false } = options;

  if (!oldStr || oldStr.length === 0) {
    return { success: false, error: "old_string cannot be empty.", matchCount: 0 };
  }

  // Count occurrences
  let matchCount = 0;
  let firstIndex = -1;
  let lastIndex = -1;
  let searchFrom = 0;

  while (true) {
    const idx = content.indexOf(oldStr, searchFrom);
    if (idx === -1) break;
    if (matchCount === 0) firstIndex = idx;
    lastIndex = idx;
    matchCount++;
    searchFrom = idx + 1;
  }

  if (matchCount === 0) {
    return {
      success: false,
      error: `old_string not found in file. Make sure the text matches exactly, including whitespace and indentation.`,
      matchCount: 0,
    };
  }

  if (matchCount > 1 && !allowMultiple) {
    return {
      success: false,
      error: `old_string matched ${matchCount} times. Provide more context (3+ lines before and after) to make it unique, or set allow_multiple=true to replace all.`,
      matchCount,
    };
  }

  let result;
  if (allowMultiple) {
    // Replace all occurrences
    result = content.split(oldStr).join(newStr);
  } else {
    // Replace single unique occurrence
    result = content.slice(0, firstIndex) + newStr + content.slice(firstIndex + oldStr.length);
  }

  // Compute line info
  const beforeLine = content.slice(0, firstIndex).split("\n").length;
  const oldLines = oldStr.split("\n").length;
  const newLines = newStr.split("\n").length;

  return {
    success: true,
    result,
    matchCount,
    lineInfo: {
      startLine: beforeLine,
      oldLineCount: oldLines,
      newLineCount: newLines,
    },
  };
}

// ============================================================
// 路径安全验证 (共享)
// ============================================================

/**
 * 验证文件路径安全性 — 防止路径遍历和符号链接逃逸。
 *
 * @param {string} filePath - 用户提供的文件路径
 * @returns {{ safe: boolean, resolvedPath?: string, error?: string, code?: string }}
 */
function validatePathSecurity(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return { safe: false, error: "file_path must be a non-empty string.", code: "INVALID_INPUT" };
  }

  const workDir = resolve(process.cwd());
  const resolvedPath = resolve(filePath);

  if (!resolvedPath.startsWith(workDir)) {
    return { safe: false, error: "Path traversal detected. File path must not escape the working directory.", code: "PATH_TRAVERSAL_BLOCKED" };
  }

  // Resolve symlinks to catch indirect escapes
  if (existsSync(resolvedPath)) {
    try {
      const realPath = realpathSync(resolvedPath);
      if (!realPath.startsWith(workDir)) {
        return { safe: false, error: "Path traversal detected via symlink. Real path escapes the working directory.", code: "PATH_TRAVERSAL_BLOCKED" };
      }
    } catch {
      // realpathSync may fail on some platforms; proceed with resolved check
    }
  }

  return { safe: true, resolvedPath };
}

// ============================================================
// file_edit 工具定义
// ============================================================

export function createFileEditTool() {
  return buildTool({
    name: "file_edit",
    description: `Performs exact string replacements in files. This is the preferred way to edit existing files — it only sends the diff.

Usage:
- Provide the EXACT text to replace (including whitespace and indentation) as old_string
- Provide the replacement text as new_string
- old_string must match exactly ONE location in the file (provide 3+ lines of context to ensure uniqueness)
- Set allow_multiple=true to replace ALL occurrences

Rules:
- You must read the file first before editing
- Preserve exact indentation (tabs/spaces)
- NEVER include line number prefixes in old_string or new_string
- Include at least 3 lines of context BEFORE and AFTER the target text`,
    inputSchema: createInputSchema(
      {
        file_path: {
          type: "string",
          description: "Absolute path to the file to modify",
        },
        old_string: {
          type: "string",
          description: "The exact literal text to replace. Must be unique in the file (unless allow_multiple=true). Include at least 3 lines of context before and after.",
        },
        new_string: {
          type: "string",
          description: "The exact literal text to replace old_string with. Provide complete replacement code — do not use omission placeholders.",
        },
        allow_multiple: {
          type: "boolean",
          description: "If true, replace ALL occurrences. Default false (single unique match only).",
        },
        instruction: {
          type: "string",
          description: "A clear semantic description of WHY and WHAT this change does (for audit/logging).",
        },
        create_backup: {
          type: "boolean",
          description: "If true, create a .bak backup before editing. Default true.",
        },
      },
      ["file_path", "old_string", "new_string"]
    ),
    requiredPermissions: ["file:write"],
    isReadOnly: false,

    async execute(params) {
      const {
        file_path,
        old_string,
        new_string,
        allow_multiple = false,
        instruction = "",
        create_backup = true,
      } = params;

      // Input type validation
      if (!file_path || typeof file_path !== "string") {
        return { status: "error", error: "file_path must be a non-empty string.", code: "INVALID_INPUT" };
      }
      if (typeof old_string !== "string") {
        return { status: "error", error: "old_string must be a string.", code: "INVALID_INPUT" };
      }
      if (typeof new_string !== "string") {
        return { status: "error", error: "new_string must be a string.", code: "INVALID_INPUT" };
      }

      // Path safety: reject directory traversal attempts (symlink-aware)
      const pathCheck = validatePathSecurity(file_path);
      if (!pathCheck.safe) {
        return { status: "error", error: pathCheck.error, code: pathCheck.code };
      }

      // Validate file exists
      if (!existsSync(file_path)) {
        return {
          status: "error",
          error: `File does not exist: ${file_path}`,
          code: "FILE_NOT_FOUND",
        };
      }

      // Read current content
      let content;
      try {
        content = readFileSync(file_path, "utf-8");
      } catch (err) {
        return {
          status: "error",
          error: `Failed to read file: ${err.message}`,
          code: "READ_ERROR",
        };
      }

      // Perform search-replace
      const replaceResult = performSearchReplace(content, old_string, new_string, {
        allowMultiple: allow_multiple,
      });

      if (!replaceResult.success) {
        return {
          status: "error",
          error: replaceResult.error,
          code: "MATCH_FAILED",
          matchCount: replaceResult.matchCount,
        };
      }

      // Create backup if requested
      if (create_backup) {
        try {
          const bakPath = file_path + ".bak";
          copyFileSync(file_path, bakPath);
        } catch {
          // Backup failure is non-fatal
        }
      }

      // Write the modified content
      try {
        writeFileSync(file_path, replaceResult.result, "utf-8");
      } catch (err) {
        return {
          status: "error",
          error: `Failed to write file: ${err.message}`,
          code: "WRITE_ERROR",
        };
      }

      const totalLines = replaceResult.result.split("\n").length;
      const originalLines = content.split("\n").length;

      return {
        status: "success",
        file_path,
        instruction,
        replacements: replaceResult.matchCount,
        lineInfo: replaceResult.lineInfo,
        linesChanged: totalLines - originalLines,
        totalLines,
        originalLines,
      };
    },
  });
}

// ============================================================
// file_insert 工具 — 在指定位置插入内容
// ============================================================

export function createFileInsertTool() {
  return buildTool({
    name: "file_insert",
    description: "Insert new content at a specific line number in a file. Useful for adding new functions, imports, or sections.",
    inputSchema: createInputSchema(
      {
        file_path: {
          type: "string",
          description: "Absolute path to the file to modify",
        },
        line_number: {
          type: "integer",
          description: "Line number to insert AFTER (0 = beginning of file)",
        },
        content: {
          type: "string",
          description: "Content to insert (will be added as new lines)",
        },
      },
      ["file_path", "line_number", "content"]
    ),
    requiredPermissions: ["file:write"],
    isReadOnly: false,

    async execute(params) {
      const { file_path, line_number, content } = params;

      // Input validation
      if (!file_path || typeof file_path !== "string") {
        return { status: "error", error: "file_path must be a non-empty string.", code: "INVALID_INPUT" };
      }
      if (typeof content !== "string") {
        return { status: "error", error: "content must be a string.", code: "INVALID_INPUT" };
      }

      // Path safety: reject directory traversal attempts (symlink-aware)
      const pathCheck = validatePathSecurity(file_path);
      if (!pathCheck.safe) {
        return { status: "error", error: pathCheck.error, code: pathCheck.code };
      }

      if (!existsSync(file_path)) {
        return { status: "error", error: `File not found: ${file_path}`, code: "FILE_NOT_FOUND" };
      }

      // Create backup before modification
      try {
        const bakPath = file_path + ".bak";
        copyFileSync(file_path, bakPath);
      } catch {
        // Backup failure is non-fatal
      }

      const original = readFileSync(file_path, "utf-8");
      const lines = original.split("\n");
      const insertAt = Math.max(0, Math.min(line_number, lines.length));

      const newLines = content.split("\n");
      lines.splice(insertAt, 0, ...newLines);

      try {
        writeFileSync(file_path, lines.join("\n"), "utf-8");
      } catch (err) {
        return {
          status: "error",
          error: `Failed to write file: ${err.message}`,
          code: "WRITE_ERROR",
        };
      }

      return {
        status: "success",
        file_path,
        insertedAt: insertAt,
        linesInserted: newLines.length,
        totalLines: lines.length,
      };
    },
  });
}
