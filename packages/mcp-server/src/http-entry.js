#!/usr/bin/env node

import { startMcpHttpServer } from "./http.js";
import { MCP_SERVER_VERSION } from "./server.js";

let service;
let shuttingDown = false;

function log(line) {
  process.stderr.write(`${line}\n`);
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  await service?.stop();
}

function shutdownFromSignal(signal) {
  void shutdown(0)
    .catch((error) => {
      log(`Unified AI System MCP HTTP shutdown failed after ${signal}: ${error.message}`);
    })
    .finally(() => {
      process.exit(process.exitCode ?? 0);
    });
}

async function main() {
  service = await startMcpHttpServer({
    onerror(error) {
      log(`Unified AI System MCP HTTP transport error: ${error.message}`);
    },
  });
  process.once("exit", () => service?.killNow());
  process.once("SIGINT", () => shutdownFromSignal("SIGINT"));
  process.once("SIGTERM", () => shutdownFromSignal("SIGTERM"));

  const exposure = service.config.localOnly ? "loopback-only" : "remote authenticated";
  log(
    `Unified AI System MCP ${MCP_SERVER_VERSION} ready at ${service.endpoint} (${exposure}); real providers disabled.`,
  );
}

main().catch(async (error) => {
  log(`Unified AI System MCP HTTP failed to start: ${error.message}`);
  await shutdown(1);
});
