import Anthropic from "@anthropic-ai/sdk";
import { VERSION as sdkVersion } from "@anthropic-ai/sdk/version";

const gatewayUrl = (
  process.env.AI_GATEWAY_SERVICE_URL
  ?? process.env.AI_GATEWAY_BASE_URL
  ?? "http://127.0.0.1:3100"
).replace(/\/$/, "");

const client = new Anthropic({
  apiKey: "local-development",
  baseURL: gatewayUrl,
  maxRetries: 0,
});

const message = await client.messages.create({
  model: "local-fake-model",
  max_tokens: 128,
  system: "Answer concisely.",
  messages: [{ role: "user", content: "Official Anthropic SDK compatibility test" }],
});

let streamedContent = "";
const stream = client.messages.stream({
  model: "local-fake-model",
  max_tokens: 128,
  messages: [{ role: "user", content: "Stream through the official Anthropic SDK" }],
});
stream.on("text", (text) => {
  streamedContent += text;
});
const finalMessage = await stream.finalMessage();

let invalidRequest = null;
try {
  await client.messages.create({
    model: "local-fake-model",
    messages: [{ role: "user", content: "Missing max_tokens must fail" }],
  });
} catch (error) {
  invalidRequest = {
    name: error?.name ?? null,
    status: error?.status ?? null,
    type: error?.error?.error?.type ?? error?.error?.type ?? null,
  };
}

const text = message.content
  .filter((block) => block.type === "text")
  .map((block) => block.text)
  .join("");
const finalText = finalMessage.content
  .filter((block) => block.type === "text")
  .map((block) => block.text)
  .join("");
const checks = {
  nonStreamingMessage: message.type === "message" && message.role === "assistant" && text.length > 0,
  nonStreamingUsage: message.usage.input_tokens > 0 && message.usage.output_tokens > 0,
  streamingText: streamedContent.length > 0 && finalText === streamedContent,
  streamingLifecycle: finalMessage.type === "message" && finalMessage.stop_reason === "end_turn",
  structuredError: invalidRequest?.status === 400 && invalidRequest?.type === "invalid_request_error",
  fakeProvider: message.unified_ai?.execution_mode === "fake",
};

const result = {
  ok: Object.values(checks).every(Boolean),
  client: "@anthropic-ai/sdk",
  sdkVersion,
  baseURL: gatewayUrl,
  model: message.model,
  executionMode: message.unified_ai?.execution_mode ?? null,
  checks,
  invalidRequest,
  realProviderCallsMade: false,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
