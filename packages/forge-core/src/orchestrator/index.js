/**
 * Execution Orchestrator — the heart of Forge.
 *
 * Drives the execution loop:
 *   1. Fetch ready tasks from the DAG (all dependencies completed)
 *   2. Dispatch to appropriate Worker Agent (with parallel support)
 *   3. Record results and artifacts
 *   4. Create checkpoints at configured boundaries
 *   5. Handle failures with retry and re-planning
 *   6. Track budget (tokens, cost, time)
 *   7. Continue until all tasks complete or goal fails
 */

import { CoderWorker, ArchitectWorker, CodeArchaeologistWorker } from '../worker/coder.js';
import { TesterWorker, VerifierWorker } from '../worker/tester.js';
import { ReviewerWorker } from '../worker/reviewer.js';
import { DebuggerWorker } from '../worker/debugger.js';
import { ImageWorker, EmbeddingWorker, AudioWorker, VideoWorker } from '../worker/media.js';
import { CheckpointManager } from '../checkpoint/index.js';
import { VerificationEngine } from '../verification/index.js';
import { formatDuration, extractFilesFromPrompt } from './utils.js';
import { BudgetTracker } from '../budget-tracker/index.js';
import { CodeIntelligence } from '../code-intel/index.js';
import { runWithTrace, getTraceContext } from '../tracing/index.js';
import { SandboxExecutor } from '../sandbox-executor/index.js';
import {
  createForgeExecutionError,
  isForgeAbortError,
  throwIfForgeAborted,
} from '../worker/base-action-exec.js';

