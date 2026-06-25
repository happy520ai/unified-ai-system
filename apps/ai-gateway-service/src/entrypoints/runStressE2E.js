/**
 * Level 5: 长会话压力测试
 *
 * 测试 agentic loop 在 20+ 迭代下的稳定性:
 *   1. 批量文件处理: 创建 10 个文件, 让 LLM 给每个加注释
 *   2. Token 预算耗尽: 低预算下观察优雅降级
 *   3. 目标漂移检测: LLM 是否在长上下文中丢失原始目标
 *
 * 这是最难的测试 — 需要 LLM 在大量上下文中保持连贯。
 *
 * 环境变量: NVIDIA_API_KEY (可选, 默认使用 MiMo V2.5 Pro)
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
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
// Scenario 1: Batch File Processing (10 files, 20+ iterations)
// ============================================================

section("Scenario 1: 批量文件处理 — 10 个文件逐个添加注释");

const testDir1 = join(tmpdir(), `stress-batch-${Date.now()}`);
mkdirSync(testDir1, { recursive: true });
mkdirSync(join(testDir1, "modules"), { recursive: true });

// Create 10 module files, each with a simple function
const moduleNames = [
  "stringUtils", "arrayUtils", "objectUtils", "mathUtils", "dateUtils",
  "formatUtils", "validateUtils", "convertUtils", "cryptoUtils", "cacheUtils",
];

for (let i = 0; i < moduleNames.length; i++) {
  const name = moduleNames[i];
  const filePath = join(testDir1, "modules", `${name}.js`);
  writeFileSync(filePath, `// Module: ${name}
// TODO: Add JSDoc comments

export function ${name.replace("Utils", "")}Helper_${i}(input) {
  if (!input) return null;
  const result = typeof input === "string" ? input.trim() : String(input);
  return { processed: true, value: result, moduleId: ${i} };
}

export function ${name.replace("Utils", "")}Transform_${i}(data) {
  if (Array.isArray(data)) return data.map(d => ${name.replace("Utils", "")}Helper_${i}(d));
  return ${name.replace("Utils", "")}Helper_${i}(data);
}
`, "utf-8");
}

console.log(`[stress] Created ${moduleNames.length} module files in ${testDir1}/modules/`);

const loop1 = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir1,
  maxIterations: 25,
  maxTokensPerTurn: 4096,
  tokenBudget: 100_000,
  systemPrompt: `You are a documentation assistant. Your job is to add JSDoc comments to JavaScript files.

Rules:
1. Process files one at a time.
2. Read each file, add JSDoc to all exported functions, then write it back.
3. After processing all files, provide a summary of what you did.
4. Be efficient — don't re-read files you already processed.

The modules directory contains 10 files. Process ALL of them.`,
});

logTimeline("scenario1_start", "Processing 10 files with 25 max iterations");
const s1Start = Date.now();
let result1;
const iterationDetails = [];

try {
  result1 = await loop1.execute({
    goal: `List all .js files in the ${join(testDir1, "modules")} directory, then read each file and add a JSDoc comment to every exported function. Process all 10 files. After you're done, provide a summary listing every file you modified.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      const detail = data.type === "tool_calls_executed"
        ? `tools: ${data.toolCalls.map((tc) => tc.name).join(", ")}`
        : data.type === "final_answer"
        ? `"${(data.text || "").slice(0, 60)}..."`
        : data.type;
      logTimeline(`s1_iter_${iter}`, `${data.type} (${data.durationMs}ms) ${detail}`);
      iterationDetails.push({ iter, type: data.type, durationMs: data.durationMs });
    },
  });
  const s1Ms = Date.now() - s1Start;
  logTimeline("scenario1_done", `${s1Ms}ms, status=${result1.status}, iters=${result1.iterations}`);

  // How many files were actually modified?
  let filesWithJsdoc = 0;
  for (const name of moduleNames) {
    try {
      const content = readFileSync(join(testDir1, "modules", `${name}.js`), "utf-8");
      if (content.includes("/**")) filesWithJsdoc++;
    } catch { /* ignore */ }
  }

  assert(result1.iterations >= 2, `Multiple iterations needed (got: ${result1.iterations})`);
  assert(filesWithJsdoc >= 1, `At least 1 file got JSDoc (got: ${filesWithJsdoc}/${moduleNames.length})`);

  // Check if LLM hit max iterations
  if (result1.status === "max_iterations_reached") {
    console.log(`  [WARN] Hit max iterations (${result1.iterations}). ${moduleNames.length - filesWithJsdoc} files not processed.`);
    console.log(`  [info] This reveals the practical limit of iteration count vs task scope.`);
  }

  // Check final answer quality
  assert(typeof result1.finalAnswer === "string" && result1.finalAnswer.length > 20, "Has substantive summary");

  // Token usage analysis
  console.log(`  [info] Files processed: ${filesWithJsdoc}/${moduleNames.length}`);
  console.log(`  [info] Iterations: ${result1.iterations}`);
  console.log(`  [info] Tool calls: ${result1.toolUsage.totalCalls}, errors: ${result1.toolUsage.totalErrors}`);
  console.log(`  [info] Token usage: in=${result1.usage.inputTokens}, out=${result1.usage.outputTokens}, total=${result1.usage.totalTokens}`);
  console.log(`  [info] Duration: ${result1.durationMs}ms`);

  // Check for goal drift — does the final answer mention file processing?
  const answerLower = result1.finalAnswer.toLowerCase();
  const mentionsFiles = answerLower.includes("file") || answerLower.includes("module") || answerLower.includes("jsdoc") || answerLower.includes("comment");
  assert(mentionsFiles, "Final answer is on-topic (mentions files/modules/documentation)");

  if (result1.toolUsage.toolCounts) {
    console.log(`  [info] Tool usage breakdown:`);
    for (const [tool, count] of Object.entries(result1.toolUsage.toolCounts)) {
      console.log(`    ${tool}: ${count}x`);
    }
  }
} catch (err) {
  logTimeline("scenario1_crash", err.message);
  assert(false, `Scenario 1 crashed: ${err.message}`);
}

