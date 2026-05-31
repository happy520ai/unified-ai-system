import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultReportPath = "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.html";

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export async function openOwnerDailyReport(relativePath = defaultReportPath) {
  const absolutePath = repoPath(relativePath);
  await stat(absolutePath);

  const command = process.platform === "win32"
    ? "powershell.exe"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32"
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process -LiteralPath $args[0]", absolutePath]
    : [absolutePath];

  return await new Promise((resolveOpen) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    child.once("error", (error) => resolveOpen({
      ownerDailyReportAutoOpened: false,
      reportPath: relativePath,
      error: error.message,
    }));
    child.once("spawn", () => {
      child.unref();
      resolveOpen({
        ownerDailyReportAutoOpened: true,
        reportPath: relativePath,
      });
    });
  });
}

async function main() {
  const reportPath = process.argv.find((arg) => arg.startsWith("--path="))?.slice("--path=".length) ?? defaultReportPath;
  const result = await openOwnerDailyReport(reportPath);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ownerDailyReportAutoOpened) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  await main();
}
