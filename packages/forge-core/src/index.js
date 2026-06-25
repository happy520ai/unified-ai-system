/**
 * Forge Core — main entry point.
 *
 * Usage (standalone):
 *   import { Forge } from '@unified-ai-system/forge-core';
 *   const forge = new Forge({ projectRoot: '/path/to/project' });
 *   const result = await forge.run('Add JWT authentication to the user module');
 *
 * Usage (gateway integration):
 *   import { createForgeRouteHandlers, matchForgeRoute } from '@unified-ai-system/forge-core';
 *   const handlers = createForgeRouteHandlers({ forge, agentPool, ... });
 */

import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { TaskStore } from './task-store/index.js';
import { compileGoal } from './goal-compiler/index.js';
import { compileGoalV2 } from './goal-refiner/index.js';
import { Orchestrator } from './orchestrator/index.js';
import { ProgressReporter } from './progress-reporter/index.js';
import { GatewayLifecycle } from './gateway-lifecycle/index.js';
import { setP11Cache, setP11TokenPredictor, setP11BudgetEnforcer } from './llm-client.js';
import { LLMCache } from './llm-cache/index.js';
import { TokenPredictor } from './token-predictor/index.js';
import { BudgetEnforcer } from './budget-enforcer/index.js';
import { createSkillRegistry, createSkillRouter } from './skills/index.js';

export class Forge {
  #store;
  #projectRoot;
  #dbPath;
  #pool = null; // AgentPoolManager (optional, set via attachPool)
  #progressReporter = null; // P10: ProgressReporter (optional)
  #gatewayLifecycle = null; // Gateway: lifecycle manager (optional)
  #skillRegistry = null; // Skill marketplace (GitHub skill discovery/install/execute)
  #skillRouter = null;   // Skill timing router (decides when to use skills vs built-in workers)

