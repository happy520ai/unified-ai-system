import { describe, expect, it, vi } from "vitest";
import { request } from "node:http";
import { createGatewayHttpServer } from "./httpServer.js";

function createGatewayApplication(overrides = {}) {
  const authorize = vi.fn((incomingRequest) => {
    if (incomingRequest.url === "/chat") {
      throw new Error("simulated request-time failure");
    }
    return {
      allowed: true,
      identity: { userId: "operator" },
      permission: "dashboard:read",
      statusCode: 200,
    };
  });

  const application = {
    runtimeEnv: {
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD: "1",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD: "1",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS: "60000",
      AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS: "1",
    },
    config: {
      aiGatewayService: {
        providerMode: "fake-provider",
        realProviderEnabled: false,
      },
    },
    knowledgeService: {
      getHealth: () => ({ status: "ready" }),
    },
    knowledgeInfra: {
      getReadiness: () => ({ status: "ready" }),
    },
    workflowService: {
      getHealth: () => ({ status: "ready" }),
    },
    workforceService: {
      getHealth: () => ({ status: "ready" }),
    },
    enterpriseGovernanceService: {
      getHealth: () => ({ status: "ready" }),
      authorize,
      recordAudit: () => undefined,
    },
    gatewayService: {
      getProviderDescriptors: () => [],
    },
    requestLogger: {
      getStats: () => ({}),
    },
    healthScorer: {
      getAllScores: () => ({}),
    },
    userExperienceService: {
      getDashboard: () => ({ route: "/dashboard/status" }),
    },
  };

  return {
    ...application,
    ...overrides,
    runtimeEnv: {
      ...application.runtimeEnv,
      ...(overrides.runtimeEnv ?? {}),
    },
    enterpriseGovernanceService: {
      ...application.enterpriseGovernanceService,
      ...(overrides.enterpriseGovernanceService ?? {}),
    },
  };
}

async function sendRequest(port, path, method = "GET", body) {
  const payload = method === "POST" && body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : "";
  const headers = {
    host: `127.0.0.1:${port}`,
  };
  if (method === "POST" && body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    const req = request({
      host: "127.0.0.1",
      port,
      path,
      method,
      headers,
    }, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk.toString("utf8");
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody,
        });
      });
    });
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

