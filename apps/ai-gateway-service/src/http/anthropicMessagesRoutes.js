// =============================================================================
// anthropicMessagesRoutes.js — Anthropic Messages 兼容协议
//
// 从 openAiCompatibilityRoutes.js 机械拆出（T-073 延续）：
// handleAnthropicMessages 与全部 normalize*/create* Anthropic 助手。
// 行为不变：原文件以 re-export 保持公开面，测试与导入方完全一致。
// =============================================================================

import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { MANAGED_LOCAL_CLIENT_PROVIDER_PIN } from "../core/gatewayService.js";
import { createLocalClientProviderDispatchBinding } from "../routing/localClientProviderDispatchBinding.ts";
import { getChatResponseCacheIntegration, readChatCacheBillingSnapshot } from "../cache/chatResponseCacheIntegration.ts";
import { captureGuardrailsOutputPolicy, getGuardrailsEngine, inspectGuardrailsOutputStream, inspectGuardrailsInputLimits, consumeGuardrailsGeneratedEmptyText } from "../guardrails/guardrailsEngine.ts";
import { resolveProviderDispatchHttpStatus } from "./providerDispatchHttpStatus.ts";
import {
  closePrimedGatewayStream,
  iteratePrimedGatewayStream,
  primeGatewayStream,
  readPrimedGatewayStreamError,
  resolveGatewayStreamPreflightStatus,
} from "./gatewayStreamPreflight.ts";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting, getVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { getVirtualKeyBillingSnapshot } from "../core/virtualKeyUsageAccounting.ts";
import {
  recordChatCacheEvent,
  recordChatRequest,
  recordChatTokens,
  recordChatTtft,
  recordChatVirtualKeyRejection,
  recordGuardrailEvaluation,
  recordGuardrailFinding,
} from "../observability/aiMetrics.ts";
import { getLangfuseCallback } from "../observability/langfuseCallback.ts";
import { applyPromptEnhancement } from "./utils/chatUtils.js";
import { injectRagContextIntoGatewayInput } from "./utils/ragInjection.js";
import {
  takeRawJsonRequestBody,
  readJson,
  writeJson,
  writeSseHeaders,
} from "./utils/responseUtils.js";
import {
  getMessageImageStats,
  inspectInlineImageDataUrl,
} from "@unified-ai-system/shared-utils";

import {
  ANTHROPIC_MESSAGES_PATH,
  MAX_CHOICE_COUNT,
  normalizeChoiceCount,
  applyNormalizedGuardrailsInputLimit,
  createOpenAiError,
  resolveVirtualKeyRequestAccounting,
  authorizeVirtualKeyRequest,
  applyVirtualKeyRequestGate,
  isRecord,
  estimateCompatibilityTokens,
  authenticateManagedLocalClientProtocolRequest,
  resolveManagedLocalClientProviderRoute,
  applyManagedLocalClientProviderRoute,
  createManagedLocalClientAuthError,
  resolveOpenAiModelTarget,
  normalizeUnifiedAiExtension,
  normalizeUnifiedAiRag,
  resolveOpenAiErrorStatus,
  validateOptionalBoolean,
  readRequiredString,
  readNumberInRange,
  createValidationError,
  createUnsupportedError,
} from "./openAiCompatibilityShared.js";

