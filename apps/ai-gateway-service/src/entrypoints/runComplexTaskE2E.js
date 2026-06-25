/**
 * Level 2: 复杂多步任务测试
 *
 * 创建一个小型项目(3个互相依赖的文件),然后让 LLM 执行跨文件重构:
 *   - 把函数从一个文件移到另一个
 *   - 更新所有 import
 *   - 给新函数写单元测试
 *
 * 这需要 LLM: 理解文件间依赖 → 规划多步操作 → 精确修改 → 验证结果
 *
 * 环境变量: NVIDIA_API_KEY (可选, 默认使用 MiMo V2.5 Pro)
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
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
// Create mini project
// ============================================================

const testDir = join(tmpdir(), `complex-task-e2e-${Date.now()}`);
mkdirSync(testDir, { recursive: true });
mkdirSync(join(testDir, "src"), { recursive: true });
mkdirSync(join(testDir, "tests"), { recursive: true });

// File 1: math-utils.js — math functions
const mathUtilsPath = join(testDir, "src", "math-utils.js");
writeFileSync(mathUtilsPath, `/**
 * Math utility functions
 */

export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
}

export function average(numbers) {
  if (!numbers || numbers.length === 0) throw new Error("Empty array");
  return numbers.reduce((sum, n) => add(sum, n), 0) / numbers.length;
}
`, "utf-8");

// File 2: formatter.js — formatting functions that import from math-utils
const formatterPath = join(testDir, "src", "formatter.js");
writeFileSync(formatterPath, `/**
 * Data formatting utilities
 */

import { average, multiply } from "./math-utils.js";

export function formatCurrency(amount, currency = "USD") {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  return symbol + multiply(amount, 1).toFixed(2);
}

export function formatPercentage(value, decimals = 1) {
  return (multiply(value, 100)).toFixed(decimals) + "%";
}

export function formatAverage(numbers) {
  const avg = average(numbers);
  return avg.toFixed(2);
}
`, "utf-8");

// File 3: index.js — main module that uses both
const indexPath = join(testDir, "src", "index.js");
writeFileSync(indexPath, `/**
 * Main application module
 */

import { add, subtract, multiply, divide, average } from "./math-utils.js";
import { formatCurrency, formatPercentage, formatAverage } from "./formatter.js";

export function processOrder(items) {
  const subtotal = items.reduce((sum, item) => add(sum, multiply(item.price, item.quantity)), 0);
  const tax = multiply(subtotal, 0.08);
  const total = add(subtotal, tax);

  return {
    subtotal: formatCurrency(subtotal),
    tax: formatCurrency(tax),
    total: formatCurrency(total),
    itemCount: items.length,
    averagePrice: formatAverage(items.map(i => i.price)),
  };
}

export function calculateDiscount(originalPrice, discountPercent) {
  const discount = multiply(originalPrice, discountPercent / 100);
  return subtract(originalPrice, discount);
}
`, "utf-8");

// File 4: README.md
const readmePath = join(testDir, "README.md");
writeFileSync(readmePath, `# Mini Shop Calculator

A simple calculator for processing orders.

## Structure
- \`src/math-utils.js\` — Core math functions
- \`src/formatter.js\` — Output formatting
- \`src/index.js\` — Main application logic

## Usage
\`\`\`js
import { processOrder } from "./src/index.js";
const result = processOrder([
  { name: "Widget", price: 9.99, quantity: 2 },
  { name: "Gadget", price: 24.99, quantity: 1 },
]);
console.log(result);
\`\`\`
`, "utf-8");

console.log(`[complex-task] Project dir: ${testDir}`);
console.log(`[complex-task] Files: math-utils.js, formatter.js, index.js, README.md`);

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
// Task 1: Cross-file Refactoring
// ============================================================

section("Task 1: 跨文件重构 — 移动函数 + 更新 imports");

const loop1 = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir,
  maxIterations: 12,
  maxTokensPerTurn: 4096,
  tokenBudget: 80_000,
  systemPrompt: `You are a senior JavaScript developer performing code refactoring. You have file tools (file_read, file_write, file_edit).

Rules:
1. ALWAYS read a file before modifying it to understand its current content.
2. When moving functions, update ALL import statements in ALL files that reference them.
3. Preserve ALL existing functionality — this is a pure refactor, no behavior changes.
4. Write complete file contents when using file_write (include all original code plus your changes).`,
});

