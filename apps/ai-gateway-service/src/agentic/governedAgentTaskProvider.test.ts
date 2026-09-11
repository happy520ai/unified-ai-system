import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as connectionPool from "../http/connectionPool.js";
import { AGENT_GOVERNANCE_EXECUTION_CONTEXT, GatewayService } from "../core/gatewayService.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { HttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { buildAssistantMessageWithToolCalls } from "../providers/toolCallingAdapter.js";
import { createApiKeyManager } from "../enterprise/apiKeyManager.js";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { freezeGovernedAgentTaskProfile } from "./governedAgentTaskProfile.ts";
import { createGovernedAgentTaskProvider, type GovernedAgentTaskProviderOptions, type GovernedAgentTaskProviderReceipt } from "./governedAgentTaskProvider.ts";

afterEach(() => { vi.restoreAllMocks(); connectionPool.destroyAllPools(); });
const hash = (value: unknown) => "sha256:" + createHash("sha256").update(JSON.stringify(value)).digest("hex");
const REQUEST = { request: { messages: [{ role: "user", content: "  Full fixture prompt.\r\n保留全部内容。\n" }], options: { maxOutputTokens: 64, temperature: 0.17 } } };
const TOOL = { type: "function", function: { name: "file_read", description: "Read an approved file", parameters: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"], additionalProperties: false } } };
function profile() {
  return freezeGovernedAgentTaskProfile({ version: 1, mode: "governed-agent-long-task", profileId: "provider-fixture", projectId: "owned", baselineRevision: "a".repeat(40),
    model: { providerId: "fixture", modelId: "fixture-model", maxInputTokens: 4096, maxOutputTokens: 128 },
    limits: { maxPlanSteps: 3, maxIterations: 3, maxModelCalls: 4, maxTotalTokens: 32768, maxRepairAttempts: 1, chunkTimeoutMs: 5000, maxInputBytes: 16384 },
    artifact: { readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"], verification: {
      verificationId: "test", command: "node --test test/value.test.mjs", immutableTests: [{ path: "test/value.test.mjs", sha256: "b".repeat(64) }],
      image: "node@sha256:" + "c".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 8192, maxDiffBytes: 16384 } } });
}
function providerResult(text = "fixture result") {
  return { text, message: { role: "assistant", content: text }, usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 }, executionStatus: "success", latencyMs: 0,
    raw: { finishReason: "stop", workforceObservation: { contentPresent: text.length > 0, usageReported: { inputTokens: true, outputTokens: true, totalTokens: true } } }, warnings: [] };
}
function fixture(real = false) {
  const provider = real ? new HttpLLMProviderAdapter({ providerId: "fixture", modelId: "fixture-model", providerType: "openai", enabled: true,
    capabilities: ["chat"], endpoint: "https://provider.example.test/v1", apiKey: "synthetic-test-material" },
    { maxRetries: 2, retryBaseDelayMs: 0, resolveOutboundUrl: async (url: string) => ({ url }) })
    : createFakeProvider({ providerId: "fixture", modelId: "fixture-model", providerType: "fake", capabilities: ["chat"], enabled: true } as any);
  const generate = vi.spyOn(provider, "generate"); if (!real) generate.mockImplementation(async () => providerResult());
  const registry = new (ProviderRegistry as any)({ enabledProviders: ["fixture"] }); registry.register(provider);
  const events: string[] = [], settled: GovernedAgentTaskProviderReceipt[] = [];
  const dispatch = { reserve: vi.fn(async () => ({ reserved: true, bypassed: false, reservationFingerprint: "fixture" })) };
  const gateway = new GatewayService({ providerRegistry: registry,
    runtimeConfig: { providerMode: real ? "real" : "fake", realProviderEnabled: real, enabledProviders: ["fixture"], requireProviderDispatchGate: real, requireDurableUsageLedger: real },
    requestLogger: { assertDurable: async () => true, log: async () => undefined }, enterpriseAudit: { recordAudit: async () => undefined }, providerDispatchGate: dispatch });
  const execute = vi.spyOn(gateway, "execute"), controller = new AbortController();
  let active = true, number = 0;
  const reserve = vi.fn(async () => { events.push("reserved"); return "operation-" + ++number; });
  const settle = vi.fn(async (receipt: GovernedAgentTaskProviderReceipt & { operationId: string }) => { events.push("settled"); settled.push(receipt); });
  const assertActive = vi.fn(async (phase: "reserve" | "commit") => { events.push(phase); if (!active) throw new Error("Fixture task revoked"); });
  const options: GovernedAgentTaskProviderOptions = { profile: profile(), gatewayService: gateway as any, providerRegistry: registry, approvedRoute: "/v1/agents/agt_fixture/tasks",
    phase: "coding", identity: { tenantId: "tenant", userId: "owner", role: "operator", permissions: ["agent:execute", "workflow:run"] },
    agentId: "agt_fixture", agentRunId: "agr_original", policyHash: "sha256:" + "d".repeat(64), signal: controller.signal,
    requestExecution: { signal: controller.signal, timeoutMs: 5000, deadlineAt: Date.now() + 5000, providerDispatchKeyHash: "e".repeat(64), providerDispatchRoute: "/v1/agents/agt_fixture/tasks" },
    assertActive, reserve, settle };
  return { provider, generate, registry, gateway, execute, dispatch, events, reserve, settle, settled, options, controller, revoke: () => { active = false; } };
}