export async function handleAnthropicMessages({
  gatewayService,
  enterpriseGovernanceService,
  application,
  request,
  response,
  startedAt,
  writeServiceLog,
  url,
}) {
  let body;
  try {
    body = await readJson(request);
  } catch {
    writeJson(response, 400, createAnthropicError({
      code: "invalid_json",
      category: "validation",
      message: "Request body must be valid JSON.",
    }));
    return;
  }
  let managedLocalClientPrincipal = null;
  try {
    managedLocalClientPrincipal = await authenticateManagedLocalClientProtocolRequest({
      application,
      request,
      url,
      requestBody: body,
    });
  } catch (error) {
    writeJson(response, resolveOpenAiErrorStatus(error), createAnthropicError(error));
    return;
  }

  let gatewayInput;
  try {
    gatewayInput = normalizeAnthropicMessageRequest(
      body,
      gatewayService.getProviderDescriptors(),
    );
  } catch (error) {
    writeServiceLog?.("anthropic_messages_validation_failed", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      code: error?.code,
      param: error?.param,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, createAnthropicError(error));
    return;
  }

  // Inspect the actual normalized text once, including system and tool_result
  // messages. Original malformed blocks have already failed protocol validation.
  const anthropicGuardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
  const anthropicGuardrailVerdict = anthropicGuardrailsEngine.inspectInput({ messages: gatewayInput.messages });
  if (anthropicGuardrailVerdict.decision === "block") {
    recordGuardrailEvaluation("input", "block");
    for (const finding of anthropicGuardrailVerdict.findings) {
      if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
    }
    writeServiceLog?.("anthropic_messages_guardrail_blocked", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      findings: anthropicGuardrailVerdict.findings,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, createAnthropicError({
      code: "guardrail_blocked",
      category: "governance",
      message: "Request blocked by chat guardrails.",
      param: "messages",
    }));
    return;
  }
  if (anthropicGuardrailVerdict.findings.length) {
    recordGuardrailEvaluation("input", "allow");
    for (const finding of anthropicGuardrailVerdict.findings) {
      recordGuardrailFinding(finding.rule, finding.action);
    }
    writeServiceLog?.("anthropic_messages_guardrail_findings", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      findings: anthropicGuardrailVerdict.findings,
      durationMs: Date.now() - startedAt,
    });
  }
  for (const replacement of anthropicGuardrailVerdict.replacements) {
    gatewayInput.messages[replacement.index].content = replacement.content;
  }

  if (!applyNormalizedGuardrailsInputLimit(gatewayInput, anthropicGuardrailsEngine, anthropicGuardrailVerdict.findings)) {
    writeJson(response, 400, createAnthropicError({ code: "guardrail_blocked", category: "governance", param: "messages",
      message: "Normalized request exceeds the configured input character limit." }));
    return;
  }
  if (managedLocalClientPrincipal) {
    try {
      const managedRoute = await resolveManagedLocalClientProviderRoute({
        application,
        principal: managedLocalClientPrincipal,
        gatewayInput,
      });
      gatewayInput = applyManagedLocalClientProviderRoute(gatewayInput, managedRoute);
      response.setHeader("X-AI-Gateway-Local-Client-Routing", "policy-pinned");
      response.setHeader("X-AI-Gateway-Local-Client-Policy-Revision", managedRoute.policyRevision);
      response.setHeader("X-AI-Gateway-Local-Client-Revision", String(managedRoute.clientRevision));
      response.setHeader("X-AI-Gateway-Local-Client-Decision-Digest", managedRoute.decisionDigest);
    } catch (error) {
      writeJson(response, resolveOpenAiErrorStatus(error), createAnthropicError(error));
      return;
    }
  }

  if (body.stream === true) {
    await streamAnthropicMessage({
      body,
      gatewayInput,
      gatewayService,
      enterpriseGovernanceService,
      request,
      response,
      startedAt,
      writeServiceLog,
    });
    return;
  }

  if (applyVirtualKeyRequestGate({
    enterpriseGovernanceService,
    request,
    gatewayInput,
    response,
    writeServiceLog,
    startedAt,
    path: ANTHROPIC_MESSAGES_PATH,
    errorFactory: createAnthropicError,
  })) {
    return;
  }

  const result = await gatewayService.execute(gatewayInput);
  if (!result.success) {
    const error = result.error ?? {
      code: result.code,
      message: result.message,
      category: "provider",
    };
    writeServiceLog?.("anthropic_messages_failed", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      code: error.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, resolveOpenAiErrorStatus(error), createAnthropicError(
      error,
      result.meta?.requestId,
    ));
    return;
  }

  writeServiceLog?.("anthropic_messages_completed", {
    method: request.method,
    path: ANTHROPIC_MESSAGES_PATH,
    provider: result.data?.selectedProvider,
    model: result.data?.selectedModel,
    executionMode: result.data?.executionMode,
    durationMs: Date.now() - startedAt,
  });
  const anthropicMessage = createAnthropicMessage(result, {
    requestedModel: body.model,
    messages: gatewayInput.messages,
  });
  // Guardrails 输出侧（JSON）：对最终文本块脱敏/拦截，fail-open 不影响正常响应。
  const anthropicOutputText = anthropicMessage?.content
    ?.filter((block) => block?.type === "text")
    .map((block) => block?.text ?? "")
    .join("");
  if (typeof anthropicOutputText === "string" && anthropicOutputText) {
    const anthropicOutputVerdict = anthropicGuardrailsEngine.inspectOutputText(anthropicOutputText);
    if (anthropicOutputVerdict.decision === "block") {
      recordGuardrailEvaluation("output", "block");
      for (const finding of anthropicOutputVerdict.findings) {
        if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
      }
      writeServiceLog?.("anthropic_messages_guardrail_output_blocked", {
        method: request.method,
        path: ANTHROPIC_MESSAGES_PATH,
        findings: anthropicOutputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createAnthropicError({
        code: "guardrail_blocked",
        category: "governance",
        message: "Response blocked by chat guardrails.",
        param: "messages",
      }));
      return;
    }
    if (anthropicOutputVerdict.findings.length) {
      recordGuardrailEvaluation("output", "allow");
      for (const finding of anthropicOutputVerdict.findings) {
        recordGuardrailFinding(finding.rule, finding.action);
      }
    }
    if (anthropicOutputVerdict.text !== anthropicOutputText) {
      for (const block of anthropicMessage.content ?? []) {
        if (block?.type === "text" && block.text) {
          block.text = anthropicGuardrailsEngine.inspectOutputText(block.text).text;
        }
      }
    }
  }
  writeJson(response, 200, anthropicMessage);
}

