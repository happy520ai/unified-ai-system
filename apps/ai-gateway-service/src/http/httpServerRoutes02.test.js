import { describe, expect, it } from "vitest";
import { dispatchHttpRoutes02 } from "./httpServerRoutes02.js";

function createEnvelopeContext(overrides = {}) {
  return {
    createErrorEnvelope: (code, message, details) => ({
      status: "error",
      error: {
        code,
        message,
        category: details?.category,
        retryable: details?.retryable ?? false,
        details: details?.details,
      },
    }),
    createOkEnvelope: (data, details) => ({
      status: "ok",
      data,
      meta: {
        requestId: details?.requestId,
        traceId: details?.traceId,
        createdAt: details?.startedAt ? new Date(details.startedAt).toISOString() : undefined,
        durationMs: details?.startedAt === undefined ? undefined : Date.now() - details.startedAt,
      },
    }),
    writeJson: (response, status, payload) => {
      response.status = status;
      response.payload = payload;
    },
    request: { method: "GET" },
    response: {
      status: undefined,
      payload: undefined,
    },
    url: { pathname: "/healthz" },
    startedAt: 0,
    rateLimiter: {},
    a2aGateway: {
      getTaskStoreHealth: () => ({
        mode: "memory",
        durable: false,
        required: false,
        available: true,
        reason: null,
      }),
    },
    resilienceMetrics: {
      snapshot: () => ({ currentInFlight: 1 }),
    },
    healthzInFlightThreshold: 80,
    healthzInFlightDegradationPercent: 80,
    createHealth: () => ({
      app: "ai-gateway-service",
      status: "ready",
      knowledge: { status: "ready" },
      workflow: { status: "ready" },
      workforce: { status: "ready" },
    }),
    createSetupReadiness: () => ({ status: "ready", phase: "test" }),
    application: {},
    enterpriseGovernanceService: {},
    ...overrides,
  };
}

