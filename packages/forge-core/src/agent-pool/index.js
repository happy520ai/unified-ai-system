/**
 * Agent Pool Manager — manages a shared pool of worker agents across multiple users and goals.
 *
 * Provides:
 *   - Priority-based task queue with user attribution and fair cross-goal scheduling
 *   - Configurable concurrency limit for parallel worker execution (global, not per-goal)
 *   - Goal-level lifecycle management (submit, cancel, completion tracking)
 *   - File lock registry for cross-goal conflict detection
 *   - Global budget tracking (tokens, cost, time) across all goals
 *   - Verification engine integration for verify-type tasks
 *   - Code intelligence impact analysis after task completion
 *   - Checkpoint creation at goal completion
 *   - Event-driven notifications for task and goal state transitions
 *   - Graceful shutdown with in-flight task draining
 *
 * Usage:
 *   const pool = new AgentPoolManager({ store, projectRoot, maxConcurrent: 4 });
 *   pool.on('task_completed', ({ taskId, result }) => { ... });
 *   await pool.submitGoal(goalId, userId);
 *   await pool.shutdown();
 */

import { EventEmitter } from 'node:events';

import { BudgetTracker } from '../budget-tracker/index.js';
import { VerificationEngine } from '../verification/index.js';
import { CodeIntelligence } from '../code-intel/index.js';
import { CheckpointManager } from '../checkpoint/index.js';
import { MetricsCollector } from '../metrics/index.js';
import { CircuitBreaker, AdaptiveTimeout } from '../resilience/index.js';
import { runWithTrace } from '../tracing/index.js';
import { SelfLoopEngine } from '../self-loop/index.js';
import { StrategyEvolution } from '../self-loop/strategy-evolution.js';
import { CostCalculator } from '../cost-calculator/index.js';
import { DeadLetterQueue } from '../dead-letter-queue/index.js';
import { ProgressEstimator } from '../progress-estimator/index.js';
import { MemoryEngine } from '../memory-engine/index.js';
import { CostAttribution } from '../cost-attribution/index.js';
import { DecisionTrace } from '../decision-trace/index.js';
import { HealthDashboard } from '../health-dashboard/index.js';
import { AdaptiveScaling } from '../adaptive-scaling/index.js';
import { ErrorPatternLearner } from '../error-pattern-learner/index.js';
import { KnowledgeGraph } from '../knowledge-graph/index.js';
import { SemanticMemory } from '../semantic-memory/index.js';
import { PromptRegistry } from '../prompt-registry/index.js';
import { MultiAgentReview } from '../multi-agent-review/index.js';
import { SandboxExecutor } from '../sandbox-executor/index.js';
import { LiveStream } from '../live-stream/index.js';
import { PromptInjectionDefense } from '../injection-defense/index.js';
import { SelfHealingEngine, HealingAction } from '../self-healing/index.js';
import { GracefulDegradation, ModulePriority } from '../graceful-degradation/index.js';
import { CrossSessionMemory } from '../cross-session-memory/index.js';
import { UnifiedConfigHub } from '../config-hub/index.js';
import { ContextEngine } from '../context-engine/index.js';

// Extracted helper modules
import { submitGoal as _submitGoal, enqueueNewlyReadyTasks as _enqueueNewlyReadyTasks, checkGoalCompletion as _checkGoalCompletion, cancelGoal as _cancelGoal, resumeGoal as _resumeGoal, recoverInterruptedGoals as _recoverInterruptedGoals } from './goal-lifecycle.js';
import { processQueue as _processQueue } from './process-queue.js';
import { executeWorker as _executeWorker } from './worker-execution.js';
import { reapOrphanTasks as _reapOrphanTasks } from './orphan-reaper.js';
import { getStatus as _getStatus, getMetrics as _getMetrics, getPlugins as _getPlugins, getResilience as _getResilience, getSelfLoop as _getSelfLoop, getCostCalculator as _getCostCalculator, getDeadLetterQueue as _getDeadLetterQueue, getProgressEstimator as _getProgressEstimator, getMemoryEngine as _getMemoryEngine, getGoalProgress as _getGoalProgress, getGoalBudget as _getGoalBudget, getTracing as _getTracing, getTracingManager as _getTracingManager } from './pool-status.js';
import { shutdown as _shutdown } from './shutdown.js';

