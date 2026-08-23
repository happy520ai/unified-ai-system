import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_COMPACTION_POLICY,
  compactMessageHistory,
  compactStructuredContext,
  defineCompactionPolicy,
  estimateContextTokens,
  extractConversationTurns,
  summarizeConversationTurns,
} from "./unifiedContextCompactor.ts";

function buildAgenticHistory(iterations) {
  const messages = [
    { role: "system", content: "You are a coding agent." },
    { role: "user", content: "Fix the flaky test." },
  ];
  for (let index = 0; index < iterations; index += 1) {
    messages.push({ role: "assistant", content: `Iteration ${index} plan`, tool_calls: [] });
    messages.push({ role: "tool", content: JSON.stringify({ ok: true }), _meta: { toolName: "read_file" } });
    messages.push({ role: "assistant", content: `Iteration ${index} done` });
  }
  return messages;
}

test("iteration style preserves parity with the agentic-loop contract", () => {
  const messages = buildAgenticHistory(8);
  const policy = defineCompactionPolicy({
    summaryStyle: "iteration",
    keepRecentTurns: 3,
    preserveLeadingUserMessages: 2,
  });
  const { messages: result, report } = compactMessageHistory(messages, policy);

  assert.equal(report.compacted, true);
  assert.ok(result.length < messages.length);
  assert.equal(result[0].role, "system");
  assert.equal(result[0].content, "You are a coding agent.");
  assert.equal(result[1].role, "user");
  const summary = result.find(
    (message) => typeof message.content === "string" && message.content.startsWith("[Context compacted:"),
  );
  assert.ok(summary, "iteration summary message present");
  assert.match(summary.content, /earlier iterations summarized\./);
  assert.match(summary.content, /tool results processed\./);
  assert.match(summary.content, /last 3 iterations\.\]/);
  // Recent span stays verbatim.
  assert.ok(result.some((message) => message.content === "Iteration 7 done"));
  assert.ok(!result.some((message) => message.content === "Iteration 1 plan"));
});

test("iteration style returns the same reference when under the turn threshold", () => {
  const messages = buildAgenticHistory(2);
  const { messages: result, report } = compactMessageHistory(messages, defineCompactionPolicy({
    summaryStyle: "iteration",
    keepRecentTurns: 5,
    preserveLeadingUserMessages: 2,
  }));
  assert.equal(result, messages);
  assert.equal(report.compacted, false);
});

test("iteration style collects tool error findings into the summary", () => {
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "go" },
    { role: "assistant", content: "try", tool_calls: [] },
    { role: "tool", content: JSON.stringify({ status: "error", error: "ENOENT" }), _meta: { toolName: "read_file" } },
    { role: "assistant", content: "retry", tool_calls: [] },
    { role: "tool", content: JSON.stringify({ ok: true }) },
    { role: "assistant", content: "done" },
    { role: "assistant", content: "done2" },
    { role: "assistant", content: "done3" },
  ];
  const { messages: result } = compactMessageHistory(messages, defineCompactionPolicy({
    summaryStyle: "iteration",
    keepRecentTurns: 2,
    preserveLeadingUserMessages: 2,
  }));
  const summary = result.find(
    (message) => typeof message.content === "string" && message.content.startsWith("[Context compacted:"),
  );
  assert.match(summary.content, /Key issues found: Error in read_file: ENOENT/);
});

