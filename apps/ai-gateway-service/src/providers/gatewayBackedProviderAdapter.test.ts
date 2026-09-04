import { describe, expect, it, vi } from "vitest";

import { createGatewayBackedProviderAdapter } from "./gatewayBackedProviderAdapter.ts";
import { AGENT_GOVERNANCE_EXECUTION_CONTEXT } from "../core/gatewayService.js";

describe("gateway-backed internal provider adapter", () => {
  it("routes low-level provider input through a pinned governed gateway call", async () => {
    const signal = new AbortController().signal;
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          message: { role: "assistant", content: "governed answer" },
          usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
          finishReason: "stop",
          metadata: { latencyMs: 7, rawProviderMeta: { toolCalls: [] } },
        },
      })),
    };
    const adapter = createGatewayBackedProviderAdapter({
      gatewayService,
      providerId: "openai",
      modelId: "gpt-test",
      source: "agent-exec",
      agentExecutionContext: {
        agentId: "agt_adapter_test",
        runId: "agr_adapter_run",
        policyHash: `sha256:${"a".repeat(64)}`,
        tenantId: "tenant-a",
        userId: "operator-a",
      },
    });

    const result = await adapter.generate({
      request: {
        messages: [{ role: "user", content: "hello" }],
        tools: [{ type: "function", function: { name: "read_file" } }],
        toolChoice: "auto",
        options: { maxOutputTokens: 128 },
      },
      target: { providerId: "openai", modelId: "gpt-test" },
      execution: { signal },
    });

    expect(gatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      taskType: "chat",
      providerId: "openai",
      model: "gpt-test",
      enterpriseIdentity: { tenantId: "tenant-a", userId: "operator-a" },
      [AGENT_GOVERNANCE_EXECUTION_CONTEXT]: {
        agentId: "agt_adapter_test",
        runId: "agr_adapter_run",
        policyHash: `sha256:${"a".repeat(64)}`,
        tenantId: "tenant-a",
        userId: "operator-a",
      },
      tools: expect.any(Array),
      metadata: {
        source: "agent-exec",
        internalProviderExecution: { governedByGateway: true, directAdapterCall: false },
      },
    }), { signal });
    expect(result).toMatchObject({
      text: "governed answer",
      usage: { totalTokens: 5 },
      latencyMs: 7,
      raw: { toolCalls: [] },
    });
  });

  it("preserves safe gateway failure semantics and rejects target drift", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: false,
        code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
        error: {
          code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
          type: "concurrency",
          message: "already consumed",
          retryable: false,
          details: {},
        },
      })),
    };
    const adapter = createGatewayBackedProviderAdapter({
      gatewayService,
      providerId: "openai",
      modelId: "gpt-test",
    });

    await expect(adapter.generate({
      request: { messages: [{ role: "user", content: "hello" }] },
      target: { providerId: "openai", modelId: "gpt-test" },
    })).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
      category: "concurrency",
      retryable: false,
    });
    await expect(adapter.generate({
      request: { messages: [{ role: "user", content: "hello" }] },
      target: { providerId: "other", modelId: "gpt-test" },
    })).rejects.toMatchObject({ code: "GATEWAY_BACKED_PROVIDER_TARGET_MISMATCH" });
    expect(gatewayService.execute).toHaveBeenCalledOnce();
  });

  it("rejects malformed server-owned Agent attribution", () => {
    expect(() => createGatewayBackedProviderAdapter({
      gatewayService: { execute: vi.fn() },
      providerId: "openai",
      agentExecutionContext: {
        agentId: "caller-controlled",
        runId: "agr_valid",
        policyHash: `sha256:${"a".repeat(64)}`,
        tenantId: "tenant-a",
        userId: "operator-a",
      },
    })).toThrow(expect.objectContaining({ code: "GATEWAY_BACKED_PROVIDER_AGENT_CONTEXT_INVALID" }));
  });
});
