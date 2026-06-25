/**
 * Level 4: 真实代码库任务测试
 *
 * 让 agentic loop 直接操作 unified-ai-system 代码库:
 *   1. 给 coerceParams 函数写单元测试
 *   2. 在现有测试文件中添加新的 describe 块
 *   3. 验证写入的代码语法正确 (node --check)
 *
 * 这是对系统自我开发能力的终极测试 — 它能否改进自己?
 *
 * 环境变量: NVIDIA_API_KEY (可选, 默认使用 MiMo V2.5 Pro)
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

// ============================================================
// Config
// ============================================================

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY ?? "";
const MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const MODEL_ID = process.env.MIMO_MODEL || "mimo-v2.5-pro";
const PROVIDER_ID = "mimo";
const TIMEOUT_MS = 60_000;

// The real project root
const PROJECT_ROOT = process.env.PROJECT_ROOT || join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "..");

if (!NVIDIA_API_KEY) {
  console.error("[FATAL] API key not set.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const errors = [];
const timeline = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(`  [PASS] ${label}`); }
  else { failed++; errors.push(label); console.log(`  [FAIL] ${label}`); }
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
// Setup: copy target files to a temp workspace (don't modify real codebase)
// ============================================================

const testDir = join(tmpdir(), `real-codebase-e2e-${Date.now()}`);
mkdirSync(testDir, { recursive: true });
mkdirSync(join(testDir, "src"), { recursive: true });
mkdirSync(join(testDir, "test"), { recursive: true });

// Copy the agentToolRegistry.js (target file)
const registrySourcePath = join(PROJECT_ROOT, "apps", "ai-gateway-service", "src", "claude-code-patterns", "agentToolRegistry.js");
const registryDestPath = join(testDir, "src", "agentToolRegistry.js");

let registryExists = false;
try {
  const content = readFileSync(registrySourcePath, "utf-8");
  writeFileSync(registryDestPath, content, "utf-8");
  registryExists = true;
  console.log(`[real-codebase] Copied agentToolRegistry.js (${content.length} bytes)`);
} catch {
  console.log(`[real-codebase] WARNING: Could not copy agentToolRegistry.js, using inline version`);
  // Create a minimal version with coerceParams for testing
  writeFileSync(registryDestPath, `
/**
 * Minimal agentToolRegistry with coerceParams for testing
 */

export function coerceParams(schema, params) {
  if (!schema?.properties || !params || typeof params !== "object") return params;
  const coerced = { ...params };
  for (const [key, value] of Object.entries(coerced)) {
    const prop = schema.properties[key];
    if (!prop || value === undefined || value === null) continue;
    if (prop.type === "integer" && typeof value === "string") {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) coerced[key] = parsed;
    } else if (prop.type === "number" && typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) coerced[key] = parsed;
    } else if (prop.type === "boolean" && typeof value === "string") {
      if (value === "true") coerced[key] = true;
      else if (value === "false") coerced[key] = false;
    }
  }
  return coerced;
}

export function validateInput(tool, params) {
  if (!tool.inputSchema?.required) return { valid: true };
  for (const key of tool.inputSchema.required) {
    if (params[key] === undefined || params[key] === null) {
      return { valid: false, error: "Missing required parameter: " + key };
    }
  }
  return { valid: true };
}

export function createAgentToolRegistry(options = {}) {
  const tools = new Map();
  return {
    registerTool(tool) { tools.set(tool.name, tool); },
    getTool(name) { return tools.get(name); },
    listTools() { return [...tools.values()]; },
    async executeTool(name, params, ctx) {
      const tool = tools.get(name);
      if (!tool) throw new Error("Tool not found: " + name);
      return tool.execute(params, ctx);
    },
  };
}

export function buildTool(def) {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema || { type: "object", properties: {} },
    execute: def.execute,
    maxResultSizeChars: def.maxResultSizeChars || 50000,
    isReadOnly: def.isReadOnly ?? false,
  };
}

