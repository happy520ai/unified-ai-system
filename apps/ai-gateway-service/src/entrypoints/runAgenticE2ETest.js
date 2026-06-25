/**
 * E2E Test: Agentic Coding Loop 端到端场景测试
 *
 * 场景: "给 utils.js 添加一个 capitalize 函数"
 *
 * Mock Provider 行为 (模拟 LLM 3 轮对话):
 *   Turn 1: LLM 决定调用 file_read 读取 utils.js
 *   Turn 2: LLM 看到文件内容后, 决定调用 file_write 追加新函数
 *   Turn 3: LLM 提供最终总结文本 (无 tool_calls)
 *
 * 验证项:
 *   1. 循环完整执行 3 轮
 *   2. file_read 工具实际读取了文件
 *   3. file_write 工具实际修改了文件
 *   4. trace 记录完整
 *   5. toolUsage 统计正确
 *   6. finalAnswer 非空
 *   7. 输入校验 (null input, empty goal)
 *   8. provider 错误处理
 *   9. max iterations 到达处理
 *  10. 流式接口基本测试
 */

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// Test infrastructure
// ============================================================

let passed = 0;
let failed = 0;
const errors = [];

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

// ============================================================
// Temp project setup
// ============================================================

const testDir = join(tmpdir(), `e2e-agentic-${Date.now()}`);
mkdirSync(testDir, { recursive: true });

const utilsPath = join(testDir, "utils.js");
const originalContent = `// utils.js
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
`;
writeFileSync(utilsPath, originalContent, "utf-8");

console.log(`[e2e] Test project dir: ${testDir}`);
console.log(`[e2e] utils.js created: ${utilsPath}`);

// ============================================================
// Mock Provider Adapter
// ============================================================

function createMockProvider() {
  let callCount = 0;

  return {
    getCallCount: () => callCount,
    async generate(providerRequest) {
      callCount++;
      const messages = providerRequest?.request?.messages || [];
      const lastMessage = messages[messages.length - 1];

      // Turn 1: Read the file
      if (callCount === 1) {
        return {
          text: "Let me first read the current file to understand its structure.",
          toolCalls: [
            {
              id: "call_read_1",
              name: "file_read",
              arguments: { file_path: utilsPath },
            },
          ],
          raw: { finishReason: "tool_calls" },
          usage: { inputTokens: 200, outputTokens: 30, totalTokens: 230 },
        };
      }

      // Turn 2: Write the updated file
      if (callCount === 2) {
        const updatedContent =
          originalContent +
          `
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
`;
        return {
          text: "Now I'll add the capitalize function.",
          toolCalls: [
            {
              id: "call_write_1",
              name: "file_write",
              arguments: {
                file_path: utilsPath,
                content: updatedContent,
              },
            },
          ],
          raw: { finishReason: "tool_calls" },
          usage: { inputTokens: 400, outputTokens: 80, totalTokens: 480 },
        };
      }

      // Turn 3: Final answer (no tool calls)
      if (callCount === 3) {
        return {
          text: "I've successfully added a `capitalize` function to utils.js. It handles empty strings and capitalizes the first letter of the input string.",
          toolCalls: null,
          raw: { finishReason: "stop" },
          usage: { inputTokens: 500, outputTokens: 40, totalTokens: 540 },
        };
      }

      // Safety: should not be called more than 3 times
      return {
        text: "Unexpected extra iteration.",
        toolCalls: null,
        raw: { finishReason: "stop" },
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      };
    },
  };
}

// Error provider for testing error handling
function createErrorProvider(failOnCall = 1) {
  let callCount = 0;
  return {
    async generate() {
      callCount++;
      if (callCount === failOnCall) {
        throw new Error("Simulated provider failure");
      }
      return { text: "OK", toolCalls: null, raw: { finishReason: "stop" }, usage: {} };
    },
  };
}

// Infinite tool-call provider for max iterations test
function createInfiniteLoopProvider() {
  let callCount = 0;
  return {
    async generate() {
      callCount++;
      return {
        text: `Thinking step ${callCount}...`,
        toolCalls: [
          {
            id: `call_${callCount}`,
            name: "file_read",
            arguments: { file_path: utilsPath },
          },
        ],
        raw: { finishReason: "tool_calls" },
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      };
    },
  };
}

// ============================================================
// Run tests
// ============================================================

