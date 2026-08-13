import { describe, expect, it, vi } from "vitest";
import { A2A_PROTOCOL_VERSION } from "@a2a-js/sdk";
import {
  A2A_JSONRPC_PATH,
  a2aGatewayInternals,
  createA2AGateway,
} from "./a2aGateway.js";

function createGateway(env = {}) {
  return createA2AGateway({
    gatewayService: { execute: vi.fn() },
    env,
  });
}

describe("A2A gateway profile", () => {
  it("advertises a loopback JSON-RPC v1.0 endpoint and text-only capabilities", () => {
    const gateway = createGateway({
      AI_GATEWAY_SERVICE_HOST: "0.0.0.0",
      AI_GATEWAY_SERVICE_PORT: "4010",
    });

    expect(gateway.publicBaseUrl).toBe("http://127.0.0.1:4010");
    expect(gateway.agentCardJson.supportedInterfaces).toEqual([
      expect.objectContaining({
        url: `http://127.0.0.1:4010${A2A_JSONRPC_PATH}`,
        protocolBinding: "JSONRPC",
        protocolVersion: A2A_PROTOCOL_VERSION,
      }),
    ]);
    expect(gateway.agentCardJson.defaultInputModes).toEqual(["text/plain"]);
    expect(gateway.agentCardJson.defaultOutputModes).toEqual(["text/plain"]);
    expect(gateway.agentCardJson.capabilities).toEqual(expect.objectContaining({
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    }));
    expect(gateway.agentCardJson.securitySchemes).toBeUndefined();
  });

  it("advertises Bearer authentication when enterprise auth is enabled", () => {
    const gateway = createGateway({
      A2A_PUBLIC_BASE_URL: "https://gateway.example.test/base/",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
    });

    expect(gateway.agentCardJson.supportedInterfaces[0].url).toBe(
      `https://gateway.example.test/base${A2A_JSONRPC_PATH}`,
    );
    expect(gateway.agentCardJson.securitySchemes.bearerAuth).toEqual({
      httpAuthSecurityScheme: expect.objectContaining({
        scheme: "Bearer",
        bearerFormat: "token",
      }),
    });
    expect(gateway.agentCardJson.securityRequirements).toEqual([
      { schemes: { bearerAuth: {} } },
    ]);
  });

  it("rejects unsafe public URLs and non-text message parts", () => {
    expect(() => createGateway({
      A2A_PUBLIC_BASE_URL: "https://user:secret@gateway.example.test",
    })).toThrow("without credentials");

    expect(() => a2aGatewayInternals.readTextMessage({
      parts: [{
        content: { $case: "raw", value: new Uint8Array([1]) },
        mediaType: "application/octet-stream",
      }],
    })).toThrow("text/plain");
  });
});

describe("A2A gateway executor — fake-provider safety boundary", () => {
  function requestContext() {
    return {
      contextId: "ctx-1",
      taskId: "task-1",
      request: { metadata: {} },
      userMessage: {
        parts: [{ content: { $case: "text", value: "hello" }, mediaType: "text/plain" }],
      },
    };
  }

  it("rejects a result that is not proven fake-provider", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: { executionMode: "real", selectedProvider: "openai", outputText: "hi" },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(gatewayService);
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(requestContext(), eventBus))
      .rejects.toThrow("fake-provider proof");
  });

  it("completes when the gateway returns proven fake execution", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          executionMode: "fake",
          selectedProvider: "local-fake-provider",
          outputText: "fake reply",
        },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(gatewayService);
    const eventBus = { publish: vi.fn() };

    await executor.execute(requestContext(), eventBus);

    expect(eventBus.publish).toHaveBeenCalled();
    const allCalls = JSON.stringify(eventBus.publish.mock.calls);
    expect(allCalls).toContain("fake reply");
    expect(allCalls).toContain('"state":3'); // TASK_STATE_COMPLETED
  });
});