describe("gateway error circuit bypass routes", () => {
  it("keeps readiness and metrics endpoints reachable while gateway circuit is open", async () => {
    const server = createGatewayHttpServer(createGatewayApplication({
      runtimeEnv: {
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS: "60000",
      },
    }));

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const firstFailure = await sendRequest(address.port, "/provider-config/save", "POST", "{}");
      expect(firstFailure.statusCode).toBeGreaterThanOrEqual(500);

      const metrics = await sendRequest(address.port, "/metrics");
      expect(metrics.statusCode).toBe(200);
      expect(metrics.body).toContain('ai_gateway_gateway_error_circuit_state{state="open"} 1');

      const healthz = await sendRequest(address.port, "/healthz");
      expect(healthz.statusCode).toBe(503);

      const healthzPayload = JSON.parse(healthz.body);
      const healthzReadinessFailures = healthzPayload?.error?.details?.readinessFailures ?? [];
      expect(healthzPayload?.error?.code).toBe("service_unready");
      expect(healthzReadinessFailures).toContain("gateway-error-circuit");

      const health = await sendRequest(address.port, "/health");
      expect(health.statusCode).toBe(200);
      const healthPayload = JSON.parse(health.body);
      expect(healthPayload.status).toBe("ok");

      const ready = await sendRequest(address.port, "/ready");
      expect(ready.statusCode).toBe(503);
      const readyPayload = JSON.parse(ready.body);
      const readyReadinessFailures = readyPayload?.error?.details?.readinessFailures ?? [];
      expect(readyPayload?.error?.code).toBe("service_unready");
      expect(readyReadinessFailures).toContain("gateway-error-circuit");

      const rejectedChat = await sendRequest(address.port, "/chat");
      expect(rejectedChat.statusCode).toBe(503);
      expect(rejectedChat.headers).toHaveProperty("retry-after");
      const rejectedPayload = JSON.parse(rejectedChat.body);
      expect(rejectedPayload?.error?.code).toBe("gateway_unavailable");
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("keeps bypass probes read-only and closes after successful non-bypass probes", async () => {
    const server = createGatewayHttpServer(createGatewayApplication({
      runtimeEnv: {
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS: "50",
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD: "2",
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS: "2",
      },
    }));

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const firstFailure = await sendRequest(address.port, "/provider-config/save", "POST", "{}");
      expect(firstFailure.statusCode).toBeGreaterThanOrEqual(500);

      const openHealthz = await sendRequest(address.port, "/healthz");
      expect(openHealthz.statusCode).toBe(503);
      const openHealthzPayload = JSON.parse(openHealthz.body);
      expect(openHealthzPayload?.error?.code).toBe("service_unready");
      expect(openHealthzPayload?.error?.details?.readinessFailures).toContain("gateway-error-circuit");

      await new Promise((resolve) => {
        setTimeout(resolve, 120);
      });

      const firstRecovery = await sendRequest(address.port, "/dashboard/status");
      expect(firstRecovery.statusCode).toBe(200);

      const halfOpenHealthz = await sendRequest(address.port, "/healthz");
      expect(halfOpenHealthz.statusCode).toBe(503);

      const halfOpenMetrics = await sendRequest(address.port, "/metrics");
      expect(halfOpenMetrics.body).toContain('ai_gateway_gateway_error_circuit_state{state="half-open"} 1');

      const secondRecovery = await sendRequest(address.port, "/dashboard/status");
      expect(secondRecovery.statusCode).toBe(200);

      const recoveredHealthz = await sendRequest(address.port, "/healthz");
      expect(recoveredHealthz.statusCode).toBe(200);

      const recoveredPayload = JSON.parse(recoveredHealthz.body);
      expect(recoveredPayload.status).toBe("ok");
      expect(recoveredPayload.data?.status).toBe("ready");

      const metrics = await sendRequest(address.port, "/metrics");
      expect(metrics.statusCode).toBe(200);
      expect(metrics.body).toContain('ai_gateway_gateway_error_circuit_state{state="open"} 0');
      expect(metrics.body).toContain("ai_gateway_gateway_error_circuit_state{state=\"closed\"} 1");
      expect(metrics.body).toContain('ai_gateway_gateway_error_circuit_success_total 2');
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("opens on a retryable provider failure returned as an HTTP response", async () => {
    const execute = vi.fn(async () => ({
      success: false,
      code: "FAKE_PROVIDER_RETRYABLE_FAILURE",
      error: {
        code: "FAKE_PROVIDER_RETRYABLE_FAILURE",
        retryable: true,
      },
    }));
    const server = createGatewayHttpServer(createGatewayApplication({
      gatewayService: {
        getProviderDescriptors: () => [],
        execute,
      },
      enterpriseGovernanceService: {
        authorize: () => ({
          allowed: true,
          identity: { userId: "operator" },
          permission: "chat:use",
          statusCode: 200,
        }),
      },
    }));

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const failedChat = await sendRequest(address.port, "/gateway/route", "POST", { prompt: "test" });
      expect(failedChat.statusCode).toBe(502);
      expect(execute).toHaveBeenCalledTimes(1);

      const metrics = await sendRequest(address.port, "/metrics");
      expect(metrics.body).toContain('ai_gateway_gateway_error_circuit_state{state="open"} 1');

      const blockedChat = await sendRequest(address.port, "/gateway/route", "POST", { prompt: "test" });
      expect(blockedChat.statusCode).toBe(503);
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("supports additional configured bypass routes for circuit-open mode", async () => {
    const server = createGatewayHttpServer(createGatewayApplication({
      runtimeEnv: {
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS: "60000",
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES: " /dashboard/status/ , /healthz",
      },
    }));

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const firstFailure = await sendRequest(address.port, "/provider-config/save", "POST", "{}");
      expect(firstFailure.statusCode).toBeGreaterThanOrEqual(500);

      const dashboardStatus = await sendRequest(address.port, "/dashboard/status");
      expect(dashboardStatus.statusCode).toBe(200);
      const dashboardPayload = JSON.parse(dashboardStatus.body);
      expect(dashboardPayload.status).toBe("ok");
      expect(dashboardPayload.data?.route).toBe("/dashboard/status");

      const extraReadiness = await sendRequest(address.port, "/healthz");
      expect(extraReadiness.statusCode).toBe(503);
      const extraReadinessPayload = JSON.parse(extraReadiness.body);
      expect(extraReadinessPayload?.error?.code).toBe("service_unready");
      expect(extraReadinessPayload?.error?.details?.readinessFailures).toContain("gateway-error-circuit");
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("normalizes bypass route configuration with whitespace, trailing slash, and duplicate slashes", async () => {
    const server = createGatewayHttpServer(createGatewayApplication({
      runtimeEnv: {
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS: "60000",
        AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES: " //dashboard/status/?probe=1,  , /healthz//, /dashboard/status ",
      },
    }));

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const firstFailure = await sendRequest(address.port, "/provider-config/save", "POST", "{}");
      expect(firstFailure.statusCode).toBeGreaterThanOrEqual(500);

      const dashboardStatus = await sendRequest(address.port, "/dashboard/status");
      expect(dashboardStatus.statusCode).toBe(200);
      const dashboardPayload = JSON.parse(dashboardStatus.body);
      expect(dashboardPayload.status).toBe("ok");
      expect(dashboardPayload.data?.route).toBe("/dashboard/status");

      const ready = await sendRequest(address.port, "/ready");
      expect(ready.statusCode).toBe(503);
      const readyPayload = JSON.parse(ready.body);
      expect(readyPayload?.error?.details?.readinessFailures).toContain("gateway-error-circuit");

      const blockedRoute = await sendRequest(address.port, "/provider-config/save");
      expect(blockedRoute.statusCode).toBe(503);
      expect(blockedRoute.headers).toHaveProperty("retry-after");
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
