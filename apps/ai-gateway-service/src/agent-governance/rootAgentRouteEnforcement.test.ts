import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "./toolProxy.ts";
import { createWorkforceRoutes } from "../http/workforceRoutes.js";
import { dispatchForgeRoutes } from "../http/forgeRoutes.js";

const SECRET = "root-route-enforcement-test-secret-0123456789";
const CTX = { tenantId: "tenant-a", userId: "owner-a", permissions: ["*"] };

async function governedChildFixture() {
  const dataDir = await mkdtemp(join(tmpdir(), "root-route-enforcement-"));
  const service = createAgentGovernanceService({
    dataDir,
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
    },
  });
  const root = await service.generateAgent({
    name: "root-orchestrator",
    task: "delegate bounded orchestration",
    requestedTools: ["workforce_execute", "forge_orchestrate"],
    ttlSeconds: 3600,
    parentAgentId: null,
    instanceRules: { limits: { maxChildrenPerAgent: 1 } },
  }, CTX);
  const child = await service.generateAgent({
    name: "child-orchestrator",
    task: "attempt orchestration",
    requestedTools: ["workforce_execute", "forge_orchestrate"],
    ttlSeconds: 1800,
    parentAgentId: root.agentId,
  }, CTX);
  return {
    dataDir,
    service,
    child,
    governance: { service, toolProxy: createAgentGovernanceToolProxy({ service }) },
  };
}

describe("root Agent route enforcement with real registry lineage", () => {
  it("keeps /workforce/execute at zero for a real generated child Agent", async () => {
    const fixture = await governedChildFixture();
    try {
      const workforceExecutor = {
        describeExecution: vi.fn(),
        execute: vi.fn(),
      };
      const writeErrorResponse = vi.fn();
      const routes = createWorkforceRoutes({
        agentGovernance: fixture.governance,
        workforceExecutor,
        workforceService: {},
        workflowService: {},
      }, {
        readCapabilityJson: vi.fn(),
        writeJson: vi.fn(),
        writeServiceLog: vi.fn(),
        writeErrorResponse,
        createOkEnvelope: (value: unknown) => value,
        createErrorEnvelope: vi.fn(),
      });
      const handler = (routes.handlers.get("POST /workforce/execute") as any).handler;
      await handler({ enterpriseIdentity: { ...CTX, role: "developer" } }, {}, {
        startedAt: Date.now(),
        body: { agentId: fixture.child.agentId, goal: "must remain blocked" },
      });
      expect(workforceExecutor.describeExecution).not.toHaveBeenCalled();
      expect(workforceExecutor.execute).not.toHaveBeenCalled();
      expect(writeErrorResponse.mock.calls[0][0].error).toMatchObject({
        code: "WORKFORCE_ROOT_AGENT_REQUIRED",
        statusCode: 403,
      });
    } finally {
      await rm(fixture.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps /forge/orchestrate at zero for a real generated child Agent", async () => {
    const fixture = await governedChildFixture();
    try {
      const orchestrate = vi.fn();
      const request = Readable.from([Buffer.from(JSON.stringify({
        agentId: fixture.child.agentId,
        goal: "must remain blocked",
      }))]) as Readable & Record<string, any>;
      request.method = "POST";
      request.enterpriseIdentity = { ...CTX, role: "developer" };
      const response = new EventEmitter() as EventEmitter & Record<string, any>;
      response.statusCode = null;
      response.headers = {};
      response.body = null;
      response.writableEnded = false;
      response.destroyed = false;
      response.headersSent = false;
      response.setHeader = (name: string, value: unknown) => { response.headers[name] = value; };
      response.writeHead = (status: number, headers: Record<string, unknown> = {}) => {
        response.statusCode = status;
        response.headers = headers;
        response.headersSent = true;
      };
      response.write = () => true;
      response.end = (payload?: unknown) => {
        if (payload !== undefined) response.body = JSON.parse(String(payload));
        response.writableEnded = true;
      };
      await dispatchForgeRoutes({
        application: {
          runtimeEnv: {},
          gatewayService: {},
          agentGovernance: fixture.governance,
          __forgeGatewayService: { orchestrate },
        },
        request,
        response,
        startedAt: Date.now(),
        url: new URL("http://gateway.local/forge/orchestrate"),
        requestId: "root-negative-forge",
        writeServiceLog: vi.fn(),
      });
      expect(response.statusCode).toBe(403);
      expect(response.body.error.code).toBe("FORGE_ROOT_AGENT_REQUIRED");
      expect(orchestrate).not.toHaveBeenCalled();
    } finally {
      await rm(fixture.dataDir, { recursive: true, force: true });
    }
  });
});
