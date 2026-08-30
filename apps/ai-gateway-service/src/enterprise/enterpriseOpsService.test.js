import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEnterpriseOpsService } from "./enterpriseOpsService.js";
import { createAgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";

const MASTER_KEY_A = Buffer.alloc(32, 0x31).toString("base64");
const MASTER_KEY_B = Buffer.alloc(32, 0x32).toString("base64");

function createTestService(root, {
  key = MASTER_KEY_A,
  previousKeys,
  auditContent = "[]",
  agentGovernance = null,
  platformTenantId,
} = {}) {
  return createEnterpriseOpsService({
    env: {
      PME_ENTERPRISE_BACKUP_DIR: join(root, "backups"),
      PME_ENTERPRISE_BACKUP_CHECKPOINT_DIR: join(root, "checkpoints"),
      ...(key ? { PME_ENTERPRISE_BACKUP_MASTER_KEY: key } : {}),
      ...(previousKeys ? { PME_ENTERPRISE_BACKUP_PREVIOUS_MASTER_KEYS: previousKeys } : {}),
      ...(platformTenantId ? { PME_ENTERPRISE_PLATFORM_TENANT_ID: platformTenantId } : {}),
    },
    config: {},
    enterpriseGovernanceService: {
      getHealth: () => ({
        userStore: { path: join(root, "users.json"), mode: "file" },
        audit: { path: join(root, "audit.jsonl"), mode: "file" },
      }),
      getSecurityReadiness: () => ({
        authEnabled: true,
        userStore: { activeUserCount: 1, usersWithoutExpiryCount: 0 },
      }),
      exportAudit: async () => ({ auditLogPath: join(root, "audit.jsonl"), content: auditContent }),
      exportUsersForBackup: () => ({ storedUsers: [{ userId: "stored-user", tokenHash: "hash-only" }] }),
    },
    knowledgeInfra: { getReadiness: () => ({ status: "ready", mode: "keyword" }) },
    knowledgeService: {
      getHealth: () => ({ storage: "file", persistence: { durable: true }, documentCount: 2 }),
    },
    agentGovernance,
  });
}

const TENANT_A = { userId: "tenant-a-admin", tenantId: "tenant-a", role: "admin" };
const TENANT_B = { userId: "tenant-b-admin", tenantId: "tenant-b", role: "admin" };

describe("enterprise operations backup", () => {
  it("marks the backup warning when the audit export is invalid JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-ops-"));
    const service = createTestService(root, { auditContent: "{invalid" });

    try {
      const result = await service.createBackup({}, TENANT_A);
      const artifactText = await readFile(result.backupPath, "utf8");
      const envelope = JSON.parse(artifactText);

      expect(result.status).toBe("warning");
      expect(result.auditParseStatus).toBe("warning");
      expect(result.warnings).toEqual(["audit_export_json_invalid"]);
      expect(result.auditEntryCount).toBe(0);
      expect(envelope.type).toBe("pme-enterprise-backup-envelope");
      expect(envelope.version).toBe(1);
      expect(envelope.algorithm).toBe("aes-256-gcm");
      expect(envelope.signingAlgorithm).toBe("ed25519");
      expect(envelope.tenantId).toBe("tenant-a");
      expect(envelope).not.toHaveProperty("audit");
      expect(envelope).not.toHaveProperty("enterpriseUsers");
      expect(artifactText).not.toContain("stored-user");
      expect(artifactText).not.toContain("hash-only");

      const valid = await service.validateRestore({ backupPath: result.backupPath }, TENANT_A);
      expect(valid.valid).toBe(true);
      expect(valid.protection).toMatchObject({ encrypted: true, authenticated: true, manifestSigned: true });
      expect(valid.sequence).toBe(1);

      const crossTenantValidation = await service.validateRestore(
        { backupPath: result.backupPath },
        TENANT_B,
      );
      expect(crossTenantValidation.valid).toBe(false);
      expect(crossTenantValidation.blockers).toContain("backup_tenant_mismatch");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed for wrong keys and signed-envelope tampering", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-ops-tamper-"));
    try {
      const service = createTestService(root);
      const result = await service.createBackup({}, TENANT_A);
      const wrongKeyService = createTestService(root, { key: MASTER_KEY_B });
      const wrongKey = await wrongKeyService.validateRestore({ backupPath: result.backupPath }, TENANT_A);
      expect(wrongKey.valid).toBe(false);
      expect(wrongKey.blockers).toContain("backup_key_mismatch");

      const envelope = JSON.parse(await readFile(result.backupPath, "utf8"));
      envelope.generatedAt = new Date(Date.parse(envelope.generatedAt) + 1000).toISOString();
      await writeFile(result.backupPath, JSON.stringify(envelope), "utf8");
      const tampered = await service.validateRestore({ backupPath: result.backupPath }, TENANT_A);
      expect(tampered.valid).toBe(false);
      expect(tampered.blockers).toContain("backup_signature_invalid");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects rollback and tampered checkpoint state", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-ops-rollback-"));
    try {
      const service = createTestService(root);
      const first = await service.createBackup({}, TENANT_A);
      const second = await service.createBackup({}, TENANT_A);
      expect(second.sequence).toBe(2);

      const latest = await service.validateRestore({ backupPath: second.backupPath }, TENANT_A);
      expect(latest.valid).toBe(true);
      const rollback = await service.validateRestore({ backupPath: first.backupPath }, TENANT_A);
      expect(rollback.valid).toBe(false);
      expect(rollback.blockers).toContain("backup_rollback_detected");

      const checkpointDir = join(root, "checkpoints");
      const [checkpointName] = await readdir(checkpointDir);
      const checkpointPath = join(checkpointDir, checkpointName);
      const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
      checkpoint.sequence = 1;
      await writeFile(checkpointPath, JSON.stringify(checkpoint), "utf8");
      const tamperedCheckpoint = await service.validateRestore({ backupPath: second.backupPath }, TENANT_A);
      expect(tamperedCheckpoint.valid).toBe(false);
      expect(tamperedCheckpoint.blockers).toContain("backup_checkpoint_invalid");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports bounded previous keys for backup-key rotation", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-ops-rotation-"));
    try {
      const original = createTestService(root, { key: MASTER_KEY_A });
      const first = await original.createBackup({}, TENANT_A);
      const rotated = createTestService(root, { key: MASTER_KEY_B, previousKeys: MASTER_KEY_A });
      const beforeReseal = await rotated.validateRestore({ backupPath: first.backupPath }, TENANT_A);
      expect(beforeReseal.valid).toBe(true);
      const second = await rotated.createBackup({}, TENANT_A);
      expect(second.sequence).toBe(2);
      expect(second.keyId).not.toBe(first.keyId);
      expect((await rotated.validateRestore({ backupPath: second.backupPath }, TENANT_A)).valid).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("embeds a verified governance summary but never claims or performs governance restore", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-ops-governance-"));
    try {
      const dataDir = join(root, "governance");
      const governanceService = createAgentGovernanceService({
        dataDir,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "enterprise-governance-backup-secret-0123456789",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: TENANT_A.tenantId,
        },
      });
      const generatedAgent = await governanceService.generateAgent({
        name: "enterprise-backup-reader",
        task: "read a report",
        requestedTools: ["file_read"],
        ttlSeconds: 600,
        parentAgentId: null,
      }, {
        ...TENANT_A,
        permissions: ["*"],
      });
      await writeFile(join(dataDir, "owner.lease.json"), JSON.stringify({ owner: "test-process" }), "utf8");
      const service = createTestService(root, {
        platformTenantId: TENANT_A.tenantId,
        agentGovernance: { dataDir, service: governanceService, registryStore: null },
      });
      expect(service.getReadiness()).toMatchObject({
        status: "warning",
        backup: {
          agentGovernance: {
            enabled: true,
            restoreMode: "verify-only",
            restorable: false,
          },
        },
        warnings: expect.arrayContaining(["agent_governance_backup_export"]),
      });

      const created = await service.createBackup({ reason: "governance consistency evidence" }, TENANT_A);
      expect(created.status).toBe("warning");
      expect(created.warnings).toContain("agent_governance_restore_is_verify_only");
      expect(created.agentGovernance).toEqual({
        enabled: true,
        included: true,
        mode: "read-only-consistency-export",
        restoreMode: "verify-only",
        restorable: false,
        mutation: "none",
      });
      const artifact = await readFile(created.backupPath, "utf8");
      expect(artifact).not.toContain("enterprise-backup-reader");
      expect(artifact).not.toContain("enterprise-governance-backup-secret");
      expect(artifact).not.toContain("owner.lease.json");

      const validated = await service.validateRestore({ backupPath: created.backupPath }, TENANT_A);
      expect(validated.valid).toBe(true);
      expect(validated.status).toBe("warning");
      expect(validated.mutation).toBe("none");
      expect(validated.agentGovernance).toEqual({
        valid: true,
        included: true,
        restoreMode: "verify-only",
        restorable: false,
        mutation: "none",
        componentCount: 7,
      });
      expect(validated.warnings).toContain("agent_governance_restore_is_verify_only");

      const policyPath = join(dataDir, "agents", generatedAgent.agentId, "effective-policy.json");
      const policy = JSON.parse(await readFile(policyPath, "utf8"));
      policy.grantedTools.push("shell_exec");
      await writeFile(policyPath, JSON.stringify(policy), "utf8");
      await expect(service.createBackup({ reason: "must reject corrupt bundle" }, TENANT_A))
        .rejects.toMatchObject({ code: "AGENT_GOVERNANCE_BUNDLE_INTEGRITY_FAILED" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
