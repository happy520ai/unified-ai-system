import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { callLLMWithUsage } from "@unified-ai-system/forge-core";
import {
  createForgeGatewayService,
  createForgeGovernedExecution,
} from "./forgeGatewayService.js";
import { dispatchForgeRoutes } from "../http/forgeRoutes.js";

function createFakeGatewayService() {
  return {
    execute: vi.fn(async (input) => ({
      success: true,
      data: {
        message: { role: "assistant", content: `[polished] ${String(input.messages?.at(-1)?.content ?? "").slice(0, 80)}` },
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      },
      meta: { requestId: "forge-1" },
    })),
  };
}

function createService() {
  return createForgeGatewayService({ gatewayService: createFakeGatewayService(), env: {} });
}

it("preserves explicit Forge model selection through every polish request", async () => {
  const gateway = createFakeGatewayService();
  const service = createForgeGatewayService({ gatewayService: gateway, env: {} });
  await service.polish({ content: "Improve this draft", task: { prompt: "Keep the public behavior" }, passes: 1, maxOutputTokens: 1024,
    modelSelection: { providerId: "local-fake-provider", modelId: "local-fake-model" } });
  expect(gateway.execute).toHaveBeenCalledTimes(1);
  for (const [request] of gateway.execute.mock.calls) {
    expect(request).toMatchObject({ providerId: "local-fake-provider", model: "local-fake-model", options: { maxOutputTokens: 1024 } });
    expect(request.messages.at(-1).content).toContain("Improve this draft");
    expect(request.messages.at(-1).content).toContain("Keep the public behavior");
  }
});

it("rejects invalid explicit Forge model selection and prior cancellation before calling a provider", async () => {
  const gateway = createFakeGatewayService();
  const service = createForgeGatewayService({ gatewayService: gateway, env: {} });
  await expect(service.polish({ content: "draft", modelSelection: { providerId: "fake" } })).rejects.toMatchObject({ code: "FORGE_MODEL_SELECTION_INVALID" });
  const controller = new AbortController(); controller.abort(new Error("cancel-fixture"));
  await expect(service.polish({ content: "draft", signal: controller.signal })).rejects.toThrow("cancel-fixture");
  expect(gateway.execute).not.toHaveBeenCalled();
});

it("never turns a failed Forge model call into a successful scaffold or another request", async () => {
  const gateway = { execute: vi.fn(async () => ({ success: false, error: { code: "COST_GUARD_BLOCKED" } })) };
  const service = createForgeGatewayService({ gatewayService: gateway, env: {} });
  await expect(service.polish({ content: "draft", passes: 3 })).rejects.toMatchObject({ code: "FORGE_LLM_LANE_FAILED" });
  expect(gateway.execute).toHaveBeenCalledTimes(1);
});

