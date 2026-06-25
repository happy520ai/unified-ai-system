/**
 * taskEvidenceCapture.js
 * 
 * 每任务证据捕获模块
 * 
 * 功能：
 * - 为每个 Agent 任务捕获执行证据
 * - 证据内容：
 *   - 任务输入（goal, context）
 *   - AI 模型调用记录（provider, model, tokens, duration）
 *   - 任务输出（结果摘要）
 *   - 质量评分（自动评估）
 *   - 时间戳（开始/结束/持续时长）
 *   - 使用的工具列表
 * - 证据存储到 .data/workforce/evidence/{planId}/{agentId}.json
 * - 支持证据导出（JSON/Markdown 格式）
 * - 支持证据链查询（按 planId 获取所有 Agent 的证据）
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";

// 默认证据存储根目录
const DEFAULT_EVIDENCE_DIR = resolve(process.cwd(), ".data", "workforce", "evidence");

/**
 * 创建任务证据捕获器
 * @param {object} [options] - 配置选项
 * @param {string} [options.evidenceDir] - 证据存储目录
 * @returns {object} 任务证据捕获器实例
 */
function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_.\-]/g, "_").replace(/^\.+/, "").slice(0, 128);
}

export function createTaskEvidenceCapture(options = {}) {
  const evidenceDir = options.evidenceDir || DEFAULT_EVIDENCE_DIR;

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "taskEvidenceCapture",
        version: "1.0.0",
        evidenceDir,
        description: "每任务证据捕获模块：记录 Agent 执行的完整证据链",
      };
    },

    /**
     * 开始捕获任务证据（任务开始时调用）
     * @param {object} params - 参数
     * @param {string} params.planId - 计划 ID
     * @param {string} params.agentId - Agent ID
     * @param {string} params.goal - 任务目标
     * @param {object} [params.context] - 任务上下文
     * @param {string} [params.role] - Agent 角色
     * @returns {object} 捕获会话
     */
    startCapture({ planId, agentId, goal, context = {}, role = "" }) {
      if (!planId || typeof planId !== "string") {
        throw new Error("planId 是必填项");
      }
      if (!agentId || typeof agentId !== "string") {
        throw new Error("agentId 是必填项");
      }

      const startedAt = new Date();

      // 构建证据骨架
      const evidence = {
        planId: planId.trim(),
        agentId: agentId.trim(),
        role: String(role || "").trim(),
        // 任务输入
        input: {
          goal: String(goal || "").trim(),
          context: context || {},
        },
        // AI 模型调用记录
        aiCalls: [],
        // 使用的工具列表
        toolsUsed: [],
        // 任务输出
        output: {
          summary: null,
          filesChanged: [],
          commandsRun: [],
          deliverables: [],
        },
        // 质量评分
        quality: {
          score: null,
          criteria: [],
          notes: "",
        },
        // 时间戳
        timing: {
          startedAt: startedAt.toISOString(),
          endedAt: null,
          durationMs: null,
        },
        // 元数据
        metadata: {
          captureVersion: "1.0.0",
          capturedBy: "taskEvidenceCapture",
        },
      };

      // 返回捕获会话对象
      return {
        evidence,

        /**
         * 记录一次 AI 模型调用
         */
        recordAiCall(callInfo) {
          this.evidence.aiCalls.push({
            callId: `call_${this.evidence.aiCalls.length + 1}`,
            provider: String(callInfo.provider || "").trim(),
            model: String(callInfo.model || "").trim(),
            promptTokens: Number(callInfo.promptTokens) || 0,
            completionTokens: Number(callInfo.completionTokens) || 0,
            totalTokens: Number(callInfo.totalTokens) || 0,
            durationMs: Number(callInfo.durationMs) || 0,
            costEstimate: callInfo.costEstimate || null,
            timestamp: new Date().toISOString(),
            // 脱敏：不记录完整 prompt/response
            promptPreview: truncate(String(callInfo.prompt || ""), 500),
            responsePreview: truncate(String(callInfo.response || ""), 500),
          });
          return this;
        },

        /**
         * 记录使用的工具
         */
        recordTool(toolName, toolResult) {
          this.evidence.toolsUsed.push({
            toolName: String(toolName || "").trim(),
            success: toolResult?.success !== false,
            durationMs: Number(toolResult?.durationMs) || 0,
            timestamp: new Date().toISOString(),
            outputPreview: truncate(String(toolResult?.output || ""), 300),
          });
          return this;
        },

        /**
         * 设置任务输出
         */
        setOutput(output) {
          this.evidence.output = {
            summary: truncate(String(output.summary || ""), 5000),
            filesChanged: Array.isArray(output.filesChanged) ? output.filesChanged.slice(0, 100) : [],
            commandsRun: Array.isArray(output.commandsRun) ? output.commandsRun.slice(0, 50) : [],
            deliverables: Array.isArray(output.deliverables) ? output.deliverables.slice(0, 20) : [],
          };
          return this;
        },

        /**
         * 设置质量评分
         */
        setQuality(quality) {
          this.evidence.quality = {
            score: Math.min(10, Math.max(0, Number(quality.score) || 0)),
            criteria: Array.isArray(quality.criteria) ? quality.criteria.slice(0, 20) : [],
            notes: truncate(String(quality.notes || ""), 2000),
            evaluatedAt: new Date().toISOString(),
          };
          return this;
        },

        /**
         * 完成捕获（任务结束时调用）
         */
        async finish() {
          const endedAt = new Date();
          this.evidence.timing.endedAt = endedAt.toISOString();
          this.evidence.timing.durationMs = endedAt.getTime() - new Date(this.evidence.timing.startedAt).getTime();

          // 自动质量评估（基于基本指标）
          if (this.evidence.quality.score === null) {
            this.evidence.quality = autoEvaluateQuality(this.evidence);
          }

          // 持久化证据
          const filePath = resolve(evidenceDir, sanitizeId(planId), `${sanitizeId(agentId)}.json`);
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, `${JSON.stringify(this.evidence, null, 2)}\n`, "utf8");

          return {
            success: true,
            planId: this.evidence.planId,
            agentId: this.evidence.agentId,
            evidencePath: filePath,
            durationMs: this.evidence.timing.durationMs,
            quality: this.evidence.quality,
          };
        },
      };
    },

    /**
     * 加载指定 Agent 的证据
     * @param {string} planId - 计划 ID
     * @param {string} agentId - Agent ID
     * @returns {Promise<object>} 证据数据
     */
    async load(planId, agentId) {
      try {
        const filePath = resolve(evidenceDir, sanitizeId(planId), `${sanitizeId(agentId)}.json`);
        const content = await readFile(filePath, "utf8");
        return {
          success: true,
          planId: planId.trim(),
          agentId: agentId.trim(),
          evidence: JSON.parse(content),
        };
      } catch (error) {
        if (error?.code === "ENOENT") {
          return { success: false, reason: "未找到该 Agent 的证据文件" };
        }
        throw error;
      }
    },

    /**
     * 按 planId 获取所有 Agent 的证据（证据链查询）
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 证据链
     */
    async getEvidenceChain(planId) {
      const planDir = resolve(evidenceDir, sanitizeId(planId));
      try {
        const files = await readdir(planDir);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));

        const evidenceList = [];
        for (const file of jsonFiles) {
          try {
            const content = await readFile(join(planDir, file), "utf8");
            evidenceList.push(JSON.parse(content));
          } catch {
            // 跳过无法解析的文件
          }
        }

        return {
          success: true,
          planId: planId.trim(),
          agentCount: evidenceList.length,
          evidence: evidenceList,
          summary: createChainSummary(evidenceList),
        };
      } catch (error) {
        if (error?.code === "ENOENT") {
          return { success: true, planId: planId.trim(), agentCount: 0, evidence: [], summary: {} };
        }
        throw error;
      }
    },

    /**
     * 导出证据为 JSON 格式
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} JSON 导出结果
     */
    async exportJson(planId) {
      const chain = await this.getEvidenceChain(planId);
      return {
        success: true,
        format: "json",
        planId: planId.trim(),
        exportedAt: new Date().toISOString(),
        data: chain,
      };
    },

    /**
     * 导出证据为 Markdown 格式
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} Markdown 导出结果
     */
    async exportMarkdown(planId) {
      const chain = await this.getEvidenceChain(planId);
      const md = formatEvidenceMarkdown(chain);

      return {
        success: true,
        format: "markdown",
        planId: planId.trim(),
        exportedAt: new Date().toISOString(),
        markdown: md,
      };
    },

    /**
     * 自动评估质量（基于简单指标）
     * @param {object} evidence - 证据数据
     * @returns {object} 质量评估结果
     */
    autoEvaluate(evidence) {
      return autoEvaluateQuality(evidence);
    },
  };
}

