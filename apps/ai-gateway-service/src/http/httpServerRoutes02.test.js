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
});

describe("dispatchHttpRoutes02 metrics readiness visibility", () => {
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
    expect(metricsText).toContain('ai_gateway_idempotency_entries{mode="postgres",state="tombstone"} 2');
  });
});