export function normalizeAnthropicMessageRequest(body, descriptors = []) {
  if (!isRecord(body)) {
    throw createAnthropicValidationError("Request body must be a JSON object.", null);
  }

  const supportedFields = new Set([
    "model",
    "max_tokens",
    "messages",
    "system",
    "stop_sequences",
    "stream",
    "temperature",
    "top_p",
    "metadata",
    "tools",
    "tool_choice",
    "unified_ai",
    "provider_id",
    "prompt_enhancement",
  ]);
  for (const field of Object.keys(body)) {
    if (!supportedFields.has(field)) {
      throw createAnthropicUnsupportedError(
        `${field} is not supported by this Anthropic compatibility profile.`,
        field,
      );
    }
  }

  const requestedModel = readRequiredString(body.model, "model");
  if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1) {
    throw createAnthropicValidationError(
      "max_tokens must be a positive integer.",
      "max_tokens",
    );
  }
  validateOptionalBoolean(body.stream, "stream");

  const conversation = normalizeAnthropicConversation(body.messages);
  const systemText = normalizeAnthropicSystem(body.system);
  // prompt caching:system 块断点同样只接受 ephemeral,且计入 4 个总上限。
  const systemHasBreakpoint = Array.isArray(body.system)
    && body.system.some((block) => isRecord(block) && block.cache_control !== undefined);
  if (systemHasBreakpoint) {
    for (const [blockIndex, block] of body.system.entries()) {
      if (!isRecord(block) || block.cache_control === undefined) continue;
      if (!isRecord(block.cache_control) || block.cache_control.type !== "ephemeral") {
        throw createAnthropicValidationError(
          `system[${blockIndex}].cache_control must be { "type": "ephemeral" }.`,
          `system[${blockIndex}].cache_control`,
        );
      }
    }
    if (systemHasBreakpoint && conversation.cacheBreakpoints.length + 1 > 4) {
      throw createAnthropicValidationError(
        "At most 4 cache_control breakpoints are allowed per request.",
        "system",
      );
    }
  }
  const messages = systemText
    ? [{ role: "system", content: systemText }, ...conversation.messages]
    : conversation.messages;
  const target = resolveOpenAiModelTarget(requestedModel, descriptors);
  const extension = normalizeUnifiedAiExtension(body);
  const tools = normalizeAnthropicTools(body.tools);
  const toolChoice = normalizeAnthropicToolChoice(body.tool_choice, tools);
  const options = {
    maxOutputTokens: body.max_tokens,
  };

  if (body.temperature !== undefined) {
    options.temperature = readNumberInRange(body.temperature, "temperature", 0, 1);
  }
  if (body.top_p !== undefined) {
    options.topP = readNumberInRange(body.top_p, "top_p", 0, 1);
  }
  if (body.stop_sequences !== undefined) {
    if (
      !Array.isArray(body.stop_sequences)
      || body.stop_sequences.length > 4
      || body.stop_sequences.some((item) => typeof item !== "string" || item.length === 0)
    ) {
      throw createAnthropicValidationError(
        "stop_sequences must be an array of at most four non-empty strings.",
        "stop_sequences",
      );
    }
    if (body.stop_sequences.length > 0) {
      options.stopSequences = [...body.stop_sequences];
    }
  }
  // prompt caching:断点信息随 options 传递,出站 adapter 重挂到对应块。
  const anthropicCacheControl = {
    ...(systemHasBreakpoint ? { systemBreakpoint: true } : {}),
    ...(conversation.cacheBreakpoints.length > 0 ? { messageIndexes: conversation.cacheBreakpoints } : {}),
  };
  if (Object.keys(anthropicCacheControl).length > 0) {
    options.anthropicCacheControl = anthropicCacheControl;
  }

  let metadataUserIdPresent = false;
  if (body.metadata !== undefined) {
    if (!isRecord(body.metadata)) {
      throw createAnthropicValidationError("metadata must be an object.", "metadata");
    }
    for (const key of Object.keys(body.metadata)) {
      if (key !== "user_id") {
        throw createAnthropicUnsupportedError(
          `metadata.${key} is not supported by this Anthropic compatibility profile.`,
          `metadata.${key}`,
        );
      }
    }
    if (
      body.metadata.user_id !== undefined
      && (typeof body.metadata.user_id !== "string" || body.metadata.user_id.length > 256)
    ) {
      throw createAnthropicValidationError(
        "metadata.user_id must be a string no longer than 256 characters.",
        "metadata.user_id",
      );
    }
    metadataUserIdPresent = typeof body.metadata.user_id === "string";
  }

  const gatewayInput = {
    taskType: "chat",
    messages,
    model: target.modelId,
    providerId: extension.providerId ?? target.providerId,
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { toolChoice } : {}),
    options,
    metadata: {
      source: "anthropic-compatible-api",
      anthropicCompatibility: {
        requestedModel,
        stream: body.stream === true,
        systemPresent: Boolean(systemText),
        metadataUserIdPresent,
        ...(tools ? { toolCount: tools.length } : {}),
      },
    },
  };

  return extension.promptEnhancement?.enabled === true
    ? applyPromptEnhancement(gatewayInput, extension.promptEnhancement)
    : gatewayInput;
}

