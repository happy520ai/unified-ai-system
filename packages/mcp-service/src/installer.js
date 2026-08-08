// Cross-platform installer dispatcher. Picks the right platform installer
// (Windows Task Scheduler, systemd unit, launchd job) based on the OS the CLI is
// running on. Existing entries in ~/.workbuddy/mcp.json are kept intact.

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  installWindowsService,
  uninstallWindowsService,
  queryWindowsService,
} from "./installer-windows.js";
import {
  installSystemdService,
  uninstallSystemdService,
  querySystemdService,
} from "./installer-systemd.js";
import {
  installLaunchdService,
  uninstallLaunchdService,
  queryLaunchdService,
} from "./installer-launchd.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function pickPlatform() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "systemd";
  if (process.platform === "darwin") return "launchd";
  return null;
}

export function resolveRepoRoot(value) {
  return resolve(value ?? resolve(__dirname, "../../.."));
}

export async function install(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  if (pickPlatform() === "windows") {
    return installWindowsService({
      repoRoot,
      nodeBinary: options.nodeBinary ?? process.execPath,
      logFile: options.logFile,
      start: options.start,
      description: options.description,
    });
  }
  const startScript = resolve(
    repoRoot,
    "packages/mcp-service/bin/start-service.js",
  );
  const args = [startScript, "--daemon", "--repo-root", repoRoot];
  if (options.logFile) args.push("--log-file", options.logFile);
  const command = options.nodeBinary ?? process.execPath;
  if (pickPlatform() === "systemd") {
    return installSystemdService({
      command,
      args,
      workingDir: repoRoot,
      scope: options.scope ?? "user",
      start: options.start,
      description: options.description,
    });
  }
  if (pickPlatform() === "launchd") {
    return installLaunchdService({
      command,
      args,
      workingDir: repoRoot,
      start: options.start,
      logFile: options.logFile,
      runAtLoad: options.runAtLoad,
    });
  }
  throw new Error(
    `Unsupported platform: ${process.platform}. ` +
      "Cross-platform installer covers win32, linux, darwin.",
  );
}

export async function uninstall(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  if (pickPlatform() === "windows") return uninstallWindowsService({ repoRoot });
  if (pickPlatform() === "systemd")
    return uninstallSystemdService({ scope: options.scope ?? "user" });
  if (pickPlatform() === "launchd") return uninstallLaunchdService({});
  throw new Error(
    `Unsupported platform: ${process.platform}.`,
  );
}

export async function query(options = {}) {
  if (pickPlatform() === "windows") return queryWindowsService();
  if (pickPlatform() === "systemd")
    return querySystemdService({ scope: options.scope ?? "user" });
  if (pickPlatform() === "launchd") return queryLaunchdService({});
  throw new Error(
    `Unsupported platform: ${process.platform}.`,
  );
}

export const installerInternals = {
  pickPlatform,
};

export {
  installWindowsService,
  uninstallWindowsService,
  queryWindowsService,
  installSystemdService,
  uninstallSystemdService,
  querySystemdService,
  installLaunchdService,
  uninstallLaunchdService,
  queryLaunchdService,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  (async () => {
    const action = process.argv[2] ?? "install";
    const repoRoot = resolve(__dirname, "../../..");
    try {
      if (action === "install") {
        const info = await install({ repoRoot });
        process.stdout.write(JSON.stringify(info, null, 2) + "\n");
      } else if (action === "uninstall") {
        const info = await uninstall({ repoRoot });
        process.stdout.write(JSON.stringify(info, null, 2) + "\n");
      } else if (action === "query") {
        const info = await query({});
        process.stdout.write(info);
      } else if (action === "platform") {
        process.stdout.write(`${pickPlatform() ?? "unsupported"}\n`);
      } else {
        process.stderr.write(`unknown action ${action}\n`);
        process.exit(1);
      }
    } catch (error) {
      process.stderr.write(`installer ${action} failed: ${error.message}\n`);
      process.exit(1);
    }
  })();
}
