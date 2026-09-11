import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";

const TOKEN = "workflow-governance-http-token";
const TENANT_ID = "workflow-http-tenant";
const USER_ID = "workflow-http-owner";

describe("governed workflow over real HTTP", () => {
  it("requires an Agent and publishes tenant-partitioned, non-overwriting artifacts", async () => {
    const root = mkdtempSync(join(tmpdir(), "workflow-governance-http-"));
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "workflow-governance-http-secret-0123456789",
      WORKFLOW_OUTPUT_DIR: join(root, "workflow-artifacts"),
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: TOKEN,
      PME_AUTH_USER_ID: USER_ID,
      PME_AUTH_TENANT_ID: TENANT_ID,
      PME_AUTH_ROLE: "admin",
      PME_ENTERPRISE_PLATFORM_TENANT_ID: TENANT_ID,
      PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
      PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit.chain.jsonl"),
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    });
    const agent = await application.agentGovernance!.service.generateAgent({
      name: "workflow-http-agent",
      task: "write controlled local workflow reports",
      requestedTools: ["file_write"],
      ttlSeconds: 3600,
      parentAgentId: null,
    }, {
      tenantId: TENANT_ID,
      userId: USER_ID,
      role: "admin",
      permissions: ["*"],
    });
    const server = createGatewayHttpServer(application);
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Workflow test server did not bind.");
      const url = `http://127.0.0.1:${address.port}/workflow/run`;
      const request = (body: Record<string, unknown>) => fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json",
          "x-pme-tenant-id": TENANT_ID,
        },
        body: JSON.stringify(body),
      });

      const missing = await request({ goal: "must remain pre-write", artifactName: "report.md" });
      expect(missing.status).toBe(400);
      expect((await missing.json() as any).error?.code).toBe("WORKFLOW_AGENT_ID_REQUIRED");

      const first = await request({
        agentId: agent.agentId,
        goal: "first governed workflow report",
        artifactName: "report.md",
      });
      expect(first.status).toBe(200);
      const firstPayload = await first.json() as any;
      expect(firstPayload.data.artifact.fileName).toBe("report.md");
      expect(firstPayload.data.artifact.absolutePath).toContain("tenant-");
      expect(existsSync(firstPayload.data.artifact.absolutePath)).toBe(true);

      const second = await request({
        agentId: agent.agentId,
        goal: "second governed workflow report",
        artifactName: "report.md",
      });
      expect(second.status).toBe(200);
      expect((await second.json() as any).data.artifact.fileName).toBe("report-2.md");
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
      await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }, 60_000);
});
