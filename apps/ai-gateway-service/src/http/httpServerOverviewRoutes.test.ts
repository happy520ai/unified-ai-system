import { describe, expect, it } from "vitest";

import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";

import { dispatchHttpRoutes02 } from "./httpServerRoutes02.js";
import { isPublicRoute } from "./routeAccessPolicy.js";
import {
  UNKNOWN_ROUTE_PERMISSION,
  shouldRejectUnmappedRoute,
} from "./runtimeRouteAccessManifest.ts";
import { resolvePermission } from "./utils/enterpriseUtils.js";
import { writeJson } from "./utils/responseUtils.js";

type FakeResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  ended: boolean;
  setHeader: (name: string, value: string) => void;
  writeHead: (statusCode: number, headers?: Record<string, string>) => void;
  end: (raw?: string) => void;
};

function createFakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 0,
    headers: {},
    body: "",
    ended: false,
    setHeader(name: string, value: string) {
      response.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode: number, headers?: Record<string, string>) {
      response.statusCode = statusCode;
      for (const [name, value] of Object.entries(headers ?? {})) {
        response.headers[name.toLowerCase()] = value;
      }
    },
    end(raw?: string) {
      response.ended = true;
      response.body += raw ?? "";
    },
  };
  return response;
}

function createContext(pathname: string) {
  const response = createFakeResponse();
  return {
    response,
    context: {
      request: { method: "GET", headers: {}, enterpriseIdentity: { tenantId: "tenant-a" } },
      response,
      url: new URL("http://127.0.0.1:3100" + pathname),
      startedAt: Date.now(),
      writeJson,
      createOkEnvelope,
      createErrorEnvelope,
      application: {
        gatewayService: {
          runtimeConfig: { providerMode: "fake", realProviderEnabled: false },
        },
        requestLogger: {
          getStats: async () => ({ totalRequests: 5 }),
        },
      },
      createHealth: () => ({ status: "ok" }),
      createSetupReadiness: () => ({ status: "ready" }),
      resilienceMetrics: {
        snapshot: () => ({
          totalRequests: 5,
          currentInFlight: 1,
          gatewayErrorCircuitState: "closed",
        }),
      },
    },
  };
}

describe("terminal-first boundary", () => {
  it("keeps GET /console unmapped so the public-clone invariant holds", () => {
    // The public-clone runtime gate requires 404 on GET /ui and GET /console.
    // A registered protected route answers 403 for the unauthenticated local
    // preview identity instead, so serving a browser console page would need
    // an explicit owner revision of that invariant first.
    expect(resolvePermission("GET", "/console")).toBe(UNKNOWN_ROUTE_PERMISSION);
    expect(isPublicRoute("/console")).toBe(false);
    expect(
      shouldRejectUnmappedRoute({
        isPublic: false,
        permission: resolvePermission("GET", "/console"),
        authorizationAllowed: true,
      }),
    ).toBe(true);
  });
});

describe("GET /api/overview", () => {
  it("returns a compact JSON snapshot envelope", async () => {
    const { context, response } = createContext("/api/overview");
    await dispatchHttpRoutes02(context);
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.status).toBe("ok");
    expect(payload.data.providerMode).toBe("fake");
    expect(payload.data.realProviderEnabled).toBe(false);
    expect(payload.data.health.status).toBe("ok");
    expect(payload.data.readiness.status).toBe("ready");
    expect(payload.data.totalRequests).toBe(5);
    expect(payload.data.currentInFlight).toBe(1);
    expect(payload.data.gatewayErrorCircuitState).toBe("closed");
  });

  it("falls back to resilience metrics when request stats are unavailable", async () => {
    const { context, response } = createContext("/api/overview");
    (context.application.requestLogger as { getStats?: unknown }).getStats = undefined;
    await dispatchHttpRoutes02(context);
    const payload = JSON.parse(response.body);
    expect(payload.status).toBe("ok");
    expect(payload.data.totalRequests).toBe(5);
  });

  it("requires authorization and stays mapped in the runtime manifest", () => {
    expect(isPublicRoute("/api/overview")).toBe(false);
    expect(resolvePermission("GET", "/api/overview")).toBe("dashboard:read");
    expect(
      shouldRejectUnmappedRoute({
        isPublic: false,
        permission: resolvePermission("GET", "/api/overview"),
        authorizationAllowed: true,
      }),
    ).toBe(false);
    expect(UNKNOWN_ROUTE_PERMISSION).not.toBe(resolvePermission("GET", "/api/overview"));
  });
});
