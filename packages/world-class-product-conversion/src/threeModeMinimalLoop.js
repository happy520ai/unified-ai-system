const DEFAULT_TASK = "检查今天系统状态并给出下一步建议";

function normalizeTask(task) {
  const value = String(task ?? "").trim();
  return value || DEFAULT_TASK;
}

function inputFallbackUsed(task) {
  return String(task ?? "").trim().length === 0;
}

function keywordScore(task, words) {
  const text = task.toLowerCase();
  return words.reduce((score, word) => score + (text.includes(word.toLowerCase()) ? 1 : 0), 0);
}

function fallbackFields(task) {
  const used = inputFallbackUsed(task);
  return {
    inputFallbackUsed: used,
    fallbackReason: used ? "empty_input_defaulted_to_safe_local_task" : null,
  };
}

export function runNormalMode(task = DEFAULT_TASK) {
  const normalizedTask = normalizeTask(task);
  return {
    mode: "normal",
    task: normalizedTask,
    ...fallbackFields(task),
    loopReady: true,
    executionType: "local_deterministic_preview",
    directPlan: [
      "确认任务目标",
      "检查可用本地 evidence",
      "输出一个可执行的下一步建议",
    ],
    resultSummary: `Normal Mode 生成本地方案：${normalizedTask}`,
    providerCallsMade: false,
    realProviderCallExecuted: false,
  };
}

export function runGodMode(task = DEFAULT_TASK) {
  const normalizedTask = normalizeTask(task);
  const candidates = [
    {
      id: "fast",
      title: "快速执行方案",
      pros: ["路径短", "适合低风险本地预览"],
      cons: ["深度审查较少"],
      risk: "low",
    },
    {
      id: "balanced",
      title: "平衡推进方案",
      pros: ["兼顾速度和证据", "便于 owner 复核"],
      cons: ["比快速方案多一步验证"],
      risk: "low",
    },
    {
      id: "strict",
      title: "严格审查方案",
      pros: ["边界最清晰", "适合高风险任务前置评估"],
      cons: ["推进速度慢"],
      risk: "medium",
    },
  ];

  return {
    mode: "god",
    task: normalizedTask,
    ...fallbackFields(task),
    loopReady: true,
    executionType: "local_rule_review_preview",
    candidates,
    conflictPoints: ["速度 vs 证据完整度", "最小动作 vs 深度审查"],
    finalRecommendation: "balanced",
    recommendationReason: "平衡方案保留证据链，同时不触发 Provider 或高风险动作。",
    providerCallsMade: false,
    realProviderCallExecuted: false,
  };
}

export function runTianshuMode(task = DEFAULT_TASK) {
  const normalizedTask = normalizeTask(task);
  const providerScore = keywordScore(normalizedTask, ["provider", "模型", "稳定性", "api", "real provider"]);
  const localActionScore = keywordScore(normalizedTask, ["桌面", "文件", "表格", "创建"]);
  const compareScore = keywordScore(normalizedTask, ["比较", "方案", "评估", "风险"]);

  let recommendedMode = "normal";
  let authorizationStatus = "not_required";
  let reason = "任务可由本地 deterministic preview 直接给出下一步。";

  if (providerScore > 0) {
    recommendedMode = "provider_authorization_packet";
    authorizationStatus = "authorization_required";
    reason = "任务涉及 Provider 稳定性或模型调用，必须先走授权包，不执行真实调用。";
  } else if (localActionScore > 0) {
    recommendedMode = "local_action_proposal";
    reason = "任务涉及本地文件动作，默认只生成 action proposal，真实执行需要审批。";
  } else if (compareScore > 0) {
    recommendedMode = "god";
    reason = "任务需要多方案对比，适合本地规则化互评。";
  }

  return {
    mode: "tianshu",
    task: normalizedTask,
    ...fallbackFields(task),
    loopReady: true,
    executionType: "local_mode_router_preview",
    recommendedMode,
    authorizationStatus,
    reason,
    availableRoutes: ["normal", "god", "local_action_proposal", "provider_authorization_packet"],
    blockedRoutes: ["real_provider_call_without_authorization"],
    providerCallsMade: false,
    realProviderCallExecuted: false,
  };
}

export function runThreeModeMinimalLoop(task = DEFAULT_TASK) {
  return {
    task: normalizeTask(task),
    ...fallbackFields(task),
    normal: runNormalMode(task),
    god: runGodMode(task),
    tianshu: runTianshuMode(task),
    providerCallsMade: false,
    realProviderCallExecuted: false,
    secretValueExposed: false,
  };
}