// ---- 内部辅助函数 ----

/**
 * 截断文本
 */
function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...[truncated]";
}

/**
 * 自动质量评估
 */
function autoEvaluateQuality(evidence) {
  let score = 5; // 基础分
  const criteria = [];

  // 有输出内容 +1
  if (evidence.output?.summary) {
    score += 1;
    criteria.push({ name: "has_output", passed: true, note: "任务有输出内容" });
  } else {
    criteria.push({ name: "has_output", passed: false, note: "任务缺少输出内容" });
  }

  // 有 AI 调用记录 +1
  if (evidence.aiCalls.length > 0) {
    score += 1;
    criteria.push({ name: "has_ai_calls", passed: true, note: `记录了 ${evidence.aiCalls.length} 次 AI 调用` });
  } else {
    criteria.push({ name: "has_ai_calls", passed: false, note: "缺少 AI 调用记录" });
  }

  // 有工具使用记录 +1
  if (evidence.toolsUsed.length > 0) {
    score += 1;
    criteria.push({ name: "has_tools", passed: true, note: `使用了 ${evidence.toolsUsed.length} 个工具` });
  } else {
    criteria.push({ name: "has_tools", passed: false, note: "缺少工具使用记录" });
  }

  // 执行时间合理（>1s 且 <10min） +1
  const durationMs = evidence.timing?.durationMs || 0;
  if (durationMs > 1000 && durationMs < 600000) {
    score += 1;
    criteria.push({ name: "reasonable_duration", passed: true, note: `执行时长: ${(durationMs / 1000).toFixed(1)}s` });
  } else {
    criteria.push({ name: "reasonable_duration", passed: false, note: `执行时长异常: ${durationMs}ms` });
  }

  // 有交付物 +1
  if (evidence.output?.deliverables?.length > 0 || evidence.output?.filesChanged?.length > 0) {
    score += 1;
    criteria.push({ name: "has_deliverables", passed: true, note: "有交付物或文件变更" });
  } else {
    criteria.push({ name: "has_deliverables", passed: false, note: "缺少交付物" });
  }

  return {
    score: Math.min(10, Math.max(0, score)),
    criteria,
    notes: `自动评估得分: ${score}/10`,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * 创建证据链摘要
 */
function createChainSummary(evidenceList) {
  const totalDuration = evidenceList.reduce((sum, e) => sum + (e.timing?.durationMs || 0), 0);
  const totalAiCalls = evidenceList.reduce((sum, e) => sum + (e.aiCalls?.length || 0), 0);
  const totalTokens = evidenceList.reduce((sum, e) => {
    return sum + (e.aiCalls || []).reduce((ts, c) => ts + (c.totalTokens || 0), 0);
  }, 0);
  const avgQuality = evidenceList.length > 0
    ? evidenceList.reduce((sum, e) => sum + (e.quality?.score || 0), 0) / evidenceList.length
    : 0;

  return {
    totalAgents: evidenceList.length,
    totalDurationMs: totalDuration,
    totalDurationFormatted: `${(totalDuration / 1000).toFixed(1)}s`,
    totalAiCalls,
    totalTokens,
    averageQualityScore: Number(avgQuality.toFixed(1)),
    agents: evidenceList.map((e) => ({
      agentId: e.agentId,
      role: e.role,
      durationMs: e.timing?.durationMs || 0,
      aiCalls: e.aiCalls?.length || 0,
      quality: e.quality?.score || 0,
    })),
  };
}

/**
 * 格式化证据为 Markdown
 */
function formatEvidenceMarkdown(chain) {
  const lines = [
    `# Workforce 执行证据报告`,
    ``,
    `- 计划 ID: ${chain.planId}`,
    `- Agent 数量: ${chain.agentCount}`,
    `- 导出时间: ${chain.exportedAt || new Date().toISOString()}`,
    ``,
    `## 执行摘要`,
    `- 总执行时长: ${chain.summary?.totalDurationFormatted || "n/a"}`,
    `- 总 AI 调用次数: ${chain.summary?.totalAiCalls || 0}`,
    `- 总 Token 消耗: ${chain.summary?.totalTokens || 0}`,
    `- 平均质量评分: ${chain.summary?.averageQualityScore || 0}/10`,
    ``,
  ];

  for (const evidence of chain.evidence) {
    lines.push(
      `## Agent: ${evidence.agentId} (${evidence.role || "未指定角色"})`,
      ``,
      `### 任务输入`,
      `- 目标: ${evidence.input?.goal || "n/a"}`,
      ``,
      `### 执行时间`,
      `- 开始: ${evidence.timing?.startedAt || "n/a"}`,
      `- 结束: ${evidence.timing?.endedAt || "n/a"}`,
      `- 时长: ${((evidence.timing?.durationMs || 0) / 1000).toFixed(1)}s`,
      ``,
      `### AI 模型调用 (${evidence.aiCalls?.length || 0} 次)`,
    );

    for (const call of (evidence.aiCalls || [])) {
      lines.push(
        `- ${call.provider}/${call.model}: ${call.totalTokens} tokens, ${call.durationMs}ms`,
      );
    }

    lines.push(
      ``,
      `### 使用的工具 (${evidence.toolsUsed?.length || 0} 个)`,
    );

    for (const tool of (evidence.toolsUsed || [])) {
      lines.push(
        `- ${tool.toolName}: ${tool.success ? "成功" : "失败"} (${tool.durationMs}ms)`,
      );
    }

    lines.push(
      ``,
      `### 任务输出`,
      `- 摘要: ${evidence.output?.summary || "n/a"}`,
      `- 文件变更: ${(evidence.output?.filesChanged || []).length} 个`,
      `- 交付物: ${(evidence.output?.deliverables || []).length} 个`,
      ``,
      `### 质量评分: ${evidence.quality?.score || 0}/10`,
    );

    for (const criterion of (evidence.quality?.criteria || [])) {
      lines.push(
        `- ${criterion.passed ? "[x]" : "[ ]"} ${criterion.name}: ${criterion.note}`,
      );
    }

    lines.push(``, `---`, ``);
  }

  return lines.join("\n");
}
