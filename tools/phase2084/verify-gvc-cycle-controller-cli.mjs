import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2084-GVC-Cycle-Controller-CLI";
const docsPath = "docs/phase2084-gvc-cycle-controller-cli.md";
const resultPath = "apps/ai-gateway-service/evidence/phase2084-gvc-cycle-controller-cli/result.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const source = readText("tools/gvc/run-cycle-controller.mjs");
const seal = readJson("apps/ai-gateway-service/evidence/phase2086-gvc-high-value-autonomy-cycle-controller/result.json") || {};
const audit = readJson("apps/ai-gateway-service/evidence/phase2083-gvc-cycle-audit/result.json") || {};
const nextActions = readJson("docs/project-brain/next-actions.json") || {};
const forbiddenTargets = (Array.isArray(nextActions.actions) ? nextActions.actions : [])
  .flatMap((action) => action.touches || action.targetFiles || [])
  .filter(isForbiddenTarget);

check("gvc_cycle_script_registered", packageJson.scripts?.["gvc:cycle"] === "node tools/gvc/run-cycle-controller.mjs");
check("default_max_cycles", source.includes("maxCycles: 1"));
check("default_batch_loop_limit", source.includes("batchLoopLimit: 10"));
check("default_interval_ms", source.includes("intervalMs: 1000"));
check("default_dry_run_false", source.includes("dryRunOnly: false"));
check("default_no_provider", source.includes("noProvider: true"));
check("default_no_secret", source.includes("noSecret: true"));
check("default_no_deploy", source.includes("noDeploy: true"));
check("inspect_next_actions", source.includes("docs/project-brain/next-actions.json"));
check("planner_refresh_available", source.includes("refreshCycleNextActions"));
check("runner_batch_available", source.includes("runCycleRunnerBatch"));
check("audit_batch_available", source.includes("buildCycleAudit"));
check("seal_result_written", seal.phaseId === "Phase2086-GVC-High-Value-Autonomy-Cycle-Controller");
check("phase2083_audit_passed", audit.completed === true);
check("no_forbidden_next_action_targets", forbiddenTargets.length === 0, forbiddenTargets.join(", "));
check("provider_false", seal.providerCallsMade === false);
check("secret_false", seal.secretRead === false);
check("deploy_false", seal.deployExecuted === false);
check("chat_gateway_false", seal.chatGatewayExecuteModified === false);
check("legacy_project_context_false", seal.legacyModified === false && seal.projectContextModified === false);

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  gvcCycleCommandReady: failed.length === 0,
  command: "pnpm run gvc:cycle",
  defaultArgs: {
    maxCycles: 1,
    batchLoopLimit: 10,
    intervalMs: 1000,
    dryRunOnly: false,
    noProvider: true,
    noSecret: true,
    noDeploy: true,
  },
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  checks,
};

writeJson(resultPath, result);
writeText(docsPath, [
  "# Phase2084-GVC-Cycle-Controller-CLI",
  "",
  "## Command",
  "",
  "```powershell",
  "pnpm run gvc:cycle",
  "```",
  "",
  "## Defaults",
  "",
  "- maxCycles=1",
  "- batchLoopLimit=10",
  "- intervalMs=1000",
  "- dryRunOnly=false",
  "- noProvider=true",
  "- noSecret=true",
  "- noDeploy=true",
  "",
].join("\n"));

console.log(JSON.stringify({ status: result.status, blocker: result.blocker, command: result.command }, null, 2));
if (failed.length > 0) process.exit(1);

function isForbiddenTarget(file) {
  const normalized = String(file || "").replaceAll("\\", "/").toLowerCase();
  return normalized === "project_context.md" ||
    normalized.startsWith("legacy/") ||
    normalized.endsWith("/.env") ||
    normalized.endsWith("/auth.json") ||
    normalized.includes("chat-gateway/execute") ||
    normalized.includes("/chat/") ||
    normalized.includes("credential") ||
    normalized.includes("provider-runtime") ||
    normalized.includes("billing") ||
    normalized.includes("payment");
}

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readText(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function writeJson(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