export class AgentPoolManager {
  /** @type {object} Consolidated state object for extraction */
  #s = {};

  /**
   * @param {object} options
   * @param {import('../task-store/index.js').TaskStore} options.store — TaskStore instance
   * @param {string} options.projectRoot — absolute path to the project root
   * @param {number} [options.maxConcurrent=4] — maximum number of parallel workers (GLOBAL across all goals)
   * @param {object} [options.llmOptions] — default LLM options passed to workers
   * @param {object} [options.budget] — global budget limits { maxTokens, maxCost, maxMinutes }
   * @param {boolean} [options.enableCodeIntel=true] — enable code intelligence impact analysis
   * @param {boolean} [options.enableVerification=true] — enable verification engine for verify tasks
   * @param {boolean} [options.enableAutoVerify=true] — auto-run verification after code-mutating tasks
   * @param {number} [options.maxGoals=3] — maximum number of goals executing in parallel
   * @param {import('../config/index.js').ForgeConfig} [options.config] — ForgeConfig instance for centralized settings
   * @param {import('../plugins/index.js').PluginManager} [options.pluginManager] — plugin manager for hooks & middleware
   * @param {import('../tracing/index.js').TraceManager} [options.tracingManager] — distributed tracing manager
   */
  constructor({ store, projectRoot, maxConcurrent, llmOptions, budget, enableCodeIntel, enableVerification, enableAutoVerify, maxGoals, config, pluginManager, tracingManager }) {
    this.#s.config = config || null;
    this.#s.plugins = pluginManager || null;
    this.#s.tracing = tracingManager || null;
    const cfg = config;

    // Resolve settings: explicit args > config > defaults
    this.#s.store = store;
    this.#s.projectRoot = projectRoot;
    this.#s.maxConcurrent = maxConcurrent ?? cfg?.pool?.maxConcurrent ?? 4;
    this.#s.llmOptions = llmOptions ?? {};
    this.#s.options = {
      enableCodeIntel: enableCodeIntel ?? cfg?.pool?.enableCodeIntel ?? true,
      enableVerification: enableVerification ?? cfg?.pool?.enableVerification ?? true,
      enableAutoVerify: enableAutoVerify ?? cfg?.pool?.enableAutoVerify ?? true,
      maxGoals: maxGoals ?? cfg?.pool?.maxGoals ?? 3,
    };

    // Initialize core state collections
    this.#s.activeWorkers = new Map();
    this.#s.completedTaskIds = new Set();
    this.#s.fileLocks = new Map();
    this.#s.goalBudgets = new Map();
    this.#s.goalSpans = new Map();
    this.#s.goalTrackers = new Map();
    this.#s.queue = [];
    this.#s.rrGoalIndex = 0;
    this.#s.shuttingDown = false;
    this.#s.verificationStats = { total: 0, passed: 0, failed: 0, skipped: 0 };
    this.#s.orphanCheckIntervalMs = 60_000;
    this.#s.taskTimeoutMs = 10 * 60 * 1000;
    this.#s.orphanCheckInterval = null;

    this.#s.eventEmitter = new EventEmitter();
    this.#s.eventEmitter.setMaxListeners(100);

    // Initialize global budget tracker
    const budgetCfg = budget ?? (cfg?.budget ? {
      maxTokens: cfg.budget.maxTokens,
      maxCost: cfg.budget.maxCost,
      maxMinutes: cfg.budget.maxMinutes,
    } : null);
    if (budgetCfg) {
      this.#s.budget = new BudgetTracker(budgetCfg);
    }

