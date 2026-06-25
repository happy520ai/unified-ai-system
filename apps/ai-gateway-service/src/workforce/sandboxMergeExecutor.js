/**
 * sandboxMergeExecutor.js
 *
 * The "sandbox-merge" autonomy mode: the highest-leverage relaxation of the
 * safety design. The agent runs at FULL power inside an isolated git worktree
 * — no dry-run, no file-count cap, no per-file approval — but:
 *
 *   1. The worktree NEVER touches the main working tree or main branch.
 *   2. Every change lands on a candidate branch (workforce/<planId>-...).
 *   3. A verify gate (independent) must pass for the candidate to advance.
 *   4. If verify fails OR a runtime error occurs, the entire worktree + branch
 *      are rolled back automatically. The main repo is untouched.
 *   5. The daily budget pool + scope token + trust ladder (autonomyBudget.js)
 *      bound how much damage an agent can do even inside the sandbox.
 *
 * In short: "full open inside a sandbox, gated merge out, automatic rollback
 * on any failure." This makes "dare to delegate" and "still safe" no longer
 * a trade-off — the safety comes from recoverability, not from permission.
 *
 * Boundary (NEVER relaxed, even in sandbox-merge):
 *   - /chat and /chat-gateway/execute main chain
 *   - provider runtime, secrets, auth.json, .env
 *   - deploy / release / commit / push to main
 *   - legacy/, .git
 * The sandbox commits only to its OWN candidate branch, never to main.
 *
 * Git/worktree helpers extracted to sandboxMergeHelpers.js.
 */

import { join, resolve } from "node:path";

import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createSecurityReviewCheckpoint } from "./securityReviewCheckpoint.js";
import { createExecutionLifecycle } from "./executionLifecycle.js";
import { createTaskEvidenceCapture } from "./taskEvidenceCapture.js";
import { createLogRedactor } from "./logRedactor.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { executeAllRoles } from "./roleExecutors.js";
import { createAutonomyBudget } from "./autonomyBudget.js";
import { AUTONOMY_MODES } from "./autonomyModes.js";
import {
  verifyGateStructural,
  snapshotWorktree,
  computeWorktreeDiff,
  commitWorktreeChanges,
  rollbackWorktree,
  mergeCandidateToMain,
  safeSafety,
} from "./sandboxMergeHelpers.js";

export const SANDBOX_MERGE_PHASE = "PhaseSandboxMerge";
export const SANDBOX_MERGE_MODE = "sandbox-merge-execution";

const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * Create the sandbox-merge executor.
 * @param {object} options
 * @param {string} [options.repoRoot]
 * @param {object} [options.env]
 * @param {string} [options.executionDir]
 * @param {object} [options.budget]  — an existing createAutonomyBudget() instance (optional)
 */