  /**
   * @param {object} options
   * @param {string} options.projectRoot — absolute path to the target project
   * @param {string} [options.dbPath] — path to SQLite database (default: .forge/forge.db)
   * @param {boolean} [options.enableProgress] — enable ProgressReporter (default: false)
   * @param {string} [options.gatewayUrl] — AI Gateway URL (default: http://127.0.0.1:3100)
   * @param {boolean} [options.enableCostTracking] — enable P11 cost modules (default: true)
   */
  constructor({ projectRoot, dbPath, enableProgress, gatewayUrl, enableCostTracking = true }) {
    this.#projectRoot = projectRoot;
    this.#dbPath = dbPath ?? join(projectRoot, '.forge', 'forge.db');

    // Ensure .forge directory exists
    mkdirSync(join(projectRoot, '.forge'), { recursive: true });

    this.#store = new TaskStore(this.#dbPath);

    // P10: Initialize progress reporter if requested
    if (enableProgress) {
      this.#progressReporter = new ProgressReporter();
    }

    // Gateway: Initialize lifecycle manager
    this.#gatewayLifecycle = new GatewayLifecycle({ gatewayUrl });

    // P11: Wire cost tracking modules into llm-client for all LLM calls
    if (enableCostTracking) {
      const cache = new LLMCache({ maxSize: 500, enableFuzzyMatch: true });
      const predictor = new TokenPredictor();
      const enforcer = new BudgetEnforcer({ defaultBudget: { maxTokens: 1_000_000, maxCost: 10.0 } });
      enforcer.registerGoal('default', { maxTokens: 1_000_000, maxCost: 10.0 });

      setP11Cache(cache);
      setP11TokenPredictor(predictor);
      setP11BudgetEnforcer(enforcer);
    }

    // Skill marketplace: GitHub skill discovery + install + execute
    this.#skillRegistry = createSkillRegistry({
      skillsDir: join(projectRoot, '.forge', 'skills'),
    });

    // Skill router: decides WHEN each task should use a skill vs a built-in worker.
    // Sits between goal-compiler and agent-pool.
    this.#skillRouter = createSkillRouter({
      skillRegistry: this.#skillRegistry,
      logger: console,
    });
  }

  /**
   * Get the skill registry (search GitHub / install / execute skills on demand).
   * This is what makes forge infinitely extensible beyond its 7 built-in workers.
   */
  getSkills() {
    return this.#skillRegistry;
  }

  /**
   * Get the skill router (decides WHEN each task should use a skill vs built-in worker).
   * Sits between goal-compiler and agent-pool.
   */
  getSkillRouter() {
    return this.#skillRouter;
  }

  /**
   * Attach an AgentPoolManager for pool-based multi-goal execution.
   * When attached, submitGoal() will use the pool instead of creating individual Orchestrators.
   * @param {import('./agent-pool/index.js').AgentPoolManager} pool
   */
  attachPool(pool) {
    this.#pool = pool;
  }

  /**
   * Run a goal end-to-end: compile → execute → verify.
   * Uses Orchestrator for single-goal execution (CLI mode).
   * @param {string} goalText — natural language goal
   * @param {object} [options] — execution options
   * @returns {object} — execution report
   */
  async run(goalText, options = {}) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  FORGE — Goal: "${goalText}"`);
    console.log(`${'═'.repeat(60)}\n`);

    // Step 1: Compile the goal into a Task DAG (use enhanced refiner if requested)
    console.log('[forge] Step 1: Compiling goal...');
    const compiler = options.useRefiner ? compileGoalV2 : compileGoal;
    const { goalId, taskCount, summary } = await compiler(this.#store, {
      goalText,
      projectRoot: this.#projectRoot,
    });
    console.log(`[forge] Compiled: ${taskCount} tasks — ${summary}\n`);

    // P10: Start progress tracking if enabled
    if (this.#progressReporter) {
      this.#progressReporter.startGoal(goalId, taskCount, goalText);
    }

    // Step 2: Execute the DAG
    console.log('[forge] Step 2: Executing task DAG...');
    const orchestrator = new Orchestrator(this.#store, this.#projectRoot, {
      checkpointAfter: options.checkpointAfter ?? [],
      maxConcurrent: options.maxConcurrent ?? 2,
      budget: options.budget ?? {},
      enableCodeIntel: options.enableCodeIntel ?? true,
      progressReporter: this.#progressReporter, // P10: wire progress reporter
    });

    const report = await orchestrator.execute(goalId);

    // P10: Finalize progress
    if (this.#progressReporter) {
      this.#progressReporter.goalCompleted(goalId, report.status);
      console.log(this.#progressReporter.formatSummary(goalId));
    }

    // Step 3: Print summary
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  RESULT: ${report.status.toUpperCase()}`);
    console.log(`  Tasks: ${report.completedTasks} completed, ${report.failedTasks} failed`);
    console.log(`  Time:  ${report.durationHuman}`);
    if (report.budget) {
      console.log(`  Budget: ${report.budget.tokensUsed} tokens, $${(report.budget.costIncurred || 0).toFixed(4)}`);
    }
    console.log(`${'─'.repeat(60)}\n`);

    return report;
  }

  /**
   * Submit a goal for pool-based execution: compile → submit to AgentPoolManager.
   * Returns immediately with the goalId; the goal executes asynchronously in the shared pool.
   * This enables multiple goals to run in parallel with global resource management.
   *
   * @param {string} goalText — natural language goal
   * @param {object} [options] — { userId, priority }
   * @returns {Promise<{ goalId: string, status: string, completedTasks: number, failedTasks: number, totalTasks: number }>}
   */
  async submitGoal(goalText, options = {}) {
    if (!this.#pool) {
      throw new Error('No AgentPoolManager attached. Call forge.attachPool(pool) first, or use forge.run() for single-goal execution.');
    }

    const userId = options.userId ?? 'system';

    console.log(`\n[forge:pool] Compiling goal: "${goalText.substring(0, 80)}..."`);
    const { goalId, taskCount, summary } = await compileGoal(this.#store, {
      goalText,
      projectRoot: this.#projectRoot,
    });
    console.log(`[forge:pool] Compiled ${goalId}: ${taskCount} tasks — ${summary}`);

    // Update goal status to 'compiled'
    this.#store.updateGoalStatus(goalId, 'compiled');

    // Submit to the pool for async execution
    const poolPromise = this.#pool.submitGoal(goalId, userId);

    // Update status to running
    this.#store.updateGoalStatus(goalId, 'running');

    return poolPromise;
  }

  /**
   * Resume a previously started goal from where it was interrupted.
   * Uses pool-based execution if available, otherwise falls back to Orchestrator.
   */
  async resume(goalId, options = {}) {
    const goal = this.#store.getGoal(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found`);

    console.log(`\n[forge] Resuming goal ${goalId}: "${goal.text}"`);

    // Use pool-based resume if available
    if (this.#pool) {
      const userId = options.userId ?? 'system';
      return this.#pool.resumeGoal(goalId, userId);
    }

    // Fallback to Orchestrator
    const orchestrator = new Orchestrator(this.#store, this.#projectRoot);
    return orchestrator.execute(goalId);
  }

  /**
   * Recover all interrupted goals after a server restart.
   * Finds goals in 'running' status and resumes them via the pool.
   *
   * @returns {Promise<string[]>} — list of recovered goal IDs
   */
  async recoverGoals() {
    if (!this.#pool) {
      console.log('[forge] No pool attached, skipping goal recovery');
      return [];
    }
    return this.#pool.recoverInterruptedGoals();
  }

  /**
   * List all goals.
   */
  listGoals(options = {}) {
    return this.#store.listGoals(options);
  }

  /**
   * Get detailed status of a goal.
   */
  getStatus(goalId) {
    const goal = this.#store.getGoal(goalId);
    if (!goal) return null;
    const tasks = this.#store.getTasksForGoal(goalId);
    const events = this.#store.getEvents(goalId, { limit: 20 });
    return { goal, tasks, recentEvents: events };
  }

  /**
   * Access the underlying TaskStore (for API server, pool manager, etc.)
   */
  get store() {
    return this.#store;
  }

  /**
   * Access the ProgressReporter (P10) for external event subscriptions.
   */
  get progressReporter() {
    return this.#progressReporter;
  }

  // ---------------------------------------------------------------------------
  // Gateway Integration
  // ---------------------------------------------------------------------------

  /**
   * Connect to the AI Gateway: health check → provider list → log status.
   * Called automatically before goal execution in run().
   *
   * @returns {Promise<object>} — gateway status
   */
  async connectGateway() {
    if (!this.#gatewayLifecycle) {
      throw new Error('No GatewayLifecycle initialized');
    }

    console.log(`\n[forge:gateway] Connecting to ${this.#gatewayLifecycle.gatewayUrl}...`);
    const status = await this.#gatewayLifecycle.connect();

    if (status.connected) {
      console.log(`[forge:gateway] ✓ Connected (${status.health?.latency ?? '?'}ms)`);
      if (status.providers?.length > 0) {
        const withKeys = status.providers.filter(p => p.hasCredential || p.hasApiKey).length;
        console.log(`[forge:gateway]   ${status.providers.length} providers, ${withKeys} with API keys`);
      }
    } else {
      console.log(`[forge:gateway] ✗ Unreachable: ${status.error}`);
      console.log(`[forge:gateway]   LLM calls will fall back to direct API mode`);
    }

    return status;
  }

  /**
   * Get current gateway status snapshot.
   * @returns {object} — gateway status
   */
  getGatewayStatus() {
    return this.#gatewayLifecycle?.getStatus() || { connected: false };
  }

  /**
   * Set a runtime API key for a provider via the gateway.
   * The key is stored in gateway memory only — never persisted to disk.
   *
   * @param {string} providerId — e.g. 'openai', 'anthropic', 'dashscope'
   * @param {string} apiKey — the API key value
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async setApiKey(providerId, apiKey) {
    if (!this.#gatewayLifecycle) {
      throw new Error('No GatewayLifecycle initialized');
    }
    return this.#gatewayLifecycle.setApiKey(providerId, apiKey);
  }

  /**
   * Access the GatewayLifecycle instance for advanced operations.
   */
  get gateway() {
    return this.#gatewayLifecycle;
  }

  /**
   * Close the database connection.
   */
  close() {
    this.#store.close();
  }
}

