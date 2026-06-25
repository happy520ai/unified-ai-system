/**
 * builtInCoreTools.js — Core file I/O and shell execution tools.
 *
 * Split from agentToolRegistry.js for 分层律 compliance.
 */

import { buildTool, createInputSchema } from "./toolCore.js";

// ============================================================
// 内置工具定义
// ============================================================

/**
 * 文件路径安全验证 — 防止路径遍历和敏感路径访问
 * Returns { safe: true } or { safe: false, reason: "..." }
 */
export function validateFilePath(filePath, { allowWrite = false } = {}) {
  if (!filePath || typeof filePath !== "string") {
    return { safe: false, reason: "file_path must be a non-empty string" };
  }

  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");

  // Block null bytes (path truncation attack)
  if (filePath.includes("\0")) {
    return { safe: false, reason: "file_path contains null bytes" };
  }

  // Block explicit path traversal sequences
  const segments = normalized.split("/");
  if (segments.includes("..")) {
    return { safe: false, reason: "file_path contains '..' traversal segments" };
  }

  // Block sensitive file patterns (case-insensitive on Windows)
  const lower = normalized.toLowerCase();
  const sensitivePatterns = [
    /\.env(\.|$|\/)/,
    /\.git(\/|$)/,
    /\/etc\/passwd/,
    /\/etc\/shadow/,
    /\/etc\/sudoers/,
    /\.ssh\//,
    /\.aws\/credentials/,
    /\.npmrc/,
    /\.pypirc/,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(lower)) {
      return { safe: false, reason: `file_path matches sensitive pattern: ${pattern}` };
    }
  }

  return { safe: true };
}

/** Maximum file size for file_read: 10 MB */
const MAX_READ_FILE_SIZE = 10 * 1024 * 1024;
/** Maximum content size for file_write: 50 MB */
const MAX_WRITE_CONTENT_SIZE = 50 * 1024 * 1024;

