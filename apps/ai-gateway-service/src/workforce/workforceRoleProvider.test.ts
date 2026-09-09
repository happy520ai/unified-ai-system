import { afterEach, describe, expect, it, vi } from "vitest";
import * as connectionPool from "../http/connectionPool.js";
import { AGENT_GOVERNANCE_EXECUTION_CONTEXT, GatewayService } from "../core/gatewayService.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createWorkforceRoleProviderFactory, type WorkforceRoleRunContext } from "./workforceRoleProvider.ts";
import { freezeWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { createApiKeyManager } from "../enterprise/apiKeyManager.js";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";

afterEach(() => { vi.restoreAllMocks(); connectionPool.destroyAllPools(); });

function profile(maxRequests = 1, roles = ["analysis"], maxConcurrentRoles = roles.length) {
  return freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required", profileId: "explicit-fixture",
    maxTotalRequests: roles.length * maxRequests, maxConcurrentRoles,
    bindings: roles.map((roleId) => ({ roleId, employeeId: `catalog-entry-${roleId}`, providerId: "fixture", modelId: "fixture-model",
      maxRequests, maxInputTokens: 128, maxOutputTokens: 64, timeoutMs: 1000 })),
  });
}
function context(hash: string, suffix = "a"): WorkforceRoleRunContext {
  const signal = new AbortController().signal;
  return { identity: { tenantId: `tenant-${suffix}`, userId: `user-${suffix}`, role: "operator", permissions: ["workflow:run"] },
    agentId: `agt_${suffix}`, agentRunId: `agr_${suffix}`, policyHash: `sha256:${"a".repeat(64)}`, executionId: `execution-${suffix}`,
    planId: `plan-${suffix}`, planDigest: "b".repeat(64), profileHash: hash, signal,
    requestExecution: { signal, timeoutMs: 1000, deadlineAt: Date.now() + 1000,
      providerDispatchKeyHash: "c".repeat(64), providerDispatchRoute: "/workforce/execute" },
    agentFence: { assertActive: vi.fn(async () => true) },
  };
}
const REQUEST = { request: { messages: [{ role: "user", content: "give a concise contribution" }] } };
function task(roleId = "analysis") {
  return { roleId, taskId: `task-${roleId}`, signal: new AbortController().signal,
    taskFence: { assertActive: vi.fn(async () => true) } };
}
function fixture(selected = profile()) {
  const provider = createFakeProvider({ providerId: "fixture", modelId: "fixture-model", providerType: "fake",
    capabilities: ["chat"], enabled: true } as any);
  const registry = new (ProviderRegistry as any)({ enabledProviders: ["fixture"] }); registry.register(provider);
  const gateway = new GatewayService({ providerRegistry: registry, runtimeConfig: { providerMode: "fake", realProviderEnabled: false } });
  const execute = vi.spyOn(gateway, "execute");
  const factory = createWorkforceRoleProviderFactory({ gatewayService: gateway as any, providerRegistry: registry, profile: selected });
  return { factory, provider, gateway, execute, registry, profile: selected };
}