// Re-export components for direct usage
// Phase 1-3: Core engine
export { TaskStore } from './task-store/index.js';
export { compileGoal } from './goal-compiler/index.js';
export { Orchestrator } from './orchestrator/index.js';
export { CheckpointManager } from './checkpoint/index.js';
export { VerificationEngine } from './verification/index.js';
export { CoderWorker, ArchitectWorker, CodeArchaeologistWorker } from './worker/coder.js';
export { TesterWorker, VerifierWorker } from './worker/tester.js';
export { ReviewerWorker } from './worker/reviewer.js';
export { DebuggerWorker } from './worker/debugger.js';
export { WebWorker } from './worker/web.js';
export { createSkillRegistry, createSkillRouter, parseSkillManifest, buildSkillManifest, searchSkills, installSkill, scanForForbidden } from './skills/index.js';
export { BudgetTracker } from './budget-tracker/index.js';
export { ContextEngine } from './context-engine/index.js';
export { CodebaseSearch } from './codebase-search/index.js';
export { CodeIntelligence } from './code-intel/index.js';
export { callLLM, callLLMWithUsage, callLLMDirect, callLLMDirectWithUsage, callLLMStream, setProviderRegistry, getProviderRegistry, setP11Cache, setP11TokenPredictor, setP11BudgetEnforcer, getP11Cache, getP11TokenPredictor, getP11BudgetEnforcer, clearLLMCache, getLLMCacheSize } from './llm-client.js';
// Phase 4: Collaborative evolution
export { AgentPoolManager } from './agent-pool/index.js';
export { GoalTransfer } from './export-import/index.js';
export { KnowledgeBase } from './knowledge/index.js';
export { GatewayBridge } from './gateway-bridge/index.js';
export { UserManager } from './multi-user/index.js';
export { ForgeServer } from './api-server/index.js';
export { WebSocketHandler } from './websocket/index.js';

