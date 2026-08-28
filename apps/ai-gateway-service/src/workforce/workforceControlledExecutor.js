/**
 * Phase C — Controlled Workforce Execution Orchestrator
 *
 * Wires the scaffolded execution infrastructure into a single pipeline:
 *   approval gate → worktree isolation → lifecycle → role executors → evidence → security
 *
 * Env-gated: WORKFORCE_EXECUTION_ENABLED=true activates real execution.
 * Default: dry-run mode (execution preview only).
 */

import { createHash } from "node:crypto";

import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createWorkforceTaskQueueManager } from "./workforceTaskQueueFactory.ts";
import { createWorkforceExecutionControl } from "./workforceExecutionControlFactory.ts";
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
 * @param {object} [options.forgeService] — optional isolated-root-aware Forge adapter
 * @param {object} [options.sandboxMerger] — injected sandbox merge boundary
 * @param {object} [options.tierGovernor] — injected autonomy tier governor
 * @param {object} [options.workspaceGuard] — injected workspace safety boundary
 * @param {object} [options.securityCheckpoint] — injected execution security checkpoint
 * @param {object} [options.worktreeIsolation] — injected worktree isolation adapter
 * @param {object} [options.executionLifecycle] — injected lifecycle backend
 * @param {object} [options.approvalGate] — injected approval backend
 * @param {object} [options.executionControl] — injected shared approval/lifecycle backend
 * @param {object} [options.evidenceCapture] — injected evidence backend
 */
