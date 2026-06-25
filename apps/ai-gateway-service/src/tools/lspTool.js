/**
 * LSP 代码感知工具集
 *
 * 为 Agentic Loop 提供 Language Server Protocol 集成:
 * - lsp_definition: 查找符号定义（跳转到定义）
 * - lsp_references: 查找符号引用（所有使用处）
 * - lsp_hover: 获取符号类型/文档信息
 * - lsp_symbols: 列出文件中的所有符号
 *
 * 支持的语言服务器:
 * - TypeScript/JavaScript: typescript-language-server
 * - Python: pyright / pylsp
 * - Go: gopls (可选)
 *
 * Low-level LSP client, URI helpers, and operation implementations
 * live in lspHelpers.js.
 *
 * @module lspTool
 */

import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import {
  getLanguageServer,
  createLspClient,
  pathToUri,
  executeDefinition,
  executeReferences,
  executeHover,
  executeSymbols,
} from "./lspHelpers.js";

// ============================================================
// 工具定义工厂（兼容 buildTool 格式）
// ============================================================

/**
 * 创建 LSP 工具集
 *
 * @param {Object} options
 * @param {string} [options.workingDirectory] - 项目根目录
 * @param {string[]} [options.supportedExtensions] - 额外的文件扩展名
 * @returns {Object[]} 工具定义数组（buildTool 格式）
 */