// Phase 8-10: Observability & configuration
export { ForgeConfig } from './config/index.js';
export { MetricsCollector } from './metrics/index.js';

// Phase 11: Plugin system
export { PluginManager, LoggerPlugin, AuditPlugin, RateLimitPlugin } from './plugins/index.js';

// Phase 12: Fault tolerance & resilience
export { CircuitBreaker, AdaptiveTimeout, retryWithBackoff, isTransientError } from './resilience/index.js';

// Phase 13: Distributed tracing
export { TraceManager, Span, runWithTrace, getTraceContext } from './tracing/index.js';

// Memory Engine — three-tier infinite memory system
export { MemoryEngine, MemoryType, MemoryTier } from './memory-engine/index.js';

// P6: Advanced intelligence modules
export { SemanticMemory } from './semantic-memory/index.js';
export { PromptRegistry } from './prompt-registry/index.js';
export { KnowledgeGraph } from './knowledge-graph/index.js';
export { CostAttribution } from './cost-attribution/index.js';
export { DecisionTrace } from './decision-trace/index.js';
export { HealthDashboard } from './health-dashboard/index.js';
export { AdaptiveScaling } from './adaptive-scaling/index.js';
export { ErrorPatternLearner } from './error-pattern-learner/index.js';

// P7: Advanced review, sandbox, streaming, and defense
export { MultiAgentReview, ReviewSeverity, ReviewCategory } from './multi-agent-review/index.js';
export { SandboxExecutor, SandboxLevel } from './sandbox-executor/index.js';
export { LiveStream, StreamEvent } from './live-stream/index.js';
export { PromptInjectionDefense } from './injection-defense/index.js';

// P8: Self-healing, degradation, cross-session, config hub
export { SelfHealingEngine, HealingAction, HealthLevel } from './self-healing/index.js';
export { GracefulDegradation, ModulePriority, SystemPressure } from './graceful-degradation/index.js';
export { CrossSessionMemory } from './cross-session-memory/index.js';
export { UnifiedConfigHub } from './config-hub/index.js';

