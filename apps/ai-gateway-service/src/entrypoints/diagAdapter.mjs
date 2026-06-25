/**
 * Quick diagnostic: test HttpLLMProviderAdapter directly with MiMo
 * Writes output to file to avoid Windows encoding issues
 */
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = join(__dirname, "..", "..", "diag_result.txt");

const API_KEY = process.env.NVIDIA_API_KEY ?? "";
const BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const lines = [];

function log(msg) { lines.push(msg); }

const modelConfig = {
  providerId: "mimo",
  modelId: "mimo-v2.5-pro",
  providerType: "mimo",
  providerDisplayName: "MiMo",
  modelDisplayName: "mimo-v2.5-pro",
  enabled: true,
  endpoint: BASE_URL,
  apiKey: API_KEY,
  dryRun: false,
};

log("=== Adapter Diagnostic ===");
log("API Key prefix: " + API_KEY.slice(0, 10) + "...");
log("Endpoint: " + BASE_URL);
log("dryRun: " + modelConfig.dryRun);

const adapter = new HttpLLMProviderAdapter(modelConfig, { timeoutMs: 30_000 });

log("resolveApiKey(): " + adapter.resolveApiKey().slice(0, 10) + "...");
log("resolveBaseUrl(): " + adapter.resolveBaseUrl());
log("isDryRun: " + adapter.isDryRun);

const providerRequest = {
  request: {
    messages: [{ role: "user", content: "Say pong in one word" }],
    options: { maxOutputTokens: 50 },
  },
  target: {
    providerId: "mimo",
    modelId: "mimo-v2.5-pro",
  },
};

log("\n--- Calling adapter.generate() ---");
try {
  const response = await adapter.generate(providerRequest);
  log("SUCCESS!");
  log("Text: " + response.text);
  log("Usage: " + JSON.stringify(response.usage));
  log("Raw finishReason: " + response?.raw?.finishReason);
} catch (error) {
  log("FAILED!");
  log("Error code: " + error.code);
  log("Error type: " + error.type);
  log("Error message: " + error.message);
  log("Error details: " + JSON.stringify(error.details));
  log("Error retryable: " + error.retryable);
  log("Full error: " + JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
}

const output = lines.join("\n");
writeFileSync(outFile, output, "utf-8");
console.log(output);