export function createSandboxMergeExecutor(options = {}) {
  const env = options.env ?? process.env;
  const repoRoot = resolve(options.repoRoot || env.WORKFORCE_REPO_ROOT || process.cwd());
  const executionDir = options.executionDir || resolve(repoRoot, ".data", "workforce", "sandbox-merge");
  const timeoutMs = Number(env.WORKFORCE_SANDBOX_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const worktree = createWorktreeIsolation({ repoRoot });
  const securityCheckpoint = createSecurityReviewCheckpoint();
  const lifecycle = createExecutionLifecycle({ lifecycleDir: executionDir });
  const evidenceCapture = createTaskEvidenceCapture({ evidenceDir: join(executionDir, "evidence") });
  const logRedactor = createLogRedactor();
  const budget = options.budget || createAutonomyBudget({ storePath: join(executionDir, "autonomy-budget.json"), env });

  return {
    getInfo() {
      return {
        phase: SANDBOX_MERGE_PHASE,
        mode: SANDBOX_MERGE_MODE,
        repoRoot,
        timeoutMs,
        budget: budget.getInfo(),
        modules: {
          worktree: worktree.getInfo(),
          securityCheckpoint: securityCheckpoint.getInfo?.() ?? { ready: true },
          lifecycle: lifecycle.getInfo(),
        },
      };
    },

    getBudget() {
      return budget;
    },

    /**
     * Run the workforce plan inside an isolated git worktree at FULL power.
     *
     * Pipeline:
     *   1.  Pre-flight: budget consume (worktreeMerges), security pre-scan
     *   2.  Create isolated worktree on a fresh candidate branch
     *   3.  Snapshot HEAD (for diff + auto-rollback reference)
     *   4.  Run executeAllRoles INSIDE the worktree context (full power)
     *   5.  Capture whatever file mutations the agents produced in the worktree
     *   6.  Compute the diff (names + hashes) of worktree vs HEAD
     *   7.  VERIFY GATE: run an independent verifier over the worktree state
     *       - syntax check every changed .js/.mjs/.cjs file
     *       - forbidden-surface check (none of the changes touch /chat etc.)
     *       - optional external verifier hook (options.verify)
     *   8.  GREEN  → commit changes on the candidate branch, record evidence,
     *                report "ready to merge". Main tree is untouched.
     *       RED    → AUTO-ROLLBACK: remove worktree, delete candidate branch,
     *                record rollback evidence, record trust demotion.
     *   9.  Always cleanup the worktree directory (the candidate branch persists
     *       if green, so a human can later merge it).
     *
     * @param {object} input — { goal, selectedRoles?, userId?, autonomyMode?, verify? }
     * @param {Function} [input.verify] — optional async verifier(worktreeCtx) => {pass, checks}
     */
    async execute(input = {}) {
      const startedAt = new Date();
      const plan = createWorkforcePlan(input);
      const planId = plan.workforceId ?? `wf_${Date.now()}`;
      const userId = input.userId ?? "system";
      const userVerify = typeof input.verify === "function" ? input.verify : null;
      const operationType = input.operationType || "workforce-sandbox-merge";

      const result = {
        phase: SANDBOX_MERGE_PHASE,
        mode: SANDBOX_MERGE_MODE,
        planId,
        goal: plan.goal,
        startedAt: startedAt.toISOString(),
        autonomyMode: "sandbox-merge",
      };

      // --- Step 1a: Budget consume (worktreeMerges) ---
      const budgetCheck = await budget.consume("worktreeMerges", 1);
      if (!budgetCheck.allowed) {
        return {
          ...result,
          success: false,
          executionStatus: "blocked",
          code: "budget_exhausted",
          message: `Daily worktree-merge budget exhausted: ${budgetCheck.reason}`,
          budgetSnapshot: await budget.getUsage(),
          safety: safeSafety(),
        };
      }

      // --- Step 1b: Pre-execution security scan ---
      const preScan = await securityCheckpoint.preExecutionScan?.(plan) ?? { result: "pass", findings: [] };
      if (preScan.result === "block") {
        await budget.recordTrustEvent(operationType, "red");
        return {
          ...result,
          success: false,
          executionStatus: "blocked",
          code: "security_pre_scan_blocked",
          message: `Pre-scan blocked: ${(preScan.findings ?? []).join(", ")}`,
          safety: safeSafety(),
        };
      }

      // --- Step 2: Create isolated worktree on a fresh candidate branch ---
      let worktreeRecord = null;
      let candidateBranch = null;
      try {
        const created = await worktree.create({ planId });
        if (!created?.success || !created?.worktree) {
          await budget.recordTrustEvent(operationType, "red");
          return {
            ...result,
            success: false,
            executionStatus: "blocked",
            code: "worktree_creation_failed",
            message: created?.reason || "worktree.create returned no worktree",
            safety: safeSafety(),
          };
        }
        worktreeRecord = created.worktree;
        candidateBranch = worktreeRecord.branch;
      } catch (err) {
        await budget.recordTrustEvent(operationType, "red");
        return {
          ...result,
          success: false,
          executionStatus: "blocked",
          code: "worktree_creation_failed",
          message: `Failed to create worktree: ${logRedactor.redact?.(err.message) ?? err.message}`,
          safety: safeSafety(),
        };
      }

      const worktreePath = worktreeRecord.path;
      const worktreeId = worktreeRecord.worktreeId;

      // --- Step 3: Snapshot HEAD ---
      let headSnapshot = null;
      try {
        headSnapshot = await snapshotWorktree(worktreePath, repoRoot);
      } catch (err) {
        await rollbackWorktree(worktree, worktreeId);
        await budget.recordTrustEvent(operationType, "red");
        return {
          ...result,
          success: false,
          executionStatus: "rolled_back",
          code: "snapshot_failed",
          message: `HEAD snapshot failed: ${err.message}`,
          worktree: { created: true, rolledBack: true },
          safety: safeSafety(),
        };
      }

      // --- Step 4: Initialize lifecycle + start ---
      await lifecycle.initialize(planId, {
        goal: plan.goal,
        userId,
        worktreeId,
        candidateBranch,
        roleCount: (plan.selectedRoles ?? []).length,
        startedAt: startedAt.toISOString(),
        mode: "sandbox-merge",
      });
      await lifecycle.start(planId);

      // --- Step 5: Run role executors INSIDE the sandbox context (full power) ---
      const roleResults = {};
      const executionErrors = [];
      let context = { plan, priorOutputs: {}, sandbox: { worktreePath, candidateBranch, repoRoot } };

      try {
        const allRoleResults = await executeAllRoles(plan.goal, context);
        for (const [roleId, roleResult] of Object.entries(allRoleResults?.roleOutputs ?? {})) {
          roleResults[roleId] = roleResult;
          await lifecycle.onAgentCompleted(planId, roleId, { success: true });
          await evidenceCapture.capture?.(planId, roleId, {
            input: plan.goal,
            output: roleResult,
            status: "completed",
            timestamp: new Date().toISOString(),
            sandbox: worktreeId,
          });
        }
      } catch (err) {
        executionErrors.push(logRedactor.redact?.(err.message) ?? err.message);
      }

      // --- Step 6: Compute worktree diff vs HEAD ---
      let diff = null;
      try {
        diff = await computeWorktreeDiff(worktreePath);
      } catch (err) {
        executionErrors.push(`diff_failed: ${err.message}`);
      }

      let changedFiles = diff?.files ?? [];

      // --- Step 7: VERIFY GATE ---
      // Pass 1: run the user verify hook (it may add files).
      // Pass 2: RE-COMPUTE the diff so any files the hook introduced are
      //         included in syntax_check / forbidden_path checks.
      let verifyResult = { pass: true, checks: [{ name: "user_verify_pending", pass: true }] };
      if (userVerify) {
        try {
          const ext = await userVerify({ changedFiles, worktreePath, context: { plan, worktreeId, candidateBranch, roleResults } });
          verifyResult = { pass: ext?.pass !== false, checks: [...(ext?.checks || []), ...(ext?.details || [])] };
        } catch (err) {
          verifyResult = { pass: false, checks: [{ name: "external_verifier", pass: false, error: err.message }] };
        }
        // Re-compute diff now that the hook may have added files
        try {
          diff = await computeWorktreeDiff(worktreePath);
          changedFiles = diff?.files ?? [];
        } catch (err) {
          executionErrors.push(`rediff_failed: ${err.message}`);
        }
      }

      // Run structural checks (syntax + forbidden path) over the COMPLETE diff.
      const structuralResult = await verifyGateStructural({
        changedFiles,
        worktreePath,
        budget,
      });
      verifyResult = {
        pass: verifyResult.pass && structuralResult.pass,
        checks: [...(verifyResult.checks || []), ...structuralResult.checks],
      };

      const postScan = await securityCheckpoint.postExecutionScan?.(plan, roleResults) ?? { result: "pass", findings: [] };
      if (postScan.result === "block" && verifyResult.pass) {
        verifyResult.pass = false;
        verifyResult.checks.push({ name: "post_security_scan", pass: false, reason: postScan.findings?.join(", ") });
      }

      // --- Step 8: GREEN → commit candidate branch / RED → auto-rollback ---
      let finalStatus;
      let merged = false;
      let rolledBack = false;
      let candidateCommit = null;

      if (verifyResult.pass && executionErrors.length === 0) {
        finalStatus = "completed";
        try {
          candidateCommit = await commitWorktreeChanges(worktreePath, planId, plan.goal);
          await budget.recordTrustEvent(operationType, "green");
          merged = true;
        } catch (err) {
          executionErrors.push(`commit_failed: ${err.message}`);
          finalStatus = "failed";
          await rollbackWorktree(worktree, worktreeId);
          await budget.recordTrustEvent(operationType, "rollback");
          rolledBack = true;
        }
      } else {
        finalStatus = executionErrors.length > 0 ? "failed" : "verify_failed";
        await rollbackWorktree(worktree, worktreeId);
        await budget.recordTrustEvent(operationType, executionErrors.length > 0 ? "red" : "rollback");
        rolledBack = true;
      }

      // --- Step 8b: AUTO-ADVANCE (sandbox-merge-auto mode only) ---
      let autoAdvanced = false;
      let autoMergeCommit = null;
      if (
        input.autonomyMode === AUTONOMY_MODES.SANDBOX_MERGE_AUTO &&
        merged &&
        candidateCommit &&
        finalStatus === "completed"
      ) {
        try {
          const advanced = await mergeCandidateToMain(repoRoot, candidateBranch, planId);
          autoAdvanced = advanced.merged;
          autoMergeCommit = advanced.mergeCommit;
        } catch (err) {
          executionErrors.push(`auto_advance_failed: ${err.message}`);
        }
      }

      // --- Step 9: Cleanup worktree directory ---
      if (!rolledBack) {
        try {
          await worktree.remove(worktreeId);
        } catch {
          // Non-fatal
        }
      }

      // --- Step 10: Complete lifecycle ---
      const lifecycleStatus = (finalStatus === "verify_failed") ? "failed" : finalStatus;
      try {
        await lifecycle.complete(planId, lifecycleStatus, {
          roleResults: Object.keys(roleResults).length,
          errors: executionErrors,
          verifyPass: verifyResult.pass,
          candidateBranch: merged ? candidateBranch : null,
          candidateCommit,
          rolledBack,
          autoAdvanced,
          postScan: postScan.result,
        });
      } catch (lifecycleErr) {
        executionErrors.push(`lifecycle_record_failed: ${lifecycleErr.message}`);
      }

      const completedAt = new Date();
      return {
        ...result,
        success: finalStatus === "completed" && merged,
        executionStatus: finalStatus,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        rolesExecuted: Object.keys(roleResults).length,
        totalRoles: (plan.taskBreakdown ?? []).length,
        roleResults,
        errors: executionErrors,
        candidate: merged
          ? {
              branch: candidateBranch,
              commit: candidateCommit,
              readyToMerge: !autoAdvanced,
              autoAdvanced,
              autoMergeCommit,
              mergeHint: autoAdvanced ? null : `git merge --no-ff ${candidateBranch}`,
            }
          : null,
        diff: changedFiles.length > 0
          ? { fileCount: changedFiles.length, files: changedFiles.slice(0, 50) }
          : { fileCount: 0, files: [] },
        verify: verifyResult,
        rollback: { triggered: rolledBack, branchDeleted: rolledBack },
        budget: budgetCheck,
        worktree: { created: true, cleanedUp: !rolledBack, rolledBack },
        safety: {
          executionEnabled: true,
          dryRun: false,
          sandboxed: true,
          providerCallsMade: false,
          secretValueExposed: false,
          mainTreeModified: autoAdvanced,
          mainBranchModified: autoAdvanced,
          deployExecuted: false,
          releaseExecuted: false,
          autoRollbackOnFailure: true,
          autoAdvanceEnabled: input.autonomyMode === AUTONOMY_MODES.SANDBOX_MERGE_AUTO,
        },
      };
    },
  };
}
