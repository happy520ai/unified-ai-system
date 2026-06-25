// =============================================================================
// liveSkillRegistry-validation.js
// Skill definition validation extracted from liveSkillRegistry.js
// =============================================================================

/** 合法的技能类型 */
const VALID_TYPES = new Set([
  "safety",       // 安全分类
  "context",      // 上下文优化
  "review",       // 审查评估
  "evidence",     // 证据记录
  "planning",     // 规划决策
  "transform",    // 数据变换
  "routing",      // 路由优化
  "analysis",     // 分析推理
  "generation",   // 内容生成
  "monitoring",   // 监控告警
]);

/**
 * 验证技能定义的完整性
 * @param {Object} definition - 技能定义对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSkillDefinition(definition) {
  const errors = [];

  if (!definition || typeof definition !== "object") {
    return { valid: false, errors: ["skillDefinition must be a non-null object"] };
  }

  // skillId 必填且为字符串
  if (typeof definition.skillId !== "string" || definition.skillId.trim().length === 0) {
    errors.push("skillId is required and must be a non-empty string");
  }

  // type 必填且在合法范围内
  if (typeof definition.type !== "string" || definition.type.trim().length === 0) {
    errors.push("type is required and must be a non-empty string");
  } else if (!VALID_TYPES.has(definition.type)) {
    errors.push(`type "${definition.type}" is not recognized. Valid types: ${[...VALID_TYPES].join(", ")}`);
  }

  // codePath 必填
  if (typeof definition.codePath !== "string" || definition.codePath.trim().length === 0) {
    errors.push("codePath is required and must be a non-empty string");
  }

  // version 可选但格式需正确
  if (definition.version !== undefined && definition.version !== null) {
    if (typeof definition.version !== "string" || !/^\d+\.\d+\.\d+/.test(definition.version)) {
      errors.push('version must follow semver format (e.g. "1.0.0")');
    }
  }

  return { valid: errors.length === 0, errors };
}