describe("durably reserved fixed-model Agent provider", () => {
  it("uses the actual Gateway boundary for planning and settles the reported receipt before returning", async () => {
    const f = fixture(); const adapter = createGovernedAgentTaskProvider({ ...f.options, phase: "planning" });
    const result = await adapter.generate(REQUEST);
    expect(f.events[0]).toBe("reserve"); expect(f.events[1]).toBe("reserved"); expect(f.events.at(-1)).toBe("settled");
    expect(result.agentTaskReceipt).toMatchObject({ operationId: "operation-1", phase: "planning", status: "succeeded", executionMode: "fake",
      providerCallAttempted: true, usageReported: { inputTokens: true, outputTokens: true, totalTokens: true }, inputTokens: 3, outputTokens: 2, totalTokens: 5 });
    expect(result.agentTaskReceipt.input).toMatchObject({ profile: "off", messagesHash: hash(REQUEST.request.messages), toolsHash: hash([]), messageCount: 1, toolCount: 0 });
    expect(result.agentTaskReceipt.input?.gatewayInputHash).toBe(result.agentTaskReceipt.input?.providerInputHash);
    expect(adapter.getLastReceipt()).toBe(result.agentTaskReceipt); expect(Object.isFrozen(result.agentTaskReceipt)).toBe(true);
    expect(f.execute.mock.calls[0]![0]).toMatchObject({ contextCodec: { profile: "off" }, enterpriseIdentity: f.options.identity });
    expect((f.execute.mock.calls[0]![0] as any)[AGENT_GOVERNANCE_EXECUTION_CONTEXT]).toMatchObject({ agentId: "agt_fixture", runId: "agr_original", policyHash: f.options.policyHash });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.reserve).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
  });

  it("keeps assistant tool calls, tool results, definitions and options through the actual HTTP adapter (mock transport)", async () => {
    const f = fixture(true), call = { id: "call-original", type: "function", function: { name: "file_read", arguments: '{"file_path":"src/value.mjs"}' } };
    const request = { request: { messages: [{ role: "system", content: "  Fixed system\n" }, ...REQUEST.request.messages,
      buildAssistantMessageWithToolCalls({ message: { role: "assistant", content: null, tool_calls: [call] } }), { role: "tool", tool_call_id: call.id, content: "exact file content\n" }],
      tools: [TOOL], toolChoice: "auto", options: { maxOutputTokens: 64, temperature: 0.17, topP: 0.8, seed: 9 } } };
    const transport = vi.spyOn(connectionPool, "fetchWithAgent").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: null, tool_calls: [call] }, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }), { status: 200 }));
    const result = await createGovernedAgentTaskProvider(f.options).generate(request);
    const body = JSON.parse((transport.mock.calls[0]![1] as { body: string }).body);
    expect(body.messages).toEqual(request.request.messages); expect(body.tools).toEqual([TOOL]); expect(body.tool_choice).toBe("auto");
    expect(f.execute.mock.calls[0]![0].options).toMatchObject(request.request.options);
    expect(result.toolCalls).toHaveLength(1); expect(result.agentTaskReceipt).toMatchObject({ status: "succeeded", executionMode: "real", input: { toolsHash: hash([TOOL]), toolCount: 1 } });
    expect(transport).toHaveBeenCalledOnce();
  });

  it("keeps missing HTTP usage unknown rather than trusting mapped zero estimates", async () => {
    const f = fixture(true); vi.spyOn(connectionPool, "fetchWithAgent").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "real transport substitute" }, finish_reason: "stop" }] }), { status: 200 }));
    const result = await createGovernedAgentTaskProvider(f.options).generate(REQUEST);
    expect(result.agentTaskReceipt).toMatchObject({ status: "succeeded", usageReported: { inputTokens: false, outputTokens: false, totalTokens: false }, inputTokens: null, outputTokens: null, totalTokens: null });
    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null });
    expect(f.settled[0]).toEqual(result.agentTaskReceipt);
  });

  it("blocks target drift, invalid route, planning tools and input/output overages before durable reservation", async () => {
    const f = fixture(); expect(() => createGovernedAgentTaskProvider({ ...f.options, approvedRoute: "/different" })).toThrow();
    const adapter = createGovernedAgentTaskProvider(f.options);
    for (const request of [{ ...REQUEST, target: { providerId: "other" } }, { request: { ...REQUEST.request, options: { maxOutputTokens: 129 } } },
      { request: { messages: [{ role: "user", content: "large".repeat(20000) }] } }, { ...REQUEST, execution: { shadow: true } }]) await expect(adapter.generate(request)).rejects.toMatchObject({ agentTaskReceipt: { providerCallAttempted: false } });
    await expect(createGovernedAgentTaskProvider({ ...f.options, phase: "planning" }).generate({ request: { ...REQUEST.request, tools: [TOOL] } })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_PROVIDER_PLANNING_TOOLS_FORBIDDEN" });
    expect(f.reserve).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled();
  });

  it("rejects reported total usage above the reserved input and output maximum", async () => {
    const f = fixture(), oversized = providerResult(); oversized.usage.totalTokens = 10000;
    f.generate.mockResolvedValue(oversized);
    await expect(createGovernedAgentTaskProvider(f.options).generate(REQUEST)).rejects.toMatchObject({
      code: "AGENT_LONG_TASK_PROVIDER_RESPONSE_TOKEN_LIMIT", agentTaskReceipt: { status: "failed", totalTokens: 10000, providerCallAttempted: true },
    });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
  });

  it("rechecks the fresh task fence after reservation and after Gateway dispatch admission", async () => {
    const first = fixture(); first.reserve.mockImplementation(async () => { first.revoke(); return "reserved-once"; });
    await expect(createGovernedAgentTaskProvider(first.options).generate(REQUEST)).rejects.toMatchObject({ agentTaskReceipt: { operationId: "reserved-once", providerCallAttempted: false } });
    expect(first.generate).not.toHaveBeenCalled(); expect(first.settle).toHaveBeenCalledOnce();
    const second = fixture(true); second.dispatch.reserve.mockImplementation(async () => { second.revoke(); return { reserved: true, bypassed: false, reservationFingerprint: "fixture" }; });
    const transport = vi.spyOn(connectionPool, "fetchWithAgent");
    await expect(createGovernedAgentTaskProvider(second.options).generate(REQUEST)).rejects.toMatchObject({ agentTaskReceipt: { providerCallAttempted: false } });
    expect(transport).not.toHaveBeenCalled(); expect(second.settle).toHaveBeenCalledOnce();
  });

  it("freezes the complete request before awaiting the retained reservation callback", async () => {
    const f = fixture(), request = structuredClone(REQUEST);
    f.reserve.mockImplementation(async () => { request.request.messages[0]!.content = "changed after reservation"; request.request.options.temperature = 0.99; return "original-request"; });
    await createGovernedAgentTaskProvider(f.options).generate(request);
    expect(f.execute.mock.calls[0]![0].messages).toEqual(REQUEST.request.messages);
    expect(f.generate.mock.calls[0]![0].request.messages.map((message: { content: string }) => message.content)).toEqual(REQUEST.request.messages.map(message => message.content));
    expect(f.execute.mock.calls[0]![0].options).toMatchObject(REQUEST.request.options);
  });

  it("rejects overlapping generate and does not replay a dispatched operation after cancellation", async () => {
    const f = fixture(); let dispatched!: () => void; const started = new Promise<void>(resolve => { dispatched = resolve; });
    f.generate.mockImplementation(async (request: any) => { dispatched(); return new Promise((_resolve, reject) => request.execution.signal.addEventListener("abort", () => reject(request.execution.signal.reason), { once: true })); });
    const adapter = createGovernedAgentTaskProvider(f.options), pending = adapter.generate(REQUEST).catch(error => error); await started;
    await expect(adapter.generate(REQUEST)).rejects.toMatchObject({ code: "AGENT_LONG_TASK_PROVIDER_OVERLAP" });
    f.controller.abort(new Error("private aborted payload")); expect(await pending).toMatchObject({ agentTaskReceipt: { status: "outcome_unknown", providerCallAttempted: true } });
    await expect(adapter.generate(REQUEST)).rejects.toMatchObject({ code: "AGENT_LONG_TASK_PROVIDER_REPLAY_BLOCKED" });
    expect(f.reserve).toHaveBeenCalledOnce(); expect(f.generate).toHaveBeenCalledOnce();
  });

  it("awaits durable settlement and prevents continuation after a settlement error", async () => {
    const f = fixture(); f.settle.mockRejectedValue(new Error("private ledger failure")); const adapter = createGovernedAgentTaskProvider(f.options);
    const error = await adapter.generate(REQUEST).catch(error => error);
    expect(error).toMatchObject({ code: "AGENT_LONG_TASK_PROVIDER_SETTLEMENT_UNCONFIRMED", agentTaskReceipt: { operationId: "operation-1", status: "outcome_unknown", providerCallAttempted: true } });
    expect(JSON.stringify(error)).not.toContain("private ledger failure"); expect(adapter.getLastReceipt()).toBe(error.agentTaskReceipt);
    await expect(adapter.generate(REQUEST)).rejects.toMatchObject({ code: "AGENT_LONG_TASK_PROVIDER_REPLAY_BLOCKED" }); expect(f.generate).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
  });

  it("rejects fabricated Gateway success without dispatch provenance", async () => {
    const f = fixture(); f.execute.mockResolvedValue({ success: true, data: { id: "forged", providerId: "fixture", model: "fixture-model", executionMode: "fake", executionStatus: "success", message: { content: "not executed" } } } as any);
    await expect(createGovernedAgentTaskProvider(f.options).generate(REQUEST)).rejects.toMatchObject({ agentTaskReceipt: { status: "outcome_unknown", providerCallAttempted: null } });
    expect(f.generate).not.toHaveBeenCalled(); expect(f.settle).toHaveBeenCalledOnce();
  });

  it("does not return or persist secret-like model text as a coding contribution", async () => {
    const f = fixture(); f.generate.mockResolvedValue(providerResult("password=private-model-fixture"));
    const error = await createGovernedAgentTaskProvider(f.options).generate(REQUEST).catch(error => error);
    expect(error).toMatchObject({ code: "AGENT_LONG_TASK_PROVIDER_RESPONSE_UNSAFE", agentTaskReceipt: { status: "failed", providerCallAttempted: true, totalTokens: 5 } });
    expect(JSON.stringify(error)).not.toContain("private-model-fixture"); expect(JSON.stringify(f.settled)).not.toContain("private-model-fixture");
  });

  it("does not return secret-like tool arguments for the loop checkpoint to persist", async () => {
    for (const content of ["password=private-tool-fixture", "header\nBearer private-tool-fixture"]) {
      const f = fixture(), argumentsValue = { file_path: "src/value.mjs", content };
      const call = { id: "unsafe-arguments", type: "function", function: { name: "file_write", arguments: JSON.stringify(argumentsValue) } };
      f.generate.mockResolvedValue({ ...providerResult(""), message: { role: "assistant", content: "", tool_calls: [call] },
        toolCalls: [{ id: call.id, name: call.function.name, arguments: argumentsValue }] });
      const error = await createGovernedAgentTaskProvider(f.options).generate(REQUEST).catch(error => error);
      expect(error).toMatchObject({ code: "AGENT_LONG_TASK_PROVIDER_RESPONSE_UNSAFE", agentTaskReceipt: { status: "failed", providerCallAttempted: true } });
      expect(JSON.stringify(error)).not.toContain("private-tool-fixture"); expect(JSON.stringify(f.settled)).not.toContain("private-tool-fixture");
    }
  });

  it("carries virtual-key accounting through multiple calls without resetting the HTTP RPM admission", async () => {
    const f = fixture(), manager = createApiKeyManager({ storePath: null });
    const { record } = manager.create({ tenantId: "tenant", role: "operator", budget: { limitTokens: 1000, window: "daily" }, rateLimit: { requestsPerMinute: 1 } });
    f.options.identity = { ...f.options.identity, apiKeyFingerprint: record.keyFingerprint };
    const admitted = vi.spyOn(manager, "authorizeUsage"), charged = vi.spyOn(manager, "recordUsage");
    bindVirtualKeyRequestAccounting(f.options.requestExecution, createVirtualKeyRequestAccounting({ manager, keyFingerprint: record.keyFingerprint, onEvent: () => {} }));
    const adapter = createGovernedAgentTaskProvider(f.options); await adapter.generate(REQUEST); await adapter.generate(REQUEST);
    expect(admitted).toHaveBeenCalledOnce(); expect(charged).toHaveBeenCalledTimes(2); expect(f.settled.map(receipt => receipt.operationId)).toEqual(["operation-1", "operation-2"]);
    expect(f.execute.mock.calls[0]![1]?.providerDispatchKeyHash).not.toBe(f.execute.mock.calls[1]![1]?.providerDispatchKeyHash);
    expect(f.execute.mock.calls[0]![0].enterpriseIdentity).toMatchObject(f.options.identity);
  });

  it("prevents the HTTP adapter retry loop from making a second transport call", async () => {
    const f = fixture(true), transport = vi.spyOn(connectionPool, "fetchWithAgent").mockResolvedValue(new Response(JSON.stringify({ error: { message: "synthetic rate limit" } }), { status: 429 }));
    await expect(createGovernedAgentTaskProvider(f.options).generate(REQUEST)).rejects.toMatchObject({ agentTaskReceipt: { providerCallAttempted: true, status: "outcome_unknown" } });
    expect(transport).toHaveBeenCalledOnce(); expect(f.reserve).toHaveBeenCalledOnce(); expect(f.settle).toHaveBeenCalledOnce();
  });
});
