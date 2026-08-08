// macOS launchd installer. Generates a LaunchAgent plist that re-runs the
// MCP daemon on boot, drain logs to ~/Library/Logs, and restarts on
// failure. Uses `launchctl bootstrap gui/$UID/...` (modern) when possible,
// falling back to `launchctl load`.

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFile as execFileCb } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import os from "node:os";

const execFileAsync = promisify(execFileCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const LABEL = "io.github.happy520ai.unified-ai-system-mcp";

function plistPath() {
  return resolve(
    os.homedir(),
    "Library/LaunchAgents",
    `${LABEL}.plist`,
  );
}

export function buildLaunchdPlist({ command, args, workingDir, logFile, runAtLoad = true }) {
  const argv = [command, ...args];
  const outLog = `${logFile ?? "/tmp/unified-ai-system-mcp.out.log"}`;
  const errLog = `${(logFile ?? "/tmp/unified-ai-system-mcp.err.log").replace(/\.out\.log$/, ".err.log")}`;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "  <key>Label</key>",
    `  <string>${LABEL}</string>`,
    "  <key>ProgramArguments</key>",
    "  <array>",
    ...argv.map((a) => `    <string>${a.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</string>`),
    "  </array>",
    "  <key>WorkingDirectory</key>",
    `  <string>${workingDir}</string>`,
    "  <key>RunAtLoad</key>",
    runAtLoad ? "  <true/>" : "  <false/>",
    "  <key>KeepAlive</key>",
    "  <dict>",
    "    <key>SuccessfulExit</key>",
    "    <false/>",
    "    <key>ThrottleInterval</key>",
    "    <integer>5</integer>",
    "  </dict>",
    "  <key>ProcessType</key>",
    "  <string>Background</string>",
    "  <key>StandardOutPath</key>",
    `  <string>${outLog}</string>`,
    "  <key>StandardErrorPath</key>",
    `  <string>${errLog}</string>`,
    "</dict>",
    "</plist>",
  ];
  return lines.join("\n");
}

export async function installLaunchdService(options = {}) {
  if (process.platform !== "darwin") {
    throw new Error("launchd install requires a macOS host.");
  }
  const plist = options.plistPath ?? plistPath();
  mkdirSync(dirname(plist), { recursive: true });
  writeFileSync(plist, buildLaunchdPlist({
    command: options.command,
    args: options.args,
    workingDir: options.workingDir,
    logFile: options.logFile,
    runAtLoad: options.runAtLoad !== false,
  }), "utf8");

  const uid = process.getuid?.() ?? os.userInfo().uid;
  const target = `gui/${uid}/${LABEL}`;
  try {
    await execFileAsync("launchctl", ["bootstrap", target, plist], { encoding: "utf8" });
  } catch (error) {
    // Fall back to legacy load syntax on older releases.
    await execFileAsync("launchctl", ["load", plist], { encoding: "utf8" }).catch(() => {
      throw error;
    });
  }
  return { label: LABEL, plistPath: plist, target };
}

export async function uninstallLaunchdService(options = {}) {
  if (process.platform !== "darwin") {
    throw new Error("launchd uninstall requires a macOS host.");
  }
  const plist = options.plistPath ?? plistPath();
  const uid = process.getuid?.() ?? os.userInfo().uid;
  const target = `gui/${uid}/${LABEL}`;
  try {
    await execFileAsync("launchctl", ["bootout", target], { encoding: "utf8" });
  } catch {
    try {
      await execFileAsync("launchctl", ["unload", plist], { encoding: "utf8" });
    } catch {
      // ignore
    }
  }
  if (existsSync(plist)) unlinkSync(plist);
  return { label: LABEL, plistPath: plist };
}

export async function queryLaunchdService(options = {}) {
  if (process.platform !== "darwin") {
    throw new Error("launchd query requires a macOS host.");
  }
  const result = await execFileAsync("launchctl", ["print", `gui/${process.getuid?.() ?? os.userInfo().uid}/${LABEL}`], { encoding: "utf8" });
  return result.stdout;
}

export const installerLaunchdInternals = {
  buildLaunchdPlist,
  plistPath,
  LABEL,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  (async () => {
    const action = process.argv[2] ?? "install";
    const repoRoot = resolve(__dirname, "../../../..");
    const startScript = resolve(repoRoot, "packages/mcp-service/bin/start-service.js");
    const cmd = process.execPath;
    const args = [startScript, "--daemon", "--repo-root", repoRoot];
    try {
      if (action === "install") {
        const info = await installLaunchdService({
          command: cmd,
          args,
          workingDir: repoRoot,
        });
        process.stdout.write(`installed ${info.label} -> ${info.plistPath}\n`);
      } else if (action === "uninstall") {
        const info = await uninstallLaunchdService({});
        process.stdout.write(`uninstalled ${info.label}\n`);
      } else if (action === "query") {
        process.stdout.write(await queryLaunchdService({}));
      }
    } catch (error) {
      process.stderr.write(`launchd ${action} failed: ${error.message}\n`);
      process.exit(1);
    }
  })();
}
