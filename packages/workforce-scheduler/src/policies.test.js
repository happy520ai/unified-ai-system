import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertDryRunBudget, dryRunBudgetPolicy } from "./budgetPolicy.js";
import { applyFanoutPolicy, dryRunFanoutPolicy } from "./fanoutPolicy.js";
import { canScheduleEmployee, dryRunLoadPolicy } from "./loadPolicy.js";
import { timeoutSummary } from "./timeoutPolicy.js";

describe("workforce-scheduler — budget policy", () => {
  it("asserts the dry-run budget blocks provider calls", () => {
    assert.equal(assertDryRunBudget(), true);
    assert.equal(assertDryRunBudget({ ...dryRunBudgetPolicy, maxBrainCalls: 1 }), false);
  });
});

describe("workforce-scheduler — fanout policy", () => {
  it("splits candidates into active and rejected pools", () => {
    const candidates = [1, 2, 3, 4, 5].map((n) => ({ employeeId: `e${n}`, title: `T${n}` }));
    const result = applyFanoutPolicy(candidates, dryRunFanoutPolicy);

    assert.ok(result.activeEmployees.length > 0);
    assert.ok(result.activeEmployees.length <= result.candidateEmployees.length);
    // active employees are the head of the candidate list
    assert.deepEqual(
      result.activeEmployees.map((e) => e.employeeId),
      result.candidateEmployees.slice(0, result.activeEmployees.length).map((e) => e.employeeId),
    );
    // rejected employees carry a reason
    for (const rejected of result.rejectedEmployees) {
      assert.ok(rejected.reason);
    }
  });
});

describe("workforce-scheduler — load policy", () => {
  it("schedules only preview-ready employees within concurrency", () => {
    assert.equal(canScheduleEmployee({ status: "preview_ready", maxConcurrency: 1 }), true);
    assert.equal(canScheduleEmployee({ status: "busy", maxConcurrency: 1 }), false);
    assert.equal(canScheduleEmployee({ status: "preview_ready", maxConcurrency: 5 }), false);
  });
});

describe("workforce-scheduler — timeout policy", () => {
  it("summarizes the timeout policy", () => {
    const summary = timeoutSummary();
    assert.equal(summary.timeoutMsPerEmployee, 8000);
    assert.equal(summary.globalTimeoutMs, 30000);
  });
});