export function createLspTools(options = {}) {
  const { workingDirectory = process.cwd() } = options;
  const maxPoolSize = options.maxPoolSize ?? 5;
  const idleTimeoutMs = options.idleTimeoutMs ?? 5 * 60 * 1000; // 5 minutes
  const evictionIntervalMs = options.evictionIntervalMs ?? 60 * 1000; // check every 60s

  // 活跃的 LSP 客户端池 + 元数据
  const clientPool = new Map(); // key → { client, lastUsedAt }

  // 空闲驱逐定时器
  let evictionTimer = null;

  function startEvictionTimer() {
    if (evictionTimer) return;
    evictionTimer = setInterval(async () => {
      const now = Date.now();
      for (const [key, entry] of clientPool) {
        if (now - entry.lastUsedAt > idleTimeoutMs) {
          try { await entry.client.shutdown(); } catch { /* already dead */ }
          clientPool.delete(key);
        }
      }
      // Stop timer when pool is empty to avoid keeping event loop alive
      if (clientPool.size === 0 && evictionTimer) {
        clearInterval(evictionTimer);
        evictionTimer = null;
      }
    }, evictionIntervalMs);
    // Allow the process to exit even if the timer is running
    if (evictionTimer && typeof evictionTimer.unref === "function") {
      evictionTimer.unref();
    }
  }

  /**
   * Evict the least-recently-used client to make room for a new one
   */
  async function evictLru() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of clientPool) {
      if (entry.lastUsedAt < oldestTime) {
        oldestTime = entry.lastUsedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const entry = clientPool.get(oldestKey);
      try { await entry.client.shutdown(); } catch { /* already dead */ }
      clientPool.delete(oldestKey);
    }
  }

  /**
   * 获取或创建文件对应的 LSP 客户端
   */
  async function getOrCreateClient(filePath) {
    const serverConfig = getLanguageServer(filePath);
    if (!serverConfig) {
      throw new Error(`No LSP server configured for file type: ${extname(filePath)}`);
    }

    const key = serverConfig.command;
    if (clientPool.has(key)) {
      const entry = clientPool.get(key);
      if (entry.client.isInitialized()) {
        entry.lastUsedAt = Date.now();
        return entry.client;
      }
      // Stale client — remove and recreate
      try { await entry.client.shutdown(); } catch { /* already dead */ }
      clientPool.delete(key);
    }

    // Enforce max pool size via LRU eviction
    if (clientPool.size >= maxPoolSize) {
      await evictLru();
    }

    const client = createLspClient(serverConfig, pathToUri(workingDirectory));
    try {
      await client.start();
      clientPool.set(key, { client, lastUsedAt: Date.now() });
      startEvictionTimer();
      return client;
    } catch (err) {
      throw new Error(`Failed to start LSP server "${key}": ${err.message}. Ensure it is installed: npm install -g ${key}`);
    }
  }

  /**
   * 关闭所有 LSP 客户端并停止驱逐定时器
   */
  async function shutdownAll() {
    if (evictionTimer) {
      clearInterval(evictionTimer);
      evictionTimer = null;
    }
    for (const [, entry] of clientPool) {
      await entry.client.shutdown();
    }
    clientPool.clear();
  }

  function createInputSchema(properties, required = []) {
    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  const lspDefinitionTool = {
    name: "lsp_definition",
    description: "查找符号定义（跳转到定义）。给定文件路径和行列位置，返回符号的定义位置。",
    inputSchema: createInputSchema({
      filePath: { type: "string", description: "目标文件的绝对路径" },
      line: { type: "integer", description: "行号（从 0 开始）" },
      character: { type: "integer", description: "列号（从 0 开始）" },
    }, ["filePath", "line", "character"]),
    requiredPermissions: ["lsp:read"],
    isReadOnly: true,
    maxResultSizeChars: 20_000,
    async execute(params) {
      const resolvedWorkdir = resolve(workingDirectory);
      const filePath = resolve(workingDirectory, params.filePath);
      if (!filePath.startsWith(resolvedWorkdir + sep) && filePath !== resolvedWorkdir) {
        return { status: "error", error: "PATH_TRAVERSAL_BLOCKED" };
      }
      if (!existsSync(filePath)) {
        return { found: false, error: `File not found: ${params.filePath}` };
      }
      const client = await getOrCreateClient(filePath);
      return executeDefinition(client, filePath, params.line, params.character);
    },
  };

  const lspReferencesTool = {
    name: "lsp_references",
    description: "查找符号引用。返回符号在项目中被使用的所有位置。",
    inputSchema: createInputSchema({
      filePath: { type: "string", description: "目标文件的绝对路径" },
      line: { type: "integer", description: "行号（从 0 开始）" },
      character: { type: "integer", description: "列号（从 0 开始）" },
    }, ["filePath", "line", "character"]),
    requiredPermissions: ["lsp:read"],
    isReadOnly: true,
    maxResultSizeChars: 50_000,
    async execute(params) {
      const resolvedWorkdir = resolve(workingDirectory);
      const filePath = resolve(workingDirectory, params.filePath);
      if (!filePath.startsWith(resolvedWorkdir + sep) && filePath !== resolvedWorkdir) {
        return { status: "error", error: "PATH_TRAVERSAL_BLOCKED" };
      }
      if (!existsSync(filePath)) {
        return { found: false, error: `File not found: ${params.filePath}` };
      }
      const client = await getOrCreateClient(filePath);
      return executeReferences(client, filePath, params.line, params.character);
    },
  };

  const lspHoverTool = {
    name: "lsp_hover",
    description: "获取符号类型信息和文档。返回 hover 信息，包括类型签名、JSDoc/docstring 等。",
    inputSchema: createInputSchema({
      filePath: { type: "string", description: "目标文件的绝对路径" },
      line: { type: "integer", description: "行号（从 0 开始）" },
      character: { type: "integer", description: "列号（从 0 开始）" },
    }, ["filePath", "line", "character"]),
    requiredPermissions: ["lsp:read"],
    isReadOnly: true,
    maxResultSizeChars: 20_000,
    async execute(params) {
      const resolvedWorkdir = resolve(workingDirectory);
      const filePath = resolve(workingDirectory, params.filePath);
      if (!filePath.startsWith(resolvedWorkdir + sep) && filePath !== resolvedWorkdir) {
        return { status: "error", error: "PATH_TRAVERSAL_BLOCKED" };
      }
      if (!existsSync(filePath)) {
        return { found: false, error: `File not found: ${params.filePath}` };
      }
      const client = await getOrCreateClient(filePath);
      return executeHover(client, filePath, params.line, params.character);
    },
  };

  const lspSymbolsTool = {
    name: "lsp_symbols",
    description: "列出文件中的所有符号（函数、类、变量等）。返回文档符号的层次结构。",
    inputSchema: createInputSchema({
      filePath: { type: "string", description: "目标文件的绝对路径" },
    }, ["filePath"]),
    requiredPermissions: ["lsp:read"],
    isReadOnly: true,
    maxResultSizeChars: 50_000,
    async execute(params) {
      const resolvedWorkdir = resolve(workingDirectory);
      const filePath = resolve(workingDirectory, params.filePath);
      if (!filePath.startsWith(resolvedWorkdir + sep) && filePath !== resolvedWorkdir) {
        return { status: "error", error: "PATH_TRAVERSAL_BLOCKED" };
      }
      if (!existsSync(filePath)) {
        return { found: false, error: `File not found: ${params.filePath}` };
      }
      const client = await getOrCreateClient(filePath);
      return executeSymbols(client, filePath);
    },
  };

  return {
    tools: [lspDefinitionTool, lspReferencesTool, lspHoverTool, lspSymbolsTool],
    shutdownAll,
    getClientCount: () => clientPool.size,
    getPoolStats: () => {
      const stats = [];
      const now = Date.now();
      for (const [key, entry] of clientPool) {
        stats.push({ server: key, idleMs: now - entry.lastUsedAt });
      }
      return { poolSize: clientPool.size, maxPoolSize, idleTimeoutMs, clients: stats };
    },
  };
}

export default createLspTools;
