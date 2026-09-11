import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGovernanceAuditLog } from "./governanceAuditLog.ts";

const SECRET = "test-governance-audit-secret-0123456789";

describe("Agent Governance segmented central audit chain", () => {
  it("detects historical modification before reads or later appends", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-audit-"));
    const logPath = join(root, "audit.ndjson");
    try {
      const log = createGovernanceAuditLog({ logPath, secret: SECRET });
      await log.record(event(0));
      await log.record(event(1));
      expect((await log.read()).filter((item) => item.eventType !== "AUDIT_CHECKPOINT")).toHaveLength(2);

      const lines = (await readFile(logPath, "utf8")).trim().split("\n");
      const first = JSON.parse(lines[0]!);
      first.tenantId = "tenant_b";
      lines[0] = JSON.stringify(first);
      await writeFile(logPath, `${lines.join("\n")}\n`, "utf8");

      await expect(log.read()).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });
      await expect(log.record(event(2))).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps multiple completed signed segments readable, bounded and restart-verifiable", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-audit-rotation-"));
    const logPath = join(root, "audit.ndjson");
    let nowIso = "2026-08-30T00:00:00.000Z";
    try {
      const options = {
        logPath,
        secret: SECRET,
        maxRecords: 10,
        maxArchiveSegments: 3,
        maxArchiveBytes: 1024 * 1024,
        archiveRetentionMs: 7 * 24 * 60 * 60 * 1_000,
        now: () => nowIso,
      };
      const log = createGovernanceAuditLog(options);
      for (let index = 0; index < 35; index += 1) {
        nowIso = new Date(Date.UTC(2026, 7, 30, 0, 0, index)).toISOString();
        await log.record(event(index));
      }

      const visible = await log.read(100);
      const details = visible.filter((item) => item.eventType !== "AUDIT_CHECKPOINT");
      const checkpoints = visible.filter((item) => item.eventType === "AUDIT_CHECKPOINT");
      expect(details.map((item) => item.reason)).toEqual(Array.from({ length: 35 }, (_, index) => `event-${index}`));
      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
      expect(checkpoints.at(-1)?.checkpoint).toMatchObject({
        archiveSegmentCount: 3,
        compactedRecordCount: 0,
        truncated: false,
      });

      const persisted = parseRaw(await readFile(logPath, "utf8"));
      expect(new Set(persisted.map((item) => item.segmentId)).size).toBeLessThanOrEqual(4);
      expect(persisted.at(-1)?.sequence).toBeGreaterThanOrEqual(persisted.length);

      const restarted = createGovernanceAuditLog(options);
      await expect(restarted.read(100)).resolves.toEqual(visible);
      const agentView = await restarted.readForAgent("agt_a", 2);
      expect(agentView.some((item) => item.eventType === "AUDIT_CHECKPOINT")).toBe(true);
      expect(agentView.filter((item) => item.eventType !== "AUDIT_CHECKPOINT")).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a retained archive segment is modified", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-audit-archive-tamper-"));
    const logPath = join(root, "audit.ndjson");
    try {
      const log = createGovernanceAuditLog({
        logPath,
        secret: SECRET,
        maxRecords: 10,
        maxArchiveSegments: 3,
      });
      for (let index = 0; index < 15; index += 1) await log.record(event(index));
      const lines = (await readFile(logPath, "utf8")).trim().split("\n");
      const archived = JSON.parse(lines[1]!);
      archived.reason = "tampered-archive";
      lines[1] = JSON.stringify(archived);
      await writeFile(logPath, `${lines.join("\n")}\n`, "utf8");

      const restarted = createGovernanceAuditLog({ logPath, secret: SECRET, maxRecords: 10 });
      await expect(restarted.read()).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("expires whole archive segments and exposes explicit truncation totals", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-audit-retention-"));
    const logPath = join(root, "audit.ndjson");
    let nowIso = "2026-08-01T00:00:00.000Z";
    try {
      const options = {
        logPath,
        secret: SECRET,
        maxRecords: 10,
        maxArchiveSegments: 8,
        maxArchiveBytes: 1024 * 1024,
        archiveRetentionMs: 24 * 60 * 60 * 1_000,
        now: () => nowIso,
      };
      const log = createGovernanceAuditLog(options);
      for (let index = 0; index < 10; index += 1) await log.record(event(index, nowIso));
      nowIso = "2026-08-02T00:00:00.000Z";
      await log.record(event(10, nowIso));
      nowIso = "2026-08-04T00:00:00.000Z";

      const visible = await log.read(100);
      const latest = visible.find((item) => item.eventType === "AUDIT_CHECKPOINT")?.checkpoint;
      expect(latest).toMatchObject({
        rotationReason: "archive_retention",
        archiveSegmentCount: 0,
        archivedRecordCount: 0,
        compactedRecordCount: 11,
        truncated: true,
      });
      expect(visible.filter((item) => item.eventType !== "AUDIT_CHECKPOINT")).toEqual([]);

      const raw = parseRaw(await readFile(logPath, "utf8"));
      expect(new Set(raw.map((item) => item.segmentId)).size).toBe(1);
      const restarted = createGovernanceAuditLog(options);
      await expect(restarted.read(100)).resolves.toEqual(visible);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enforces an archive byte ceiling by removing only complete segments", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-audit-byte-cap-"));
    const logPath = join(root, "audit.ndjson");
    try {
      const log = createGovernanceAuditLog({
        logPath,
        secret: SECRET,
        maxRecords: 10,
        maxArchiveSegments: 10,
        maxArchiveBytes: 1_024,
      });
      for (let index = 0; index < 22; index += 1) {
        await log.record({ ...event(index), reason: `event-${index}-${"x".repeat(350)}` });
      }
      const visible = await log.read(100);
      const latest = [...visible].reverse().find((item) => item.eventType === "AUDIT_CHECKPOINT")?.checkpoint;
      expect(latest?.archivedBytes).toBeLessThanOrEqual(1_024);
      expect(latest?.archiveSegmentCount).toBe(0);
      // Two complete detailed segments (10 + 9 events) were removed; the
      // current segment remains readable instead of being partially trimmed.
      expect(latest?.compactedRecordCount).toBe(19);
      expect(latest?.truncated).toBe(true);
      const raw = parseRaw(await readFile(logPath, "utf8"));
      expect(new Set(raw.map((item) => item.segmentId)).size).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function event(index: number, timestamp = new Date(Date.UTC(2026, 7, 30, 0, 0, index)).toISOString()) {
  return {
    eventType: "TOOL_REQUESTED" as const,
    agentId: "agt_a",
    tenantId: "tenant_a",
    toolName: "file_read",
    reason: `event-${index}`,
    timestamp,
  };
}

function parseRaw(raw: string): Array<Record<string, any>> {
  return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}
