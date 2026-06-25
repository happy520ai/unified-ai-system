/**
 * SelfLoopEngine — autonomous feedback loop for task execution.
 *
 * Orchestrates five self-* capabilities:
 *   1. 自循环 (Self-Loop)   — verify → decide → act cycle after each mutation
 *   2. 自调整 (Self-Adjust) — dynamically tune prompt, retries, tier based on failure patterns
 *   3. 自验证 (Self-Verify) — multi-tier verification with escalation
 *   4. 自回滚 (Self-Rollback) — file-level snapshot & restore on failure
 *   5. 自进化 (Self-Evolve) — learn from outcomes via StrategyEvolution
 *
 * Integration: AgentPoolManager calls `handlePostExecution()` after a worker completes.
 * The engine returns a decision: ACCEPT, ADJUST_RETRY, ROLLBACK_RETRY, or ESCALATE.
 *
 * Usage:
 *   const engine = new SelfLoopEngine({ verifier, store, evolution, projectRoot });
 *   const snapshot = await engine.snapshotBefore(projectRoot, filesModified);
 *   const decision = await engine.handlePostExecution(goalId, task, result, context);
 *   if (decision.action === 'ROLLBACK_RETRY') {
 *     await engine.rollback(snapshot);
 *   }
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import {
  Decision,
  MAX_LOOPS,
  DEFAULT_TIER,
  MAX_ERROR_LOOPS,
  ERROR_STRATEGY_MAP,
  classifyFailures as _classifyFailures,
  buildFailureHint as _buildFailureHint,
  classifyError as _classifyError,
  computeErrorAdjustments as _computeErrorAdjustments,
  computeAdjustments as _computeAdjustments,
  createSnapshot as _createSnapshot,
  restoreSnapshot as _restoreSnapshot,
} from './helpers.js';

// Re-export Decision for backward compatibility
export { Decision };

export class SelfLoopEngine {
  #verifier;
  #store;
  #evolution;
  #projectRoot;
  #config;

  /**
   * In-memory snapshot store: Map<snapshotId, { files: Map<path, content|null> }>
   * null content means the file did not exist before (was newly created).
   * @type {Map<string, object>}
   */
  #snapshots = new Map();

  /**
   * Per-goal loop state tracking.
   * @type {Map<string, { loopCount: number, strategy: string, adjustedParams: object, history: Array<object> }>}
   */
  #loopState = new Map();

  /** Maximum self-loop iterations per task (prevents infinite loops) */
  static MAX_LOOPS = MAX_LOOPS;

  /** Default verification tier to start with */
  static DEFAULT_TIER = DEFAULT_TIER;

  /**
   * @param {object} opts
   * @param {import('../verification/index.js').VerificationEngine} opts.verifier
   * @param {import('../task-store/index.js').TaskStore} opts.store
   * @param {import('./strategy-evolution.js').StrategyEvolution} opts.evolution
   * @param {string} opts.projectRoot
   * @param {object} [opts.config] — { maxLoops, defaultTier, rollbackEnabled }
   */
  constructor({ verifier, store, evolution, projectRoot, config }) {
    this.#verifier = verifier;
    this.#store = store;
    this.#evolution = evolution;
    this.#projectRoot = projectRoot;
    this.#config = config || {};
  }

  // ── 1. 自验证 (Self-Verify) ─────────────────────────────────────────────

  /**
   * Run verification at the appropriate tier, with optional escalation.
   *
   * @param {string} goalId
   * @param {string} taskId
   * @param {object} opts — { filesModified, loopCount, previousTier }
   * @returns {{ passed: boolean, tier: number, failures: Array, escalated: boolean }}
   */
  async verify(goalId, taskId, { filesModified = [], loopCount = 0, previousTier = 0 } = {}) {
    // Escalation logic: if previous attempt failed at tier N, try tier N+1
    // to get deeper diagnostics (e.g., tier 1 = lint, tier 2 = tests)
    let maxTier = this.#config.defaultTier ?? SelfLoopEngine.DEFAULT_TIER;

    // If we've looped more than once, escalate to a higher tier for deeper checks
    if (loopCount >= 2 && maxTier < 3) {
      maxTier = 3; // escalate to integration tests
    }

    if (!this.#verifier) {
      return { passed: true, tier: 0, failures: [], escalated: false };
    }

    try {
      const result = await this.#verifier.verifyAfterMutation(
        goalId, taskId,
        { filesModified, maxTier }
      );

      const escalated = maxTier > (this.#config.defaultTier ?? SelfLoopEngine.DEFAULT_TIER);
      const passed = result.overall !== 'FAIL';

      return {
        passed,
        tier: maxTier,
        failures: result.failures || [],
        escalated,
        summary: result.summary,
        raw: result,
      };
    } catch (err) {
      console.log(`[forge:self-loop] Verification engine error: ${err.message}`);
      return { passed: true, tier: maxTier, failures: [], escalated: false, error: err.message };
    }
  }

  // ── 2. 自回滚 (Self-Rollback) ───────────────────────────────────────────

  /**
   * Create a file-level snapshot before mutation, enabling precise rollback.
   * Unlike CheckpointManager (which uses git), this captures exact file contents.
   *
   * @param {string} projectRoot
   * @param {string[]} filePaths — relative paths to snapshot
   * @returns {{ snapshotId: string, files: Map<string, string|null> }}
   */
  async snapshotBefore(projectRoot, filePaths) {
    const snapshot = await _createSnapshot(projectRoot, filePaths);
    this.#snapshots.set(snapshot.snapshotId, snapshot);
    console.log(`[forge:self-loop] Snapshot ${snapshot.snapshotId}: ${snapshot.files.size} file(s) captured`);
    return snapshot;
  }

  /**
   * Restore files to their pre-mutation state from a snapshot.
   * Files that didn't exist before are deleted; files that existed are restored.
   *
   * @param {object} snapshot — returned by snapshotBefore()
   * @param {string} [projectRoot] — override project root
   * @returns {{ restored: number, deleted: number, errors: string[] }}
   */
  async rollback(snapshot, projectRoot) {
    const root = projectRoot || this.#projectRoot;
    const result = await _restoreSnapshot(snapshot, root);
    this.#snapshots.delete(snapshot.snapshotId);
    console.log(`[forge:self-loop] Rollback complete: ${result.restored} restored, ${result.deleted} deleted, ${result.errors.length} errors`);
    return result;
  }

  // ── 3. 自调整 (Self-Adjust) ─────────────────────────────────────────────

  /**
   * Build adjusted parameters for the next retry based on failure patterns.
   *
   * @param {object} context
   * @param {string} context.taskType — 'implement', 'test', 'refactor', 'debug'
   * @param {Array} context.failures — verification failures
   * @param {number} context.loopCount — current loop iteration (0-based)
   * @param {string} context.previousStrategy — what was tried last
   * @returns {{ promptHints: string, maxTokens: number, responseFormat: string, workerType: string|null }}
   */
  computeAdjustments(context) {
    return _computeAdjustments(context);
  }

  // ── 4. 自循环 (Self-Loop Decision) ──────────────────────────────────────

  /**
   * Main decision point: after task execution + verification, decide what to do next.
   *
   * @param {string} goalId
   * @param {object} task — the task that was executed
   * @param {object} result — worker execution result
   * @param {object} [context] — { userId, snapshot, verifyResult }
   * @returns {{ action: string, reason: string, adjustments?: object, snapshot?: object }}
   */
  async handlePostExecution(goalId, task, result, context = {}) {
    const taskKey = `${goalId}:${task.id}`;

    // Initialize or get loop state
    if (!this.#loopState.has(taskKey)) {
      this.#loopState.set(taskKey, {
        loopCount: 0,
        strategy: 'targeted_fix',
        adjustedParams: {},
        history: [],
      });
    }
    const state = this.#loopState.get(taskKey);

    // If task failed (worker-level), enter ERROR_LOOP instead of blindly accepting
    if (!result.success) {
      return this.handleErrorLoop(goalId, task, result, context, state);
    }

    // If verification passed, accept and record success
    const verifyResult = context.verifyResult;
    if (!verifyResult || verifyResult.passed) {
      // Record success in evolution engine
      this.#evolution?.recordOutcome({
        taskType: task.type,
        strategy: state.strategy,
        loopCount: state.loopCount,
        success: true,
        goalId,
        taskId: task.id,
      });
      this.#loopState.delete(taskKey); // clean up
      return { action: Decision.ACCEPT, reason: 'Verification passed' };
    }

    // Verification failed — enter self-loop
    const maxLoops = this.#config.maxLoops ?? SelfLoopEngine.MAX_LOOPS;

    if (state.loopCount >= maxLoops) {
      // Exhausted all loop iterations
      this.#evolution?.recordOutcome({
        taskType: task.type,
        strategy: state.strategy,
        loopCount: state.loopCount,
        success: false,
        goalId,
        taskId: task.id,
      });
      this.#loopState.delete(taskKey);
      return {
        action: Decision.EXHAUSTED,
        reason: `Self-loop exhausted after ${maxLoops} iterations`,
        failures: verifyResult.failures,
      };
    }

    // Record this iteration in history
    state.history.push({
      loop: state.loopCount,
      strategy: state.strategy,
      failures: verifyResult.failures?.length || 0,
      timestamp: Date.now(),
    });

    // Compute adjustments for next attempt
    const adjustments = this.computeAdjustments({
      taskType: task.type,
      failures: verifyResult.failures || [],
      loopCount: state.loopCount,
      previousStrategy: state.strategy,
    });

    // Inject learned insights from evolution engine (自适应 Prompt)
    if (this.#evolution) {
      const insights = this.#evolution.getInsights(task.type);
      if (insights.length > 0) {
        adjustments.promptHints += '\n\n## Learned Constraints (from past executions)\n';
        for (const insight of insights.slice(0, 5)) {
          adjustments.promptHints += `- ${insight}\n`;
        }
      }
    }

    // Decide: rollback + retry vs. adjust + retry
    let action;
    let nextStrategy;

    if (state.loopCount >= 2 && context.snapshot) {
      // After 2 failed attempts, rollback and try a completely different approach
      action = Decision.ROLLBACK_RETRY;
      nextStrategy = this.#evolution?.selectStrategy(task.type, 'rollback_retry') || 'rollback_retry';
    } else {
      action = Decision.ADJUST_RETRY;
      nextStrategy = this.#evolution?.selectStrategy(task.type, state.strategy) || 'targeted_fix';
    }

    // Escalate to debugger if adjustments suggest it
    if (adjustments.workerType === 'debugger' && state.loopCount >= 2) {
      action = Decision.ESCALATE;
      nextStrategy = 'debugger_escalation';
    }

    // Update state
    state.loopCount++;
    state.strategy = nextStrategy;
    state.adjustedParams = adjustments;

    this.#store?.logEvent(goalId, task.id, 'self_loop_decision', {
      action,
      strategy: nextStrategy,
      loopCount: state.loopCount,
      failures: verifyResult.failures?.length || 0,
    });

    return {
      action,
      reason: `${action} at loop ${state.loopCount}/${maxLoops}: ${verifyResult.failures?.length || 0} failure(s)`,
      adjustments,
      snapshot: context.snapshot,
      strategy: nextStrategy,
      loopCount: state.loopCount,
    };
  }

  /**
   * Clean up loop state for a goal (call when goal completes or is cancelled).
   * @param {string} goalId
   */
  cleanup(goalId) {
    for (const [key] of this.#loopState) {
      if (key.startsWith(`${goalId}:`)) {
        this.#loopState.delete(key);
      }
    }
  }

  /**
   * Get current self-loop status for a goal.
   * @param {string} goalId
   * @returns {Array<{ taskId: string, loopCount: number, strategy: string, history: Array }>}
   */
  getStatus(goalId) {
    const result = [];
    for (const [key, state] of this.#loopState) {
      if (key.startsWith(`${goalId}:`)) {
        const taskId = key.split(':')[1];
        result.push({
          taskId,
          loopCount: state.loopCount,
          strategy: state.strategy,
          history: state.history,
        });
      }
    }
    return result;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  // ===========================================================================
  // M7: ERROR_LOOP 集成 — 当 worker 执行出错时进入错误循环
  // ===========================================================================

  /** 错误循环的最大尝试次数(独立于验证循环) */
  static MAX_ERROR_LOOPS = MAX_ERROR_LOOPS;

  /** 错误类型 → 推荐策略映射 */
  static ERROR_STRATEGY_MAP = ERROR_STRATEGY_MAP;

  /**
   * 处理 worker 执行错误 — 进入 ERROR_LOOP
   *
   * 当 worker 执行失败时(非验证失败,而是执行本身抛出异常),
   * 根据错误类型选择恢复策略:
   *   - timeout → 增加超时后重试
   *   - rate_limit → 退避后重试
   *   - auth_error → 直接升级(无法自动恢复)
   *   - network → 网络退避重试
   *   - parse_error → 简化 prompt 后重试
   *   - unknown → 目标修复
   *
   * @param {string} goalId
   * @param {Object} task
   * @param {Object} result - 失败的执行结果
   * @param {Object} context
   * @param {Object} state - 循环状态
   * @returns {Object} 决策 { action, reason, adjustments, errorType, strategy }
   */
  async handleErrorLoop(goalId, task, result, context = {}, state) {
    const errorType = _classifyError(result.error || result.message || '');
    const maxErrorLoops = this.#config.maxErrorLoops ?? SelfLoopEngine.MAX_ERROR_LOOPS;

    // 更新错误循环计数
    state.errorLoopCount = (state.errorLoopCount || 0) + 1;

    // 记录错误到进化引擎
    this.#evolution?.recordOutcome({
      taskType: task.type,
      strategy: 'error_loop',
      loopCount: state.errorLoopCount,
      success: false,
      errorType,
      goalId,
      taskId: task.id,
    });

    // 记录到历史
    state.history.push({
      loop: state.errorLoopCount,
      type: 'error_loop',
      errorType,
      error: (result.error || result.message || '').slice(0, 300),
      timestamp: Date.now(),
    });

    this.#store?.logEvent(goalId, task.id, 'error_loop', {
      errorType,
      loopCount: state.errorLoopCount,
      maxLoops: maxErrorLoops,
      error: (result.error || result.message || '').slice(0, 500),
    });

    // 超过最大错误循环次数 → 耗尽
    if (state.errorLoopCount >= maxErrorLoops) {
      return {
        action: Decision.EXHAUSTED,
        reason: `Error-loop exhausted after ${maxErrorLoops} attempts (type: ${errorType})`,
        errorType,
        error: result.error || result.message,
        strategy: 'exhausted',
      };
    }

    // 根据错误类型选择策略
    const strategy = SelfLoopEngine.ERROR_STRATEGY_MAP[errorType] || 'targeted_fix';
    const adjustments = _computeErrorAdjustments(errorType, result, state.errorLoopCount, context);

    // auth_error 无法自动恢复,直接升级
    if (errorType === 'auth_error') {
      return {
        action: Decision.ESCALATE,
        reason: `Authentication error cannot be auto-recovered: ${result.error || result.message}`,
        errorType,
        adjustments,
        strategy: 'escalate_auth',
      };
    }

    // 决定动作
    let action;
    if (errorType === 'timeout' || errorType === 'network') {
      // 超时/网络错误:调整参数后重试
      action = Decision.ADJUST_RETRY;
    } else if (errorType === 'rate_limit') {
      // 限流:退避后重试
      action = Decision.ADJUST_RETRY;
      adjustments.backoffMs = Math.min(30000, 2000 * Math.pow(2, state.errorLoopCount));
    } else if (errorType === 'parse_error') {
      // 解析错误:简化 prompt 后重试,可能需要 debugger
      action = state.errorLoopCount >= 2 ? Decision.ESCALATE : Decision.ADJUST_RETRY;
      adjustments.workerType = 'debugger';
    } else {
      // 未知错误:2 次后升级到 debugger
      action = state.errorLoopCount >= 2 ? Decision.ESCALATE : Decision.ADJUST_RETRY;
      if (action === Decision.ESCALATE) {
        adjustments.workerType = 'debugger';
      }
    }

    return {
      action,
      reason: `Error-loop ${state.errorLoopCount}/${maxErrorLoops}: ${errorType} → ${strategy}`,
      errorType,
      adjustments,
      strategy,
      error: result.error || result.message,
      loopCount: state.errorLoopCount,
    };
  }
}
