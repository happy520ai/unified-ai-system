import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTokenBudgetReport,
  estimateTokens,
  selectTokenBudgetPolicy,
  TOKEN_BUDGET_POLICIES,
} from "./tokenBudgetPolicy.js";

describe("tokenBudgetPolicy — token estimation", () => {
  it("estimates ~4 chars per token", () => {
    assert.equal(estimateTokens("hello world"), 3); // 11 chars → ceil(11/4)
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("abcdefgh"), 2); // 8 chars
  });

  it("serializes non-string values", () => {
    assert.equal(estimateTokens({ a: 1 }), 2); // '{"a":1}' = 7 chars → ceil(7/4)
  });
});

describe("tokenBudgetPolicy — policy selection", () => {
  it("selects the requested policy", () => {
    assert.equal(selectTokenBudgetPolicy("8k").maxTokens, 8000);
    assert.equal(selectTokenBudgetPolicy("32k").maxTokens, 32000);
  });

  it("falls back to 16k for unknown names", () => {
    assert.equal(selectTokenBudgetPolicy("999k").maxTokens, 16000);
    assert.equal(selectTokenBudgetPolicy().maxTokens, 16000);
  });

  it("exposes all policies", () => {
    assert.deepEqual(Object.keys(TOKEN_BUDGET_POLICIES).sort(), ["16k", "32k", "8k"]);
  });
});

describe("tokenBudgetPolicy — budget report", () => {
  it("builds a report where budgeted tokens never exceed allocation", () => {
    const report = buildTokenBudgetReport(
      { task: "a somewhat long task description to budget", relevantFiles: "file1.js file2.js file3.js" },
      "8k",
    );
    assert.equal(report.completed, true);
    assert.equal(report.budget.respected, true);
    assert.ok(report.budget.estimatedTokens > 0);
    assert.ok(report.tokenSavingEstimate.savedTokens >= 0);
    for (const entry of report.budget.sectionEntries) {
      assert.ok(entry.budgetedTokens <= entry.allocation);
    }
  });

  it("marks overflow action when a section exceeds allocation", () => {
    const report = buildTokenBudgetReport({ task: "x".repeat(10000) }, "8k");
    const taskEntry = report.budget.sectionEntries.find((e) => e.name === "task");
    assert.equal(taskEntry.overflowAction, "truncate");
  });
});