    // Initialize verification engine
    if (this.#s.options.enableVerification) {
      this.#s.verifier = new VerificationEngine(store, projectRoot);
    }

    // Initialize code intelligence
    if (this.#s.options.enableCodeIntel) {
      this.#s.codeIntel = new CodeIntelligence(projectRoot);
    }

    // Initialize checkpoint manager
    this.#s.checkpoint = new CheckpointManager(this.#s.store, projectRoot);

    // Initialize metrics collector
    this.#s.metrics = new MetricsCollector(cfg?.metrics ? {
      seriesWindowMs: cfg.metrics.seriesWindow,
      maxRecords: cfg.metrics.maxRecords,
    } : {});

    // Initialize resilience (circuit breaker + adaptive timeout)
    this.#s.circuitBreaker = new CircuitBreaker({ failureThreshold: 5, recoveryMs: 60000 });
    this.#s.adaptiveTimeout = new AdaptiveTimeout({
      minTimeout: 30000,
      maxTimeout: cfg?.worker?.bashTimeout ?? 180000,
      multiplier: 2.5,
      margin: 10000,
    });

    // Initialize self-loop engine
    this.#s.evolution = new StrategyEvolution({ explorationRate: cfg?.selfLoop?.explorationRate ?? 0.15 });
    this.#s.selfLoop = new SelfLoopEngine({
      verifier: this.#s.verifier,
      store: this.#s.store,
      evolution: this.#s.evolution,
      projectRoot,
      config: {
        maxLoops: cfg?.selfLoop?.maxLoops ?? 4,
        defaultTier: cfg?.selfLoop?.defaultTier ?? 2,
        rollbackEnabled: cfg?.selfLoop?.rollbackEnabled ?? true,
      },
    });

    // Initialize intelligence modules
    this.#s.costCalculator = new CostCalculator();
    this.#s.deadLetterQueue = new DeadLetterQueue({ maxSize: cfg?.dlq?.maxSize ?? 100 });
    this.#s.progressEstimator = new ProgressEstimator();
    this.#s.memoryEngine = new MemoryEngine({
      persistencePath: cfg?.memory?.persistencePath ?? null,
      hotMaxEntries: cfg?.memory?.hotMaxEntries ?? 500,
      hotTokenBudget: cfg?.memory?.hotTokenBudget ?? 32000,
      warmMaxPerCategory: cfg?.memory?.warmMaxPerCategory ?? 200,
    });
    this.#s.memoryEngine.load().catch(() => {});

    this.#s.costAttribution = new CostAttribution({ persistencePath: cfg?.cost?.persistencePath ?? null });
    this.#s.costAttribution.load().catch(() => {});
    this.#s.decisionTrace = new DecisionTrace({ persistencePath: cfg?.trace?.persistencePath ?? null });
    this.#s.decisionTrace.load().catch(() => {});
    this.#s.healthDashboard = new HealthDashboard();
    this.#s.adaptiveScaling = new AdaptiveScaling({
      minWorkers: cfg?.scaling?.minWorkers ?? 1,
      maxWorkers: cfg?.scaling?.maxWorkers ?? 16,
      currentWorkers: this.#s.maxConcurrent,
    });
    this.#s.errorPatternLearner = new ErrorPatternLearner({ persistencePath: cfg?.errors?.persistencePath ?? null });
    this.#s.errorPatternLearner.load().catch(() => {});
    this.#s.knowledgeGraph = new KnowledgeGraph();
    this.#s.semanticMemory = new SemanticMemory();
    this.#s.promptRegistry = new PromptRegistry({ persistencePath: cfg?.prompts?.persistencePath ?? null });
    this.#s.promptRegistry.load().catch(() => {});

    // P7: Multi-agent review, sandbox, live stream, injection defense
    this.#s.multiAgentReview = new MultiAgentReview();
    this.#s.sandboxExecutor = new SandboxExecutor();
    this.#s.liveStream = new LiveStream();
    this.#s.injectionDefense = new PromptInjectionDefense();

    // P8: Self-healing, graceful degradation, cross-session memory, config hub
    this.#s.selfHealing = new SelfHealingEngine({
      checkInterval: cfg?.healing?.checkInterval ?? 10000,
      maxAutoHeals: cfg?.healing?.maxAutoHeals ?? 5,
      cooldownMs: cfg?.healing?.cooldownMs ?? 60000,
    });
    this.#s.gracefulDegradation = new GracefulDegradation({
      moderateThreshold: cfg?.degradation?.moderateThreshold ?? 0.7,
      highThreshold: cfg?.degradation?.highThreshold ?? 0.85,
      criticalThreshold: cfg?.degradation?.criticalThreshold ?? 0.95,
    });
    this.#s.crossSessionMemory = new CrossSessionMemory({
      persistencePath: cfg?.crossSession?.persistencePath ?? null,
      maxGlobalEntries: cfg?.crossSession?.maxGlobalEntries ?? 500,
    });
    this.#s.crossSessionMemory.load().catch(() => {});
    this.#s.configHub = new UnifiedConfigHub({
      defaults: cfg?.configHub?.defaults ?? {},
      envPrefix: cfg?.configHub?.envPrefix ?? 'FORGE_',
    });
    this.#s.contextEngine = new ContextEngine({ maxContextTokens: cfg?.context?.maxTokens ?? 32000 });

    // Register all modules with health dashboard
    this.#s.healthDashboard.registerModule('memory', () => this.#s.memoryEngine.getStatus());
    this.#s.healthDashboard.registerModule('costAttribution', () => this.#s.costAttribution.getStatus());
    this.#s.healthDashboard.registerModule('decisionTrace', () => this.#s.decisionTrace.getStatus());
    this.#s.healthDashboard.registerModule('adaptiveScaling', () => this.#s.adaptiveScaling.getStatus());
    this.#s.healthDashboard.registerModule('errorPatterns', () => this.#s.errorPatternLearner.getStatus());
    this.#s.healthDashboard.registerModule('knowledgeGraph', () => this.#s.knowledgeGraph.getStatus());
    this.#s.healthDashboard.registerModule('semanticMemory', () => this.#s.semanticMemory.getStats());
    this.#s.healthDashboard.registerModule('promptRegistry', () => this.#s.promptRegistry.getStatus());
    this.#s.healthDashboard.registerModule('multiAgentReview', () => this.#s.multiAgentReview.getStatus());
    this.#s.healthDashboard.registerModule('sandbox', () => this.#s.sandboxExecutor.getStatus());
    this.#s.healthDashboard.registerModule('liveStream', () => this.#s.liveStream.getStatus());
    this.#s.healthDashboard.registerModule('injectionDefense', () => this.#s.injectionDefense.getStatus());
    this.#s.healthDashboard.registerModule('selfHealing', () => this.#s.selfHealing.getStatus());
    this.#s.healthDashboard.registerModule('gracefulDegradation', () => this.#s.gracefulDegradation.getStatus());
    this.#s.healthDashboard.registerModule('crossSessionMemory', () => this.#s.crossSessionMemory.getStatus());
    this.#s.healthDashboard.registerModule('configHub', () => this.#s.configHub.getStatus());
    this.#s.healthDashboard.registerModule('contextEngine', () => ({ maxContextTokens: 32000, status: 'active' }));

    // Register self-healing modules
    this.#s.selfHealing.registerModule('circuitBreaker', async () => {
      const stats = this.#s.circuitBreaker.getStatus();
      const openCircuits = Object.entries(stats.circuits || {}).filter(([, c]) => c.state === 'open');
      const status = openCircuits.length === 0 ? 'healthy' : (openCircuits.length > 2 ? 'critical' : 'degraded');
      return { status, details: { openCircuits: openCircuits.length, totalCircuits: Object.keys(stats.circuits || {}).length } };
    }, [
      { condition: 'degraded', action: HealingAction.RESTART, priority: 1, handler: () => { this.#s.circuitBreaker.reset?.(); } },
      { condition: 'critical', action: HealingAction.RESTART, priority: 1, handler: () => { this.#s.circuitBreaker.reset?.(); } },
    ]);
    this.#s.selfHealing.registerModule('budgetTracker', async () => {
      if (!this.#s.budget) return { status: 'healthy', details: { noBudget: true } };
      const status = this.#s.budget.getStatus?.() || {};
      return { status: status.exceeded ? 'critical' : 'healthy', details: { exceeded: status.exceeded || false, reason: status.reason } };
    }, [
      { condition: 'critical', action: HealingAction.ALERT, priority: 1, handler: () => {} },
    ]);
    this.#s.selfHealing.registerModule('taskQueue', async () => {
      const overloaded = this.#s.queue.length >= this.#s.maxConcurrent * 10;
      const stuck = this.#s.queue.some(e => (Date.now() - e.enqueuedAt) > 300000);
      return { status: overloaded ? 'critical' : (stuck ? 'degraded' : 'healthy'), details: { queueDepth: this.#s.queue.length, maxConcurrent: this.#s.maxConcurrent } };
    }, [
      { condition: 'degraded', action: HealingAction.CLEAR_STATE, priority: 1, handler: () => { const now = Date.now(); this.#s.queue = this.#s.queue.filter(e => (now - e.enqueuedAt) < 300000); } },
      { condition: 'critical', action: HealingAction.CLEAR_STATE, priority: 1, handler: () => { const now = Date.now(); this.#s.queue = this.#s.queue.filter(e => (now - e.enqueuedAt) < 300000); } },
    ]);
    this.#s.selfHealing.registerModule('activeWorkers', async () => {
      const overloaded = this.#s.activeWorkers.size > this.#s.maxConcurrent * 2;
      const busy = this.#s.activeWorkers.size > this.#s.maxConcurrent;
      return { status: overloaded ? 'critical' : (busy ? 'degraded' : 'healthy'), details: { active: this.#s.activeWorkers.size, maxConcurrent: this.#s.maxConcurrent } };
    }, [
      { condition: 'degraded', action: HealingAction.ALERT, priority: 1, handler: () => {} },
      { condition: 'critical', action: HealingAction.RESTART, priority: 1, handler: () => { this.#s.activeWorkers.clear(); } },
    ]);
    this.#s.selfHealing.start();

    // A3: 孤儿任务检测定时器
    this.#s.orphanCheckInterval = setInterval(() => {
      this.#reapOrphanTasks().catch((err) => {
        console.error('[forge:pool] Orphan task reaper error:', err);
      });
    }, this.#s.orphanCheckIntervalMs);
    this.#s.orphanCheckInterval?.unref?.(); // Don't block process exit

    // P9: Register modules with graceful degradation
    const _gdDisabled = new Set();
    const _gdHandlers = (name, isEnabledFn) => ({
      disable: () => _gdDisabled.add(name),
      enable: () => _gdDisabled.delete(name),
      isEnabled: () => !_gdDisabled.has(name) && isEnabledFn(),
    });
    this.#s.gracefulDegradation.registerModule('codeIntel', ModulePriority.MEDIUM, _gdHandlers('codeIntel', () => this.#s.options.enableCodeIntel));
    this.#s.gracefulDegradation.registerModule('verification', ModulePriority.HIGH, _gdHandlers('verification', () => this.#s.options.enableVerification));
    this.#s.gracefulDegradation.registerModule('tracing', ModulePriority.LOW, _gdHandlers('tracing', () => !!this.#s.tracing));
    this.#s.gracefulDegradation.registerModule('checkpoint', ModulePriority.MEDIUM, _gdHandlers('checkpoint', () => true));
    this.#s.gracefulDegradation.registerModule('impactAnalysis', ModulePriority.LOW, _gdHandlers('impactAnalysis', () => true));
    this.#s.gracefulDegradation.registerModule('multiAgentReview', ModulePriority.OPTIONAL, _gdHandlers('multiAgentReview', () => true));
    this.#s.gracefulDegradation.registerModule('semanticEnrichment', ModulePriority.LOW, _gdHandlers('semanticEnrichment', () => true));
    this.#s.gracefulDegradation.registerModule('crossSessionStorage', ModulePriority.OPTIONAL, _gdHandlers('crossSessionStorage', () => true));
  }

  // ── Public API: thin delegation wrappers ──

  async submitGoal(goalId, userId, opts) {
    return _submitGoal(this.#s, goalId, userId, opts || {}, () => this.#processQueue());
  }

  async #processQueue() {
    return _processQueue(this.#s, {
      executeWorkerFn: (aid, entry, worker, task) => this.#executeWorker(aid, entry, worker, task),
      checkGoalCompletionFn: (gid) => this.#checkGoalCompletion(gid),
      cleanupAssignmentFn: (aid) => this.#cleanupAssignment(aid),
    });
  }

  async #executeWorker(assignmentId, entry, worker, task) {
    return _executeWorker(this.#s, assignmentId, entry, worker, task, {
      cleanupAssignmentFn: (aid) => this.#cleanupAssignment(aid),
      enqueueNewlyReadyTasksFn: (gid, uid) => this.#enqueueNewlyReadyTasks(gid, uid),
      checkGoalCompletionFn: (gid) => this.#checkGoalCompletion(gid),
      processQueueFn: () => this.#processQueue(),
    });
  }

  #enqueueNewlyReadyTasks(goalId, userId) {
    return _enqueueNewlyReadyTasks(this.#s, goalId, userId);
  }

  #checkGoalCompletion(goalId) {
    return _checkGoalCompletion(this.#s, goalId);
  }

  #cleanupAssignment(assignmentId) {
    this.#s.activeWorkers.delete(assignmentId);
  }

  async #reapOrphanTasks() {
    return _reapOrphanTasks(this.#s);
  }

  getStatus() { return _getStatus(this.#s, this); }
  getMetrics() { return _getMetrics(this.#s); }
  getPlugins() { return _getPlugins(this.#s); }
  getResilience() { return _getResilience(this.#s); }
  getSelfLoop() { return _getSelfLoop(this.#s); }
  getCostCalculator() { return _getCostCalculator(this.#s); }
  getDeadLetterQueue() { return _getDeadLetterQueue(this.#s); }
  getProgressEstimator() { return _getProgressEstimator(this.#s); }
  getMemoryEngine() { return _getMemoryEngine(this.#s); }
  getGoalProgress(goalId) { return _getGoalProgress(this.#s, goalId); }
  getGoalBudget(goalId) { return _getGoalBudget(this.#s, goalId); }
  getTracing() { return _getTracing(this.#s); }
  getTracingManager() { return _getTracingManager(this.#s); }

  cancelGoal(goalId) { return _cancelGoal(this.#s, goalId); }

  resumeGoal(goalId, userId = 'system') {
    return _resumeGoal(this.#s, goalId, userId, (gid, uid) => this.submitGoal(gid, uid));
  }

  async recoverInterruptedGoals(userId = 'system') {
    return _recoverInterruptedGoals(this.#s, userId, (gid, uid) => this.resumeGoal(gid, uid));
  }

  on(event, callback) { this.#s.eventEmitter.on(event, callback); return this; }
  once(event, callback) { this.#s.eventEmitter.once(event, callback); return this; }
  off(event, callback) { this.#s.eventEmitter.off(event, callback); return this; }

  async shutdown(opts) { return _shutdown(this.#s, opts); }
}
