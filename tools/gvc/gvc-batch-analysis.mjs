import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function analyzeGvcBatch(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const evidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner");
  const loopFiles = existsSync(evidenceDir)
    ? readdirSync(evidenceDir)
      .filter((name) => /^loop-\d{4}-\d{2}-\d{2}-\d+\.json$/.test(name))
      .sort()
    : [];
  const loops = loopFiles.map((name) => readJson(path.join(evidenceDir, name))).filter(Boolean);
  const mutationLoops = loops.filter((loop) => loop.realExecutionPerformed === true);
  const rollbackLoops = loops.filter((loop) => loop.mutationResult?.rollbackPerformed === true || loop.mutationResult?.status === "rolled_back");
  const rollbackFailedLoops = loops.filter((loop) => loop.mutationResult?.rollbackSucceeded === false);
  const blockedLowValueTasks = readJson(path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2034-gvc-task-quality-gate/task-quality-verify-result.json"))?.blockedLowValueTasks || [];
  const lastMutation = [...loops].reverse().find((loop) => loop.mutationResult);
  const touchedCounts = {};
  for (const loop of mutationLoops) {
    for (const file of loop.mutationResult?.mutatedFiles || []) {
      touchedCounts[file] = (touchedCounts[file] || 0) + 1;
    }
  }
  return {
    loopCount: loops.length,
    realMutationCount: mutationLoops.length,
    realModifiedFiles: Array.from(new Set(mutationLoops.flatMap((loop) => loop.mutationResult?.mutatedFiles || []))),
    rollbackCount: rollbackLoops.length,
    rollbackFailedCount: rollbackFailedLoops.length,
    failedMutationCount: loops.filter((loop) => loop.status === "blocked" && loop.mutationResult).length,
    noOpCount: loops.filter((loop) => loop.status === "idle" || loop.blocker === "no_allowed_l0_l1_l2_task").length,
    blockedLowValueTasks,
    qualityGateBlockedCount: blockedLowValueTasks.length,
    skippedApprovalRequiredTasks: Array.from(new Set(loops.flatMap((loop) => loop.skippedApprovalRequiredTasks || []))),
    providerCallsMade: loops.some((loop) => loop.providerCallsMade === true),
    secretRead: loops.some((loop) => loop.secretRead === true),
    deployExecuted: loops.some((loop) => loop.deployExecuted === true),
    chatGatewayExecuteModified: loops.some((loop) => loop.chatGatewayExecuteModified === true),
    legacyModified: loops.some((loop) => loop.legacyModified === true),
    projectContextModified: loops.some((loop) => loop.projectContextModified === true),
    lastMutationFiles: lastMutation?.mutationResult?.mutatedFiles || [],
    lastRollbackStatus: lastMutation?.mutationResult?.rollbackPerformed ? lastMutation.mutationResult.status : "none",
    touchedCounts,
  };
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}
