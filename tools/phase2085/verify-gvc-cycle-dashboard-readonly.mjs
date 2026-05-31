import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const resultPath = "apps/ai-gateway-service/evidence/phase2085-gvc-cycle-dashboard-readonly/root-result.json";
const command = spawnSync("pnpm", ["--filter", "@unified-ai-system/ai-gateway-service", "verify:phase2085-gvc-cycle-dashboard-readonly"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: process.platform === "win32",
  timeout: 120000,
});
const serviceResult = readJson("apps/ai-gateway-service/evidence/phase2085-gvc-cycle-dashboard-readonly/result.json") || {};
const result = {
  phaseId: "Phase2085-GVC-Cycle-Dashboard-ReadOnly-Root-Verification",
  completed: command.status === 0 && serviceResult.completed === true,
  status: command.status === 0 && serviceResult.completed === true ? "passed" : "failed",
  recommendedSealed: command.status === 0 && serviceResult.completed === true,
  blocker: command.status === 0 && serviceResult.completed === true ? "none" : serviceResult.blocker || "service_dashboard_verifier_failed",
  generatedAt: new Date().toISOString(),
  command: "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase2085-gvc-cycle-dashboard-readonly",
  exitCode: command.status ?? 1,
  dashboardReadonlyReady: serviceResult.dashboardReadonlyReady === true,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
};
writeJson(resultPath, result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (!result.recommendedSealed) process.exit(1);

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
