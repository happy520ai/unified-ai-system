// =============================================================================
// cli-shared-helpers.js — cli-core 与命令簇模块共享的通用助手
//
// unwrapEnvelope 从 cli-core.js 机械拆出：两侧都需要，放在共享模块避免循环导入。
// =============================================================================

function unwrapEnvelope(value) {
  return value?.data ?? value ?? {};
}

export { unwrapEnvelope };
