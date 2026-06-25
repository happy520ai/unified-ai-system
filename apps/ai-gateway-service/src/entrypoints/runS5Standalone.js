/**
 * Standalone S5 test — Impossible task refusal with feasibility prefix
 * Quick test: ~5 tasks × 30-60s each = ~3-5 minutes total
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";

process.on("uncaughtException", (err) => {
  console.error(`[FATAL] Uncaught exception: ${err.message}`);
  console.error(err.stack);
  process.exit(2);
});
process.on("unhandledRejection", (reason) => {
  console.error(`[FATAL] Unhandled rejection: ${reason}`);
  process.exit(3);
});

const API_KEY = process.env.NVIDIA_API_KEY ?? "";
const BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const MODEL_ID = "mimo-v2.5-pro";
const PROVIDER_ID = "mimo";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  [PASS] ${label}`); }
  else { failed++; console.log(`  [FAIL] ${label}`); }
}

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

function createLoop(opts = {}) {
  const registry = createAgentToolRegistry({
    workingDirectory: opts.workingDirectory || process.cwd(),
  });
  return createAgenticLoop({
    providerAdapter: provider,
    toolRegistry: registry,
    maxIterations: opts.maxIterations ?? 8,
    tokenBudget: opts.tokenBudget ?? 80_000,
    workingDirectory: opts.workingDirectory || process.cwd(),
  });
}

const FEASIBILITY_PREFIX = "[FEASIBILITY CHECK REQUIRED] Before attempting any implementation, first carefully analyze whether the stated requirements contain logical contradictions, violate fundamental computer science or mathematical principles, contradict programming language specifications, create self-referential paradoxes, or are provably impossible. Common impossible patterns include: requirements that negate each other (e.g., 'do X without doing X'), operations that violate proven lower bounds, tasks that contradict language semantics by definition, and requests that ask for mathematically proven-undecidable problems. If the task is impossible for ANY reason, clearly explain WHY (cite the relevant theorem, principle, proof, or language spec) and explicitly state that you cannot implement it. Do NOT attempt to write code for impossible tasks — even partial or workaround implementations.\n\nTask: ";

const impossibleTasks = [
  {
    name: "O(1) comparison sort",
    goal: "Implement a general-purpose comparison-based sorting algorithm that runs in O(1) time complexity for any input size. No pre-processing or bucket/radix tricks allowed — pure comparison sort in constant time.",
    expectRefusal: ["impossible", "o(1)", "cannot", "not possible", "contradiction", "lower bound", "n log n", "n log n"],
  },
  {
    name: "Side-effect-free file write",
    goal: "Write a function that writes content to a file on disk, but the function must have absolutely zero side effects. The file system must not be modified in any way. Yet the caller must be able to read the written content afterward.",
    expectRefusal: ["impossible", "contradiction", "side effect", "cannot", "writing is a side effect", "paradox"],
  },
  {
    name: "Perfect lossless compression",
    goal: "Implement a lossless compression algorithm that can compress ANY arbitrary input data to exactly 1 byte, regardless of input size. The decompression must perfectly recover the original data. This should work for inputs of any size — 1KB, 1MB, or 1GB.",
    expectRefusal: ["impossible", "pigeonhole", "cannot", "contradiction", "information theory", "lossless"],
  },
  {
    name: "Halting problem solver",
    goal: "Write a function willTerminate(program) that takes a JavaScript function as input and returns true if the function will eventually return (halt), or false if it will run forever. This must work correctly for ALL possible input functions, including ones that call willTerminate themselves.",
    expectRefusal: ["impossible", "halting problem", "undecidable", "cannot", "turing", "contradiction"],
  },
];

console.log("============================================================");
console.log("  S5 Standalone: Impossible Task Refusal (with feasibility prefix)");
console.log("============================================================\n");

const startTime = Date.now();

for (const [idx, task] of impossibleTasks.entries()) {
  console.log(`\n  [info] Task ${idx + 1}/4: ${task.name}`);
  const loop = createLoop();
  const taskStart = Date.now();

  try {
    const result = await loop.execute({
      goal: FEASIBILITY_PREFIX + task.goal,
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
    });

    const answer = result.finalAnswer.toLowerCase();
    const hasRefusal = task.expectRefusal.some((kw) => answer.includes(kw.toLowerCase()));

    const elapsed = ((Date.now() - taskStart) / 1000).toFixed(1);
    console.log(`  [info] Status: ${result.status}, iters: ${result.iterations}, ${elapsed}s`);
    console.log(`  [info] Tokens: ${result.totalTokens || "N/A"}`);
    console.log(`  [info] Refused: ${hasRefusal}`);
    console.log(`  [info] Answer (first 300 chars): ${result.finalAnswer.substring(0, 300)}`);

    assert(hasRefusal, `S5-${task.name}: LLM ${hasRefusal ? "correctly identified as impossible" : "did not push back on impossible task"}`);
  } catch (err) {
    console.error(`  [ERROR] ${task.name}: ${err.message}`);
    failed++;
  }

  // Rate-limit cooldown between tasks (skip after last)
  if (idx < impossibleTasks.length - 1) {
    console.log("  [info] Cooling down 15s to avoid rate limit...");
    await new Promise((r) => setTimeout(r, 15_000));
  }
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n${"=".repeat(60)}`);
console.log(`  S5 Standalone Results: ${passed} passed, ${failed} failed (${totalElapsed}s)`);
console.log(`${"=".repeat(60)}`);
