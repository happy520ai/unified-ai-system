// Logger with file + optional-tee output. Designed for stdio-mode MCP
// servers where stderr MUST stay silent so the JSON-RPC stream on stdout
// is clean.
//
// Output model:
//   - When `filePath` is set, every line is appended to that file (rotated
//     at `maxBytes`, with `maxFiles` historical copies).
//   - When `teeToStderr` is true, the same line is also written to stderr.
//     This is for interactive runs only. When supervised by the
//     `mcp-service` package, teeToStderr must stay false so the JSON-RPC
//     stream remains clean.
//
// Concurrency:
//   - All writes serialize through a single promise chain (`chain`) so two
//     `info()` calls never interleave their appendFile operations.
//   - `close()` flushes any pending writes and returns when the file is
//     fully flushed. Tests rely on this guarantee.

import { mkdir, appendFile, rename, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_FILES = 4;

function nowIso() {
  return new Date().toISOString();
}

function safeString(value) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function rotateIfNeeded(filePath, maxBytes, maxFiles) {
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return;
  }
  if (info.size < maxBytes) return;
  for (let i = maxFiles - 1; i >= 1; i -= 1) {
    const from = i === 1 ? filePath : `${filePath}.${i - 1}`;
    const to = `${filePath}.${i}`;
    try {
      await rename(from, to);
    } catch {
      // ignore missing source files
    }
  }
}

export function createLogger(options = {}) {
  const {
    filePath = null,
    teeToStderr = process.env.MCP_SERVICE_TEE_STDERR === "1",
    maxBytes = DEFAULT_MAX_BYTES,
    maxFiles = DEFAULT_MAX_FILES,
    component = "mcp-service",
  } = options;

  let chain = Promise.resolve();
  let closed = false;
  let dirEnsured = filePath ? ensureDir(filePath).catch(() => { /* dirEnsured fail = non-blocking */ }) : Promise.resolve();

  function enqueue(task) {
    if (closed) return;
    chain = chain.then(task, task);
  }

  async function writeLine(text) {
    if (filePath) {
      await dirEnsured;
      await rotateIfNeeded(filePath, maxBytes, maxFiles);
      await appendFile(filePath, text, "utf8");
    }
    if (teeToStderr) {
      try {
        process.stderr.write(text);
      } catch {
        // stderr may be closed under a Windows scheduled task
      }
    }
  }

  function write(level, message, fields) {
    const parts = [nowIso(), level.toUpperCase(), component];
    if (fields && typeof fields === "object") {
      parts.push(JSON.stringify(fields));
    }
    parts.push(safeString(message));
    const line = parts.join(" ") + "\n";
    enqueue(() => writeLine(line));
  }

  function info(message, fields) {
    write("info", message, fields);
  }
  function warn(message, fields) {
    write("warn", message, fields);
  }
  function error(message, fields) {
    write("error", message, fields);
  }
  function debug(message, fields) {
    if (process.env.MCP_SERVICE_DEBUG === "1") {
      write("debug", message, fields);
    }
  }
  function childLine(line) {
    const stamped = `[child ${nowIso()}] ${safeString(line)}\n`;
    enqueue(() => writeLine(stamped));
  }

  async function close() {
    closed = true;
    try {
      await chain;
    } catch {
      // never let close throw
    }
  }

  return {
    info,
    warn,
    error,
    debug,
    childLine,
    filePath,
    resolvePath(cwd = process.cwd()) {
      return filePath ? resolve(cwd, filePath) : null;
    },
    close,
  };
}

export const loggerInternals = {
  safeString,
};

export function defaultLogPath(repoRoot) {
  return resolve(repoRoot, "logs", "mcp-service.log");
}