export function normalizeAnthropicConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw createAnthropicValidationError(
      "messages must contain at least one message.",
      "messages",
    );
  }

  const normalized = [];
  const cacheBreakpoints = [];
  let breakpointCount = 0;
  messages.forEach((message, index) => {
    const param = `messages[${index}]`;
    if (!isRecord(message)) {
      throw createAnthropicValidationError(`${param} must be an object.`, param);
    }
    for (const key of Object.keys(message)) {
      if (key !== "role" && key !== "content") {
        throw createAnthropicUnsupportedError(
          `${param}.${key} is not supported by this Anthropic compatibility profile.`,
          `${param}.${key}`,
        );
      }
    }
    if (message.role !== "user" && message.role !== "assistant") {
      throw createAnthropicValidationError(
        `${param}.role must be 'user' or 'assistant'.`,
        param,
      );
    }
    // prompt caching:cache_control 断点(仅支持 ephemeral)。
    // 断点按消息级记录(Anthropic 上限 4 个),并在出站侧重挂到该消息最后一块。
    if (Array.isArray(message.content)) {
      for (const [blockIndex, block] of message.content.entries()) {
        if (!isRecord(block) || block.cache_control === undefined) continue;
        if (!isRecord(block.cache_control) || block.cache_control.type !== "ephemeral") {
          throw createAnthropicValidationError(
            `${param}.content[${blockIndex}].cache_control must be { "type": "ephemeral" }.`,
            `${param}.content[${blockIndex}].cache_control`,
          );
        }
        breakpointCount += 1;
        if (breakpointCount > 4) {
          throw createAnthropicValidationError(
            "At most 4 cache_control breakpoints are allowed per request.",
            "messages",
          );
        }
      }
    }
    const produced = normalizeAnthropicMessageBlocks(message, param);
    const hadBreakpoint = Array.isArray(message.content)
      && message.content.some((block) => isRecord(block) && block.cache_control !== undefined);
    normalized.push(...produced);
    if (hadBreakpoint) {
      cacheBreakpoints.push(normalized.length - 1);
    }
  });
  return { messages: normalized, cacheBreakpoints };
}

