import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "phase-79a-first-run-entry";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-79a-first-run-entry.json");
const evidenceMdPath = resolve(evidenceDir, "phase-79a-first-run-entry.md");
const mode = process.argv[2] ?? "check";

const requiredScripts = [
  "start:pme",
  "dev:phase7b",
  "status:phase10a",
  "health:phase12a",
  "logs:phase16a",
  "idle:phase15a",
  "help:phase14a",
  "verify:phase78a",
  "verify:phase79a",
  "verify:phase81a",
];
const requiredFiles = [
  "package.json",
  "tools/phase9c/managed-dev.mjs",
  "tools/phase12a/health.mjs",
  "tools/phase14a/help.mjs",
  "docs/GLOBAL_RELEASE_READINESS.md",
];

if (mode === "start") {
  await startUserEntry();
} else if (mode === "check" || mode === "verify") {
  await checkUserEntry({ writeEvidence: mode === "verify" });
} else {
  console.error("Usage: node ./tools/phase79a/first-run.mjs <check|verify|start>");
  process.exit(1);
}

async function startUserEntry() {
  const evidence = await buildReadinessEvidence();
  printHumanSummary(evidence);

  if (evidence.status !== "passed") {
    console.error("PME 启动前预检未通过，请先按上面的缺口修复后再启动。");
    process.exit(1);
  }

  console.log("");
  console.log("PME 移动地球正在启动。启动成功后访问：");
  console.log(`- ${evidence.urls.webConsole}`);
  console.log("");
  console.log("常用后续命令：");
  console.log("- 查看状态：cmd /c pnpm status:phase10a");
  console.log("- 看健康：cmd /c pnpm health:phase12a");
  console.log("- 看日志：cmd /c pnpm logs:phase16a");
  console.log("- 安全停止：cmd /c pnpm idle:phase15a");
  console.log("");

  const child = spawn(process.execPath, ["./tools/phase9c/managed-dev.mjs", "start"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  child.once("close", async (exitCode) => {
    if (exitCode === 0) {
      await openWebConsole(evidence.urls.webConsole);
    }
    process.exit(exitCode ?? 1);
  });
}

async function checkUserEntry({ writeEvidence }) {
  const evidence = await buildReadinessEvidence();

  if (writeEvidence) {
    await writeReadinessEvidence(evidence);
  }

  printHumanSummary(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
}

async function buildReadinessEvidence() {
  const generatedAt = new Date().toISOString();
  const rootPackage = await readRootPackage();
  const missingScripts = requiredScripts.filter((scriptName) => !rootPackage.scripts?.[scriptName]);
  const missingFiles = requiredFiles.filter((filePath) => !existsSync(resolve(repoRoot, filePath)));
  const nodeVersion = process.versions.node;
  const nodeMajor = Number(nodeVersion.split(".")[0]);
  const nodeOk = Number.isFinite(nodeMajor) && nodeMajor >= 20;
  const packageManager = rootPackage.packageManager ?? "";
  const packageManagerOk = packageManager.startsWith("pnpm@");
  const runningUnderPnpm = String(process.env.npm_config_user_agent ?? "").includes("pnpm");
  const serviceUrl = getServiceUrl();
  const localHealth = await probeLocalHealth(`${serviceUrl}/health/check`);
  const passed = missingScripts.length === 0 && missingFiles.length === 0 && nodeOk && packageManagerOk;

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt,
    runtime: {
      nodeVersion,
      nodeOk,
      packageManager,
      packageManagerOk,
      runningUnderPnpm,
    },
    scripts: {
      required: requiredScripts,
      missing: missingScripts,
    },
    files: {
      required: requiredFiles,
      missing: missingFiles,
    },
    urls: {
      serviceUrl,
      webConsole: `${serviceUrl}/ui`,
      healthCheck: `${serviceUrl}/health/check`,
    },
    localHealth,
    safety: {
      providerCalls: false,
      runtimeMutation: false,
      processStartDuringVerify: false,
      processStopDuringVerify: false,
      secretsPrinted: false,
      legacyModified: false,
    },
    userEntry: {
      startCommand: "cmd /c pnpm start:pme",
      underlyingManagedStart: "node ./tools/phase9c/managed-dev.mjs start",
      statusCommand: "cmd /c pnpm status:phase10a",
      stopCommand: "cmd /c pnpm idle:phase15a",
      webConsole: `${serviceUrl}/ui`,
      autoOpenBrowser: shouldAutoOpenBrowser(),
      disableBrowserOpen: "set PME_SKIP_BROWSER_OPEN=1 or PME_AUTO_OPEN_BROWSER=0",
    },
    conclusion: passed ? "first-run-entry-ready" : "first-run-entry-not-ready",
  };
}

async function openWebConsole(url) {
  if (!shouldAutoOpenBrowser()) {
    console.log("");
    console.log("已按配置跳过自动打开浏览器。你可以手动访问：");
    console.log(`- ${url}`);
    return;
  }

  const command = createOpenBrowserCommand(url);
  if (!command) {
    console.log("");
    console.log("当前系统不支持自动打开浏览器。你可以手动访问：");
    console.log(`- ${url}`);
    return;
  }

  console.log("");
  console.log("正在打开 Web 前台：");
  console.log(`- ${url}`);

  try {
    const child = spawn(command.command, command.args, {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch (error) {
    console.log("自动打开浏览器失败，但服务已启动。你可以手动访问：");
    console.log(`- ${url}`);
    console.log(`原因：${error instanceof Error ? error.message : String(error)}`);
  }
}

function shouldAutoOpenBrowser() {
  return process.env.PME_SKIP_BROWSER_OPEN !== "1" && process.env.PME_AUTO_OPEN_BROWSER !== "0";
}

function createOpenBrowserCommand(url) {
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  if (process.platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (process.platform === "linux") {
    return { command: "xdg-open", args: [url] };
  }

  return null;
}

async function readRootPackage() {
  return JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
}

async function probeLocalHealth(url) {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1200),
    });
    const body = await response.json().catch(() => null);

    return {
      checked: true,
      reachable: true,
      httpStatus: response.status,
      ready: response.ok && body?.data?.status === "ready",
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      checked: true,
      reachable: false,
      ready: false,
      reason: "service is not running or not reachable yet",
      elapsedMs: Date.now() - startedAt,
    };
  }
}

function getServiceUrl() {
  return trimTrailingSlash(process.env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100");
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function printHumanSummary(evidence) {
  console.log("PME 移动地球 first-run 入口预检");
  console.log(`- 状态：${evidence.status}`);
  console.log(`- Node：${evidence.runtime.nodeVersion} (${evidence.runtime.nodeOk ? "ok" : "needs >=20"})`);
  console.log(`- 包管理器：${evidence.runtime.packageManager || "unknown"} (${evidence.runtime.packageManagerOk ? "ok" : "needs pnpm"})`);
  console.log(`- Web 入口：${evidence.urls.webConsole}`);
  console.log(
    `- 当前本地服务：${evidence.localHealth.ready ? "ready" : evidence.localHealth.reachable ? "reachable but not ready" : "not running"}`,
  );

  if (evidence.scripts.missing.length > 0) {
    console.log(`- 缺少脚本：${evidence.scripts.missing.join(", ")}`);
  }

  if (evidence.files.missing.length > 0) {
    console.log(`- 缺少文件：${evidence.files.missing.join(", ")}`);
  }
}

async function writeReadinessEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 79A First-Run Entry Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Start command: ${body.userEntry.startCommand}
- Web console: ${body.urls.webConsole}
- Auto-open browser: ${body.userEntry.autoOpenBrowser}
- Disable browser open: ${body.userEntry.disableBrowserOpen}
- Node OK: ${body.runtime.nodeOk}
- Package manager OK: ${body.runtime.packageManagerOk}
- Missing scripts: ${body.scripts.missing.join(", ") || "none"}
- Missing files: ${body.files.missing.join(", ") || "none"}
- Local health checked: ${body.localHealth.checked}
- Local health ready: ${body.localHealth.ready}
- Provider calls performed: ${body.safety.providerCalls}
- Runtime mutation during verify: ${body.safety.runtimeMutation}
- Secrets printed: ${body.safety.secretsPrinted}
- Conclusion: ${body.conclusion}
`;
}
