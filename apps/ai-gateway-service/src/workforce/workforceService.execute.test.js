import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkforceService } from "./workforceService.js";

describe("workforceService.execute — real execution path", () => {
  it("rejects a missing goal", async () => {
    const service = createWorkforceService();
    await expect(service.execute({})).rejects.toThrow(/goal/i);
  });

  it("falls back to deterministic template output without a provider", async () => {
    const service = createWorkforceService();
    const result = await service.execute({ goal: "Build a login page" });

    expect(result.status).toBe("completed");
    expect(result.roleOutputs).toBeDefined();
    expect(Object.keys(result.roleOutputs).length).toBe(7);
    expect(result.llmDriven).toBe(false);
    expect(result.llmStats.totalCalls).toBe(7);
    expect(result.llmStats.successfulCalls).toBe(0);
    expect(result.llmStats.fallbackCalls).toBe(7);
    for (const role of Object.values(result.roleOutputs)) {
      expect(role.llmDriven).toBe(false);
      expect(role.llmFallback).toBe("no_provider");
    }
  });

  it("uses the LLM path when a provider adapter is supplied", async () => {
    const service = createWorkforceService();
    const mockAdapter = {
      async generate() {
        return { text: JSON.stringify({ roleMeta: { goal: "ok" }, summary: "llm summary" }) };
      },
    };
    const result = await service.execute(
      { goal: "Build a login page" },
      { providerAdapter: mockAdapter },
    );
    expect(result.llmDriven).toBe(true);
    expect(result.llmStats.successfulCalls).toBe(7);
    expect(result.llmStats.fallbackCalls).toBe(0);
  });

  it("fails open to template output when the provider throws", async () => {
    const service = createWorkforceService();
    const failingAdapter = {
      async generate() {
        throw new Error("provider down");
      },
    };
    const result = await service.execute(
      { goal: "Build a login page" },
      { providerAdapter: failingAdapter },
    );
    expect(result.status).toBe("completed");
    expect(result.llmDriven).toBe(false);
    for (const role of Object.values(result.roleOutputs)) {
      expect(role.llmDriven).toBe(false);
      expect(role.llmFallback).toMatch(/^llm_error:/);
    }
  });
});

describe("workforceService.runLocal — real local orchestration", () => {
  it("completes a real local run without provider, secret or deploy activity", async () => {
    // Isolate the plan store so this test never races with the shared default
    // store file used by other workforce tests (local-json-file persistence).
    const storePath = join(mkdtempSync(join(tmpdir(), "workforce-run-")), "workforce-plans.json");
    const service = createWorkforceService({ env: { WORKFORCE_PLAN_STORE_PATH: storePath } });
    const result = await service.runLocal({ goal: "Build a login page" }, { tenantId: "workforce-run-local" });

    expect(result.executionStatus).toBe("completed");
    expect(result.completionVerified).toBe(true);
    expect(result.localRunExecuted).toBe(true);
    expect(result.taskQueueCreated).toBe(true);
    expect(result.taskSummary.total).toBeGreaterThan(0);

    // safety boundary: a local run must not touch the outside world
    expect(result.providerCallsMade).toBe(false);
    expect(result.paidApiCalled).toBe(false);
    expect(result.secretValueExposed).toBe(false);
    expect(result.rawSecretRead).toBe(false);
    expect(result.projectFileWrites).toBe(false);
    expect(result.deployExecuted).toBe(false);
    expect(result.releaseExecuted).toBe(false);
    expect(result.commitCreated).toBe(false);
    expect(result.pushExecuted).toBe(false);
  });
});
