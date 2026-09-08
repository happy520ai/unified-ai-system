#!/usr/bin/env node
import { posix, win32 } from "node:path";
import { pathToFileURL } from "node:url";

const label = "io.github.happy520ai.unified-ai-system-gateway";
const allowedOptions = new Set(["platform", "scope", "node", "install-root", "private-env-file", "user", "log-dir"]);
const xml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

function check(condition, message) { if (!condition) throw new Error(message); }
function pathArgument(value, name, windows) {
  const paths = windows ? win32 : posix;
  check(typeof value === "string" && value.length > 0 && value.length <= (windows ? 240 : 2048)
    && !/[\u0000-\u001f\u007f]/u.test(value) && paths.isAbsolute(value), `${name} must be an absolute path without control characters.`);
  check(!value.includes('"') && (!windows || !/[<>|?*]/u.test(value)), `${name} contains unsupported path characters.`);
  const normalized = paths.normalize(value);
  check(normalized === value && !value.endsWith(paths.sep), `${name} must be a normalized path without a trailing separator.`);
  return value;
}
// systemd expands both specifiers and variables after splitting command words.
function systemdWord(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%").replaceAll("$", () => "$$")}"`;
}
function systemdPath(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%")}"`;
}
// Quote one Windows CRT argument; backslashes before the closing quote double.
function windowsArgument(value) {
  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, "$1$1")}"`;
}

/** Pure formatting only: no file reads, process spawning or service registration. */
export function renderGatewayService(options) {
  check(options && Object.keys(options).every((key) => allowedOptions.has(key)), "Unsupported renderer option.");
  const platform = options.platform;
  check(["linux", "windows", "macos"].includes(platform), "platform must be linux, windows or macos.");
  const windows = platform === "windows";
  const paths = windows ? win32 : posix;
  const node = pathArgument(options.node, "node", windows);
  const root = pathArgument(options["install-root"], "install-root", windows);
  const envFile = pathArgument(options["private-env-file"], "private-env-file", windows);
  const entry = paths.join(root, "apps", "ai-gateway-service", "src", "index.js");
  const args = [`--env-file=${envFile}`, entry];
  const scope = options.scope ?? "user";
  check(scope === "user" || scope === "system", "scope must be user or system.");
  check(platform === "linux" || scope === "user", "Windows and macOS templates support user sessions only.");
  check(!options["log-dir"] || platform === "macos", "log-dir is only supported for macOS.");
  if (platform === "linux") {
    check(!node.includes("$"), "A systemd executable path cannot contain a dollar sign.");
    check(!options.user || scope === "system", "A systemd user unit must not set User=.");
    if (scope === "system") check(typeof options.user === "string" && options.user.trim() === options.user && /^[a-z_][a-z0-9_-]{0,31}$/u.test(options.user)
      && options.user !== "root", "A system unit requires an explicit non-root service user.");
    return ["[Unit]", "Description=Unified AI System Gateway HTTP service", "After=network.target", "",
      "[Service]", "Type=simple", ...(scope === "system" ? [`User=${options.user}`] : []),
      `ExecStart=${[node, ...args].map(systemdWord).join(" ")}`, `WorkingDirectory=${systemdPath(root)}`,
      "Restart=on-failure", "RestartSec=5", "StandardInput=null", "StandardOutput=journal", "StandardError=journal",
      "UMask=0077", "NoNewPrivileges=true", "TimeoutStopSec=15", "KillSignal=SIGTERM", "KillMode=mixed", "",
      "[Install]", `WantedBy=${scope === "user" ? "default.target" : "multi-user.target"}`, ""].join("\n");
  }
  if (windows) {
    check(typeof options.user === "string" && options.user.length > 0 && options.user.length <= 256
      && !/[\u0000-\u001f\u007f]/u.test(options.user), "Windows requires an explicit user account or SID.");
    // Task Scheduler expands environment references independently of argv parsing.
    check(![node, root, envFile].some((value) => value.includes("%")), "Windows paths cannot contain environment expansion markers.");
    // Omitting encoding works for both UTF-8 review files and Task Scheduler's
    // UTF-16 BSTR XmlText API; an explicit UTF-8 declaration is rejected there.
    return ['<?xml version="1.0"?>',
      '<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
      "  <RegistrationInfo><Description>Unified AI System Gateway HTTP service</Description></RegistrationInfo>",
      `  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xml(options.user)}</UserId></LogonTrigger></Triggers>`,
      `  <Principals><Principal id="GatewayUser"><UserId>${xml(options.user)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>`,
      "  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>true</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable><Enabled>true</Enabled><Hidden>true</Hidden><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure></Settings>",
      `  <Actions Context="GatewayUser"><Exec><Command>${xml(node)}</Command><Arguments>${xml(args.map(windowsArgument).join(" "))}</Arguments><WorkingDirectory>${xml(root)}</WorkingDirectory></Exec></Actions>`,
      "</Task>", ""].join("\n");
  }
  check(!options.user, "A LaunchAgent uses its GUI session owner; do not supply user.");
  const logDir = pathArgument(options["log-dir"], "log-dir", false);
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>', `  <key>Label</key><string>${label}</string>`,
    "  <key>ProgramArguments</key><array>", ...[node, ...args].map((value) => `    <string>${xml(value)}</string>`), "  </array>",
    `  <key>WorkingDirectory</key><string>${xml(root)}</string>`, "  <key>RunAtLoad</key><true/>",
    "  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>",
    "  <key>ThrottleInterval</key><integer>5</integer>", "  <key>ExitTimeOut</key><integer>15</integer>",
    "  <key>ProcessType</key><string>Background</string>", "  <key>Umask</key><integer>63</integer>",
    `  <key>StandardOutPath</key><string>${xml(paths.join(logDir, "gateway.out.log"))}</string>`,
    `  <key>StandardErrorPath</key><string>${xml(paths.join(logDir, "gateway.err.log"))}</string>`,
    "</dict></plist>", ""].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const argv = process.argv.slice(2);
    if (argv.length === 1 && argv[0] === "--help") {
      process.stdout.write("Usage: node tools/render-gateway-service.mjs --platform linux|windows|macos --node ABSOLUTE_PATH --install-root FIXED_ABSOLUTE_PATH --private-env-file PRIVATE_ABSOLUTE_PATH [--scope user|system] [--user ACCOUNT] [--log-dir ABSOLUTE_PATH]\nPrints a service template only; does not read credentials, install or start anything.\n");
    } else {
      check(argv.length > 0 && argv.length % 2 === 0, "Expected --option value pairs.");
      const options = {};
      for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index].slice(2);
        check(argv[index].startsWith("--") && allowedOptions.has(key) && !(key in options), "Unknown or duplicate option.");
        options[key] = argv[index + 1];
      }
      process.stdout.write(renderGatewayService(options));
    }
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