// ============================================================
// Scenario 2: Token Budget Exhaustion
// ============================================================

section("Scenario 2: Token 预算耗尽 — 低预算下的优雅降级");

const testDir2 = join(tmpdir(), `stress-budget-${Date.now()}`);
mkdirSync(testDir2, { recursive: true });

const bigFile = join(testDir2, "big-module.js");
writeFileSync(bigFile, Array.from({ length: 50 }, (_, i) =>
  `export function func_${i}(x) { return x * ${i + 1} + ${i}; }`
).join("\n"), "utf-8");

console.log(`[stress] Created 50-function module for budget test`);

const loop2 = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir2,
  maxIterations: 15,
  maxTokensPerTurn: 2048,
  tokenBudget: 15_000,  // Very tight budget
  systemPrompt: `You are a code documentation assistant. Add JSDoc comments to functions.
IMPORTANT: If you see a token budget warning, wrap up immediately with a summary. Do NOT continue processing.`,
});

logTimeline("scenario2_start", "Tight budget test (15K tokens)");
const s2Start = Date.now();
let result2;
try {
  result2 = await loop2.execute({
    goal: `Read ${bigFile} and add JSDoc comments to ALL 50 functions. This is a large file, so be thorough but efficient.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      logTimeline(`s2_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
    },
  });
  const s2Ms = Date.now() - s2Start;
  logTimeline("scenario2_done", `${s2Ms}ms, status=${result2.status}`);

  // Check if budget warning was triggered
  const budgetWarnings = result2.trace.filter((t) => t.type === "token_budget_warning");
  console.log(`  [info] Token budget warnings: ${budgetWarnings.length}`);
  console.log(`  [info] Total tokens used: ${result2.usage.totalTokens}`);
  console.log(`  [info] Iterations before stop: ${result2.iterations}`);

  assert(typeof result2.status === "string", `Has valid status: ${result2.status}`);
  assert(result2.usage.totalTokens > 0, "Some tokens were consumed");

  // The LLM should have at least tried to process the file
  assert(result2.toolUsage.totalCalls >= 1, "At least 1 tool call was made");
  console.log(`  [info] Final answer: "${result2.finalAnswer.slice(0, 200)}"`);
} catch (err) {
  logTimeline("scenario2_crash", err.message);
  assert(false, `Scenario 2 crashed: ${err.message}`);
}

// ============================================================
// Scenario 3: Goal Drift Detection
// ============================================================

section("Scenario 3: 目标漂移检测 — 长上下文中是否丢失原始目标");

const testDir3 = join(tmpdir(), `stress-drift-${Date.now()}`);
mkdirSync(testDir3, { recursive: true });

