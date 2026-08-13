import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  context,
  trace,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const INSTRUMENTATION_NAME = "@unified-ai-system/ai-gateway-service";
const INSTRUMENTATION_VERSION = "0.1.0";
const DEFAULT_EXPORT_TIMEOUT_MS = 10_000;
const DEFAULT_SAMPLE_RATIO = 1;
const TRACE_HEADER_GETTER = Object.freeze({
  get(carrier, key) {
    const value = carrier?.[key.toLowerCase()] ?? carrier?.[key];
    return Array.isArray(value) ? value[0] : value;
  },
  keys(carrier) {
    return Object.keys(carrier ?? {});
  },
});
const TRACE_HEADER_SETTER = Object.freeze({
  set(carrier, key, value) {
    carrier[key] = value;
  },
});

let contextManagerRegistered = false;

export function createOpenTelemetryRuntime(options = {}) {
  const env = options.env ?? process.env;
  const enabled = readBoolean(env.AI_GATEWAY_OTEL_ENABLED, true);
  if (!enabled) return createDisabledRuntime();

  const serviceName = readNonEmptyString(
    env.OTEL_SERVICE_NAME ?? env.AI_GATEWAY_OTEL_SERVICE_NAME,
    "unified-ai-gateway",
  );
  const serviceVersion = readNonEmptyString(
    env.AI_GATEWAY_OTEL_SERVICE_VERSION,
    INSTRUMENTATION_VERSION,
  );
  const sampleRatio = readRatio(env.AI_GATEWAY_OTEL_SAMPLE_RATIO, DEFAULT_SAMPLE_RATIO);
  const endpoint = normalizeOtlpTraceEndpoint(env);
  const processors = [];

  if (options.spanExporter) {
    processors.push(new SimpleSpanProcessor(options.spanExporter));
  } else if (endpoint) {
    const exporter = new OTLPTraceExporter({
      url: endpoint,
      timeoutMillis: readPositiveInteger(
        env.AI_GATEWAY_OTEL_EXPORT_TIMEOUT_MS,
        DEFAULT_EXPORT_TIMEOUT_MS,
      ),
      headers: {},
    });
    processors.push(readExporterMode(env.AI_GATEWAY_OTEL_EXPORTER_MODE) === "simple"
      ? new SimpleSpanProcessor(exporter)
      : new BatchSpanProcessor(exporter));
  }

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      "deployment.environment.name": readNonEmptyString(
        env.NODE_ENV,
        "development",
      ),
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(sampleRatio),
    }),
    spanProcessors: processors,
  });
  const propagator = new W3CTraceContextPropagator();
  if (!contextManagerRegistered && options.registerGlobal !== false) {
    provider.register({ propagator });
    contextManagerRegistered = true;
  }
  const tracer = provider.getTracer(INSTRUMENTATION_NAME, INSTRUMENTATION_VERSION);

  function startHttpRequest({ request, response, url, startedAt = Date.now() }) {
    const parentContext = propagator.extract(
      ROOT_CONTEXT,
      request?.headers ?? {},
      TRACE_HEADER_GETTER,
    );
    const span = tracer.startSpan(
      `${String(request?.method ?? "HTTP").toUpperCase()} ${url?.pathname ?? "/"}`,
      {
        kind: SpanKind.SERVER,
        startTime: startedAt,
        attributes: compactAttributes({
          "http.request.method": String(request?.method ?? "GET").toUpperCase(),
          "url.path": url?.pathname ?? "/",
          "url.scheme": url?.protocol?.replace(/:$/, "") ?? "http",
          "server.address": url?.hostname,
          "server.port": parseOptionalPort(url),
          "user_agent.original": readHeader(request?.headers, "user-agent"),
        }),
      },
      parentContext,
    );
    const activeContext = trace.setSpan(parentContext, span);
    const spanContext = span.spanContext();
    const carrier = {};
    propagator.inject(activeContext, carrier, TRACE_HEADER_SETTER);

    if (response && !response.headersSent) {
      if (carrier.traceparent) response.setHeader("traceparent", carrier.traceparent);
      if (carrier.tracestate) response.setHeader("tracestate", carrier.tracestate);
      response.setHeader("x-trace-id", spanContext.traceId);
    }
    if (request) {
      request.traceContext = {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags,
      };
    }

    let ended = false;
    const end = (reason = "finish") => {
      if (ended) return;
      ended = true;
      const statusCode = Number(response?.statusCode) || 0;
      if (statusCode > 0) span.setAttribute("http.response.status_code", statusCode);
      if (reason === "close" && !response?.writableEnded) {
        span.setAttribute("error.type", "client_disconnect");
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else if (statusCode >= 500) {
        span.setAttribute("error.type", `http_${statusCode}`);
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
    };
    response?.once?.("finish", () => end("finish"));
    response?.once?.("close", () => end("close"));

    return {
      context: activeContext,
      span,
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceparent: carrier.traceparent ?? null,
      run(callback) {
        return context.with(activeContext, callback);
      },
      end,
    };
  }

  function instrumentGatewayService(gatewayService) {
    if (!gatewayService || typeof gatewayService !== "object") return gatewayService;
    return new Proxy(gatewayService, {
      get(target, property, receiver) {
        if (property === "execute") {
          return (input, execution) => traceGatewayExecute(target, tracer, input, execution);
        }
        if (property === "executeStream") {
          return (input, execution) => traceGatewayStream(target, tracer, input, execution);
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  return {
    enabled: true,
    exporterConfigured: Boolean(endpoint || options.spanExporter),
    endpoint,
    serviceName,
    sampleRatio,
    startHttpRequest,
    instrumentGatewayService,
    forceFlush: () => provider.forceFlush(),
    shutdown: () => provider.shutdown(),
  };
}

async function traceGatewayExecute(gatewayService, tracer, input, execution) {
  const parentContext = context.active();
  const span = startGenAiSpan(tracer, input, parentContext);
  const activeContext = trace.setSpan(parentContext, span);
  try {
    const result = await context.with(activeContext, () => gatewayService.execute(input, execution));
    finishGenAiSpan(span, result);
    return result;
  } catch (error) {
    failSpan(span, error);
    throw error;
  } finally {
    span.end();
  }
}

async function* traceGatewayStream(gatewayService, tracer, input, execution) {
  const parentContext = context.active();
  const span = startGenAiSpan(tracer, input, parentContext);
  const activeContext = trace.setSpan(parentContext, span);
  let finalEvent = null;
  let iterator = null;
  try {
    iterator = context.with(activeContext, () => (
      gatewayService.executeStream(input, execution)[Symbol.asyncIterator]()
    ));
    while (true) {
      const step = await context.with(activeContext, () => iterator.next());
      if (step.done) break;
      finalEvent = step.value;
      if (finalEvent?.type === "error") {
        span.setAttribute("error.type", normalizeErrorType(
          finalEvent.envelope?.error?.code ?? finalEvent.envelope?.code ?? "provider_error",
        ));
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      yield finalEvent;
    }
    finishGenAiStreamSpan(span, finalEvent);
  } catch (error) {
    failSpan(span, error);
    throw error;
  } finally {
    if (iterator?.return) {
      await context.with(activeContext, () => iterator.return()).catch(() => {});
    }
    span.end();
  }
}

function startGenAiSpan(tracer, input = {}, parentContext) {
  const operationName = normalizeOperationName(input.taskType);
  const requestedModel = readNonEmptyString(input.model, "unknown");
  return tracer.startSpan(
    `${operationName} ${requestedModel}`,
    {
      kind: SpanKind.CLIENT,
      attributes: compactAttributes({
        "gen_ai.operation.name": operationName,
        "gen_ai.request.model": requestedModel,
        "gen_ai.provider.name": input.providerId,
        "gen_ai.request.max_tokens": input.options?.maxOutputTokens,
        "gen_ai.request.temperature": input.options?.temperature,
        "gen_ai.request.top_p": input.options?.topP,
      }),
    },
    parentContext,
  );
}

function finishGenAiSpan(span, result) {
  const data = result?.data ?? {};
  const error = result?.error;
  setGenAiResultAttributes(span, {
    requestId: result?.meta?.requestId ?? data.id,
    provider: data.selectedProvider,
    model: data.selectedModel ?? data.model,
    finishReason: data.finishReason,
    usage: data.usage,
  });
  if (result?.success === false || error) {
    span.setAttribute("error.type", normalizeErrorType(error?.code ?? result?.code ?? "provider_error"));
    span.setStatus({ code: SpanStatusCode.ERROR });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
}

function finishGenAiStreamSpan(span, event) {
  setGenAiResultAttributes(span, {
    requestId: event?.requestId,
    provider: event?.selectedProvider,
    model: event?.selectedModel,
    finishReason: event?.rawProviderMeta?.finishReason,
    usage: event?.rawProviderMeta?.usage ?? event?.usage,
  });
  if (event?.type !== "error") span.setStatus({ code: SpanStatusCode.OK });
}

function setGenAiResultAttributes(span, values) {
  const attributes = compactAttributes({
    "gen_ai.response.id": values.requestId,
    "gen_ai.provider.name": values.provider,
    "gen_ai.response.model": values.model,
    "gen_ai.response.finish_reasons": values.finishReason ? [String(values.finishReason)] : undefined,
    "gen_ai.usage.input_tokens": toNonNegativeInteger(
      values.usage?.inputTokens ?? values.usage?.input_tokens,
    ),
    "gen_ai.usage.output_tokens": toNonNegativeInteger(
      values.usage?.outputTokens ?? values.usage?.output_tokens,
    ),
  });
  span.setAttributes(attributes);
}

function failSpan(span, error) {
  span.setAttribute("error.type", normalizeErrorType(error?.code ?? error?.name ?? "exception"));
  span.setStatus({ code: SpanStatusCode.ERROR });
}

function normalizeOtlpTraceEndpoint(env) {
  const signalEndpoint = readNonEmptyString(
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? env.AI_GATEWAY_OTEL_EXPORTER_OTLP_ENDPOINT,
    "",
  );
  const genericEndpoint = readNonEmptyString(env.OTEL_EXPORTER_OTLP_ENDPOINT, "");
  const raw = signalEndpoint || (genericEndpoint
    ? `${genericEndpoint.replace(/\/+$/, "")}/v1/traces`
    : "");
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new TypeError("OTLP trace endpoint must be a valid HTTP(S) URL.");
  }
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new TypeError("OTLP trace endpoint must use HTTP or HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw new TypeError("OTLP trace endpoint must not contain credentials or a fragment.");
  }
  return parsed.toString();
}

function parseOptionalPort(url) {
  if (!url?.port) return undefined;
  const parsed = Number(url.port);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function readHeader(headers, key) {
  const value = headers?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function readBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return new Set(["1", "true", "yes", "on"]).has(String(value).trim().toLowerCase());
}

function readNonEmptyString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readRatio(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new RangeError("AI_GATEWAY_OTEL_SAMPLE_RATIO must be between 0 and 1.");
  }
  return parsed;
}

function readExporterMode(value) {
  return String(value ?? "batch").trim().toLowerCase() === "simple" ? "simple" : "batch";
}

function normalizeOperationName(taskType) {
  if (taskType === "completion") return "text_completion";
  if (taskType === "embedding") return "embeddings";
  return "chat";
}

function normalizeErrorType(value) {
  return String(value ?? "error").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 128);
}

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function compactAttributes(attributes) {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => (
    value !== undefined && value !== null && value !== ""
  )));
}

function createDisabledRuntime() {
  return {
    enabled: false,
    exporterConfigured: false,
    endpoint: null,
    serviceName: null,
    sampleRatio: 0,
    startHttpRequest() {
      return {
        context: ROOT_CONTEXT,
        span: null,
        traceId: null,
        spanId: null,
        traceparent: null,
        run: (callback) => callback(),
        end: () => {},
      };
    },
    instrumentGatewayService: (gatewayService) => gatewayService,
    forceFlush: async () => {},
    shutdown: async () => {},
  };
}
