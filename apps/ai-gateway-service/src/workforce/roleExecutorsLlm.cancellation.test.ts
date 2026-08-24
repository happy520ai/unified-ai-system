import { describe, expect, it, vi } from "vitest";

import { executeRoleWithLLM } from "./roleExecutorsLlm.js";

describe("Workforce LLM role cancellation", () => {
  it("passes the DAG signal into the provider and never converts abort into fallback success", async () => {
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const provider = {
      generate: vi.fn(async (request) => {
        observedSignal = request.execution?.signal;
        return new Promise((_resolve, reject) => {
          observedSignal?.addEventListener("abort", () => reject(observedSignal?.reason), { once: true });
        });
      }),
    };
    const cancellation = Object.assign(new Error("remote cancellation"), {
      code: "WORKFORCE_EXECUTION_CANCELLED",
    });
    const pending = executeRoleWithLLM(
      "backend-engineer",
      "Build a safe API",
      { signal: controller.signal },
      provider,
    );
    await vi.waitFor(() => expect(provider.generate).toHaveBeenCalledTimes(1));
    controller.abort(cancellation);

    await expect(pending).rejects.toBe(cancellation);
    expect(observedSignal).toBe(controller.signal);
  });

  it("retains deterministic fallback for an ordinary provider error", async () => {
    const result = await executeRoleWithLLM(
      "backend-engineer",
      "Build a safe API",
      {},
      { generate: vi.fn(async () => { throw new Error("provider unavailable"); }) },
    );
    expect(result).toMatchObject({
      llmDriven: false,
      llmFallback: "llm_error: provider unavailable",
    });
  });
});