// One Anthropic message can flatten into several gateway messages:
// assistant tool_use blocks become tool_calls on the assistant message, and
// user tool_result blocks become follow-up `tool` messages.
function normalizeAnthropicMessageBlocks(message, param) {
  if (typeof message.content === "string") {
    return [{ role: message.role, content: message.content }];
  }
  if (!Array.isArray(message.content) || message.content.length === 0) {
    throw createAnthropicValidationError(
      `${param}.content must be a string or a non-empty array of content blocks.`,
      `${param}.content`,
    );
  }

  const textParts = [];
  const toolUses = [];
  const toolResults = [];
  message.content.forEach((block, index) => {
    const blockParam = `${param}.content[${index}]`;
    if (!isRecord(block)) {
      throw createAnthropicValidationError(`${blockParam} must be an object.`, blockParam);
    }
    if (block.type === "text") {
      const generatedEmpty = consumeGuardrailsGeneratedEmptyText(block)
        && typeof block.text === "string" && !block.text.trim();
      if (!generatedEmpty) readRequiredString(block.text, `${blockParam}.text`);
      textParts.push(generatedEmpty ? "" : block.text);
      return;
    }
    if (block.type === "tool_use") {
      if (message.role !== "assistant") {
        throw createAnthropicValidationError(
          `${blockParam} tool_use blocks are allowed only in assistant messages.`,
          blockParam,
        );
      }
      toolUses.push({
        id: readRequiredString(block.id, `${blockParam}.id`),
        name: readRequiredString(block.name, `${blockParam}.name`),
        input: isRecord(block.input) || block.input === undefined ? block.input ?? {} : block.input,
      });
      return;
    }
    if (block.type === "tool_result") {
      if (message.role !== "user") {
        throw createAnthropicValidationError(
          `${blockParam} tool_result blocks are allowed only in user messages.`,
          blockParam,
        );
      }
      toolResults.push({
        toolUseId: readRequiredString(block.tool_use_id, `${blockParam}.tool_use_id`),
        content: normalizeAnthropicToolResultContent(block.content, `${blockParam}.content`),
      });
      return;
    }
    throw createAnthropicUnsupportedError(
      `${blockParam}.type '${String(block.type)}' is not supported; only text, tool_use, and tool_result blocks are enabled.`,
      `${blockParam}.type`,
    );
  });

  const text = textParts.join("");
  if (message.role === "assistant") {
    return [{
      role: "assistant",
      content: text,
      ...(toolUses.length > 0 ? {
        tool_calls: toolUses.map((use) => ({
          id: use.id,
          type: "function",
          function: { name: use.name, arguments: JSON.stringify(use.input ?? {}) },
        })),
      } : {}),
    }];
  }

  const out = [];
  // Tool results must directly follow the assistant tool_use turn on the
  // chat wire, so they are emitted before the remaining user text.
  for (const result of toolResults) {
    out.push({
      role: "tool",
      tool_call_id: result.toolUseId,
      content: result.content,
    });
  }
  if (text.trim() || toolResults.length === 0) {
    out.push({ role: "user", content: text });
  }
  return out;
}

function normalizeAnthropicToolResultContent(content, param) {
  if (content === undefined || content === null) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) {
    throw createAnthropicValidationError(
      `${param} must be a string or an array of text blocks.`,
      param,
    );
  }
  return content.map((block, index) => {
    const blockParam = `${param}[${index}]`;
    if (!isRecord(block) || block.type !== "text") {
      throw createAnthropicUnsupportedError(
        `${blockParam} only text blocks are supported inside tool_result content.`,
        blockParam,
      );
    }
    readRequiredString(block.text, `${blockParam}.text`);
    return block.text;
  }).join("\n");
}

function normalizeAnthropicTools(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw createAnthropicValidationError("tools must be an array.", "tools");
  }
  if (value.length === 0) return undefined;
  if (value.length > 128) {
    throw createAnthropicValidationError("tools cannot contain more than 128 entries.", "tools");
  }
  return value.map((tool, index) => {
    const param = `tools[${index}]`;
    if (!isRecord(tool)) {
      throw createAnthropicValidationError(`${param} must be an object.`, param);
    }
    const fn = { name: readRequiredString(tool.name, `${param}.name`) };
    if (tool.description !== undefined && tool.description !== null) {
      if (typeof tool.description !== "string") {
        throw createAnthropicValidationError(`${param}.description must be a string.`, `${param}.description`);
      }
      fn.description = tool.description;
    }
    if (tool.input_schema !== undefined && tool.input_schema !== null) {
      if (!isRecord(tool.input_schema)) {
        throw createAnthropicValidationError(`${param}.input_schema must be an object.`, `${param}.input_schema`);
      }
      fn.parameters = tool.input_schema;
    }
    return { type: "function", function: fn };
  });
}

