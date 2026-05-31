export const ANSWER_QUALITY_GATE_PREVIEW_VERSION = "phase276a-quality-gate-v1";

export function evaluateAnswerQualityGate(input = {}) {
  const query = String(input.query ?? "");
  const text = query.toLowerCase();
  const intentSignature = input.intentSignature ?? "unknown_intent";
  const requestedQualityLevel = input.requestedQualityLevel ?? inferRequestedQualityLevel(text);
  const riskLevel = input.riskLevel ?? inferRiskLevel(text);
  const requiredChecks = createRequiredChecks({ query: text, intentSignature, requestedQualityLevel, riskLevel, input });
  const qualityTarget = chooseQualityTarget({ intentSignature, requestedQualityLevel, riskLevel, text });
  const qualityGateRequired = requiredChecks.length > 0 && (
    ["high", "critical"].includes(riskLevel)
    || ["high", "near_perfect", "expert"].includes(requestedQualityLevel)
    || ["premium_reasoning", "expert_review", "multi_model_review"].includes(qualityTarget)
  );
  const escalationTarget = chooseEscalationTarget({ qualityTarget, riskLevel, requestedQualityLevel, text });

  return {
    qualityGateRequired,
    qualityGatePreview: true,
    qualityGateVersion: ANSWER_QUALITY_GATE_PREVIEW_VERSION,
    qualityTarget,
    qualityRisk: riskLevel,
    requiredChecks,
    escalationRecommended: Boolean(escalationTarget),
    escalationTarget,
    qualityReason: createQualityReason({ qualityTarget, riskLevel, requestedQualityLevel, intentSignature }),
    modelActuallyCalled: false,
    externalApiCalled: false,
    paidApiCallCount: 0,
  };
}

function createRequiredChecks({ query, intentSignature, requestedQualityLevel, riskLevel, input }) {
  const checks = ["answer_user_actual_question"];
  if (input.requiresFreshness || includesAny(query, ["current", "latest", "now", "next", "blocker", "\u5f53\u524d", "\u73b0\u5728", "\u6700\u65b0"])) checks.push("latest_evidence_check");
  if (input.selectedSources?.length > 0 || ["project_current_status", "mimo_availability", "token_saving_capability"].includes(intentSignature)) checks.push("evidence_reference_check");
  if (intentSignature === "codex_task_generation" || query.includes("codex")) checks.push("codex_command_template_check");
  if (query.includes("business") || query.includes("commercial") || query.includes("\u5546\u4e1a")) checks.push("commercial_report_structure_check");
  if (query.includes("production") || query.includes("\u751f\u4ea7")) checks.push("production_ready_claim_check");
  if (["high", "near_perfect", "expert"].includes(requestedQualityLevel)) checks.push("high_accuracy_check");
  if (["high", "critical"].includes(riskLevel)) checks.push("human_confirmation_check");
  if (query.includes("paid") || query.includes("premium") || query.includes("mimo") || query.includes("\u4ed8\u8d39")) checks.push("paid_model_preflight_check");
  checks.push("stale_evidence_risk_check");
  return [...new Set(checks)];
}

function chooseQualityTarget({ intentSignature, requestedQualityLevel, riskLevel, text }) {
  if (includesAny(text, ["multi model", "multiple models", "cross validate", "\u591a\u6a21\u578b", "\u4ea4\u53c9\u9a8c\u8bc1"])) return "multi_model_review";
  if (requestedQualityLevel === "near_perfect" || requestedQualityLevel === "expert" || riskLevel === "critical") return "expert_review";
  if (includesAny(text, ["business report", "architecture", "roadmap", "\u5546\u4e1a\u5316\u62a5\u544a", "\u6280\u672f\u8def\u7ebf"])) return "premium_reasoning";
  if (["project_current_status", "current_blocker", "mimo_availability"].includes(intentSignature)) return "enough_for_status";
  if (intentSignature === "codex_task_generation") return "enough_for_operational_decision";
  if (intentSignature === "token_saving_capability") return "enough_for_operational_decision";
  return "enough_for_operational_decision";
}

function chooseEscalationTarget({ qualityTarget, riskLevel, requestedQualityLevel, text }) {
  if (qualityTarget === "multi_model_review") return "multi_model_review";
  if (qualityTarget === "expert_review") return "expert_model";
  if (qualityTarget === "premium_reasoning") return "premium_model";
  if (requestedQualityLevel === "high" || riskLevel === "medium") return "standard_model";
  if (includesAny(text, ["budget", "\u9884\u7b97"])) return "standard_model";
  return null;
}

function createQualityReason({ qualityTarget, riskLevel, requestedQualityLevel, intentSignature }) {
  return `qualityTarget=${qualityTarget}; risk=${riskLevel}; requestedQuality=${requestedQualityLevel}; intent=${intentSignature}`;
}

function inferRequestedQualityLevel(text) {
  if (includesAny(text, ["near perfect", "cannot be wrong", "\u63a5\u8fd1\u5b8c\u7f8e", "\u4e0d\u80fd\u51fa\u9519"])) return "near_perfect";
  if (includesAny(text, ["high quality", "professional", "\u4e13\u4e1a", "\u9ad8\u8d28\u91cf"])) return "high";
  return "normal";
}

function inferRiskLevel(text) {
  if (includesAny(text, ["legal", "finance", "security", "audit", "\u6cd5\u52a1", "\u8d22\u52a1", "\u5b89\u5168", "\u5ba1\u8ba1"])) return "critical";
  if (includesAny(text, ["business", "architecture", "commercial", "\u5546\u4e1a", "\u67b6\u6784"])) return "high";
  return "low";
}

function includesAny(text, values) {
  return values.some((value) => text.includes(value));
}
