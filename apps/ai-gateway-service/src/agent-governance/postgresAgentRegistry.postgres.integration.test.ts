import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";
import { createPostgresAgentRegistryStore } from "./postgresAgentRegistryStore.ts";
import {
  POSTGRES_AGENT_REGISTRY_AUTHORITY_TABLE,
  POSTGRES_AGENT_REGISTRY_MIGRATION_TABLE,
  POSTGRES_AGENT_REGISTRY_MUTATION_TABLE,
  POSTGRES_AGENT_REGISTRY_TABLE,
} from "./postgresAgentRegistryMigrations.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;
const integritySecret = "postgres-real-integration-integrity-secret-0123456789";

describePostgres("real PostgreSQL Agent Registry", () => {
  it("coordinates two pools, tenant lineage, reopen, and a second migration namespace", async () => {
    const namespace = `agent-registry-${randomUUID()}`;
    const secondNamespace = `agent-registry-${randomUUID()}`;
    const authorityId = randomUUID();
    const first = createPostgresAgentRegistryStore({ connectionString, namespace, authorityId, integritySecret });
    const second = createPostgresAgentRegistryStore({ connectionString, namespace, authorityId, integritySecret });
    const otherNamespace = createPostgresAgentRegistryStore({
      connectionString,
      namespace: secondNamespace,
      authorityId: randomUUID(),
      integritySecret,
    });
    let checkpointed: ReturnType<typeof createPostgresAgentRegistryStore> | null = null;
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    const parent = record("agt_postgres_parent");
    const child = record("agt_postgres_child", {
      parentAgentId: parent.agentId,
      generationDepth: 1,
      grantedTools: ["file_read"],
      requestedTools: ["file_read"],
      expiresAt: "2026-08-30T01:30:00.000Z",
    });
    try {
      await Promise.all([first.load(), second.load(), otherNamespace.load()]);
      await first.upsert(parent);
      await second.upsert(child);
      expect(await first.get(child.agentId, "tenant_b")).toBeNull();
      expect(await first.get(child.agentId, "tenant_a")).toEqual(child);
      expect(await second.countChildren(parent.agentId)).toBe(1);

      const completed = { ...child, status: "COMPLETED" as const };
      await Promise.all([first.upsert(completed), second.upsert(completed)]);
      expect(await first.getUnscoped(child.agentId)).toEqual(completed);
      const checkpoint = await first.getCheckpoint();
      expect(checkpoint).toMatchObject({
        authorityBinding: first.getAuthorityBinding(),
        minimumRevision: 4,
        trustedHeadHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      });
      checkpointed = createPostgresAgentRegistryStore({
        connectionString,
        namespace,
        authorityId,
        integritySecret,
        externalCheckpointFloor: checkpoint,
      });
      await checkpointed.load();
      expect(checkpointed.getHealth()).toMatchObject({
        rollbackProtected: true,
        singleOwnerPreview: false,
        externalCheckpointVerified: true,
        authorityRevision: checkpoint.minimumRevision,
      });
      expect(first.getHealth()).toMatchObject({
        status: "ready",
        available: true,
        storageMode: "central-postgres",
        distributedCapable: true,
        distributedVerified: false,
        realPostgresIntegrationVerified: false,
        namespaceExposed: false,
        connectionStringExposed: false,
      });

      const migrations = await inspector.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM ${POSTGRES_AGENT_REGISTRY_MIGRATION_TABLE}
      `);
      expect(migrations.rows[0]?.count).toBe("3");
      const mutationEvents = await inspector.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM ${POSTGRES_AGENT_REGISTRY_MUTATION_TABLE}
        WHERE namespace = $1
      `, [namespace]);
      expect(mutationEvents.rows[0]?.count).toBe(String(checkpoint.minimumRevision));
    } finally {
      await inspector.query(`DELETE FROM ${POSTGRES_AGENT_REGISTRY_MUTATION_TABLE} WHERE namespace = ANY($1::text[])`, [
        [namespace, secondNamespace],
      ]).catch(() => undefined);
      await inspector.query(`DELETE FROM ${POSTGRES_AGENT_REGISTRY_TABLE} WHERE namespace = ANY($1::text[])`, [
        [namespace, secondNamespace],
      ]).catch(() => undefined);
      await inspector.query(`DELETE FROM ${POSTGRES_AGENT_REGISTRY_AUTHORITY_TABLE} WHERE namespace = ANY($1::text[])`, [
        [namespace, secondNamespace],
      ]).catch(() => undefined);
      await Promise.all([first.close(), second.close(), otherNamespace.close(), checkpointed?.close()]);
      await inspector.end();
    }
  }, 30_000);
});

function record(
  agentId: string,
  overrides: Partial<AgentRegistryRecord> = {},
): AgentRegistryRecord {
  return {
    agentId,
    name: agentId,
    purpose: "real PostgreSQL Agent Registry integration fixture",
    tenantId: "tenant_a",
    ownerUserId: "operator_a",
    createdBy: "operator_a",
    parentAgentId: null,
    generationDepth: 0,
    classification: { family: "analysis", domain: "tests", subclass: "registry" },
    traits: ["read_only"],
    riskLevel: "low",
    requestedTools: ["file_read", "file_write"],
    grantedTools: ["file_read", "file_write"],
    policyHash: `sha256:${"a".repeat(64)}`,
    status: "ACTIVE",
    createdAt: "2026-08-30T00:00:00.000Z",
    expiresAt: "2026-08-30T02:00:00.000Z",
    ...overrides,
  };
}
