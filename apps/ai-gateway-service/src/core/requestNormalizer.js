import { createRequestId } from "../../../../packages/shared-utils/src/index.js";

const SUPPORTED_TASK_TYPES = new Set(["chat", "reasoning", "summary", "retrieval", "tool_use"]);

export function normalizeGatewayRequest(input) {
  if (!input || typeof input !== "object") {
    throw createValidationError("Gateway request body must be an object");
  }

  const messages = normalizeMessages(input.messages);
  const taskType = normalizeTaskType(input.taskType);
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

    if (typeof message.content !== "string") {
      throw createValidationError(`Message at index ${index} requires string content`);
    }

    return {
      role: normalizeRole(message.role),
      content: message.content,
      name: message.name,
      toolCallId: message.toolCallId,
      metadata: message.metadata ?? {},
    };
  });
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