describe("per-run Workforce role Provider factory", () => {
  it("preserves authenticated virtual-key accounting across two roles without a second RPM admission", async () => {
    const f = fixture(profile(1, ["analysis", "review"]));
    const manager = createApiKeyManager({ storePath: null });
    const { record } = manager.create({ tenantId: "tenant-a", role: "operator", budget: { limitTokens: 1000, window: "daily" }, rateLimit: { requestsPerMinute: 1 } });
    const admissions = vi.spyOn(manager, "authorizeUsage"); const charges = vi.spyOn(manager, "recordUsage");
    const input = context(f.profile.profileHash);
    input.identity = { ...input.identity, apiKeyFingerprint: record.keyFingerprint };
    bindVirtualKeyRequestAccounting(input.requestExecution, createVirtualKeyRequestAccounting({ manager, keyFingerprint: record.keyFingerprint, onEvent: () => {} }));
    const run = f.factory.forRun(input);
    const receipts = await Promise.all(["analysis", "review"].map(roleId => run.createRoleAdapter(task(roleId)).generate(REQUEST)));
    expect(receipts.every(receipt => receipt.workforceReceipt.status === "succeeded")).toBe(true);
    expect(admissions).toHaveBeenCalledOnce(); expect(charges).toHaveBeenCalledTimes(2);
    expect(manager.describeUsage({ keyId: record.keyId })!.usage).toMatchObject({ requestCount: 1,
      rateRequestCount: 1, tokensUsed: charges.mock.calls.reduce((sum, [input]) => sum + input!.tokens!, 0) });
    expect(charges.mock.calls.every(([charge]) => charge!.tokens! > 0)).toBe(true);
  });

  it("keeps two concurrent tenants and their run/dispatch identities isolated", async () => {
    const f = fixture();
    const a = context(f.profile.profileHash, "a"); const b = context(f.profile.profileHash, "b");
    const first = f.factory.forRun(a); const second = f.factory.forRun(b);
    a.identity.tenantId = "changed-after-binding";
    const [ra, rb] = await Promise.all([first.createRoleAdapter(task()).generate(REQUEST), second.createRoleAdapter(task()).generate(REQUEST)]);
    expect(ra.workforceReceipt).toMatchObject({ status: "succeeded", executionMode: "fake", providerCallAttempted: true, estimatedCostUsd: null });
    expect(rb.workforceReceipt.status).toBe("succeeded");
    const calls = f.execute.mock.calls;
    expect(calls.map(([input]) => input.enterpriseIdentity?.tenantId)).toEqual(["tenant-a", "tenant-b"]);
    expect((calls[0][0] as any)[AGENT_GOVERNANCE_EXECUTION_CONTEXT]).toMatchObject({ agentId: "agt_a", runId: "agr_a", tenantId: "tenant-a" });
    expect((calls[1][0] as any)[AGENT_GOVERNANCE_EXECUTION_CONTEXT]).toMatchObject({ agentId: "agt_b", runId: "agr_b", tenantId: "tenant-b" });
    expect(calls[0][1]?.providerDispatchKeyHash).not.toBe(calls[1][1]?.providerDispatchKeyHash);
    expect(first.getUsage()).toEqual({ totalRequests: 1, activeRoles: 0 });
    expect(second.getUsage()).toEqual({ totalRequests: 1, activeRoles: 0 });
  });

  it("pins targets, ignores forged identity metadata, and gives roles distinct dispatch subkeys", async () => {
    const f = fixture(profile(1, ["analysis", "review"])); const run = f.factory.forRun(context(f.profile.profileHash));
    await Promise.all(["analysis", "review"].map((roleId) => run.createRoleAdapter(task(roleId)).generate({ ...REQUEST,
      enterpriseIdentity: { tenantId: "attacker" },
    } as any)));
    for (const [input] of f.execute.mock.calls) expect(input).toMatchObject({ providerId: "fixture", model: "fixture-model", enterpriseIdentity: { tenantId: "tenant-a" } });
    expect(f.execute.mock.calls[0][1]?.providerDispatchKeyHash).not.toBe(f.execute.mock.calls[1][1]?.providerDispatchKeyHash);
    expect(run.getReceipts()).toHaveLength(2);
    expect(run.getReceipts().map((entry) => entry.employeeId).sort()).toEqual(["catalog-entry-analysis", "catalog-entry-review"]);
  });

  it("rejects a changed role target before reaching the Gateway", async () => {
    const f = fixture(); const adapter = f.factory.forRun(context(f.profile.profileHash)).createRoleAdapter(task());
    await expect(adapter.generate({ ...REQUEST, target: { providerId: "other", modelId: "other" } })).rejects.toMatchObject({
      code: "GATEWAY_BACKED_PROVIDER_TARGET_MISMATCH", workforceReceipt: { status: "blocked", providerCallAttempted: false },
    });
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("enforces actual request caps and monotonic per-role invocation numbers", async () => {
    const f = fixture(profile(2)); const run = f.factory.forRun(context(f.profile.profileHash)); const adapter = run.createRoleAdapter(task());
    await adapter.generate(REQUEST); await adapter.generate(REQUEST);
    await expect(adapter.generate(REQUEST)).rejects.toMatchObject({ code: "WORKFORCE_ROLE_REQUEST_LIMIT",
      workforceReceipt: { status: "blocked", providerCallAttempted: false } });
    expect(f.execute.mock.calls.map(([, execution]) => execution?.providerDispatchInvocation)).toEqual([1, 2]);
    expect(run.getUsage().totalRequests).toBe(2);
    expect(() => run.createRoleAdapter(task())).toThrow();
  });

  it("rejects an expired or changed profile and input/output limit violations without a Provider call", async () => {
    const f = fixture(); const input = context(f.profile.profileHash); input.requestExecution.deadlineAt = Date.now() - 1;
    await expect(f.factory.forRun(input).createRoleAdapter(task()).generate(REQUEST)).rejects.toMatchObject({ code: "WORKFORCE_ROLE_DEADLINE_EXPIRED" });
    expect(() => f.factory.forRun({ ...context(f.profile.profileHash), profileHash: `sha256:${"f".repeat(64)}` })).toThrow();
    for (const request of [{ request: { messages: [{ role: "user", content: "large ".repeat(500) }] } },
      { request: { ...REQUEST.request, options: { maxOutputTokens: 65 } } }]) {
      await expect(f.factory.forRun(context(f.profile.profileHash)).createRoleAdapter(task()).generate(request))
        .rejects.toMatchObject({ code: "WORKFORCE_ROLE_TOKEN_LIMIT" });
    }
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("refuses unfenced real adapter kinds and requires a transport key for the supported HTTP adapter", () => {
    const f = fixture(); const real = new HttpLLMProviderAdapter({ providerId: "fixture", modelId: "fixture-model",
      providerType: "openai", endpoint: "https://provider.example.test", enabled: true, capabilities: ["chat"] });
    const factory = createWorkforceRoleProviderFactory({ gatewayService: f.gateway as any,
      providerRegistry: { get: () => real }, profile: f.profile });
    const input = context(f.profile.profileHash); delete input.requestExecution.providerDispatchKeyHash;
    expect(() => factory.forRun(input).createRoleAdapter(task())).toThrow();
    const unsupported = createWorkforceRoleProviderFactory({ gatewayService: f.gateway as any, providerRegistry: {
      get: () => ({ ...f.provider, descriptor: { ...f.provider.descriptor, metadata: { providerType: "native-unfenced" } } }),
    }, profile: f.profile });
    expect(() => unsupported.forRun(context(f.profile.profileHash)).createRoleAdapter(task())).toThrow();
  });

  it("never accepts a success metadata packet without the dispatch receipt", async () => {
    const f = fixture();
    f.execute.mockResolvedValue({ success: true, data: { id: "forged", providerId: "fixture", model: "fixture-model",
      executionMode: "real", executionStatus: "success", message: { content: "metadata is not execution" } } } as any);
    await expect(f.factory.forRun(context(f.profile.profileHash)).createRoleAdapter(task()).generate(REQUEST)).rejects.toMatchObject({
      code: "WORKFORCE_ROLE_RECEIPT_UNCONFIRMED", workforceReceipt: { status: "outcome_unknown", providerCallAttempted: null },
    });
  });

  it.each([
    { label: "reported usage", status: 200, includeUsage: true, empty: false },
    { label: "unreported usage", status: 200, includeUsage: false, empty: false },
    { label: "empty text", status: 200, includeUsage: true, empty: true },
    { label: "retry limit", status: 429, includeUsage: false, empty: false },
  ])("carries the factory fence through the HTTP adapter: $label (mock transport)", async ({ status, includeUsage, empty }) => {
    const selected = profile();
    const provider = new HttpLLMProviderAdapter({ providerId: "fixture", modelId: "fixture-model", providerType: "openai",
      enabled: true, capabilities: ["chat"], endpoint: "https://provider.example.test/v1", apiKey: "synthetic-runtime-key" },
    { maxRetries: 2, retryBaseDelayMs: 0, resolveOutboundUrl: async (url: string) => ({ url }) });
    const transport = vi.spyOn(connectionPool, "fetchWithAgent").mockImplementation(async () => new Response(JSON.stringify(
      status === 200 ? { choices: [{ message: { content: empty ? "" : "actual mock contribution" }, finish_reason: "stop" }],
        ...(includeUsage ? { usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } } : {}) } : { error: { message: "synthetic rate limit" } },
    ), { status }));
    const registry = new (ProviderRegistry as any)({ enabledProviders: ["fixture"] }); registry.register(provider);
    const gateway = new GatewayService({ providerRegistry: registry,
      runtimeConfig: { providerMode: "real", realProviderEnabled: true, enabledProviders: ["fixture"],
        requireProviderDispatchGate: true, requireDurableUsageLedger: true },
      requestLogger: { assertDurable: async () => true, log: async () => undefined },
      enterpriseAudit: { recordAudit: async () => undefined },
      providerDispatchGate: { reserve: async () => ({ reserved: true, bypassed: false, reservationFingerprint: "fixture" }) },
    });
    const run = createWorkforceRoleProviderFactory({ gatewayService: gateway as any, providerRegistry: registry, profile: selected })
      .forRun(context(selected.profileHash));
    const outcome = await run.createRoleAdapter(task()).generate(REQUEST).catch((error: unknown) => error);
    expect(transport).toHaveBeenCalledOnce();
    expect(run.getUsage()).toEqual({ totalRequests: 1, activeRoles: 0 });
    if (empty) expect(outcome).toMatchObject({ code: "WORKFORCE_ROLE_CONTRIBUTION_INVALID",
      workforceReceipt: { status: "failed", providerCallAttempted: true } });
    else if (status === 200) expect((outcome as any).workforceReceipt).toMatchObject({ status: "succeeded", executionMode: "real",
      providerCallAttempted: true, inputTokens: includeUsage ? 3 : null, outputTokens: includeUsage ? 2 : null,
      totalTokens: includeUsage ? 5 : null, estimatedCostUsd: null });
    else expect(outcome).toMatchObject({ code: "WORKFORCE_ROLE_REQUEST_LIMIT",
      workforceReceipt: { status: "outcome_unknown", providerCallAttempted: true } });
  });

  it("does not turn an empty model response or post-dispatch failure into template success", async () => {
    for (const empty of [true, false]) {
      const f = fixture();
      vi.spyOn(f.provider, "generate").mockImplementation(async () => {
        if (!empty) throw Object.assign(new Error("synthetic private provider error"), { code: "FIXTURE_FAILURE", retryable: false,
          details: { privatePayload: "synthetic-provider-body" } });
        return { text: "", message: { role: "assistant", content: "" }, usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
          latencyMs: 0, raw: { finishReason: "stop" }, executionStatus: "success", warnings: [] };
      });
      const run = f.factory.forRun(context(f.profile.profileHash));
      const error = await run.createRoleAdapter(task()).generate(REQUEST).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect((error as any).workforceReceipt).toMatchObject({ providerCallAttempted: true,
        status: empty ? "failed" : "outcome_unknown" });
      expect((error as Error).message).not.toContain("synthetic private provider error");
      expect(JSON.stringify(error)).not.toContain("synthetic-provider-body");
      expect(run.getReceipts()).toHaveLength(1);
    }
  });

  it("blocks excess concurrent roles and drains cancellation without reusing a spent request", async () => {
    const f = fixture(profile(1, ["analysis", "review"], 1));
    let started!: () => void;
    const dispatchStarted = new Promise<void>((resolve) => { started = resolve; });
    vi.spyOn(f.provider, "generate").mockImplementation(async (request) => {
      started();
      return new Promise((_resolve, reject) => request.execution?.signal.addEventListener("abort",
        () => reject(request.execution?.signal.reason), { once: true }));
    });
    const run = f.factory.forRun(context(f.profile.profileHash));
    const controller = new AbortController();
    const first = run.createRoleAdapter({ ...task(), signal: controller.signal });
    const pending = first.generate(REQUEST).catch((error: unknown) => error);
    await dispatchStarted;
    await expect(run.createRoleAdapter(task("review")).generate(REQUEST)).rejects.toMatchObject({
      code: "WORKFORCE_ROLE_CONCURRENCY_LIMIT", workforceReceipt: { status: "blocked", providerCallAttempted: false },
    });
    controller.abort(Object.assign(new Error("synthetic caller left"), { code: "CLIENT_DISCONNECTED", category: "cancellation", retryable: false }));
    expect((await pending as any).workforceReceipt).toMatchObject({ status: "outcome_unknown", providerCallAttempted: true });
    expect(run.getUsage()).toEqual({ totalRequests: 1, activeRoles: 0 });
    expect(f.provider.generate).toHaveBeenCalledOnce();
  });
});
