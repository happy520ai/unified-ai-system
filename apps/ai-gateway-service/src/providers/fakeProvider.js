import { abortableSleep, throwIfExecutionAborted, withTimeout } from "@unified-ai-system/shared-utils";
import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";

export function createFakeProvider(modelConfig, options = {}) {
  const fixedLatencyMs = modelConfig.fixedLatencyMs ?? 10;
  const descriptor = createProviderDescriptor(modelConfig, {
    metadata: {
      fake: true,
    },
    modelMetadata: {
      phase: "phase-6-real-provider-validation",
      fixedLatencyMs,
    },
  });

  return {
    descriptor,
    async generate(providerRequest) {
      throwIfExecutionAborted(providerRequest.execution?.signal);
      if (modelConfig.failMode === "retryable") {
        throw createFakeProviderError(providerRequest);
      }

      const startedAt = Date.now();
      const task = executeFakeGeneration(providerRequest, fixedLatencyMs, options);
      const result = await withTimeout(task, {
        timeoutMs: options.timeoutMs ?? 10_000,
        label: `${providerRequest.target.providerId}/${providerRequest.target.modelId}`,
      });

      return {
        ...result,
        latencyMs: Date.now() - startedAt,
      };
    },
    async *generateStream(providerRequest) {
      if (modelConfig.failMode === "retryable") {
        throw createFakeProviderError(providerRequest);
      }

      const certificationToolCall = createCertificationToolCall(providerRequest, options);
      if (certificationToolCall) {
        await abortableSleep(fixedLatencyMs, providerRequest.execution?.signal);
        yield {
          textDelta: "",
          raw: {
            fake: true,
            finishReason: "tool_calls",
            toolCallsDelta: [{ index: 0, ...certificationToolCall.raw }],
          },
        };
        return;
      }

      const result = await executeFakeGeneration(providerRequest, fixedLatencyMs, options);
      const parts = splitForStream(result.text);

      for (const part of parts) {
        await abortableSleep(Math.max(1, Math.min(fixedLatencyMs, 8)), providerRequest.execution?.signal);
        yield {
          textDelta: part,
          raw: {
            fake: true,
          },
        };
      }
    },
  };
}

async function executeFakeGeneration(providerRequest, fixedLatencyMs, options) {
  const { request, target } = providerRequest;
  const prompt = getLastUserText(request);
  const certificationToolCall = createCertificationToolCall(providerRequest, options);
  if (certificationToolCall) {
    await abortableSleep(fixedLatencyMs, providerRequest.execution?.signal);
    return createProviderResponse({
      text: "",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [certificationToolCall.raw],
      },
      toolCalls: [certificationToolCall.parsed],
      usage: {
        inputTokens: estimateTokens(prompt),
        outputTokens: 1,
        totalTokens: estimateTokens(prompt) + 1,
      },
      latencyMs: fixedLatencyMs,
      executionStatus: "success",
      raw: { fake: true, finishReason: "tool_calls" },
    });
  }
  const marker = `[fake:${target.providerId}/${target.modelId}] ${prompt}`;
  const text = request.options?.responseFormat === "json"
    ? createStructuredFakeResponse(request, marker)
    : marker;
  await abortableSleep(fixedLatencyMs, providerRequest.execution?.signal);

  return createProviderResponse({
    text,
    message: {
      role: "assistant",
      content: text,
    },
    usage: {
      inputTokens: estimateTokens(prompt),
      outputTokens: estimateTokens(text),
      totalTokens: estimateTokens(prompt) + estimateTokens(text),
    },
    latencyMs: fixedLatencyMs,
    executionStatus: "success",
  });
}

function createCertificationToolCall(providerRequest, options) {
  if (options.certificationToolMode !== "mcp-health-certification") return null;
  const request = providerRequest.request;
  if (getLastUserText(request) !== "Call gateway_health through unified-ai-system, then stop.") {
    return null;
  }
  if (request.messages.some((message) => message.role === "tool")) return null;

  const functionNames = (request.tools ?? [])
    .map((tool) => tool?.function?.name)
    .filter((name) => typeof name === "string");
  const functionName = functionNames.find((name) => name === "gateway_health")
    ?? functionNames.find((name) => name.endsWith("gateway_health"))
    ?? functionNames.find((name) => name === "use_mcp_tool");
  if (!functionName) return null;

  const argumentsObject = functionName === "use_mcp_tool"
    ? {
        server_name: "unified-ai-system",
        tool_name: "gateway_health",
        arguments: {},
      }
    : {};
  const argumentsJson = JSON.stringify(argumentsObject);
  const id = "call_unified_ai_mcp_certification";
  return {
    raw: {
      id,
      type: "function",
      function: {
        name: functionName,
        arguments: argumentsJson,
      },
    },
    parsed: {
      id,
      type: "function",
      name: functionName,
      arguments: argumentsObject,
    },
  };
}

