import { DIRECT_CHAT_CAPABILITIES } from "../model-library/modelCapabilityRules.js";
import { findModel } from "../model-library/unifiedModelRegistry.js";
import { taskForId } from "./chatGatewayTaskMatrix.js";

const INTENT_CAPABILITY_PLAN = Object.freeze({
  general_chat: ["chat_general", "chat_reasoning"],
  code_assist: ["chat_coding", "chat_general", "chat_reasoning"],
  coding: ["chat_coding", "chat_general", "chat_reasoning"],
  debug_fix: ["chat_coding", "chat_general", "chat_reasoning"],
  summarization: ["rag_answer", "chat_general"],
  document_summary: ["rag_answer", "chat_general"],
  knowledge_query: ["embedding_text", "rerank", "rag_answer"],
  translation: ["translation"],
  planning: ["chat_general", "chat_reasoning"],
  project_status_reasoning: ["chat_general", "chat_reasoning"],
  safety_review: ["safety"],
  pii_scan: ["pii_detection"],
  image_understanding: ["multimodal_image"],
  voice_task: ["voice_chat", "voice_tts"],
});

const PHASE314A_BLOCKED_INTENTS = new Set([
  "unsafe_secret_request",
  "unsafe_release_request",
  "unsupported_non_chat_model_request",
]);

const PHASE314A_REQUIRES_CLARIFICATION = new Set([
  "unknown_intent",
  "unknown",
]);

const PHASE314A_TASK_ID_MAP = Object.freeze({
  general_chat: "general_chat",
  code_assist: "code_assist",
  coding: "code_assist",
  debug_fix: "code_assist",
  summarization: "summarization",
  document_summary: "summarization",
  knowledge_query: "summarization",
  translation: "translation",
  planning: "planning",
  project_status_reasoning: "project_status_reasoning",
  safety_review: "code_assist",
  pii_scan: "code_assist",
  image_understanding: "code_assist",
  voice_task: "code_assist",
  model_config_request: "unknown_intent",
  unsupported_task: "unsafe_release_request",
  unsafe_secret_request: "unsafe_secret_request",
  unsafe_release_request: "unsafe_release_request",
  unsupported_non_chat_model_request: "unsupported_non_chat_model_request",
  unknown: "unknown_intent",
  unknown_intent: "unknown_intent",
});

export function planGatewayModel({ registry, intent, mode = "automatic_gateway", selectedModel, taskToolPreference } = {}) {
  const intentType = intent?.intentType ?? "unknown";
  const requested = normalizeSelectedModel(selectedModel);
  const requiredCapabilities = capabilitiesFor(intentType, mode);
  const taskId = PHASE314A_TASK_ID_MAP[intentType] ?? "unknown_intent";
  const task = taskForId(taskId);

  const planBase = {
    mode,
    intentType,
    taskId,
    routeDecision: task?.routeDecision ?? "require_clarification",
    safetyDecision: task?.safetyDecision ?? "unknown",
    requiredCapabilities,
    selected: null,
    toolPlan: [],
    blocked: false,
    blocker: null,
    warnings: [],
    fallbackUsed: false,
    fallbackReason: "",
    plannedAt: new Date().toISOString(),
  };

  if (PHASE314A_BLOCKED_INTENTS.has(intentType)) {
    const code = intentType === "unsafe_secret_request" ? "reject_unsafe_secret_request"
      : intentType === "unsafe_release_request" ? "reject_unsafe_release_request"
      : "block_non_chat_model_request";
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code,
        message: "No provider call is allowed for this intent. Provider was NOT called.",
      },
    };
  }

  if (PHASE314A_REQUIRES_CLARIFICATION.has(intentType)) {
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code: "require_clarification",
        message: "Intent is unclear. Clarification required before calling provider.",
      },
    };
  }

  if (intentType === "unsupported_task" || intentType === "model_config_request") {
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code: intentType === "model_config_request" ? "model_config_request_no_model_call" : "unsupported_or_unknown_intent",
        message: "No provider call is allowed for this intent.",
      },
    };
  }

  if (requested.providerId && requested.modelId) {
    return planManualModel({ registry, requested, planBase, requiredCapabilities });
  }

  if (taskToolPreference?.providerId && taskToolPreference?.modelId) {
    const tool = findModel(registry, taskToolPreference.providerId, taskToolPreference.modelId);
    if (tool) {
      planBase.toolPlan.push({
        providerId: tool.providerId,
        modelId: tool.modelId,
        capability: tool.primaryCapability,
        selectable: tool.state?.selectable === true,
      });
    }
  }

  const selected = selectBestCandidate(registry, requiredCapabilities, intentType);
  if (!selected) {
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code: "no_smoke_passed_model_for_intent",
        message: `No smoke-passed selectable NVIDIA model is available for intent=${intentType}.`,
      },
    };
  }

  return {
    ...planBase,
    selected: {
      providerId: selected.providerId,
      modelId: selected.modelId,
      endpointType: selected.endpointType,
      endpointPath: selected.endpointPath,
      capability: selected.primaryCapability,
      directChat: selected.directChat,
    },
  };
}

