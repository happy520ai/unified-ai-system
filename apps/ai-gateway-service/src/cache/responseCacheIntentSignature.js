import { createHash } from "node:crypto";

export function createIntentSignature(input = {}) {
  const text = String(input.normalizedQuery ?? input.query ?? "").toLowerCase();
  const queryLanguage = input.queryLanguage ?? "unknown";
  const intentSignature = inferIntent(text);
  const contractHash = shortHash(input.answerContract ?? {});
  const paraphraseGroupId = intentSignature === "unknown_intent"
    ? `unknown:${shortHash(text)}`
    : `intent:${intentSignature}:${queryLanguage}`;

  return {
    intentSignature,
    paraphraseGroupId,
    intentConfidence: intentSignature === "unknown_intent" ? "low" : "medium",
    queryLanguage,
    contractHash,
  };
}

function inferIntent(text) {
  if (includesAny(text, ["blocker", "blocked", "阻塞", "卡住", "瓶颈"])) return "current_blocker";
  if (includesAny(text, ["mimo", "米模", "availability", "可用"])) return "mimo_availability";
  if (includesAny(text, ["token", "cost", "saving", "省钱", "成本", "缓存"])) return "token_saving_capability";
  if (includesAny(text, ["next step", "continue", "下一步", "继续", "怎么做"])) return "next_step_recommendation";
  if (includesAny(text, ["codex", "task", "命令", "接入"])) return "codex_task_generation";
  if (includesAny(text, ["cache summary", "cache health", "缓存状态"])) return "cache_summary";
  if (includesAny(text, ["score", "capability", "有多强", "能力"])) return "system_capability_score";
  if (includesAny(text, ["paid api", "付费", "api safety"])) return "paid_api_safety";
  if (includesAny(text, ["production", "ready", "上线", "生产", "企业级"])) return "production_readiness";
  if (includesAny(text, ["status", "current", "latest", "情况", "现在", "目前"])) return "project_current_status";
  return "unknown_intent";
}

function includesAny(text, values) {
  return values.some((value) => text.includes(value));
}

function shortHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
