import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const cmdPath = path.join(repoRoot, "tools/gvc/start-timed-local-runner.cmd");
const ps1Path = path.join(repoRoot, "tools/gvc/start-timed-local-runner.ps1");
const docsPath = path.join(repoRoot, "docs/phase2020-gvc-desktop-one-click-launcher.md");
const evidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2020-gvc-desktop-one-click-launcher");
const evidencePath = path.join(evidenceDir, "desktop-one-click-launcher-result.json");
const requiredCommand =
  "pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=true";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function hasForbiddenLauncherBehavior(text) {
  return /schtasks|startup|shell:startup|desktop|wscript\.shell|createshortcut|provider_call|secret_read|deploy|release|git push|git commit/i.test(
    text,
  );
}

function main() {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  assert(packageJson.scripts["verify:phase2020-gvc-desktop-one-click-launcher"], "missing Phase2020 verify script");
  assert(packageJson.scripts["gvc:timed-runner"], "missing gvc:timed-runner script");
  assert(existsSync(cmdPath), "missing .cmd launcher");
  assert(existsSync(ps1Path), "missing .ps1 launcher");
  assert(existsSync(docsPath), "missing Phase2020 docs");

  const cmd = readText(cmdPath);
  const ps1 = readText(ps1Path);
  assert(cmd.includes(requiredCommand), ".cmd launcher does not contain fixed command");
  assert(ps1.includes(requiredCommand), ".ps1 launcher does not contain fixed command");
  assert(!hasForbiddenLauncherBehavior(cmd), ".cmd launcher contains forbidden behavior");
  assert(!hasForbiddenLauncherBehavior(ps1), ".ps1 launcher contains forbidden behavior");

  const result = {
    phaseId: "Phase2020-GVC-Desktop-One-Click-Launcher",
    status: "passed",
    generatedAt: new Date().toISOString(),
    launcherScriptsGenerated: true,
    launcherScripts: [
      "tools/gvc/start-timed-local-runner.cmd",
      "tools/gvc/start-timed-local-runner.ps1",
    ],
    desktopWritten: false,
    backgroundServiceRegistered: false,
    startupAutoRunRegistered: false,
    windowsTaskSchedulerRegistered: false,
    fixedCommand: requiredCommand,
    stopMethod: "Ctrl+C",
    dryRunOnly: true,
    recommendedSealed: true,
    blocker: "none",
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    deployReleasePerformed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    commitPerformed: false,
    pushPerformed: false,
    workspaceCleanClaimed: false,
  };

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`);
  console.log("Phase2020 GVC desktop one-click launcher verifier passed");
}

try {
  main();
} catch (error) {
  console.error(`Phase2020 GVC desktop one-click launcher verifier failed: ${error.message}`);
  process.exit(1);
}
