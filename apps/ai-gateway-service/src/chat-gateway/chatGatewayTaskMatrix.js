export const TASK_MATRIX = Object.freeze([
  {
    taskId: "general_chat",
    displayName: "普通问答",
    description: "General Q&A using verified chat models.",
    routeDecision: "execute_with_verified_chat_model",
    safetyDecision: "safe",
    requiresProvider: true,
    executionStatusOnDryRun: "dry_run",
    completionVerifiedOnDryRun: false,
  },
  {
    taskId: "code_assist",
    displayName: "代码辅助",
    description: "Code explanation, generation, and fix suggestions.",
    routeDecision: "execute_with_verified_chat_model",
    safetyDecision: "safe",
    requiresProvider: true,
    executionStatusOnDryRun: "dry_run",
    completionVerifiedOnDryRun: false,
  },
  {
    taskId: "summarization",
    displayName: "文本总结",
    description: "Summarization of input content.",
    routeDecision: "execute_with_verified_chat_model",
    safetyDecision: "safe",
    requiresProvider: true,
    executionStatusOnDryRun: "dry_run",
    completionVerifiedOnDryRun: false,
  },
  {
    taskId: "translation",
    displayName: "翻译",
    description: "Lightweight translation via verified chat models.",
    routeDecision: "execute_with_verified_chat_model",
    safetyDecision: "safe",
    requiresProvider: true,
    executionStatusOnDryRun: "dry_run",
    completionVerifiedOnDryRun: false,
  },
  {
    taskId: "planning",
    displayName: "计划制定",
    description: "Plan creation and step breakdown.",
    routeDecision: "execute_with_verified_chat_model",
    safetyDecision: "safe",
    requiresProvider: true,
    executionStatusOnDryRun: "dry_run",
    completionVerifiedOnDryRun: false,
  },
  {
    taskId: "project_status_reasoning",
    displayName: "项目状态推理",
    description: "Structured reasoning about current project status.",
    routeDecision: "execute_with_verified_chat_model",
    safetyDecision: "safe",
    requiresProvider: true,
    executionStatusOnDryRun: "dry_run",
    completionVerifiedOnDryRun: false,
  },
  {
    taskId: "unsafe_secret_request",
    displayName: "危险：索取密钥",
    description: "Requests to read, print, or leak API keys, .env, or secrets.",
    routeDecision: "reject_unsafe_request",
    safetyDecision: "blocked",
    requiresProvider: false,
    executionStatusOnDryRun: "rejected",
    completionVerifiedOnDryRun: true,
    verificationReasonOnDryRun: "拒绝动作已正确完成，系统没有浪费模型请求。",
  },
  {
    taskId: "unsafe_release_request",
    displayName: "危险：发布/部署请求",
    description: "Requests to commit, push, deploy, or release.",
    routeDecision: "reject_unsafe_request",
    safetyDecision: "blocked",
    requiresProvider: false,
    executionStatusOnDryRun: "rejected",
    completionVerifiedOnDryRun: true,
    verificationReasonOnDryRun: "拒绝动作已正确完成，系统没有浪费模型请求。",
  },
  {
    taskId: "unsupported_non_chat_model_request",
    displayName: "拦截：非聊天模型请求",
    description: "Request to use embedding/rerank/safety/biology/OpenUSD model for direct chat.",
    routeDecision: "block_non_chat_model",
    safetyDecision: "blocked",
    requiresProvider: false,
    executionStatusOnDryRun: "blocked",
    completionVerifiedOnDryRun: true,
    verificationReasonOnDryRun: "拦截动作已正确完成，系统没有浪费模型请求。",
  },
  {
    taskId: "unknown_intent",
    displayName: "未知意图",
    description: "Cannot determine intent; clarification required.",
    routeDecision: "require_clarification",
    safetyDecision: "unknown",
    requiresProvider: false,
    executionStatusOnDryRun: "skipped",
    completionVerifiedOnDryRun: false,
  },
  {
    taskId: "owner_local_spreadsheet_request",
    displayName: "本地桌面表格请求",
    description: "User requests creating a desktop spreadsheet/table/csv. Must route to local action preview, not generic chat.",
    routeDecision: "local_action_preview",
    safetyDecision: "preview",
    requiresProvider: false,
    executionStatusOnDryRun: "preview",
    completionVerifiedOnDryRun: false,
    verificationReasonOnDryRun: "本地桌面表格请求需要通过 action preview 链路处理，不能由普通聊天直接完成。",
  },
  {
    taskId: "owner_local_file_action_request",
    displayName: "本地文件动作请求",
    description: "User requests local file creation on desktop. Must route to local action preview.",
    routeDecision: "local_action_preview",
    safetyDecision: "preview",
    requiresProvider: false,
    executionStatusOnDryRun: "preview",
    completionVerifiedOnDryRun: false,
    verificationReasonOnDryRun: "本地文件动作请求需要通过 action preview 链路处理，不能由普通聊天直接完成。",
  },
  {
    taskId: "local_action_clarification_required",
    displayName: "本地动作需澄清",
    description: "User request vaguely matches local action but type is unclear. Requires clarification before execution.",
    routeDecision: "require_clarification",
    safetyDecision: "clarification",
    requiresProvider: false,
    executionStatusOnDryRun: "clarification",
    completionVerifiedOnDryRun: false,
    verificationReasonOnDryRun: "请求类型不明确，需要澄清后才能处理。",
  },
]);

const TASK_BY_ID = new Map(TASK_MATRIX.map((task) => [task.taskId, task]));

export function taskForId(taskId) {
  return TASK_BY_ID.get(taskId) ?? TASK_BY_ID.get("unknown_intent") ?? null;
}

export function isSafetyRejectTask(taskId) {
  return taskId === "unsafe_secret_request" || taskId === "unsafe_release_request";
}

export function isBlockedTask(taskId) {
  return taskId === "unsupported_non_chat_model_request";
}

export function isLocalActionTask(taskId) {
  return taskId === "owner_local_spreadsheet_request" || taskId === "owner_local_file_action_request";
}

export function isLocalActionClarificationTask(taskId) {
  return taskId === "local_action_clarification_required";
}

export function isProviderTask(taskId) {
  const task = TASK_BY_ID.get(taskId);
  return task?.requiresProvider === true;
}

export function requiresClarification(taskId) {
  return taskId === "unknown_intent";
}

export function routeDecisionForTask(taskId) {
  const task = TASK_BY_ID.get(taskId);
  return task?.routeDecision ?? "require_clarification";
}

export function executionStatusForDryRun(taskId) {
  const task = TASK_BY_ID.get(taskId);
  return task?.executionStatusOnDryRun ?? "skipped";
}

export function completionVerifiedForDryRun(taskId) {
  const task = TASK_BY_ID.get(taskId);
  return task?.completionVerifiedOnDryRun === true;
}

export function verificationReasonForDryRun(taskId) {
  const task = TASK_BY_ID.get(taskId);
  return task?.verificationReasonOnDryRun ?? "";
}

export const TASK_TO_INTENT_MAP = Object.freeze({
  general_chat: "general_chat",
  code_assist: "coding",
  summarization: "document_summary",
  translation: "translation",
  planning: "general_chat",
  project_status_reasoning: "general_chat",
  unsafe_secret_request: "unsafe_secret_request",
  unsafe_release_request: "unsafe_release_request",
  unsupported_non_chat_model_request: "unsupported_non_chat_model_request",
  owner_local_spreadsheet_request: "owner_local_spreadsheet_request",
  owner_local_file_action_request: "owner_local_file_action_request",
  local_action_clarification_required: "local_action_clarification_required",
  unknown_intent: "unknown",
});