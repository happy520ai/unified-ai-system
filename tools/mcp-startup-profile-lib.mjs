// Shared parts of the stdio MCP connect profiler: argument parsing, the credential-name guard,
// the newline-delimited JSON-RPC line reader, and one measured connect attempt.
import { spawn } from "node:child_process";

// Matched per name segment, not as a substring: `AUTHOR` and `KEYMAP` are benign, while
// `MCP_AUTH_TOKEN` and `OPENAI_API_KEY` are not. A guard that fires on everything gets disabled
// by the first false refusal, which is worse than no guard.
export const CREDENTIAL_NAME_RE = /(^|_)(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|APIKEY)($|_)/i;
export const PROTOCOL_VERSION = "2025-06-18";

export function parseCommandLine(argv) {
  const out = { argv: { repeat: 2, timeoutMs: 45000, json: false, keepEnv: false }, rest: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--repeat") { out.argv.repeat = Number(argv[++i]); continue; }
    if (arg === "--timeout-ms") { out.argv.timeoutMs = Number(argv[++i]); continue; }
    if (arg === "--json") { out.argv.json = true; continue; }
    if (arg === "--keep-env") { out.argv.keepEnv = true; continue; }
    out.rest.push(arg);
  }
  if (!Number.isInteger(out.argv.repeat) || out.argv.repeat < 1 || out.argv.repeat > 20) {
    throw new Error(`--repeat must be an integer from 1 to 20, got ${out.argv.repeat}`);
  }
  if (!Number.isInteger(out.argv.timeoutMs) || out.argv.timeoutMs < 1000) {
    throw new Error(`--timeout-ms must be at least 1000, got ${out.argv.timeoutMs}`);
  }
  return out;
}

// A response we care about is one line carrying an integer `id`. Notifications, log lines and
// partial writes must never be read as an answer: a false "answered" is the one result that
// would hide a real connect timeout.
export function parseRpcLine(line) {
  const text = String(line ?? "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return null;
  }
  if (message === null || typeof message !== "object" || !Number.isInteger(message.id)) return null;
  return message;
}

function request(id, method, params) {
  const body = params ? { jsonrpc: "2.0", id, method, params } : { jsonrpc: "2.0", id, method };
  return `${JSON.stringify(body)}\n`;
}

function notification(method) {
  return `${JSON.stringify({ jsonrpc: "2.0", method })}\n`;
}

export function childEnv(envNames) {
  const env = {};
  for (const name of envNames) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  if (env.NODE_ENV === undefined) env.NODE_ENV = "production";
  return env;
}

// One attempt: spawn, send `initialize`, and the moment it is answered send `tools/list`.
// Timings come from each arrival, so `initializeMs` is the number a client's connect budget has
// to cover, and `toolsListMs - initializeMs` is the server's own work after the handshake.
// The child is always killed, so a run leaves no process behind.
export function runProfile({
  command,
  envNames = ["PATH", "NODE_ENV"],
  timeoutMs = 45000,
  protocolVersion = PROTOCOL_VERSION,
}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const arrived = new Map();
    let stderrBytes = 0;
    let settled = false;

    const child = spawn(command.file, command.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv(envNames),
    });

    const stop = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reader.close();
      try { child.stdin.end(); } catch {}
      child.kill("SIGKILL");
      resolve({ ...result, stderrBytes });
    };

    const settle = () => {
      const initialize = arrived.get(1);
      const tools = arrived.get(2);
      const elapsedMs = Date.now() - startedAt;
      if (!initialize) return { verdict: "no_initialize_response", elapsedMs };
      if (initialize.message.error) {
        return {
          verdict: "initialize_rejected",
          elapsedMs,
          detail: JSON.stringify(initialize.message.error).slice(0, 200),
        };
      }
      if (!tools) {
        return {
          verdict: "no_tools_list_response",
          elapsedMs,
          initializeMs: initialize.ms,
          serverInfo: describeServer(initialize.message),
        };
      }
      if (tools.message.error) {
        return {
          verdict: "tools_list_rejected",
          elapsedMs,
          initializeMs: initialize.ms,
          detail: JSON.stringify(tools.message.error).slice(0, 200),
        };
      }
      const listed = Array.isArray(tools.message.result?.tools) ? tools.message.result.tools : null;
      return {
        verdict: "answered",
        elapsedMs,
        initializeMs: initialize.ms,
        toolsListMs: tools.ms,
        toolCount: listed ? listed.length : null,
        toolNames: listed ? listed.map((tool) => tool.name).sort() : null,
        serverInfo: describeServer(initialize.message),
      };
    };

    const reader = lineReader(child.stdout, (line) => {
      const message = parseRpcLine(line);
      if (!message) return;
      arrived.set(message.id, { ms: Date.now() - startedAt, message });
      if (message.id === 1) {
        child.stdin.write(notification("notifications/initialized"));
        child.stdin.write(request(2, "tools/list"));
      }
      if (message.id === 2) stop(settle());
    });

    child.stderr.on("data", (chunk) => { stderrBytes += chunk.length; });

    const timer = setTimeout(() => {
      // Keep which stage stalled, and mark that the budget ran out: "answered initialize but never
      // listed tools" and "never said anything" are different diagnoses, and collapsing them into a
      // single timeout is what let the pre-process case below be misread as a broken handler.
      const result = settle();
      stop({ ...result, timedOut: true, timeoutMs });
    }, timeoutMs);

    child.on("error", (error) => {
      stop({
        verdict: "spawn_failed",
        elapsedMs: Date.now() - startedAt,
        detail: String(error.message ?? error).slice(0, 200),
      });
    });

    child.stdin.write(request(1, "initialize", {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "mcp-startup-profile", version: "1" },
    }));
  });
}

function describeServer(initialize) {
  const info = initialize.result?.serverInfo;
  return info
    ? { name: info.name ?? null, protocolVersion: initialize.result?.protocolVersion ?? null }
    : null;
}

function lineReader(stream, onLine) {
  let buffer = "";
  const handle = (chunk) => {
    buffer += chunk.toString("utf8");
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.trim() !== "") onLine(line);
      index = buffer.indexOf("\n");
    }
  };
  stream.setEncoding("utf8");
  stream.on("data", handle);
  return { close: () => stream.off("data", handle) };
}
