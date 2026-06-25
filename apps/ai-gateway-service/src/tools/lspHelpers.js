/**
 * LSP Helpers
 *
 * Extracted from lspTool.js — contains the language-server mapping,
 * the simplified stdio LSP client factory, URI conversion utilities,
 * and the four LSP operation implementations (definition, references,
 * hover, document-symbol).
 *
 * @module lspHelpers
 */

import { spawn } from "node:child_process";
import { extname, resolve } from "node:path";

// ============================================================
// 语言 → LSP Server 映射
// ============================================================

export const LANGUAGE_SERVER_MAP = {
  ".ts": { command: "typescript-language-server", args: ["--stdio"], languageId: "typescript" },
  ".tsx": { command: "typescript-language-server", args: ["--stdio"], languageId: "typescriptreact" },
  ".js": { command: "typescript-language-server", args: ["--stdio"], languageId: "javascript" },
  ".jsx": { command: "typescript-language-server", args: ["--stdio"], languageId: "javascriptreact" },
  ".mjs": { command: "typescript-language-server", args: ["--stdio"], languageId: "javascript" },
  ".cjs": { command: "typescript-language-server", args: ["--stdio"], languageId: "javascript" },
  ".py": { command: "pyright-langserver", args: ["--stdio"], languageId: "python" },
  ".pyi": { command: "pyright-langserver", args: ["--stdio"], languageId: "python" },
};

/**
 * 根据文件扩展名获取 LSP 服务器配置
 */
export function getLanguageServer(filePath) {
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_SERVER_MAP[ext] || null;
}

// ============================================================
// LSP Client（简化版 stdio 通信）
// ============================================================

/**
 * 创建简化的 LSP 客户端
 * 通过 stdio 与语言服务器通信
 */
export function createLspClient(serverConfig, rootUri) {
  let process = null;
  let requestId = 0;
  const pendingRequests = new Map();
  let buffer = "";
  let initialized = false;

  function start() {
    return new Promise((resolveStart, rejectStart) => {
      try {
        process = spawn(serverConfig.command, serverConfig.args, {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...globalThis.process.env },
        });

        process.stdout.on("data", (chunk) => {
          buffer += chunk.toString();
          processBuffer();
        });

        process.stderr.on("data", () => {
          // LSP stderr 通常用于日志，忽略
        });

        process.on("error", (err) => {
          rejectStart(new Error(`Failed to start LSP server "${serverConfig.command}": ${err.message}`));
        });

        process.on("exit", (code) => {
          for (const [, entry] of pendingRequests) {
            if (entry.timer) clearTimeout(entry.timer);
            entry.reject(new Error(`LSP server exited with code ${code}`));
          }
          pendingRequests.clear();
          process = null;
          initialized = false;
        });

        // 发送 initialize 请求
        sendRequest("initialize", {
          processId: globalThis.process.pid,
          rootUri,
          capabilities: {
            textDocument: {
              definition: { linkSupport: false },
              references: {},
              hover: { contentFormat: ["plaintext", "markdown"] },
              documentSymbol: { hierarchicalDocumentSymbolSupport: true },
            },
          },
        }).then(() => {
          sendNotification("initialized", {});
          initialized = true;
          resolveStart();
        }).catch(rejectStart);
      } catch (err) {
        rejectStart(err);
      }
    });
  }

  function processBuffer() {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = buffer.slice(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(lengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + contentLength) break;

      const body = buffer.slice(bodyStart, bodyStart + contentLength);
      buffer = buffer.slice(bodyStart + contentLength);

      try {
        const message = JSON.parse(body);
        if (message.id !== undefined && pendingRequests.has(message.id)) {
          const { resolve: resolveReq, reject: rejectReq, timer } = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);
          if (timer) clearTimeout(timer);
          if (message.error) {
            rejectReq(new Error(message.error.message || "LSP error"));
          } else {
            resolveReq(message.result);
          }
        }
      } catch {
        // 解析失败，跳过
      }
    }
  }

  function sendRequest(method, params) {
    return new Promise((resolveReq, rejectReq) => {
      const id = ++requestId;

      // Store a placeholder first — timer will be added below
      const entry = { resolve: resolveReq, reject: rejectReq, timer: null };
      pendingRequests.set(id, entry);

      const message = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;

      try {
        process.stdin.write(header + message);
      } catch (err) {
        pendingRequests.delete(id);
        rejectReq(err);
        return;
      }

      // 10 秒超时 — 超时后标记并强制杀死进程以防僵尸
      entry.timer = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          rejectReq(new Error(`LSP request ${method} timed out after 10s`));
          // Force-kill the LSP process on timeout to prevent zombie processes
          if (process && !process.killed) {
            try { process.kill("SIGTERM"); } catch { /* already dead */ }
            // SIGKILL fallback after 2s grace
            const sigkillTimer = setTimeout(() => {
              try { if (process && !process.killed) process.kill("SIGKILL"); } catch { /* already dead */ }
            }, 2000);
            if (sigkillTimer && typeof sigkillTimer.unref === "function") sigkillTimer.unref();
          }
        }
      }, 10_000);
      // Allow process to exit even if timeout is pending
      if (entry.timer && typeof entry.timer.unref === "function") entry.timer.unref();
    });
  }

  function sendNotification(method, params) {
    const message = JSON.stringify({ jsonrpc: "2.0", method, params });
    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    try {
      process.stdin.write(header + message);
    } catch {
      // 通知失败不阻塞
    }
  }

  function openDocument(uri, text, languageId) {
    sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  async function shutdown() {
    const proc = process;
    if (!proc) return;
    process = null;
    initialized = false;

    // Try graceful shutdown first
    try {
      await Promise.race([
        (async () => {
          await sendRequest("shutdown", null);
          sendNotification("exit", null);
        })(),
        new Promise((r) => setTimeout(r, 3000)), // 3s grace period
      ]);
    } catch {
      // 忽略关闭错误
    }

    // Force kill if still alive
    try {
      if (!proc.killed) proc.kill("SIGTERM");
    } catch { /* already dead */ }

    // SIGKILL fallback after 2s
    setTimeout(() => {
      try { if (!proc.killed) proc.kill("SIGKILL"); } catch { /* already dead */ }
    }, 2000);

    // Clear all pending request timers
    for (const [, entry] of pendingRequests) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    pendingRequests.clear();
  }

  return {
    start,
    sendRequest,
    openDocument,
    shutdown,
    isInitialized: () => initialized,
  };
}