describe("forgeGatewayService — 桥与惰性", () => {
  it("routes forge LLM calls through the gateway provider lane", async () => {
    const gatewayService = createFakeGatewayService();
    const forge = createForgeGatewayService({ gatewayService, env: {} });
    const result = await forge.polish({ content: "draft api design", task: { type: "design" } });
    // 至少一次 LLM 调用经过了网关 lane(fake provider)。
    expect(gatewayService.execute).toHaveBeenCalled();
    expect(String(gatewayService.execute.mock.calls[0][0].metadata.source)).toBe("forge-lane");
    expect(result.ok).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("constructs engines lazily and reports honest status", () => {
    const forge = createService();
    const statusBefore = forge.getStatus();
    expect(statusBefore.enabled).toBe(true);
    expect(statusBefore.lazyLoaded.memoryEngine).toBe(false);
    forge.memoryRemember({ content: "remember me" });
    expect(forge.getStatus().lazyLoaded.memoryEngine).toBe(true);
  });

  it("validates polish/quality/memory inputs honestly", async () => {
    const forge = createService();
    expect((await forge.polish({ content: "" })).code).toBe("FORGE_INPUT_INVALID");
    expect((await forge.quality({ code: "" })).code).toBe("FORGE_INPUT_INVALID");
    expect(forge.memoryRemember({ content: " " }).code).toBe("FORGE_INPUT_INVALID");
    expect(forge.memoryRecall({ query: "" }).code).toBe("FORGE_INPUT_INVALID");
  });

  it("quality gate evaluates code and returns a structured verdict", async () => {
    const forge = createService();
    const result = await forge.quality({ code: "export function add(a,b){return a+b}", task: { type: "util" } });
    expect(result.ok).toBe(true);
    expect(result.evaluation).toBeTruthy();
  });

  it("memory remember → recall round-trips through working and semantic layers", () => {
    const forge = createService();
    forge.memoryRemember({ content: "网关默认运行在 fake provider 模式", metadata: { topic: "gateway" } });
    forge.memoryRemember({ content: "虚拟 key 按日预算限流", metadata: { topic: "keys" } });
    const recall = forge.memoryRecall({ query: "fake provider 模式" });
    expect(recall.ok).toBe(true);
    const allText = JSON.stringify(recall);
    expect(allText.length).toBeGreaterThan(10);
    const stats = forge.memoryStats();
    expect(stats.ok).toBe(true);
  });

  it("isolates working and semantic memory by authenticated tenant", () => {
    const forge = createService();
    const tenantA = { tenantId: "tenant-a" };
    const tenantB = { tenantId: "tenant-b" };
    forge.memoryRemember({
      content: "tenant-a-confidential-marker",
      tenantIdentity: tenantA,
    });

    const tenantAResult = forge.memoryRecall({ query: "confidential marker", tenantIdentity: tenantA });
    const tenantBResult = forge.memoryRecall({ query: "confidential marker", tenantIdentity: tenantB });
    expect(JSON.stringify(tenantAResult)).toContain("tenant-a-confidential-marker");
    expect(JSON.stringify(tenantBResult)).not.toContain("tenant-a-confidential-marker");
    expect(forge.memoryStats({ tenantIdentity: tenantA }).working.operations.remembers).toBe(1);
    expect(forge.memoryStats({ tenantIdentity: tenantB }).working.operations.remembers).toBe(0);
  });

  it("applies one per-tenant entry/byte LRU to working and semantic memory", () => {
    const forge = createForgeGatewayService({
      env: {
        AI_GATEWAY_FORGE_MEMORY_MAX_ENTRIES_PER_TENANT: "3",
        AI_GATEWAY_FORGE_MEMORY_MAX_BYTES_PER_TENANT: "1024",
      },
    });
    const tenantIdentity = { tenantId: "tenant-memory-cap" };
    const ids = [];
    for (let index = 0; index < 5; index += 1) {
      const result = forge.memoryRemember({
        content: `bounded-memory-${index}`,
        metadata: { index },
        tenantIdentity,
      });
      expect(result.ok).toBe(true);
      expect(typeof result.id).toBe("string");
      ids.push(result.id);
    }
    const stats = forge.memoryStats({ tenantIdentity });
    expect(stats.capacity).toMatchObject({ entries: 3, maxEntries: 3, maxBytes: 1024 });
    expect(stats.capacity.bytes).toBeLessThanOrEqual(1024);
    expect(stats.semantic.documents).toBe(3);
    expect(JSON.stringify(forge.memoryRecall({ query: "bounded-memory-0", limit: 10, tenantIdentity })))
      .not.toContain(ids[0]);

    expect(forge.memoryRemember({
      content: "x".repeat(2_000),
      tenantIdentity,
    })).toMatchObject({ ok: false, code: "FORGE_MEMORY_CAPACITY_EXCEEDED" });
    expect(forge.memoryStats({ tenantIdentity }).semantic.documents).toBe(3);
  });

  it("can be disabled via FORGE_LANE_ENABLED=false", async () => {
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      env: { FORGE_LANE_ENABLED: "false" },
    });
    expect(forge.enabled()).toBe(false);
    expect((await forge.polish({ content: "x" })).code).toBe("FORGE_LANE_DISABLED");
  });

  it("orchestrate validates the goal and records runs", async () => {
    const forge = createService();
    const invalid = await forge.orchestrate({ goal: "" });
    expect(invalid.code).toBe("FORGE_INPUT_INVALID");
    const runs = forge.listRuns();
    expect(runs.ok).toBe(true);
    expect(Array.isArray(runs.runs)).toBe(true);
  });

  it("cleans its ephemeral workspace and does not expose a dead path", async () => {
    let projectRoot;
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      env: {},
      forgeFactory: (options) => {
        projectRoot = options.projectRoot;
        return { run: vi.fn(async () => ({ ok: true, summary: "done" })), close: vi.fn() };
      },
    });
    const result = await forge.orchestrate({ goal: "ephemeral workspace cleanup" });
    expect(result).toMatchObject({ ok: true, workspace: { configured: false } });
    expect(result).not.toHaveProperty("workRoot");
    expect(typeof projectRoot).toBe("string");
    expect(existsSync(projectRoot)).toBe(false);
  });

  it("uses only the server-configured trusted workspace and serializes its runs", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-trusted-workspace-"));
    try {
      let capturedRoot;
      let capturedDbPath;
      let releaseRun;
      const firstRun = new Promise((resolve) => { releaseRun = resolve; });
      const forge = createForgeGatewayService({
        gatewayService: createFakeGatewayService(),
        env: { AI_GATEWAY_FORGE_WORKING_DIRECTORY: root },
        forgeFactory: (options) => {
          capturedRoot = options.projectRoot;
          capturedDbPath = options.dbPath;
          return { run: vi.fn(async () => firstRun), close: vi.fn() };
        },
      });
      const first = forge.orchestrate({ goal: "trusted workspace run" });
      await new Promise((resolve) => setImmediate(resolve));
      await expect(forge.orchestrate({ goal: "overlapping run" })).resolves.toMatchObject({
        ok: false,
        code: "FORGE_WORKSPACE_BUSY",
      });
      releaseRun({ ok: true });
      await expect(first).resolves.toMatchObject({ ok: true, workspace: { configured: true } });
      expect(capturedRoot).toBe(realpathSync.native(root));
      expect(capturedDbPath.startsWith(realpathSync.native(root))).toBe(false);
      expect(existsSync(capturedDbPath)).toBe(false);
      expect(existsSync(join(root, "forge-tasks.sqlite"))).toBe(false);
      expect(existsSync(root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bounds retained run history and stores only a small result summary", async () => {
    let now = Date.UTC(2026, 7, 30);
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      env: { AI_GATEWAY_FORGE_RUN_HISTORY_MAX: "2" },
      clock: () => now++,
      forgeFactory: () => ({
        run: vi.fn(async () => ({ ok: true, summary: "done", huge: "x".repeat(100_000) })),
        close: vi.fn(),
      }),
    });
    for (const goal of ["one", "two", "three"]) {
      await expect(forge.orchestrate({ goal })).resolves.toMatchObject({ ok: true });
    }
    const history = forge.listRuns({ limit: 100 });
    expect(history.total).toBe(2);
    expect(history.runs).toHaveLength(2);
    expect(JSON.stringify(history)).not.toContain("x".repeat(1_000));
  });

  it("records close or temp cleanup failures in bounded run history and status", async () => {
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      env: { AI_GATEWAY_FORGE_RUN_HISTORY_MAX: "2" },
      forgeFactory: () => ({
        run: vi.fn(async () => ({ ok: true, summary: "done" })),
        close: vi.fn(() => { throw new Error("close token=must-not-leak"); }),
      }),
    });
    await expect(forge.orchestrate({ goal: "observable cleanup failure" })).resolves.toMatchObject({ ok: true });
    expect(forge.listRuns().runs.at(-1)?.cleanup).toMatchObject({
      ok: false,
      errors: [{ code: "FORGE_TASK_STORE_CLOSE_FAILED" }],
    });
    expect(JSON.stringify(forge.listRuns())).not.toContain("must-not-leak");
    expect(forge.getStatus().cleanup).toMatchObject({
      failureCount: 1,
      lastFailure: { codes: ["FORGE_TASK_STORE_CLOSE_FAILED"] },
    });
  });

  it("media cleanup failures cannot return completed or expose audio and retain the first run failure", async () => {
    for (const mode of ["close", "temp", "both-after-failure", "both-after-success"]) {
      const firstCode = "MEDIA_FIXTURE_FIRST_FAILURE";
      const media = { success: mode !== "both-after-failure", outcomeUnknown: false,
        usage: { providerCalls: 1 }, artifacts: [{ audioBase64: "PRIVATE-MEDIA-BYTES" }],
        ...(mode === "both-after-failure" ? { code: firstCode } : {}) };
      const close = vi.fn(async () => { if (mode !== "temp") throw Error("fixture close"); });
      const remove = vi.fn(async () => { if (mode !== "close") throw Error("fixture cleanup"); });
      const forge = createForgeGatewayService({ gatewayService: createFakeGatewayService(), env: {},
        temporaryDirectoryFactory: () => join(tmpdir(), "media-cleanup-virtual-fixture"),
        temporaryDirectoryRemover: remove,
        forgeFactory: () => ({ close, run: async () => {
          if (mode.startsWith("both-after")) throw Object.assign(Error("first run failure"), { code: firstCode });
          return { status: "completed", completedTasks: 1, failedTasks: 0, media };
        } }),
      });
      const result = await forge.orchestrate({ goal: "media cleanup fixture", governanceRequired: true,
        governedExecution: { beforeAction() {}, afterAction() {}, mediaTask: { getResult: () => structuredClone(media) } } });
      const cleanupCodes = mode === "close" ? ["FORGE_TASK_STORE_CLOSE_FAILED"] : mode === "temp"
        ? ["FORGE_TEMP_CLEANUP_FAILED"] : ["FORGE_TASK_STORE_CLOSE_FAILED", "FORGE_TEMP_CLEANUP_FAILED"];
      expect(result).toMatchObject({ ok: false, code: "FORGE_ACTION_OUTCOME_UNCERTAIN", providerCallAttempted: true,
        causeCode: mode.startsWith("both-after") ? firstCode : cleanupCodes[0], cleanupCodes });
      expect(JSON.stringify(result)).not.toContain("PRIVATE-MEDIA-BYTES");
      expect(result).not.toHaveProperty("result");
      expect(forge.listRuns().runs.at(-1)).toMatchObject({ status: "failed", cleanup: { ok: false },
        error: { code: "FORGE_ACTION_OUTCOME_UNCERTAIN" } });
      expect(close).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
    }
  });

  it("media completion waits for asynchronous close and preserves cancellation during cleanup", async () => {
    for (const abortDuringCleanup of [false, true]) {
    const controller = new AbortController();
    let finishClose;
    const closed = new Promise(resolve => { finishClose = resolve; });
    const close = vi.fn(() => closed), media = { success: true, outcomeUnknown: false, usage: { providerCalls: 1 }, artifacts: [] };
    const forge = createForgeGatewayService({ gatewayService: createFakeGatewayService(), env: {},
      temporaryDirectoryFactory: () => join(tmpdir(), "media-close-virtual-fixture"), temporaryDirectoryRemover: vi.fn(),
      forgeFactory: () => ({ close, run: async () => ({ status: "completed", completedTasks: 1, failedTasks: 0, media }) }) });
    let settled = false;
    const pending = forge.orchestrate({ goal: "media close fixture", governanceRequired: true, signal: controller.signal,
      governedExecution: { beforeAction() {}, afterAction() {}, mediaTask: { getResult: () => media } } }).then(result => { settled = true; return result; });
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce()); expect(settled).toBe(false);
    expect(forge.listRuns().runs.at(-1).status).toBe("running");
    if (abortDuringCleanup) controller.abort();
    finishClose(); await expect(pending).resolves.toMatchObject(abortDuringCleanup
      ? { ok: false, code: "FORGE_ACTION_OUTCOME_UNCERTAIN", cleanupCodes: ["FORGE_MEDIA_COMPLETION_ABORTED"] } : { ok: true });
    }
  });

  it("server-only media delivery failure is tenant-bound, media-only and preserves generation and the first failure", async () => {
    const media = { success: true, outcomeUnknown: false, usage: { providerCalls: 1 }, artifacts: [{ audioBase64: "PRIVATE-MEDIA-BYTES" }] };
    const service = createForgeGatewayService({ gatewayService: createFakeGatewayService(), env: {},
      temporaryDirectoryFactory: () => join(tmpdir(), "media-delivery-virtual-fixture"), temporaryDirectoryRemover() {},
      forgeFactory: () => ({ close() {}, run: async () => ({ status: "completed", completedTasks: 1, failedTasks: 0, media }) }) });
    const tenantIdentity = { tenantId: "tenant-a" };
    const generated = await service.orchestrate({ goal: "media delivery fixture", tenantIdentity, governanceRequired: true,
      governedExecution: { beforeAction() {}, afterAction() {}, mediaTask: { getResult: () => media } } });
    const legacy = await service.orchestrate({ goal: "legacy fixture", tenantIdentity });
    const failure = { runId: generated.runId, tenantIdentity, code: "FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
      causeCode: "FIRST_TERMINAL_FAILURE", cleanupCodes: ["FORGE_TOP_ACTION_LEASE_RELEASE_FAILED"] };
    const before = service.listRuns({ tenantIdentity });
    expect(service.recordMediaDeliveryFailure({ ...failure, tenantIdentity: { tenantId: "tenant-b" } })).toBe(false);
    expect(service.recordMediaDeliveryFailure({ ...failure, runId: legacy.runId })).toBe(false);
    expect(service.recordMediaDeliveryFailure({ ...failure, runId: "not-owned-by-service" })).toBe(false);
    expect(service.listRuns({ tenantIdentity })).toEqual(before);
    expect(service.recordMediaDeliveryFailure(failure)).toBe(true);
    expect(service.recordMediaDeliveryFailure({ ...failure, code: "LATER_FAILURE", causeCode: "LATER_CAUSE",
      cleanupCodes: ["FORGE_RUN_LEASE_RELEASE_FAILED"] })).toBe(true);
    const history = service.listRuns({ tenantIdentity }), run = history.runs.find(value => value.runId === generated.runId);
    expect(run).toMatchObject({ status: "failed", generation: { status: "completed", completedTasks: 1, failedTasks: 0 },
      mediaDelivery: { status: "unknown", retrySafe: false }, error: { code: failure.code, causeCode: "FIRST_TERMINAL_FAILURE",
        cleanupCodes: ["FORGE_TOP_ACTION_LEASE_RELEASE_FAILED", "FORGE_RUN_LEASE_RELEASE_FAILED"] } });
    expect(run).not.toHaveProperty("mediaRun"); expect(run.result).toBeUndefined();
    expect(history.runs.find(value => value.runId === legacy.runId).status).toBe("completed");
    expect(JSON.stringify(history)).not.toContain("PRIVATE-MEDIA-BYTES");
  });

  it("binds orchestrate LLM calls to the governed in-process gateway lane", async () => {
    const gatewayService = createFakeGatewayService();
    const close = vi.fn();
    const run = vi.fn(async () => callLLMWithUsage("system", "tenant task"));
    const forge = createForgeGatewayService({
      gatewayService,
      env: {},
      forgeFactory: () => ({ run, close }),
    });

    const result = await forge.orchestrate({
      goal: "prepare a governed plan",
      tenantIdentity: { tenantId: "tenant-a" },
    });

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(gatewayService.execute).toHaveBeenCalledOnce();
    expect(gatewayService.execute.mock.calls[0][0].metadata.forge.tenantId).toBe("tenant-a");
    expect(forge.listRuns({ tenantIdentity: { tenantId: "tenant-a" } }).runs).toHaveLength(1);
    expect(forge.listRuns({ tenantIdentity: { tenantId: "tenant-b" } }).runs).toHaveLength(0);
    expect(forge.getStatus({ tenantIdentity: { tenantId: "tenant-a" } })).toMatchObject({
      activeRuns: 0,
      retainedRuns: 1,
    });
    expect(forge.getStatus({ tenantIdentity: { tenantId: "tenant-b" } }).activeRuns).toBe(0);
  });

  it("fails closed before constructing Forge when governance is required without a hook", async () => {
    const forgeFactory = vi.fn(() => ({ run: vi.fn(), close: vi.fn() }));
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      governanceRequired: true,
      forgeFactory,
    });

    const result = await forge.orchestrate({ goal: "must be governed" });

    expect(result).toMatchObject({
      ok: false,
      code: "FORGE_ACTION_GOVERNANCE_REQUIRED",
      governance: { enforced: false, required: true },
    });
    expect(forgeFactory).not.toHaveBeenCalled();
  });

  it("accepts a server-built Tool Proxy adapter and keeps request JSON out of the hook", async () => {
    const enforce = vi.fn(async () => ({
      outcome: "allow",
      policy: { policyHash: "policy-a" },
      executionLease: { release: vi.fn() },
    }));
    const enforceResult = vi.fn(async ({ result }) => ({ verdict: "allow", result }));
    const assertActive = vi.fn(async () => true);
    const controller = new AbortController();
    const governedExecution = createForgeGovernedExecution({
      context: { agentId: "agt-a", tenantId: "tenant-a", requestId: "req-a" },
      toolProxy: { enforce, enforceResult },
      executionLease: { signal: controller.signal, assertActive },
    });

    const verdict = await governedExecution.beforeAction({
      toolName: "file_read",
      params: Object.freeze({ file_path: "README.md" }),
      resourceContext: Object.freeze({ resources: ["README.md"] }),
    });
    const post = await governedExecution.afterAction({
      toolName: "file_read",
      authorization: verdict,
      result: { modified: false, output: "ok" },
    });

    expect(enforce).toHaveBeenCalledWith({
      context: expect.objectContaining({ agentId: "agt-a", tenantId: "tenant-a" }),
      toolName: "file_read",
      params: { file_path: "README.md" },
      resourceContext: { resources: ["README.md"] },
    });
    expect(assertActive).toHaveBeenCalledWith("reserve");
    expect(enforceResult).toHaveBeenCalledOnce();
    expect(post.result.output).toBe("ok");
    expect(Object.isFrozen(governedExecution)).toBe(true);
  });

  it("marks a completed Forge write action uncertain when its terminal audit is replaced", async () => {
    const governedExecution = createForgeGovernedExecution({
      context: { agentId: "agt-a", tenantId: "tenant-a", requestId: "req-a" },
      toolProxy: {
        enforce: vi.fn(),
        enforceResult: vi.fn(async () => ({
          verdict: "replace",
          code: "GOVERNANCE_AUDIT_REQUIRED",
          result: { status: "denied", code: "GOVERNANCE_AUDIT_REQUIRED" },
        })),
      },
    });

    await expect(governedExecution.afterAction({
      actionType: "write",
      toolName: "file_write",
      authorization: { policy: { policyHash: "policy-a" } },
      result: { modified: true, path: "result.txt" },
    })).rejects.toMatchObject({
      code: "FORGE_ACTION_OUTCOME_UNCERTAIN",
    });
  });

  it("rejects an allow verdict without a verified policy and releasable action lease", async () => {
    const governedExecution = createForgeGovernedExecution({
      context: { agentId: "agt-a", tenantId: "tenant-a" },
      toolProxy: {
        enforce: vi.fn(async () => ({ outcome: "allow", policy: { policyHash: "policy-a" } })),
        enforceResult: vi.fn(),
      },
    });

    await expect(governedExecution.beforeAction({
      toolName: "file_write",
      params: { file_path: "blocked.txt", content: "blocked" },
      resourceContext: { resources: ["blocked.txt"] },
    })).rejects.toMatchObject({ code: "FORGE_ACTION_LEASE_REQUIRED" });
  });

  it("propagates revocation AbortSignal into Forge, drains the run, and closes it", async () => {
    const controller = new AbortController();
    const close = vi.fn();
    let observedSignal;
    const run = vi.fn(async (_goal, options) => {
      observedSignal = options.signal;
      return new Promise((_resolve, reject) => {
        const onAbort = () => {
          const error = new Error("revoked while running");
          error.name = "AbortError";
          reject(error);
        };
        if (options.signal.aborted) onAbort();
        else options.signal.addEventListener("abort", onAbort, { once: true });
      });
    });
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      governanceRequired: true,
      forgeFactory: () => ({ run, close }),
    });
    const governedExecution = Object.freeze({
      signal: controller.signal,
      async beforeAction() { return { outcome: "allow" }; },
      async afterAction() { return null; },
    });

    const pending = forge.orchestrate({
      goal: "abortable governed run",
      tenantIdentity: { tenantId: "tenant-a" },
      governedExecution,
    });
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    controller.abort(new Error("agent revoked"));
    const result = await pending;

    expect(observedSignal).toBe(controller.signal);
    expect(result).toMatchObject({ ok: false, code: "FORGE_RUN_ABORTED" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("deduplicates identical run signals instead of leaking abort listeners", async () => {
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, "addEventListener");
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    let observedSignal;
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      governanceRequired: true,
      forgeFactory: () => ({
        run: vi.fn(async (_goal, options) => {
          observedSignal = options.signal;
          return { status: "completed" };
        }),
        close: vi.fn(),
      }),
    });
    const governedExecution = Object.freeze({
      signal: controller.signal,
      async beforeAction() { return { outcome: "allow" }; },
      async afterAction() { return null; },
    });

    const result = await forge.orchestrate({
      goal: "reuse one cancellation signal",
      tenantIdentity: { tenantId: "tenant-a" },
      governedExecution,
      signal: controller.signal,
    });

    expect(result.ok).toBe(true);
    expect(observedSignal).toBe(controller.signal);
    expect(addListener).not.toHaveBeenCalled();
    expect(removeListener).not.toHaveBeenCalled();
  });
});

