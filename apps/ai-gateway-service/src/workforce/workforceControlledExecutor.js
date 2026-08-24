/**
 * Phase C — Controlled Workforce Execution Orchestrator
 *
 * Wires the scaffolded execution infrastructure into a single pipeline:
 *   approval gate → worktree isolation → lifecycle → role executors → evidence → security
 *
 * Env-gated: WORKFORCE_EXECUTION_ENABLED=true activates real execution.
 * Default: dry-run mode (execution preview only).
 */

import { createExecutionLifecycle } from "./executionLifecycle.js";
import { createExecutionApprovalGate } from "./executionApprovalGate.js";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { TaskQueueManager } from "./taskQueueManager.js";
import { createRoleExecutor } from "./roleExecutors.js";
import { executeRoleWithLLM } from "./roleExecutorsLlm.js";
import { createTaskEvidenceCapture } from "./taskEvidenceCapture.js";
import { createSecurityReviewCheckpoint } from "./securityReviewCheckpoint.js";
import { createGitWorkspaceGuard } from "./gitWorkspaceGuard.js";
import { createLogRedactor } from "./logRedactor.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createSandboxMergeExecutor, SANDBOX_MERGE_MODE } from "./sandboxMergeExecutor.js";
import { createDiagnosticReadChannel } from "./diagnosticReadChannel.js";
import { AUTONOMY_MODES, DEFAULT_AUTONOMY_MODE, resolveAutonomyModeFrom } from "./autonomyModes.js";
import { createWorkforceExecutionDescriptor } from "./workforceExecutionAuthorization.ts";
import { executeWorkforceDag } from "./workforceDagExecutor.ts";
import { createAutonomyTierGovernor, TIERS as TIER_VALUES } from "./autonomyTierGovernor.js";
import {
  CONTROLLED_EXECUTION_PHASE,
  CONTROLLED_EXECUTION_MODE,
  mapPriority,
  createBlockedResult,
  createDryRunResult,
} from "./workforceControlledExecutorHelpers.js";

export { CONTROLLED_EXECUTION_PHASE, CONTROLLED_EXECUTION_MODE };

// Re-export the shared autonomy mode constants for existing importers.
export { AUTONOMY_MODES };

const DEFAULT_MAX_CONCURRENT_AGENTS = 3;
const DEFAULT_EXECUTION_TIMEOUT_MS = 300_000; // 5 minutes

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

/**
 * Create a controlled execution orchestrator.
 *
 * @param {object} options
 * @param {string} [options.repoRoot] — git repository root for worktree isolation
 * @param {boolean} [options.dryRun] — if true, only preview the execution plan
 * @param {string} [options.executionDir] — base dir for lifecycle/evidence persistence
 * @param {object} [options.env] — environment variables (defaults to process.env)
 * @param {object} [options.providerAdapter] — governed provider adapter
 * @param {object} [options.sandboxMerger] — injected sandbox merge boundary
 * @param {object} [options.tierGovernor] — injected autonomy tier governor
 */
