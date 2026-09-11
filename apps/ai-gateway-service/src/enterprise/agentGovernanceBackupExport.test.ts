import { link, mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createAgentGovernanceBackupExporter,
  validateAgentGovernanceBackupExport,
} from "./agentGovernanceBackupExport.ts";
import { createSqliteAgentRegistryStore } from "../agent-governance/sqliteAgentRegistryStore.ts";

const NOW = "2026-08-30T12:00:00.000Z";
const AGENT_ID = "agt_backup_reader";
const AGENT_RECORD = {
  agentId: AGENT_ID,
  name: "backup-reader",
  purpose: "read",
  tenantId: "platform-tenant",
  ownerUserId: "operator",
  createdBy: "operator",
  parentAgentId: null,
  generationDepth: 0,
  classification: { family: "analysis", domain: "general", subclass: "reader" },
  traits: ["read_only"],
  riskLevel: "low",
  requestedTools: ["file_read"],
  grantedTools: ["file_read"],
  policyHash: `sha256:${"a".repeat(64)}`,
  status: "ACTIVE",
  createdAt: NOW,
  expiresAt: "2026-08-30T13:00:00.000Z",
};

async function createFixture(root: string, options: { jsonRegistry?: boolean } = {}) {
  const dataDir = join(root, "governance");
  const agentDir = join(dataDir, "agents", AGENT_ID);
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(dataDir, "owner.lease.json"), "owner-private-material", "utf8");
  await writeFile(join(dataDir, "secret.key"), "governance-super-secret-material", "utf8");
  if (options.jsonRegistry !== false) {
    await writeFile(join(dataDir, "agents.json"), JSON.stringify({
      version: 1,
      updatedAt: NOW,
      agents: { [AGENT_ID]: AGENT_RECORD },
    }), "utf8");
  }
  await writeFile(join(dataDir, "policies.json"), JSON.stringify({
    version: 1,
    policies: { "root-policy@1": { status: "active" } },
  }), "utf8");
  await writeFile(join(dataDir, "approvals.json"), JSON.stringify({
    version: 1,
    approvals: { approval_private_id: { status: "PENDING", sealedArguments: "ciphertext-private" } },
  }), "utf8");
  await writeFile(join(dataDir, "usage.json"), JSON.stringify({
    version: 1,
    usage: { [AGENT_ID]: { toolCalls: 1, steps: 0, records: 2 } },
  }), "utf8");
  await writeFile(join(dataDir, "audit-events.jsonl"), `${JSON.stringify({ eventType: "TOOL_ALLOWED" })}\n`, "utf8");
  for (const name of [
    "governance-state.anchor.json",
    "governance-state.checkpoint.json",
    "governance-state.installation.json",
  ]) {
    await writeFile(join(dataDir, name), JSON.stringify({ signed: true, privateHead: name }), "utf8");
  }
  await writeFile(join(agentDir, "agent.json"), JSON.stringify(AGENT_RECORD), "utf8");
  await writeFile(join(agentDir, "policy-delta.json"), JSON.stringify({ agentId: AGENT_ID }), "utf8");
  await writeFile(join(agentDir, "effective-policy.json"), JSON.stringify({ policyHash: AGENT_RECORD.policyHash }), "utf8");
  await writeFile(join(agentDir, "manifest.json"), JSON.stringify({ signature: "private-signature" }), "utf8");
  await writeFile(join(agentDir, "audit.ndjson"), `${JSON.stringify({ eventType: "AGENT_ACTIVATED" })}\n`, "utf8");
  return dataDir;
}

function healthyService(onCheck?: (count: number) => void | Promise<void>) {
  let count = 0;
  return {
    checkHealth: vi.fn(async () => {
      count += 1;
      await onCheck?.(count);
      return {
        ready: true,
        startupRecovery: "ready",
        stateIntegrity: "verified",
        auditIntegrity: "verified",
      };
    }),
    verifyAllAgentBundles: vi.fn(async () => ({ verifiedAgentCount: 1 })),
  };
}

