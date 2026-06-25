/**
 * Level 6 Inferno — Scenarios 2-5 + final report
 * Extracted from runInfernoE2E.js for file-size compliance.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildTool, createInputSchema } from "../claude-code-patterns/agentToolRegistry.js";
import { createLoop, PROVIDER_ID, MODEL_ID, testState, assert, section, logTimeline } from "./runInfernoE2EInfra.js";

// ============================================================
// S2: 递归算法工坊 — 4 算法 + 测试
// ============================================================

export async function runS2() {
  section("Scenario 2: 递归算法工坊 — 实现 4 个算法 + 完整测试");

  const s2Dir = join(tmpdir(), `inferno-s2-${Date.now()}`);
  mkdirSync(join(s2Dir, "src"), { recursive: true });
  mkdirSync(join(s2Dir, "test"), { recursive: true });

  writeFileSync(join(s2Dir, "TASK.md"), `# Algorithm Implementation Task

Implement 4 algorithms in JavaScript (ES modules) with full test coverage.

## Algorithm 1: Binary Tree Traversal (src/binaryTree.js)
Implement a binary tree with these methods:
- insert(value) — insert into BST
- inOrder() — return array via in-order traversal
- preOrder() — return array via pre-order traversal
- postOrder() — return array via post-order traversal
- find(value) — return true/false
- height() — return tree height
- Edge cases: empty tree, single node, duplicate values, skewed tree

## Algorithm 2: Graph BFS Shortest Path (src/graph.js)
Implement an undirected graph with:
- addEdge(from, to, weight)
- shortestPath(from, to) — return { path: [...], distance: number }
- Edge cases: no path exists, same node, disconnected graph

## Algorithm 3: LRU Cache (src/lruCache.js)
Implement Least Recently Used cache:
- constructor(capacity)
- get(key) — return value or -1, mark as recently used
- put(key, value) — insert/update, evict LRU if over capacity
- Edge cases: capacity 1, overwrite existing key, eviction order

## Algorithm 4: Expression Parser (src/expressionParser.js)
Parse and evaluate simple math expressions:
- parse(expression) — return numeric result
- Supports: +, -, *, /, parentheses, unary minus
- Respects operator precedence
- Edge cases: "3", "(5)", "-3+5", "2*(3+4)", "10/3", "((2+3)*4)"

## Testing
Write comprehensive tests in test/algorithms.test.js using node:test.
Each algorithm needs at least 8 test cases covering normal + edge cases.
After writing, run: node --test test/algorithms.test.js
Fix any failing tests.
`, "utf-8");

  logTimeline("s2_start", "4 algorithms with full test suites");

  const s2Loop = createLoop([], { workingDirectory: s2Dir, maxIterations: 50, tokenBudget: 700_000 });
  const s2Start = Date.now();
  let s2Result;

  try {
    s2Result = await s2Loop.execute({
      goal: `Read TASK.md for full instructions. Implement all 4 algorithms with comprehensive tests. Each algorithm needs at least 8 test cases. After writing, run the tests and fix any failures.`,
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
      onIteration: (iter, data) => {
        if (data.type === "tool_calls_executed") {
          const tools = data.toolCalls.map((tc) => tc.name).join(", ");
          logTimeline(`s2_iter_${iter}`, `tool_calls_executed (${data.durationMs}ms) tools: ${tools}`);
        } else {
          logTimeline(`s2_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
        }
      },
    });

    logTimeline("s2_done", `${Date.now() - s2Start}ms, status=${s2Result.status}, iters=${s2Result.iterations}`);

    assert(s2Result.status === "completed", "S2: status is completed");
    assert(s2Result.iterations >= 3, `S2: multiple iterations (got: ${s2Result.iterations})`);

    const hasBinaryTree = existsSync(join(s2Dir, "src", "binaryTree.js"));
    const hasGraph = existsSync(join(s2Dir, "src", "graph.js"));
    const hasLru = existsSync(join(s2Dir, "src", "lruCache.js"));
    const hasParser = existsSync(join(s2Dir, "src", "expressionParser.js"));
    assert(hasBinaryTree, "S2: binaryTree.js created");
    assert(hasGraph, "S2: graph.js created");
    assert(hasLru, "S2: lruCache.js created");
    assert(hasParser, "S2: expressionParser.js created");

    const testFiles = existsSync(join(s2Dir, "test"))
      ? readdirSync(join(s2Dir, "test")).filter(f => f.endsWith(".test.js"))
      : [];
    assert(testFiles.length >= 1, `S2: test file created (got: ${testFiles.length})`);

    if (hasBinaryTree) {
      const content = readFileSync(join(s2Dir, "src", "binaryTree.js"), "utf-8");
      assert(content.length > 500, `S2: binaryTree.js has substance (${content.length} chars)`);
      assert(content.includes("inOrder") || content.includes("in_order"), "S2: has inOrder traversal");
    }

    if (hasParser) {
      const content = readFileSync(join(s2Dir, "src", "expressionParser.js"), "utf-8");
      assert(content.length > 300, `S2: expressionParser.js has substance (${content.length} chars)`);
    }

    console.log(`  [info] Iterations: ${s2Result.iterations}, Tokens: ${s2Result.usage.totalTokens}`);
    console.log(`  [info] Tool calls: ${s2Result.toolUsage.totalCalls}, errors: ${s2Result.toolUsage.totalErrors}`);
    console.log(`  [info] Duration: ${Date.now() - s2Start}ms`);

  } catch (err) {
    console.log(`  [ERROR] S2 crashed: ${err.message}`);
    testState.failed++;
    testState.errors.push(`S2 crash: ${err.message}`);
  }
}

export async function runS3() {
  section("Scenario 3: Adversarial 工具 — 不可信输出下的判断力");

  const s3Dir = join(tmpdir(), `inferno-s3-${Date.now()}`);
  mkdirSync(s3Dir, { recursive: true });

  writeFileSync(join(s3Dir, "data.json"), JSON.stringify({
    users: [
      { id: 1, name: "Alice", score: 95 },
      { id: 2, name: "Bob", score: 82 },
      { id: 3, name: "Charlie", score: 77 },
      { id: 4, name: "Diana", score: 91 },
    ],
    metadata: { version: 2, generated: "2026-01-15" },
  }, null, 2), "utf-8");

  writeFileSync(join(s3Dir, "config.yaml"), `
database:
  host: localhost
  port: 5432
  name: myapp
cache:
  ttl: 3600
  max_size: 1000
`, "utf-8");

  const adversarialState = { readCalls: 0, writeCalls: 0, grepCalls: 0 };

  const noisyReadTool = buildTool({
    name: "noisy_read",
    description: "Read a file. WARNING: This sensor has known interference — ~20% of reads may include random noise lines starting with '###CORRUPT###'. Always verify output integrity.",
    inputSchema: createInputSchema({ file_path: { type: "string", description: "File path" } }, ["file_path"]),
    execute: async (params) => {
      adversarialState.readCalls++;
      const content = readFileSync(params.file_path, "utf-8");
      if (Math.random() < 0.2) {
        const noiseLine = "\n###CORRUPT### RANDOM_NOISE_DATA_x8f2k ###CORRUPT###\n";
        const lines = content.split("\n");
        const insertAt = Math.floor(Math.random() * lines.length);
        lines.splice(insertAt, 0, noiseLine);
        return { status: "success", content: lines.join("\n"), corrupted: true };
      }
      return { status: "success", content, corrupted: false };
    },
  });

  const truncatingWriteTool = buildTool({
    name: "truncating_write",
    description: "Write content to a file. WARNING: Disk has known bad sectors — ~15% of writes may silently truncate content. Always verify after writing by reading back.",
    inputSchema: createInputSchema(
      { file_path: { type: "string", description: "File path" }, content: { type: "string", description: "Content" } },
      ["file_path", "content"]
    ),
    execute: async (params) => {
      adversarialState.writeCalls++;
      let content = params.content;
      if (Math.random() < 0.15 && content.length > 50) {
        content = content.slice(0, Math.floor(content.length * 0.6));
      }
      writeFileSync(params.file_path, content, "utf-8");
      return { status: "success", file_path: params.file_path, bytesWritten: Buffer.byteLength(content) };
    },
  });

  const falsePositiveGrepTool = buildTool({
    name: "fuzzy_grep",
    description: "Search for a pattern in files. WARNING: This search engine has a known bug — it may return false positive matches. Always verify matches by reading the actual file content.",
    inputSchema: createInputSchema(
      { pattern: { type: "string", description: "Search pattern" }, path: { type: "string", description: "Directory to search" } },
      ["pattern", "path"]
    ),
    execute: async (params) => {
      adversarialState.grepCalls++;
      const files = readdirSync(params.path).filter(f => !f.startsWith("."));
      const results = [];
      for (const file of files) {
        const filePath = join(params.path, file);
        try {
          const content = readFileSync(filePath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(params.pattern)) {
              results.push({ file, line: i + 1, text: lines[i].trim() });
            }
          }
          if (Math.random() < 0.25) {
            results.push({ file, line: 999, text: `###FALSE_POSITIVE### ${params.pattern} found in phantom match` });
          }
        } catch { /* skip */ }
      }
      return { status: "success", matches: results, totalMatches: results.length };
    },
  });

  writeFileSync(join(s3Dir, "ADVERSARIAL_TASK.md"), `# Adversarial Tool Task

You have 3 unreliable tools:
1. noisy_read — may inject ###CORRUPT### noise lines (~20% chance)
2. truncating_write — may silently truncate content (~15% chance)
3. fuzzy_grep — may return false positive matches (~25% chance)

Your job:
1. Read data.json using noisy_read. If you see ###CORRUPT### markers, re-read until clean.
2. Parse the JSON and create a summary: list all users with score > 80, sorted by score descending.
3. Write the summary to summary.txt using truncating_write. VERIFY by reading back — if truncated, re-write.
4. Use fuzzy_grep to find "database" in config.yaml. Ignore any matches containing ###FALSE_POSITIVE###.
5. Report which reads had corruption, which writes were truncated, and which grep results were false positives.

Be skeptical of every tool output. Verify everything.
`, "utf-8");

  logTimeline("s3_start", "3 adversarial tools, verify-everything task");

  const s3Loop = createLoop([noisyReadTool, truncatingWriteTool, falsePositiveGrepTool], {
    workingDirectory: s3Dir,
    maxIterations: 20,
    tokenBudget: 100_000,
  });
  const s3Start = Date.now();
  let s3Result;

  try {
    s3Result = await s3Loop.execute({
      goal: `Read ADVERSARIAL_TASK.md for instructions. Work in ${s3Dir}. Use the adversarial tools (noisy_read, truncating_write, fuzzy_grep) as described. Verify EVERY tool output and retry on corruption/truncation/false positives.`,
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
      onIteration: (iter, data) => {
        if (data.type === "tool_calls_executed") {
          const tools = data.toolCalls.map((tc) => tc.name).join(", ");
          logTimeline(`s3_iter_${iter}`, `tool_calls_executed (${data.durationMs}ms) tools: ${tools}`);
        } else {
          logTimeline(`s3_iter_${iter}`, `${data.type} (${data.durationMs}ms)`);
        }
      },
    });

    logTimeline("s3_done", `${Date.now() - s3Start}ms, status=${s3Result.status}, iters=${s3Result.iterations}`);

    assert(s3Result.status === "completed", "S3: status is completed");
    assert(s3Result.iterations >= 2, `S3: multiple iterations (got: ${s3Result.iterations})`);

    const summaryExists = existsSync(join(s3Dir, "summary.txt"));
    assert(summaryExists, "S3: summary.txt created");

    if (summaryExists) {
      const summary = readFileSync(join(s3Dir, "summary.txt"), "utf-8");
      const hasAlice = summary.toLowerCase().includes("alice");
      const hasDiana = summary.toLowerCase().includes("diana");
      const hasBob = summary.toLowerCase().includes("bob");
      assert(hasAlice && hasDiana, `S3: summary has high-score users (Alice=${hasAlice}, Diana=${hasDiana})`);
      assert(summary.length > 20, `S3: summary not truncated (got ${summary.length} chars)`);
    }

    const answer = s3Result.finalAnswer.toLowerCase();
    const mentionsCorruption = answer.includes("corrupt") || answer.includes("noise") || answer.includes("retry") || answer.includes("clean");
    const mentionsVerification = answer.includes("verif") || answer.includes("read back") || answer.includes("check");
    assert(mentionsCorruption || mentionsVerification, "S3: LLM acknowledges tool unreliability");

    console.log(`  [info] Adversarial tool calls: read=${adversarialState.readCalls}, write=${adversarialState.writeCalls}, grep=${adversarialState.grepCalls}`);
    console.log(`  [info] Iterations: ${s3Result.iterations}, Tokens: ${s3Result.usage.totalTokens}`);
    console.log(`  [info] Duration: ${Date.now() - s3Start}ms`);

  } catch (err) {
    console.log(`  [ERROR] S3 crashed: ${err.message}`);
    testState.failed++;
    testState.errors.push(`S3 crash: ${err.message}`);
  }
}