// Create some decoy files
for (let i = 0; i < 5; i++) {
  writeFileSync(join(testDir3, `decoy_${i}.txt`), `Decoy file ${i}\nThis is not the target.\n`, "utf-8");
}
// Create the actual target
const targetFile = join(testDir3, "TARGET.md");
writeFileSync(targetFile, `# Target File

This is the file you need to modify.

## Requirements
- Add a section called "Processed By"
- Write "Agentic Loop v1.0" in that section
- Do NOT modify any other files

## Current Content
- Section 1: Introduction
- Section 2: Details
`, "utf-8");

console.log(`[stress] Created 5 decoy files + 1 target file`);

const loop3 = createAgenticLoop({
  providerAdapter: realProvider,
  workingDirectory: testDir3,
  maxIterations: 12,
  maxTokensPerTurn: 2048,
  tokenBudget: 50_000,
  systemPrompt: `You are a precise file editing assistant. Follow instructions EXACTLY.
Only modify the file specified in the goal. Do NOT modify any other files.
Read the target file first, make the changes, then verify the result.`,
});

logTimeline("scenario3_start", "Goal drift detection test");
const s3Start = Date.now();
let result3;
try {
  result3 = await loop3.execute({
    goal: `CRITICAL INSTRUCTION: You must ONLY modify the file ${targetFile}. Do NOT touch any decoy_*.txt files.

In ${targetFile}:
1. Read the file first
2. Add a new section "## Processed By" at the end
3. Under it write "Agentic Loop v1.0"
4. Read the file again to verify your changes

DO NOT modify any other file. This is the most important rule.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      const detail = data.type === "tool_calls_executed"
        ? `tools: ${data.toolCalls.map((tc) => tc.name).join(", ")}`
        : data.type;
      logTimeline(`s3_iter_${iter}`, `${data.type} (${data.durationMs}ms) ${detail}`);
    },
  });
  const s3Ms = Date.now() - s3Start;
  logTimeline("scenario3_done", `${s3Ms}ms, status=${result3.status}`);

  // Verify target file was modified correctly
  const targetContent = readFileSync(targetFile, "utf-8");
  assert(targetContent.includes("Processed By"), "Target file has 'Processed By' section");
  assert(targetContent.includes("Agentic Loop v1.0"), "Target file has 'Agentic Loop v1.0'");
  assert(targetContent.includes("Introduction"), "Original content preserved");

  // Verify decoy files were NOT modified
  let decoysModified = 0;
  for (let i = 0; i < 5; i++) {
    const decoyContent = readFileSync(join(testDir3, `decoy_${i}.txt`), "utf-8");
    if (decoyContent !== `Decoy file ${i}\nThis is not the target.\n`) {
      decoysModified++;
    }
  }
  assert(decoysModified === 0, `No decoy files modified (modified: ${decoysModified}/5)`);

  // Check tool call trace for scope adherence
  const fileWriteCalls = result3.allToolResults?.filter(
    (r) => r._meta?.toolName === "file_write" || r._meta?.toolName === "file_edit"
  ) || [];
  console.log(`  [info] Total file write/edit calls: ${fileWriteCalls.length}`);
  console.log(`  [info] Iterations: ${result3.iterations}, Tokens: ${result3.usage.totalTokens}`);
  console.log(`  [info] Final answer: "${result3.finalAnswer.slice(0, 200)}"`);
} catch (err) {
  logTimeline("scenario3_crash", err.message);
  assert(false, `Scenario 3 crashed: ${err.message}`);
}

// ============================================================
// Cleanup & Summary
// ============================================================

function cleanup() {
  for (const dir of [testDir1, testDir2, testDir3]) {
    try {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

console.log("\n" + "═".repeat(60));
console.log(`  Level 5 Stress Test Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));

// Iteration timeline
if (iterationDetails.length > 0) {
  console.log("\n  Iteration timeline (Scenario 1):");
  for (const d of iterationDetails) {
    console.log(`    iter ${d.iter}: ${d.type} (${d.durationMs}ms)`);
  }
}

console.log("\n  Full Timeline:");
for (const entry of timeline) console.log(`    ${entry}`);

if (errors.length > 0) {
  console.log("\n  Failed tests:");
  for (const e of errors) console.log(`    ✗ ${e}`);
}

cleanup();
process.exit(failed > 0 ? 1 : 0);