function normalizeAnthropicToolChoice(value, tools) {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw createAnthropicValidationError("tool_choice must be an object.", "tool_choice");
  }
  if (value.type === "auto") return "auto";
  if (value.type === "any") return "required";
  if (value.type === "tool") {
    const name = readRequiredString(value.name, "tool_choice.name");
    return { type: "function", function: { name } };
  }
  throw createAnthropicUnsupportedError(
    "tool_choice.type must be 'auto', 'any', or 'tool'.",
    "tool_choice.type",
  );
}

function normalizeAnthropicSystem(system) {
  if (system === undefined || system === null) return "";
  return normalizeAnthropicTextContent(system, "system");
}

function normalizeAnthropicTextContent(content, param) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.length === 0) {
    throw createAnthropicValidationError(
      `${param} must be a string or a non-empty array of text blocks.`,
      param,
    );
  }

  return content.map((block, index) => {
    const blockParam = `${param}[${index}]`;
    if (!isRecord(block)) {
      throw createAnthropicValidationError(`${blockParam} must be an object.`, blockParam);
    }
    if (block.type !== "text") {
      throw createAnthropicUnsupportedError(
        `${blockParam}.type '${String(block.type)}' is not supported; only text blocks are enabled.`,
        `${blockParam}.type`,
      );
    }
    for (const key of Object.keys(block)) {
      // cache_control 由装配层的 prompt-caching 校验单独处理并重挂出站。
      if (key !== "type" && key !== "text" && key !== "cache_control") {
        throw createAnthropicUnsupportedError(
          `${blockParam}.${key} is not supported by this Anthropic compatibility profile.`,
          `${blockParam}.${key}`,
        );
      }
    }
    const generatedEmpty = consumeGuardrailsGeneratedEmptyText(block)
      && typeof block.text === "string" && !block.text.trim();
    if (!generatedEmpty) readRequiredString(block.text, `${blockParam}.text`);
    return generatedEmpty ? "" : block.text;
  }).join("");
}

export function createAnthropicMessage(result, options = {}) {
  const data = result.data ?? {};
  const text = data.message?.content ?? data.outputText ?? data.text ?? "";
  const usage = data.usage ?? {};
  const inputTokens = usage.inputTokens ?? estimateAnthropicInputTokens(options.messages);
  const cacheRead = usage.cacheReadInputTokens ?? 0;
  const cacheCreation = usage.cacheCreationInputTokens ?? 0;
  const hasCacheBreakdown = (usage.cacheReadInputTokens !== undefined || usage.cacheCreationInputTokens !== undefined)
    && Number.isSafeInteger(cacheRead) && cacheRead >= 0
    && Number.isSafeInteger(cacheCreation) && cacheCreation >= 0
    && Number.isSafeInteger(cacheRead + cacheCreation) && cacheRead + cacheCreation <= inputTokens;
  const requestId = result.meta?.requestId ?? data.id;
  const toolCalls = readAnthropicToolCalls(data.message);

  const content = [];
  if (String(text).trim() || toolCalls.length === 0) {
    content.push({ type: "text", text: String(text) });
  }
  for (const toolCall of toolCalls) {
    content.push({
      type: "tool_use",
      id: toolCall.id,
      name: toolCall.function.name,
      input: safeParseAnthropicToolInput(toolCall.function.arguments),
    });
  }

  return {
    id: toAnthropicMessageId(data.id ?? requestId),
    type: "message",
    role: "assistant",
    model: data.selectedModel ?? data.model ?? options.requestedModel,
    content,
    stop_reason: toolCalls.length > 0
      ? "tool_use"
      : normalizeAnthropicStopReason(data.finishReason),
    stop_sequence: data.stopSequence ?? null,
    usage: {
      input_tokens: inputTokens - (hasCacheBreakdown ? cacheRead + cacheCreation : 0),
      output_tokens: usage.outputTokens ?? estimateCompatibilityTokens(text),
      ...(hasCacheBreakdown ? { cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheCreation } : {}),
    },
    unified_ai: createAnthropicUnifiedAiMetadata(data, requestId),
  };
}

