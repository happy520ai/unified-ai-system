// Linux systemd unit installer. Generates a unit file with `Restart=always`
// and `RestartSec=5` and enables/starts it under a per-user or system
// instance. Falls back to writing the unit file to a per-user location
// when not running as root so we can still install without sudo.

import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { execFile as execFileCb } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import os from "node:os";

const execFileAsync = promisify(execFileCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const SERVICE_NAME = "unified-ai-system-mcp.service";

function unitFilePath(scope, user = os.userInfo().username) {
  if (scope === "system") return resolve("/etc/systemd/system", SERVICE_NAME);
  const home = os.homedir();
  return resolve(home, ".config/systemd/user", SERVICE_NAME);
}

export function buildSystemdUnit({ command, args, description, workingDir, env }) {
  const lines = [
    "[Unit]",
    "Description=" + (description ?? "Unified AI System MCP Service"),
    "After=network.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${command} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`,
    `WorkingDirectory=${workingDir}`,
    "Restart=always",
    "RestartSec=5",
    "StandardInput=null",
    "StandardOutput=append:/var/log/unified-ai-system-mcp.out.log",
    "StandardError=append:/var/log/unified-ai-system-mcp.err.log",
    "TimeoutStopSec=15",
    "KillMode=mixed",
    "KillSignal=SIGTERM",
  ];
  if (env) {
    for (const [k, v] of Object.entries(env)) {
      lines.push(`Environment="${k}=${String(v).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push("", "[Install]", "WantedBy=multi-user.target");
  return lines.join("\n");
}

export async function installSystemdService(options = {}) {
  if (process.platform !== "linux") {
    throw new Error("systemd install requires a Linux host.");
  }
  const { command, args } = options;
  const scope = options.scope ?? "user";
  const filePath = unitFilePath(scope);
  mkdirSync(dirname(filePath), { recursive: true });
  const unit = buildSystemdUnit({
    command,
    args,
    description: options.description,
    workingDir: options.workingDir,
    env: options.env,
  });
  writeFileSync(filePath, unit, "utf8");

  const control = scope === "system" ? "" : ["--user"];
  await execFileAsync("systemctl", [...control, "daemon-reload"]);
  await execFileAsync("systemctl", [...control, "enable", SERVICE_NAME]);
  if (options.start !== false) {
    await execFileAsync("systemctl", [...control, "start", SERVICE_NAME]);
  }
  return {
    scope,
    unitPath: filePath,
    name: SERVICE_NAME,
    command,
    args,
    workingDir: options.workingDir,
  };
}

export async function uninstallSystemdService(options = {}) {
  if (process.platform !== "linux") {
    throw new Error("systemd uninstall requires a Linux host.");
  }
  const scope = options.scope ?? "user";
  const control = scope === "system" ? "" : ["--user"];
  try {
    await execFileAsync("systemctl", [...control, "stop", SERVICE_NAME]);
  } catch {
    // ignore
  }
  try {
    await execFileAsync("systemctl", [...control, "disable", SERVICE_NAME]);
  } catch {
    // ignore
  }
  const filePath = unitFilePath(scope);
  if (existsSync(filePath)) unlinkSync(filePath);
  try {
    await execFileAsync("systemctl", [...control, "daemon-reload"]);
  } catch {
    // ignore
  }
  return { name: SERVICE_NAME, unitPath: filePath };
}

export async function querySystemdService(options = {}) {
  if (process.platform !== "linux") {
    throw new Error("systemd query requires a Linux host.");
  }
  const scope = options.scope ?? "user";
  const control = scope === "system" ? "" : ["--user"];
  const result = await execFileAsync(
    "systemctl",
    [...control, "show", SERVICE_NAME, "--property=ActiveState,SubState,MainPID,ExecMainStartTimestamp"],
    { encoding: "utf8" },
  );
  return result.stdout;
}

export const installerSystemdInternals = {
  buildSystemdUnit,
  unitFilePath,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  (async () => {
    const action = process.argv[2] ?? "install";
    const repoRoot = resolve(__dirname, "../../../..");
    const startScript = resolve(repoRoot, "packages/mcp-service/bin/start-service.js");
    const cmd = process.execPath;
    const args = [startScript, "--daemon", "--repo-root", repoRoot];
    try {
      let info;
      if (action === "install") {
        info = await installSystemdService({
          command: cmd,
          args,
          workingDir: repoRoot,
          scope: process.env.MCP_SERVICE_SYSTEMD_SCOPE ?? "user",
        });
        process.stdout.write(`installed ${info.name} -> ${info.unitPath}\n`);
      } else if (action === "uninstall") {
        info = await uninstallSystemdService({ scope: process.env.MCP_SERVICE_SYSTEMD_SCOPE ?? "user" });
        process.stdout.write(`uninstalled ${info.name}\n`);
      } else if (action === "query") {
        process.stdout.write(await querySystemdService({}));
      }
    } catch (error) {
      process.stderr.write(`systemd ${action} failed: ${error.message}\n`);
      process.exit(1);
    }
  })();
}
