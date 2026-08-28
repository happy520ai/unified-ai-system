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

import { createHash } from "node:crypto";
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
 * @param {object} [options.worktreeIsolation]
 * @param {object} [options.securityCheckpoint]
 * @param {object} [options.executionLifecycle]
 * @param {object} [options.evidenceCapture]
 */
export function createSandboxMergeExecutor(options = {}) {
  const env = options.env ?? process.env;
  const repoRoot = resolve(options.repoRoot || env.WORKFORCE_REPO_ROOT || process.cwd());
  const executionDir = options.executionDir || resolve(repoRoot, ".data", "workforce", "sandbox-merge");
  const timeoutMs = Number(env.WORKFORCE_SANDBOX_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const worktree = options.worktreeIsolation ?? createWorktreeIsolation({ repoRoot });
  const securityCheckpoint = options.securityCheckpoint ?? createSecurityReviewCheckpoint({
    auditLogDir: join(executionDir, "security-audit"),
  });
  const lifecycle = options.executionLifecycle ?? createExecutionLifecycle({ lifecycleDir: executionDir });
  const evidenceCapture = options.evidenceCapture ?? createTaskEvidenceCapture({ evidenceDir: join(executionDir, "evidence") });
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
     * @param {object} input
     * @param {string} [input.planId]
     * @param {string} [input.executionScopeId]
     * @param {string} [input.goal]
     * @param {string} [input.userId]
     * @param {string} [input.tenantId]
     * @param {string} [input.autonomyMode]
     * @param {Function} [input.verify] — optional async verifier(worktreeCtx) => {pass, checks}
     */
    async execute(input = {}) {
      const startedAt = new Date();
      const plan = createWorkforcePlan(input);
      const planId = input.planId ?? plan.workforceId ?? `wf_${Date.now()}`;
      const userId = input.userId ?? "system";
      const tenantId = input.tenantId ?? "default";
      const executionScopeId = input.executionScopeId
        ?? createSandboxExecutionId(tenantId, userId, planId);
      const userVerify = typeof input.verify === "function" ? input.verify : null;
      const operationType = input.operationType || "workforce-sandbox-merge";

      const result = {
        phase: SANDBOX_MERGE_PHASE,
        mode: SANDBOX_MERGE_MODE,
        planId,
        executionId: executionScopeId,
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
      let preScan;
      try {
        preScan = await runSandboxPreSecurityCheck(securityCheckpoint, plan, executionScopeId);
      } catch {
        await budget.recordTrustEvent(operationType, "red");
        return {
          ...result,
          success: false,
          executionStatus: "blocked",
          code: "security_pre_scan_unavailable",
          message: "The required sandbox security checkpoint could not be committed.",
          safety: safeSafety(),
        };
      }
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
        const created = await worktree.create({ planId: executionScopeId });
        if (!created?.success || !created?.worktree) {
          await budget.recordTrustEvent(operationType, "red");
          return {
            ...result,
            success: false,
            executionStatus: "blocked",
            code: "worktree_creation_failed",
            message: "Failed to create the required isolated worktree.",
            safety: safeSafety(),
          };
        }
        worktreeRecord = created.worktree;
        candidateBranch = worktreeRecord.branch;
      } catch {
        await budget.recordTrustEvent(operationType, "red");
        return {
          ...result,
          success: false,
          executionStatus: "blocked",
          code: "worktree_creation_failed",
          message: "Failed to create the required isolated worktree.",
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
        const rollback = await rollbackWorktree(worktree, worktreeId);
        await budget.recordTrustEvent(operationType, "red");
        return {
          ...result,
          success: false,
          executionStatus: rollback.rolledBack ? "rolled_back" : "rollback_failed",
          code: rollback.rolledBack ? "snapshot_failed" : "worktree_rollback_failed",
          message: "The isolated worktree snapshot failed.",
          worktree: { created: true, rolledBack: rollback.rolledBack },
          safety: safeSafety(),
        };
      }

      // --- Step 4: Initialize lifecycle + start ---
      await lifecycle.initialize(executionScopeId, {
        publicPlanId: planId,
        tenantFingerprint: identityFingerprint(tenantId),
        subjectFingerprint: identityFingerprint(userId),
        goal: plan.goal,
        userId,
        worktreeId,
        candidateBranch,
        roleCount: (plan.selectedRoles ?? []).length,
        startedAt: startedAt.toISOString(),
        mode: "sandbox-merge",
      });
      await lifecycle.start(executionScopeId);

      // --- Step 5: Run role executors INSIDE the sandbox context (full power) ---
      const roleResults = {};
      const executionErrors = [];
      let requestedFinalStatus = null;
      const context = { plan, priorOutputs: {}, sandbox: { worktreePath, candidateBranch, repoRoot } };

      try {
        const allRoleResults = await executeAllRoles(plan.goal, context);
        for (const [roleId, roleResult] of Object.entries(allRoleResults?.roleOutputs ?? {})) {
          roleResults[roleId] = roleResult;
          const lifecycleDecision = await lifecycle.onAgentCompleted(
            executionScopeId,
            roleId,
            { success: true },
          );
          assertSandboxLifecycleAllowsContinuation(lifecycleDecision);
          const capture = evidenceCapture.startCapture?.({
            planId: executionScopeId,
            agentId: roleId,
            role: roleId,
            goal: plan.goal,
            context: { publicPlanId: planId, sandbox: worktreeId },
          });
          if (capture) {
            capture.setOutput({ summary: summarizeSandboxOutput(roleResult, logRedactor) });
            await capture.finish();
          }
        }
      } catch (err) {
        executionErrors.push(logRedactor.redactString?.(err.message) ?? err.message);
      }

      // --- Step 6: Compute worktree diff vs HEAD ---
      let diff = null;
      try {
        diff = await computeWorktreeDiff(worktreePath);
      } catch (err) {
        executionErrors.push(`diff_failed: ${logRedactor.redactString?.(err.message) ?? "diff failed"}`);
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
          verifyResult = { pass: false, checks: [{
            name: "external_verifier",
            pass: false,
            error: logRedactor.redactString?.(err.message) ?? "external verifier failed",
          }] };
        }
        // Re-compute diff now that the hook may have added files
        try {
          diff = await computeWorktreeDiff(worktreePath);
          changedFiles = diff?.files ?? [];
        } catch (err) {
          executionErrors.push(`rediff_failed: ${logRedactor.redactString?.(err.message) ?? "diff failed"}`);
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

      let postScan;
      try {
        postScan = await runSandboxPostSecurityCheck(
          securityCheckpoint,
          plan,
          executionScopeId,
          roleResults,
          changedFiles,
        );
      } catch {
        postScan = { result: "block", findings: ["security_checkpoint_unavailable"] };
        executionErrors.push("security_post_scan_unavailable");
      }
      if (postScan.result === "block" && verifyResult.pass) {
        verifyResult.pass = false;
        verifyResult.checks.push({ name: "post_security_scan", pass: false, reason: postScan.findings?.join(", ") });
      }

      try {
        const lifecycleSnapshot = await lifecycle.getStatus(executionScopeId);
        if (lifecycleSnapshot?.cancelRequested || lifecycleSnapshot?.status === "cancelled") {
          requestedFinalStatus = "cancelled";
          executionErrors.push("execution_cancelled");
          verifyResult.pass = false;
          verifyResult.checks.push({ name: "lifecycle_cancel", pass: false });
        }
      } catch {
        executionErrors.push("lifecycle_monitor_failed");
        verifyResult.pass = false;
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
          executionErrors.push(`commit_failed: ${logRedactor.redactString?.(err.message) ?? "commit failed"}`);
          finalStatus = "failed";
          const rollback = await rollbackWorktree(worktree, worktreeId);
          await budget.recordTrustEvent(operationType, "rollback");
          rolledBack = rollback.rolledBack;
          if (!rolledBack) executionErrors.push("worktree_rollback_failed");
        }
      } else {
        finalStatus = requestedFinalStatus
          ?? (executionErrors.length > 0 ? "failed" : "verify_failed");
        const rollback = await rollbackWorktree(worktree, worktreeId);
        await budget.recordTrustEvent(operationType, executionErrors.length > 0 ? "red" : "rollback");
        rolledBack = rollback.rolledBack;
        if (!rolledBack) executionErrors.push("worktree_rollback_failed");
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
          executionErrors.push(`auto_advance_failed: ${logRedactor.redactString?.(err.message) ?? "auto advance failed"}`);
        }
      }

      // --- Step 9: Cleanup worktree directory ---
      let cleanupSucceeded = rolledBack;
      if (!rolledBack) {
        try {
          const cleanup = await worktree.remove(worktreeId, {
            preserveBranch: merged && !autoAdvanced,
          });
          cleanupSucceeded = cleanup?.success === true;
        } catch {
          cleanupSucceeded = false;
        }
        if (!cleanupSucceeded) {
          executionErrors.push("worktree_cleanup_failed");
          finalStatus = "failed";
        }
      }

      // --- Step 10: Complete lifecycle ---
      const lifecycleStatus = (finalStatus === "verify_failed") ? "failed" : finalStatus;
      try {
        const lifecycleSnapshot = await lifecycle.getStatus(executionScopeId);
        if (lifecycleSnapshot?.status !== "cancelled" && lifecycleSnapshot?.status !== "force_stopped") {
          await lifecycle.complete(executionScopeId, lifecycleStatus, {
            roleResults: Object.keys(roleResults).length,
            errors: executionErrors,
            verifyPass: verifyResult.pass,
            candidateBranch: merged ? candidateBranch : null,
            candidateCommit,
            rolledBack,
            autoAdvanced,
            postScan: postScan.result,
          });
        }
      } catch (lifecycleErr) {
        executionErrors.push(`lifecycle_record_failed: ${logRedactor.redactString?.(lifecycleErr.message) ?? "lifecycle write failed"}`);
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
        worktree: { created: true, cleanedUp: cleanupSucceeded, rolledBack },
        safety: {
          executionEnabled: true,
          dryRun: false,
          sandboxed: true,
          providerCallsMade: false,
          secretValueExposed: postScan.result === "pass" ? false : null,
          secretScanPassed: postScan.result === "pass",
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

function createSandboxExecutionId(tenantId, userId, planId) {
  const digest = createHash("sha256")
    .update(`${tenantId}\u0000${userId}\u0000${planId}\u0000sandbox`, "utf8")
    .digest("hex");
  return `wf-scope-${digest}`;
}

function identityFingerprint(value) {
  return `idfp_${createHash("sha256").update(String(value), "utf8").digest("hex").slice(0, 16)}`;
}

function summarizeSandboxOutput(value, logRedactor) {
  let serialized;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    serialized = "[unserializable role output]";
  }
  return String(logRedactor.redactString?.(serialized) ?? serialized).slice(0, 5_000);
}

async function runSandboxPreSecurityCheck(checkpoint, plan, executionId) {
  if (typeof checkpoint?.preExecutionCheck === "function") {
    return checkpoint.preExecutionCheck({
      planId: executionId,
      agentId: "workforce-sandbox-orchestrator",
      goal: plan.goal,
      context: {
        selectedRoles: plan.selectedRoles ?? [],
        selectedTemplate: plan.selectedTemplate ?? null,
      },
    });
  }
  if (typeof checkpoint?.preExecutionScan === "function") return checkpoint.preExecutionScan(plan);
  throw new Error("A sandbox pre-execution security checkpoint is required.");
}

async function runSandboxPostSecurityCheck(checkpoint, plan, executionId, roleResults, changedFiles) {
  if (typeof checkpoint?.postExecutionCheck === "function") {
    return checkpoint.postExecutionCheck({
      planId: executionId,
      agentId: "workforce-sandbox-orchestrator",
      output: roleResults,
      outputText: "",
      commandsRun: [],
      filesChanged: changedFiles,
    });
  }
  if (typeof checkpoint?.postExecutionScan === "function") {
    return checkpoint.postExecutionScan(plan, roleResults);
  }
  throw new Error("A sandbox post-execution security checkpoint is required.");
}

function assertSandboxLifecycleAllowsContinuation(decision) {
  if (decision?.action === "cancelled" || decision?.status === "cancelled") {
    const error = new Error("Sandbox execution was cancelled.");
    error.code = "WORKFORCE_EXECUTION_CANCELLED";
    throw error;
  }
  if (decision?.action === "paused" || decision?.status === "paused") {
    const error = new Error("Sandbox pause requires a durable resumable runner.");
    error.code = "WORKFORCE_EXECUTION_PAUSE_UNSUPPORTED";
    throw error;
  }
}