export async function runS4() {
  section("Scenario 4: 需求演化马拉松 — 4 轮需求变更适应性");

  const s4Dir = join(tmpdir(), `inferno-s4-${Date.now()}`);
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

  logTimeline("s4_start", "4 rounds of requirement evolution");

  const s4Loop = createLoop([], { workingDirectory: s4Dir, maxIterations: 25, tokenBudget: 280_000 });
  const s4Start = Date.now();
  let s4Result;

  try {
    s4Result = await s4Loop.execute({
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

    logTimeline("s4_done", `${Date.now() - s4Start}ms, status=${s4Result.status}, iters=${s4Result.iterations}`);

    assert(s4Result.status === "completed", "S4: status is completed");
    assert(s4Result.iterations >= 3, `S4: multiple iterations (got: ${s4Result.iterations})`);

    const tmFile = join(s4Dir, "src", "taskManager.js");
    if (existsSync(tmFile)) {
      const content = readFileSync(tmFile, "utf-8");

      assert(content.includes("addTask") || content.includes("add_task"), "S4-R1: has addTask");
      assert(content.includes("completeTask") || content.includes("complete"), "S4-R1: has completeTask");

      const codeOnly = content
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const hasName = content.includes("name");
      const noTitle = !codeOnly.match(/title(?!s)/);
      assert(hasName && noTitle, `S4-R2: renamed title→name (hasName=${hasName}, noTitle=${noTitle})`);
      if (!noTitle) {
        const codeLines = codeOnly.split("\n");
        const titleLines = codeLines.map((l, i) => l.match(/title(?!s)/) ? i + 1 : null).filter(Boolean);
        console.log(`  [diag] "title" still in code on lines: ${titleLines.join(", ")}`);
      }
      assert(content.includes("priority"), "S4-R2: has priority field");
      assert(content.includes("archiveTask") || content.includes("archive"), "S4-R2: has archiveTask");

      assert(content.includes("dueDate") || content.includes("due_date"), "S4-R3: has dueDate");
      assert(content.includes("tags"), "S4-R3: has tags");
      assert(content.includes("filterBy") || content.includes("filter_by"), "S4-R3: has filterBy");
      assert(content.includes("createdAt") || content.includes("created_at"), "S4-R3: has timestamps");

      assert(content.includes("search") || content.includes("searchTask"), "S4-R4: has search");
      assert(content.includes("bulkComplete") || content.includes("bulk_complete"), "S4-R4: has bulkComplete");
      assert(content.includes("getStats") || content.includes("stats"), "S4-R4: has getStats");
    } else {
      assert(false, "S4: taskManager.js not created");
    }

    console.log(`  [info] Iterations: ${s4Result.iterations}, Tokens: ${s4Result.usage.totalTokens}`);
    console.log(`  [info] Duration: ${Date.now() - s4Start}ms`);

  } catch (err) {
    console.log(`  [ERROR] S4 crashed: ${err.message}`);
    testState.failed++;
    testState.errors.push(`S4 crash: ${err.message}`);
  }
}

export async function runS5() {
  // Force GC if available to free memory from S1-S4
  if (typeof global.gc === "function") {
    global.gc();
    console.log("  [info] GC triggered between S4 and S5");
  }

  section("Scenario 5: 不可能任务识别 — 逻辑矛盾需求拒绝能力");

  logTimeline("s5_start", "4 impossible/contradictory tasks");

  const impossibleTasks = [
    {
      name: "O(1) comparison sort",
      goal: "Implement a general-purpose comparison-based sorting algorithm that runs in O(1) time complexity for any input size. No pre-processing or bucket/radix tricks allowed — pure comparison sort in constant time.",
      expectRefusal: ["impossible", "O(1)", "cannot", "not possible", "contradiction", "lower bound", "Ω(n log n)", "n log n"],
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
      expectRefusal: ["impossible", "halting problem", "undecidable", "cannot", "Turing", "contradiction"],
    },
  ];

  for (const [taskIdx, task] of impossibleTasks.entries()) {
    console.log(`  [info] Starting S5 task ${taskIdx + 1}/4: ${task.name}`);
    const s5Loop = createLoop([], { maxIterations: 8, tokenBudget: 80_000 });
    const taskStart = Date.now();

    try {
      const feasibilityPrefix = "[FEASIBILITY CHECK REQUIRED] Before attempting any implementation, first carefully analyze whether the stated requirements contain logical contradictions, violate fundamental computer science or mathematical principles, contradict programming language specifications, create self-referential paradoxes, or are provably impossible. Common impossible patterns include: requirements that negate each other (e.g., 'do X without doing X'), operations that violate proven lower bounds, tasks that contradict language semantics by definition, and requests that ask for mathematically proven-undecidable problems. If the task is impossible for ANY reason, clearly explain WHY (cite the relevant theorem, principle, proof, or language spec) and explicitly state that you cannot implement it. Do NOT attempt to write code for impossible tasks — even partial or workaround implementations.\n\nTask: ";
      const result = await s5Loop.execute({
        goal: feasibilityPrefix + task.goal,
        providerId: PROVIDER_ID,
        modelId: MODEL_ID,
      });

      const answer = result.finalAnswer.toLowerCase();
      const hasRefusal = task.expectRefusal.some((keyword) => answer.includes(keyword.toLowerCase()));

      if (hasRefusal) {
        testState.passed++;
        console.log(`  [PASS] S5-${task.name}: LLM correctly identified as impossible`);
      } else {
        testState.failed++;
        testState.errors.push(`S5-${task.name}: LLM did not identify as impossible`);
        console.log(`  [FAIL] S5-${task.name}: LLM did not push back on impossible task`);
      }

      logTimeline(`s5_${task.name}`, `${Date.now() - taskStart}ms, refused=${hasRefusal}, iters=${result.iterations}`);
      console.log(`  [info] Answer (first 200 chars): ${result.finalAnswer.slice(0, 200)}`);

    } catch (err) {
      testState.failed++;
      testState.errors.push(`S5-${task.name} crash: ${err.message}`);
      console.log(`  [ERROR] S5-${task.name} crashed: ${err.message}`);
    }
  }
}

export function finalReport() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Level 6 Inferno Results: ${testState.passed} passed, ${testState.failed} failed`);
  console.log(`${"═".repeat(60)}`);

  if (testState.timeline.length > 0) {
    console.log("\n  Full Timeline:");
    for (const entry of testState.timeline) {
      console.log(`    ${entry}`);
    }
  }

  if (testState.errors.length > 0) {
    console.log("\n  Failed tests:");
    for (const e of testState.errors) {
      console.log(`    ✗ ${e}`);
    }
  }
}
