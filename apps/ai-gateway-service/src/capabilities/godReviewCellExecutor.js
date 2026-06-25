// =============================================================================
// God Review Cell Executor — 多模型质量审查编排器
// 当路由模式为 "god" 时，此执行器协调多个 AI 模型完成结构化审查流水线：
//   主生成 → 评论审查 → 合成改进 → 质量评分 → 迭代优化
// =============================================================================

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  EVIDENCE_DIR,
  SCORING_CRITERIA,
  MAX_CRITERION_SCORE,
  MAX_TOTAL_SCORE,
  timestamp,
  gradeDescription,
  scoreToGrade,
  safeJsonParse,
  log,
} from "./godReviewCellExecutor-helpers.js";
import {
  buildCriticSystemPrompt,
  buildCriticUserPrompt,
  buildSynthesizerSystemPrompt,
  buildSynthesizerUserPrompt,
  buildScoringSystemPrompt,
  buildScoringUserPrompt,
} from "./godReviewCellExecutor-prompts.js";
import { callGateway } from "./godReviewCellExecutor-gateway.js";

// === GodReviewCellExecutor ===

export class GodReviewCellExecutor {
  /**
   * @param {Object} [options]
   * @param {import("./godReviewCellExecutor-helpers.js").ReviewModel[]} [options.reviewModels]
   * @param {number}  [options.minReviewScore]  - 最低通过分数 (默认 70)
   * @param {number}  [options.maxReviewRounds] - 最大迭代轮次 (默认 3)
   * @param {boolean} [options.evidenceCapture] - 是否启用证据捕获 (默认 true)
   * @param {string}  [options.gatewayUrl]      - 网关基础 URL
   */
  constructor(options = {}) {
    this.reviewModels = options.reviewModels || [
      { role: "primary", provider: "auto", weight: 0.5 },
      { role: "critic", provider: "auto", weight: 0.3 },
      { role: "synthesizer", provider: "auto", weight: 0.2 },
    ];
    this.minReviewScore = options.minReviewScore || 70;
    this.maxReviewRounds = options.maxReviewRounds || 3;
    this.evidenceCapture = options.evidenceCapture !== false;
    this.gatewayUrl = options.gatewayUrl || "http://127.0.0.1:3100";
    this.reviewLog = [];
    this.stats = {
      totalReviews: 0,
      avgScore: 0,
      avgRounds: 0,
      totalDuration: 0,
      passRate: 0,
      _passCount: 0,
    };
  }
  // --- executeReview ---

  /**
   * 主审查流水线编排入口
   * @param {import("./godReviewCellExecutor-helpers.js").ReviewContext} context
   * @returns {Promise<import("./godReviewCellExecutor-helpers.js").ReviewResult>}
   */
  async executeReview(context) {
    const reviewId = randomUUID();
    const startTime = Date.now();

    log("info", `开始审查周期 [${reviewId}]`, {
      promptLength: context.prompt?.length ?? 0,
      minScore: this.minReviewScore,
      maxRounds: this.maxReviewRounds,
    });

    try {
      const result = await this.iterativeImprovement(context, reviewId);
      const duration = Date.now() - startTime;
      result.id = reviewId;
      result.duration = duration;

      this._updateStats(result);

      this.reviewLog.push({
        id: reviewId,
        timestamp: new Date().toISOString(),
        score: result.score,
        grade: result.grade,
        rounds: result.rounds,
        passed: result.passed,
        duration,
      });

      if (this.reviewLog.length > 500) {
        this.reviewLog = this.reviewLog.slice(-500);
      }

      if (this.evidenceCapture) {
        await this.captureEvidence(result);
      }

      log("info", `审查周期完成 [${reviewId}]`, {
        score: result.score, grade: result.grade,
        rounds: result.rounds, passed: result.passed, duration,
      });

      return result;
    } catch (err) {
      log("error", `审查周期异常 [${reviewId}]`, { error: err.message, stack: err.stack });

      const fallbackResult = {
        id: reviewId,
        response: `[GodReview 降级] 审查过程出错: ${err.message}。请重试或使用普通模式。`,
        score: 0, rounds: 0, grade: "F", history: [],
        passed: false, duration: Date.now() - startTime, error: err.message,
      };

      if (this.evidenceCapture) {
        await this.captureEvidence(fallbackResult).catch(() => {});
      }
      return fallbackResult;
    }
  }