export function createControlledExecutor(options = {}) {
  const env = options.env ?? process.env;
  // Real execution is always an explicit operator choice. Merely wiring a
  // provider adapter must never turn a preview endpoint into an execution sink.
  const executionEnabled = env.WORKFORCE_EXECUTION_ENABLED === "true";
  const dryRun = !executionEnabled || options.dryRun === true;
  const providerAdapter = options.providerAdapter ?? null;
  if (executionEnabled && providerAdapter && providerAdapter.governedProviderOperation !== true) {
    throw Object.assign(
      new Error("Workforce provider execution must re-enter the governed GatewayService provider-operation lane."),
      { code: "WORKFORCE_PROVIDER_GOVERNANCE_REQUIRED", category: "configuration" },
    );
  }
  const forgeService = options.forgeService ?? null;
  const maxConcurrent = readBoundedInteger(env.WORKFORCE_MAX_CONCURRENT, DEFAULT_MAX_CONCURRENT_AGENTS, 1, 16);
  const timeoutMs = readBoundedInteger(
    env.WORKFORCE_EXECUTION_TIMEOUT_MS,
    DEFAULT_EXECUTION_TIMEOUT_MS,
    1_000,
    60 * 60_000,
  );
  const lifecyclePollMs = readBoundedInteger(
    env.AI_GATEWAY_WORKFORCE_CONTROL_POLL_MS,
    500,
    100,
    5_000,
  );
  const abortDrainTimeoutMs = readBoundedInteger(
    env.WORKFORCE_ABORT_DRAIN_TIMEOUT_MS,
    30_000,
    100,
    5 * 60_000,
  );

  const ownsExecutionControl = !options.executionControl
    && (!options.executionLifecycle || !options.approvalGate);
  const executionControl = options.executionControl ?? (ownsExecutionControl
    ? createWorkforceExecutionControl({
        env,
        executionDir: options.executionDir,
        approvalTtlMs: options.approvalTtlMs,
      })
    : null);
  const lifecycle = options.executionLifecycle ?? executionControl?.lifecycle;
  const approvalGate = options.approvalGate ?? executionControl?.approvalGate;
  if (!lifecycle || !approvalGate) {
    throw new Error("A complete Workforce execution control backend is required.");
  }
  const worktree = options.worktreeIsolation ?? createWorktreeIsolation({
    repoRoot: options.repoRoot ?? undefined,
  });
  const taskQueue = options.taskQueueManager ?? createWorkforceTaskQueueManager({
    env,
    dataDir: options.executionDir ? `${options.executionDir}/task-queue` : undefined,
    claimTtlMs: Math.min(24 * 60 * 60_000, timeoutMs + 30_000),
  });
  const evidenceCapture = options.evidenceCapture ?? createTaskEvidenceCapture({
    evidenceDir: options.executionDir ? `${options.executionDir}/evidence` : undefined,
  });
  const securityCheckpoint = options.securityCheckpoint ?? createSecurityReviewCheckpoint({
    auditLogDir: options.executionDir ? `${options.executionDir}/security-audit` : undefined,
  });
  const workspaceGuard = options.workspaceGuard ?? createGitWorkspaceGuard({
    cwd: options.repoRoot ?? undefined,
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
    executionLifecycle: lifecycle,
    securityCheckpoint,
    evidenceCapture,
    worktreeIsolation: worktree,
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
          executionControl: executionControl?.getHealth?.() ?? {
            mode: "injected",
            distributed: lifecycle.getInfo?.().distributed === true,
          },
          worktree: worktree.getInfo(),
          evidenceCapture: evidenceCapture.getInfo?.() ?? { ready: true },
          securityCheckpoint: securityCheckpoint.getInfo?.() ?? { ready: true },
          workspaceGuard: workspaceGuard.getInfo?.() ?? { ready: true },
        },
      };
    },

    async getTaskClaimHealth() {
      return taskQueue.getClaimHealth();
    },

    async getTaskQueueHealth() {
      return typeof taskQueue.checkQueueHealth === "function"
        ? taskQueue.checkQueueHealth()
        : (taskQueue.getQueueHealth?.() ?? {
            mode: "atomic-json-local",
            durable: true,
            distributed: false,
            available: true,
          });
    },

    async getExecutionControlHealth() {
      if (executionControl?.checkHealth) return executionControl.checkHealth();
      return {
        mode: "injected",
        durable: true,
        distributed: lifecycle.getInfo?.().distributed === true,
        available: true,
      };
    },

    async close() {
      await taskQueue.close();
      if (ownsExecutionControl) await executionControl?.close?.();
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
      const tenantId = typeof input.tenantId === "string" && input.tenantId.trim()
        ? input.tenantId.trim()
        : "default";
      let executionScopeId = createScopedExecutionId(tenantId, userId || "anonymous", planId, "request");
      let preScan;
      try {
        preScan = await runPreExecutionSecurityCheck(securityCheckpoint, {
          plan,
          planId: executionScopeId,
        });
      } catch {
        return createBlockedResult(plan, planId, "security_pre_scan_unavailable",
          "The required pre-execution security checkpoint could not be committed.");
      }
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
        tenantId,
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
      executionScopeId = createScopedExecutionId(
        tenantId,
        userId,
        planId,
        approvalCheck.approval?.approvalId ?? "approved",
      );

      if (mode === AUTONOMY_MODES.SANDBOX_MERGE || mode === AUTONOMY_MODES.SANDBOX_MERGE_AUTO) {
        return sandboxMerger.execute({
          ...input,
          planId,
          userId,
          tenantId,
          executionScopeId,
          autonomyMode: mode,
        });
      }

      // --- Step 4: Workspace guard ---
      const workspaceCheck = await runWorkspaceCheck(workspaceGuard);
      if (!workspaceCheck.clean) {
        return createBlockedResult(plan, planId, "workspace_dirty",
          `Workspace is not clean: ${workspaceCheck.reason ?? "uncommitted changes detected"}`);
      }

      // --- Step 5: Worktree isolation ---
      let worktreeRecord = null;
      let cleanupAttempted = false;
      let worktreeCleanedUp = false;
      let worktreeCleanupAllowed = true;
      try {
        const creation = await worktree.create({ planId: executionScopeId });
        if (!creation?.success || !creation?.worktree?.worktreeId) {
          return createBlockedResult(plan, planId, "worktree_creation_failed",
            "Failed to create the required isolated worktree.");
        }
        worktreeRecord = creation.worktree;
      } catch {
        return createBlockedResult(plan, planId, "worktree_creation_failed",
          "Failed to create the required isolated worktree.");
      }

      try {
      // --- Step 6: Initialize lifecycle ---
      await lifecycle.initialize(executionScopeId, {
        publicPlanId: planId,
        tenantFingerprint: identityFingerprint(tenantId),
        goal: plan.goal,
        subjectFingerprint: identityFingerprint(userId),
        worktreeId: worktreeRecord.worktreeId,
        roleCount: (plan.selectedRoles ?? []).length,
        startedAt: startedAt.toISOString(),
      });
      await lifecycle.start(executionScopeId);

      // --- Step 7: Build & enqueue tasks ---
      await taskQueue.init();
      const tasks = plan.taskBreakdown ?? [];
      const queuedTasks = await taskQueue.enqueueMany(tasks.map((task) => ({
          planId,
          claimPlanId: executionScopeId,
          tenantId,
          ownerId: userId,
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
      let forgeExecuted = false;
      let requestedFinalStatus = null;

      try {
        let _timeoutTimer;
        const abortController = new AbortController();
        const lifecycleMonitor = startLifecycleMonitor({
          lifecycle,
          executionId: executionScopeId,
          abortController,
          pollMs: lifecyclePollMs,
        });
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
          abortDrainTimeoutMs,
          context,
          executeRole: async (roleId, roleContext) => {
            const capture = evidenceCapture.startCapture?.({
              planId: executionScopeId,
              agentId: roleId,
              role: roleId,
              goal: plan.goal,
              context: {
                publicPlanId: planId,
                dependencies: Object.keys(roleContext?.priorOutputs ?? {}).sort(),
              },
            });
            try {
              const result = providerAdapter
                ? await executeRoleWithLLM(roleId, plan.goal, roleContext, providerAdapter)
                : await createRoleExecutor(roleId).analyze(plan.goal, roleContext);
              if (capture) {
                capture.setOutput({ summary: summarizeEvidenceOutput(result, logRedactor) });
                await capture.finish();
              }
              const lifecycleDecision = await lifecycle.onAgentCompleted(
                executionScopeId,
                roleId,
                { success: true },
              );
              assertLifecycleDecisionAllowsContinuation(lifecycleDecision);
              return result;
            } catch (error) {
              if (capture) {
                try {
                  capture.setOutput({ summary: `failed: ${logRedactor.redactString?.(error?.message) ?? "role execution failed"}` });
                  await capture.finish();
                } catch {
                  // Preserve the original execution or evidence failure.
                }
              }
              throw error;
            }
          },
        });
        let executionPromise;
        let allRoleResults;
        let raceError;
        let settlementError;
        try {
          executionPromise = executionFn();
          try {
            allRoleResults = await Promise.race([
              executionPromise,
              new Promise((_, reject) => {
                _timeoutTimer = setTimeout(() => {
                  const timeoutError = new Error(`Workforce execution timed out after ${timeoutMs}ms`);
                  timeoutError.code = "WORKFORCE_EXECUTION_TIMEOUT";
                  abortController.abort(timeoutError);
                  reject(timeoutError);
                }, timeoutMs);
              }),
            ]);
          } catch (error) {
            raceError = error;
          }
        } finally {
          clearTimeout(_timeoutTimer);
          lifecycleMonitor.stop();
          if (executionPromise) {
            try {
              await executionPromise;
            } catch (error) {
              settlementError = error;
            }
          }
        }
        if (settlementError?.details?.quiescenceUncertain === true) throw settlementError;
        if (raceError) throw raceError;
        executionGraph = {
          scheduler: allRoleResults.scheduler,
          executionWaves: allRoleResults.executionWaves,
          peakConcurrency: allRoleResults.peakConcurrency,
          maxConcurrent: allRoleResults.maxConcurrent,
          claimEnforced: allRoleResults.claimEnforced,
        };
        for (const [roleId, result] of Object.entries(allRoleResults?.roleOutputs ?? {})) {
          roleResults[roleId] = result;
        }
      } catch (err) {
        if (err?.code === "WORKFORCE_EXECUTION_CANCELLED") requestedFinalStatus = "cancelled";
        if (err?.details?.quiescenceUncertain === true) {
          worktreeCleanupAllowed = false;
          executionErrors.push("execution_quiescence_unconfirmed");
        }
        executionErrors.push(logRedactor.redactString?.(err.message) ?? err.message);
      }

      // --- Step 8b: Forge code execution (if available) ---
      if (!requestedFinalStatus && forgeService && roleResults["backend-engineer"]) {
        try {
          const forgeCapabilities = forgeService.getCapabilities?.() ?? {};
          if (forgeService.supportsIsolatedProjectRoot !== true
            && forgeCapabilities.isolatedProjectRoot !== true) {
            const isolationError = new Error("The Forge adapter does not attest isolated project-root support.");
            isolationError.code = "WORKFORCE_FORGE_ISOLATION_REQUIRED";
            throw isolationError;
          }
          const backendAnalysis = roleResults["backend-engineer"];
          const implementationGoal = `Based on this backend analysis, implement the core API:\n${JSON.stringify(backendAnalysis.apiSpecs ?? backendAnalysis, null, 2).slice(0, 2000)}`;
          forgeExecuted = true;
          const forgeResult = await forgeService.runGoal?.(implementationGoal, {
            timeoutMs: 60_000,
            projectRoot: worktreeRecord.path,
            worktreeId: worktreeRecord.worktreeId,
          });
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
          executionErrors.push(`forge_execution: ${logRedactor.redactString?.(forgeErr.message) ?? forgeErr.message}`);
        }
      }

      // --- Step 9: Post-execution security scan ---
      let postScan;
      try {
        postScan = await runPostExecutionSecurityCheck(securityCheckpoint, {
          plan,
          planId: executionScopeId,
          roleResults,
        });
      } catch {
        postScan = { result: "block", findings: ["security_checkpoint_unavailable"] };
        executionErrors.push("security_post_scan_unavailable");
      }
      if (postScan.result === "block" && !executionErrors.includes("security_post_scan_unavailable")) {
        executionErrors.push("security_post_scan_blocked");
      }

      // --- Step 10: Cleanup worktree before committing the lifecycle terminal state ---
      cleanupAttempted = true;
      if (!worktreeCleanupAllowed) {
        executionErrors.push("worktree_cleanup_skipped: execution quiescence was not confirmed");
      } else {
        try {
          const cleanup = await worktree.remove(worktreeRecord.worktreeId);
          worktreeCleanedUp = cleanup?.success === true;
          if (!worktreeCleanedUp) {
            executionErrors.push(`worktree_cleanup: ${logRedactor.redactString?.(cleanup?.reason) ?? "cleanup failed"}`);
          }
        } catch (cleanupError) {
          executionErrors.push(`worktree_cleanup: ${logRedactor.redactString?.(cleanupError?.message) ?? "cleanup failed"}`);
        }
      }

      // --- Step 11: Complete lifecycle ---
      let finalStatus = requestedFinalStatus
        ?? (executionErrors.length === 0 ? "completed" : "failed");
      const lifecycleSnapshot = await lifecycle.getStatus(executionScopeId);
      if (lifecycleSnapshot?.status === "cancelled" || lifecycleSnapshot?.status === "force_stopped") {
        finalStatus = lifecycleSnapshot.status;
      } else {
        if (lifecycleSnapshot?.cancelRequested) finalStatus = "cancelled";
        await lifecycle.complete(executionScopeId, finalStatus, {
          roleResults: Object.keys(roleResults).length,
          errors: executionErrors,
          executionGraph,
          postScan: postScan.result,
        });
      }

      const completedAt = new Date();
      return {
        success: finalStatus === "completed",
        phase: CONTROLLED_EXECUTION_PHASE,
        mode: CONTROLLED_EXECUTION_MODE,
        planId,
        executionId: executionScopeId,
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
          created: true,
          cleanedUp: worktreeCleanedUp,
        },
        approval: {
          checked: true,
          approved: approvalCheck.approved,
        },
        safety: {
          executionEnabled: true,
          dryRun: false,
          providerCallsMade: Boolean(providerAdapter),
          secretValueExposed: postScan.result === "pass" ? false : null,
          secretScanPassed: postScan.result === "pass",
          projectFileWrites: forgeExecuted,
          projectWritesIsolated: forgeExecuted ? true : null,
          deployExecuted: false,
          releaseExecuted: false,
        },
      };
      } finally {
        if (worktreeRecord?.worktreeId && !cleanupAttempted && worktreeCleanupAllowed) {
          cleanupAttempted = true;
          try {
            const cleanup = await worktree.remove(worktreeRecord.worktreeId);
            worktreeCleanedUp = cleanup?.success === true;
          } catch {
            worktreeCleanedUp = false;
          }
        }
      }
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
        tenantId: typeof input.tenantId === "string" && input.tenantId.trim()
          ? input.tenantId.trim()
          : "default",
        userId,
        planDigest: descriptor.planDigest,
        approvedScopes: requiredScopes,
        note: input.note,
      });
      const tenantId = typeof input.tenantId === "string" && input.tenantId.trim()
        ? input.tenantId.trim()
        : "default";
      const executionId = createScopedExecutionId(
        tenantId,
        userId,
        descriptor.planId,
        approval.approval?.approvalId ?? "approved",
      );
      return { ...approval, execution: { ...descriptor, executionId } };
    },

    /**
     * Check execution approval status.
     */
    async checkApproval(input = {}, userId) {
      const { descriptor } = await prepareExecution(input);
      return approvalGate.check({
        planId: descriptor.planId,
        tenantId: typeof input.tenantId === "string" && input.tenantId.trim()
          ? input.tenantId.trim()
          : "default",
        userId,
        planDigest: descriptor.planDigest,
        requiredScopes: descriptor.requiredScopes,
      });
    },

    /**
     * Revoke execution approval.
     */
    async revokeApproval(planId, revokedBy, reason, tenantId = "default") {
      return approvalGate.revoke(planId, revokedBy, reason, tenantId);
    },

    async describeExecution(input = {}) {
      const { descriptor } = await prepareExecution(input);
      return descriptor;
    },

    /**
     * Get execution lifecycle status.
     */
    async getStatus(executionId, identity) {
      const snapshot = await lifecycle.getStatus(executionId);
      assertExecutionAccess(snapshot, identity);
      const { tenantFingerprint: _tenant, subjectFingerprint: _subject, ...safe } = snapshot;
      return safe;
    },

    /**
     * Cancel a running execution.
     */
    async cancel(executionId, reason, identity) {
      const snapshot = await lifecycle.getStatus(executionId);
      assertExecutionAccess(snapshot, identity);
      return lifecycle.cancel(executionId, reason);
    },

    /**
     * Pause a running execution.
     */
    async pause(executionId, reason, identity) {
      const snapshot = await lifecycle.getStatus(executionId);
      assertExecutionAccess(snapshot, identity);
      return lifecycle.pause(executionId, reason);
    },

    /**
     * Resume a paused execution.
     */
    async resume(executionId, identity) {
      const snapshot = await lifecycle.getStatus(executionId);
      assertExecutionAccess(snapshot, identity);
      return lifecycle.resume(executionId);
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

function createScopedExecutionId(tenantId, ownerId, planId, nonce = "execution") {
  const digest = createHash("sha256")
    .update(`${tenantId}\u0000${ownerId}\u0000${planId}\u0000${nonce}`, "utf8")
    .digest("hex");
  return `wf-scope-${digest}`;
}

function identityFingerprint(value) {
  return `idfp_${createHash("sha256").update(String(value), "utf8").digest("hex").slice(0, 16)}`;
}

async function runWorkspaceCheck(workspaceGuard) {
  if (typeof workspaceGuard?.check === "function") return workspaceGuard.check();
  if (typeof workspaceGuard?.checkWorkspace === "function") return workspaceGuard.checkWorkspace();
  throw new Error("A workspace safety check is required.");
}

function summarizeEvidenceOutput(value, logRedactor) {
  let serialized;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    serialized = "[unserializable role output]";
  }
  return String(logRedactor.redactString?.(serialized) ?? serialized).slice(0, 5_000);
}

