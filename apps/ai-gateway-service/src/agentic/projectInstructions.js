/**
 * Project Instructions — 项目指令文件系统
 *
 * 对标 Codex CLI 的 codex.md / Claude Code 的 CLAUDE.md:
 * - 读取项目根目录的 INSTRUCTIONS.md (或 AGENTS.md / CLAUDE.md / codex.md)
 * - 自动注入到每次 agentic 会话的 system prompt
 * - 支持目录级指令 (子目录的指令覆盖/补充父目录)
 *
 * @module projectInstructions
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";

/**
 * 已知的指令文件名 (按优先级排序)。
 */
const INSTRUCTION_FILE_NAMES = [
  "INSTRUCTIONS.md",
  "AGENTS.md",
  "CLAUDE.md",
  "codex.md",
  ".cursorrules",
];

const MAX_INSTRUCTION_BYTES = 100_000;

/**
 * 创建项目指令加载器。
 *
 * @param {Object} [options]
 * @param {string} [options.workingDirectory] - 项目根目录
 * @param {boolean} [options.includeDirectoryInstructions=true] - 是否加载子目录指令
 * @returns {Object} 指令加载器
 */
export function createProjectInstructions(options = {}) {
  const workingDir = options.workingDirectory || process.cwd();
  const includeDirectoryInstructions = options.includeDirectoryInstructions ?? true;

  /**
   * 查找目录中的指令文件。
   * @param {string} dir
   * @returns {string|null} 指令文件路径,或 null
   */
  function findInstructionFile(dir) {
    for (const name of INSTRUCTION_FILE_NAMES) {
      const filePath = join(dir, name);
      if (existsSync(filePath)) {
        try {
          const stat = statSync(filePath);
          if (stat.isFile() && stat.size < MAX_INSTRUCTION_BYTES) {
            return filePath;
          }
        } catch {
          // skip
        }
      }
    }
    return null;
  }

  /**
   * 读取指令文件内容。
   * @param {string} filePath
   * @returns {string} 内容
   */
  function readInstructionFile(filePath) {
    try {
      return readFileSync(filePath, "utf-8").slice(0, MAX_INSTRUCTION_BYTES);
    } catch {
      return "";
    }
  }

  /**
   * 加载项目根目录的指令。
   * @returns {{ filePath: string, content: string, fileName: string } | null}
   */
  function loadRootInstructions() {
    const filePath = findInstructionFile(workingDir);
    if (!filePath) return null;

    return {
      filePath,
      fileName: filePath.split(/[\\/]/).pop(),
      content: readInstructionFile(filePath),
    };
  }

  /**
   * 加载指定路径的目录级指令链 (从根目录到目标路径)。
   * 子目录的指令追加在父目录之后。
   *
   * @param {string} targetPath - 目标文件/目录路径
   * @returns {{ dir: string, filePath: string, content: string }[]}
   */
  function loadDirectoryChain(targetPath) {
    if (!includeDirectoryInstructions) return [];

    const absTarget = resolve(workingDir, targetPath);
    const chain = [];
    let current = workingDir;

    // Collect directories from root to target
    const dirs = [current];
    const relPath = relative(workingDir, absTarget);
    if (relPath && !relPath.startsWith("..")) {
      const parts = relPath.split(/[\\/]/);
      for (const part of parts) {
        current = join(current, part);
        dirs.push(current);
      }
    }

    // Load instruction files from each directory (skip root — already loaded separately)
    for (let i = 1; i < dirs.length; i++) {
      const dir = dirs[i];
      const filePath = findInstructionFile(dir);
      if (filePath) {
        chain.push({
          dir: relative(workingDir, dir) || ".",
          filePath,
          content: readInstructionFile(filePath),
        });
      }
    }

    return chain;
  }

  /**
   * 构建完整的指令文本,用于注入 system prompt。
   *
   * @param {Object} [context]
   * @param {string} [context.targetFile] - 当前操作的目标文件路径
   * @returns {string} 完整的指令文本
   */
  function buildInstructionsPrompt(context = {}) {
    const parts = [];

    // Root instructions
    const root = loadRootInstructions();
    if (root) {
      parts.push(`## Project Instructions (from ${root.fileName})`);
      parts.push("");
      parts.push(root.content);
      parts.push("");
    }

    // Directory-level instructions
    if (context.targetFile) {
      const chain = loadDirectoryChain(context.targetFile);
      for (const item of chain) {
        parts.push(`## Directory Instructions (from ${item.dir}/)`);
        parts.push("");
        parts.push(item.content);
        parts.push("");
      }
    }

    if (parts.length === 0) {
      return "";
    }

    return parts.join("\n");
  }

  /**
   * 获取项目指令元信息。
   * @returns {Object}
   */
  function getInstructionInfo() {
    const root = loadRootInstructions();
    return {
      workingDirectory: workingDir,
      hasRootInstructions: root !== null,
      rootFileName: root?.fileName || null,
      rootFilePath: root?.filePath || null,
      supportedFileNames: INSTRUCTION_FILE_NAMES,
    };
  }

  return {
    loadRootInstructions,
    loadDirectoryChain,
    buildInstructionsPrompt,
    getInstructionInfo,
    findInstructionFile,
  };
}
