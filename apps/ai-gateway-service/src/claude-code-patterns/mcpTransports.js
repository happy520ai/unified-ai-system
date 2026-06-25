/**
 * MCP Transports - stdio / HTTP(SSE) transport layer and config validation
 *
 * Extracted from mcpBridge.js to keep the bridge module under 500 lines.
 *
 * @module mcpTransports
 */

import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

// ============================================================
// Safe environment builder
// ============================================================

/**
 * Build a safe environment for child processes.
 * Only allowlisted system variables are passed; config.env overrides are merged.
 */
export function buildSafeEnv(configEnv) {
  const ALLOWED_VARS = [
    "PATH", "HOME", "USER", "LANG", "LC_ALL", "TERM",
    "TMPDIR", "TEMP", "TMP", "SYSTEMROOT",
    "NODE_PATH", "NODE_OPTIONS",
  ];
  const safe = {};
  for (const key of ALLOWED_VARS) {
    if (globalThis.process.env[key] !== undefined) {
      safe[key] = globalThis.process.env[key];
    }
  }
  // Merge caller-specified overrides (config.env)
  if (configEnv && typeof configEnv === "object") {
    Object.assign(safe, configEnv);
  }
  return safe;
}

// ============================================================
// MCP server config validation
// ============================================================

/**
 * MCP 服务器配置 Schema
 * 借鉴 Claude Code 的 McpServerConfigSchema:
 * - stdio: { command, args?, env? }
 * - http: { url, headers? }
 */
export function validateServerConfig(config) {
  const errors = [];
  if (!config.name) errors.push("服务器配置必须有 name");
  if (!config.transport) errors.push("服务器配置必须有 transport 类型 (stdio/http)");

  if (config.transport === "stdio") {
    if (!config.command) errors.push("stdio transport 必须有 command");
  } else if (config.transport === "http") {
    if (!config.url) errors.push("http transport 必须有 url");
    try {
      new URL(config.url);
    } catch {
      errors.push("http transport 的 url 格式无效");
    }
  } else {
    errors.push(`不支持的 transport 类型: ${config.transport}`);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Stdio Transport - 通过标准输入/输出通信
// ============================================================

/**
 * 创建 stdio transport 连接
 * 借鉴 Claude Code 中通过 spawn 子进程连接 MCP 服务器的模式
 *
 * @param {Object} config - 服务器配置
 * @returns {Object} transport 实例
 */
export function createStdioTransport(config) {
  const emitter = new EventEmitter();
  let process = null;
  let buffer = "";
  let connected = false;
  let _forceKillTimer = null;

  return {
    type: "stdio",
    config,

    /**
     * 启动子进程并建立连接
     */
    async connect() {
      return new Promise((resolve, reject) => {
        try {
          // Security: never use shell:true to prevent command injection.
          // On Windows, resolve .cmd/.bat wrappers explicitly.
          let resolvedCommand = config.command;
          let resolvedArgs = config.args || [];
          if (globalThis.process.platform === "win32") {
            // npm/npx and similar commands are .cmd scripts on Windows
            const cmdCommands = ["npm", "npx", "yarn", "pnpm", "node", "codex"];
            const baseName = config.command.replace(/\.exe$/i, "");
            if (cmdCommands.includes(baseName) && !config.command.endsWith(".cmd") && !config.command.endsWith(".bat")) {
              resolvedCommand = config.command + ".cmd";
            }
          }

          process = spawn(resolvedCommand, resolvedArgs, {
            env: buildSafeEnv(config.env),
            stdio: ["pipe", "pipe", "pipe"],
            shell: false,
          });

          process.stdout.on("data", (chunk) => {
            buffer += chunk.toString();
            // Security: cap stdio buffer at 1 MB to prevent memory exhaustion from messages without newlines
            const MAX_STDIO_BUFFER = 1_048_576;
            if (buffer.length > MAX_STDIO_BUFFER) {
              emitter.emit("error", new Error(`MCP stdio buffer exceeded ${MAX_STDIO_BUFFER} bytes, truncating.`));
              buffer = "";
              return;
            }
            // 按行分割 JSON-RPC 消息
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                try {
                  const msg = JSON.parse(trimmed);
                  emitter.emit("message", msg);
                } catch {
                  // 非 JSON 行，忽略（可能是调试输出）
                }
              }
            }
          });

          process.stderr.on("data", (chunk) => {
            emitter.emit("stderr", chunk.toString());
          });

          // Prevent unhandled error crash when stdin pipe is closed
          process.stdin.on("error", () => { connected = false; });

          process.on("error", (err) => {
            connected = false;
            emitter.emit("error", err);
            reject(err);
          });

          process.on("exit", (code) => {
            connected = false;
            emitter.emit("disconnect", { code });
          });

          // 短暂延迟确认进程启动成功
          setTimeout(() => {
            if (process && !process.killed) {
              connected = true;
              resolve();
            } else {
              reject(new Error("进程启动失败"));
            }
          }, 200);
        } catch (err) {
          reject(err);
        }
      });
    },

    /**
     * 发送 JSON-RPC 消息
     */
    send(message) {
      if (!connected || !process || process.killed) {
        throw new Error("stdio transport 未连接");
      }
      const data = JSON.stringify(message) + "\n";
      process.stdin.write(data);
    },

    /**
     * 断开连接
     */
    disconnect() {
      if (_forceKillTimer) { clearTimeout(_forceKillTimer); _forceKillTimer = null; }
      if (process && !process.killed) {
        process.kill("SIGTERM");
        _forceKillTimer = setTimeout(() => {
          if (process && !process.killed) {
            process.kill("SIGKILL");
          }
          _forceKillTimer = null;
        }, 5000);
      }
      connected = false;
    },

    isConnected() {
      return connected;
    },

    on(event, handler) {
      emitter.on(event, handler);
    },

    off(event, handler) {
      emitter.off(event, handler);
    },
  };
}