async function runPreExecutionSecurityCheck(checkpoint, { plan, planId }) {
  if (typeof checkpoint?.preExecutionCheck === "function") {
    return checkpoint.preExecutionCheck({
      planId,
      agentId: "workforce-orchestrator",
      goal: plan.goal,
      context: {
        selectedRoles: plan.selectedRoles ?? [],
        selectedTemplate: plan.selectedTemplate ?? null,
      },
    });
  }
  if (typeof checkpoint?.preExecutionScan === "function") {
    return checkpoint.preExecutionScan(plan);
  }
  throw new Error("A pre-execution security checkpoint is required.");
}

async function runPostExecutionSecurityCheck(checkpoint, { plan, planId, roleResults }) {
  if (typeof checkpoint?.postExecutionCheck === "function") {
    return checkpoint.postExecutionCheck({
      planId,
      agentId: "workforce-orchestrator",
      output: roleResults,
      outputText: "",
      commandsRun: [],
      filesChanged: [],
    });
  }
  if (typeof checkpoint?.postExecutionScan === "function") {
    return checkpoint.postExecutionScan(plan, roleResults);
  }
  throw new Error("A post-execution security checkpoint is required.");
}

function startLifecycleMonitor({ lifecycle, executionId, abortController, pollMs }) {
  let stopped = false;
  let polling = false;
  const poll = async () => {
    if (stopped || polling || abortController.signal.aborted) return;
    polling = true;
    try {
      const snapshot = await lifecycle.getStatus(executionId);
      if (!snapshot?.success) {
        const error = new Error("The execution lifecycle disappeared during execution.");
        error.code = "WORKFORCE_LIFECYCLE_MONITOR_FAILED";
        abortController.abort(error);
        return;
      }
      if (snapshot.cancelRequested || snapshot.status === "cancelled" || snapshot.status === "force_stopped") {
        const error = new Error("Workforce execution was cancelled.");
        error.code = "WORKFORCE_EXECUTION_CANCELLED";
        abortController.abort(error);
      } else if (snapshot.pauseRequested || snapshot.status === "paused") {
        const error = new Error("Workforce execution pause requires a durable resumable runner.");
        error.code = "WORKFORCE_EXECUTION_PAUSE_UNSUPPORTED";
        abortController.abort(error);
      }
    } catch {
      const error = new Error("The execution lifecycle could not be monitored.");
      error.code = "WORKFORCE_LIFECYCLE_MONITOR_FAILED";
      abortController.abort(error);
    } finally {
      polling = false;
    }
  };
  const timer = setInterval(() => void poll(), pollMs);
  timer.unref?.();
  void poll();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

function assertLifecycleDecisionAllowsContinuation(decision) {
  if (decision?.action === "cancelled" || decision?.status === "cancelled") {
    const error = new Error("Workforce execution was cancelled.");
    error.code = "WORKFORCE_EXECUTION_CANCELLED";
    throw error;
  }
  if (decision?.action === "paused" || decision?.status === "paused") {
    const error = new Error("Workforce execution pause requires a durable resumable runner.");
    error.code = "WORKFORCE_EXECUTION_PAUSE_UNSUPPORTED";
    throw error;
  }
}

function assertExecutionAccess(snapshot, identity) {
  const tenantId = typeof identity?.tenantId === "string" ? identity.tenantId.trim() : "";
  const userId = typeof identity?.userId === "string" ? identity.userId.trim() : "";
  if (!tenantId || !userId) {
    const error = new Error("An authenticated tenant and subject are required for execution control.");
    error.code = "WORKFORCE_EXECUTION_IDENTITY_REQUIRED";
    error.statusCode = 401;
    throw error;
  }
  if (!snapshot?.success
    || snapshot.tenantFingerprint !== identityFingerprint(tenantId)
    || snapshot.subjectFingerprint !== identityFingerprint(userId)) {
    const error = new Error("The execution does not belong to the authenticated subject.");
    error.code = "WORKFORCE_EXECUTION_FORBIDDEN";
    error.statusCode = 403;
    throw error;
  }
}
