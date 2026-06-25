// =============================================================================
// 天枢规划器 — 持久化、网关调用与子任务执行
// Tianshu Planner — Persistence, gateway I/O, and sub-task execution helpers
// =============================================================================

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  PLANS_DIR,
  DEFAULT_GATEWAY_TIMEOUT,
  SUB_TASK_TIMEOUT,
  STATUS,
  isUnsafeGatewayHost,
  elapsedMs,
} from "./tianshuPlannerConstants.js";

// ---------------------------------------------------------------------------
// 持久化
// ---------------------------------------------------------------------------

/**
 * 将计划序列化为 JSON 并写入 PLANS_DIR/{planId}.json
 * @param {import("./tianshuPlannerConstants.js").Plan} plan
 * @param {function} logFn
 * @returns {Promise<void>}
 */
export async function savePlan(plan, logFn) {
  try {
    await mkdir(PLANS_DIR, { recursive: true });
    const filePath = join(PLANS_DIR, `${plan.planId}.json`);
    const serialized = JSON.stringify(plan, null, 2);
    await writeFile(filePath, serialized, "utf-8");
  } catch (err) {
    if (logFn) logFn("error", `Failed to save plan ${plan.planId}: ${err.message}`);
  }
}

/**
 * 从磁盘读取计划
 * @param {string} planId
 * @param {function} logFn
 * @returns {Promise<import("./tianshuPlannerConstants.js").Plan|null>}
 */
export async function readPlanFromDisk(planId, logFn) {
  try {
    const filePath = join(PLANS_DIR, `${planId}.json`);
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT" && logFn) {
      logFn("error", `Error reading plan ${planId}: ${err.message}`);
    }
    return null;
  }
}

/**
 * 列出磁盘上所有计划文件的基本信息
 * @param {function} logFn
 * @returns {Promise<Array<{ planId: string, status: string, subTaskCount: number, createdAt: string }>>}
 */
export async function listPlansFromDisk(logFn) {
  const plans = [];
  try {
    const files = await readdir(PLANS_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const planId = file.replace(/\.json$/, "");
      try {
        const raw = await readFile(join(PLANS_DIR, file), "utf-8");
        const plan = JSON.parse(raw);
        plans.push({
          planId: plan.planId || planId,
          status: plan.status || "unknown",
          subTaskCount: plan.subTasks ? plan.subTasks.length : 0,
          createdAt: plan.createdAt || null,
        });
      } catch {
        // 跳过无法解析的文件
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT" && logFn) {
      logFn("error", `Error listing plans: ${err.message}`);
    }
  }
  return plans;
}

// ---------------------------------------------------------------------------
// 网关调用
// ---------------------------------------------------------------------------

/**
 * 向 /chat/auto 端点发送请求，带超时和错误处理
 *
 * @param {string} gatewayUrl
 * @param {string} planningModel
 * @param {Array<{ role: string, content: string }>} messages
 * @param {Object} [options={}]
 * @returns {Promise<string>} AI 响应文本
 */
export async function callGateway(gatewayUrl, planningModel, messages, options = {}) {
  const url = `${gatewayUrl}/chat/auto`;
  const timeout = options.timeout || DEFAULT_GATEWAY_TIMEOUT;

  try {
    const parsedUrl = new URL(gatewayUrl);
    if (isUnsafeGatewayHost(parsedUrl.hostname)) {
      throw new Error(`Gateway URL host "${parsedUrl.hostname}" is not allowed (private/reserved network).`);
    }
  } catch (e) {
    if (e.message.includes("not allowed")) throw e;
    throw new Error(`Invalid gateway URL: ${gatewayUrl}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const body = JSON.stringify({
      messages,
      model: planningModel,
      stream: false,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Gateway responded ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();

    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    if (data.content) {
      return data.content;
    }
    if (data.result) {
      return typeof data.result === "string" ? data.result : JSON.stringify(data.result);
    }

    return JSON.stringify(data);
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Gateway call timed out after ${timeout}ms`);
    }
    throw new Error(`Gateway call failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 子任务执行
// ---------------------------------------------------------------------------

/**
 * 执行单个子任务：更新状态、调用网关、记录耗时
 *
 * @param {import("./tianshuPlannerConstants.js").SubTask} task
 * @param {Map<string, Object>} taskResultMap
 * @param {string} gatewayUrl
 * @param {string} planningModel
 * @param {function} logFn
 * @returns {Promise<{ taskId: string, status: string, result: *, duration: number }>}
 */
export async function executeSubTask(task, taskResultMap, gatewayUrl, planningModel, logFn) {
  task.status = STATUS.RUNNING;
  const start = process.hrtime();

  if (logFn) logFn("info", `    Executing: ${task.name} (${task.taskType} → ${task.assignedProvider})`);

  try {
    const depResults = task.dependencies
      .map((depId) => {
        const r = taskResultMap.get(depId);
        return r ? `Task result: ${JSON.stringify(r.result || "").slice(0, 500)}` : null;
      })
      .filter(Boolean)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content: [
          "You are an AI sub-task executor within a planning system.",
          "Execute the given sub-task precisely and return your result.",
          "Be concise but thorough.",
          task.assignedProvider !== "auto"
            ? `You are running as provider: ${task.assignedProvider}`
            : "",
        ].filter(Boolean).join("\n"),
      },
      {
        role: "user",
        content: [
          `Sub-task: ${task.name}`,
          `Description: ${task.description}`,
          depResults ? `Context from previous tasks:\n${depResults}` : "",
        ].filter(Boolean).join("\n\n"),
      },
    ];

    const result = await callGateway(gatewayUrl, planningModel, messages, {
      temperature: 0.4,
      maxTokens: 4000,
      timeout: SUB_TASK_TIMEOUT,
    });

    task.status = STATUS.COMPLETED;
    task.result = result;
    task.duration = elapsedMs(start);

    if (logFn) logFn("info", `    Completed: ${task.name} in ${task.duration}ms`);

    return { taskId: task.id, status: STATUS.COMPLETED, result, duration: task.duration };
  } catch (err) {
    task.status = STATUS.FAILED;
    task.result = { error: err.message };
    task.duration = elapsedMs(start);

    if (logFn) logFn("error", `    Failed: ${task.name} — ${err.message}`);

    return { taskId: task.id, status: STATUS.FAILED, error: err.message, duration: task.duration };
  }
}
