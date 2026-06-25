// =============================================================================
// AI Neurogenesis Compiler — Helpers
//
// Extracted pure helpers, constants, and the deterministic classifier used by
// aiNeurogenesisCompiler.js.  Keeping them in a sibling file lets the main
// module stay under the 500-line anti-entropy limit.
// =============================================================================

import http from "node:http";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 网关 AI 端点地址 */
export const GATEWAY_AI_ENDPOINT = "http://127.0.0.1:5191/chat/auto";

/** AI 调用超时时间（毫秒） */
export const AI_CALL_TIMEOUT_MS = 30_000;

/** 编译器版本标识 */
export const COMPILER_VERSION = "ai-neurogenesis-compiler-v2";

// ---------------------------------------------------------------------------
// AI 分析提示词模板
// ---------------------------------------------------------------------------

/**
 * 构建 AI 分析提示词
 * 引导 AI 分析用户的自然语言需求并输出结构化 JSON
 * @param {string} intakeText - 用户原始需求文本
 * @returns {string} 完整的提示词
 */
export function buildAnalysisPrompt(intakeText) {
  return `你是一个能力神经元规格分析器。用户会用自然语言描述一个他们想要的"能力神经元"（即网关的功能模块/技能包）。

你的任务是深度分析这个需求，并以严格的 JSON 格式输出结构化的能力规格。

## 用户需求
"""
${intakeText}
"""

## 输出格式（严格 JSON，不要包含 markdown 标记）

{
  "capabilityType": "从以下类型中选择最匹配的: safety, context, planning, review, evidence, ui, provider, data, transform, integration, other",
  "displayName": "简洁的中文显示名称",
  "description": "详细的功能描述（中文，2-3句话）",
  "inputs": {
    "paramName": { "type": "string|number|boolean|object|array", "description": "参数说明", "required": true }
  },
  "outputs": {
    "resultName": { "type": "string|number|boolean|object|array", "description": "输出说明" }
  },
  "safetyConstraints": ["安全约束列表，例如：不能访问密钥、不能调用外部API、不能修改文件系统"],
  "applicableModes": ["从以下选择适用的运行模式: normal, god, tianshu, codex"],
  "pressureTypes": ["从以下选择相关的压力类型: cost, latency, quality, token, risk, evidence, explainability, planning, general"],
  "estimatedComplexity": "simple 或 medium 或 complex",
  "suggestedDependencies": ["可能依赖的其他能力神经元ID"],
  "exampleUsage": {
    "input": { "示例输入参数": "值" },
    "expectedOutput": { "示例输出": "值" }
  },
  "runtimeHints": {
    "ttlSeconds": 300,
    "maxRequests": 3,
    "maxTokenBudget": 4000
  }
}

## 分析指南
- capabilityType 必须从给定列表中选择
- inputs 和 outputs 至少各有一个条目（即使是最简单的能力）
- safetyConstraints 要全面考虑数据安全、隐私、权限边界
- applicableModes 根据能力的性质决定在哪些运行模式下启用
- pressureTypes 根据能力解决的核心问题选择
- estimatedComplexity 基于输入处理、逻辑复杂度、输出生成综合判断
- exampleUsage 给出一个典型的输入输出示例

请只输出 JSON，不要包含任何额外文字。`;
}

// ---------------------------------------------------------------------------
// AI 调用辅助函数
// ---------------------------------------------------------------------------

/**
 * 通过网关的 /chat/auto 端点调用 AI 模型
 * 利用太极北斗引擎自动选择最合适的模型
 *
 * @param {string} message - 发送给 AI 的消息
 * @param {string} [mode="standard"] - 运行模式
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export function callGatewayAI(message, mode = "standard") {
  return new Promise((resolve) => {
    const requestBody = JSON.stringify({ message, mode });

    const reqOptions = {
      hostname: "127.0.0.1",
      port: 5191,
      path: "/chat/auto",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
      timeout: AI_CALL_TIMEOUT_MS,
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success !== false && (parsed.content || parsed.text || parsed.choices)) {
            // 提取 AI 返回的文本内容
            let content =
              parsed.content ||
              parsed.text ||
              parsed.choices?.[0]?.message?.content ||
              parsed.choices?.[0]?.text ||
              "";
            resolve({ success: true, content });
          } else {
            resolve({
              success: false,
              error: parsed.error || "AI 返回了空响应",
            });
          }
        } catch (parseErr) {
          resolve({
            success: false,
            error: `解析 AI 响应失败: ${parseErr.message}`,
          });
        }
      });
    });

    // 超时处理
    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        error: `AI 调用超时（${AI_CALL_TIMEOUT_MS / 1000}秒）`,
      });
    });

    // 错误处理
    req.on("error", (err) => {
      resolve({
        success: false,
        error: `AI 调用失败: ${err.message}`,
      });
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * 从 AI 返回的文本中提取 JSON 对象
 * 支持被 markdown 代码块包裹的情况
 *
 * @param {string} rawText - AI 返回的原始文本
 * @returns {object|null} 解析后的 JSON 对象，或 null
 */
export function extractJsonFromResponse(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  // 策略 1: 尝试直接解析
  try {
    return JSON.parse(rawText.trim());
  } catch {
    // 继续尝试其他策略
  }

  // 策略 2: 提取 ```json ... ``` 代码块
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // 继续尝试
    }
  }

  // 策略 3: 查找第一个 { 和最后一个 } 之间的内容
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch {
      // 所有策略都失败了
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Deterministic 分类辅助（与旧版编译器一致的逻辑）
// ---------------------------------------------------------------------------

/** 关键词模式匹配表（与旧版编译器保持一致） */
export const DETERMINISTIC_PATTERNS = [
  {
    type: "safety",
    keywords: ["风险", "risk", "安全", "拦截"],
    pressureTypes: ["risk"],
    modes: ["normal", "god", "tianshu"],
  },
  {
    type: "review",
    keywords: ["god", "review", "评审", "审查"],
    pressureTypes: ["quality"],
    modes: ["god"],
  },
  {
    type: "context",
    keywords: ["上下文", "context", "token", "压缩", "省"],
    pressureTypes: ["token"],
    modes: ["codex", "normal"],
  },
  {
    type: "evidence",
    keywords: ["回滚", "rollback", "证据", "失败"],
    pressureTypes: ["evidence"],
    modes: ["normal"],
  },
  {
    type: "ui",
    keywords: ["展示", "显示", "为什么", "可见"],
    pressureTypes: ["explainability"],
    modes: ["normal"],
  },
  {
    type: "planning",
    keywords: ["计划", "规划", "tianshu", "天枢"],
    pressureTypes: ["planning"],
    modes: ["tianshu"],
  },
];

/**
 * 使用 deterministic 方式对需求进行基础分类
 * @param {string} text - 用户需求文本
 * @returns {{ type: string, pressureTypes: string[], modes: string[] }}
 */
export function deterministicClassify(text) {
  const lower = text.toLowerCase();
  const match = DETERMINISTIC_PATTERNS.find((p) =>
    p.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );
  return {
    type: match?.type || "other",
    pressureTypes: match?.pressureTypes || ["general"],
    modes: match?.modes || ["normal"],
  };
}
