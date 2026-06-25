// =============================================================================
// GodReviewCellExecutor — Prompt Builders
// Extracted prompt-construction functions to keep the main executor under 500 lines.
// =============================================================================

import {
  SCORING_CRITERIA,
  CRITERIA_LABELS,
  MAX_CRITERION_SCORE,
  MAX_TOTAL_SCORE,
} from "./godReviewCellExecutor-helpers.js";

/**
 * Build the critic system prompt for Phase 2 review.
 * @returns {string}
 */
export function buildCriticSystemPrompt() {
  return [
    "你是一位严格的 AI 响应质量评论员。你的任务是客观评估一个 AI 助手对用户问题的回答质量。",
    "", "请从以下维度进行评估并输出结构化 JSON：",
    "1. strengths (string[]): 响应的优点，列出 2-5 条",
    "2. weaknesses (string[]): 响应的缺点或不足，列出 1-5 条",
    "3. suggestions (string[]): 具体可操作的改进建议，列出 2-5 条",
    "4. score (number): 总分 0-100，其中 70 为及格线", "",
    "评分标准：", "- 90-100: 近乎完美的高质量响应", "- 75-89:  良好响应，有小瑕疵",
    "- 60-74:  基本合格但存在明显改进空间", "- 40-59:  质量较差", "- 0-39:   严重问题", "",
    "你必须仅输出 JSON，不要输出任何其他内容。格式示例：", '```json',
    '{', '  "strengths": ["优点1", "优点2"],', '  "weaknesses": ["缺点1"],',
    '  "suggestions": ["建议1", "建议2"],', '  "score": 75', '}', '```',
  ].join("\n");
}

/**
 * Build the critic user prompt for Phase 2 review.
 * @param {string} primaryResponse
 * @param {string} originalPrompt
 * @returns {string}
 */
export function buildCriticUserPrompt(primaryResponse, originalPrompt) {
  return [
    `## 用户的原始问题`, originalPrompt, "",
    `## AI 助手的回答（请评估以下内容）`, primaryResponse, "",
    "请输出你的评估 JSON：",
  ].join("\n");
}

/**
 * Build the synthesizer system prompt for Phase 3.
 * @returns {string}
 */
export function buildSynthesizerSystemPrompt() {
  return [
    "你是一位 AI 响应优化专家。你的任务是根据评论反馈改进 AI 助手的回答，同时保留原有优点。",
    "", "改进原则：",
    "1. 保留原始回答中正确的、高质量的部分",
    "2. 逐一修复评论中指出的每个缺点",
    "3. 融入可行的改进建议",
    "4. 确保改进后的回答紧扣用户的原始问题",
    "5. 保持专业、清晰的表达风格", "",
    "输出格式要求（JSON）：", '```json', '{',
    '  "improved_response": "改进后的完整回答文本",',
    '  "improvements": ["改进点1", "改进点2", ...]', '}', '```',
    "你必须仅输出 JSON，不要输出其他内容。",
  ].join("\n");
}

/**
 * Build the synthesizer user prompt for Phase 3.
 * @param {string} primaryResponse
 * @param {import("./godReviewCellExecutor-helpers.js").CriticResult} criticFeedback
 * @param {string} originalPrompt
 * @returns {string}
 */
export function buildSynthesizerUserPrompt(primaryResponse, criticFeedback, originalPrompt) {
  const weaknessesText = criticFeedback.weaknesses.length > 0
    ? criticFeedback.weaknesses.map((w, i) => `  ${i + 1}. ${w}`).join("\n")
    : "  （评论者未发现明显缺点）";
  const suggestionsText = criticFeedback.suggestions.length > 0
    ? criticFeedback.suggestions.map((s, i) => `  ${i + 1}. ${s}`).join("\n")
    : "  （无额外建议）";
  const strengthsText = criticFeedback.strengths.length > 0
    ? criticFeedback.strengths.map((s, i) => `  ${i + 1}. ${s}`).join("\n")
    : "  （未列出优点）";

  return [
    `## 用户原始问题`, originalPrompt, "", `## 当前 AI 回答`, primaryResponse, "",
    `## 评论反馈`, `### 优点（需保留）`, strengthsText,
    `### 缺点（需修复）`, weaknessesText, `### 改进建议`, suggestionsText, "",
    "请输出改进后的 JSON：",
  ].join("\n");
}

/**
 * Build the scoring system prompt for Phase 4.
 * @param {string[]} criteria
 * @returns {string}
 */
export function buildScoringSystemPrompt(criteria = SCORING_CRITERIA) {
  const criteriaDescriptions = criteria
    .map((c) => `- ${CRITERIA_LABELS[c] || c}: 0-${MAX_CRITERION_SCORE} 分`)
    .join("\n");

  return [
    "你是一位 AI 输出质量评分专家。请严格按照指定维度对 AI 响应进行评分。", "",
    `评分维度（每项 0-${MAX_CRITERION_SCORE} 分）：`, criteriaDescriptions, "",
    `总分范围：0-${MAX_TOTAL_SCORE}`, "", "评分标准参考：",
    "  18-20: 该维度近乎完美", "  14-17: 该维度表现良好",
    "  10-13: 该维度基本合格", "   5-9 : 该维度存在明显问题", "   0-4 : 该维度严重不足", "",
    "输出格式要求（仅输出 JSON）：", '```json', '{',
    '  "accuracy": 16,', '  "completeness": 14,', '  "clarity": 18,',
    '  "relevance": 17,', '  "formatting": 15,', '  "totalScore": 80', '}', '```',
    "你必须仅输出 JSON，totalScore 应等于各维度分数之和。",
  ].join("\n");
}

/**
 * Build the scoring user prompt for Phase 4.
 * @param {string} response
 * @returns {string}
 */
export function buildScoringUserPrompt(response) {
  return [
    "请对以下 AI 响应进行评分：", "", "---", response, "---", "", "请输出评分 JSON：",
  ].join("\n");
}
