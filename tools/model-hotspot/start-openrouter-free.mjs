import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const openrouterKey = process.env.OPENROUTER_API_KEY;
const defaultModel = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash:free";

if (!openrouterKey) {
  console.error("[ERROR] OPENROUTER_API_KEY environment variable not set.");
  console.error("Set it with: $env:OPENROUTER_API_KEY='your-key-here'");
  process.exit(1);
}

console.log("=== OpenRouter Free Model Gateway ===");
console.log(`Model: ${defaultModel}`);
console.log("Provider: OpenRouter");
console.log("Base URL: https://openrouter.ai/api/v1");
console.log("");

// Set environment variables
process.env.AI_GATEWAY_PROVIDER_MODE = "real";
process.env.AI_GATEWAY_REAL_PROVIDER_ENABLED = "true";
process.env.AI_GATEWAY_ROUTE_MODE = "fixed";
process.env.AI_GATEWAY_DEFAULT_PROVIDER = "openrouter";
process.env.AI_GATEWAY_ENABLED_PROVIDERS = "openrouter";
process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Remove NVIDIA if present
delete process.env.NVIDIA_API_KEY;
delete process.env.NVIDIA_MODEL;

console.log("Starting service...");
console.log("");

const result = spawnSync("pnpm", ["dev:phase7b"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status || 0);
