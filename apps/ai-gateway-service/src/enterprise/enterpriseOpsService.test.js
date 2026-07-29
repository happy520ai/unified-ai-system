import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEnterpriseOpsService } from "./enterpriseOpsService.js";

describe("enterprise operations backup", () => {
  it("marks the backup warning when the audit export is invalid JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-ops-"));
    const service = createEnterpriseOpsService({
      env: {
        PME_ENTERPRISE_BACKUP_DIR: root,
      },
      config: {},
      enterpriseGovernanceService: {
        getHealth: () => ({
          userStore: { path: join(root, "users.json"), mode: "file" },
          audit: { path: join(root, "audit.jsonl"), mode: "file" },
        }),
        getSecurityReadiness: () => ({
          authEnabled: true,
          userStore: { activeUserCount: 1 },
        }),
        exportAudit: async () => ({
          auditLogPath: join(root, "audit.jsonl"),
          content: "{invalid",
        }),
        exportUsersForBackup: () => ({
          storedUsers: [],
        }),
      },
      knowledgeInfra: {
        getReadiness: () => ({
          status: "ready",
          mode: "keyword",
        }),
      },
      knowledgeService: {
        getHealth: () => ({
          storage: "file",
          persistence: { durable: true },
          documentCount: 2,
        }),
      },
    });

    try {
      const result = await service.createBackup();
      const backup = JSON.parse(await readFile(result.backupPath, "utf8"));

      expect(result.status).toBe("warning");
      expect(result.auditParseStatus).toBe("warning");
      expect(result.warnings).toEqual(["audit_export_json_invalid"]);
      expect(result.auditEntryCount).toBe(0);
      expect(backup.audit.parseStatus).toBe("warning");
      expect(backup.audit.entries).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