export function createFileReadTool(workingDirectory = process.cwd()) {
  return buildTool({
    name: "file_read",
    description: "读取文件内容。支持指定行范围（offset/limit）。只读操作，无副作用。文件大小限制 10MB。",
    inputSchema: createInputSchema(
      {
        file_path: {
          type: "string",
          description: "要读取的文件路径（绝对路径或相对于工作目录的路径）",
        },
        offset: {
          type: "integer",
          description: "起始行号（可选，默认从头开始）",
        },
        limit: {
          type: "integer",
          description: "读取行数限制（可选，默认读取全部）",
        },
      },
      ["file_path"]
    ),
    requiredPermissions: ["file:read"],
    isReadOnly: true,
    async execute(params, _context) {
      const { readFileSync, statSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const { file_path, offset, limit } = params;

      // Security: validate path
      const validation = validateFilePath(file_path);
      if (!validation.safe) {
        return { status: "error", error: `Path validation failed: ${validation.reason}` };
      }

      // Resolve to absolute path — relative to workingDirectory
      const resolvedPath = resolve(workingDirectory, file_path);

    // Security: resolve symlinks and verify real path stays within workingDirectory
    try {
      const { realpathSync } = await import("node:fs");
      const { sep } = await import("node:path");
      const realPath = realpathSync(resolvedPath);
      const resolvedWorkdir = realpathSync(workingDirectory);
      if (!realPath.startsWith(resolvedWorkdir + sep) && realPath !== resolvedWorkdir) {
        return { status: "error", error: "Symlink traversal blocked: real path escapes working directory" };
      }
    } catch {
      // realpathSync may fail for non-existent files — allow readFileSync to throw the proper error
    }

    // Security: check file size before reading
    try {
      const stat = statSync(resolvedPath);
      if (stat.size > MAX_READ_FILE_SIZE) {
        return {
          status: "error",
          error: `File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_READ_FILE_SIZE / 1024 / 1024}MB limit. Use offset/limit to read specific ranges.`,
        };
      }
    } catch {
      // statSync may fail if file doesn't exist — let readFileSync throw the proper error
    }

    // Security: detect binary files before reading as UTF-8
    try {
      const { readFileSync: _binCheck } = await import("node:fs");
      const sample = _binCheck(resolvedPath, { encoding: null }); // read as Buffer
      const sampleLen = Math.min(sample.length, 8192);
      for (let i = 0; i < sampleLen; i++) {
        if (sample[i] === 0) {
          return {
            status: "error",
            error: "Binary file detected (contains null bytes). Use a specialized tool for binary files.",
            code: "BINARY_FILE_DETECTED",
          };
        }
      }
    } catch {
      // If sample read fails, let the main readFileSync handle the error
    }

    const content = readFileSync(resolvedPath, "utf-8");
    if (offset != null || limit != null) {
      const lines = content.split("\n");
      const start = (offset || 1) - 1;
      const end = limit ? start + limit : lines.length;
      return {
        status: "success",
        content: lines.slice(start, end).join("\n"),
        totalLines: lines.length,
        range: { offset: start + 1, limit: end - start },
      };
    }
    return {
      status: "success",
      content,
      totalLines: content.split("\n").length,
    };
  },
  });
}

export function createFileWriteTool(workingDirectory = process.cwd()) {
  return buildTool({
  name: "file_write",
  description: "写入或覆盖文件内容。需要 file:write 权限。会自动创建父目录。内容限制 50MB。",
  inputSchema: createInputSchema(
    {
      file_path: {
        type: "string",
        description: "要写入的文件路径（绝对路径或相对于工作目录的路径）",
      },
      content: {
        type: "string",
        description: "要写入的文件内容",
      },
      mode: {
        type: "string",
        enum: ["overwrite", "append"],
        description: "写入模式：overwrite（覆盖）或 append（追加），默认 overwrite",
      },
    },
    ["file_path", "content"]
  ),
  requiredPermissions: ["file:write"],
  isReadOnly: false,
  async execute(params, _context) {
    const { writeFileSync, appendFileSync, mkdirSync, existsSync } = await import("node:fs");
    const { dirname, resolve } = await import("node:path");
    const { file_path, content, mode = "overwrite" } = params;

    // Security: validate path
    const validation = validateFilePath(file_path, { allowWrite: true });
    if (!validation.safe) {
      return { status: "error", error: `Path validation failed: ${validation.reason}` };
    }

    // Security: check content size
    const contentSize = Buffer.byteLength(content, "utf-8");
    if (contentSize > MAX_WRITE_CONTENT_SIZE) {
      return {
        status: "error",
        error: `Content too large: ${(contentSize / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_WRITE_CONTENT_SIZE / 1024 / 1024}MB limit.`,
      };
    }

    const resolvedPath = resolve(workingDirectory, file_path);

    // Security: resolve symlinks and verify real path stays within workingDirectory
    try {
      const { realpathSync, existsSync: _existsSync } = await import("node:fs");
      const { sep } = await import("node:path");
      if (_existsSync(resolvedPath)) {
        const realPath = realpathSync(resolvedPath);
        const resolvedWorkdir = realpathSync(workingDirectory);
        if (!realPath.startsWith(resolvedWorkdir + sep) && realPath !== resolvedWorkdir) {
          return { status: "error", error: "Symlink traversal blocked: real path escapes working directory" };
        }
      }
    } catch {
      // realpathSync may fail for non-existent paths — directory check below handles creation
    }

    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (mode === "append") {
      appendFileSync(resolvedPath, content, "utf-8");
    } else {
      // Security: create backup before overwrite if file exists
      const { existsSync: _bakCheck } = await import("node:fs");
      if (_bakCheck(resolvedPath)) {
        const { copyFileSync } = await import("node:fs");
        copyFileSync(resolvedPath, resolvedPath + ".bak");
      }
      writeFileSync(resolvedPath, content, "utf-8");
    }
    return {
      status: "success",
      file_path: resolvedPath,
      mode,
      bytesWritten: contentSize,
    };
  },
  });
}

export function createShellExecTool(workingDirectory = process.cwd()) {
  return buildTool({
  name: "shell_exec",
  description: "执行 shell 命令。需要 shell:exec 权限。命令会被分类标记风险等级。",
  inputSchema: createInputSchema(
    {
      command: {
        type: "string",
        description: "要执行的 shell 命令",
      },
      cwd: {
        type: "string",
        description: "工作目录（可选）",
      },
      timeout_ms: {
        type: "integer",
        description: "超时时间（毫秒），默认 30000",
      },
    },
    ["command"]
  ),
  requiredPermissions: ["shell:exec"],
  isReadOnly: false,
  maxResultSizeChars: 50_000,
  async execute(params, _context) {
    const { execSync } = await import("node:child_process");
    const { command, cwd, timeout_ms = 30000 } = params;

    // Security: blocklist of high-risk command patterns
    const BLOCKED_PATTERNS = [
      /rm\s+(-\w*\s+)*-?\w*r\w*\s+(-\w*\s+)*\//,   // recursive delete from root
      /rm\s+(-\w*\s+)*-?\w*f\w*\s+(-\w*\s+)*\//,   // force delete from root
      /mkfs\./,                                       // filesystem format
      /dd\s+.*of=\/dev\//,                            // raw disk write
      /:\(\)\s*\{.*:\|:\s*&\s*\}\s*;/,              // fork bomb
      /curl\s+.*\|\s*(ba)?sh/,                        // remote script exec
      /wget\s+.*\|\s*(ba)?sh/,                        // remote script exec
      />\/dev\/sd[a-z]/,                               // overwrite disk device
      /base64\s+(-d|--decode).*\|\s*(ba)?sh/,        // base64-encoded shell exec
      /echo\s+.*\|\s*base64\s+(-d|--decode)/,       // base64 decode pipe chain
      /python[23]?\s+-c\s+.*os\.(system|popen)/,    // python inline shell exec
      /perl\s+-e\s+.*\b(system|exec|qx)\b/,        // perl inline shell exec
      /\bfind\s+.*-exec\s+(rm|sh|bash|chmod|chown)/,  // find -exec dangerous command
      /\bsocat\b.*\bEXEC\b/,                        // socat reverse shell
      /\bnc(at)?\s+.*-e\s+\/bin\/(ba)?sh/,         // netcat reverse shell
      /\b(eval|exec)\s*\(\s*\$\(/,                // command substitution injection
    ];
    const trimmedCmd = (command || "").trim();
    for (const pat of BLOCKED_PATTERNS) {
      if (pat.test(trimmedCmd)) {
        return { status: "error", error: `Command blocked by safety policy: matches ${pat}`, code: "COMMAND_BLOCKED" };
      }
    }

    // Security: cap timeout at 2 minutes
    const safeTimeout = Math.min(Math.max(Number(timeout_ms) || 30000, 1000), 120000);

    // Security: sanitize environment — strip secrets
    const safeEnv = {};
    const SECRET_PATTERNS = /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE/i;
    for (const [k, v] of Object.entries(process.env)) {
      if (!SECRET_PATTERNS.test(k)) {
        safeEnv[k] = v;
      }
    }

    try {
      const output = execSync(command, {
        cwd: cwd || workingDirectory,
        timeout: safeTimeout,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
        env: safeEnv,
      });
      const maxLen = 50_000;
      const stdout = (output || "").length > maxLen
        ? (output || "").slice(0, maxLen) + "\n... [truncated]"
        : (output || "");
      return {
        status: "success",
        stdout,
        exitCode: 0,
      };
    } catch (err) {
      const maxLen = 50_000;
      const stdout = (err.stdout || "").length > maxLen
        ? (err.stdout || "").slice(0, maxLen) + "\n... [truncated]"
        : (err.stdout || "");
      return {
        status: "error",
        stdout,
        stderr: err.stderr || err.message,
        exitCode: err.status ?? 1,
      };
    }
  },
  });
}
