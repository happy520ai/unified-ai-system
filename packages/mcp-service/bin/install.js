#!/usr/bin/env node
// Cross-platform installer CLI.
//
//   unified-ai-system-mcp-service install          # install platform service + register WorkBuddy
//   unified-ai-system-mcp-service install --no-start  # just install, do not start
//   unified-ai-system-mcp-service uninstall        # uninstall service + unregister WorkBuddy
//   unified-ai-system-mcp-service status           # query service status
//   unified-ai-system-mcp-service register          # just register with WorkBuddy
//   unified-ai-system-mcp-service unregister        # just unregister from WorkBuddy
//   unified-ai-system-mcp-service diagnose          # print summary + log tail
//
// In an installed context (system service running), call from any shell as:
//   node packages/mcp-service/bin/install.js status

import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  install as installPlatform,
  uninstall as uninstallPlatform,
  query as queryPlatform,
  installerInternals,
} from "../src/installer.js";
import {
  registerService,
  unregisterService,
  inspectRegistration,
  deriveStdioCommand,
  defaultMcpJsonPath,
} from "../src/workbuddy-register.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function usage() {
  process.stdout.write(
    [
      "Unified AI System MCP service installer",
      "",
      "Usage:",
      "  install     [options]    install platform service + register with WorkBuddy",
      "  uninstall   [options]    uninstall everything",
      "  status                   show platform service status",
      "  register    [options]    register only in WorkBuddy ~/.workbuddy/mcp.json",
      "  unregister               remove WorkBuddy entry",
      "  inspect                  print the resolved WorkBuddy entry",
      "  diagnose                 print installed service + log tail",
      "  platform                 print detected platform",
      "",
      "Common options:",
      "  --repo-root PATH         override repository root",
      "  --node PATH              override Node.js binary",
      "  --log-file PATH          override service log path",
      "  --no-start               install but do not start the service",
      "  --no-register            install service without modifying WorkBuddy config",
      "  --workbuddy-config PATH  override ~/.workbuddy/mcp.json path",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const opts = {
    command: argv[2] ?? "install",
    repoRoot: process.env.MCP_SERVICE_REPO_ROOT ?? null,
    node: null,
    logFile: null,
    start: true,
    register: true,
    workbuddyConfig: null,
    showHelp: false,
  };
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") opts.showHelp = true;
    else if (arg === "--repo-root" && argv[i + 1]) opts.repoRoot = argv[++i];
    else if (arg === "--node" && argv[i + 1]) opts.node = argv[++i];
    else if (arg === "--log-file" && argv[i + 1]) opts.logFile = argv[++i];
    else if (arg === "--no-start") opts.start = false;
    else if (arg === "--no-register") opts.register = false;
    else if (arg === "--workbuddy-config" && argv[i + 1]) opts.workbuddyConfig = argv[++i];
  }
  return opts;
}

function resolveRepoRoot(opt) {
  return resolve(opt.repoRoot ?? resolve(__dirname, "../../.."));
}

async function cmdInstall(opts) {
  const repoRoot = resolveRepoRoot(opts);
  const installInfo = await installPlatform({
    repoRoot,
    nodeBinary: opts.node ?? process.execPath,
    logFile: opts.logFile,
    start: opts.start,
  });
  let registration = { applied: false };
  if (opts.register) {
    registration = await registerService({
      repoRoot,
      mcpJsonPath: opts.workbuddyConfig || undefined,
    });
  }
  return { install: installInfo, registration };
}

async function cmdUninstall(opts) {
  const repoRoot = resolveRepoRoot(opts);
  const installInfo = await uninstallPlatform({ repoRoot });
  const registration = await unregisterService({
    mcpJsonPath: opts.workbuddyConfig || undefined,
  });
  return { install: installInfo, registration };
}

async function cmdStatus() {
  return queryPlatform({});
}

async function cmdRegister(opts) {
  const repoRoot = resolveRepoRoot(opts);
  return registerService({
    repoRoot,
    mcpJsonPath: opts.workbuddyConfig || undefined,
  });
}

async function cmdUnregister(opts) {
  return unregisterService({
    mcpJsonPath: opts.workbuddyConfig || undefined,
  });
}

async function cmdInspect(opts) {
  return inspectRegistration({
    mcpJsonPath: opts.workbuddyConfig || undefined,
  });
}

async function cmdDiagnose(opts) {
  const repoRoot = resolveRepoRoot(opts);
  const status = await cmdStatus().catch((error) => ({ error: error.message }));
  const inspection = await cmdInspect(opts).catch((error) => ({ error: error.message }));
  const logPath = resolve(repoRoot, "logs/mcp-service.log");
  let logTail = "";
  try {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(logPath, "utf8");
    logTail = text.split(/\r?\n/).slice(-20).join("\n");
  } catch {
    logTail = "(log not available yet)";
  }
  return { platform: installerInternals.pickPlatform(), status, inspection, logPath, logTail };
}

async function cmdPlatform() {
  return { platform: installerInternals.pickPlatform() };
}

const opts = parseArgs(process.argv);
if (opts.showHelp || opts.command === "--help" || opts.command === "-h") {
  usage();
  process.exit(0);
}

(async () => {
  let result;
  try {
    switch (opts.command) {
      case "install":
        result = await cmdInstall(opts);
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      case "uninstall":
        result = await cmdUninstall(opts);
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      case "status":
        result = await cmdStatus();
        if (typeof result === "string") process.stdout.write(result);
        else process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      case "register":
        result = await cmdRegister(opts);
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      case "unregister":
        result = await cmdUnregister(opts);
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      case "inspect":
        result = await cmdInspect(opts);
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      case "diagnose":
        result = await cmdDiagnose(opts);
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      case "platform":
        result = await cmdPlatform();
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        break;
      default:
        process.stderr.write(`unknown command: ${opts.command}\n\n`);
        usage();
        process.exit(1);
    }
  } catch (error) {
    process.stderr.write(
      `${opts.command} failed: ${error.stack || error.message}\n`,
    );
    process.exit(1);
  }
})();
