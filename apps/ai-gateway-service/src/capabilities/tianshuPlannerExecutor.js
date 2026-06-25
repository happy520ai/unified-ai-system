// =============================================================================
// 天枢规划执行器 (Tianshu Planner Cell Executor)
// Intelligent task decomposition and planning for "Tianshu Mode"
//
// 集成点：
// 1. createPlan       → 分析复杂度 → 分解任务 → 分配提供者 → 构建 DAG
// 2. executePlan      → 按 DAG 拓扑顺序并发执行子任务
// 3. monitorExecution → 实时查询计划执行进度
// =============================================================================

import {
  STATUS, COMPLEXITY_LABELS, PROVIDER_MAPPING,
  shortId, safeJsonParse, elapsedMs,
  buildComplexitySystemPrompt, buildDecomposeSystemPrompt, buildDecomposeUserMsg,
  parseDecomposedTasks, assignProvidersToTasks, computePlanProgress,
} from "./tianshuPlannerConstants.js";

import {
  buildExecutionDAG as buildDAG,
  estimateDAGDuration,
  removeCycles,
} from "./tianshuPlannerDag.js";

import {
  savePlan as savePlanToDisk,
  readPlanFromDisk,
  listPlansFromDisk,
  callGateway,
  executeSubTask,
} from "./tianshuPlannerStorage.js";

// ---------------------------------------------------------------------------
// 主类
// ---------------------------------------------------------------------------

