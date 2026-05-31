export const GATEWAY_INTENTS = Object.freeze([
  "general_chat",
  "code_assist",
  "summarization",
  "coding",
  "debug_fix",
  "document_summary",
  "knowledge_query",
  "translation",
  "planning",
  "project_status_reasoning",
  "safety_review",
  "pii_scan",
  "image_understanding",
  "voice_task",
  "model_config_request",
  "unsafe_secret_request",
  "unsafe_release_request",
  "unsupported_non_chat_model_request",
  "unsupported_task",
  "unknown",
]);

export function classifyGatewayIntent(input = {}) {
  const text = extractText(input);
  const lower = text.toLowerCase();
  const reasons = [];
  let intentType = "general_chat";

  if (!text) {
    intentType = "unknown";
    reasons.push("empty_input");
  } else if (matches(lower, ["api key", "apikey", ".env", "secret", "credential", "token", "密码", "密钥", "泄露", "打印配置", "sk-", "nvapi-"])) {
    intentType = "unsafe_secret_request";
    reasons.push("unsafe_secret_keywords");
  } else if (matches(lower, ["commit", "push", "deploy", "release", "发布", "部署", "推送", "上线", "git push", "npm publish"])) {
    intentType = "unsafe_release_request";
    reasons.push("unsafe_release_keywords");
  } else if (matches(lower, ["用 embedding", "用 rerank", "用 safety 模型", "用 biology 模型", "用 pii 模型聊天", "用视频模型聊天", "用自动驾驶模型", "用 openusd"])) {
    intentType = "unsupported_non_chat_model_request";
    reasons.push("non_chat_model_keywords");
  } else if (matches(lower, ["模型", "model", "provider", "nvidia", "base url", "配置模型", "模型库"])) {
    intentType = "model_config_request";
    reasons.push("model_config_keywords");
  } else if (matches(lower, ["代码解释", "解释代码", "code explain", "code review", "代码审查", "refactor", "重构", "解释一下", "帮我解释"])) {
    intentType = "code_assist";
    reasons.push("code_assist_keywords");
  } else if (matches(lower, ["总结", "摘要", "summarize", "归纳", "概括", "总结文档", "总结文件"])) {
    intentType = "summarization";
    reasons.push("summarization_keywords");
  } else if (matches(lower, ["计划", "步骤", "规划", "方案制定", "plan", "roadmap", "road map"])) {
    intentType = "planning";
    reasons.push("planning_keywords");
  } else if (matches(lower, ["项目状态", "当前进度", "系统分析", "架构分析", "代码库分析", "项目概况"])) {
    intentType = "project_status_reasoning";
    reasons.push("project_status_keywords");
  } else if (matches(lower, ["翻译", "translate", "translation", "译成", "翻译成", "translate to"])) {
    intentType = "translation";
    reasons.push("translation_keywords");
  } else if (matches(lower, ["pii", "隐私", "个人信息", "手机号", "身份证", "email", "邮箱", "redact", "脱敏"])) {
    intentType = "pii_scan";
    reasons.push("pii_keywords");
  } else if (matches(lower, ["安全审核", "内容安全", "moderation", "safety", "unsafe", "jailbreak", "越狱", "毒性"])) {
    intentType = "safety_review";
    reasons.push("safety_keywords");
  } else if (matches(lower, ["图片", "图像", "image", "vision", "ocr", "截图", "看图"])) {
    intentType = "image_understanding";
    reasons.push("image_keywords");
  } else if (matches(lower, ["voice", "语音", "音频", "tts", "asr", "speech"])) {
    intentType = "voice_task";
    reasons.push("voice_keywords");
  } else if (matches(lower, ["debug", "报错", "修复", "fix", "bug", "stack trace", "异常", "失败"])) {
    intentType = "debug_fix";
    reasons.push("debug_keywords");
  } else if (matches(lower, ["代码", "coding", "program", "function", "typescript", "javascript", "node", "python", "实现"])) {
    intentType = "coding";
    reasons.push("coding_keywords");
  } else if (matches(lower, ["知识库", "资料", "引用", "rag", "检索", "根据文档", "source", "citation", "knowledge"])) {
    intentType = "knowledge_query";
    reasons.push("knowledge_keywords");
  } else if (matches(lower, ["训练 embedding", "批量训练", "paid api", "mimo"])) {
    intentType = "unsupported_task";
    reasons.push("phase312a_boundary_keywords");
  } else {
    reasons.push("default_general_chat");
  }

  return {
    intentType,
    confidence: confidenceFor(intentType, reasons),
    inputTextPreview: text.slice(0, 180),
    reasons,
    classifiedAt: new Date().toISOString(),
  };
}

function extractText(input) {
  if (typeof input === "string") return input.trim();
  const direct = input.prompt ?? input.input ?? input.message ?? input.query;
  if (typeof direct === "string") return direct.trim();
  if (Array.isArray(input.messages)) {
    const message = [...input.messages].reverse().find((item) => item?.role !== "assistant" && typeof item?.content === "string");
    return message?.content?.trim() ?? "";
  }
  return "";
}

function matches(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function confidenceFor(intentType, reasons) {
  if (intentType === "unknown") return 0.2;
  if (reasons.includes("default_general_chat")) return 0.55;
  if (intentType === "unsafe_secret_request" || intentType === "unsafe_release_request") return 0.95;
  return 0.82;
}