// Phase 14: Security hardening
export {
  HttpRateLimiter, applySecurityHeaders, AuditLogger,
  guardPath, sanitizeError, sanitizeValue,
  hashApiKey, verifyApiKey,
} from './security/index.js';

// P9: Benchmark framework for evaluation and scoring
export { BenchmarkSuite, Scorer, runBenchmark, generateReport, compareReports, BENCHMARK_TASKS } from './benchmark/index.js';

// P10: Enhanced goal compilation and real-time progress reporting
export { GoalRefiner, compileGoalV2 } from './goal-refiner/index.js';
export { ProgressReporter } from './progress-reporter/index.js';

// P11: Dashboard and goal templates
export { ForgeDashboard } from './forge-dashboard/index.js';
export { GoalTemplates } from './goal-templates/index.js';

// P11-2: Iterative code refinement and quality gate
export { IterativeRefiner, IssueCategory, Severity } from './iterative-refiner/index.js';
export { QualityGate, CheckSeverity } from './quality-gate/index.js';

// P11-4: LLM caching, token prediction, budget enforcement
export { LLMCache } from './llm-cache/index.js';
export { TokenPredictor } from './token-predictor/index.js';
export { BudgetEnforcer } from './budget-enforcer/index.js';

// P11-3: Inter-agent communication, consensus protocol, dynamic role assignment
export { AgentCommunication, FindingType, MessageType, AgentStatus } from './agent-communication/index.js';
export { ConsensusEngine, ConsensusStrategy, ProposalUrgency, RoundStatus } from './consensus/index.js';
export { DynamicRoleAssigner, TaskType, RolePriority, Complexity } from './dynamic-roles/index.js';

// P11-5: Execution analytics, predictive health, chaos engineering, enhanced retry
export { ExecutionAnalytics } from './execution-analytics/index.js';
export { PredictiveHealth } from './predictive-health/index.js';
export { ChaosEngineer } from './chaos-engineer/index.js';
export { EnhancedRetry } from './enhanced-retry/index.js';

// Gateway: Lifecycle management for AI Gateway integration
export { GatewayLifecycle } from './gateway-lifecycle/index.js';

// Gateway integration modules
export { createForgeRouteHandlers, matchForgeRoute } from './integration/forge-routes.js';
export {
  okResponse, errResponse, forgeRequestId,
  adaptGoal, adaptPoolStatus, adaptMetrics, adaptResilience,
  adaptTracing, adaptSystemStatus, resolveForgePermission,
  FORGE_PERMISSIONS,
} from './integration/bridge.js';
export { ForgeProviderRegistry, createForgeProviderRegistry } from './integration/provider-registry.js';
export { ForgeAuthAdapter } from './integration/auth-adapter.js';
export { ForgeEventAdapter, getForgeEventMap } from './integration/event-adapter.js';

// Multimodal: image, audio, video, embedding generation
export { generateImage, generateEmbedding, synthesizeSpeech, transcribeAudio, generateVideo, setMultimodalGatewayUrl, getMultimodalGatewayUrl, checkGatewayHealth, MultimodalError } from './multimodal-client/index.js';
export { MediaWorker, ImageWorker, EmbeddingWorker, AudioWorker, VideoWorker } from './worker/media.js';

// ── M8: 新增导出(系统无懈可击距离增强) ──────────────────────────────────

// M3: Git Worktree 隔离管理器
export { createGitWorktree } from './sandbox-executor/git-worktree.js';

// M5: LLM 竞速调用 + 熔断器
export {
  callLLMRace,
  getBreakerState,
  resetBreaker,
  getRaceStatus,
} from './llm-client.js';

// M6: Debugger 增强导出
export {
  parseDebuggerOutput,
  ERROR_CATEGORIES as DEBUG_ERROR_CATEGORIES,
} from './worker/debugger.js';

// M7: Self-loop ERROR_LOOP 导出(Decision 已导出,补充错误策略常量)
export { SelfLoopEngine as SelfLoopEngineWithErrorLoop } from './self-loop/index.js';

