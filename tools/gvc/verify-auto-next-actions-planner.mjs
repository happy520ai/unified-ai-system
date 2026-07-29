import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateNextActions } from "./generate-next-actions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const checks = [];

function check(id, condition, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const { nextActions, evidence } = generateNextActions({ repoRoot });
const allowed = nextActions.actions.filter((action) => action.status === "ready" && ["L0", "L1", "L2"].includes(action.riskLevel));
const rejected = nextActions.rejectedByQualityGate || [];
const packageJson = readJson("package.json") ?? {};

check("generator_exists", existsSync(resolve("tools/gvc/generate-next-actions.mjs")));
check("next_actions_written", existsSync(resolve("docs/project-brain/next-actions.json")));
check("at_least_5_high_value_allowed", allowed.length >= 5, String(allowed.length));
check("all_allowed_quality_allow", allowed.every((action) => action.quality?.recommendedAction === "allow"));
check("all_allowed_have_mutation_plan", allowed.every((action) => Array.isArray(action.mutationPlan?.mutations)));
check("low_value_rejected", rejected.some((entry) => entry.taskId === "phase2035-low-value-duplicate-doc"));
check("l3_generated_approval_required", nextActions.actions.some((action) => action.riskLevel === "L3" && action.status === "approval_required"));
check("evidence_written", existsSync(resolve("apps/ai-gateway-service/evidence/phase2035-gvc-auto-next-actions-planner/auto-next-actions-result.json")));
check("root_verify_script", packageJson.scripts?.["verify:phase2035-gvc-auto-next-actions-planner"] === "node tools/gvc/verify-auto-next-actions-planner.mjs");

const failedChecks = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2035-GVC-Auto-Next-Actions-Planner",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  generatedAllowedTaskCount: allowed.length,
  lowValueRejected: rejected.some((entry) => entry.taskId === "phase2035-low-value-duplicate-doc"),
  approvalRequiredTaskCount: nextActions.actions.filter((action) => action.status === "approval_required").length,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((entry) => entry.id).join(", "),
  plannerEvidence: evidence,
  checks,
};

writeEvidence("phase2035-gvc-auto-next-actions-planner/auto-next-actions-verify-result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, generatedAllowedTaskCount: result.generatedAllowedTaskCount, lowValueRejected: result.lowValueRejected }, null, 2));
if (failedChecks.length > 0) process.exit(1);

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeEvidence(relativePath, value) {
  const filePath = resolve(`apps/ai-gateway-service/evidence/${relativePath}`);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