// ============================================================
// HTTP Transport - 通过 HTTP + SSE 通信
// ============================================================

/**
 * 异步读取 SSE 流
 */
export async function readSseStream(response, emitter) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const MAX_SSE_BUFFER = 1024 * 1024; // 1MB cap to prevent OOM

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Security: prevent unbounded buffer growth on malformed SSE
    if (buffer.length > MAX_SSE_BUFFER) {
      reader.cancel();
      emitter.emit("error", new Error(`MCP SSE stream buffer exceeded ${MAX_SSE_BUFFER} bytes`));
      return;
    }

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventText of events) {
      const dataLines = eventText
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6));

      for (const data of dataLines) {
        try {
          const msg = JSON.parse(data);
          emitter.emit("message", msg);
        } catch {
          // 非 JSON 数据，跳过
        }
      }
    }
  }
}

/**
 * 创建 HTTP transport 连接
 * 借鉴 Claude Code 中 HTTP/SSE 方式的 MCP 连接模式
 *
 * @param {Object} config - 服务器配置
 * @returns {Object} transport 实例
 */
export function createHttpTransport(config) {
  const emitter = new EventEmitter();
  let connected = false;
  let abortController = null;

  return {
    type: "http",
    config,

    /**
     * 建立 SSE 连接
     */
    async connect() {
      abortController = new AbortController();
      try {
        // 尝试通过 SSE 建立持久连接
        const sseUrl = config.url.replace(/\/$/, "") + "/sse";
        const response = await fetch(sseUrl, {
          headers: {
            Accept: "text/event-stream",
            ...(config.headers || {}),
          },
          signal: abortController.signal,
        });

        if (response.ok) {
          connected = true;
          // 异步读取 SSE 流
          readSseStream(response, emitter).catch((err) => {
            emitter.emit("error", err);
          });
        } else {
          // 回退到普通 HTTP 轮询模式
          connected = true;
        }

        emitter.emit("connected");
      } catch (err) {
        if (err.name !== "AbortError") {
          // 连接失败但仍标记为可用（降级为无状态 HTTP 调用）
          connected = true;
          emitter.emit("fallback", { mode: "stateless-http" });
        }
      }
    },

    /**
     * 发送 JSON-RPC 消息（HTTP POST）
     */
    async send(message) {
      const url = config.url.replace(/\/$/, "") + "/message";
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.headers || {}),
          },
          body: JSON.stringify(message),
          signal: abortController?.signal,
        });
        if (response.ok) {
          const result = await response.json().catch(() => null);
          if (result) {
            emitter.emit("message", result);
          }
        } else {
          emitter.emit("error", new Error(`HTTP ${response.status}: ${response.statusText}`));
        }
      } catch (err) {
        emitter.emit("error", err);
      }
    },

    /**
     * 断开连接
     */
    disconnect() {
      if (abortController) {
        abortController.abort();
      }
      connected = false;
    },

    isConnected() {
      return connected;
    },

    on(event, handler) {
      emitter.on(event, handler);
    },

    off(event, handler) {
      emitter.off(event, handler);
    },
  };
}
