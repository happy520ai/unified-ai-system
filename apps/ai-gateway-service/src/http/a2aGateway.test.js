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
    expect(gateway.agentCardJson.version).toBe("0.5.0");
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
  function requestContext({ executionMode, permissions } = {}) {
    return {
      contextId: "ctx-1",
      taskId: "task-1",
      request: {
        metadata: executionMode ? { unifiedAi: { executionMode } } : {},
      },
      context: {
        tenant: "tenant-a",
        user: {
          isAuthenticated: true,
          userName: "test-user",
          permissions: permissions ?? [],
        },
      },
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

  it("denies client-selected workforce mode without server-derived workflow permission", async () => {
    const gatewayService = { execute: vi.fn() };
    const workforceExecutor = { execute: vi.fn() };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      workforceExecutor,
    );
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(
      requestContext({ executionMode: "workforce", permissions: ["chat:use"] }),
      eventBus,
    )).rejects.toMatchObject({
      code: "a2a_workforce_permission_required",
    });
    expect(workforceExecutor.execute).not.toHaveBeenCalled();
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("allows workforce mode only with workflow:run permission", async () => {
    const gatewayService = { execute: vi.fn() };
    const workforceExecutor = {
      execute: vi.fn(async () => ({
        goal: "hello",
        status: "completed",
        llmDriven: false,
        roleOutputs: { reviewer: { summary: "reviewed" } },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      workforceExecutor,
    );
    const eventBus = { publish: vi.fn() };

    await executor.execute(
      requestContext({ executionMode: "workforce", permissions: ["chat:use", "workflow:run"] }),
      eventBus,
    );

    expect(workforceExecutor.execute).toHaveBeenCalledOnce();
    expect(gatewayService.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(eventBus.publish.mock.calls)).toContain("reviewed");
  });

  it("acquires and validates a fenced lease without exposing its token", async () => {
    const order = [];
    const lease = {
      mode: "postgres-fenced",
      token: "raw-lease-token-must-not-leak",
      fencingToken: "42",
      expiresAt: "2026-08-24T00:05:00.000Z",
      identity: {
        planId: "opaque-plan",
        taskId: "task-1",
        agentId: "instance-1",
        fencingToken: "42",
      },
    };
    const leaseManager = {
      status: {
        enabled: true,
        mode: "postgres-fenced",
        heartbeatMs: 60_000,
      },
      acquire: vi.fn(async () => {
        order.push("acquire");
        return { success: true, lease };
      }),
      validate: vi.fn(async () => {
        order.push("validate");
        return { success: true, code: "valid" };
      }),
      renew: vi.fn(async () => ({ success: true, code: "renewed" })),
      release: vi.fn(async () => {
        order.push("release");
        return { success: true, code: "released" };
      }),
      revokeForTask: vi.fn(),
    };
    const gatewayService = {
      execute: vi.fn(async () => {
        order.push("execute");
        return {
          success: true,
          data: {
            executionMode: "fake",
            selectedProvider: "local-fake-provider",
            selectedModel: "local-fake-model",
            outputText: "fenced fake reply",
          },
        };
      }),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
    );
    const eventBus = { publish: vi.fn() };

    await executor.execute(requestContext(), eventBus);

    expect(leaseManager.acquire).toHaveBeenCalledWith({
      taskId: "task-1",
      scope: { tenant: "tenant-a", owner: "test-user" },
    });
    expect(order).toEqual(["acquire", "validate", "execute", "validate", "release"]);
    const published = JSON.stringify(eventBus.publish.mock.calls);
    expect(published).toContain("postgres-fenced");
    expect(published).not.toContain(lease.token);
    expect(published).not.toContain('"fencingToken":"42"');
  });

  it("rejects a duplicate active execution before calling the gateway", async () => {
    const gatewayService = { execute: vi.fn() };
    const leaseManager = {
      status: { enabled: true, mode: "postgres-fenced", heartbeatMs: 60_000 },
      acquire: vi.fn(async () => ({
        success: false,
        code: "A2A_EXECUTION_ALREADY_ACTIVE",
        reason: "already active",
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
    );
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(requestContext(), eventBus)).rejects.toMatchObject({
      code: "A2A_EXECUTION_ALREADY_ACTIVE",
    });
    expect(gatewayService.execute).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("does not publish completion after the execution lease is lost", async () => {
    let validations = 0;
    const lease = {
      mode: "postgres-fenced",
      token: "lease-token",
      fencingToken: "9",
      identity: {},
    };
    const leaseManager = {
      status: { enabled: true, mode: "postgres-fenced", heartbeatMs: 60_000 },
      acquire: vi.fn(async () => ({ success: true, lease })),
      validate: vi.fn(async () => {
        validations += 1;
        return validations === 1
          ? { success: true, code: "valid" }
          : { success: false, code: "lost" };
      }),
      renew: vi.fn(),
      release: vi.fn(async () => ({ success: true, code: "released" })),
    };
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          executionMode: "fake",
          selectedProvider: "local-fake-provider",
          outputText: "must not commit",
        },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
    );
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(requestContext(), eventBus)).rejects.toMatchObject({
      code: "A2A_EXECUTION_LEASE_LOST",
    });
    const published = JSON.stringify(eventBus.publish.mock.calls);
    expect(published).not.toContain("must not commit");
    expect(published).not.toContain('"state":3');
  });

  it("uses server-derived cancellation scope to revoke a remote lease", async () => {
    const leaseManager = {
      status: { enabled: true, mode: "postgres-fenced", heartbeatMs: 60_000 },
      revokeForTask: vi.fn(async () => ({ success: true, code: "revoked" })),
    };
    const taskStore = {
      load: vi.fn(async () => ({ id: "task-1", contextId: "ctx-remote" })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      { execute: vi.fn() },
      null,
      leaseManager,
      taskStore,
    );
    const eventBus = { publish: vi.fn() };
    const context = requestContext().context;
    executor.prepareCancellationContext("task-1", context);

    await executor.cancelTask("task-1", eventBus);

    expect(leaseManager.revokeForTask).toHaveBeenCalledWith({
      taskId: "task-1",
      scope: { tenant: "tenant-a", owner: "test-user" },
      reason: "A2A client cancellation",
    });
    expect(taskStore.load).toHaveBeenCalledWith("task-1", context);
    expect(JSON.stringify(eventBus.publish.mock.calls)).toContain("ctx-remote");
    expect(JSON.stringify(eventBus.publish.mock.calls)).toContain('"state":5');
  });

  it("defers lease release to the atomic terminal store and finalizes after commit", async () => {
    const lease = {
      mode: "postgres-fenced",
      token: "atomic-token",
      fencingToken: "51",
      identity: {
        planId: "opaque-plan",
        taskId: "task-1",
        agentId: "instance-1",
        fencingToken: "51",
      },
    };
    const leaseManager = {
      status: {
        enabled: true,
        mode: "postgres-fenced",
        heartbeatMs: 60_000,
        atomicTerminalFence: true,
      },
      acquire: vi.fn(async () => ({ success: true, lease })),
      validate: vi.fn(async () => ({ success: true, code: "valid" })),
      renew: vi.fn(async () => ({ success: true, code: "renewed" })),
      release: vi.fn(async () => ({ success: true, code: "released" })),
    };
    let binding;
    let terminalFinalize = Promise.resolve();
    const taskStoreControl = {
      store: {},
      status: { atomicTerminalFence: true },
      checkHealth: vi.fn(async () => ({ available: true })),
      bindExecutionLease: vi.fn((input) => {
        binding = input;
      }),
      markExecutionFinished: vi.fn(),
    };
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          executionMode: "fake",
          selectedProvider: "local-fake-provider",
          outputText: "atomically fenced",
        },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
      taskStoreControl,
    );
    const eventBus = {
      publish: vi.fn((event) => {
        if (event?.kind === "statusUpdate" && event.data?.status?.state === 3) {
          terminalFinalize = Promise.resolve(binding.finalize(true));
        }
      }),
    };

    await executor.execute(requestContext(), eventBus);
    await terminalFinalize;

    expect(taskStoreControl.checkHealth).toHaveBeenCalled();
    expect(taskStoreControl.bindExecutionLease).toHaveBeenCalledWith(expect.objectContaining({
      taskId: "task-1",
      scope: { tenant: "tenant-a", owner: "test-user" },
      lease,
    }));
    expect(taskStoreControl.markExecutionFinished).toHaveBeenCalled();
    expect(leaseManager.release).not.toHaveBeenCalled();
  });

  it("uses the atomic task-store path for cross-replica cancellation", async () => {
    const persisted = {
      id: "task-1",
      contextId: "ctx-remote",
      status: { state: 2, timestamp: "2026-08-24T00:00:00.000Z" },
      history: [],
      artifacts: [],
    };
    const taskStoreControl = {
      store: { load: vi.fn(async () => persisted) },
      status: { atomicTerminalFence: true },
      cancelTaskAtomically: vi.fn(async (_taskId, _context, cancellationStatus) => ({
        ...persisted,
        status: cancellationStatus,
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      { execute: vi.fn() },
      null,
      { status: { enabled: true, atomicTerminalFence: true } },
      taskStoreControl,
    );
    const eventBus = { publish: vi.fn(), finished: vi.fn() };
    const context = requestContext().context;

    const cancelled = await executor.cancelTaskAtomically("task-1", context, eventBus);

    expect(taskStoreControl.cancelTaskAtomically).toHaveBeenCalledWith(
      "task-1",
      context,
      expect.objectContaining({ state: 5 }),
    );
    expect(cancelled).toMatchObject({ id: "task-1", status: { state: 5 } });
    expect(eventBus.publish).toHaveBeenCalled();
    expect(eventBus.finished).toHaveBeenCalled();
  });

  it("routes cancellation through the atomic boundary even without a local event bus", async () => {
    const cancelledTask = {
      id: "task-remote",
      contextId: "ctx-remote",
      status: { state: 5, timestamp: "2026-08-24T00:00:00.000Z" },
      history: [],
      artifacts: [],
    };
    const executor = {
      supportsAtomicCancellation: () => true,
      cancelTaskAtomically: vi.fn(async () => cancelledTask),
    };
    const handler = new a2aGatewayInternals.ContextAwareA2ARequestHandler(
      { capabilities: {} },
      { load: vi.fn(), save: vi.fn(), list: vi.fn() },
      executor,
    );
    const context = requestContext().context;

    await expect(handler.cancelTask({ id: "task-remote" }, context))
      .resolves.toBe(cancelledTask);
    expect(executor.cancelTaskAtomically).toHaveBeenCalledWith(
      "task-remote",
      context,
      undefined,
    );
  });
});
