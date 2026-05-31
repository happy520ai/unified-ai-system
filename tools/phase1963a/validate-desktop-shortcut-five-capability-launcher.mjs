import { writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const phase = "Phase1963A";
const evidencePath = "apps/ai-gateway-service/evidence/phase1963a/desktop-shortcut-five-capability-launcher-result.json";
const shortcutPath = "C:\\Users\\Administrator\\Desktop\\AI Gateway Workbench.lnk";
const launcherPath = "tools/windows/start-ai-gateway-workbench.ps1";
const launcherText = readFileSync(resolve(process.cwd(), launcherPath), "utf8");
let shortcut = null;
let shortcutError = null;

try {
  const script = [
    "$shell = New-Object -ComObject WScript.Shell",
    `$s = $shell.CreateShortcut('${shortcutPath.replaceAll("'", "''")}')`,
    "[pscustomobject]@{",
    "TargetPath=$s.TargetPath",
    "Arguments=$s.Arguments",
    "WorkingDirectory=$s.WorkingDirectory",
    "Description=$s.Description",
    "IconLocation=$s.IconLocation",
    "} | ConvertTo-Json -Depth 3",
  ].join("\n");
  shortcut = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  }));
} catch (error) {
  shortcutError = error instanceof Error ? error.message : String(error);
}

const checks = [
  check("shortcut_exists", existsSync(shortcutPath)),
  check("launcher_exists", existsSync(resolve(process.cwd(), launcherPath))),
  check("launcher_uses_five_capability_anchor", launcherText.includes("/ui#five-capability-activation-panel")),
  check("launcher_checks_real_capability_route", launcherText.includes("/real-capabilities/status")),
  check("shortcut_target_powershell", /powershell\.exe$/iu.test(shortcut?.TargetPath || "")),
  check("shortcut_points_to_launcher", String(shortcut?.Arguments || "").includes("start-ai-gateway-workbench.ps1")),
  check("shortcut_working_directory_repo", String(shortcut?.WorkingDirectory || "").endsWith("unified-ai-system")),
  check("shortcut_description_updated", String(shortcut?.Description || "").includes("Five Real Capabilities")),
  check("no_deploy_release_commit_push", !launcherText.includes("git push") && !launcherText.includes("git commit") && !launcherText.includes("deploy") && !launcherText.includes("release")),
];

const passed = checks.every((item) => item.passed);
const result = {
  phase,
  name: "Desktop Shortcut Five Capability Launcher Verification",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "phase1963a_desktop_shortcut_launcher_failed",
  shortcutPath,
  launcherPath,
  shortcut,
  shortcutError,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  commitCreated: false,
  pushExecuted: false,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}