  // --- primaryGeneration ---

  /**
   * 调用网关 /chat/auto 端点生成初始响应
   * @param {string} prompt
   * @param {Object} [options]
   * @returns {Promise<import("./godReviewCellExecutor-helpers.js").PrimaryResult>}
   */
  async primaryGeneration(prompt, options = {}) {
    log("info", "阶段 1: 主生成开始");
    const startTs = Date.now();

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    try {
      const gatewayResult = await this._callGateway(messages, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 4096,
        purpose: "primary-generation",
      });
      const latency = Date.now() - startTs;
      log("info", "阶段 1: 主生成完成", { latency, model: gatewayResult.model });
      return { text: gatewayResult.content, model: gatewayResult.model || "unknown", latency };
    } catch (err) {
      log("error", "阶段 1: 主生成失败", { error: err.message });
      throw new Error(`PrimaryGeneration failed: ${err.message}`);
    }
  }

  // --- criticReview ---

  /**
   * 将主生成结果提交给评论模型进行结构化评估
   * @param {string} primaryResponse
   * @param {string} originalPrompt
   * @returns {Promise<import("./godReviewCellExecutor-helpers.js").CriticResult>}
   */
  async criticReview(primaryResponse, originalPrompt) {
    log("info", "阶段 2: 评论审查开始");

    const criticSystemPrompt = buildCriticSystemPrompt();
    const criticUserPrompt = buildCriticUserPrompt(primaryResponse, originalPrompt);

    const messages = [
      { role: "system", content: criticSystemPrompt },
      { role: "user", content: criticUserPrompt },
    ];

    try {
      const gatewayResult = await this._callGateway(messages, {
        temperature: 0.3, maxTokens: 2048, purpose: "critic-review",
      });

      const parsed = safeJsonParse(gatewayResult.content, {
        strengths: [], weaknesses: ["无法解析评论结果"], suggestions: [], score: 50,
      });

      const result = {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [String(parsed.strengths || "未识别")],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [String(parsed.weaknesses || "未识别")],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 50,
      };

      log("info", "阶段 2: 评论审查完成", { score: result.score, weaknessCount: result.weaknesses.length });
      return result;
    } catch (err) {
      log("error", "阶段 2: 评论审查失败", { error: err.message });
      return {
        strengths: ["审查过程异常，无法评估优点"],
        weaknesses: [`评论审查失败: ${err.message}`],
        suggestions: ["建议重新生成"], score: 50,
      };
    }
  }

  // --- synthesizeReview ---

  /**
   * 合成模型综合原始响应与评论反馈，产出改进版本
   * @param {string} primaryResponse
   * @param {import("./godReviewCellExecutor-helpers.js").CriticResult} criticFeedback
   * @param {string} originalPrompt
   * @returns {Promise<import("./godReviewCellExecutor-helpers.js").SynthesisResult>}
   */
  async synthesizeReview(primaryResponse, criticFeedback, originalPrompt) {
    log("info", "阶段 3: 合成改进开始");

    const synthesizerSystemPrompt = buildSynthesizerSystemPrompt();
    const synthesizerUserPrompt = buildSynthesizerUserPrompt(primaryResponse, criticFeedback, originalPrompt);

    const messages = [
      { role: "system", content: synthesizerSystemPrompt },
      { role: "user", content: synthesizerUserPrompt },
    ];

    try {
      const gatewayResult = await this._callGateway(messages, {
        temperature: 0.5, maxTokens: 4096, purpose: "synthesis",
      });

      const parsed = safeJsonParse(gatewayResult.content, {
        improved_response: gatewayResult.content,
        improvements: ["原始输出解析失败，使用模型原始输出"],
      });

      const result = {
        text: parsed.improved_response || parsed.improvedResponse || gatewayResult.content,
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      };

      log("info", "阶段 3: 合成改进完成", { improvementsCount: result.improvements.length });
      return result;
    } catch (err) {
      log("error", "阶段 3: 合成改进失败", { error: err.message });
      return {
        text: primaryResponse,
        improvements: [`合成失败，保留原始响应: ${err.message}`],
      };
    }
  }

  // --- scoreFinalResponse ---

  /**
   * 对最终响应进行多维度评分
   * @param {string} response
   * @param {string[]} [criteria]
   * @returns {Promise<import("./godReviewCellExecutor-helpers.js").ScoreResult>}
   */
  async scoreFinalResponse(response, criteria = SCORING_CRITERIA) {
    log("info", "阶段 4: 最终评分开始");

    const scoringSystemPrompt = buildScoringSystemPrompt(criteria);
    const scoringUserPrompt = buildScoringUserPrompt(response);

    const messages = [
      { role: "system", content: scoringSystemPrompt },
      { role: "user", content: scoringUserPrompt },
    ];

    try {
      const gatewayResult = await this._callGateway(messages, {
        temperature: 0.2, maxTokens: 512, purpose: "scoring",
      });

      const parsed = safeJsonParse(gatewayResult.content, null);

      const breakdown = {};
      let computedTotal = 0;
      for (const criterion of criteria) {
        let rawScore = 0;
        if (parsed && typeof parsed[criterion] === "number") rawScore = parsed[criterion];
        const clampedScore = Math.max(0, Math.min(MAX_CRITERION_SCORE, Math.round(rawScore)));
        breakdown[criterion] = clampedScore;
        computedTotal += clampedScore;
      }

      const totalScore = Math.max(0, Math.min(MAX_TOTAL_SCORE, computedTotal));
      const grade = scoreToGrade(totalScore);

      log("info", "阶段 4: 最终评分完成", { totalScore, grade, breakdown });
      return { totalScore, breakdown, grade };
    } catch (err) {
      log("error", "阶段 4: 评分失败", { error: err.message });
      const fallbackBreakdown = {};
      for (const c of criteria) fallbackBreakdown[c] = 12;
      return {
        totalScore: 12 * criteria.length,
        breakdown: fallbackBreakdown,
        grade: scoreToGrade(12 * criteria.length),
      };
    }
  }

  // --- iterativeImprovement ---

  /**
   * 迭代改进循环
   * @param {import("./godReviewCellExecutor-helpers.js").ReviewContext} context
   * @param {string} [reviewId]
   * @returns {Promise<import("./godReviewCellExecutor-helpers.js").ReviewResult>}
   */
  async iterativeImprovement(context, reviewId) {
    const id = reviewId || randomUUID();
    const history = [];
    let currentResponse = null;
    let currentScore = 0;
    let currentGrade = "F";
    let currentBreakdown = {};
    let round = 0;

    log("info", `迭代改进开始 [${id}]`, {
      maxRounds: this.maxReviewRounds, minScore: this.minReviewScore,
    });

    while (round < this.maxReviewRounds) {
      round++;
      const roundStart = Date.now();
      log("info", `--- 第 ${round}/${this.maxReviewRounds} 轮 ---`);

      if (round === 1) {
        const primary = await this.primaryGeneration(context.prompt, {
          systemPrompt: context.systemPrompt, ...context.options,
        });
        currentResponse = primary.text;
        history.push({
          round: 1, phase: "primary-generation", model: primary.model,
          latency: primary.latency, responseLength: primary.text.length,
        });
      }

      const critic = await this.criticReview(currentResponse, context.prompt);
      history.push({
        round, phase: "critic-review", score: critic.score,
        strengthsCount: critic.strengths.length,
        weaknessesCount: critic.weaknesses.length,
        suggestionsCount: critic.suggestions.length,
      });

      const hasSignificantIssues = critic.weaknesses.length > 0 || critic.score < this.minReviewScore;

      let synthesis = null;
      if (hasSignificantIssues) {
        synthesis = await this.synthesizeReview(currentResponse, critic, context.prompt);
        currentResponse = synthesis.text;
        history.push({
          round, phase: "synthesis", improvementsCount: synthesis.improvements.length,
          improvements: synthesis.improvements,
        });
      } else {
        log("info", `第 ${round} 轮: 评论无明显问题，跳过合成`);
        history.push({ round, phase: "synthesis-skipped", reason: "评论未发现显著问题" });
      }

      const scoreResult = await this.scoreFinalResponse(currentResponse);
      currentScore = scoreResult.totalScore;
      currentGrade = scoreResult.grade;
      currentBreakdown = scoreResult.breakdown;
      const roundDuration = Date.now() - roundStart;

      history.push({
        round, phase: "scoring", totalScore: currentScore,
        grade: currentGrade, breakdown: currentBreakdown, roundDuration,
      });

      log("info", `第 ${round} 轮完成: score=${currentScore}, grade=${currentGrade}, duration=${roundDuration}ms`);

      if (currentScore >= this.minReviewScore) {
        log("info", `达到目标分数 ${currentScore} >= ${this.minReviewScore}，终止迭代`);
        break;
      }
      if (round >= this.maxReviewRounds) {
        log("warn", `已达最大轮次 ${this.maxReviewRounds}，终止迭代 (当前分数: ${currentScore})`);
        break;
      }
      log("info", `分数 ${currentScore} 未达目标 ${this.minReviewScore}，进入第 ${round + 1} 轮`);
    }

    return {
      id, response: currentResponse || "", score: currentScore, grade: currentGrade,
      breakdown: currentBreakdown, rounds: round, history,
      passed: currentScore >= this.minReviewScore, duration: 0,
    };
  }

  // --- captureEvidence ---

  /**
   * 将审查结果持久化为证据文件
   * @param {import("./godReviewCellExecutor-helpers.js").ReviewResult} reviewResult
   * @returns {Promise<string|null>}
   */
  async captureEvidence(reviewResult) {
    try {
      await fs.mkdir(EVIDENCE_DIR, { recursive: true });
      const fileName = `${timestamp()}-${reviewResult.id || "unknown"}.json`;
      const filePath = path.join(EVIDENCE_DIR, fileName);

      const evidencePayload = {
        version: "1.0.0", capturedAt: new Date().toISOString(),
        executor: "GodReviewCellExecutor", reviewId: reviewResult.id,
        score: reviewResult.score, grade: reviewResult.grade,
        gradeDescription: gradeDescription(reviewResult.grade),
        passed: reviewResult.passed, rounds: reviewResult.rounds,
        duration: reviewResult.duration,
        responseLength: reviewResult.response?.length ?? 0,
        responsePreview: reviewResult.response?.slice(0, 500) ?? "",
        breakdown: reviewResult.breakdown || {},
        history: reviewResult.history || [],
        error: reviewResult.error || null,
        meta: {
          minReviewScore: this.minReviewScore, maxReviewRounds: this.maxReviewRounds,
          reviewModels: this.reviewModels, gatewayUrl: this.gatewayUrl,
        },
      };

      await fs.writeFile(filePath, JSON.stringify(evidencePayload, null, 2), "utf-8");
      log("info", `证据已捕获: ${filePath}`);
      return filePath;
    } catch (err) {
      log("error", "证据捕获失败", { error: err.message });
      return null;
    }
  }

  // --- stats / internal helpers ---

  getStats() {
    return { ...this.stats, minReviewScore: this.minReviewScore, maxReviewRounds: this.maxReviewRounds,
      evidenceCapture: this.evidenceCapture, gatewayUrl: this.gatewayUrl, recentReviews: this.reviewLog.slice(-10) };
  }

  /** @private */
  async _callGateway(messages, options = {}) {
    return callGateway(this.gatewayUrl, messages, options);
  }

  _updateStats(result) {
    const p = this.stats, n = p.totalReviews;
    p.totalReviews += 1;
    p.avgScore = (p.avgScore * n + result.score) / p.totalReviews;
    p.avgRounds = (p.avgRounds * n + result.rounds) / p.totalReviews;
    p.totalDuration += result.duration || 0;
    if (result.passed) p._passCount += 1;
    p.passRate = p._passCount / p.totalReviews;
  }

  resetStats() {
    this.stats = { totalReviews: 0, avgScore: 0, avgRounds: 0, totalDuration: 0, passRate: 0, _passCount: 0 };
    this.reviewLog = [];
    log("info", "统计数据与审查日志已重置");
  }

  updateReviewModels(models) {
    if (!Array.isArray(models) || models.length === 0) { log("warn", "updateReviewModels: 传入的模型列表无效，忽略更新"); return; }
    this.reviewModels = models;
    log("info", "审查模型配置已更新", { modelCount: models.length });
  }
}

// === Factory & Default Export ===

/**
 * 创建 GodReviewCellExecutor 实例的工厂函数
 * @param {Object} [options]
 * @returns {GodReviewCellExecutor}
 */
export function createGodReviewExecutor(options = {}) {
  return new GodReviewCellExecutor(options);
}

/** 默认单例导出 */
export default new GodReviewCellExecutor();