describe("forgeRoutes dispatcher", () => {
  function createContext({ method = "POST", path, body, application, gatewayService } = {}) {
    const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
    request.method = method;
    const response = new EventEmitter();
    response.statusCode = null;
    response.headers = {};
    response.body = null;
    response.writableEnded = false;
    response.destroyed = false;
    response.headersSent = false;
    response.writeHead = (statusCode, headers = {}) => {
      response.statusCode = statusCode;
      response.headers = headers;
      response.headersSent = true;
    };
    response.write = () => true;
    response.end = (payload) => {
      if (payload !== undefined) {
        try { response.body = JSON.parse(String(payload)); } catch { response.body = payload; }
      }
      response.writableEnded = true;
    };
    const app = application ?? { runtimeEnv: {}, gatewayService: createFakeGatewayService() };
    return { application: app, request, response, startedAt: Date.now(), url: new URL(`http://127.0.0.1:4010${path}`), writeServiceLog: vi.fn(), gatewayService: gatewayService ?? app.gatewayService };
  }

  it("serves status and handles polish end to end", async () => {
    const statusContext = createContext({ method: "GET", path: "/forge/status" });
    await dispatchForgeRoutes(statusContext);
    expect(statusContext.response.statusCode).toBe(200);
    expect(statusContext.response.body.data.enabled).toBe(true);

    const polishContext = createContext({ path: "/forge/polish", body: { content: "smooth this out" } });
    await dispatchForgeRoutes(polishContext);
    expect(polishContext.response.statusCode).toBe(200);
  });

  it("uses each request-bound gateway without retaining the first request context", async () => {
    const rawGateway = createFakeGatewayService();
    const requestGatewayA = createFakeGatewayService();
    const requestGatewayB = createFakeGatewayService();
    const application = { runtimeEnv: {}, gatewayService: rawGateway };

    await dispatchForgeRoutes(createContext({
      path: "/forge/polish",
      body: { content: "request a" },
      application,
      gatewayService: requestGatewayA,
    }));
    await dispatchForgeRoutes(createContext({
      path: "/forge/polish",
      body: { content: "request b" },
      application,
      gatewayService: requestGatewayB,
    }));

    expect(requestGatewayA.execute).toHaveBeenCalled();
    expect(requestGatewayB.execute).toHaveBeenCalled();
    expect(rawGateway.execute).not.toHaveBeenCalled();
    expect(requestGatewayA.execute.mock.calls.flat().some((input) => JSON.stringify(input).includes("request b"))).toBe(false);
  });

  it("rejects invalid memory actions and unknown forge paths honestly", async () => {
    const badAction = createContext({ path: "/forge/memory", body: { action: "delete" } });
    await dispatchForgeRoutes(badAction);
    expect(badAction.response.statusCode).toBe(400);

    const unknown = createContext({ method: "GET", path: "/forge/nope" });
    await dispatchForgeRoutes(unknown);
    expect(unknown.response.statusCode).toBe(404);

    const wrongMethod = createContext({ method: "GET", path: "/forge/polish" });
    await dispatchForgeRoutes(wrongMethod);
    expect(wrongMethod.response.statusCode).toBe(405);
  });

  it("fails governed orchestration before authorization when agent identity is missing", async () => {
    const orchestrate = vi.fn();
    const authorizeAgentExecution = vi.fn();
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce: vi.fn(), enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "govern me" },
      application,
    });
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(403);
    expect(c.response.body.error.code).toBe("FORGE_AGENT_GOVERNANCE_IDENTITY_REQUIRED");
    expect(authorizeAgentExecution).not.toHaveBeenCalled();
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it("rejects an invalid governed goal before Agent authorization or Forge construction", async () => {
    const orchestrate = vi.fn();
    const authorizeAgentExecution = vi.fn();
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce: vi.fn(), enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "   ", agentId: "agt_route" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(400);
    expect(c.response.body.error.code).toBe("FORGE_INPUT_INVALID");
    expect(authorizeAgentExecution).not.toHaveBeenCalled();
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it.each([
    ["cross-tenant", "AGENT_NOT_FOUND"],
    ["revoked", "AGENT_REVOKED"],
  ])("keeps Forge at zero effects for %s Agent authorization failures", async (_label, code) => {
    const orchestrate = vi.fn();
    const error = Object.assign(new Error(code), { code, statusCode: 403 });
    const authorizeAgentExecution = vi.fn(async () => { throw error; });
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce: vi.fn(), enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "govern me", agentId: "agt_route" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(403);
    expect(c.response.body.error.code).toBe(code);
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it("rejects a real child Agent record, releases its run lease, and keeps Forge at zero effects", async () => {
    const orchestrate = vi.fn();
    const runRelease = vi.fn();
    const authorizeAgentExecution = vi.fn(async () => ({
      record: { agentId: "agt_child", parentAgentId: "agt_root", generationDepth: 1, status: "ACTIVE" },
      policy: { policyHash: "policy-child" },
      executionLease: { signal: new AbortController().signal, release: runRelease },
    }));
    const enforce = vi.fn();
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce, enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "must stay at zero", agentId: "agt_child" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(403);
    expect(c.response.body.error.code).toBe("FORGE_ROOT_AGENT_REQUIRED");
    expect(enforce).not.toHaveBeenCalled();
    expect(orchestrate).not.toHaveBeenCalled();
    expect(runRelease).toHaveBeenCalledOnce();
  });

  it("holds the run fence but does not start Forge when forge_orchestrate is denied", async () => {
    const orchestrate = vi.fn();
    const runRelease = vi.fn();
    const controller = new AbortController();
    const authorizeAgentExecution = vi.fn(async () => ({
      record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
      policy: { policyHash: "policy-a" },
      executionLease: { signal: controller.signal, release: runRelease },
    }));
    const enforce = vi.fn(async () => ({ outcome: "deny", code: "TOP_POLICY_DENY" }));
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce, enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "govern me", agentId: "agt_route" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(403);
    expect(c.response.body.error.code).toBe("TOP_POLICY_DENY");
    expect(enforce.mock.calls[0][0].toolName).toBe("forge_orchestrate");
    expect(enforce.mock.calls[0][0].params).not.toHaveProperty("goal");
    expect(enforce.mock.calls[0][0].params.goalDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(orchestrate).not.toHaveBeenCalled();
    expect(runRelease).toHaveBeenCalledOnce();
  });

  it("stops after an HTTP disconnect that lands while Agent authorization is pending", async () => {
    const requestController = new AbortController();
    const runRelease = vi.fn();
    let resolveAuthorization;
    const authorizeAgentExecution = vi.fn(() => new Promise((resolve) => {
      resolveAuthorization = resolve;
    }));
    const enforce = vi.fn();
    const orchestrate = vi.fn();
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce, enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "disconnect while authorizing", agentId: "agt_route" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    c.requestExecution = { signal: requestController.signal };

    const pending = dispatchForgeRoutes(c);
    await vi.waitFor(() => expect(authorizeAgentExecution).toHaveBeenCalledOnce());
    requestController.abort(Object.assign(new Error("client disconnected"), {
      code: "CLIENT_DISCONNECTED",
      statusCode: 499,
    }));
    resolveAuthorization({
      record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
      policy: { policyHash: "policy-a" },
      executionLease: { signal: new AbortController().signal, release: runRelease },
    });
    await pending;

    expect(c.response.statusCode).toBe(499);
    expect(c.response.body.error.code).toBe("CLIENT_DISCONNECTED");
    expect(enforce).not.toHaveBeenCalled();
    expect(orchestrate).not.toHaveBeenCalled();
    expect(runRelease).toHaveBeenCalledOnce();
  });

  it("releases the top action lease when HTTP cancellation lands during Tool Proxy admission", async () => {
    const requestController = new AbortController();
    const runRelease = vi.fn();
    const topRelease = vi.fn();
    let resolveAdmission;
    const enforce = vi.fn(() => new Promise((resolve) => {
      resolveAdmission = resolve;
    }));
    const orchestrate = vi.fn();
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: {
          authorizeAgentExecution: vi.fn(async () => ({
            record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
            policy: { policyHash: "policy-a" },
            executionLease: { signal: new AbortController().signal, release: runRelease },
          })),
        },
        toolProxy: { enforce, enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "disconnect during admission", agentId: "agt_route" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    c.requestExecution = { signal: requestController.signal };

    const pending = dispatchForgeRoutes(c);
    await vi.waitFor(() => expect(enforce).toHaveBeenCalledOnce());
    requestController.abort(Object.assign(new Error("client disconnected"), {
      code: "CLIENT_DISCONNECTED",
      statusCode: 499,
    }));
    resolveAdmission({
      outcome: "allow",
      policy: { policyHash: "policy-a" },
      executionLease: { release: topRelease },
    });
    await pending;

    expect(c.response.statusCode).toBe(499);
    expect(orchestrate).not.toHaveBeenCalled();
    expect(topRelease).toHaveBeenCalledOnce();
    expect(runRelease).toHaveBeenCalledOnce();
  });

  it("skips top-level result processing when the Agent run lease is revoked as Forge returns", async () => {
    const runController = new AbortController();
    const runRelease = vi.fn();
    const topRelease = vi.fn();
    const enforceResult = vi.fn();
    let resolveOrchestration;
    const orchestrate = vi.fn(() => new Promise((resolve) => {
      resolveOrchestration = resolve;
    }));
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: {
          authorizeAgentExecution: vi.fn(async () => ({
            record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
            policy: { policyHash: "policy-a" },
            executionLease: { signal: runController.signal, release: runRelease },
          })),
        },
        toolProxy: {
          enforce: vi.fn(async () => ({
            outcome: "allow",
            policy: { policyHash: "policy-a" },
            executionLease: { release: topRelease },
          })),
          enforceResult,
        },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "revoke as Forge returns", agentId: "agt_route" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };

    const pending = dispatchForgeRoutes(c);
    await vi.waitFor(() => expect(orchestrate).toHaveBeenCalledOnce());
    runController.abort(Object.assign(new Error("Agent revoked"), {
      code: "AGENT_REVOKED",
      statusCode: 409,
    }));
    resolveOrchestration({ ok: false, code: "FORGE_RUN_ABORTED", reason: "Agent revoked" });
    await pending;

    expect(c.response.statusCode).toBe(409);
    expect(c.response.body.error.code).toBe("AGENT_REVOKED");
    expect(enforceResult).not.toHaveBeenCalled();
    expect(topRelease).toHaveBeenCalledOnce();
    expect(runRelease).toHaveBeenCalledOnce();
  });

  it("returns 202 plus approvalId for a complete bounded top-level Forge review", async () => {
    const orchestrate = vi.fn();
    const runRelease = vi.fn();
    const authorizeAgentExecution = vi.fn(async () => ({
      record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
      policy: { policyHash: "policy-a" },
      executionLease: { signal: new AbortController().signal, release: runRelease },
    }));
    const enforce = vi.fn(async (input) => {
      expect(input.resourceContext.approvalReview).toMatchObject({
        schemaVersion: 1,
        reviewable: true,
        effectType: "forge:orchestrate",
        forge: {
          goal: "review this complete goal",
          goalDigest: `sha256:${input.params.goalDigest}`,
          goalBytes: input.params.goalBytes,
          options: { maxConcurrent: 3, enableCodeIntel: false },
        },
      });
      return {
        outcome: "approval_required",
        code: "TOOL_APPROVAL_REQUIRED",
        approvalId: "apr_forge_1",
      };
    });
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce, enforceResult: vi.fn() },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: {
        goal: "review this complete goal",
        agentId: "agt_route",
        options: { maxConcurrent: 3, unsafePath: "ignored" },
      },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(202);
    expect(c.response.body.data).toMatchObject({
      outcome: "approval_required",
      approvalId: "apr_forge_1",
      agentId: "agt_route",
      toolName: "forge_orchestrate",
    });
    expect(orchestrate).not.toHaveBeenCalled();
    expect(runRelease).toHaveBeenCalledOnce();
  });

  it("uses top-level sealed options, injects per-action governance, meters the result, and releases both leases", async () => {
    const events = [];
    const runRelease = vi.fn(() => events.push("run-release"));
    const topRelease = vi.fn(() => events.push("top-release"));
    const controller = new AbortController();
    const authorizeAgentExecution = vi.fn(async () => ({
      record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
      policy: { policyHash: "policy-a" },
      executionLease: {
        signal: controller.signal,
        assertActive: vi.fn(async () => true),
        release: runRelease,
      },
    }));
    let requestedParams;
    const enforce = vi.fn(async (input) => {
      if (input.toolName !== "forge_orchestrate") {
        return {
          outcome: "allow",
          policy: { policyHash: "policy-a" },
          executionLease: { release: vi.fn() },
        };
      }
      requestedParams = input.params;
      return {
        outcome: "allow",
        policy: { policyHash: "policy-a" },
        approvedParams: {
          ...input.params,
          options: { maxConcurrent: 2, enableCodeIntel: false },
        },
        executionLease: { release: topRelease },
      };
    });
    const enforceResult = vi.fn(async ({ result }) => ({ verdict: "allow", result }));
    const orchestrate = vi.fn(async (input) => {
      events.push("orchestrate");
      expect(input.governanceRequired).toBe(true);
      expect(input.signal).toBe(controller.signal);
      expect(input.options).toEqual({ maxConcurrent: 2, enableCodeIntel: false });
      expect(typeof input.governedExecution.beforeAction).toBe("function");
      return { ok: true, result: { status: "completed" } };
    });
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce, enforceResult },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: {
        goal: "govern me",
        agentId: "agt_route",
        options: { maxConcurrent: 7, enableCodeIntel: true, unsafePath: "E:/secret" },
      },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(200);
    expect(orchestrate).toHaveBeenCalledOnce();
    expect(requestedParams.options).toEqual({ maxConcurrent: 7, enableCodeIntel: false });
    expect(enforceResult).toHaveBeenCalledWith(expect.objectContaining({ toolName: "forge_orchestrate" }));
    expect(events).toEqual(["orchestrate", "top-release", "run-release"]);
  });

  it("media route cleanup failures retain original failures and pending approvals without claiming unattempted providers", async () => {
    for (const mode of ["top", "run", "both", "approval", "denied", "terminal-failure", "prior-cleanup", "cancel-cleanup"]) {
      const controller = new AbortController();
      const topRelease = vi.fn(async () => { if (["top", "both"].includes(mode)) throw Error("top cleanup"); });
      const runRelease = vi.fn(async () => {
        if (mode === "cancel-cleanup") controller.abort();
        else if (mode !== "top") throw Error("run cleanup");
      });
      const profile = { id: "speech", tenantId: "tenant-a", providerId: "local-fake-provider", modelId: "local-fake-model",
        voice: "alloy", format: "wav-pcm16", maxTextBytes: 1000, maxAudioBytes: 10000, maxDurationMs: 1000, timeoutMs: 1000 };
      const media = { success: true, outcomeUnknown: false, request: { profileId: "speech", taskId: "media-tts" },
        usage: { providerCalls: 1 }, artifacts: [{ audioBase64: "PRIVATE-MEDIA-BYTES" }] };
      const orchestrate = vi.fn(async () => mode === "prior-cleanup"
        ? { ok: false, runId: "forge-media-fixture", code: "FORGE_ACTION_OUTCOME_UNCERTAIN", providerCallAttempted: true,
          causeCode: "FORGE_TASK_STORE_CLOSE_FAILED", cleanupCodes: ["FORGE_TASK_STORE_CLOSE_FAILED"],
          media: { ...media, success: false, outcomeUnknown: true, artifacts: [], code: "FORGE_TASK_STORE_CLOSE_FAILED" } }
        : { ok: true, runId: "forge-media-fixture", result: {
        status: "completed", completedTasks: 1, failedTasks: 0, media } });
      const enforce = vi.fn(async input => mode === "approval" ? { outcome: "approval_required", approvalId: "approval-fixture" }
        : mode === "denied" ? { outcome: "deny", code: "MEDIA_DENIED_FIRST" } : {
          outcome: "allow", approvalId: "approval-fixture", approvalReview: input.resourceContext.approvalReview,
          approvedParams: input.params, policy: { policyHash: "policy-a" }, executionLease: { release: topRelease },
        });
      const application = {
        runtimeEnv: { AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON: JSON.stringify([profile]) },
        gatewayService: { ...createFakeGatewayService(), executeProviderOperation: vi.fn() },
        agentGovernance: {
          service: { authorizeAgentExecution: async () => ({
            record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
            policy: { policyHash: "policy-a" }, executionLease: { signal: controller.signal, assertActive: async () => true, release: runRelease },
          }) },
          toolProxy: { enforce, enforceResult: vi.fn(async ({ result }) => {
            if (mode === "terminal-failure") throw Object.assign(Error("first terminal failure"), { code: "MEDIA_TERMINAL_FIRST" });
            return { verdict: "allow", result };
          }) },
        },
        __forgeGatewayService: { orchestrate, recordMediaDeliveryFailure: vi.fn(() => true) },
      };
      const c = createContext({ path: "/forge/orchestrate", application,
        body: { goal: "media route fixture", agentId: "agt_route", options: {
          modelSelection: { providerId: profile.providerId, modelId: profile.modelId }, mediaTask: { profileId: "speech", text: "hello" },
        } } });
      c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a", permissions: ["chat:use"] };
      await dispatchForgeRoutes(c);
      const cleanupCodes = ["top", "both"].includes(mode) ? ["FORGE_TOP_ACTION_LEASE_RELEASE_FAILED"] : [];
      if (mode === "prior-cleanup") cleanupCodes.push("FORGE_TASK_STORE_CLOSE_FAILED");
      if (mode === "cancel-cleanup") cleanupCodes.push("FORGE_MEDIA_DELIVERY_ABORTED");
      else if (mode !== "top") cleanupCodes.push("FORGE_RUN_LEASE_RELEASE_FAILED");
      const attempted = !["approval", "denied"].includes(mode);
      expect(c.response.statusCode).toBe(503);
      expect(c.response.body.error).toMatchObject({ code: "FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN", details: {
        providerCallAttempted: attempted, retrySafe: false, cleanupCodes,
        causeCode: mode === "terminal-failure" ? "MEDIA_TERMINAL_FIRST" : mode === "denied" ? "MEDIA_DENIED_FIRST" : cleanupCodes[0],
      } });
      if (mode === "approval") expect(c.response.body.error.details.approvalId).toBe("approval-fixture");
      expect(orchestrate).toHaveBeenCalledTimes(attempted ? 1 : 0);
      expect(application.__forgeGatewayService.recordMediaDeliveryFailure).toHaveBeenCalledTimes(attempted ? 1 : 0);
      if (attempted) expect(application.__forgeGatewayService.recordMediaDeliveryFailure).toHaveBeenCalledWith(expect.objectContaining({
        runId: "forge-media-fixture", tenantIdentity: { tenantId: "tenant-a", userId: "user-a", permissions: ["chat:use"] },
        code: "FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN", cleanupCodes,
      }));
      expect(JSON.stringify(c.response.body)).not.toContain("PRIVATE-MEDIA-BYTES");
      expect(topRelease).toHaveBeenCalledTimes(attempted ? 1 : 0); expect(runRelease).toHaveBeenCalledOnce();
    }
  });

  it("marks completed Forge orchestration uncertain when terminal governance fails", async () => {
    const runRelease = vi.fn();
    const topRelease = vi.fn();
    const controller = new AbortController();
    const authorizeAgentExecution = vi.fn(async () => ({
      record: { agentId: "agt_route", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
      policy: { policyHash: "policy-a" },
      executionLease: {
        signal: controller.signal,
        assertActive: vi.fn(async () => true),
        release: runRelease,
      },
    }));
    const enforce = vi.fn(async (input) => ({
      outcome: "allow",
      policy: { policyHash: "policy-a" },
      approvedParams: input.params,
      executionLease: { release: topRelease },
    }));
    const enforceResult = vi.fn(async () => {
      throw Object.assign(new Error("outcome audit unavailable"), {
        code: "GOVERNANCE_AUDIT_REQUIRED",
      });
    });
    const orchestrate = vi.fn(async () => ({
      ok: true,
      runId: "forge-run-1",
      result: { status: "completed" },
    }));
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: {
        service: { authorizeAgentExecution },
        toolProxy: { enforce, enforceResult },
      },
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "completed Forge effect", agentId: "agt_route" },
      application,
    });
    c.request.enterpriseIdentity = { tenantId: "tenant-a", userId: "user-a" };
    await dispatchForgeRoutes(c);

    expect(orchestrate).toHaveBeenCalledOnce();
    expect(c.response.statusCode).toBe(503);
    expect(c.response.body.error).toMatchObject({
      code: "FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
      details: {
        outcomeUnknown: true,
        retrySafe: false,
        reconciliation: {
          required: true,
          agentId: "agt_route",
          effectType: "forge:orchestrate",
          goalDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
          runId: "forge-run-1",
        },
      },
    });
    expect(topRelease).toHaveBeenCalledOnce();
    expect(runRelease).toHaveBeenCalledOnce();
  });

  it("preserves the legacy orchestration path when Agent Governance is disabled", async () => {
    const orchestrate = vi.fn(async () => ({ ok: true, result: { status: "completed" } }));
    const application = {
      runtimeEnv: {},
      gatewayService: createFakeGatewayService(),
      agentGovernance: null,
      __forgeGatewayService: { orchestrate },
    };
    const c = createContext({
      path: "/forge/orchestrate",
      body: { goal: "legacy", options: { maxConcurrent: 17, custom: true } },
      application,
    });
    await dispatchForgeRoutes(c);

    expect(c.response.statusCode).toBe(200);
    expect(orchestrate).toHaveBeenCalledWith(expect.objectContaining({
      goal: "legacy",
      options: { maxConcurrent: 17, custom: true },
    }));
  });

  it("passes non-forge paths through untouched", async () => {
    const result = await dispatchForgeRoutes(createContext({ path: "/v1/chat/completions" }));
    expect(result).toBeTruthy(); // ROUTE_NOT_HANDLED symbol
  });
});