export class TianshuPlannerExecutor {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.maxDecompositionDepth=5]
   * @param {number} [options.maxSubTasks=20]
   * @param {string} [options.planningModel="auto"]
   * @param {string} [options.gatewayUrl]
   */
  constructor(options = {}) {
    this.maxDecompositionDepth = options.maxDecompositionDepth || 5;
    this.maxSubTasks = options.maxSubTasks || 20;
    this.planningModel = options.planningModel || "auto";
    this.gatewayUrl = options.gatewayUrl || "http://127.0.0.1:3100";
    this.planStore = new Map();
    this.executionLog = [];
    this.stats = {
      totalPlans: 0, avgSubTasks: 0, avgDuration: 0, successRate: 0,
      totalExecuted: 0, _totalSubTasks: 0, _totalDuration: 0, _successCount: 0,
    };
  }

  // =========================================================================
  // 1. createPlan — 主入口
  // =========================================================================

  /**
   * 创建执行计划：分析 → 分解 → 分配 → 构建 DAG
   * @param {string} taskDescription
   * @param {Object} [context={}]
   * @returns {Promise<{ planId: string, subTasks: Object[], dag: Object, estimatedDuration: number }>}
   */
  async createPlan(taskDescription, context = {}) {
    if (!taskDescription || typeof taskDescription !== "string") {
      throw new Error("[TianshuPlanner] taskDescription is required and must be a non-empty string");
    }

    const planId = `plan-${shortId()}-${Date.now().toString(36)}`;
    const planStart = process.hrtime();
    this._log("info", `Creating plan ${planId} for task: ${taskDescription.slice(0, 120)}...`);

    const analysis = await this.analyzeComplexity(taskDescription);
    this._log("info", `Complexity analysis: level ${analysis.complexity}, est. ${analysis.estimatedSubTasks} sub-tasks`);

    const subTasks = await this.decomposeTask(analysis, taskDescription);
    this._log("info", `Decomposed into ${subTasks.length} sub-tasks`);

    const assignedTasks = assignProvidersToTasks(subTasks);
    const dag = buildDAG(assignedTasks, (level, msg) => this._log(level, msg));
    this._log("info", `DAG built: ${dag.executionOrder.length} execution groups, max depth ${dag.maxDepth}`);

    const estimatedDuration = estimateDAGDuration(assignedTasks, dag);

    /** @type {import("./tianshuPlannerConstants.js").Plan} */
    const plan = {
      planId, taskDescription, context, analysis,
      subTasks: assignedTasks, dag,
      status: STATUS.PENDING, estimatedDuration,
      actualDuration: null, createdAt: new Date().toISOString(), completedAt: null,
    };

    this.planStore.set(planId, plan);
    await savePlanToDisk(plan, (level, msg) => this._log(level, msg));

    this.stats.totalPlans += 1;
    this.stats._totalSubTasks += subTasks.length;
    this.stats.avgSubTasks = Math.round(this.stats._totalSubTasks / this.stats.totalPlans);
    this._log("info", `Plan ${planId} created in ${elapsedMs(planStart)}ms`);

    return { planId, subTasks: assignedTasks, dag, estimatedDuration };
  }

  // =========================================================================
  // 2. analyzeComplexity — 调用 AI 分析任务复杂度
  // =========================================================================

  /**
   * 通过 /chat/auto 调用 AI 评估任务复杂度
   * @param {string} taskDescription
   * @returns {Promise<Object>}
   */
  async analyzeComplexity(taskDescription) {
    const response = await callGateway(this.gatewayUrl, this.planningModel, [
      { role: "system", content: buildComplexitySystemPrompt() },
      { role: "user", content: `Analyze the complexity of this task:\n\n${taskDescription}` },
    ], { temperature: 0.2, maxTokens: 500 });

    const fallback = { complexity: 3, estimatedSubTasks: 5, riskFactors: ["unknown-scope"], capabilities: ["general"] };
    const parsed = safeJsonParse(response, fallback);

    return {
      complexity: Math.min(5, Math.max(1, Number(parsed.complexity) || 3)),
      estimatedSubTasks: Math.min(this.maxSubTasks, Math.max(1, Number(parsed.estimatedSubTasks) || 5)),
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : fallback.riskFactors,
      capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : fallback.capabilities,
    };
  }

  // =========================================================================
  // 3. decomposeTask — 调用 AI 将任务分解为子任务
  // =========================================================================

  /**
   * 调用 AI 将复杂任务拆解为带依赖关系的子任务列表
   * @param {Object} analysis
   * @param {string} taskDescription
   * @returns {Promise<Object[]>}
   */
  async decomposeTask(analysis, taskDescription) {
    const response = await callGateway(this.gatewayUrl, this.planningModel, [
      { role: "system", content: buildDecomposeSystemPrompt(analysis, this.maxSubTasks) },
      { role: "user", content: buildDecomposeUserMsg(analysis, taskDescription) },
    ], { temperature: 0.3, maxTokens: 2000 });

    const parsed = safeJsonParse(response, null);
    const subTasks = parseDecomposedTasks(parsed, taskDescription, this.maxSubTasks);

    if (subTasks.length === 1 && subTasks[0].name === "Execute task") {
      this._log("warn", "AI returned invalid sub-task list, using fallback single task");
    }

    removeCycles(subTasks);
    return subTasks;
  }

  // =========================================================================
  // 4. executePlan — 按 DAG 顺序执行子任务
  // =========================================================================

  /**
   * 按照 DAG 拓扑顺序逐层执行子任务
   * @param {Object} plan
   * @returns {Promise<Object>}
   */
  async executePlan(plan) {
    const resolvedPlan = plan.planId && plan.subTasks ? plan : await this.getPlan(plan.planId);
    if (!resolvedPlan) throw new Error(`[TianshuPlanner] Plan ${plan.planId} not found`);

    const execStart = process.hrtime();
    resolvedPlan.status = STATUS.RUNNING;
    this._log("info", `Executing plan ${resolvedPlan.planId} — ${resolvedPlan.subTasks.length} sub-tasks in ${resolvedPlan.dag.executionOrder.length} groups`);

    const results = [];
    const taskResultMap = new Map();
    const logFn = (l, m) => this._log(l, m);

    for (let groupIdx = 0; groupIdx < resolvedPlan.dag.executionOrder.length; groupIdx++) {
      const group = resolvedPlan.dag.executionOrder[groupIdx];
      this._log("info", `  Group ${groupIdx + 1}/${resolvedPlan.dag.executionOrder.length}: ${group.length} task(s) parallel`);

      const promises = group.map((taskId) => {
        const task = resolvedPlan.subTasks.find((t) => t.id === taskId);
        if (!task) return Promise.resolve({ taskId, status: STATUS.SKIPPED, error: "task not found" });

        const depsOk = task.dependencies.every((depId) => {
          const depResult = taskResultMap.get(depId);
          return depResult && depResult.status === STATUS.COMPLETED;
        });

        if (!depsOk) {
          task.status = STATUS.SKIPPED;
          this._log("warn", `    Task ${task.name} (${task.id}) skipped — dependency failed`);
          return Promise.resolve({ taskId: task.id, status: STATUS.SKIPPED, error: "dependency failed" });
        }

        return executeSubTask(task, taskResultMap, this.gatewayUrl, this.planningModel, logFn);
      });

      const settled = await Promise.allSettled(promises);
      for (const outcome of settled) {
        const val = outcome.status === "fulfilled"
          ? outcome.value
          : { status: STATUS.FAILED, error: outcome.reason?.message || "unknown" };
        results.push(val);
        if (val.taskId) taskResultMap.set(val.taskId, val);
      }
    }

    const totalDuration = elapsedMs(execStart);
    const completedCount = results.filter((r) => r.status === STATUS.COMPLETED).length;
    const failedCount = results.filter((r) => r.status === STATUS.FAILED || r.status === STATUS.SKIPPED).length;

    resolvedPlan.status = failedCount === 0 ? STATUS.COMPLETED : STATUS.FAILED;
    resolvedPlan.actualDuration = totalDuration;
    resolvedPlan.completedAt = new Date().toISOString();

    this.stats.totalExecuted += 1;
    this.stats._totalDuration += totalDuration;
    this.stats.avgDuration = Math.round(this.stats._totalDuration / this.stats.totalExecuted);
    if (failedCount === 0) this.stats._successCount += 1;
    this.stats.successRate = Math.round((this.stats._successCount / this.stats.totalExecuted) * 100) / 100;

    await savePlanToDisk(resolvedPlan, logFn);
    this._log("info", `Plan ${resolvedPlan.planId} ${resolvedPlan.status}: ${completedCount} ok, ${failedCount} fail, ${totalDuration}ms`);

    return { planId: resolvedPlan.planId, status: resolvedPlan.status, results, totalDuration, completedCount, failedCount };
  }

  // =========================================================================
  // 5. monitorExecution — 查询计划执行进度
  // =========================================================================

  /**
   * 查询正在执行的计划的实时进度
   * @param {string} planId
   * @returns {Object|null}
   */
  monitorExecution(planId) {
    const plan = this.planStore.get(planId);
    if (!plan) {
      this._log("warn", `monitorExecution: plan ${planId} not found`);
      return null;
    }
    return computePlanProgress(plan);
  }

  // =========================================================================
  // 6. 计划持久化与检索
  // =========================================================================

  /** @param {Object} plan @returns {Promise<void>} */
  async savePlan(plan) {
    return savePlanToDisk(plan, (level, msg) => this._log(level, msg));
  }

  /**
   * 从内存或磁盘获取计划
   * @param {string} planId
   * @returns {Promise<Object|null>}
   */
  async getPlan(planId) {
    if (this.planStore.has(planId)) return this.planStore.get(planId);
    const plan = await readPlanFromDisk(planId, (level, msg) => this._log(level, msg));
    if (plan) this.planStore.set(planId, plan);
    return plan;
  }

  /**
   * 列出所有已知计划的基本信息
   * @returns {Promise<Object[]>}
   */
  async listPlans() {
    const plans = [];
    for (const [, plan] of this.planStore) {
      plans.push({ planId: plan.planId, status: plan.status, subTaskCount: plan.subTasks ? plan.subTasks.length : 0, createdAt: plan.createdAt });
    }
    const diskPlans = await listPlansFromDisk((level, msg) => this._log(level, msg));
    const knownIds = new Set(plans.map((p) => p.planId));
    for (const dp of diskPlans) {
      if (!knownIds.has(dp.planId)) plans.push(dp);
    }
    plans.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return plans;
  }

  // =========================================================================
  // 7. getStats — 获取统计信息
  // =========================================================================

  /** @returns {Object} */
  getStats() {
    return {
      totalPlans: this.stats.totalPlans, avgSubTasks: this.stats.avgSubTasks,
      avgDuration: this.stats.avgDuration, successRate: this.stats.successRate,
      totalExecuted: this.stats.totalExecuted,
    };
  }

  // =========================================================================
  // 内部日志
  // =========================================================================

  /** @param {"info"|"warn"|"error"} level @param {string} message */
  _log(level, message) {
    const entry = { timestamp: new Date().toISOString(), level, source: "TianshuPlannerExecutor", message };
    this.executionLog.push(entry);
    if (this.executionLog.length > 500) this.executionLog = this.executionLog.slice(-500);

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [TianshuPlanner]`;
    if (level === "error") console.error(prefix, message);
    else if (level === "warn") console.warn(prefix, message);
    else console.log(prefix, message);
  }
}

export default TianshuPlannerExecutor;