describe("dispatchHttpRoutes02 healthz readiness", () => {
  it("returns draining readiness while liveness remains available", async () => {
    const lifecycle = {
      snapshot: () => ({ state: "draining", isReady: false, isLive: true, reason: "SIGTERM" }),
    };
    const readinessContext = createEnvelopeContext({
      gatewayLifecycle: lifecycle,
      url: { pathname: "/healthz" },
    });

    await dispatchHttpRoutes02(readinessContext);

    expect(readinessContext.response.status).toBe(503);
    expect(readinessContext.response.payload.error.details.readinessFailures).toContain("service-draining");

    const livenessContext = createEnvelopeContext({
      gatewayLifecycle: lifecycle,
      url: { pathname: "/livez" },
    });
    await dispatchHttpRoutes02(livenessContext);

    expect(livenessContext.response.status).toBe(200);
    expect(livenessContext.response.payload.data.status).toBe("alive");
  });

  it("returns 503 when in-flight saturation is reached", async () => {
    const context = createEnvelopeContext({
      resilienceMetrics: {
        snapshot: () => ({ currentInFlight: 90 }),
      },
    });
    context.response = {
      ...context.response,
      status: undefined,
      payload: undefined,
    };

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.status).toBe("error");
    expect(context.response.payload.error.code).toBe("service_unready");
    expect(context.response.payload.error.details.saturation.inFlight).toBe(90);
    expect(context.response.payload.error.details.saturation.threshold).toBe(80);
    expect(context.response.payload.error.details.readinessFailures).toContain("inflight-saturation");
  });

  it("returns unready when the gateway error circuit is open", async () => {
    const context = createEnvelopeContext({
      resilienceMetrics: {
        snapshot: () => ({ currentInFlight: 5, gatewayErrorCircuitState: "open" }),
      },
    });
    context.response = {
      ...context.response,
      status: undefined,
      payload: undefined,
    };

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.status).toBe("error");
    expect(context.response.payload.error.code).toBe("service_unready");
    expect(context.response.payload.error.details.readinessFailures).toContain("gateway-error-circuit");
  });

  it("returns unready when the gateway error circuit is half-open", async () => {
    const context = createEnvelopeContext({
      resilienceMetrics: {
        snapshot: () => ({ currentInFlight: 5, gatewayErrorCircuitState: "half-open" }),
      },
    });
    context.response = {
      ...context.response,
      status: undefined,
      payload: undefined,
    };

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.status).toBe("error");
    expect(context.response.payload.error.code).toBe("service_unready");
    expect(context.response.payload.error.details.readinessFailures).toContain("gateway-error-circuit");
  });

  it("returns unready when a required durable usage ledger degrades", async () => {
    const context = createEnvelopeContext({
      createHealth: () => ({
        app: "ai-gateway-service",
        status: "degraded",
        knowledge: { status: "ready" },
        workflow: { status: "ready" },
        workforce: { status: "ready" },
        usageLedger: {
          status: "degraded",
          requiredForRealProviders: true,
        },
      }),
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain("usage-ledger-unavailable");
  });

  it("returns unready when the central enterprise audit store degrades", async () => {
    const context = createEnvelopeContext({
      createHealth: () => ({
        app: "ai-gateway-service",
        status: "degraded",
        knowledge: { status: "ready" },
        workflow: { status: "ready" },
        workforce: { status: "ready" },
        enterprise: {
          status: "degraded",
          audit: {
            central: { status: "degraded", available: false },
          },
        },
      }),
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain(
      "audit-central-store-unavailable",
    );
  });

  it("returns ready payload when saturation is below threshold", async () => {
    const context = createEnvelopeContext({
      resilienceMetrics: {
        snapshot: () => ({ currentInFlight: 20 }),
      },
    });
    context.response = {
      ...context.response,
      status: undefined,
      payload: undefined,
    };

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(200);
    expect(context.response.payload.status).toBe("ok");
    expect(context.response.payload.data.status).toBe("ready");
    expect(context.response.payload.data.saturation.inFlight).toBe(20);
  });

  it("returns the same readiness semantics on /ready alias", async () => {
    const context = createEnvelopeContext({
      request: { method: "GET" },
      resilienceMetrics: {
        snapshot: () => ({ currentInFlight: 20 }),
      },
      url: { pathname: "/ready" },
    });
    context.response = {
      ...context.response,
      status: undefined,
      payload: undefined,
    };

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(200);
    expect(context.response.payload.status).toBe("ok");
    expect(context.response.payload.data.status).toBe("ready");
  });

  it("returns 503 when service readiness is degraded", async () => {
    const context = createEnvelopeContext({
      resilienceMetrics: {
        snapshot: () => ({ currentInFlight: 20 }),
      },
      createHealth: () => ({ status: "degraded" }),
    });
    context.response = {
      ...context.response,
      status: undefined,
      payload: undefined,
    };

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.status).toBe("error");
    expect(context.response.payload.error.code).toBe("service_unready");
    expect(context.response.payload.error.details.readinessFailures).toContain("service-dependency");
  });

  it("returns unready with a safe snapshot when the PostgreSQL idempotency store is unavailable", async () => {
    const context = createEnvelopeContext({
      idempotencyCoordinator: {
        checkHealth: async () => ({
          storeMode: "postgres",
          available: false,
          distributed: true,
          entries: 3,
          inFlight: 1,
          replayable: 1,
          tombstones: 1,
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain("idempotency-store-unavailable");
    expect(context.response.payload.error.details.idempotency).toMatchObject({
      storeMode: "postgres",
      available: false,
      distributed: true,
    });
    expect(context.response.payload.error.details.idempotency).not.toHaveProperty("connectionString");
  });

  it("returns unready with a redacted snapshot when required provider dispatch storage degrades", async () => {
    const context = createEnvelopeContext({
      application: {
        gatewayService: { runtimeConfig: { requireProviderDispatchGate: true } },
        providerDispatchGate: {
          status: {
            mode: "postgres",
            enabled: true,
            required: true,
            durable: true,
            distributed: true,
            centralRequired: true,
            ttlMs: 86_400_000,
            maxEntries: 100_000,
          },
          checkHealth: async () => ({
            mode: "postgres",
            enabled: true,
            required: true,
            durable: true,
            distributed: true,
            centralRequired: true,
            available: false,
            entries: 7,
            inFlight: 1,
            tombstones: 6,
            connectionString: "postgres://must-not-leak",
            hmacSecret: "must-not-leak",
          }),
        },
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures)
      .toContain("provider-dispatch-store-unavailable");
    expect(context.response.payload.error.details.providerDispatch).toMatchObject({
      mode: "postgres",
      enabled: true,
      required: true,
      available: false,
      entries: 7,
      tombstones: 6,
    });
    const serialized = JSON.stringify(context.response.payload.error.details.providerDispatch);
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("connectionString");
    expect(serialized).not.toContain("hmacSecret");
  });

  it("returns unready when the PostgreSQL rate-limit store is unavailable", async () => {
    const context = createEnvelopeContext({
      rateLimiter: {
        checkHealth: async () => ({
          storeMode: "postgres",
          available: false,
          distributed: true,
          activeBuckets: 2,
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain("rate-limit-store-unavailable");
    expect(context.response.payload.error.details.rateLimit).toMatchObject({
      storeMode: "postgres",
      available: false,
      distributed: true,
    });
  });

  it("returns unready with a redacted snapshot when the WebSocket lease store is unavailable", async () => {
    const context = createEnvelopeContext({
      webSocketConnectionLeaseManager: {
        checkHealth: async () => ({
          storeMode: "postgres",
          available: false,
          distributed: true,
          activeLocalLeases: 3,
          connectionString: "postgres://must-not-leak",
          namespace: "private-cluster-name",
          subjectHash: "must-not-leak",
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain("websocket-lease-store-unavailable");
    expect(context.response.payload.error.details.webSocketLease).toMatchObject({
      storeMode: "postgres",
      available: false,
      distributed: true,
      activeLocalLeases: 3,
    });
    expect(context.response.payload.error.details.webSocketLease).not.toHaveProperty("connectionString");
    expect(context.response.payload.error.details.webSocketLease).not.toHaveProperty("namespace");
    expect(context.response.payload.error.details.webSocketLease).not.toHaveProperty("subjectHash");
  });

  it("returns unready without exposing the A2A task-store path when its probe fails", async () => {
    const context = createEnvelopeContext({
      a2aGateway: {
        getTaskStoreHealth: () => ({
          mode: "sqlite",
          durable: true,
          required: true,
          available: false,
          reason: "store_unavailable",
          sqlitePath: "E:/private/a2a-tasks.sqlite",
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain(
      "a2a-task-store-unavailable",
    );
    expect(context.response.payload.error.details.a2aTaskStore).toMatchObject({
      mode: "sqlite",
      durable: true,
      available: false,
    });
    expect(context.response.payload.error.details.a2aTaskStore).not.toHaveProperty("sqlitePath");
  });

  it("returns unready with a redacted distributed Workforce claim-store snapshot", async () => {
    const context = createEnvelopeContext({
      application: {
        workforceExecutor: {
          getTaskClaimHealth: async () => ({
            mode: "postgres-fenced",
            distributed: true,
            available: false,
            activeClaims: 2,
            maxClaims: 2_000,
            connectionString: "postgresql://must-not-leak",
          }),
        },
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain(
      "workforce-claim-store-unavailable",
    );
    expect(context.response.payload.error.details.workforceClaimStore).toMatchObject({
      mode: "postgres-fenced",
      distributed: true,
      available: false,
      activeClaims: 2,
    });
    expect(context.response.payload.error.details.workforceClaimStore)
      .not.toHaveProperty("connectionString");
  });

  it("returns unready with a redacted central Workforce queue snapshot", async () => {
    const context = createEnvelopeContext({
      application: {
        workforceExecutor: {
          getTaskQueueHealth: async () => ({
            mode: "postgres-central-fenced",
            durable: true,
            distributed: true,
            available: false,
            atomicTerminalFence: true,
            totalQueued: 7,
            maxEntries: 3_000,
            connectionString: "postgresql://must-not-leak",
            namespace: "private-queue",
          }),
        },
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain(
      "workforce-task-queue-unavailable",
    );
    expect(context.response.payload.error.details.workforceTaskQueue).toMatchObject({
      mode: "postgres-central-fenced",
      distributed: true,
      available: false,
      totalQueued: 7,
      atomicTerminalFence: true,
    });
    expect(JSON.stringify(context.response.payload.error.details.workforceTaskQueue))
      .not.toContain("must-not-leak");
    expect(JSON.stringify(context.response.payload.error.details.workforceTaskQueue))
      .not.toContain("private-queue");
  });

  it("returns unready with redacted central Workforce execution-control state", async () => {
    const context = createEnvelopeContext({
      application: {
        workforceExecutor: {
          getExecutionControlHealth: async () => ({
            mode: "postgres-central",
            durable: true,
            distributed: true,
            centralRequired: true,
            available: false,
            approval: { available: false, activeApprovals: 3, maxApprovals: 100 },
            lifecycle: { available: true, activeExecutions: 2, maxExecutions: 100, maxStateBytes: 65536 },
            connectionString: "postgresql://must-not-leak",
            namespace: "private-control",
          }),
        },
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(503);
    expect(context.response.payload.error.details.readinessFailures).toContain(
      "workforce-execution-control-unavailable",
    );
    expect(context.response.payload.error.details.workforceExecutionControl).toMatchObject({
      mode: "postgres-central",
      distributed: true,
      available: false,
      approval: { activeApprovals: 3 },
      lifecycle: { activeExecutions: 2, maxStateBytes: 65536 },
    });
    const serialized = JSON.stringify(context.response.payload.error.details.workforceExecutionControl);
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("private-control");
  });
});

describe("dispatchHttpRoutes02 metrics readiness visibility", () => {
  it("awaits central usage statistics before rendering metrics", async () => {
    let metricsText = "";
    const context = createEnvelopeContext({
      application: {
        requestLogger: {
          getStats: async () => ({
            totalRequests: 2,
            avgLatencyMs: 25,
            errorRate: 0.5,
          }),
          getHealth: () => ({
            status: "ready",
            storeMode: "postgres",
            persistence: "postgres-central",
            available: true,
            rowCount: 4,
            maxRows: 1_000,
            totalWriteFailures: 0,
          }),
        },
      },
      response: {
        headersSent: false,
        writeHead() {},
        end(body) {
          metricsText = body;
        },
      },
      url: { pathname: "/metrics" },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsText).toContain("ai_gateway_requests_total 2");
    expect(metricsText).toContain('ai_gateway_usage_ledger_store_available{mode="postgres"} 1');
    expect(metricsText).toContain('ai_gateway_usage_ledger_rows{state="current"} 4');
  });

  it("includes readiness state and reasons in /metrics payload", async () => {
    let metricsText = "";
    let metricsStatus = undefined;
    const context = createEnvelopeContext({
      request: { method: "GET" },
      response: {
        status: undefined,
        payload: undefined,
        end(body) {
          metricsText = body;
          metricsStatus = 200;
        },
      },
      url: { pathname: "/metrics" },
      createHealth: () => ({
        status: "degraded",
        knowledge: { status: "not_ready" },
        workflow: { status: "ready" },
        workforce: { status: "ready" },
      }),
      createSetupReadiness: () => ({
        status: "ready",
        phase: "test",
      }),
      resilienceMetrics: {
        snapshot: () => ({
          readinessCheckCount: 5,
          readinessReadyChecks: 1,
          readinessDegradedChecks: 1,
          readinessFailureReasons: {
            knowledge: 1,
            "service-dependency": 1,
          },
          currentInFlight: 2,
          maxInFlightObserved: 2,
        }),
      },
      rateLimiter: {
        getStats() {
          return {
            activeBuckets: 1,
            routes: {
              "/healthz": { activeBuckets: 2 },
            },
          };
        },
      },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsStatus).toBe(200);
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"ready\"} 0");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"degraded\"} 1");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_failures 2");
    expect(metricsText).toContain('ai_gateway_gateway_readiness_failures{reason="service-dependency"} 1');
    expect(metricsText).toContain('ai_gateway_gateway_readiness_failures{reason="knowledge"} 1');
  });

  it("exports WebSocket lease availability and readiness without private lease fields", async () => {
    let metricsText = "";
    const context = createEnvelopeContext({
      response: {
        headersSent: false,
        writeHead() {},
        end(body) {
          metricsText = body;
        },
      },
      url: { pathname: "/metrics" },
      webSocketConnectionLeaseManager: {
        checkHealth: async () => ({
          available: false,
          activeLocalLeases: 2,
          acquired: 7,
          denied: 3,
          lost: 1,
          released: 4,
          leaseMs: 30_000,
          localSafetyMs: 1_000,
          namespace: "private-cluster-name",
          connectionString: "postgres://must-not-leak",
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsText).toContain('ai_gateway_gateway_readiness_failures{reason="websocket-lease-store-unavailable"} 1');
    expect(metricsText).toContain('ai_gateway_websocket_lease_store_available{mode="postgres"} 0');
    expect(metricsText).toContain("ai_gateway_websocket_lease_active_local 2");
    expect(metricsText).not.toContain("private-cluster-name");
    expect(metricsText).not.toContain("postgres://must-not-leak");
  });

  it("adds saturation as readiness failure reason in /metrics when in-flight is high", async () => {
    let metricsText = "";
    let metricsStatus = undefined;
    const context = createEnvelopeContext({
      request: { method: "GET" },
      response: {
        status: undefined,
        payload: undefined,
        end(body) {
          metricsText = body;
          metricsStatus = 200;
        },
      },
      url: { pathname: "/metrics" },
      healthzInFlightThreshold: 50,
      resilienceMetrics: {
        snapshot: () => ({
          currentInFlight: 50,
          readinessCheckCount: 4,
          readinessReadyChecks: 1,
          readinessDegradedChecks: 3,
          readinessFailureReasons: {
            "inflight-saturation": 3,
          },
        }),
      },
      rateLimiter: {
        getStats() {
          return {
            activeBuckets: 0,
            routes: {},
          };
        },
      },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsStatus).toBe(200);
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"ready\"} 0");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"degraded\"} 1");
    expect(metricsText).toContain('ai_gateway_gateway_readiness_failures{reason="inflight-saturation"} 1');
  });

  it("adds gateway circuit reason in /metrics when circuit is open", async () => {
    let metricsText = "";
    let metricsStatus = undefined;
    const context = createEnvelopeContext({
      request: { method: "GET" },
      response: {
        status: undefined,
        payload: undefined,
        end(body) {
          metricsText = body;
          metricsStatus = 200;
        },
      },
      url: { pathname: "/metrics" },
      healthzInFlightThreshold: 80,
      resilienceMetrics: {
        snapshot: () => ({
          currentInFlight: 10,
          readinessCheckCount: 1,
          readinessReadyChecks: 0,
          readinessDegradedChecks: 1,
          readinessFailureReasons: {
            "gateway-error-circuit": 1,
          },
          gatewayErrorCircuitState: "open",
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsStatus).toBe(200);
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"ready\"} 0");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"degraded\"} 1");
    expect(metricsText).toContain('ai_gateway_gateway_readiness_failures{reason="gateway-error-circuit"} 1');
    expect(metricsText).toContain("ai_gateway_gateway_error_circuit_state{state=\"open\"} 1");
  });

  it("adds half-open readiness degradation in /metrics when circuit is half-open", async () => {
    let metricsText = "";
    let metricsStatus = undefined;
    const context = createEnvelopeContext({
      request: { method: "GET" },
      response: {
        status: undefined,
        payload: undefined,
        end(body) {
          metricsText = body;
          metricsStatus = 200;
        },
      },
      url: { pathname: "/metrics" },
      healthzInFlightThreshold: 120,
      resilienceMetrics: {
        snapshot: () => ({
          currentInFlight: 10,
          readinessCheckCount: 2,
          readinessReadyChecks: 0,
          readinessDegradedChecks: 2,
          readinessFailureReasons: {
            "gateway-error-circuit": 1,
          },
          gatewayErrorCircuitState: "half-open",
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsStatus).toBe(200);
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"ready\"} 0");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"degraded\"} 1");
    expect(metricsText).toContain('ai_gateway_gateway_readiness_failures{reason="gateway-error-circuit"} 1');
    expect(metricsText).toContain("ai_gateway_gateway_error_circuit_state{state=\"half-open\"} 1");
  });

  it("keeps readiness reason consistency between /healthz and /metrics for half-open circuit", async () => {
    const sharedSnapshot = {
      currentInFlight: 10,
      gatewayErrorCircuitState: "half-open",
      readinessCheckCount: 2,
      readinessReadyChecks: 0,
      readinessDegradedChecks: 2,
      readinessFailureReasons: {
        "gateway-error-circuit": 1,
      },
    };

    const healthzContext = createEnvelopeContext({
      request: { method: "GET" },
      url: { pathname: "/healthz" },
      resilienceMetrics: {
        snapshot: () => sharedSnapshot,
      },
    });
    healthzContext.response = {
      ...healthzContext.response,
      status: undefined,
      payload: undefined,
    };

    await dispatchHttpRoutes02(healthzContext);
    expect(healthzContext.response.status).toBe(503);
    expect(healthzContext.response.payload.status).toBe("error");
    expect(healthzContext.response.payload.error.details.readinessFailures).toContain("gateway-error-circuit");

    let metricsText = "";
    let metricsStatus = undefined;
    const metricsContext = createEnvelopeContext({
      request: { method: "GET" },
      response: {
        status: undefined,
        payload: undefined,
        end(body) {
          metricsText = body;
          metricsStatus = 200;
        },
      },
      url: { pathname: "/metrics" },
      resilienceMetrics: {
        snapshot: () => sharedSnapshot,
      },
    });

    await dispatchHttpRoutes02(metricsContext);

    expect(metricsStatus).toBe(200);
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"ready\"} 0");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"degraded\"} 1");
    expect(metricsText).toContain('ai_gateway_gateway_readiness_failures{reason="gateway-error-circuit"} 1');
    expect(metricsText).toContain("ai_gateway_gateway_error_circuit_state{state=\"half-open\"} 1");
  });

  it("emits ready state in /metrics when system is healthy", async () => {
    let metricsText = "";
    let metricsStatus = undefined;
    const context = createEnvelopeContext({
      request: { method: "GET" },
      response: {
        status: undefined,
        payload: undefined,
        end(body) {
          metricsText = body;
          metricsStatus = 200;
        },
      },
      url: { pathname: "/metrics" },
      resilienceMetrics: {
        snapshot: () => ({
          readinessCheckCount: 3,
          readinessReadyChecks: 3,
          readinessDegradedChecks: 0,
          readinessFailureReasons: {},
          currentInFlight: 1,
          maxInFlightObserved: 1,
        }),
      },
      rateLimiter: {
        getStats() {
          return {
            activeBuckets: 0,
            routes: {},
          };
        },
      },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsStatus).toBe(200);
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"ready\"} 1");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_status{state=\"degraded\"} 0");
    expect(metricsText).toContain("ai_gateway_gateway_readiness_failures 0");
  });

  it("exports PostgreSQL idempotency availability and bounded state counts", async () => {
    let metricsText = "";
    const context = createEnvelopeContext({
      request: { method: "GET" },
      response: {
        headersSent: false,
        writeHead() {},
        end(body) { metricsText = body; },
      },
      url: { pathname: "/metrics" },
      idempotencyCoordinator: {
        checkHealth: async () => ({
          storeMode: "postgres",
          available: true,
          distributed: true,
          entries: 8,
          inFlight: 2,
          replayable: 4,
          tombstones: 2,
          statsUpdatedAt: Date.now(),
        }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(metricsText).toContain('ai_gateway_idempotency_store_available{mode="postgres"} 1');
    expect(metricsText).toContain('ai_gateway_idempotency_entries{mode="postgres",state="total"} 8');
    expect(metricsText).toContain('ai_gateway_idempotency_entries{mode="postgres",state="in_flight"} 2');
    expect(metricsText).toContain('ai_gateway_idempotency_entries{mode="postgres",state="replayable"} 4');
  });
});

describe("dispatchHttpRoutes02 usage/my-key", () => {
  it("returns the caller's own virtual key usage state", async () => {
    const describeUsage = () => ({
      keyId: "fp123",
      role: "operator",
      usage: { tokensUsed: 120, limitTokens: 1000 },
    });
    const context = createEnvelopeContext({
      url: { pathname: "/usage/my-key" },
      request: { method: "GET", enterpriseIdentity: { apiKeyFingerprint: "fp123", tenantId: "default" } },
      enterpriseGovernanceService: {
        getApiKeyManager: () => ({ describeUsage }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(200);
    expect(context.response.payload.data.enabled).toBe(true);
    expect(context.response.payload.data.keyFingerprint).toBe("fp123");
    expect(context.response.payload.data.key.usage.tokensUsed).toBe(120);
  });

  it("rejects non virtual-key callers", async () => {
    const context = createEnvelopeContext({
      url: { pathname: "/usage/my-key" },
      request: { method: "GET", enterpriseIdentity: { tenantId: "default" } },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(403);
    expect(context.response.payload.error.code).toBe("USAGE_MY_KEY_VIRTUAL_KEY_REQUIRED");
  });

  it("reports revoked keys as not found", async () => {
    const context = createEnvelopeContext({
      url: { pathname: "/usage/my-key" },
      request: { method: "GET", enterpriseIdentity: { apiKeyFingerprint: "gone", tenantId: "default" } },
      enterpriseGovernanceService: {
        getApiKeyManager: () => ({ describeUsage: () => null }),
      },
    });

    await dispatchHttpRoutes02(context);

    expect(context.response.status).toBe(404);
    expect(context.response.payload.error.code).toBe("USAGE_MY_KEY_NOT_FOUND");
  });
});