describe("Agent Governance backup consistency export", () => {
  it("exports only a stable non-restorable summary and excludes secrets, owner, and raw state", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-export-"));
    try {
      const dataDir = await createFixture(root);
      const service = healthyService();
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service },
        platformTenantId: "platform-tenant",
        now: () => NOW,
      });

      const summary = await exporter.exportSummary({ tenantId: "platform-tenant" });
      expect(summary).toMatchObject({
        schemaVersion: 1,
        enabled: true,
        included: true,
        mode: "read-only-consistency-export",
        restoreMode: "verify-only",
        restorable: false,
        mutation: "none",
        consistency: "double-read-stable",
        registryStorage: "single-process-json",
        excluded: {
          secretMaterial: true,
          ownerLease: true,
          transientWal: true,
          sqliteDatabaseBytes: true,
        },
      });
      expect(summary.components).toMatchObject({
        registry: { recordCount: 1, source: "anchored-file" },
        policies: { recordCount: 1 },
        approvals: { recordCount: 1 },
        usage: { recordCount: 1 },
        audit: { recordCount: 1 },
        agentBundles: { recordCount: 1, fileCount: 5 },
        integrityHeads: { fileCount: 3 },
      });
      expect(service.checkHealth).toHaveBeenCalledTimes(2);
      expect(service.verifyAllAgentBundles).toHaveBeenCalledTimes(2);
      expect(validateAgentGovernanceBackupExport(summary)).toMatchObject({
        valid: true,
        included: true,
        restoreMode: "verify-only",
        restorable: false,
        mutation: "none",
      });
      const serialized = JSON.stringify(summary);
      for (const privateValue of [
        "governance-super-secret-material",
        "owner-private-material",
        "approval_private_id",
        "ciphertext-private",
        "private-signature",
        AGENT_ID,
      ]) expect(serialized).not.toContain(privateValue);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses a logical SQLite Registry query and never reads database, WAL, or SHM bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-sqlite-"));
    let sqliteStore: ReturnType<typeof createSqliteAgentRegistryStore> | null = null;
    try {
      const dataDir = await createFixture(root, { jsonRegistry: false });
      sqliteStore = createSqliteAgentRegistryStore({
        sqlitePath: join(dataDir, "agent-registry.sqlite"),
        hostId: "backup-export-test-host",
        hmacSecret: "backup-export-sqlite-authority-test-secret",
      });
      await sqliteStore.upsert(AGENT_RECORD as any);
      const registryStore = {
        listAll: vi.fn(() => sqliteStore?.listAll() ?? Promise.resolve([])),
        getHealth: () => sqliteStore?.getHealth() ?? { storageMode: "single-host-sqlite", available: false },
      };
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service: healthyService(), registryStore },
        platformTenantId: "platform-tenant",
        now: () => NOW,
      });

      const summary = await exporter.exportSummary({ tenantId: "platform-tenant" });
      expect(summary.registryStorage).toBe("single-host-sqlite-logical-query");
      expect(summary.components?.registry).toMatchObject({ source: "logical-query", recordCount: 1 });
      expect(registryStore.listAll).toHaveBeenCalledTimes(2);
      expect(sqliteStore.getHealth()).toMatchObject({ journalMode: "wal", available: true });
      expect(JSON.stringify(summary)).not.toContain(AGENT_ID);
      expect(JSON.stringify(summary)).not.toContain("backup-export-test-host");
    } finally {
      await sqliteStore?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed on active recovery WAL or non-empty bundle staging", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-transient-"));
    try {
      const dataDir = await createFixture(root);
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service: healthyService() },
        platformTenantId: "platform-tenant",
      });
      await writeFile(join(dataDir, "agent-generation.journal.json"), "{}", "utf8");
      await expect(exporter.exportSummary({ tenantId: "platform-tenant" })).rejects.toMatchObject({
        code: "AGENT_GOVERNANCE_BACKUP_TRANSIENT_STATE_PRESENT",
      });
      await unlink(join(dataDir, "agent-generation.journal.json"));
      const staging = join(dataDir, "agents", ".bundle-staging");
      await mkdir(staging, { recursive: true });
      await writeFile(join(staging, "active-operation"), "private-wal", "utf8");
      await expect(exporter.exportSummary({ tenantId: "platform-tenant" })).rejects.toMatchObject({
        code: "AGENT_GOVERNANCE_BACKUP_TRANSIENT_STATE_PRESENT",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires a unique regular owner lease boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-owner-"));
    try {
      const dataDir = await createFixture(root);
      await unlink(join(dataDir, "owner.lease.json"));
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service: healthyService() },
        platformTenantId: "platform-tenant",
      });
      await expect(exporter.exportSummary({ tenantId: "platform-tenant" })).rejects.toMatchObject({
        code: "AGENT_GOVERNANCE_BACKUP_OWNER_REQUIRED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses a bounded logical summary for a central PostgreSQL Registry", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-postgres-"));
    try {
      const dataDir = await createFixture(root, { jsonRegistry: false });
      const registryStore = {
        listAll: vi.fn(async () => [AGENT_RECORD as any]),
        getHealth: () => ({ storageMode: "central-postgres", available: true }),
      };
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service: healthyService(), registryStore },
        platformTenantId: "platform-tenant",
        now: () => NOW,
      });

      const summary = await exporter.exportSummary({ tenantId: "platform-tenant" });
      expect(summary.registryStorage).toBe("central-postgres-logical-query");
      expect(summary.components?.registry).toMatchObject({ source: "logical-query", recordCount: 1 });
      expect(registryStore.listAll).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(summary)).not.toContain("postgresql://");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects concurrent changes between its two reads", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-race-"));
    try {
      const dataDir = await createFixture(root);
      const service = healthyService(async (count) => {
        if (count === 2) {
          await writeFile(join(dataDir, "usage.json"), JSON.stringify({
            version: 1,
            usage: { [AGENT_ID]: { toolCalls: 2, steps: 0, records: 2 } },
          }), "utf8");
        }
      });
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service },
        platformTenantId: "platform-tenant",
      });
      await expect(exporter.exportSummary({ tenantId: "platform-tenant" })).rejects.toMatchObject({
        code: "AGENT_GOVERNANCE_BACKUP_STATE_CHANGED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects hard-linked authority files", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-hardlink-"));
    try {
      const dataDir = await createFixture(root);
      await unlink(join(dataDir, "policies.json"));
      await link(join(dataDir, "secret.key"), join(dataDir, "policies.json"));
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service: healthyService() },
        platformTenantId: "platform-tenant",
      });
      await expect(exporter.exportSummary({ tenantId: "platform-tenant" })).rejects.toMatchObject({
        code: "AGENT_GOVERNANCE_BACKUP_UNSAFE_FILE",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps non-platform tenant exports excluded and validates aggregate tampering", async () => {
    const root = await mkdtemp(join(tmpdir(), "governance-backup-tenant-"));
    try {
      const dataDir = await createFixture(root);
      const service = healthyService();
      const exporter = createAgentGovernanceBackupExporter({
        governance: { dataDir, service },
        platformTenantId: "platform-tenant",
        now: () => NOW,
      });
      const excluded = await exporter.exportSummary({ tenantId: "ordinary-tenant" });
      expect(excluded).toMatchObject({
        enabled: true,
        included: false,
        mode: "platform-tenant-required",
        restorable: false,
      });
      expect(service.checkHealth).not.toHaveBeenCalled();
      expect(service.verifyAllAgentBundles).not.toHaveBeenCalled();
      expect(validateAgentGovernanceBackupExport(excluded)).toMatchObject({
        valid: true,
        included: false,
        warnings: ["agent_governance_export_requires_platform_tenant"],
      });

      const included = await exporter.exportSummary({ tenantId: "platform-tenant" });
      const tampered = structuredClone(included) as any;
      tampered.components.usage.recordCount += 1;
      expect(validateAgentGovernanceBackupExport(tampered)).toMatchObject({
        valid: false,
        blockers: ["agent_governance_aggregate_digest_mismatch"],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
