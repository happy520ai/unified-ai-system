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
   */
  constructor(store, projectRoot, options = {}) {
    this.#store = store;
    this.#projectRoot = projectRoot;
    this.#checkpoint = new CheckpointManager(store, projectRoot);
    this.#verifier = new VerificationEngine(store, projectRoot);
    this.#budget = new BudgetTracker(options.budget ?? {});
    this.#codeIntel = options.enableCodeIntel !== false ? new CodeIntelligence() : null;
    this.#plugins = options.pluginManager || null;
    this.#tracing = options.tracingManager || null;
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
  async execute(goalId) {
    const goalSpan = this.#tracing?.startSpan({
      traceId: goalId,
      operationName: 'goal_execution',
      goalId,
      attributes: { 'forge.goal.id': goalId }
    });

    let _goalStatus = 'ok';
    try {
      return await runWithTrace(goalId, goalSpan?.id || null, async () => {
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
    let checkpointAfter = this.#options.checkpointAfter;
    let goalBudget = {};
    if (goal.compiled_dag) {
      try {
        const dag = JSON.parse(goal.compiled_dag);
        if (dag.checkpoints) {
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
        console.log('[forge:orchestrator] Analyzing codebase with Code Intelligence...');
        await this.#codeIntel.analyze(this.#projectRoot, {
          patterns: ['src/**/*.js', 'src/**/*.ts', 'test/**/*.js'],
        });
        codebaseSummary = this.#codeIntel.getCodebaseSummary();
        console.log(`[forge:orchestrator] Code Intelligence: ${codebaseSummary.split('\n').length} lines of context`);
      } catch (err) {
        console.log(`[forge:orchestrator] Code Intelligence skipped: ${err.message}`);
      }
    }

    // Main execution loop
    while (true) {
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
          if (idx === 0) return this.#executeTask(goalId, task, accumulatedContext, codebaseSummary);
          // Stagger subsequent tasks by 1.5s each
          return new Promise(resolve => {
            setTimeout(() => {
              this.#executeTask(goalId, task, accumulatedContext, codebaseSummary).then(resolve, resolve);
            }, idx * 1500);
          });
        })
      );
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
          if (checkpointAfter.includes(task.id)) {
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
    });

    const report = {
      goalId,
      status: finalStatus,
      completedTasks: completedCount,
      failedTasks: failedCount,
      durationMs,
      durationHuman: formatDuration(durationMs),
      budget: budgetFinal,
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

  async #executeTask(goalId, task, context, codebaseSummary) {
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

    this.#store.updateTaskStatus(goalId, task.id, 'running');
    this.#store.logEvent(goalId, task.id, 'task_started', {
      name: task.name, type: task.type, agentRole: task.agent_role,
    });

    // Plugin hook: beforeTask + onTaskStart
    const taskCtx = { goalId, task, projectRoot: this.#projectRoot, store: this.#store };
    await this.#plugins?.runHook('beforeTask', taskCtx);
    await this.#plugins?.runHook('onTaskStart', { goalId, taskId: task.id, task });

    const worker = workerFactory();
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
    const enrichedContext = { ...context };
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

    // If it's a verify task, also run the verification engine
    if (task.type === 'verify' && result.success) {
      const verifyResult = await this.#verifier.verify(goalId, task.id, { maxTier: 2 });
      result.verification = verifyResult;
      if (verifyResult.overall === 'FAIL') {
        const allChecks = verifyResult.tiers.flatMap(t =>
          t.checks.map(c => ({ ...c, tier: t.tier }))
        );
        const passed = allChecks.filter(c => c.status === 'PASS').length;
        const total = allChecks.length;
        const skipped = allChecks.filter(c => c.status === 'SKIP').length;
        const failed = allChecks.filter(c => c.status === 'FAIL');
        // Tier 2 = Unit Tests. Test failures are HARD failures — never auto-accept.
        const testFailures = failed.filter(c => c.tier === 2);
        const nonTestFailures = failed.filter(c => c.tier !== 2);

        for (const c of failed) {
          console.log(`[forge:verify] Tier ${c.tier} / ${c.name} FAILED:`);
          console.log(`  ${(c.output || '').slice(0, 500)}`);
        }

        if (testFailures.length > 0) {
          // Test failures block delivery — no more "accepting with warnings".
          result.success = false;
          result.needsReview = true;
          result.error = `Verification FAILED: ${testFailures.length} test check(s) failed (Tier 2). ` +
            `Failing: ${testFailures.map(c => c.name).join(', ')}. Manual review required.`;
          console.log(`[forge:orchestrator] Verification BLOCKED: ${testFailures.length} test failure(s) — marking task FAILED (no auto-accept)`);
        } else if (passed > 0 || (passed === 0 && total === skipped)) {
          // Only non-test checks failed (lint/format/style) — warn but accept.
          console.log(`[forge:orchestrator] Verification partial: ${passed}/${total} passed, ${skipped} skipped — accepting with warnings (non-test only)`);
          result.verificationWarning = `Partial pass: ${passed}/${total} checks passed; non-test failures: ${nonTestFailures.map(c => c.name).join(', ')}`;
          result.needsReview = nonTestFailures.length > 0;
        } else {
          result.success = false;
          result.needsReview = true;
          result.error = `Verification failed: ${JSON.stringify(verifyResult.tiers.map(t => ({ tier: t.tier, status: t.status })))}`;
        }
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