describe("vision routes (taiji compile + workforce preview)", () => {
  function ctx(method, path, body) {
    const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
    request.method = method;
    const response = new EventEmitter();
    response.statusCode = null; response.headers = {}; response.body = null;
    response.writableEnded = false; response.destroyed = false; response.headersSent = false;
    response.writeHead = (s, h = {}) => { response.statusCode = s; response.headers = h; response.headersSent = true; };
    response.write = () => true;
    response.end = (p) => { if (p !== undefined) { try { response.body = JSON.parse(String(p)); } catch { response.body = p; } } response.writableEnded = true; };
    return { application: { runtimeEnv: {}, gatewayService: createFakeGatewayService() }, request, response, startedAt: Date.now(), url: new URL(`http://127.0.0.1:4010${path}`), writeServiceLog: vi.fn() };
  }

  it("compiles a taiji capability spec with risk classification and manifest", async () => {
    const c = ctx("POST", "/taiji/compile", { capabilityId: "cap_report", displayName: "Report Generator", description: "生成内部报表,读取数据库" });
    await dispatchForgeRoutes(c);
    expect(c.response.statusCode).toBe(200);
    expect(c.response.body.data.spec.capabilityId).toBe("cap_report");
    expect(c.response.body.data.risk).toBeTruthy();
    expect(c.response.body.data.manifest).toBeTruthy();
  });

  it("runs the workforce dry-run preview for a task", async () => {
    const c = ctx("POST", "/workforce/preview", { task: "为网关写一份 UX 修复计划" });
    await dispatchForgeRoutes(c);
    expect(c.response.statusCode).toBe(200);
    expect(c.response.body.data.route).toBe("/workforce/preview");
    expect(c.response.body.data.preview).toBeTruthy();
  });
});
