/**
 * Level 6 Inferno E2E — shared infrastructure
 * Config, test state, provider/loop factory, assertion helpers.
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";

// Global error handlers — catch silent crashes
process.on("uncaughtException", (err) => {
  console.error(`[FATAL] Uncaught exception: ${err.message}`);
  console.error(err.stack);
  process.exit(2);
});
process.on("unhandledRejection", (reason) => {
  console.error(`[FATAL] Unhandled rejection: ${reason}`);
  process.exit(3);
});

// ============================================================
// Config
// ============================================================

export const API_KEY = process.env.NVIDIA_API_KEY ?? "";
export const BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
export const MODEL_ID = process.env.MODEL_ID || "mimo-v2.5-pro";
export const PROVIDER_ID = "mimo";

if (!API_KEY) {
  console.error("[FATAL] API key not set.");
  process.exit(1);
}

// ============================================================
// Test infrastructure
// ============================================================

export const testState = { passed: 0, failed: 0, errors: [], timeline: [] };

export function assert(condition, label) {
  if (condition) { testState.passed++; console.log(`  [PASS] ${label}`); }
  else { testState.failed++; testState.errors.push(label); console.log(`  [FAIL] ${label}`); }
}

export function section(title) {
  console.log(`\n${"=".repeat(60)}\n  ${title}\n${"=".repeat(60)}`);
}

export function logTimeline(event, detail = "") {
  const ts = new Date().toISOString().slice(11, 23);
  const entry = `[${ts}] ${event}${detail ? " — " + detail : ""}`;
  testState.timeline.push(entry);
  console.log(`  ${entry}`);
}

// ============================================================
// Provider + Loop factory
// ============================================================

const modelConfig = {
  providerId: PROVIDER_ID,
  modelId: MODEL_ID,
  providerType: "mimo",
  providerDisplayName: "MiMo",
  modelDisplayName: MODEL_ID,
  enabled: true,
  endpoint: BASE_URL,
  apiKey: API_KEY,
  dryRun: false,
};

const provider = new HttpLLMProviderAdapter(modelConfig, { timeoutMs: 120_000 });

export function createLoop(extraTools = [], opts = {}) {
  const registry = createAgentToolRegistry({
    workingDirectory: opts.workingDirectory || process.cwd(),
  });
  for (const t of extraTools) {
    registry.registerTool(t);
  }
  return createAgenticLoop({
    providerAdapter: provider,
    toolRegistry: registry,
    maxIterations: opts.maxIterations ?? 30,
    tokenBudget: opts.tokenBudget ?? 200_000,
    workingDirectory: opts.workingDirectory || process.cwd(),
  });
}