function waitForStagger(delayMs, signal) {
  if (!delayMs) return Promise.resolve();
  if (!signal) return new Promise((resolve) => setTimeout(resolve, delayMs));
  throwIfForgeAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      try { throwIfForgeAborted(signal); } catch (error) { reject(error); }
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

const WORKER_MAP = {
  'coder': () => new CoderWorker(),
  'architect': () => new ArchitectWorker(),
  'code-archaeologist': () => new CodeArchaeologistWorker(),
  'tester': () => new TesterWorker(),
  'verifier': () => new VerifierWorker(),
  'reviewer': () => new ReviewerWorker(),
  'debugger': () => new DebuggerWorker(),
  'image-generator': () => new ImageWorker(),
  'embedding-generator': () => new EmbeddingWorker(),
  'audio-generator': () => new AudioWorker(),
  'video-generator': () => new VideoWorker(),
};

const GOVERNED_WORKER_ROLES = new Set([
  'coder',
  'architect',
  'code-archaeologist',
  'tester',
  'verifier',
  'reviewer',
  'debugger',
]);

export class Orchestrator {
  #store;
  #checkpoint;
  #verifier;
  #budget;
  #codeIntel;
  #projectRoot;
  #options;
  #plugins;     // PluginManager (optional)
  #tracing;     // TraceManager (optional)
  #sandboxExecutor;
  #governedExecution;
  #governanceRequired;
  #signal;

  /**
   * @param {import('../task-store/index.js').TaskStore} store
   * @param {string} projectRoot
   * @param {object} options
   * @param {string[]} options.checkpointAfter — task IDs after which to create checkpoints
   * @param {number} options.maxConcurrent — max parallel workers
   * @param {number} options.maxRetries — default max retries per task
   * @param {object} options.budget — budget limits { maxTokens, maxCost, maxMinutes }
   * @param {boolean} options.enableCodeIntel — whether to run Code Intelligence analysis
   * @param {import('../plugins/index.js').PluginManager} [options.pluginManager] — plugin manager
   * @param {object} [options.tracingManager] — distributed tracing manager
   * @param {object} [options.governedExecution] — trusted per-action hook
   * @param {boolean} [options.governanceRequired] — fail closed without hook
   * @param {AbortSignal} [options.signal] — run cancellation/revocation signal
   */
  constructor(store, projectRoot, options = {}) {
    this.#store = store;
    this.#projectRoot = projectRoot;
    this.#checkpoint = new CheckpointManager(store, projectRoot);
    const configuredSandbox = options.sandboxOptions ?? {};
    const container = configuredSandbox.container
      ? {
          ...configuredSandbox.container,
          workspaceRoots: configuredSandbox.container.workspaceRoots ?? [projectRoot],
        }
      : undefined;
    this.#sandboxExecutor = options.sandboxExecutor ?? new SandboxExecutor({
      ...configuredSandbox,
      container,
      level: configuredSandbox.level ?? 'full',
      allowedPaths: configuredSandbox.allowedPaths ?? [projectRoot],
      hostExecutionEnabled: false,
    });
    this.#verifier = new VerificationEngine({
      store,
      projectRoot,
      tracingManager: options.tracingManager,
      sandboxExecutor: this.#sandboxExecutor,
    });
    this.#budget = new BudgetTracker(options.budget ?? {});
    this.#codeIntel = options.enableCodeIntel !== false && options.governanceRequired !== true
      ? new CodeIntelligence()
      : null;
    this.#plugins = options.pluginManager || null;
    this.#tracing = options.tracingManager || null;
    this.#governedExecution = options.governedExecution ?? null;
    this.#governanceRequired = options.governanceRequired === true;
    this.#signal = options.signal ?? options.governedExecution?.signal ?? null;
    this.#options = {
      checkpointAfter: options.checkpointAfter ?? [],
      maxConcurrent: options.maxConcurrent ?? 2,
      maxRetries: options.maxRetries ?? 2,
    };
  }

  /**
   * Execute a compiled goal to completion.
   * @param {string} goalId
   * @returns {object} — execution report
   */
  async execute(goalId, execution = {}) {
    const signal = execution.signal ?? this.#signal;
    if (this.#governanceRequired && typeof this.#governedExecution?.beforeAction !== 'function') {
      throw createForgeExecutionError(
        'FORGE_ACTION_GOVERNANCE_REQUIRED',
        'Forge production-governed execution requires a server-owned beforeAction hook.',
      );
    }
    throwIfForgeAborted(signal);
    const goalSpan = this.#tracing?.startSpan({
      traceId: goalId,
      operationName: 'goal_execution',
      goalId,
      attributes: { 'forge.goal.id': goalId }
    });

    let _goalStatus = 'ok';
    try {
      return await runWithTrace(goalId, goalSpan?.id || null, async () => {
    throwIfForgeAborted(signal);
    const goal = this.#store.getGoal(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found`);
    if (goal.status !== 'compiled' && goal.status !== 'running') {
      throw new Error(`Goal ${goalId} is in status "${goal.status}", expected "compiled" or "running"`);
    }

    this.#store.updateGoalStatus(goalId, 'running');
    this.#store.logEvent(goalId, null, 'execution_started');

    // Plugin hook: beforeGoal
    await this.#plugins?.runHook('beforeGoal', { goalId, goal, store: this.#store });

    const startTime = Date.now();
    const accumulatedContext = { summary: '', keyDecisions: [] };
    let completedCount = 0;
    let failedCount = 0;

    // Parse checkpoint config from compiled DAG
    let checkpointAfter = this.#governanceRequired ? [] : this.#options.checkpointAfter;
    let goalBudget = {};
    if (goal.compiled_dag) {
      try {
        const dag = JSON.parse(goal.compiled_dag);
        if (!this.#governanceRequired && dag.checkpoints) {
          checkpointAfter = dag.checkpoints
            .filter(c => c.startsWith('after_'))
            .map(c => c.replace('after_', ''));
        }
        if (dag.budget) {
          goalBudget = dag.budget;
        }
      } catch { /* use defaults */ }
    }

    // Pre-analyze codebase with Code Intelligence (non-blocking)
    let codebaseSummary = '';
    if (this.#codeIntel) {
      try {
        throwIfForgeAborted(signal);
        console.log('[forge:orchestrator] Analyzing codebase with Code Intelligence...');
        await this.#codeIntel.analyze(this.#projectRoot, {
          patterns: ['src/**/*.js', 'src/**/*.ts', 'test/**/*.js'],
        });
        codebaseSummary = this.#codeIntel.getCodebaseSummary();
        throwIfForgeAborted(signal);
        console.log(`[forge:orchestrator] Code Intelligence: ${codebaseSummary.split('\n').length} lines of context`);
      } catch (err) {
        if (isForgeAbortError(err, signal)) throw err;
        console.log(`[forge:orchestrator] Code Intelligence skipped: ${err.message}`);
      }
    }

    // Main execution loop
    while (true) {
      throwIfForgeAborted(signal);
      // Budget check before each batch
      const budgetCheck = this.#budget.checkBudget();
      if (!budgetCheck.withinBudget) {
        console.log(`[forge:orchestrator] Budget exceeded: ${budgetCheck.warnings.join(', ')}`);
        this.#store.logEvent(goalId, null, 'budget_exceeded', {
          usage: budgetCheck.usage,
          warnings: budgetCheck.warnings,
        });
        break;
      }
      if (budgetCheck.warnings.length > 0) {
        console.log(`[forge:orchestrator] Budget warnings: ${budgetCheck.warnings.join(', ')}`);
      }

      const readyTasks = this.#store.getReadyTasks(goalId);

      if (readyTasks.length === 0) {
        // Check if all tasks are done
        const allTasks = this.#store.getTasksForGoal(goalId);
        const pending = allTasks.filter(t => t.status === 'pending' || t.status === 'running');
        const failed = allTasks.filter(t => t.status === 'failed' && t.retry_count >= t.max_retries);

        if (pending.length === 0 && failed.length === 0) {
          break;
        } else if (pending.length === 0 && failed.length > 0) {
          console.log(`[forge:orchestrator] ${failed.length} tasks permanently failed.`);
          failedCount = failed.length;
          break;
        } else if (pending.length > 0 && readyTasks.length === 0) {
          for (const t of pending) {
            this.#store.updateTaskStatus(goalId, t.id, 'blocked', {
              errorMessage: 'Dependencies failed or were skipped',
            });
          }
          break;
        }
      }

      // Execute ready tasks in parallel (up to concurrency limit)
      const batch = readyTasks.slice(0, this.#options.maxConcurrent);
      const parallelNote = batch.length > 1 ? ' (parallel)' : '';
      console.log(`[forge:orchestrator] Executing batch of ${batch.length} task(s)${parallelNote}...`);

      if (batch.length > 1) {
        console.log(`[forge:orchestrator]   → ${batch.map(t => `${t.id}(${t.agent_role})`).join(', ')}`);
      }

      // Stagger parallel tasks to avoid API rate limiting
      const staggeredResults = await Promise.allSettled(
        batch.map((task, idx) => {
          if (idx === 0) return this.#executeTask(goalId, task, accumulatedContext, codebaseSummary, signal);
          // Stagger subsequent tasks by 1.5s each
          return waitForStagger(idx * 1500, signal)
            .then(() => this.#executeTask(goalId, task, accumulatedContext, codebaseSummary, signal));
        })
      );
      // Promise.allSettled is intentional: revocation aborts active workers and
      // then drains the entire in-flight batch before the run unwinds.
      throwIfForgeAborted(signal);
      const results = staggeredResults;

      for (let i = 0; i < batch.length; i++) {
        const task = batch[i];
        const result = results[i];

        if (result.status === 'fulfilled' && result.value.success) {
          completedCount++;
          this.#store.updateTaskStatus(goalId, task.id, 'completed', {
            resultJson: JSON.stringify(result.value),
          });

          // Update accumulated context (append, don't overwrite)
          const taskSummary = `[Task ${task.id}: ${task.name}] ${result.value.output?.slice(0, 500) ?? 'completed'}`;
          accumulatedContext.summary = accumulatedContext.summary
            ? `${accumulatedContext.summary}\n\n${taskSummary}`
            : taskSummary;
          if (result.value.keyDecision) {
            accumulatedContext.keyDecisions.push(result.value.keyDecision);
          }
          if (result.value.filesModified?.length) {
            accumulatedContext.keyDecisions.push(
              `Files modified by ${task.id}: ${result.value.filesModified.map(f => f.path).join(', ')}`
            );
          }

          // Track token usage if available
          if (result.value.tokenUsage) {
            this.#budget.recordUsage(result.value.tokenUsage);
          }

          // Record artifacts
          for (const fm of (result.value.filesModified ?? [])) {
            this.#store.recordArtifact({
              goalId, taskId: task.id,
              filePath: fm.path, action: fm.action,
            });
          }

          // Impact analysis if code intel is available
          if (this.#codeIntel && result.value.filesModified?.length) {
            try {
              const changedFiles = result.value.filesModified.map(f => f.path);
              const impact = this.#codeIntel.getImpactReport(changedFiles);
              if (impact.riskLevel === 'high' || impact.riskLevel === 'critical') {
                console.log(`[forge:orchestrator] Impact analysis: ${impact.riskLevel} risk — ${impact.blastRadius} files affected`);
                accumulatedContext.keyDecisions.push(
                  `Impact alert: ${task.id} changes affect ${impact.blastRadius} files (risk: ${impact.riskLevel})`
                );
              }
            } catch { /* code intel optional */ }
          }

          // Checkpoint if configured
          if (!this.#governanceRequired && checkpointAfter.includes(task.id)) {
            const budgetStatus = this.#budget.getStatus();
            this.#checkpoint.createCheckpoint(goalId, task.id, {
              summary: accumulatedContext.summary,
              keyDecisions: accumulatedContext.keyDecisions,
              budget: {
                ...budgetStatus,
                timeElapsed: `${Math.round((Date.now() - startTime) / 1000)}s`,
                tasksCompleted: completedCount,
              },
            });
          }
        } else {
          const error = result.status === 'rejected'
            ? result.reason?.message ?? String(result.reason)
            : result.value?.error ?? 'Unknown error';

          this.#store.incrementRetry(goalId, task.id);
          const taskData = this.#store.getTask(goalId, task.id);

          if (taskData.retry_count < taskData.max_retries) {
            console.log(`[forge:orchestrator] Task ${task.id} failed (retry ${taskData.retry_count}/${taskData.max_retries}): ${error}`);
            this.#store.updateTaskStatus(goalId, task.id, 'pending', { errorMessage: error });
          } else {
            console.log(`[forge:orchestrator] Task ${task.id} permanently failed: ${error}`);
            this.#store.updateTaskStatus(goalId, task.id, 'failed', { errorMessage: error });
            failedCount++;
          }
        }
      }
    }

    // Final status
    const durationMs = Date.now() - startTime;
    const finalStatus = failedCount > 0 ? 'failed' : 'completed';
    const budgetFinal = this.#budget.getStatus();

    this.#store.updateGoalStatus(goalId, finalStatus);
    this.#store.logEvent(goalId, null, 'execution_finished', {
      status: finalStatus,
      completedTasks: completedCount,
      failedTasks: failedCount,
      durationMs,
      budget: budgetFinal,
      governance: this.#governanceRequired
        ? { enforced: true, mode: 'gateway-governed' }
        : { enforced: false, mode: 'standalone-development-only' },
    });

    const report = {
      goalId,
      status: finalStatus,
      completedTasks: completedCount,
      failedTasks: failedCount,
      durationMs,
      durationHuman: formatDuration(durationMs),
      budget: budgetFinal,
      governance: this.#governanceRequired
        ? { enforced: true, mode: 'gateway-governed' }
        : { enforced: false, mode: 'standalone-development-only' },
    };

    console.log(`\n[forge:orchestrator] Goal ${finalStatus}: ${completedCount} tasks done, ${failedCount} failed, in ${report.durationHuman}`);
    console.log(`[forge:orchestrator] Budget: ${budgetFinal.tokensUsed} tokens, $${(budgetFinal.costIncurred || 0).toFixed(4)}, ${formatDuration(durationMs)}`);

    // Plugin hooks: afterGoal + onGoalComplete/onGoalFail
    await this.#plugins?.runHook('afterGoal', {
      goalId, goal, status: finalStatus, durationMs,
      tasksCompleted: completedCount, tasksFailed: failedCount,
      budget: budgetFinal,
    });
    if (finalStatus === 'completed') {
      await this.#plugins?.runHook('onGoalComplete', { goalId, report });
    } else {
      await this.#plugins?.runHook('onGoalFail', { goalId, report });
    }

    if (finalStatus === 'failed') _goalStatus = 'error';
    return report;
      });
    } catch (err) {
      _goalStatus = 'error';
      throw err;
    } finally {
      if (goalSpan) {
        this.#tracing?.endSpan(goalSpan.id, _goalStatus, { 'forge.goal.id': goalId });
      }
    }
  }

  async #executeTask(goalId, task, context, codebaseSummary, signal) {
    throwIfForgeAborted(signal);
    const taskSpan = this.#tracing?.startSpan({
      traceId: goalId,
      operationName: 'task_execution',
      goalId,
      taskId: task.id,
      attributes: {
        'forge.task.id': task.id,
        'forge.task.name': task.name || '',
        'forge.task.type': task.type || ''
      }
    });

    try {
    const workerFactory = WORKER_MAP[task.agent_role || task.agentRole];
    if (!workerFactory) {
      throw new Error(`No worker registered for role: ${task.agent_role || task.agentRole}`);
    }
    if (this.#governanceRequired && !GOVERNED_WORKER_ROLES.has(task.agent_role || task.agentRole)) {
      throw createForgeExecutionError(
        'FORGE_GOVERNED_WORKER_UNSUPPORTED',
        `Worker role ${task.agent_role || task.agentRole} does not implement the governed action contract.`,
      );
    }

    this.#store.updateTaskStatus(goalId, task.id, 'running');
    this.#store.logEvent(goalId, task.id, 'task_started', {
      name: task.name, type: task.type, agentRole: task.agent_role,
    });

    // Plugin hook: beforeTask + onTaskStart
    const taskCtx = { goalId, task, projectRoot: this.#projectRoot, store: this.#store };
    await this.#plugins?.runHook('beforeTask', taskCtx);
    await this.#plugins?.runHook('onTaskStart', { goalId, taskId: task.id, task });
    throwIfForgeAborted(signal);

    const worker = workerFactory();
    worker.setSandboxExecutor?.(this.#sandboxExecutor);
    let allowedFiles = typeof task.allowed_files === 'string'
      ? JSON.parse(task.allowed_files) : (task.allowed_files || []);

    // Expand allowedFiles for mutation tasks: include broad source/test patterns
    // so the LLM can freely edit any file it needs to integrate changes
    const mutationTypes = new Set(['implement', 'test', 'refactor']);
    if (mutationTypes.has(task.type)) {
      const promptFiles = task.prompt ? extractFilesFromPrompt(task.prompt) : [];
      const expanded = new Set([
        ...allowedFiles,
        ...promptFiles,
        // Allow all source and test files for mutation tasks — the LLM needs to
        // integrate changes across modules (e.g. adding imports, wiring middleware)
        'src/**/*.js', 'src/**/*.ts', 'src/**/*.mjs',
        'lib/**/*.js', 'lib/**/*.ts',
        'test/**/*.js', 'test/**/*.ts', 'tests/**/*.js', 'tests/**/*.ts',
      ]);
      // Always allow core config files
      for (const coreFile of ['src/server.js', 'src/index.js', 'src/app.js', 'src/main.js', 'src/router.js', 'src/config.js']) {
        expanded.add(coreFile);
      }
      allowedFiles = [...expanded];
      console.log(`[forge:orchestrator] Task ${task.id} (${task.type}) expanded allowedFiles: ${JSON.stringify(allowedFiles.slice(0, 10))}...`);
    }

    // Enrich context with codebase summary if available
    const enrichedContext = {
      ...context,
      signal,
      governedExecution: this.#governedExecution,
      governanceRequired: this.#governanceRequired,
    };
    if (codebaseSummary && !enrichedContext.codebaseSummary) {
      enrichedContext.codebaseSummary = codebaseSummary;
    }

    // Wrap worker.execute() with plugin middleware chain
    const executeFn = async () => worker.execute(
      { ...task, allowed_files: allowedFiles, allowedFiles },
      this.#projectRoot,
      enrichedContext
    );

    const middlewareCtx = {
      goalId, task, projectRoot: this.#projectRoot,
      worker: task.agent_role || task.agentRole,
    };

    const result = this.#plugins
      ? await this.#plugins.runMiddleware(middlewareCtx, executeFn)
      : await executeFn();
    throwIfForgeAborted(signal);

    // If it's a verify task, also run the verification engine
    if (!this.#governanceRequired && task.type === 'verify' && result.success) {
      const verifyResult = await this.#verifier.verify(goalId, task.id, { maxTier: 2, signal });
      result.verification = verifyResult;
      if (verifyResult.overall === 'FAIL') {
        const allChecks = verifyResult.tiers.flatMap(t =>
          t.checks.map(c => ({ ...c, tier: t.tier }))
        );
        const failed = allChecks.filter(c => c.status === 'FAIL');

        for (const c of failed) {
          console.log(`[forge:verify] Tier ${c.tier} / ${c.name} FAILED:`);
          console.log(`  ${(c.output || '').slice(0, 500)}`);
        }

        result.success = false;
        result.needsReview = true;
        result.error = `Verification failed closed: ${failed.map((check) => `Tier ${check.tier}/${check.name}`).join(', ')}`;
        console.log(`[forge:orchestrator] Verification BLOCKED: ${failed.length} failed check(s); partial success cannot override a failed tier.`);
      }
    }

    this.#store.logEvent(goalId, task.id, 'task_finished', {
      success: result.success,
      filesModified: result.filesModified?.length ?? 0,
      toolCalls: result.toolCalls ?? 0,
    });

    // Plugin hooks: afterTask + onTaskComplete/onTaskFail
    await this.#plugins?.runHook('afterTask', { goalId, task, result, store: this.#store });
    if (result.success) {
      await this.#plugins?.runHook('onTaskComplete', { goalId, taskId: task.id, task, result });
    } else {
      await this.#plugins?.runHook('onTaskFail', { goalId, taskId: task.id, task, result, error: result.error });
    }

    if (taskSpan) {
      this.#tracing?.endSpan(taskSpan.id, 'ok', { 'forge.task.id': task.id });
    }
    return result;
    } catch (err) {
      if (taskSpan) {
        this.#tracing?.endSpan(taskSpan.id, 'error', { 'forge.task.id': task.id, 'error.message': err.message });
      }
      throw err;
    }
  }

  /**
   * Get the current tracing status (if tracing is enabled).
   * @returns {object|null}
   */
  getTracing() {
    return this.#tracing?.getStatus() || null;
  }
}