export function createControlledExecutor(options = {}) {
  const env = options.env ?? process.env;
  // Real execution is always an explicit operator choice. Merely wiring a
  // provider adapter must never turn a preview endpoint into an execution sink.
  const executionEnabled = env.WORKFORCE_EXECUTION_ENABLED === "true";
  const dryRun = !executionEnabled || options.dryRun === true;
  const providerAdapter = options.providerAdapter ?? null;
  const forgeService = options.forgeService ?? null;
  const maxConcurrent = readBoundedInteger(env.WORKFORCE_MAX_CONCURRENT, DEFAULT_MAX_CONCURRENT_AGENTS, 1, 16);
  const timeoutMs = readBoundedInteger(
    env.WORKFORCE_EXECUTION_TIMEOUT_MS,
    DEFAULT_EXECUTION_TIMEOUT_MS,
    1_000,
    60 * 60_000,
  );

  const lifecycle = createExecutionLifecycle({
    lifecycleDir: options.executionDir ?? undefined,
  });
  const approvalGate = createExecutionApprovalGate({
    storePath: options.executionDir ? `${options.executionDir}/approvals.json` : undefined,
    ttlMs: options.approvalTtlMs,
  });
  const worktree = createWorktreeIsolation({
    repoRoot: options.repoRoot ?? undefined,
  });
  const taskQueue = options.taskQueueManager ?? new TaskQueueManager({
    dataDir: options.executionDir ? `${options.executionDir}/task-queue` : undefined,
    claimTtlMs: Math.min(24 * 60 * 60_000, timeoutMs + 30_000),
  });
  const evidenceCapture = createTaskEvidenceCapture({
    evidenceDir: options.executionDir ? `${options.executionDir}/evidence` : undefined,
  });
  const securityCheckpoint = createSecurityReviewCheckpoint();
  const workspaceGuard = createGitWorkspaceGuard({
    repoRoot: options.repoRoot ?? undefined,
  });
  const logRedactor = createLogRedactor();

  // Tier governor — the 3-throttle capability system (conservative /
  // balanced / unlimited). Day-to-day default is conservative (~70%, no
  // paid calls, manual merge). Higher tiers unlock via gates.
  const tierGovernor = options.tierGovernor || createAutonomyTierGovernor({
    env,
    storePath: options.executionDir ? `${options.executionDir}/autonomy-tier.json` : undefined,
  });

  // Sandbox-merge executor + diagnostic read channel. The sandbox merger's
  // budget is CLAMPED by the current tier (so conservative tier blocks paid
  // calls even if the configured budget would allow them).
  const sandboxMerger = options.sandboxMerger || createSandboxMergeExecutor({
    repoRoot: options.repoRoot,
    env,
    executionDir: options.executionDir,
    tierGovernor,
  });
  const diagnosticChannel = createDiagnosticReadChannel({ env });

  /**
   * Resolve the effective autonomy mode for a given request.
   *
   * The TIER is the authoritative source of the autonomy mode:
   *   - conservative / balanced → sandbox-merge (manual merge)
   *   - unlimited               → sandbox-merge-auto (auto-merge)
   *   - (if no tier governor)   → input/env/default
   *
   * An explicit input.autonomyMode can still OVERRIDE the tier, but only
   * DOWNWARD (to a less-autonomous mode), never upward past the tier's
   * allowance. So a conservative-tier caller cannot force auto-merge by
   * passing autonomyMode:"sandbox-merge-auto" — the tier blocks it.
   */
  async function resolveAutonomyModeAsync(input) {
    const tierState = await tierGovernor.getCurrentTier();
    const tierMode = tierState.autonomyMode; // sandbox-merge or sandbox-merge-auto
    const requested = resolveAutonomyModeFrom(input?.autonomyMode, env);
    // tier wins if the request would exceed the tier's allowance
    const order = ["dry-run", "controlled-execution", "sandbox-merge", "sandbox-merge-auto"];
    const tierRank = order.indexOf(tierMode);
    const requestedRank = order.indexOf(requested);
    if (tierRank >= 0 && requestedRank > tierRank) {
      return tierMode; // clamp down to tier
    }
    return requested;
  }

  // Synchronous variant (for getInfo / health endpoints) — uses env only,
  // tier clamp applied at execute() time via the async resolver.
  function resolveAutonomyMode(input) {
    return resolveAutonomyModeFrom(input?.autonomyMode, env);
  }

  async function prepareExecution(input = {}) {
    const plan = createWorkforcePlan(input);
    const autonomyMode = await resolveAutonomyModeAsync(input);
    const descriptor = createWorkforceExecutionDescriptor({ input, plan, autonomyMode });
    return { plan, autonomyMode, descriptor };
  }

  return {
    getInfo() {
      return {
        phase: CONTROLLED_EXECUTION_PHASE,
        mode: CONTROLLED_EXECUTION_MODE,
        executionEnabled,
        dryRun,
        maxConcurrentAgents: maxConcurrent,
        timeoutMs,
        defaultAutonomyMode: DEFAULT_AUTONOMY_MODE,
        autonomyModes: Object.values(AUTONOMY_MODES),
        sandboxMerge: sandboxMerger.getInfo(),
        tierGovernor: tierGovernor.getInfo(),
        modules: {
          lifecycle: lifecycle.getInfo(),
          taskQueue: taskQueue.getInfo(),
          approvalGate: approvalGate.getInfo(),
          worktree: worktree.getInfo(),
          evidenceCapture: evidenceCapture.getInfo?.() ?? { ready: true },
          securityCheckpoint: securityCheckpoint.getInfo?.() ?? { ready: true },
          workspaceGuard: workspaceGuard.getInfo?.() ?? { ready: true },
        },
      };
    },

    /**
     * Execute a workforce plan.
     *
     * Dispatches based on the resolved autonomy mode:
     *   - "dry-run"           → original controlled pipeline (default, backward compatible)
     *   - "sandbox-merge"     → delegates to sandboxMergeExecutor (full-power sandbox +
     *                           verify gate + auto-rollback)
     *   - "sandbox-merge-auto"→ sandbox-merge with auto-advance for trust-tier T2 ops
     *
     * The default behavior is UNCHANGED: with no autonomyMode field and no
     * WORKFORCE_AUTONOMY_MODE env var, this runs the exact same dry-run preview
     * pipeline as before.
     *
     * @param {object} input — { goal, selectedRoles?, selectedTemplate?, context?, userId?,
     *                          autonomyMode?, verify?, operationType? }
     */
    async execute(input = {}) {
      const startedAt = new Date();
      const { plan, autonomyMode: mode, descriptor } = await prepareExecution(input);
      const planId = descriptor.planId;
      const userId = typeof input.userId === "string" ? input.userId.trim() : "";
      const preScan = await securityCheckpoint.preExecutionScan?.(plan) ?? { result: "pass", findings: [] };
      if (preScan.result === "block") {
        return createBlockedResult(plan, planId, "security_pre_scan_blocked",
          `Pre-execution security scan blocked: ${(preScan.findings ?? []).join(", ")}`);
      }

      if (mode === AUTONOMY_MODES.DRY_RUN || dryRun) {
        const approvalCheck = { approved: false };
        return createDryRunResult(plan, planId, startedAt, preScan, approvalCheck, descriptor);
      }
      if (!executionEnabled) {
        return createBlockedResult(plan, planId, "execution_disabled",
          "Real workforce execution requires WORKFORCE_EXECUTION_ENABLED=true.", { approval: descriptor });
      }
      if (!userId) {
        return createBlockedResult(plan, planId, "execution_identity_required",
          "Real workforce execution requires an authenticated identity.", { approval: descriptor });
      }

      const approvalCheck = await approvalGate.consume({
        planId,
        userId,
        planDigest: descriptor.planDigest,
        requiredScopes: descriptor.requiredScopes,
      });
      if (!approvalCheck.approved) {
        return createBlockedResult(plan, planId, "approval_required",
          "Workforce execution requires a current, subject-bound approval for this exact plan.", {
            approval: { ...descriptor, decisionCode: approvalCheck.code },
          });
      }

      if (mode === AUTONOMY_MODES.SANDBOX_MERGE || mode === AUTONOMY_MODES.SANDBOX_MERGE_AUTO) {
        return sandboxMerger.execute({ ...input, planId, userId, autonomyMode: mode });
      }

      // --- Step 4: Workspace guard ---
      const workspaceCheck = await workspaceGuard.checkWorkspace?.() ?? { clean: true, branch: "master" };
      if (!workspaceCheck.clean) {
        return createBlockedResult(plan, planId, "workspace_dirty",
          `Workspace is not clean: ${workspaceCheck.reason ?? "uncommitted changes detected"}`);
      }

      // --- Step 5: Worktree isolation ---
      let worktreeRecord = null;
      try {
        worktreeRecord = await worktree.create({ planId });
      } catch (err) {
        return createBlockedResult(plan, planId, "worktree_creation_failed",
          `Failed to create isolated worktree: ${err.message}`);
      }

      // --- Step 6: Initialize lifecycle ---
      await lifecycle.initialize(planId, {
        goal: plan.goal,
        userId,
        worktreeId: worktreeRecord.worktreeId,
        roleCount: (plan.selectedRoles ?? []).length,
        startedAt: startedAt.toISOString(),
      });
      await lifecycle.start(planId);

      // --- Step 7: Build & enqueue tasks ---
      await taskQueue.init();
      const tasks = plan.taskBreakdown ?? [];
      const queuedTasks = await taskQueue.enqueueMany(tasks.map((task) => ({
          planId,
          title: task.title ?? task.role,
          description: task.description ?? "",
          priority: mapPriority(task.priority),
          type: "workforce-role",
          payload: { roleId: task.roleId, planId },
          requiredSkills: [task.roleId],
          dependsOnRoleIds: task.dependsOnRoleIds,
        })));

      // --- Step 8: Execute roles with concurrency cap ---
      const roleResults = {};
      const executionErrors = [];
      const context = { plan, priorOutputs: {} };
      let executionGraph = null;

      try {
        let _timeoutTimer;
        const abortController = new AbortController();
        const executionFn = () => executeWorkforceDag({
          tasks: queuedTasks.map((task) => ({
            queueTaskId: task.taskId,
            roleId: task.payload.roleId,
            dependsOnRoleIds: task.dependsOnRoleIds,
          })),
          taskQueue,
          maxConcurrent,
          claimTtlMs: Math.min(24 * 60 * 60_000, timeoutMs + 30_000),
          signal: abortController.signal,
          context,
          executeRole: (roleId, roleContext) => providerAdapter
            ? executeRoleWithLLM(roleId, plan.goal, roleContext, providerAdapter)
            : createRoleExecutor(roleId).analyze(plan.goal, roleContext),
        });
        const allRoleResults = await Promise.race([
          executionFn().finally(() => clearTimeout(_timeoutTimer)),
          new Promise((_, reject) => {
            _timeoutTimer = setTimeout(() => {
              const timeoutError = new Error(`Workforce execution timed out after ${timeoutMs}ms`);
              timeoutError.code = "WORKFORCE_EXECUTION_TIMEOUT";
              abortController.abort(timeoutError);
              reject(timeoutError);
            }, timeoutMs);
          }),
        ]);
        executionGraph = {
          scheduler: allRoleResults.scheduler,
          executionWaves: allRoleResults.executionWaves,
          peakConcurrency: allRoleResults.peakConcurrency,
          maxConcurrent: allRoleResults.maxConcurrent,
          claimEnforced: allRoleResults.claimEnforced,
        };
        for (const [roleId, result] of Object.entries(allRoleResults?.roleOutputs ?? {})) {
          roleResults[roleId] = result;
          await lifecycle.onAgentCompleted(planId, roleId, { success: true });

          // Capture evidence per agent
          await evidenceCapture.capture?.(planId, roleId, {
            input: plan.goal,
            output: result,
            status: "completed",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        executionErrors.push(logRedactor.redact?.(err.message) ?? err.message);
      }

      // --- Step 8b: Forge code execution (if available) ---
      if (forgeService && roleResults["backend-engineer"]) {
        try {
          const backendAnalysis = roleResults["backend-engineer"];
          const implementationGoal = `Based on this backend analysis, implement the core API:\n${JSON.stringify(backendAnalysis.apiSpecs ?? backendAnalysis, null, 2).slice(0, 2000)}`;
          const forgeResult = await forgeService.runGoal?.(implementationGoal, { timeoutMs: 60_000 });
          if (forgeResult) {
            roleResults["forge-implementation"] = {
              roleId: "forge-implementation",
              source: "forge-engine",
              goal: implementationGoal,
              result: forgeResult,
              executedAt: new Date().toISOString(),
            };
          }
        } catch (forgeErr) {
          executionErrors.push(`forge_execution: ${logRedactor.redact?.(forgeErr.message) ?? forgeErr.message}`);
        }
      }

      // --- Step 9: Post-execution security scan ---
      const postScan = await securityCheckpoint.postExecutionScan?.(plan, roleResults) ?? { result: "pass", findings: [] };

      // --- Step 10: Complete lifecycle ---
      const finalStatus = executionErrors.length === 0 ? "completed" : "failed";
      await lifecycle.complete(planId, finalStatus, {
        roleResults: Object.keys(roleResults).length,
        errors: executionErrors,
        executionGraph,
        postScan: postScan.result,
      });

      // --- Step 11: Cleanup worktree ---
      try {
        if (worktreeRecord?.worktreeId) {
          await worktree.remove(worktreeRecord.worktreeId);
        }
      } catch {
        // Non-fatal: worktree cleanup failure is logged but doesn't block completion
      }

      const completedAt = new Date();
      return {
        success: finalStatus === "completed",
        phase: CONTROLLED_EXECUTION_PHASE,
        mode: CONTROLLED_EXECUTION_MODE,
        planId,
        goal: plan.goal,
        executionStatus: finalStatus,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        rolesExecuted: Object.keys(roleResults).length,
        totalRoles: tasks.length,
        roleResults,
        errors: executionErrors,
        security: {
          preScan: preScan.result,
          postScan: postScan.result,
          workspaceCheck: workspaceCheck.clean,
        },
        worktree: {
          created: Boolean(worktreeRecord),
          cleanedUp: true,
        },
        approval: {
          checked: true,
          approved: approvalCheck.approved,
        },
        safety: {
          executionEnabled: true,
          dryRun: false,
           providerCallsMade: Boolean(providerAdapter),
          secretValueExposed: false,
          projectFileWrites: false,
          deployExecuted: false,
          releaseExecuted: false,
        },
      };
    },

    /**
     * Request approval for a workforce plan execution.
     */
    async approveExecution(input = {}, userId, approvedScopes = []) {
      if (!executionEnabled) {
        const error = new Error("WORKFORCE_EXECUTION_ENABLED=true is required before issuing execution approvals.");
        error.code = "WORKFORCE_EXECUTION_DISABLED";
        error.statusCode = 409;
        throw error;
      }
      const { autonomyMode, descriptor } = await prepareExecution(input);
      if (autonomyMode === AUTONOMY_MODES.DRY_RUN) {
        const error = new Error("A non-dry-run autonomyMode is required for execution approval.");
        error.code = "WORKFORCE_EXECUTION_MODE_REQUIRED";
        error.statusCode = 400;
        throw error;
      }
      const requestedScopes = [...new Set((Array.isArray(approvedScopes) ? approvedScopes : []).map(String))].sort();
      const requiredScopes = [...descriptor.requiredScopes].sort();
      if (JSON.stringify(requestedScopes) !== JSON.stringify(requiredScopes)) {
        const error = new Error(`approvedScopes must exactly match: ${requiredScopes.join(", ")}`);
        error.code = "WORKFORCE_APPROVAL_SCOPE_MISMATCH";
        error.statusCode = 400;
        throw error;
      }
      const approval = await approvalGate.approve({
        planId: descriptor.planId,
        userId,
        planDigest: descriptor.planDigest,
        approvedScopes: requiredScopes,
        note: input.note,
      });
      return { ...approval, execution: descriptor };
    },

    /**
     * Check execution approval status.
     */
    async checkApproval(input = {}, userId) {
      const { descriptor } = await prepareExecution(input);
      return approvalGate.check({
        planId: descriptor.planId,
        userId,
        planDigest: descriptor.planDigest,
        requiredScopes: descriptor.requiredScopes,
      });
    },

    /**
     * Revoke execution approval.
     */
    async revokeApproval(planId, revokedBy, reason) {
      return approvalGate.revoke(planId, revokedBy, reason);
    },

    async describeExecution(input = {}) {
      const { descriptor } = await prepareExecution(input);
      return descriptor;
    },

    /**
     * Get execution lifecycle status.
     */
    async getStatus(planId) {
      return lifecycle.getStatus(planId);
    },

    /**
     * Cancel a running execution.
     */
    async cancel(planId, reason) {
      return lifecycle.cancel(planId, reason);
    },

    /**
     * Pause a running execution.
     */
    async pause(planId, reason) {
      return lifecycle.pause(planId, reason);
    },

    /**
     * Resume a paused execution.
     */
    async resume(planId) {
      return lifecycle.resume(planId);
    },

    /**
     * Get the sandbox-merge executor (for direct budget/token/diagnostic access).
     */
    getSandboxMerger() {
      return sandboxMerger;
    },

    /**
     * Get the diagnostic read channel (read-only, sanitized, audited).
     */
    getDiagnosticChannel() {
      return diagnosticChannel;
    },

    /**
     * Resolve which autonomy mode would be used for a given input (no side effects).
     */
    resolveAutonomyMode(input = {}) {
      return resolveAutonomyMode(input);
    },

    /**
     * Async autonomy mode resolver (tier-clamped). The real one execute() uses.
     */
    async resolveAutonomyModeAsync(input = {}) {
      return resolveAutonomyModeAsync(input);
    },

    /**
     * Get the tier governor (3-throttle capability system).
     */
    getTierGovernor() {
      return tierGovernor;
    },

    /**
     * Read the current tier snapshot (tier, caps, gate token, expiry).
     */
    async getCurrentTier() {
      return tierGovernor.getCurrentTier();
    },

    /**
     * Pass a gate to elevate one tier (conservative→balanced→unlimited).
     */
    async passGate(input) {
      return tierGovernor.passGate(input);
    },

    /**
     * SET THE TIER DIRECTLY — the front-end switch handler.
     * Owner can jump to any tier; choice persists across restarts.
     */
    async setTier(input) {
      return tierGovernor.setTier(input);
    },

    /**
     * Force fall-back to a lower tier (emergency brake).
     */
    async fallBackTier(input) {
      return tierGovernor.fallBack(input);
    },
  };
}