function createStructuredFakeResponse(request, marker) {
  const responseFormat = request.metadata?.openAiCompatibility?.responseFormat;
  if (responseFormat?.type !== "json_schema") {
    return JSON.stringify({ response: marker });
  }

  const schema = responseFormat.json_schema?.schema;
  const value = createValueFromJsonSchema(schema, {
    rootSchema: schema,
    marker,
    seenRefs: new Set(),
    depth: 0,
  });
  return JSON.stringify(value);
}

function createValueFromJsonSchema(schema, context) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || context.depth > 12) {
    return context.marker;
  }

  if (typeof schema.$ref === "string") {
    if (context.seenRefs.has(schema.$ref)) return null;
    const resolved = resolveLocalJsonSchemaRef(context.rootSchema, schema.$ref);
    if (resolved) {
      return createValueFromJsonSchema(resolved, {
        ...context,
        seenRefs: new Set([...context.seenRefs, schema.$ref]),
        depth: context.depth + 1,
      });
    }
  }

  if (Object.hasOwn(schema, "const")) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.find((item) => item !== null) ?? schema.enum[0];
  }
  if (Object.hasOwn(schema, "default")) return schema.default;

  const union = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(union) && union.length > 0) {
    const selected = union.find((item) => !schemaAllowsOnlyNull(item)) ?? union[0];
    return createValueFromJsonSchema(selected, { ...context, depth: context.depth + 1 });
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const values = schema.allOf.map((item) => createValueFromJsonSchema(item, {
      ...context,
      depth: context.depth + 1,
    }));
    if (values.every((item) => isPlainObject(item))) {
      return Object.assign({}, ...values);
    }
    return values[0];
  }

  const schemaType = selectJsonSchemaType(schema);
  if (schemaType === "object") {
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    return Object.fromEntries(Object.entries(properties).map(([key, propertySchema]) => [
      key,
      createValueFromJsonSchema(propertySchema, { ...context, depth: context.depth + 1 }),
    ]));
  }
  if (schemaType === "array") {
    const itemCount = Math.max(1, Math.min(Number(schema.minItems) || 1, 3));
    return Array.from({ length: itemCount }, () => createValueFromJsonSchema(schema.items, {
      ...context,
      depth: context.depth + 1,
    }));
  }
  if (schemaType === "integer") {
    return selectNumericSchemaValue(schema, true);
  }
  if (schemaType === "number") {
    return selectNumericSchemaValue(schema, false);
  }
  if (schemaType === "boolean") return true;
  if (schemaType === "null") return null;
  return context.marker;
}

function resolveLocalJsonSchemaRef(rootSchema, reference) {
  if (!reference.startsWith("#/")) return null;
  return reference.slice(2).split("/").reduce((value, token) => {
    if (!isPlainObject(value)) return null;
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    return value[key];
  }, rootSchema);
}

function selectJsonSchemaType(schema) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const explicit = types.find((type) => type && type !== "null");
  if (explicit) return explicit;
  if (isPlainObject(schema.properties)) return "object";
  if (schema.items) return "array";
  return types[0] ?? "string";
}

function selectNumericSchemaValue(schema, integer) {
  let value = 1;
  if (Number.isFinite(schema.minimum)) value = Math.max(value, schema.minimum);
  if (Number.isFinite(schema.exclusiveMinimum)) value = Math.max(value, schema.exclusiveMinimum + 1);
  if (Number.isFinite(schema.maximum)) value = Math.min(value, schema.maximum);
  if (Number.isFinite(schema.exclusiveMaximum)) value = Math.min(value, schema.exclusiveMaximum - 1);
  return integer ? Math.trunc(value) : value;
}

function schemaAllowsOnlyNull(schema) {
  return schema?.type === "null" || (Array.isArray(schema?.type) && schema.type.every((item) => item === "null"));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getLastUserText(request) {
  const message = [...request.messages].reverse().find((item) => item.role === "user");
  return message?.content ?? "empty request";
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text).length / 4));
}


function createFakeProviderError(providerRequest) {
  const error = new Error("Fake provider was configured to fail for fallback verification.");
  error.code = "FAKE_PROVIDER_RETRYABLE_FAILURE";
  error.type = "fake";
  error.category = "provider";
  error.retryable = true;
  error.details = {
    providerId: providerRequest.target.providerId,
    modelId: providerRequest.target.modelId,
  };
  return error;
}

function splitForStream(text) {
  const parts = String(text).match(/.{1,12}/g);
  return parts?.length ? parts : [String(text)];
}
