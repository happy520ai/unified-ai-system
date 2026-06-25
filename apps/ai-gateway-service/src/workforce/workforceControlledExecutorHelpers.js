/**
 * Helper functions extracted from workforceControlledExecutor.js
 *
 * Pure result-building utilities used by the controlled execution orchestrator.
 */

import { PRIORITY_LEVELS } from "./taskQueueManager.js";

export const CONTROLLED_EXECUTION_PHASE = "PhaseC001";
export const CONTROLLED_EXECUTION_MODE = "controlled-workforce-execution";

export function mapPriority(priority) {
  if (!priority) return "P3";
  const p = String(priority).toUpperCase();
  if (PRIORITY_LEVELS[p]) return p;
  return "P3";
}

export function createBlockedResult(plan, planId, code, message) {
  return {
    success: false,
    phase: CONTROLLED_EXECUTION_PHASE,
    mode: CONTROLLED_EXECUTION_MODE,
    planId,
    goal: plan.goal,
    code,
    message,
    executionStatus: "blocked",
    safety: {
      executionEnabled: false,
      dryRun: true,
      providerCallsMade: false,
      secretValueExposed: false,
      projectFileWrites: false,
    },
  };
}

export function createDryRunResult(plan, planId, startedAt, preScan, approvalCheck) {
  const tasks = plan.taskBreakdown ?? [];
  return {
    success: true,
    phase: CONTROLLED_EXECUTION_PHASE,
    mode: CONTROLLED_EXECUTION_MODE,
    planId,
    goal: plan.goal,
    executionStatus: "dry_run_preview",
    dryRun: true,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    preview: {
      rolesToExecute: tasks.map((t) => t.roleId ?? t.role),
      totalRoles: tasks.length,
      estimatedDurationMs: tasks.length * 5000,
      approvalStatus: approvalCheck.approved ? "approved" : "pending",
      preScanResult: preScan.result,
      wouldCreateWorktree: true,
      wouldCaptureEvidence: true,
    },
    nextSteps: [
      "Set WORKFORCE_EXECUTION_ENABLED=true to enable real execution",
      "Call POST /workforce/execute/approve to approve this plan",
      "Call POST /workforce/execute to run with real execution enabled",
    ],
    safety: {
      executionEnabled: false,
      dryRun: true,
      providerCallsMade: false,
      secretValueExposed: false,
      projectFileWrites: false,
      deployExecuted: false,
      releaseExecuted: false,
    },
  };
}