function readAnthropicToolCalls(message) {
  const raw = message?.tool_calls ?? message?.toolCalls;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((toolCall) => toolCall?.function && typeof toolCall.function.name === "string")
    .map((toolCall) => ({
      id: toolCall.id ?? `toolu_${String(toolCall.function.name).slice(0, 12)}_${Date.now()}`,
      function: {
        name: toolCall.function.name,
        arguments: typeof toolCall.function.arguments === "string"
          ? toolCall.function.arguments
          : JSON.stringify(toolCall.function.arguments ?? {}),
      },
    }));
}

function safeParseAnthropicToolInput(argumentsText) {
  if (typeof argumentsText !== "string" || !argumentsText.trim()) return {};
  try {
    const parsed = JSON.parse(argumentsText);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return { _raw: argumentsText };
  }
}

export function createAnthropicError(error, requestId) {
  const category = error?.category ?? error?.type;
  const type = category === "auth"
    ? "authentication_error"
    : category === "rate_limit"
      ? "rate_limit_error"
      : category === "validation" || category === "routing"
        ? "invalid_request_error"
        : "api_error";
  return {
    type: "error",
    error: {
      type,
      message: error?.message ?? "Anthropic-compatible request failed.",
    },
    ...(requestId ? { request_id: requestId } : {}),
  };
}

async function streamAnthropicMessage({
  body,
  gatewayInput,
  gatewayService,
  enterpriseGovernanceService,
  request,
  response,
  startedAt,
  writeServiceLog,
}) {
  if (applyVirtualKeyRequestGate({
    enterpriseGovernanceService,
    request,
    gatewayInput,
    response,
    writeServiceLog,
    startedAt,
    path: ANTHROPIC_MESSAGES_PATH,
    errorFactory: createAnthropicError,
  })) {
    return;
  }

  let clientClosed = false;
  let failed = false;
  let started = false;
  let contentBlockStarted = false;
  let messageId = null;
  let selectedModel = body.model;
  let selectedProvider = null;
  let executionMode = null;
  let outputText = "";
  let finalEvent = null;
  const accumulatedToolCalls = new Map();
  const inputTokens = estimateAnthropicInputTokens(gatewayInput.messages);
  const outputPolicy = captureGuardrailsOutputPolicy(getGuardrailsEngine(request.enterpriseIdentity?.tenantId));

  response.on("close", () => {
    clientClosed = true;
  });
  const primedStream = await primeGatewayStream(gatewayService.executeStream(gatewayInput));
  const preflightError = readPrimedGatewayStreamError(primedStream);
  const preflightStatus = resolveGatewayStreamPreflightStatus(preflightError?.code);
  if (preflightError && preflightStatus !== null) {
    await closePrimedGatewayStream(primedStream);
    writeServiceLog?.("anthropic_messages_stream_failed", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      code: preflightError.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(
      response,
      preflightStatus,
      createAnthropicError(preflightError),
    );
    return;
  }
  writeSseHeaders(response);

  const ensureStarted = (event = {}) => {
    if (started || clientClosed) return;
    messageId = toAnthropicMessageId(event.requestId);
    selectedModel = event.selectedModel ?? selectedModel;
    selectedProvider = event.selectedProvider ?? selectedProvider;
    executionMode = event.executionMode ?? executionMode;
    writeAnthropicSseEvent(response, "message_start", {
      type: "message_start",
      message: {
        id: messageId,
        type: "message",
        role: "assistant",
        model: selectedModel,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: 0 },
        unified_ai: createAnthropicUnifiedAiMetadata({
          selectedProvider,
          selectedModel,
          executionMode,
        }, event.requestId),
      },
    });
    writeAnthropicSseEvent(response, "content_block_start", {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });
    contentBlockStarted = true;
    started = true;
  };

  for await (const event of inspectGuardrailsOutputStream(iteratePrimedGatewayStream(primedStream), outputPolicy, () => clientClosed)) {
    if (clientClosed) break;
    if (event.type === "error") {
      failed = true;
      writeAnthropicSseEvent(
        response,
        "error",
        createAnthropicError(event.envelope?.error ?? event.envelope, event.requestId),
      );
      break;
    }

    ensureStarted(event);
    selectedModel = event.selectedModel ?? selectedModel;
    selectedProvider = event.selectedProvider ?? selectedProvider;
    executionMode = event.executionMode ?? executionMode;
    if (event.type === "chunk" && typeof event.textDelta === "string" && event.textDelta) {
      outputText += event.textDelta;
      writeAnthropicSseEvent(response, "content_block_delta", {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: event.textDelta },
      });
    }
    if (Array.isArray(event.rawProviderMeta?.toolCallsDelta)) {
      for (const deltaCall of event.rawProviderMeta.toolCallsDelta) {
        if (!deltaCall || typeof deltaCall !== "object") continue;
        const index = Number.isInteger(deltaCall.index) ? deltaCall.index : 0;
        const current = accumulatedToolCalls.get(index) ?? {
          id: null,
          function: { name: "", arguments: "" },
        };
        if (typeof deltaCall.id === "string" && deltaCall.id) current.id = deltaCall.id;
        if (deltaCall.function?.name) current.function.name += deltaCall.function.name;
        if (typeof deltaCall.function?.arguments === "string") {
          current.function.arguments += deltaCall.function.arguments;
        }
        accumulatedToolCalls.set(index, current);
      }
    }
    if (event.type === "done") finalEvent = event;
  }

  writeServiceLog?.(failed ? "anthropic_messages_stream_failed" : "anthropic_messages_stream_completed", {
    method: request.method,
    path: ANTHROPIC_MESSAGES_PATH,
    model: selectedModel,
    provider: selectedProvider,
    executionMode,
    durationMs: Date.now() - startedAt,
  });
  if (!failed) {
  }

  if (!clientClosed) {
    if (!failed) {
      ensureStarted(finalEvent ?? {});
      const streamedToolCalls = [...accumulatedToolCalls.values()]
        .filter((call) => call.function.name);
      if (contentBlockStarted) {
        writeAnthropicSseEvent(response, "content_block_stop", {
          type: "content_block_stop",
          index: 0,
        });
      }
      // Tool calls are emitted as complete tool_use blocks (start + one full
      // input_json_delta + stop) after the text block.
      streamedToolCalls.forEach((call, callIndex) => {
        const blockIndex = callIndex + 1;
        const blockId = call.id ?? `toolu_stream_${blockIndex}`;
        writeAnthropicSseEvent(response, "content_block_start", {
          type: "content_block_start",
          index: blockIndex,
          content_block: {
            type: "tool_use",
            id: blockId,
            name: call.function.name,
            input: {},
          },
        });
        writeAnthropicSseEvent(response, "content_block_delta", {
          type: "content_block_delta",
          index: blockIndex,
          delta: {
            type: "input_json_delta",
            partial_json: call.function.arguments || "{}",
          },
        });
        writeAnthropicSseEvent(response, "content_block_stop", {
          type: "content_block_stop",
          index: blockIndex,
        });
      });
      writeAnthropicSseEvent(response, "message_delta", {
        type: "message_delta",
        delta: {
          stop_reason: streamedToolCalls.length > 0
            ? "tool_use"
            : normalizeAnthropicStopReason(finalEvent?.rawProviderMeta?.finishReason),
          stop_sequence: null,
        },
        usage: { output_tokens: estimateCompatibilityTokens(outputText) },
      });
      writeAnthropicSseEvent(response, "message_stop", { type: "message_stop" });
    }
    response.end();
  }
}