async function runTests() {
  // -----------------------------------------------
  section("Scenario 1: 3-turn file read + write + answer");
  // -----------------------------------------------

  const mockProvider = createMockProvider();
  const loop = createAgenticLoop({
    providerAdapter: mockProvider,
    workingDirectory: testDir,
    maxIterations: 10,
  });

  const iterations = [];
  const result = await loop.execute({
    goal: "Add a capitalize function to utils.js",
    onIteration: (iter, data) => {
      iterations.push({ iter, type: data.type });
    },
  });

  // Basic result structure
  assert(typeof result.sessionId === "string" && result.sessionId.length > 0, "Result has sessionId");
  assert(result.status === "completed", `Status is 'completed' (got: ${result.status})`);
  assert(typeof result.finalAnswer === "string" && result.finalAnswer.length > 0, "Has non-empty finalAnswer");
  assert(result.iterations === 3, `Ran exactly 3 iterations (got: ${result.iterations})`);

  // Provider was called 3 times
  assert(mockProvider.getCallCount() === 3, `Provider called 3 times (got: ${mockProvider.getCallCount()})`);

  // Tool usage
  assert(result.toolUsage.totalCalls === 2, `2 tool calls total (got: ${result.toolUsage.totalCalls})`);
  assert(result.toolUsage.totalErrors === 0, `0 tool errors (got: ${result.toolUsage.totalErrors})`);

  // Usage accumulation
  assert(result.usage.totalTokens === 1250, `Total tokens accumulated correctly (got: ${result.usage.totalTokens})`);

  // Trace completeness
  assert(result.trace.length >= 5, `Trace has >= 5 entries (got: ${result.trace.length})`);
  const toolCallTraces = result.trace.filter((t) => t.type === "tool_calls");
  const toolResultTraces = result.trace.filter((t) => t.type === "tool_results");
  const finalAnswerTrace = result.trace.find((t) => t.type === "final_answer");
  assert(toolCallTraces.length === 2, `2 tool_call traces (got: ${toolCallTraces.length})`);
  assert(toolResultTraces.length === 2, `2 tool_result traces (got: ${toolResultTraces.length})`);
  assert(finalAnswerTrace != null, "Has final_answer trace");

  // Iteration callbacks
  assert(iterations.length === 3, `3 iteration callbacks fired (got: ${iterations.length})`);
  assert(
    iterations.filter((i) => i.type === "tool_calls_executed").length === 2,
    "2 tool_calls_executed callbacks"
  );
  assert(
    iterations.filter((i) => i.type === "final_answer").length === 1,
    "1 final_answer callback"
  );

  // Messages history
  assert(result.messages.length >= 6, `Messages has >= 6 entries (got: ${result.messages.length})`);
  const systemMsg = result.messages.find((m) => m.role === "system");
  assert(systemMsg != null, "System message present");
  const userMsg = result.messages.find((m) => m.role === "user");
  assert(userMsg != null && userMsg.content.includes("capitalize"), "User message contains goal");
  const toolMsgs = result.messages.filter((m) => m.role === "tool");
  assert(toolMsgs.length === 2, `2 tool result messages (got: ${toolMsgs.length})`);

  // Real file was modified
  const updatedContent = readFileSync(utilsPath, "utf-8");
  assert(updatedContent.includes("capitalize"), "File was actually modified on disk");
  assert(updatedContent.includes("charAt(0).toUpperCase()"), "File contains the new function body");
  assert(updatedContent.includes("export function add"), "Original functions preserved");

  // -----------------------------------------------
  section("Scenario 2: Input validation");
  // -----------------------------------------------

  const nullResult = await loop.execute(null);
  assert(nullResult.status === "error", "null input → error status");
  assert(nullResult.error?.code === "AGENTIC_INPUT_INVALID", "null input → AGENTIC_INPUT_INVALID code");

  const emptyResult = await loop.execute({ goal: "" });
  assert(emptyResult.status === "error", "empty goal → error status");
  assert(emptyResult.error?.code === "AGENTIC_GOAL_EMPTY", "empty goal → AGENTIC_GOAL_EMPTY code");

  const whitespaceResult = await loop.execute({ goal: "   " });
  assert(whitespaceResult.status === "error", "whitespace goal → error status");

  // -----------------------------------------------
  section("Scenario 3: Provider error handling");
  // -----------------------------------------------

  const errorProvider = createErrorProvider(1);
  const errorLoop = createAgenticLoop({
    providerAdapter: errorProvider,
    workingDirectory: testDir,
    maxIterations: 5,
  });

  const errorResult = await errorLoop.execute({ goal: "Do something" });
  assert(errorResult.status === "error", "Provider error → error status");
  assert(
    errorResult.trace.some((t) => t.code === "PROVIDER_ERROR"),
    "Trace contains PROVIDER_ERROR"
  );
  assert(
    errorResult.finalAnswer.includes("Simulated provider failure"),
    "Error message propagated to finalAnswer"
  );

  // -----------------------------------------------
  section("Scenario 4: Max iterations reached");
  // -----------------------------------------------

  const infiniteProvider = createInfiniteLoopProvider();
  const smallLoop = createAgenticLoop({
    providerAdapter: infiniteProvider,
    workingDirectory: testDir,
    maxIterations: 3,
  });

  const maxResult = await smallLoop.execute({ goal: "Keep going forever" });
  assert(
    maxResult.status === "max_iterations_reached",
    `Status is max_iterations_reached (got: ${maxResult.status})`
  );
  assert(maxResult.iterations === 3, `Stopped at 3 iterations (got: ${maxResult.iterations})`);
  assert(
    maxResult.finalAnswer.includes("maximum iterations"),
    "Final answer mentions max iterations"
  );

  // -----------------------------------------------
  section("Scenario 5: Tool allowlist filtering");
  // -----------------------------------------------

  const allowlistProvider = createMockProvider();
  const allowlistLoop = createAgenticLoop({
    providerAdapter: allowlistProvider,
    workingDirectory: testDir,
    maxIterations: 10,
  });

  const info = allowlistLoop.getInfo();
  assert(info.toolCount > 5, `Registry has ${info.toolCount} tools (more than 5)`);
  assert(info.hasAutoContext === true, "AutoContext enabled");
  assert(info.hasProjectInstructions === true, "ProjectInstructions enabled");
  assert(info.hasSubagentDispatch === true, "SubagentDispatch enabled");

  // -----------------------------------------------
  section("Scenario 6: Token budget warning");
  // -----------------------------------------------

  // Create a provider that returns high token usage
  const budgetProvider = {
    async generate() {
      return {
        text: "Done.",
        toolCalls: null,
        raw: { finishReason: "stop" },
        usage: { inputTokens: 80000, outputTokens: 40000, totalTokens: 120000 },
      };
    },
  };

  const budgetLoop = createAgenticLoop({
    providerAdapter: budgetProvider,
    workingDirectory: testDir,
    maxIterations: 5,
    tokenBudget: 100000,
  });

  const budgetResult = await budgetLoop.execute({ goal: "Use lots of tokens" });
  const budgetWarning = budgetResult.trace.find((t) => t.type === "token_budget_warning");
  assert(budgetWarning != null, "Token budget warning emitted when usage exceeds budget");
  assert(
    budgetWarning?.totalTokens === 120000,
    `Warning records correct token count (got: ${budgetWarning?.totalTokens})`
  );

  // -----------------------------------------------
  section("Scenario 7: Stream interface basic test");
  // -----------------------------------------------

  const streamProvider = createMockProvider();
  const streamLoop = createAgenticLoop({
    providerAdapter: streamProvider,
    workingDirectory: testDir,
    maxIterations: 10,
  });

  const events = [];
  for await (const event of streamLoop.executeStream({
    goal: "Add a capitalize function to utils.js",
  })) {
    events.push(event.type);
  }

  assert(events.includes("start"), "Stream emits 'start' event");
  assert(events.includes("iteration_start"), "Stream emits 'iteration_start' event");
  assert(events.includes("tool_call_start"), "Stream emits 'tool_call_start' event");
  assert(events.includes("tool_call_result"), "Stream emits 'tool_call_result' event");
  assert(events.includes("thinking"), "Stream emits 'thinking' event");
  assert(events[events.length - 1] === "complete" || events.includes("complete"), "Stream emits 'complete' event");

  // -----------------------------------------------
  section("Scenario 8: Stream input validation");
  // -----------------------------------------------

  const streamErrorEvents = [];
  for await (const event of streamLoop.executeStream(null)) {
    streamErrorEvents.push(event);
  }
  assert(streamErrorEvents.length > 0, "Stream with null input emits error event");
  assert(
    streamErrorEvents.some((e) => e.code === "AGENTIC_INPUT_INVALID"),
    "Stream error has AGENTIC_INPUT_INVALID code"
  );
}

// ============================================================
// Cleanup
// ============================================================

function cleanup() {
  try {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
      console.log(`\n[e2e] Cleaned up: ${testDir}`);
    }
  } catch (e) {
    console.log(`\n[e2e] Cleanup warning: ${e.message}`);
  }
}

// ============================================================
// Main
// ============================================================

console.log("═".repeat(60));
console.log("  Agentic Coding Loop — E2E Scenario Test");
console.log("═".repeat(60));

try {
  await runTests();
} catch (err) {
  console.error(`\n[FATAL] Unhandled error: ${err.message}`);
  console.error(err.stack);
  failed++;
} finally {
  cleanup();
}

console.log("\n" + "═".repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));

if (errors.length > 0) {
  console.log("\nFailed tests:");
  for (const e of errors) {
    console.log(`  - ${e}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
