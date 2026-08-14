import {
  createRequestId,
  getMessageImageStats,
  hasImageContent,
  inspectInlineImageDataUrl,
} from "@unified-ai-system/shared-utils";

const SUPPORTED_TASK_TYPES = new Set(["chat", "reasoning", "summary", "retrieval", "tool_use"]);

export function normalizeGatewayRequest(input) {
  if (!input || typeof input !== "object") {
    throw createValidationError("Gateway request body must be an object");
  }

  const messages = normalizeMessages(input.messages);
  const taskType = normalizeTaskType(input.taskType);
  const requiredCapabilities = normalizeRequiredCapabilities(input.requiredCapabilities, messages);
  const requestId = input.context?.requestId ?? createRequestId();
  const traceId = input.context?.traceId ?? requestId;

  return {
    ...input,
    context: {
      ...(input.context ?? {}),
      requestId,
      traceId,
    },
    taskType,
    messages,
    requiredCapabilities,
    options: input.options ?? {},
    metadata: input.metadata ?? {},
  };
}

function normalizeTaskType(taskType) {
  if (typeof taskType !== "string" || taskType.length === 0) {
    return "chat";
  }

  if (!SUPPORTED_TASK_TYPES.has(taskType)) {
    throw createValidationError(`Unsupported taskType: ${taskType}`);
  }

  return taskType;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw createValidationError("Gateway request requires at least one message");
  }

  return messages.map((message, index) => {
    if (!message || typeof message !== "object") {
      throw createValidationError(`Message at index ${index} must be an object`);
    }

    return {
      role: normalizeRole(message.role),
      content: normalizeMessageContent(message.content, normalizeRole(message.role), index),
      name: message.name,
      toolCallId: message.toolCallId ?? message.tool_call_id,
      toolCalls: message.toolCalls ?? message.tool_calls,
      metadata: message.metadata ?? {},
    };
  });
}

function normalizeMessageContent(content, role, messageIndex) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.length === 0) {
    throw createValidationError(`Message at index ${messageIndex} requires text or content parts`);
  }

  let hasUsefulContent = false;
  const normalized = content.map((part, partIndex) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) {
      throw createValidationError(`Message content part ${messageIndex}:${partIndex} must be an object`);
    }
    if (part.type === "text" && typeof part.text === "string") {
      hasUsefulContent ||= part.text.trim().length > 0;
      return { type: "text", text: part.text };
    }
    if (part.type === "image_url") {
      if (role !== "user") {
        throw createValidationError("Inline image content is allowed only in user messages");
      }
      const detail = part.image_url?.detail ?? "auto";
      if (!new Set(["auto", "low", "high"]).has(detail)) {
        throw createValidationError(`Message image detail ${messageIndex}:${partIndex} is invalid`);
      }
      inspectInlineImageDataUrl(part.image_url?.url);
      hasUsefulContent = true;
      return {
        type: "image_url",
        image_url: { url: part.image_url.url, detail },
      };
    }
    throw createValidationError(`Message content part ${messageIndex}:${partIndex} is unsupported`);
  });

  if (!hasUsefulContent) {
    throw createValidationError(`Message at index ${messageIndex} cannot be empty`);
  }
  getMessageImageStats([{ role, content: normalized }]);
  return normalized;
}

function normalizeRequiredCapabilities(value, messages) {
  if (value !== undefined && !Array.isArray(value)) {
    throw createValidationError("requiredCapabilities must be an array");
  }
  const explicit = (value ?? []).map((capability) => {
    if (typeof capability !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(capability)) {
      throw createValidationError("requiredCapabilities contains an invalid capability");
    }
    return capability;
  });
  const inferred = messages.some((message) => hasImageContent(message.content)) ? ["vision"] : [];
  getMessageImageStats(messages);
  return [...new Set([...explicit, ...inferred])];
}

function normalizeRole(role) {
  if (role === "system" || role === "user" || role === "assistant" || role === "tool") {
    return role;
  }

  return "user";
}

function createValidationError(message) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.category = "validation";
  return error;
}