test("turns style matches the contextManager manageHistory contract", () => {
  const messages = [{ role: "system", content: "sys" }];
  for (let index = 0; index < 8; index += 1) {
    messages.push({ role: "user", content: `Question ${index} ${"x".repeat(80)}` });
    messages.push({ role: "assistant", content: `Answer ${index} ${"y".repeat(80)}` });
  }
  const policy = defineCompactionPolicy({
    summaryStyle: "turns",
    keepRecentTurns: 2,
    maxContextTokens: 100,
    tokenTriggerRatio: 0.7,
    turnSummaryPrefix: "[Previous conversation summary]",
  });
  const { messages: result, report } = compactMessageHistory(messages, policy);

  assert.equal(report.compacted, true);
  assert.ok(result.length < messages.length);
  assert.equal(result[0].content, "sys");
  assert.equal(result[1].role, "system");
  assert.match(result[1].content, /^\[Previous conversation summary\]/);
  assert.match(result[1].content, /Turn 1: User asked "Question 0/);
  assert.ok(result.some((message) => message.content?.startsWith("Question 7")));
  assert.ok(!result.some((message) => message.content?.startsWith("Question 1")));
});

test("turns style leaves short histories untouched even over budget logic", () => {
  const messages = [
    { role: "system", content: "sys" },
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ];
  const { messages: result, report } = compactMessageHistory(messages, defineCompactionPolicy({
    summaryStyle: "turns",
    keepRecentTurns: 5,
    maxContextTokens: 100,
  }));
  assert.equal(result, messages);
  assert.equal(report.compacted, false);
});

test("token trigger respects the ratio and can be disabled with null", () => {
  const messages = [];
  for (let index = 0; index < 10; index += 1) {
    messages.push({ role: "user", content: `Q ${index}` });
    messages.push({ role: "assistant", content: `A ${index}` });
  }
  const underBudget = compactMessageHistory(messages, defineCompactionPolicy({
    summaryStyle: "turns",
    keepRecentTurns: 2,
    maxContextTokens: 1_000_000,
  }));
  assert.equal(underBudget.report.compacted, false);

  const noTokenTrigger = compactMessageHistory(messages, defineCompactionPolicy({
    summaryStyle: "turns",
    keepRecentTurns: 2,
    maxContextTokens: null,
  }));
  assert.equal(noTokenTrigger.report.compacted, true);
});

test("token estimator and turn utilities behave deterministically", () => {
  assert.equal(estimateContextTokens(""), 0);
  assert.ok(estimateContextTokens("你好世界") > 0);
  assert.ok(estimateContextTokens("hello world") > 0);

  const turns = extractConversationTurns([
    { role: "system", content: "sys" },
    { role: "user", content: "q1" },
    { role: "assistant", content: "a1" },
    { role: "user", content: "q2" },
    { role: "assistant", content: "a2", tool_calls: [{ id: "c1" }] },
    { role: "tool", content: "r1" },
  ]);
  assert.equal(turns.length, 2);
  assert.equal(turns[1].hasToolCalls, true);

  const summary = summarizeConversationTurns(turns);
  assert.match(summary, /Turn 1: User asked "q1"/);
  assert.match(summary, /1 tool\(s\) were called/);
});

test("structured context compression keeps its contract", () => {
  const result = compactStructuredContext({
    projectState: {
      packageName: "demo",
      files: [{ path: "README.md", firstHeadings: ["Intro"] }, { path: "AGENTS.md", firstHeadings: ["Rules"] }],
      phaseDocs: [{}, {}],
    },
    phaseEvidence: {
      latestRefs: [
        { phaseId: "p1", path: "a.md", completed: true },
        { phaseId: "p2", path: "b.md", completed: false, blocker: true },
      ],
      indexedCount: 2,
    },
    gitDiff: { changedFileCount: 3 },
  });
  assert.equal(result.completed, true);
  assert.equal(result.compressionMode, "phase-history-boundary-blocker-next-action");
  assert.equal(result.summary.packageName, "demo");
  assert.equal(result.summary.dirtyFileCount, 3);
  assert.equal(result.latestEvidence.length, 2);
  assert.ok(result.retainedSignals.includes("next verification action"));
  assert.ok(result.droppedSignals.includes("full historical logs"));
});

test("default policy is frozen-safe for direct use", () => {
  assert.equal(DEFAULT_COMPACTION_POLICY.summaryStyle, "iteration");
  assert.equal(DEFAULT_COMPACTION_POLICY.keepRecentTurns, 5);
  assert.equal(DEFAULT_COMPACTION_POLICY.maxContextTokens, null);
});
