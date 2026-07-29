import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreNextActionQuality, writeQualityScores } from "./score-next-action-quality.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const checks = [];

function check(id, condition, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const policyPath = "docs/project-brain/task-quality-policy.json";
const packageJson = readJson("package.json") ?? {};
const lowValue = {
  taskId: "phase2034-low-value-docs-only",
  title: "Repeat generic docs note",
  riskLevel: "L1",
  priority: 5,
  status: "ready",
  touches: ["docs/phase-old-note.md"],
  operations: ["docs_update"],
};
const duplicate = { ...lowValue, taskId: "phase2034-low-value-docs-only-copy" };
const highValue = {
  taskId: "phase2034-high-value-verifier-evidence",
  title: "Add useful autonomous mutation audit evidence",
  riskLevel: "L1",
  priority: 100,
  status: "ready",
  touches: [
    "apps/ai-gateway-service/evidence/phase2034-gvc-task-quality-gate/high-value.json",
    "tools/gvc/verify-task-quality-gate.mjs",
  ],
  operations: ["evidence_write", "verifier_update"],
  expectedEvidence: "apps/ai-gateway-service/evidence/phase2034-gvc-task-quality-gate/high-value.json",
  mutationPlan: {
    mutations: [
      {
        type: "write_file",
        path: "apps/ai-gateway-service/evidence/phase2034-gvc-task-quality-gate/high-value.json",
        content: "{\n  \"ok\": true\n}\n",
      },
    ],
  },
};

const lowScore = scoreNextActionQuality({ repoRoot, action: lowValue, existingActions: [lowValue, duplicate, highValue] });
const highScore = scoreNextActionQuality({ repoRoot, action: highValue, existingActions: [lowValue, duplicate, highValue] });
const qualityResult = writeQualityScores({ repoRoot });

check("policy_exists", existsSync(resolve(policyPath)), policyPath);
check("scorer_exists", existsSync(resolve("tools/gvc/score-next-action-quality.mjs")));
check("low_value_blocked", lowScore.recommendedAction !== "allow", lowScore.recommendedAction);
check("low_value_has_required_fields", ["ownerValueScore", "engineeringValueScore", "duplicateRiskScore", "staleRiskScore", "evidenceValueScore", "recommendedAction"].every((field) => Object.hasOwn(lowScore, field)));
check("high_value_allowed", highScore.recommendedAction === "allow", highScore.recommendedAction);
check("quality_result_written", existsSync(resolve("apps/ai-gateway-service/evidence/phase2034-gvc-task-quality-gate/task-quality-result.json")));
check("quality_result_has_scores", Array.isArray(qualityResult.scores));
check("root_verify_script", packageJson.scripts?.["verify:phase2034-gvc-task-quality-gate"] === "node tools/gvc/verify-task-quality-gate.mjs");

const failedChecks = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2034-GVC-Autonomous-Task-Quality-Gate",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  lowValueTaskBlocked: lowScore.recommendedAction !== "allow",
  highValueLowRiskTaskAllowed: highScore.recommendedAction === "allow",
  blockedLowValueTasks: [lowScore].filter((score) => score.recommendedAction !== "allow").map((score) => score.taskId),
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((entry) => entry.id).join(", "),
  checks,
};

writeEvidence("phase2034-gvc-task-quality-gate/task-quality-verify-result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, lowValueTaskBlocked: result.lowValueTaskBlocked, highValueLowRiskTaskAllowed: result.highValueLowRiskTaskAllowed }, null, 2));
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