function writeAnthropicSseEvent(response, eventName, data) {
  if (!response.writableEnded && !response.destroyed) {
    response.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

function createAnthropicValidationError(message, param) {
  return Object.assign(new Error(message), {
    code: "invalid_request",
    category: "validation",
    param,
  });
}

function createAnthropicUnsupportedError(message, param) {
  return Object.assign(new Error(message), {
    code: "unsupported_parameter",
    category: "validation",
    param,
  });
}

function toAnthropicMessageId(value) {
  const normalized = String(value ?? Date.now().toString(36))
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 96);
  return normalized.startsWith("msg_") ? normalized : `msg_${normalized || "generated"}`;
}

function normalizeAnthropicStopReason(value) {
  if (value === "max_tokens" || value === "length") return "max_tokens";
  if (value === "tool_use" || value === "tool_calls") return "tool_use";
  if (value === "stop_sequence") return "stop_sequence";
  return "end_turn";
}

function estimateAnthropicInputTokens(messages = []) {
  const text = (messages ?? []).map((message) => message?.content ?? "").join("\n");
  return estimateCompatibilityTokens(text);
}

function createAnthropicUnifiedAiMetadata(data = {}, requestId) {
  return {
    provider_id: data.selectedProvider ?? data.providerId ?? null,
    model: data.selectedModel ?? data.model ?? null,
    execution_mode: data.executionMode ?? null,
    request_id: requestId ?? null,
  };
}