function planManualModel({ registry, requested, planBase, requiredCapabilities }) {
  const model = findModel(registry, requested.providerId, requested.modelId);
  if (!model) {
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code: "manual_model_not_found",
        message: "The manually selected model is not in the unified model library.",
      },
    };
  }

  if (!model.state?.selectable) {
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code: "model_not_selectable",
        message: "The manually selected model is catalog-known but not selectable because no real smoke pass is recorded.",
      },
      selected: requested,
    };
  }

  if (!capabilityMatches(model, requiredCapabilities)) {
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code: "manual_model_capability_mismatch",
        message: `The selected model capability [${model.capabilities.join(", ")}] does not match required [${requiredCapabilities.join(", ")}].`,
      },
      selected: requested,
    };
  }

  if (requiresDirectChat(planBase.intentType) && !model.directChat) {
    return {
      ...planBase,
      blocked: true,
      blocker: {
        code: "task_tool_cannot_direct_chat",
        message: "This model cannot be sent to /chat/completions as a normal chat model; it is task-tool only.",
      },
      selected: requested,
    };
  }

  return {
    ...planBase,
    selected: {
      providerId: model.providerId,
      modelId: model.modelId,
      endpointType: model.endpointType,
      endpointPath: model.endpointPath,
      capability: model.primaryCapability,
      directChat: model.directChat,
      manual: true,
    },
  };
}

function selectBestCandidate(registry, requiredCapabilities, intentType) {
  const models = registry?.models ?? [];
  return models.find((model) => {
    if (!model.state?.selectable) return false;
    if (!capabilityMatches(model, requiredCapabilities)) return false;
    if (requiresDirectChat(intentType) && !model.directChat) return false;
    return true;
  });
}

function capabilityMatches(model, requiredCapabilities) {
  return requiredCapabilities.some((capability) => {
    if (model.capabilities.includes(capability)) return true;
    if (capability === "chat_general" && model.capabilities.some((item) => DIRECT_CHAT_CAPABILITIES.includes(item))) return true;
    if (capability === "rag_answer" && model.capabilities.some((item) => DIRECT_CHAT_CAPABILITIES.includes(item))) return true;
    return false;
  });
}

function capabilitiesFor(intentType, mode) {
  if (mode === "programming") return ["chat_coding"];
  if (mode === "knowledge") return ["embedding_text", "rerank", "rag_answer"];
  if (mode === "safety_review") return ["safety"];
  if (mode === "translation") return ["translation"];
  return INTENT_CAPABILITY_PLAN[intentType] ?? ["chat_general"];
}

function requiresDirectChat(intentType) {
  return ["general_chat", "code_assist", "coding", "debug_fix", "document_summary", "summarization", "planning", "project_status_reasoning"].includes(intentType);
}

function normalizeSelectedModel(selectedModel) {
  if (!selectedModel || typeof selectedModel !== "object") return {};
  return {
    providerId: String(selectedModel.providerId ?? "").trim(),
    modelId: String(selectedModel.modelId ?? selectedModel.model ?? "").trim(),
  };
}