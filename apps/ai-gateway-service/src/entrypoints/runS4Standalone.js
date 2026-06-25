/**
 * Standalone S4 test — Requirement evolution rename consistency
 * Quick test: 1 scenario × ~2 min = ~2 minutes total
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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

function logTimeline(event, detail) {
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`  [${ts}] ${event} — ${detail}`);
}

// ── Provider setup ──
const adapter = new HttpLLMProviderAdapter(
  {
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    providerType: "mimo",
    providerDisplayName: "MiMo",
    modelDisplayName: MODEL_ID,
    endpoint: BASE_URL,
    apiKey: API_KEY,
    enabled: true,
    dryRun: false,
  },
  { timeoutMs: 120_000, defaultMaxTokens: 8192, defaultTemperature: 0.7 }
);

const toolRegistry = createAgentToolRegistry({ workingDirectory: process.cwd() });

function createLoop(tools, extraOpts = {}) {
  return createAgenticLoop({
    providerAdapter: adapter,
    toolRegistry,
    maxIterations: extraOpts.maxIterations ?? 25,
    maxTokensPerTurn: 4096,
    workingDirectory: extraOpts.workingDirectory ?? process.cwd(),
    ...extraOpts,
  });
}

// ── S4: Requirement Evolution Marathon ──
console.log("============================================================");
console.log("  S4 Standalone: Requirement Evolution Rename Consistency");
console.log("============================================================\n");

const s4Dir = mkdtempSync(join(tmpdir(), "inferno-s4-standalone-"));
mkdirSync(join(s4Dir, "src"), { recursive: true });

writeFileSync(join(s4Dir, "EVOLUTION_TASK.md"), `# Requirement Evolution Task

You will implement a task management system through 4 rounds of evolving requirements.
Each round modifies the previous implementation. Read this entire file first.

## Round 1: Basic Todo List
Create src/taskManager.js with:
- addTask(title) — returns task { id, title, done: false }
- completeTask(id) — marks done
- listTasks() — returns all tasks
- deleteTask(id) — removes task

## Round 2: Interface Refactoring (BREAKS Round 1)
- Rename "title" field to "name" in ALL existing tasks and methods
- Add priority field: "low" | "medium" | "high" (default: "medium")
- Add filterByPriority(priority) method
- Remove deleteTask — replace with archiveTask(id) that sets archived: true

## Round 3: Data Model Change (BREAKS Round 2)
- Add dueDate field (ISO string, optional)
- Add tags field (string array, default: [])
- filterByPriority becomes filterBy({ priority?, tags?, dueBefore? })
- Tasks now have createdAt and updatedAt timestamps
- archiveTask moves task to separate archivedTasks array (not just a flag)

## Round 4: Performance & Search (ADDS to Round 3)
- Add searchTasks(query) — full-text search across name, tags, and priority
- Add bulkOperations: bulkComplete(ids), bulkArchive(ids)
- Add getStats() — return { total, active, archived, byPriority, overdue }
- All methods must work correctly with the accumulated changes from rounds 1-3

After implementing ALL 4 rounds, write tests in test/taskManager.test.js.
Run tests and fix failures.
`, "utf-8");

logTimeline("s4_start", `4 rounds of requirement evolution in ${s4Dir}`);

const s4Loop = createLoop([], { workingDirectory: s4Dir, maxIterations: 25, tokenBudget: 200_000 });
const s4Start = Date.now();

try {
  const result = await s4Loop.execute({
    goal: `Read EVOLUTION_TASK.md in ${s4Dir}. Implement ALL 4 rounds of the task management system sequentially. Each round modifies the previous. CRITICAL: When a later round renames a field (e.g., "title" to "name"), you MUST purge the old name from ALL code, parameter names, property names, comments, JSDoc, string literals, and tests — zero residual references to superseded names. After all 4 rounds, write tests and run them. The final code must satisfy ALL round requirements simultaneously with complete internal consistency.`,
    providerId: PROVIDER_ID,
    modelId: MODEL_ID,
    onIteration: (iter, data) => {
      if (data.type === "tool_calls_executed") {
        const tools = data.toolCalls.map((tc) => tc.name).join(", ");
        logTimeline(`s4_iter_${iter}`, `tool_calls_executed (${data.durationMs}ms) tools: ${tools}`);
      } else {
        logTimeline(`s4_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
      }
    },
  });

  logTimeline("s4_done", `${Date.now() - s4Start}ms, status=${result.status}, iters=${result.iterations}`);

  // Diagnostic: print error details if not completed
  if (result.status !== "completed") {
    console.log(`  [diag] Error: ${result.error ?? "none"}`);
    console.log(`  [diag] Answer (first 500 chars): ${(result.finalAnswer ?? "").slice(0, 500)}`);
    if (result.trace) {
      const lastTrace = result.trace.slice(-3);
      lastTrace.forEach((t, i) => console.log(`  [diag] trace[${result.trace.length - 3 + i}]:`, JSON.stringify(t).slice(0, 300)));
    }
  }

  assert(result.status === "completed", "S4: status is completed");
  assert(result.iterations >= 3, `S4: multiple iterations (got: ${result.iterations})`);

  // Check final implementation
  const tmFile = join(s4Dir, "src", "taskManager.js");
  if (existsSync(tmFile)) {
    const content = readFileSync(tmFile, "utf-8");

    // Round 1 basics
    assert(content.includes("addTask") || content.includes("add_task"), "S4-R1: has addTask");
    assert(content.includes("completeTask") || content.includes("complete"), "S4-R1: has completeTask");

    // Round 2: name field (not title), priority, archiveTask
    // Strip JS comments before checking for residual "title" references —
    // comments explaining the rename history are acceptable.
    const codeOnly = content
      .replace(/\/\/.*$/gm, "")        // strip line comments
      .replace(/\/\*[\s\S]*?\*\//g, ""); // strip block comments
    const hasName = content.includes("name");
    const noTitle = !codeOnly.match(/title(?!s)/);
    assert(hasName && noTitle, `S4-R2: renamed title→name (hasName=${hasName}, noTitle=${noTitle})`);
    if (!noTitle) {
      const lines = codeOnly.split("\n");
      const titleLines = lines.map((l, i) => l.match(/title(?!s)/) ? i + 1 : null).filter(Boolean);
      console.log(`  [diag] "title" still found in code on lines: ${titleLines.join(", ")}`);
      titleLines.slice(0, 5).forEach((ln) => {
        console.log(`  [diag]   L${ln}: ${lines[ln - 1].trim().slice(0, 120)}`);
      });
    }
    assert(content.includes("priority"), "S4-R2: has priority field");
    assert(content.includes("archiveTask") || content.includes("archive"), "S4-R2: has archiveTask");

    // Round 3: dueDate, tags, filterBy, timestamps
    assert(content.includes("dueDate") || content.includes("due_date"), "S4-R3: has dueDate");
    assert(content.includes("tags"), "S4-R3: has tags");
    assert(content.includes("filterBy") || content.includes("filter_by"), "S4-R3: has filterBy");
    assert(content.includes("createdAt") || content.includes("created_at"), "S4-R3: has timestamps");

    // Round 4: search, bulkOps, stats
    assert(content.includes("search") || content.includes("searchTask"), "S4-R4: has search");
    assert(content.includes("bulkComplete") || content.includes("bulk_complete"), "S4-R4: has bulkComplete");
    assert(content.includes("getStats") || content.includes("stats"), "S4-R4: has getStats");
  } else {
    assert(false, "S4: taskManager.js not created");
  }

  console.log(`  [info] Iterations: ${result.iterations}, Tokens: ${result.usage?.totalTokens ?? "N/A"}`);
  console.log(`  [info] Duration: ${Date.now() - s4Start}ms`);

} catch (err) {
  console.log(`  [ERROR] S4 crashed: ${err.message}`);
  failed++;
}

console.log("\n============================================================");
console.log(`  S4 Standalone Results: ${passed} passed, ${failed} failed (${((Date.now() - s4Start) / 1000).toFixed(1)}s)`);
console.log("============================================================\n");

process.exit(failed > 0 ? 1 : 0);
