import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

export function generateRealBatchMutationPlan(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const nextActions = readJson(repoRoot, "docs/project-brain/next-actions.json", { actions: [] });
  const tasks = (nextActions.actions || [])
    .filter((action) => action.status === "ready")
    .filter((action) => ["L0", "L1", "L2"].includes(action.riskLevel))
    .filter((action) => action.quality?.recommendedAction === "allow")
    .filter((action) => Array.isArray(action.mutationPlan?.mutations))
    .slice(0, 10)
    .map((action, index) => ({
      taskId: action.taskId,
      order: index + 1,
      riskLevel: action.riskLevel,
      touches: action.touches || [],
      rollbackPlan: action.rollbackPlan || "Restore pre-mutation snapshots when verifier fails.",
      verifierCommand: action.verifierCommand || "node --check tools/gvc/low-risk-autonomous-executor.mjs",
      mutationPlan: action.mutationPlan,
    }));
  const plan = {
    phaseId: "Phase2036-GVC-Real-Batch-Mutation-Plan",
    generatedAt: new Date().toISOString(),
    maxMutationTasks: 10,
    maxMutationsPerLoop: 1,
    dailyRealExecutionLoopLimit: 100,
    tasks,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
  const planPath = path.join(repoRoot, "docs/project-brain/real-batch-mutation-plan.json");
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const evidencePath = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2036-gvc-real-batch-mutation-plan/real-batch-mutation-plan-result.json");
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({ ...plan, status: tasks.length > 0 ? "passed" : "blocked", blocker: tasks.length > 0 ? "none" : "no_mutation_tasks" }, null, 2)}\n`, "utf8");
  return plan;
}

function readJson(repoRoot, relativePath, fallback) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(generateRealBatchMutationPlan(), null, 2));
}
