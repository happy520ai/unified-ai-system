#!/usr/bin/env node

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createGatewayRuntime } from "./runtime.js";
import {
  createUnifiedAiMcpServer,
  MCP_SERVER_VERSION,
} from "./server.js";

let runtime;
let runtimePromise;
let handle;
let shuttingDown = false;

function logToFileOrStderr(line) {
  // When supervised by the mcp-service package (MCP_SUPERVISED=1) or when
  // the operator explicitly set MCP_SERVICE_LOG_FILE, route diagnostic lines
  // into the service log file instead of stderr. Stderr still receives the
  // line when neither flag is set so direct CLI invocations keep working.
  const logFile = process.env.MCP_SERVICE_LOG_FILE;
  if (!logFile || process.env.MCP_SUPERVISED !== "1") {
    process.stderr.write(line);
    return;
  }
  mkdir(dirname(logFile), { recursive: true })
    .then(() => appendFile(logFile, line, "utf8"))
    .catch(() => {
      // If we cannot persist the log, fall back to stderr so the line is
      // not silently dropped.
      try {
        process.stderr.write(line);
      } catch {
        // stderr may be closed in a Windows Service context.
      }
    });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;

  try {
    await handle?.close();
  } finally {
    await runtime?.stop();
  }
}

function shutdownFromSignal(signal) {
  void shutdown(0)
    .catch((error) => {
      logToFileOrStderr(
        `Unified AI System MCP shutdown failed after ${signal}: ${error.message}\n`,
      );
    })
    .finally(() => {
      process.exit(process.exitCode ?? 0);
    });
}

function ensureRuntime() {
  runtimePromise ??= createGatewayRuntime();
  return runtimePromise;
}

async function main() {
  process.once("exit", () => runtime?.killNow());
  process.once("SIGINT", () => shutdownFromSignal("SIGINT"));
  process.once("SIGTERM", () => shutdownFromSignal("SIGTERM"));
  process.stdin.once("end", () => {
    void shutdown(0);
  });
  process.stdin.once("close", () => {
    void shutdown(0);
  });

  // Boot the gateway in the background so the stdio transport answers
  // initialize and tools/list immediately; tool calls resolve the runtime on
  // first use. A blocked initialize reads as a failed start to MCP clients.
  // If the MCP host exits while the boot is still pending, the managed child
  // self-terminates through its managed-parent IPC disconnect watcher.
  ensureRuntime().catch((error) => {
    logToFileOrStderr(
      `Unified AI System MCP gateway boot failed: ${error.message}\n`,
    );
  });

  handle = serveStdio(() => createUnifiedAiMcpServer(ensureRuntime()), {
    onerror(error) {
      logToFileOrStderr(
        `Unified AI System MCP transport error: ${error.message}\n`,
      );
    },
  });
  logToFileOrStderr(
    `Unified AI System MCP ${MCP_SERVER_VERSION} ready on stdio; gateway booting in background; real providers disabled.\n`,
  );
}

main().catch(async (error) => {
  logToFileOrStderr(
    `Unified AI System MCP failed to start: ${error.message}\n`,
  );
  await shutdown(1);
});
