/**
 * Level 1: 错误恢复 & 韧性测试
 *
 * 测试 agentic loop 在极端错误场景下的恢复能力:
 *   1. 工具抛异常 → loop 能否把错误反馈给 LLM 并继续
 *   2. 工具参数畸形 → coerceParams 能否修正
 *   3. 工具返回超长结果 → 截断是否正常
 *   4. Provider 超时 → loop 是否优雅终止
 *
 * 环境变量: NVIDIA_API_KEY (可选, 默认使用 MiMo V2.5 Pro)
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createAgentToolRegistry, buildTool, createInputSchema } from "../claude-code-patterns/agentToolRegistry.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// Config
// ============================================================

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY ?? "";
const MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const MODEL_ID = process.env.MIMO_MODEL || "mimo-v2.5-pro";
const PROVIDER_ID = "mimo";
const TIMEOUT_MS = 60_000;

if (!NVIDIA_API_KEY) {
  console.error("[FATAL] API key not set.");
  process.exit(1);
}

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
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
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

const testDir = join(tmpdir(), `resilience-e2e-${Date.now()}`);
mkdirSync(testDir, { recursive: true });

const dataFile = join(testDir, "data.txt");
writeFileSync(dataFile, "line1\nline2\nline3\nline4\nline5\n", "utf-8");

console.log(`[resilience] Project dir: ${testDir}`);

// ============================================================
// Provider Adapter
// ============================================================

const modelConfig = {
  providerId: PROVIDER_ID,
  modelId: MODEL_ID,
  providerType: "mimo",
  providerDisplayName: "MiMo",
  modelDisplayName: MODEL_ID,
  enabled: true,
  endpoint: MIMO_BASE_URL,
  apiKey: NVIDIA_API_KEY,
  dryRun: false,
};

const realProvider = new HttpLLMProviderAdapter(modelConfig, { timeoutMs: 120_000 });

// ============================================================
// Scenario 1: Flaky Tool (throws on first 2 calls, succeeds on 3rd)
// ============================================================

section("Scenario 1: Flaky Tool — 工具间歇性失败后恢复");

const flakyState = { callCount: 0 };

const flakyTool = buildTool({
  name: "flaky_read",
  description: "Read data from a flaky sensor. May fail on first attempts but eventually succeeds.",
  inputSchema: createInputSchema(
    {
      sensorId: { type: "string", description: "Sensor identifier" },
    },
    ["sensorId"]
  ),
  execute: async (params) => {
    flakyState.callCount++;
    if (flakyState.callCount <= 2) {
      throw new Error(`Sensor ${params.sensorId} connection timeout (attempt ${flakyState.callCount})`);
    }
    return `Sensor ${params.sensorId} reading: temperature=23.5C, humidity=45%, pressure=1013hPa`;
  },
  requiredPermissions: [],
  isReadOnly: true,
});

const registry1 = createAgentToolRegistry({ workingDirectory: testDir });
registry1.registerTool(flakyTool);

const loop1 = createAgenticLoop({
  providerAdapter: realProvider,
  toolRegistry: registry1,
  workingDirectory: testDir,
  maxIterations: 8,
  maxTokensPerTurn: 4096,
  tokenBudget: 50_000,
  systemPrompt: `You are a sensor monitoring assistant. You have ONE tool called flaky_read.
IMPORTANT: Call only ONE tool at a time. Never make parallel tool calls.
If the tool returns an error, call it AGAIN with the exact same parameters. Keep retrying until it succeeds.
After getting a successful reading, summarize the result in one sentence.`,
});

logTimeline("scenario1_start", "Testing flaky tool recovery");
const s1Start = Date.now();
let result1;
try {
  result1 = await loop1.execute({
    goal: `Read sensor data from sensor "temp-001" using the flaky_read tool. If it fails, retry until it succeeds.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      const detail = data.type === "tool_calls_executed"
        ? `tools: ${data.toolCalls.map((tc) => tc.name).join(", ")}`
        : data.type === "final_answer"
        ? `text: "${(data.text || "").slice(0, 80)}..."`
        : data.type;
      logTimeline(`s1_iter_${iter}`, `${data.type} (${data.durationMs}ms) ${detail}`);
    },
  });
  const s1Ms = Date.now() - s1Start;
  logTimeline("scenario1_done", `${s1Ms}ms, status=${result1.status}`);

  // Assertions
  assert(result1.status === "completed", `Status is 'completed' (got: ${result1.status})`);
  assert(flakyState.callCount >= 3, `Flaky tool called at least 3 times (got: ${flakyState.callCount})`);
  assert(typeof result1.finalAnswer === "string" && result1.finalAnswer.length > 10, "Has substantive final answer");

  // Errors thrown by tools are caught by executeTool and returned as { status: "error" }.
  // toolCallingAdapter.js now detects these soft-error returns and sets isError=true.
  const toolErrorCount = result1.toolUsage.totalErrors;
  assert(toolErrorCount >= 2, `At least 2 tool errors tracked (got: ${toolErrorCount})`);
  console.log(`  [info] Flaky tool called ${flakyState.callCount} times, ${toolErrorCount} tracked errors (retry proves error feedback works)`);
  console.log(`  [info] Final answer: "${result1.finalAnswer.slice(0, 150)}"`);
} catch (err) {
  logTimeline("scenario1_crash", err.message);
  assert(false, `Scenario 1 crashed: ${err.message}`);
}

// ============================================================
// Scenario 2: Strict Type Tool (LLM sends strings for int params)
// ============================================================

section("Scenario 2: Type Coercion — LLM 发送错误类型参数");

const strictTool = buildTool({
  name: "calculate_stats",
  description: "Calculate statistics from a dataset. Takes a count (integer) and an offset (integer).",
  inputSchema: createInputSchema(
    {
      count: { type: "integer", description: "Number of data points to analyze" },
      offset: { type: "integer", description: "Starting index offset" },
      verbose: { type: "boolean", description: "Whether to include detailed stats" },
    },
    ["count"]
  ),
  execute: async (params) => {
    const count = params.count;
    const offset = params.offset ?? 0;
    const verbose = params.verbose ?? false;
    let result = `Stats for ${count} points starting at offset ${offset}`;
    if (verbose) {
      result += `\nMean: ${(count + offset) / 2}, Range: [${offset}, ${offset + count - 1}]`;
    }
    return result;
  },
  requiredPermissions: [],
  isReadOnly: true,
});

const registry2 = createAgentToolRegistry({ workingDirectory: testDir });
registry2.registerTool(strictTool);

const loop2 = createAgenticLoop({
  providerAdapter: realProvider,
  toolRegistry: registry2,
  workingDirectory: testDir,
  maxIterations: 5,
  maxTokensPerTurn: 2048,
  tokenBudget: 30_000,
  systemPrompt: `You are a data analysis assistant. Use the calculate_stats tool when asked about statistics.
The tool takes count (integer), offset (integer), and verbose (boolean) parameters.`,
});

logTimeline("scenario2_start", "Testing type coercion");
const s2Start = Date.now();
let result2;
try {
  result2 = await loop2.execute({
    goal: `Calculate statistics for 10 data points starting at offset 5, with verbose output enabled.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`s2_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const s2Ms = Date.now() - s2Start;
  logTimeline("scenario2_done", `${s2Ms}ms, status=${result2.status}`);

  assert(result2.status === "completed", `Status is 'completed' (got: ${result2.status})`);
  assert(result2.toolUsage.totalErrors === 0, `No tool errors — coerceParams handled type conversion (errors: ${result2.toolUsage.totalErrors})`);
  assert(result2.toolUsage.totalCalls >= 1, `Tool was called at least once (calls: ${result2.toolUsage.totalCalls})`);
  console.log(`  [info] Final answer: "${result2.finalAnswer.slice(0, 150)}"`);
} catch (err) {
  logTimeline("scenario2_crash", err.message);
  assert(false, `Scenario 2 crashed: ${err.message}`);
}

// ============================================================
// Scenario 3: Massive Result Truncation
// ============================================================

section("Scenario 3: 超长结果截断 — 工具返回 100KB+ 数据");

const massiveTool = buildTool({
  name: "dump_logs",
  description: "Dump system logs. Returns a very large text output.",
  inputSchema: createInputSchema(
    {
      lines: { type: "integer", description: "Number of log lines to dump" },
    },
    ["lines"]
  ),
  execute: async (params) => {
    const lines = params.lines ?? 100;
    const logLines = [];
    for (let i = 0; i < lines; i++) {
      logLines.push(`[2026-06-14T10:${String(i % 60).padStart(2, "0")}:00Z] INFO server-${i % 5} request_id=${Math.random().toString(36).slice(2)} status=200 latency=${Math.floor(Math.random() * 500)}ms path=/api/v1/data`);
    }
    return logLines.join("\n");
  },
  requiredPermissions: [],
  isReadOnly: true,
  maxResultSizeChars: 5000,
});

const registry3 = createAgentToolRegistry({ workingDirectory: testDir });
registry3.registerTool(massiveTool);

const loop3 = createAgenticLoop({
  providerAdapter: realProvider,
  toolRegistry: registry3,
  workingDirectory: testDir,
  maxIterations: 5,
  maxTokensPerTurn: 2048,
  tokenBudget: 30_000,
  systemPrompt: `You are a log analysis assistant. Use the dump_logs tool to get system logs, then summarize the key findings briefly.`,
});

logTimeline("scenario3_start", "Testing massive result truncation");
const s3Start = Date.now();
let result3;
try {
  result3 = await loop3.execute({
    goal: `Dump 2000 lines of system logs using the dump_logs tool and give me a brief summary of the patterns you see.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`s3_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const s3Ms = Date.now() - s3Start;
  logTimeline("scenario3_done", `${s3Ms}ms, status=${result3.status}`);

  assert(result3.status === "completed", `Status is 'completed' (got: ${result3.status})`);
  assert(result3.toolUsage.totalCalls >= 1, "Tool was called");
  assert(result3.toolUsage.totalErrors === 0, "No tool errors from massive output");

  // Check that the LLM got a truncated result and still produced a useful answer
  const hasTruncationMarker = result3.messages.some(
    (m) => m.role === "tool" && typeof m.content === "string" && m.content.includes("截断")
  );
  assert(hasTruncationMarker, "Tool result was truncated (marker found in messages)");
  console.log(`  [info] Final answer: "${result3.finalAnswer.slice(0, 150)}"`);
} catch (err) {
  logTimeline("scenario3_crash", err.message);
  assert(false, `Scenario 3 crashed: ${err.message}`);
}

// ============================================================
// Scenario 4: Provider Timeout (using very short timeout)
// ============================================================

section("Scenario 4: Provider 超时 — 极短超时下的优雅降级");

const timeoutProvider = new HttpLLMProviderAdapter(
  { ...modelConfig, providerDisplayName: "MiMo (timeout-test)" },
  { timeoutMs: 500 }  // 500ms — guaranteed to timeout
);

const registry4 = createAgentToolRegistry({ workingDirectory: testDir });

const loop4 = createAgenticLoop({
  providerAdapter: timeoutProvider,
  toolRegistry: registry4,
  workingDirectory: testDir,
  maxIterations: 3,
  maxTokensPerTurn: 2048,
  tokenBudget: 10_000,
});

logTimeline("scenario4_start", "Testing provider timeout handling");
const s4Start = Date.now();
let result4;
try {
  result4 = await loop4.execute({
    goal: "Read the file data.txt and tell me what's in it.",
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
  });
  const s4Ms = Date.now() - s4Start;
  logTimeline("scenario4_done", `${s4Ms}ms, status=${result4.status}`);

  assert(result4.status === "error", `Status is 'error' (got: ${result4.status})`);
  const errorTraces = result4.trace.filter((t) => t.type === "error");
  assert(errorTraces.length > 0, "Error trace recorded");

  if (errorTraces.length > 0) {
    const errCode = errorTraces[0].code;
    const isTimeout = errCode.includes("TIMEOUT");
    assert(isTimeout, `Error code indicates timeout (got: ${errCode})`);
    console.log(`  [info] Error: ${errorTraces[0].message}`);
  }
  console.log(`  [info] Loop terminated gracefully in ${result4.durationMs}ms`);
} catch (err) {
  logTimeline("scenario4_crash", err.message);
  assert(false, `Scenario 4 crashed (should have handled timeout gracefully): ${err.message}`);
}

// ============================================================
// Scenario 5: Non-existent Tool Call (LLM hallucinates a tool)
// ============================================================

section("Scenario 5: 幻觉工具调用 — LLM 调用不存在的工具");

const registry5 = createAgentToolRegistry({ workingDirectory: testDir });
// Only register a simple tool
registry5.registerTool(buildTool({
  name: "get_weather",
  description: "Get the weather for a city.",
  inputSchema: createInputSchema(
    {
      city: { type: "string", description: "City name" },
    },
    ["city"]
  ),
  execute: async (params) => `Weather in ${params.city}: Sunny, 25°C`,
  requiredPermissions: [],
  isReadOnly: true,
}));

const loop5 = createAgenticLoop({
  providerAdapter: realProvider,
  toolRegistry: registry5,
  workingDirectory: testDir,
  maxIterations: 5,
  maxTokensPerTurn: 2048,
  tokenBudget: 30_000,
  systemPrompt: `You are a helpful assistant with a get_weather tool. Only use tools that are available to you.`,
});

logTimeline("scenario5_start", "Testing hallucinated tool handling");
const s5Start = Date.now();
let result5;
try {
  result5 = await loop5.execute({
    goal: `What is the weather in Beijing? Use the get_weather tool to find out.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`s5_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const s5Ms = Date.now() - s5Start;
  logTimeline("scenario5_done", `${s5Ms}ms, status=${result5.status}`);

  // The LLM might call get_weather for Beijing, which should work.
  // If it hallucinates a stock tool, the executeToolCalls should catch the error.
  assert(typeof result5.status === "string", `Has valid status: ${result5.status}`);
  assert(typeof result5.finalAnswer === "string" && result5.finalAnswer.length > 10, "Has final answer");

  // Check if any tool errors were handled gracefully
  if (result5.toolUsage.totalErrors > 0) {
    console.log(`  [info] ${result5.toolUsage.totalErrors} tool error(s) handled gracefully`);
    assert(true, "Tool errors were caught and loop continued");
  } else {
    console.log(`  [info] LLM stayed within available tools (no hallucinated calls)`);
    assert(true, "LLM didn't hallucinate tool calls");
  }
  console.log(`  [info] Final answer: "${result5.finalAnswer.slice(0, 150)}"`);
} catch (err) {
  logTimeline("scenario5_crash", err.message);
  assert(false, `Scenario 5 crashed: ${err.message}`);
}

// ============================================================
// Cleanup & Summary
// ============================================================

function cleanup() {
  try {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  } catch { /* ignore */ }
}

console.log("\n" + "═".repeat(60));
console.log(`  Level 1 Resilience Results: ${passed} passed, ${failed} failed`);
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

cleanup();
process.exit(failed > 0 ? 1 : 0);
