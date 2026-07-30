#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createGatewayRuntime } from "./runtime.js";
import {
  createUnifiedAiMcpServer,
  MCP_SERVER_VERSION,
} from "./server.js";

let runtime;
let handle;
let shuttingDown = false;

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
      process.stderr.write(
        `Unified AI System MCP shutdown failed after ${signal}: ${error.message}\n`,
      );
    })
    .finally(() => {
      process.exit(process.exitCode ?? 0);
    });
}

async function main() {
  runtime = await createGatewayRuntime();
  process.once("exit", () => runtime?.killNow());
  process.once("SIGINT", () => shutdownFromSignal("SIGINT"));
  process.once("SIGTERM", () => shutdownFromSignal("SIGTERM"));
  process.stdin.once("end", () => {
    void shutdown(0);
  });
  process.stdin.once("close", () => {
    void shutdown(0);
  });

  handle = serveStdio(() => createUnifiedAiMcpServer(runtime), {
    onerror(error) {
      process.stderr.write(`Unified AI System MCP transport error: ${error.message}\n`);
    },
  });
  process.stderr.write(
    `Unified AI System MCP ${MCP_SERVER_VERSION} ready on stdio; real providers disabled.\n`,
  );
}

main().catch(async (error) => {
  process.stderr.write(
    `Unified AI System MCP failed to start: ${error.message}\n`,
  );
  await shutdown(1);
});
