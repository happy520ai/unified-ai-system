import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";

type GovernanceTestServer = ReturnType<typeof createGatewayHttpServer> & {
  agentGovernanceOwnerLease: {
    leasePath: string;
    release(): void;
  };
  shutdownResources(): Promise<void>;
};

async function listen(server: GovernanceTestServer): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Governance health test server did not bind.");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: GovernanceTestServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
  await server.shutdownResources();
}

function createTestApplication(root: string) {
  return createGatewayApplication({
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-governance-health-hmac-secret-0123456789",
    AI_GATEWAY_AGENT_GOVERNANCE_HEALTH_CHECK_INTERVAL_MS: "1000",
    PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
    PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit.chain.jsonl"),
  });
}

describe("Agent Governance health HTTP integration", () => {
  it("keeps liveness non-secret but makes both readiness surfaces fail after owner loss", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-health-owner-"));
    const application = createTestApplication(root);
    const server = createGatewayHttpServer(application) as GovernanceTestServer;
    let originalLease = "";
    try {
      const baseUrl = await listen(server);
      const ready = await fetch(`${baseUrl}/ready`);
      expect(ready.status).toBe(200);
      const readyPayload = await ready.json() as any;
      expect(readyPayload.data.health.agentGovernance).toMatchObject({
        enabled: true,
        ready: true,
        ownerLease: "held",
        startupRecovery: "ready",
        stateIntegrity: "verified",
        auditIntegrity: "verified",
      });

      originalLease = readFileSync(server.agentGovernanceOwnerLease.leasePath, "utf8");
      const replaced = JSON.parse(originalLease);
      replaced.ownerId = "00000000-0000-4000-8000-000000000000";
      writeFileSync(server.agentGovernanceOwnerLease.leasePath, `${JSON.stringify(replaced)}\n`, "utf8");

      const lostReady = await fetch(`${baseUrl}/ready`);
      expect(lostReady.status).toBe(503);
      const lostReadyPayload = await lostReady.json() as any;
      expect(lostReadyPayload.error.details.readinessFailures).toContain(
        "agent-governance-owner-lease-unavailable",
      );
      expect(lostReadyPayload.error.details.health.agentGovernance).toMatchObject({
        enabled: true,
        ready: false,
        ownerLease: "lost",
        failureCode: "owner_lease_lost",
      });

      const health = await fetch(`${baseUrl}/health/check`);
      expect(health.status).toBe(200);
      const healthPayload = await health.json() as any;
      expect(healthPayload.data.status).toBe("degraded");
      expect(healthPayload.data.agentGovernance.failureCode).toBe("owner_lease_lost");

      const setup = await fetch(`${baseUrl}/setup/readiness`);
      expect(setup.status).toBe(503);
      const setupPayload = await setup.json() as any;
      expect(setupPayload.error.details.readiness.agentGovernance.failureCode).toBe(
        "owner_lease_lost",
      );

      const serialized = JSON.stringify({ lostReadyPayload, healthPayload, setupPayload });
      expect(serialized).not.toContain(root);
      expect(serialized).not.toContain(replaced.ownerId);
      expect(serialized).not.toContain("agent-governance-health-hmac-secret");
    } finally {
      if (originalLease) writeFileSync(server.agentGovernanceOwnerLease.leasePath, originalLease, "utf8");
      await closeServer(server);
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("returns readiness 503 when startup audit integrity verification fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-health-audit-"));
    const application = createTestApplication(root);
    const server = createGatewayHttpServer(application) as GovernanceTestServer;
    try {
      const baseUrl = await listen(server);
      expect((await fetch(`${baseUrl}/ready`)).status).toBe(200);
      if (!application.agentGovernance) throw new Error("Agent Governance was not enabled for the test.");
      await application.agentGovernance.service.emitAudit({
        eventType: "POLICY_VALIDATED",
        tenantId: "health-test",
        reason: "health integrity fixture",
      });
      const auditPath = join(root, "governance", "audit-events.jsonl");
      const originalAudit = readFileSync(auditPath, "utf8");
      writeFileSync(auditPath, originalAudit.replace("health integrity fixture", "tampered audit fixture"), "utf8");
      await new Promise((resolve) => setTimeout(resolve, 1_100));

      const response = await fetch(`${baseUrl}/ready`);
      expect(response.status).toBe(503);
      const payload = await response.json() as any;
      expect(payload.error.details.readinessFailures).toContain(
        "agent-governance-audit-integrity-unavailable",
      );
      expect(payload.error.details.health.agentGovernance).toMatchObject({
        enabled: true,
        ready: false,
        ownerLease: "held",
        auditIntegrity: "failed",
        failureCode: "audit_integrity_failed",
      });
      expect(JSON.stringify(payload)).not.toContain(root);
      expect(JSON.stringify(payload)).not.toContain("tampered audit fixture");
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });
});
