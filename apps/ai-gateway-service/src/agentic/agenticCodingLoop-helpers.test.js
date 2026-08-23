import { describe, expect, it } from "vitest";
import {
  adjustIterationBudget,
  buildInitialMessages,
  buildProviderRequest,
  buildReflectionPrompt,
  buildResult,
  compactMessages,
  createErrorResult,
  getOpenAITools,
} from "./agenticCodingLoop-helpers.js";
import {
  buildRagSourceSelectionBenchmark,
  renderRagSourceSelectionBenchmarkMarkdown,
} from "../rag/sourceSelectionBenchmark.js";

describe("agenticCodingLoop helpers", () => {
  it("builds a reflection system message with tool names and plan progress", () => {
    const message = buildReflectionPrompt(2, [
      { _meta: { isError: false, toolName: "file_read" } },
      { _meta: { isError: true, toolName: "file_edit" } },
    ], [
      { status: "completed" },
      { status: "pending" },
    ]);
    expect(message.role).toBe("system");
    expect(message.content).toContain("Self-Reflection — Iteration 2");
    expect(message.content).toContain("file_read, file_edit");
    expect(message.content).toContain("1 succeeded, 1 failed");
    expect(message.content).toContain("Plan progress: 1/2 steps completed");
  });

  it("adjusts the iteration budget honestly on streaks and failures", () => {
    const ok = { _meta: { isError: false } };
    const bad = { _meta: { isError: true } };
    // 三连成功:加预算但受 1.5×max 上限约束。
    expect(adjustIterationBudget(5, [ok, ok, ok], 5, 10)).toBe(7);
    expect(adjustIterationBudget(14, [ok, ok, ok], 14, 10)).toBe(15);
    // 两连失败:砍预算但保底 iteration+2(不允许低于已完成轮次)。
    expect(adjustIterationBudget(6, [bad, bad], 2, 10)).toBe(4);
    expect(adjustIterationBudget(3, [bad, bad], 2, 10)).toBe(4);
    // 无结果不动。
    expect(adjustIterationBudget(5, [], 1, 10)).toBe(5);
  });

  it("compacts message history while pinning leading system/user turns", () => {
    const messages = [
      { role: "system", content: "You are an agent." },
      { role: "user", content: "Goal: fix the bug" },
      ...Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 === 0 ? "assistant" : "user",
        content: `turn-${index} ${"x".repeat(200)}`,
      })),
    ];
    const compacted = compactMessages(messages, 3);
    expect(compacted.length).toBeLessThan(messages.length);
    expect(compacted[0].role).toBe("system");
    expect(compacted.some((message) => message.role === "user" && message.content.includes("Goal:"))).toBe(true);
    // 近期轮次保留原文。
    expect(compacted.at(-1).content).toContain("turn-11");
  });

  it("shapes provider requests and OpenAI tool descriptors", () => {
    const request = buildProviderRequest({
      messages: [{ role: "user", content: "hi" }],
      tools: [{ name: "file_read" }],
      providerId: "p",
      modelId: "m",
      maxTokensPerTurn: 512,
    });
    expect(request.request.messages).toHaveLength(1);
    expect(request.request.options.maxOutputTokens).toBe(512);
    expect(request.target).toEqual({ providerId: "p", modelId: "m" });

    const registry = {
      listTools: (filter) => (filter?.allowlist
        ? [{ name: "file_read", description: "Read a file", inputSchema: { type: "object" } }]
        : []),
    };
    const tools = getOpenAITools(registry, ["file_read"]);
    expect(tools).toHaveLength(1);
    expect(tools[0].function).toMatchObject({ name: "file_read", description: "Read a file" });
    expect(tools[0].function.parameters.type).toBe("object");

    const initial = buildInitialMessages("sys", "goal", []);
    expect(initial[0]).toEqual({ role: "system", content: "sys" });
    expect(initial.at(-1).content).toBe("goal");
  });

  it("builds structured results and error results", () => {
    const result = buildResult({
      sessionId: "s1",
      goal: "g",
      status: "completed",
      finalAnswer: "done",
      iterations: 2,
      messages: [],
      trace: [],
      allToolResults: [],
      totalUsage: { inputTokens: 1, outputTokens: 1 },
      startedAt: Date.now() - 10,
      plan: [{ status: "completed" }],
    });
    expect(result.sessionId).toBe("s1");
    expect(result.status).toBe("completed");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.toolUsage).toBeTruthy();

    const error = createErrorResult("E_X", "boom");
    expect(error.status).toBe("error");
    expect(error.error.code).toBe("E_X");
    expect(error.usage.totalTokens).toBe(0);
  });
});

describe("rag source selection benchmark", () => {
  it("produces honest evidence (no cache claim, no external calls) and renders markdown", () => {
    const evidence = buildRagSourceSelectionBenchmark({});
    expect(evidence.paidApiCallCount).toBe(0);
    expect(evidence.externalApiCalled).toBe(false);
    expect(evidence.caseCount).toBeGreaterThan(0);
    // 差距清单里诚实声明“尚无持久化响应缓存”。
    expect(evidence.gaps.join("\n")).toContain("No persisted response cache");
    const markdown = renderRagSourceSelectionBenchmarkMarkdown(evidence);
    expect(typeof markdown).toBe("string");
    expect(markdown.length).toBeGreaterThan(0);
  });
});