// ============================================================
// URI 转换工具
// ============================================================

/**
 * 将文件路径转为 LSP URI
 */
export function pathToUri(filePath) {
  const normalized = resolve(filePath).replace(/\\/g, "/");
  return `file://${normalized}`;
}

/**
 * 将 LSP URI 转回文件路径
 */
export function uriToPath(uri) {
  if (!uri) return "";
  return uri.replace(/^file:\/\//, "").replace(/\//g, globalThis.process.platform === "win32" ? "\\" : "/");
}

// ============================================================
// LSP 操作实现
// ============================================================

/**
 * 执行 LSP 定义查找
 */
export async function executeDefinition(client, filePath, line, character) {
  const uri = pathToUri(filePath);
  const result = await client.sendRequest("textDocument/definition", {
    textDocument: { uri },
    position: { line, character },
  });

  if (!result) return { found: false, locations: [] };

  const locations = Array.isArray(result) ? result : [result];
  return {
    found: locations.length > 0,
    locations: locations.map((loc) => ({
      path: uriToPath(loc.uri || loc.targetUri),
      line: (loc.range || loc.targetSelectionRange)?.start?.line ?? 0,
      character: (loc.range || loc.targetSelectionRange)?.start?.character ?? 0,
    })),
  };
}

/**
 * 执行 LSP 引用查找
 */
export async function executeReferences(client, filePath, line, character) {
  const uri = pathToUri(filePath);
  const result = await client.sendRequest("textDocument/references", {
    textDocument: { uri },
    position: { line, character },
    context: { includeDeclaration: true },
  });

  if (!result || !Array.isArray(result)) return { found: false, references: [] };

  return {
    found: result.length > 0,
    references: result.map((loc) => ({
      path: uriToPath(loc.uri),
      line: loc.range?.start?.line ?? 0,
      character: loc.range?.start?.character ?? 0,
    })),
  };
}

/**
 * 执行 LSP Hover 信息查询
 */
export async function executeHover(client, filePath, line, character) {
  const uri = pathToUri(filePath);
  const result = await client.sendRequest("textDocument/hover", {
    textDocument: { uri },
    position: { line, character },
  });

  if (!result) return { found: false, contents: "" };

  const contents = result.contents;
  let text = "";
  if (typeof contents === "string") {
    text = contents;
  } else if (contents?.kind === "markdown") {
    text = contents.value;
  } else if (contents?.kind === "plaintext") {
    text = contents.value;
  } else if (Array.isArray(contents)) {
    text = contents.map((c) => (typeof c === "string" ? c : c.value || "")).join("\n");
  }

  return { found: Boolean(text), contents: text };
}

/**
 * 执行 LSP 文档符号列举
 */
export async function executeSymbols(client, filePath) {
  const uri = pathToUri(filePath);
  const result = await client.sendRequest("textDocument/documentSymbol", {
    textDocument: { uri },
  });

  if (!result || !Array.isArray(result)) return { found: false, symbols: [] };

  function flattenSymbols(items, depth = 0) {
    const flat = [];
    for (const item of items) {
      flat.push({
        name: item.name,
        kind: item.kind,
        detail: item.detail || "",
        range: {
          startLine: item.range?.start?.line ?? 0,
          startCharacter: item.range?.start?.character ?? 0,
          endLine: item.range?.end?.line ?? 0,
          endCharacter: item.range?.end?.character ?? 0,
        },
        depth,
      });
      if (item.children) {
        flat.push(...flattenSymbols(item.children, depth + 1));
      }
    }
    return flat;
  }

  return { found: result.length > 0, symbols: flattenSymbols(result) };
}
