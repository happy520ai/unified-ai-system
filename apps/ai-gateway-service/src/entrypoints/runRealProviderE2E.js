/**
 * E2E Test: 真实 Provider 端到端测试
 *
 * 使用 NVIDIA Llama 3.1 8B Instruct (真实 LLM) 驱动 agentic loop。
 * 验证: 真实 LLM 能否生成 tool_calls → 工具真正执行 → 多轮迭代 → 最终答案。
 *
 * 环境变量: NVIDIA_API_KEY (必须)
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { hasToolCalls as adapterHasToolCalls, extractToolCalls as adapterExtractToolCalls } from "../providers/toolCallingAdapter.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// Config
// ============================================================

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
// Try a model known for decent tool calling
const MODEL_ID = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
const PROVIDER_ID = "nvidia";
const TIMEOUT_MS = 60_000; // 60s per LLM call (70B models need more time)

if (!NVIDIA_API_KEY) {
  console.error("[FATAL] NVIDIA_API_KEY not set. Export it first.");
  process.exit(1);
}
console.log(`[real-e2e] Provider: ${PROVIDER_ID}`);
console.log(`[real-e2e] Model: ${MODEL_ID}`);
console.log(`[real-e2e] Endpoint: ${NVIDIA_BASE_URL}`);
console.log(`[real-e2e] API Key: present (length=${NVIDIA_API_KEY.length})`);

// ============================================================
// Test infrastructure
// ============================================================

let passed = 0;
let failed = 0;
const errors = [];
const timeline = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    errors.push(label);
    console.log(`  [FAIL] ${label}`);
  }
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

function logTimeline(event, detail = "") {
  const ts = new Date().toISOString().slice(11, 23);
  const entry = `[${ts}] ${event}${detail ? " — " + detail : ""}`;
  timeline.push(entry);
  console.log(`  ${entry}`);
}

// ============================================================
// Temp project setup
// ============================================================

const testDir = join(tmpdir(), `real-e2e-agentic-${Date.now()}`);
mkdirSync(testDir, { recursive: true });

const utilsPath = join(testDir, "utils.js");
writeFileSync(
  utilsPath,
  `// utils.js — 工具函数集合
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
`,
  "utf-8"
);

console.log(`[real-e2e] Project dir: ${testDir}`);
console.log(`[real-e2e] Target file: ${utilsPath}`);

// ============================================================
// Real Provider Adapter
// ============================================================

const modelConfig = {
  providerId: PROVIDER_ID,
  modelId: MODEL_ID,
  providerType: "nvidia",
  providerDisplayName: "NVIDIA NIM",
  modelDisplayName: MODEL_ID,
  enabled: true,
  endpoint: NVIDIA_BASE_URL,
  apiKey: NVIDIA_API_KEY,
  dryRun: false, // <--- REAL CALLS
};

const realProvider = new HttpLLMProviderAdapter(modelConfig, {
  timeoutMs: TIMEOUT_MS,
});

console.log(`[real-e2e] Adapter dryRun: ${realProvider.isDryRun}`);
console.log(`[real-e2e] Adapter ready: ${Boolean(realProvider.resolveApiKey() && realProvider.resolveBaseUrl())}`);

// ============================================================
// Create Agentic Loop
// ============================================================

const loop = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir,
  maxIterations: 8,
  maxTokensPerTurn: 4096,
  tokenBudget: 50_000,
  systemPrompt: `You are a coding assistant with file tools. When asked to modify a file:
1. First read the file using file_read to see its current content.
2. Then use file_write to write the updated content (include ALL original content plus your additions).
3. Finally, summarize what you did.

Always use tools. Do not guess file content — read first.`,
});

const info = loop.getInfo();
console.log(`[real-e2e] Tools registered: ${info.toolCount}`);
console.log(`[real-e2e] Max iterations: ${info.maxIterations}`);

// ============================================================
// Run real e2e test
// ============================================================

async function runRealTest() {
  section("Phase 1: Single-turn provider probe (no tools)");

  // First, verify the provider can respond at all
  logTimeline("probe_start", "Sending simple prompt to NVIDIA");
  let probeStart = Date.now();
  try {
    const probeResult = await realProvider.generate({
      request: {
        messages: [
          { role: "system", content: "Reply with exactly: PONG" },
          { role: "user", content: "Say PONG" },
        ],
        options: { maxOutputTokens: 50 },
      },
      target: { providerId: PROVIDER_ID, modelId: MODEL_ID },
    });
    const probeMs = Date.now() - probeStart;
    logTimeline("probe_ok", `${probeMs}ms, text="${(probeResult.text || "").slice(0, 60)}"`);
    assert(true, `Provider probe succeeded (${probeMs}ms)`);
    assert(typeof probeResult.text === "string", "Probe returned text");
    assert(probeResult.usage.totalTokens > 0, `Probe used ${probeResult.usage.totalTokens} tokens`);
    console.log(`  [info] Probe usage: in=${probeResult.usage.inputTokens} out=${probeResult.usage.outputTokens}`);
  } catch (probeErr) {
    logTimeline("probe_fail", probeErr.message);
    assert(false, `Provider probe failed: ${probeErr.message}`);
    console.log("\n[FATAL] Provider cannot respond. Aborting.");
    return;
  }

  // -----------------------------------------------
  section("Phase 2: Tool calling probe (single tool call)");
  // -----------------------------------------------

  logTimeline("tool_probe_start", "Testing if model generates tool_calls");
  const toolProbeTools = [
    {
      type: "function",
      function: {
        name: "get_time",
        description: "Get the current time in a given timezone",
        parameters: {
          type: "object",
          properties: {
            timezone: { type: "string", description: "Timezone like UTC, Asia/Shanghai" },
          },
          required: ["timezone"],
        },
      },
    },
  ];

  try {
    const toolProbeStart = Date.now();
    const toolProbeResult = await realProvider.generate({
      request: {
        messages: [
          { role: "system", content: "You have a tool called get_time. Use it when asked about time." },
          { role: "user", content: "What time is it in Shanghai?" },
        ],
        tools: toolProbeTools,
        toolChoice: "auto",
        options: { maxOutputTokens: 200 },
      },
      target: { providerId: PROVIDER_ID, modelId: MODEL_ID },
    });
    const toolProbeMs = Date.now() - toolProbeStart;
    const hasTool = adapterHasToolCalls(toolProbeResult);
    logTimeline(
      "tool_probe_result",
      `${toolProbeMs}ms, hasToolCalls=${hasTool}, finish=${toolProbeResult.raw?.finishReason}`
    );

    if (hasTool) {
      const tcs = adapterExtractToolCalls(toolProbeResult);
      const tc = tcs?.[0];
      if (tc) {
        assert(true, `Model generated tool_call: ${tc.name}(${JSON.stringify(tc.arguments)})`);
        assert(tc.name === "get_time", `Tool name is 'get_time' (got: ${tc.name})`);
      } else {
        assert(false, "hasToolCalls=true but extractToolCalls returned null");
      }
    } else {
      console.log(`  [WARN] Model did NOT generate tool_calls. Text: "${(toolProbeResult.text || "").slice(0, 120)}"`);
      console.log(`  [WARN] raw.finishReason: ${toolProbeResult.raw?.finishReason}`);
      assert(false, "Model should generate tool_calls when tools are provided");
      console.log("\n  This model may not support function calling well.");
      console.log("  The agentic loop requires tool_calls to drive iterations.");
    }
  } catch (toolProbeErr) {
    logTimeline("tool_probe_fail", toolProbeErr.message);
    assert(false, `Tool calling probe failed: ${toolProbeErr.message}`);
  }

  // -----------------------------------------------
  section("Phase 3: Full agentic loop (real LLM + real tools)");
  // -----------------------------------------------

  logTimeline("loop_start", "Running full agentic loop with real LLM");
  const iterations = [];
  let result;
  const loopStart = Date.now();

  try {
    result = await loop.execute({
      goal: `Read the file ${utilsPath} first, then add a new exported function called 'capitalize' that takes a string and returns it with the first letter uppercased. Write the complete updated file.`,
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
      onIteration: (iter, data) => {
        const detail = data.type === "tool_calls_executed"
          ? `tools: ${data.toolCalls.map((tc) => tc.name).join(", ")}`
          : data.type === "final_answer"
          ? `text: "${(data.text || "").slice(0, 80)}..."`
          : data.type;
        logTimeline(`iter_${iter}`, `${data.type} (${data.durationMs}ms) ${detail}`);
        iterations.push({ iter, type: data.type });
      },
    });
    const loopMs = Date.now() - loopStart;
    logTimeline("loop_done", `${loopMs}ms, status=${result.status}, iterations=${result.iterations}`);
  } catch (loopErr) {
    const loopMs = Date.now() - loopStart;
    logTimeline("loop_crash", `${loopMs}ms, error: ${loopErr.message}`);
    console.error(`\n  [CRASH] ${loopErr.stack}`);
    assert(false, `Agentic loop crashed: ${loopErr.message}`);
    return;
  }

  // Verify result structure
  assert(typeof result.sessionId === "string", "Has sessionId");
  assert(typeof result.status === "string", `Status: ${result.status}`);
  assert(result.iterations >= 1, `At least 1 iteration (got: ${result.iterations})`);
  assert(typeof result.finalAnswer === "string", "Has finalAnswer string");
  assert(result.durationMs > 0, `Duration: ${result.durationMs}ms`);

  // Trace analysis
  const traceTypes = result.trace.map((t) => t.type);
  console.log(`  [info] Trace types: [${traceTypes.join(", ")}]`);
  console.log(`  [info] Total tokens used: ${result.usage.totalTokens}`);
  console.log(`  [info] Tool calls made: ${result.toolUsage.totalCalls}`);
  console.log(`  [info] Tool errors: ${result.toolUsage.totalErrors}`);
  if (result.toolUsage.toolCounts) {
    for (const [tool, count] of Object.entries(result.toolUsage.toolCounts)) {
      console.log(`  [info]   ${tool}: ${count}x`);
    }
  }

  // Check if tool calls were made
  const toolCallTraces = result.trace.filter((t) => t.type === "tool_calls");
  if (toolCallTraces.length > 0) {
    assert(true, `LLM generated ${toolCallTraces.length} rounds of tool calls`);
    for (const tc of toolCallTraces) {
      const names = tc.toolCalls.map((t) => `${t.name}(${Object.keys(t.args || {}).join(",")})`);
      console.log(`  [info]   → ${names.join(", ")}`);
    }
  } else {
    console.log(`  [WARN] LLM never generated tool_calls in ${result.iterations} iterations.`);
    console.log(`  [WARN] Final answer: "${(result.finalAnswer || "").slice(0, 200)}"`);
    assert(false, "LLM should use tools for file operations");
  }

  // Check if file was actually modified
  const updatedContent = readFileSync(utilsPath, "utf-8");
  const fileModified = updatedContent.includes("capitalize");
  assert(fileModified, `File actually modified on disk (capitalize present: ${fileModified})`);

  if (fileModified) {
    assert(updatedContent.includes("add"), "Original 'add' function preserved");
    assert(updatedContent.includes("multiply"), "Original 'multiply' function preserved");
    console.log(`  [info] Updated file size: ${updatedContent.length} bytes`);
  }

  // Check final answer quality
  assert(result.finalAnswer.length > 10, `Final answer has substance (${result.finalAnswer.length} chars)`);
  console.log(`  [info] Final answer preview: "${result.finalAnswer.slice(0, 200)}"`);

  // Error analysis
  const errorTraces = result.trace.filter((t) => t.type === "error");
  if (errorTraces.length > 0) {
    console.log(`  [WARN] ${errorTraces.length} error(s) in trace:`);
    for (const e of errorTraces) {
      console.log(`  [WARN]   code=${e.code}, msg=${e.message}`);
    }
  }

  // Token budget check
  const budgetWarnings = result.trace.filter((t) => t.type === "token_budget_warning");
  if (budgetWarnings.length > 0) {
    console.log(`  [info] Token budget warnings: ${budgetWarnings.length}`);
  }

  // Max iterations check
  if (result.status === "max_iterations_reached") {
    console.log(`  [WARN] Loop hit max iterations (${info.maxIterations}). LLM may be looping without converging.`);
  }
}

// ============================================================
// Cleanup
// ============================================================

function cleanup() {
  try {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
      console.log(`\n[real-e2e] Cleaned up: ${testDir}`);
    }
  } catch (e) {
    console.log(`\n[real-e2e] Cleanup warning: ${e.message}`);
  }
}

// ============================================================
// Main
// ============================================================

console.log("═".repeat(60));
console.log("  Real Provider E2E — NVIDIA " + MODEL_ID);
console.log("═".repeat(60));

const globalStart = Date.now();

try {
  await runRealTest();
} catch (err) {
  console.error(`\n[FATAL] Unhandled error: ${err.message}`);
  console.error(err.stack);
  failed++;
} finally {
  cleanup();
}

const globalMs = Date.now() - globalStart;

console.log("\n" + "═".repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed (${globalMs}ms total)`);
console.log("═".repeat(60));

console.log("\n  Timeline:");
for (const entry of timeline) {
  console.log(`    ${entry}`);
}

if (errors.length > 0) {
  console.log("\n  Failed tests:");
  for (const e of errors) {
    console.log(`    ✗ ${e}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
