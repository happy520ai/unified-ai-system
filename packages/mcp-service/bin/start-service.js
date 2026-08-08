#!/usr/bin/env node
// Service-mode entry point. Used by both WorkBuddy's per-session stdio
// transport AND the platform auto-start installers (Windows Task Scheduler,
// systemd unit, launchd job).
//
// Lifecycle:
//   - reads MCP service supervisor options from env / CLI flags
//   - spins up the daemon that supervises the existing MCP server package
//   - on SIGTERM/SIGINT/SIGBREAK it shuts the daemon down gracefully
//   - in `MCP_SERVICE_NO_DAEMON=1` mode it just runs the MCP server in the
//     foreground (used for `pnpm mcp` compatibility)

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const options = {
    repoRoot: process.env.MCP_SERVICE_REPO_ROOT ?? resolve(__dirname, "../../.."),
    mode: process.env.MCP_SERVICE_NO_DAEMON === "1" ? "stdio" : "daemon",
    logFile: process.env.MCP_SERVICE_LOG_FILE ?? null,
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--stdio" || arg === "--no-daemon") {
      options.mode = "stdio";
    } else if (arg === "--daemon") {
      options.mode = "daemon";
    } else if (arg === "--repo-root" && argv[i + 1]) {
      options.repoRoot = argv[i + 1];
      i += 1;
    } else if (arg === "--log-file" && argv[i + 1]) {
      options.logFile = argv[i + 1];
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function usage() {
  process.stdout.write(
    [
      "Unified AI System MCP service",
      "",
      "Usage: start-service.js [--daemon|--stdio] [--repo-root PATH] [--log-file PATH]",
      "",
      "  --daemon        Run the supervising daemon (default when invoked as a service)",
      "  --stdio         Run the existing MCP server in the foreground (used by `pnpm mcp`)",
      "  --repo-root     Override repository root discovery",
      "  --log-file      Override service log file path",
      "",
      "Environment:",
      "  MCP_SERVICE_NO_DAEMON=1  force stdio mode",
      "  MCP_SERVICE_TEE_STDERR=1 also write logs to stderr (useful for interactive runs)",
      "  MCP_SERVICE_HEALTH_PORT  override HTTP health port (default 7788)",
      "  MCP_SERVICE_HEALTH_HOST  override HTTP health host (default 127.0.0.1)",
      "",
    ].join("\n"),
  );
}

const options = parseArgs(process.argv);
if (options.help) {
  usage();
  process.exit(0);
}

if (options.mode === "stdio") {
  // Compatibility shim so `node bin/start-service.js --stdio` keeps the
  // same behavior as the original `pnpm mcp` command.
  const entrypoint = resolve(
    options.repoRoot,
    "packages/mcp-server/src/index.js",
  );
  await import(pathToFileURL(entrypoint).href);
  // The imported module never returns; it owns the event loop.
} else {
  const { createDaemon } = await import("../src/daemon.js");
  const daemon = await createDaemon({
    repoRoot: options.repoRoot,
    logPath: options.logFile,
  });
  await daemon.start();

  let stopping = false;
  async function shutdown(signal, code = 0) {
    if (stopping) return;
    stopping = true;
    try {
      await daemon.stop();
    } catch (error) {
      process.stderr.write(`daemon stop error: ${error.stack || error.message}\n`);
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