export function createInputSchema(def) {
  return {
    type: "object",
    properties: def.properties || {},
    required: def.required || [],
    additionalProperties: false,
  };
}
`, "utf-8");
}

// Create an existing test file to add to
const testDestPath = join(testDir, "test", "coerceParams.test.js");
writeFileSync(testDestPath, `/**
 * coerceParams unit tests
 *
 * Existing test structure — add new describe blocks below.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// NOTE: The agentic loop should ADD new test cases here

describe("coerceParams — basic", () => {
  it("returns params unchanged when no schema", async () => {
    // placeholder — LLM should replace with real import and test
    assert.ok(true, "placeholder test");
  });
});
`, "utf-8");

console.log(`[real-codebase] Project dir: ${testDir}`);
console.log(`[real-codebase] Source: ${registryDestPath}`);
console.log(`[real-codebase] Test: ${testDestPath}`);

// ============================================================
// Provider Adapter
// ============================================================

const modelConfig = {
  providerId: PROVIDER_ID,
  modelId: MODEL_ID,
  providerType: "mimo",
  providerDisplayName: "MiMo",
  enabled: true,
  endpoint: MIMO_BASE_URL,
  apiKey: NVIDIA_API_KEY,
  dryRun: false,
};

const realProvider = new HttpLLMProviderAdapter(modelConfig, { timeoutMs: TIMEOUT_MS });

// ============================================================
// Task 1: Write Unit Tests for coerceParams
// ============================================================

section("Task 1: 给 coerceParams 写完整单元测试");

const loop1 = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir,
  maxIterations: 10,
  maxTokensPerTurn: 4096,
  tokenBudget: 80_000,
  systemPrompt: `You are a test engineer writing unit tests for a Node.js project. You use the node:test runner (import { describe, it } from "node:test").

Rules:
1. ALWAYS read the source file first to understand the function being tested.
2. ALWAYS read the existing test file before modifying it.
3. Write comprehensive tests covering: happy path, edge cases, error cases.
4. Use assert from "node:assert/strict".
5. Write the COMPLETE updated test file (preserve existing content, add new describe blocks).
6. Import from the correct relative path: "../src/agentToolRegistry.js"`,
});

logTimeline("task1_start", "Writing unit tests for coerceParams");
const t1Start = Date.now();
let result1;
try {
  result1 = await loop1.execute({
    goal: `Read the source file ${registryDestPath} to understand the coerceParams function, then read the existing test file ${testDestPath}, and rewrite it with comprehensive unit tests for coerceParams.

Test cases to cover:
- Integer coercion: string "42" → number 42, string "0" → number 0
- Number coercion: string "3.14" → number 3.14
- Boolean coercion: string "true" → true, string "false" → false
- Non-string passthrough: number 42 stays 42
- Null/undefined values are passed through
- Missing schema returns params unchanged
- Invalid number strings ("abc" for integer) are NOT coerced
- Multiple params coerced simultaneously

Write the complete test file to ${testDestPath}.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      const detail = data.type === "tool_calls_executed"
        ? `tools: ${data.toolCalls.map((tc) => tc.name).join(", ")}`
        : data.type === "final_answer"
        ? `"${(data.text || "").slice(0, 80)}..."`
        : data.type;
      logTimeline(`t1_iter_${iter}`, `${data.type} (${data.durationMs}ms) ${detail}`);
    },
  });
  const t1Ms = Date.now() - t1Start;
  logTimeline("task1_done", `${t1Ms}ms, status=${result1.status}, iters=${result1.iterations}`);

  assert(result1.status === "completed", `Status is 'completed' (got: ${result1.status})`);
  assert(result1.iterations >= 2, `Multiple iterations for read+write (got: ${result1.iterations})`);

  // Read the generated test file
  const testContent = readFileSync(testDestPath, "utf-8");

  // Quality checks
  assert(testContent.includes("coerceParams"), "Test imports/uses coerceParams");
  assert(testContent.includes("describe"), "Uses describe blocks");
  assert(testContent.includes("it("), "Uses it() test cases");

  // Check for specific test patterns
  const hasIntegerTest = testContent.includes("integer") || testContent.includes("Integer") || testContent.includes("42");
  const hasBooleanTest = testContent.includes("boolean") || testContent.includes("Boolean") || testContent.includes("true");
  const hasEdgeCase = testContent.includes("null") || testContent.includes("undefined") || testContent.includes("edge");
  assert(hasIntegerTest, "Has integer coercion tests");
  assert(hasBooleanTest, "Has boolean coercion tests");
  assert(hasEdgeCase, "Has edge case tests (null/undefined)");

  // Verify test file syntax
  try {
    execSync(`node --check "${testDestPath}"`, { stdio: "pipe" });
    assert(true, "Test file passes node --check (valid syntax)");
  } catch (syntaxErr) {
    assert(false, `Test file has syntax errors: ${syntaxErr.message.slice(0, 100)}`);
  }

  console.log(`  [info] Test file size: ${testContent.length} bytes`);
  console.log(`  [info] Iterations: ${result1.iterations}, Tool calls: ${result1.toolUsage.totalCalls}`);
  console.log(`  [info] Tokens: ${result1.usage.totalTokens}`);
  console.log(`  [info] Final answer: "${result1.finalAnswer.slice(0, 200)}"`);
} catch (err) {
  logTimeline("task1_crash", err.message);
  assert(false, `Task 1 crashed: ${err.message}`);
}

// ============================================================
// Task 2: Add JSDoc to an Existing Module
// ============================================================

section("Task 2: 给现有模块添加完整 JSDoc 文档");

// Create a poorly documented module
const undocumentedPath = join(testDir, "src", "dataProcessor.js");
writeFileSync(undocumentedPath, `// data processor - needs documentation

export function processChunk(chunk, options) {
  const { encoding = "utf-8", maxSize = 1024 * 1024 } = options || {};

  if (!chunk) return null;

  let data;
  if (Buffer.isBuffer(chunk)) {
    data = chunk.toString(encoding);
  } else if (typeof chunk === "string") {
    data = chunk;
  } else {
    data = JSON.stringify(chunk);
  }

  if (data.length > maxSize) {
    data = data.slice(0, maxSize);
  }

  const lines = data.split("\\n").filter(l => l.trim());
  return {
    lines,
    lineCount: lines.length,
    truncated: data.length >= maxSize,
    encoding,
  };
}

export function mergeResults(results) {
  const allLines = [];
  let truncated = false;

  for (const r of results) {
    if (!r) continue;
    allLines.push(...(r.lines || []));
    if (r.truncated) truncated = true;
  }

  return {
    lines: allLines,
    lineCount: allLines.length,
    truncated,
  };
}

export function filterByPattern(result, pattern, options = {}) {
  const { caseSensitive = true, maxResults = 100 } = options;
  const regex = caseSensitive ? new RegExp(pattern) : new RegExp(pattern, "i");

  const matched = [];
  for (let i = 0; i < result.lines.length && matched.length < maxResults; i++) {
    if (regex.test(result.lines[i])) {
      matched.push({ line: i + 1, text: result.lines[i] });
    }
  }

  return { matches: matched, count: matched.length, pattern };
}
`, "utf-8");

const loop2 = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir,
  maxIterations: 6,
  maxTokensPerTurn: 4096,
  tokenBudget: 40_000,
  systemPrompt: `You are a documentation engineer. Your task is to add comprehensive JSDoc comments to JavaScript code.

Rules:
1. Read the file first.
2. Add JSDoc comments to ALL exported functions including:
   - @description explaining what the function does
   - @param for each parameter with type and description
   - @returns describing the return value
   - @throws for any errors that may be thrown
   - @example with a usage example
3. Do NOT change any existing code logic.
4. Write the complete file with documentation added.`,
});

logTimeline("task2_start", "Adding JSDoc documentation");
const t2Start = Date.now();
let result2;
try {
  result2 = await loop2.execute({
    goal: `Read the file ${undocumentedPath} and add comprehensive JSDoc documentation to all exported functions (processChunk, mergeResults, filterByPattern). Include @param, @returns, @example for each. Do not change any logic.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`t2_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const t2Ms = Date.now() - t2Start;
  logTimeline("task2_done", `${t2Ms}ms, status=${result2.status}`);

  assert(result2.status === "completed", `Status is 'completed' (got: ${result2.status})`);

  const documentedContent = readFileSync(undocumentedPath, "utf-8");

  // Check JSDoc presence
  const jsdocCount = (documentedContent.match(/\/\*\*/g) || []).length;
  assert(jsdocCount >= 3, `At least 3 JSDoc blocks added (got: ${jsdocCount})`);

  const hasParam = documentedContent.includes("@param");
  const hasReturns = documentedContent.includes("@returns");
  const hasExample = documentedContent.includes("@example");
  assert(hasParam, "Has @param tags");
  assert(hasReturns, "Has @returns tags");
  assert(hasExample, "Has @example blocks");

  // Verify original logic is preserved
  assert(documentedContent.includes("processChunk"), "processChunk function preserved");
  assert(documentedContent.includes("mergeResults"), "mergeResults function preserved");
  assert(documentedContent.includes("filterByPattern"), "filterByPattern function preserved");

  // Syntax check
  try {
    execSync(`node --check "${undocumentedPath}"`, { stdio: "pipe" });
    assert(true, "Documented file passes node --check");
  } catch {
    assert(false, "Documented file has syntax errors");
  }

  console.log(`  [info] JSDoc blocks: ${jsdocCount}, File size: ${documentedContent.length} bytes`);
  console.log(`  [info] Final answer: "${result2.finalAnswer.slice(0, 200)}"`);
} catch (err) {
  logTimeline("task2_crash", err.message);
  assert(false, `Task 2 crashed: ${err.message}`);
}

// ============================================================
// Cleanup & Summary
// ============================================================

function cleanup() {
  try {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

console.log("\n" + "═".repeat(60));
console.log(`  Level 4 Real Codebase Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));
console.log("\n  Timeline:");
for (const entry of timeline) console.log(`    ${entry}`);
if (errors.length > 0) {
  console.log("\n  Failed tests:");
  for (const e of errors) console.log(`    ✗ ${e}`);
}

cleanup();
process.exit(failed > 0 ? 1 : 0);
