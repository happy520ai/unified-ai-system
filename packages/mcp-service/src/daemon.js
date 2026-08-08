// Daemon orchestrator. Ties logger + supervisor + health server together.
// This is the entry point for `node bin/start-service.js`. The child it
// supervises is the existing `@unified-ai-system/mcp-server`, which means
// the 9 governed MCP tools remain untouched.
//
// Auto-start semantics:
//   * supervisor restarts the child on crash (exponential backoff, max 60s)
//   * the supervisor itself survives because it sits inside a process the
//     OS keeps alive (Windows Task Scheduler / systemd unit / launchd job)
//
// WorkBuddy integration:
//   * WorkBuddy registers `node bin/start-service.js` as an stdio MCP server
//   * the daemon forwards MCP requests to the managed child over stdio (so
//     when the child crashes mid-conversation the supervisor transparently
//     restarts it and the next request continues), but this is not strictly
//     necessary for the WorkBuddy spec: WorkBuddy can also re-invoke the
//     stdio entry point per session, which is the simpler integration.

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, statSync } from "node:fs";
import { createLogger, defaultLogPath } from "./logger.js";
import { createSupervisor } from "./supervisor.js";
import { createHealthServer } from "./health-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../..");
const mcpServerPackageRoot = resolve(__dirname, "../../mcp-server");

export function defaultEntrypoint() {
  return resolve(mcpServerPackageRoot, "src/index.js");
}

export function resolveRepoRoot(value) {
  if (value) return resolve(value);
  return repoRoot;
}

export function resolveMcpServerEntrypoint(repoRootArg) {
  const env = process.env.MCP_SERVICE_ENTRYPOINT;
  if (env && existsSync(env)) return env;
  const repoRoot = resolveRepoRoot(repoRootArg);
  const candidate = resolve(repoRoot, "packages/mcp-server/src/index.js");
  if (!existsSync(candidate)) {
    throw new Error(
      `Could not locate mcp-server entrypoint at ${candidate}. ` +
        `Set MCP_SERVICE_ENTRYPOINT to override.`,
    );
  }
  return candidate;
}

export async function createDaemon(options = {}) {
  const {
    logPath = process.env.MCP_SERVICE_LOG_FILE
      || defaultLogPath(resolveRepoRoot(options.repoRoot)),
    healthPort = Number(process.env.MCP_SERVICE_HEALTH_PORT ?? 7788),
    healthHost = process.env.MCP_SERVICE_HEALTH_HOST ?? "127.0.0.1",
    supervisor,
    logger,
    healthServer,
    repoRoot: explicitRepoRoot,
    spawnEnv = {},
    teeToStderr = process.env.MCP_SERVICE_TEE_STDERR === "1",
  } = options;

  const repoRoot = resolveRepoRoot(explicitRepoRoot);
  const resolvedLogPath = resolve(repoRoot, logPath) === logPath
    ? logPath
    : resolve(repoRoot, logPath);
  const entrypoint = resolveMcpServerEntrypoint(repoRoot);
  // When invoked by WorkBuddy's stdio transport we MUST keep stdout clean.
  const finalLogger = logger ?? createLogger({
    filePath: resolvedLogPath,
    teeToStderr,
    component: "mcp-service",
  });

  const finalSupervisor = supervisor ?? createSupervisor({
    logger: finalLogger,
    command: process.execPath,
    args: [entrypoint],
    cwd: repoRoot,
    env: {
      ...spawnEnv,
      MCP_SUPERVISED: "1",
      MCP_SERVICE_LOG_FILE: resolvedLogPath,
    },
  });

  const finalHealth = healthServer ?? createHealthServer({
    host: healthHost,
    port: healthPort,
    logger: finalLogger,
    supervisor: finalSupervisor,
    onShutdown: async () => {
      await finalSupervisor.stop();
      await finalLogger.close();
      await new Promise((resolve) => setImmediate(resolve));
      process.exit(0);
    },
  });

  const context = {
    repoRoot,
    logPath: resolvedLogPath,
    entrypoint,
    logger: finalLogger,
    supervisor: finalSupervisor,
    healthServer: finalHealth,
    async start() {
      finalLogger.info("daemon starting", {
        repoRoot,
        logPath: resolvedLogPath,
        entrypoint,
        healthHost,
        healthPort,
      });
      try {
        await statSync(entrypoint);
      } catch (error) {
        finalLogger.error("entrypoint missing", {
          entrypoint,
          message: error.message,
        });
        throw error;
      }
      await finalHealth.listen();
      await finalSupervisor.start();
      finalLogger.info("daemon running", { healthPort });
    },
    async stop() {
      finalLogger.info("daemon stopping");
      await finalSupervisor.stop();
      await finalHealth.close();
      await finalLogger.close();
    },
  };

  return context;
}

export const daemonInternals = {
  resolveMcpServerEntrypoint,
  defaultEntrypoint,
  resolveRepoRoot,
};

// Direct-call entry point: `node bin/start-service.js`. This is what the
// Windows Task Scheduler task / systemd unit actually run.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let daemonInstance;
  let stopping = false;
  (async () => {
    daemonInstance = await createDaemon();
    await daemonInstance.start();
  })().catch((error) => {
    process.stderr.write(
      `daemon failed to start: ${error.stack || error.message}\n`,
    );
    process.exit(1);
  });

  async function shutdown(signal, code = 0) {
    if (stopping) return;
    stopping = true;
    process.stderr.write(
      `mcp-service received ${signal}; draining...\n`,
    );
    if (daemonInstance) {
      try {
        await daemonInstance.stop();
      } catch (error) {
        process.stderr.write(
          `mcp-service shutdown error: ${error.stack || error.message}\n`,
        );
      }
    }
    setImmediate(() => process.exit(code));
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGBREAK", () => shutdown("SIGBREAK"));
  if (process.platform === "win32") {
    process.on("message", (message) => {
      if (message === "shutdown") shutdown("SCM_SHUTDOWN");
    });
  }
}
