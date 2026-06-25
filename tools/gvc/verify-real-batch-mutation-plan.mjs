import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateRealBatchMutationPlan } from "./generate-real-batch-mutation-plan.mjs";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const checks = [];

function check(id, condition, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const plan = generateRealBatchMutationPlan({ repoRoot });
const packageJson = readJson("package.json") ?? {};
const safePath = (filePath) =>
  String(filePath).startsWith("docs/phase") ||
  String(filePath).startsWith("apps/ai-gateway-service/evidence/") ||
  String(filePath).startsWith("tools/gvc/") ||
  String(filePath).startsWith("tools/phase") ||
  String(filePath) === "package.json";

check("plan_written", existsSync(resolve("docs/project-brain/real-batch-mutation-plan.json")));
check("max_tasks_10", plan.maxMutationTasks === 10);
check("task_count_within_limit", plan.tasks.length > 0 && plan.tasks.length <= 10, String(plan.tasks.length));
check("all_tasks_have_rollback", plan.tasks.every((task) => typeof task.rollbackPlan === "string" && task.rollbackPlan.length > 0));
check("all_tasks_have_verifier", plan.tasks.every((task) => typeof task.verifierCommand === "string" && task.verifierCommand.length > 0));
check("all_mutations_safe_scope", plan.tasks.every((task) => task.mutationPlan.mutations.every((mutation) => safePath(mutation.path))));
check("provider_false", plan.providerCallsMade === false);
check("secret_false", plan.secretRead === false);
check("deploy_false", plan.deployExecuted === false);
check("chat_false", plan.chatGatewayExecuteModified === false);
check("root_verify_script", packageJson.scripts?.["verify:phase2036-gvc-real-batch-mutation-plan"] === "node tools/gvc/verify-real-batch-mutation-plan.mjs");

const failedChecks = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2036-GVC-Real-Batch-Mutation-Plan",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  mutationTaskCount: plan.tasks.length,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((entry) => entry.id).join(", "),
  checks,
};
writeEvidenceFile("apps/ai-gateway-service/evidence/phase2036-gvc-real-batch-mutation-plan/real-batch-mutation-plan-verify-result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, mutationTaskCount: result.mutationTaskCount }, null, 2));
if (failedChecks.length > 0) process.exit(1);

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