logTimeline("task1_start", "Cross-file refactoring");
const t1Start = Date.now();
let result1;
try {
  result1 = await loop1.execute({
    goal: `Refactor the project in ${testDir}:

1. Create a new file: src/validators.js with a function:
   export function validatePositiveNumber(value, name) {
     if (typeof value !== "number" || value < 0) throw new Error(name + " must be a positive number");
     return true;
   }

2. In src/math-utils.js: Add validation to the divide function using the new validator (import from ./validators.js).

3. In src/index.js: Add a validateOrderItems function that checks each item has a valid name (string), price (positive number), and quantity (positive integer). Use validators.js.

4. Update the README.md to document the new src/validators.js module.

Read each file first before modifying it. Make sure all imports are correct.`,
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

  // Verify results
  assert(result1.status === "completed" || result1.status === "max_iterations_reached",
    `Status acceptable (got: ${result1.status})`);
  assert(result1.iterations >= 2, `Multiple iterations needed (got: ${result1.iterations})`);

  // Check if new file was created
  const validatorsExist = existsSync(join(testDir, "src", "validators.js"));
  assert(validatorsExist, "src/validators.js was created");

  if (validatorsExist) {
    const validatorsContent = readFileSync(join(testDir, "src", "validators.js"), "utf-8");
    assert(validatorsContent.includes("validatePositiveNumber"), "validators.js contains validatePositiveNumber");
  }

  // Check if math-utils was updated with validator import
  const mathContent = readFileSync(mathUtilsPath, "utf-8");
  assert(mathContent.includes("validate") || mathContent.includes("validator"),
    "math-utils.js references validator");

  // Check if index.js was updated
  const indexContent = readFileSync(indexPath, "utf-8");
  assert(indexContent.includes("validate") || indexContent.includes("validator"),
    "index.js has validation logic");

  // Check README was updated
  const readmeContent = readFileSync(readmePath, "utf-8");
  assert(readmeContent.includes("validator") || readmeContent.includes("Validator"),
    "README.md documents validators module");

  // Token & tool usage
  console.log(`  [info] Total iterations: ${result1.iterations}`);
  console.log(`  [info] Total tool calls: ${result1.toolUsage.totalCalls}`);
  console.log(`  [info] Tool errors: ${result1.toolUsage.totalErrors}`);
  console.log(`  [info] Token usage: ${result1.usage.totalTokens}`);
  if (result1.toolUsage.toolCounts) {
    for (const [tool, count] of Object.entries(result1.toolUsage.toolCounts)) {
      console.log(`  [info]   ${tool}: ${count}x`);
    }
  }
  console.log(`  [info] Final answer: "${result1.finalAnswer.slice(0, 200)}"`);
} catch (err) {
  logTimeline("task1_crash", err.message);
  assert(false, `Task 1 crashed: ${err.message}`);
}

// ============================================================
// Task 2: Bug Diagnosis & Fix
// ============================================================

section("Task 2: Bug 诊断与修复 — 给定一个有 bug 的文件");

// Create a buggy file
const buggyPath = join(testDir, "src", "calculator.js");
writeFileSync(buggyPath, `/**
 * Calculator with intentional bugs
 */

import { add, subtract, multiply, divide } from "./math-utils.js";

// BUG 1: Using string concatenation instead of addition
export function calculateTotal(items) {
  let total = "0";  // should be number 0
  for (const item of items) {
    total += item.price;  // string concat, not addition
  }
  return total;
}

// BUG 2: Off-by-one error in discount tiers
export function applyTieredDiscount(price, quantity) {
  let discount = 0;
  if (quantity >= 100) discount = 0.20;
  else if (quantity >= 50) discount = 0.15;
  else if (quantity >= 10) discount = 0.10;
  else if (quantity >= 1) discount = 0;  // BUG: should be quantity >= 5 for 5% discount
  return multiply(price, subtract(1, discount));
}

// BUG 3: Missing error handling
export function safeDivide(a, b) {
  return divide(a, b);  // will throw on b=0, no try/catch
}
`, "utf-8");

const loop2 = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir,
  maxIterations: 8,
  maxTokensPerTurn: 4096,
  tokenBudget: 50_000,
  systemPrompt: `You are a code reviewer and debugger. Read the file, identify ALL bugs, explain each bug, and then fix them.

Rules:
1. Read the file first.
2. List every bug you find with its line number and explanation.
3. Fix all bugs in a single file_write call.
4. Add comments explaining each fix.`,
});

logTimeline("task2_start", "Bug diagnosis and fix");
const t2Start = Date.now();
let result2;
try {
  result2 = await loop2.execute({
    goal: `Read the file ${buggyPath}, identify all bugs in it, explain each one, and then fix them all.
The file has at least 3 intentional bugs. Find them all and fix them.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`t2_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const t2Ms = Date.now() - t2Start;
  logTimeline("task2_done", `${t2Ms}ms, status=${result2.status}`);

  assert(result2.status === "completed", `Status is 'completed' (got: ${result2.status})`);

  // Check if the file was actually modified
  const fixedContent = readFileSync(buggyPath, "utf-8");

  // BUG 1 fix: should use number 0 instead of string "0"
  const bug1Fixed = !fixedContent.includes('let total = "0"');
  assert(bug1Fixed, "BUG 1 fixed: string '0' → number 0");

  // BUG 2 fix: should add quantity >= 5 tier
  const bug2Fixed = fixedContent.includes("quantity >= 5") || fixedContent.includes("quantity > 4");
  assert(bug2Fixed, "BUG 2 fixed: added 5% discount tier");

  // BUG 3 fix: should add try/catch or default value
  const bug3Fixed = fixedContent.includes("try") || fixedContent.includes("catch") ||
                    fixedContent.includes("b === 0") || fixedContent.includes("b == 0");
  assert(bug3Fixed, "BUG 3 fixed: added error handling for division");

  // Check final answer quality — should mention all 3 bugs
  const answerLower = result2.finalAnswer.toLowerCase();
  const mentionsStringBug = answerLower.includes("string") || answerLower.includes("concat") || answerLower.includes('类型');
  const mentionsOffByOne = answerLower.includes("off-by") || answerLower.includes("tier") || answerLower.includes("5") || answerLower.includes("折扣") || answerLower.includes("tier");
  const mentionsErrorHandling = answerLower.includes("error") || answerLower.includes("try") || answerLower.includes("catch") || answerLower.includes("异常") || answerLower.includes("除");
  console.log(`  [info] Answer mentions: string-bug=${mentionsStringBug}, off-by-one=${mentionsOffByOne}, error-handling=${mentionsErrorHandling}`);

  console.log(`  [info] Iterations: ${result2.iterations}, Tool calls: ${result2.toolUsage.totalCalls}`);
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
console.log(`  Level 2 Complex Task Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));
console.log("\n  Timeline:");
for (const entry of timeline) console.log(`    ${entry}`);
if (errors.length > 0) {
  console.log("\n  Failed tests:");
  for (const e of errors) console.log(`    ✗ ${e}`);
}

cleanup();
process.exit(failed > 0 ? 1 : 0);
