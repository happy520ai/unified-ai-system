// =============================================================================
// 神经元运行时内部辅助函数 (Neuron Runtime Internal Helpers)
// 从 neuronRuntimeExecutor.js 提取的纯辅助函数
// =============================================================================

/**
 * 从注册表获取指定类型的所有活跃技能，并按权重排序
 * @param {Object} registry - LiveSkillRegistry 实例
 * @param {string} type - 神经元类型
 * @returns {Promise<Object[]>} 排序后的技能列表
 */
export async function getActiveSkillsByType(registry, type) {
  const result = await registry.list({ type, status: "active" });
  const skills = result.skills;

  // 按 synapse.weight 降序排序（权重高的先执行）
  skills.sort((a, b) => {
    const weightA = a.synapse?.weight ?? 50;
    const weightB = b.synapse?.weight ?? 50;
    return weightB - weightA;
  });

  return skills;
}

/**
 * 检查神经元是否匹配当前上下文（mode 和 stressType）
 * @param {Object} skill - 技能条目
 * @param {Object} context - 执行上下文
 * @returns {boolean}
 */
export function matchesContext(skill, context) {
  const synapse = skill.synapse || {};

  // 模式匹配：如果 synapse.modes 存在且非空，当前 mode 必须在列表中
  if (synapse.modes && Array.isArray(synapse.modes) && synapse.modes.length > 0) {
    const currentMode = context.mode || "default";
    if (!synapse.modes.includes(currentMode)) {
      return false;
    }
  }

  // 压力类型匹配
  if (synapse.stressTypes && Array.isArray(synapse.stressTypes) && synapse.stressTypes.length > 0) {
    const currentStress = context.stressType || "normal";
    if (!synapse.stressTypes.includes(currentStress)) {
      return false;
    }
  }

  return true;
}
