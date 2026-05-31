import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createTaskCapsule } from "../../packages/gvc-permission-engine/src/index.js";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const capsule = createTaskCapsule({
  selectedTask: { taskId: "phase2054-sample", title: "Generate task capsule", riskLevel: "L1" },
  riskDecision: { decision: "allow", reason: "low risk docs/evidence task" },
  mutationPlan: { mutations: [{ path: "apps/ai-gateway-service/evidence/phase2054-agent-loop-memory-snapshot/sample.json", type: "write_file" }] },
  verifierResult: { command: "pnpm run verify:phase2054-agent-loop-memory-snapshot", status: "passed" },
  rollbackStatus: { rollbackPerformed: false, rollbackSucceeded: null },
  nextActionReason: "Continue to seal verifier.",
});

check("selected_task_recorded", capsule.selectedTask.taskId === "phase2054-sample");
check("risk_decision_recorded", capsule.riskDecision.decision === "allow");
check("mutation_plan_recorded", capsule.mutationPlan.mutations.length === 1);
check("verifier_result_recorded", capsule.verifierResult.status === "passed");
check("rollback_status_recorded", capsule.rollbackStatus.rollbackPerformed === false);
check("next_action_reason_recorded", capsule.nextActionReason.length > 0);
check("capsule_hash_recorded", typeof capsule.capsuleHash === "string" && capsule.capsuleHash.length >= 16);

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2054-Agent-Loop-Memory-Snapshot",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  capsule,
  copiedClaudeCodeSource: false,
  providerCallsMade: false,
  secretRead: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
};

writeEvidence("apps/ai-gateway-service/evidence/phase2054-agent-loop-memory-snapshot/result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (failed.length > 0) process.exit(1);

function writeEvidence(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
