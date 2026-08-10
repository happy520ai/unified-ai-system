import OpenAI from "openai";
import { VERSION as sdkVersion } from "openai/version";

const gatewayUrl = (
  process.env.AI_GATEWAY_SERVICE_URL
  ?? process.env.AI_GATEWAY_BASE_URL
  ?? "http://127.0.0.1:3100"
).replace(/\/$/, "");
const baseURL = `${gatewayUrl}/v1`;

const client = new OpenAI({
  apiKey: process.env.PME_AUTH_TOKEN || "local-development",
  baseURL,
  maxRetries: 0,
});

const models = await client.models.list();
const model = models.data.find((candidate) => candidate.id === "local-fake-model");

const completion = await client.chat.completions.create({
  model: "local-fake-model",
  messages: [{ role: "user", content: "Official OpenAI SDK compatibility test" }],
});

const enhanced = await client.chat.completions.create({
  model: "local-fake-model",
  messages: [{ role: "user", content: "Build a Node API with tests" }],
  unified_ai: {
    prompt_enhancement: {
      enabled: true,
      profile: "coding",
      language: "en",
    },
  },
});

const stream = await client.chat.completions.create({
  model: "local-fake-model",
  messages: [{ role: "user", content: "Stream through the official OpenAI SDK" }],
  stream: true,
});
let streamedContent = "";
let streamFinished = false;
let streamMetadata = null;
for await (const chunk of stream) {
  streamedContent += chunk.choices[0]?.delta?.content || "";
  streamFinished ||= chunk.choices[0]?.finish_reason === "stop";
  streamMetadata ??= chunk.unified_ai ?? null;
}

const response = await client.responses.create({
  model: "local-fake-model",
  instructions: "Answer briefly",
  input: "Official OpenAI Responses SDK compatibility test",
  store: false,
});

const responseStream = await client.responses.create({
  model: "local-fake-model",
  input: "Stream through the official Responses SDK",
  store: false,
  stream: true,
});
let responseStreamedContent = "";
let responseStreamCompleted = false;
for await (const event of responseStream) {
  if (event.type === "response.output_text.delta") {
    responseStreamedContent += event.delta;
  }
  responseStreamCompleted ||= event.type === "response.completed";
}

let invalidRequest = null;
try {
  await client.chat.completions.create({
    model: "local-fake-model",
    messages: [{ role: "user", content: "Reject unsupported n" }],
    n: 2,
  });
} catch (error) {
  invalidRequest = {
    name: error?.name ?? null,
    class: error?.constructor?.name ?? null,
    isBadRequestError: error instanceof OpenAI.BadRequestError,
    status: error?.status ?? null,
    code: error?.code ?? null,
    param: error?.param ?? null,
    type: error?.type ?? null,
  };
}

const checks = {
  sdkVersion: sdkVersion === "7.4.0",
  modelList:
    models.data.length >= 1
    && model?.owned_by === "local-fake-provider"
    && model?.unified_ai?.execution_mode === "fake",
  nonStreaming:
    completion.object === "chat.completion"
    && completion.model === "local-fake-model"
    && completion.choices[0]?.message?.content?.includes("Official OpenAI SDK compatibility test")
    && completion.choices[0]?.finish_reason === "stop"
    && completion.unified_ai?.execution_mode === "fake"
    && completion.unified_ai?.selected_provider === "local-fake-provider",
  promptEnhancement:
    enhanced.unified_ai?.prompt_enhancement?.applied === true
    && enhanced.unified_ai?.prompt_enhancement?.profile === "coding"
    && enhanced.choices[0]?.message?.content?.includes("# Execution requirements")
    && enhanced.unified_ai?.execution_mode === "fake",
  streaming:
    streamedContent.includes("Stream through the official OpenAI SDK")
    && streamFinished
    && streamMetadata?.execution_mode === "fake"
    && streamMetadata?.selected_provider === "local-fake-provider",
  responses:
    response.object === "response"
    && response.status === "completed"
    && response.model === "local-fake-model"
    && response.output_text.includes("Official OpenAI Responses SDK compatibility test")
    && response.output[0]?.type === "message"
    && response.unified_ai?.execution_mode === "fake"
    && response.unified_ai?.selected_provider === "local-fake-provider",
  responsesStreaming:
    responseStreamedContent.includes("Stream through the official Responses SDK")
    && responseStreamCompleted,
  structuredError:
    invalidRequest?.isBadRequestError === true
    && invalidRequest?.class === "BadRequestError"
    && invalidRequest?.status === 400
    && invalidRequest?.code === "unsupported_parameter"
    && invalidRequest?.param === "n"
    && invalidRequest?.type === "invalid_request_error",
};

const result = {
  ok: Object.values(checks).every(Boolean),
  client: "openai",
  sdkVersion,
  baseURL,
  checks,
  modelCount: models.data.length,
  model: model?.id ?? null,
  executionMode: completion.unified_ai?.execution_mode ?? null,
  invalidRequest,
  realProviderCallsMade: false,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
