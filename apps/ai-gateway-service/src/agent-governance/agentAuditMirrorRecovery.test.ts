// @test-isolation process
import { link, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentFileStore } from "./agentFileStore.ts";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";

const SECRET = "agent-audit-mirror-recovery-key-0123456789";
const NOW = "2026-08-30T10:00:00.000Z";
const CONTEXT = {
  tenantId: "tenant_a",
  userId: "operator_a",
  role: "admin",
  permissions: ["*"],
};

function service(root: string, extraEnv: Record<string, string> = {}) {
  return createAgentGovernanceService({
    dataDir: root,
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: CONTEXT.tenantId,
      ...extraEnv,
    },
    now: () => NOW,
  });
}

async function generate(root: string) {
  return service(root).generateAgent({
    name: "audit-mirror-agent",
    task: "read one file",
    requestedTools: ["file_read"],
    ttlSeconds: 3_600,
    parentAgentId: null,
  }, CONTEXT);
}

describe("per-Agent audit mirror recovery", () => {
  it("repairs a missing retained central event before exposing service state", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-repair-"));
    try {
      const generated = await generate(root);
      const auditPath = join(root, "agents", generated.agentId, "audit.ndjson");
      const lines = (await readFile(auditPath, "utf8")).trimEnd().split("\n");
      const removed = JSON.parse(lines.pop()!).event;
      expect(removed.id).toMatch(/^age_/u);
      await writeFile(auditPath, `${lines.join("\n")}\n`, "utf8");

      const restarted = service(root);
      await expect(restarted.getAgent(generated.agentId, CONTEXT.tenantId)).resolves.toMatchObject({
        agentId: generated.agentId,
        status: "ACTIVE",
      });
      const repaired = await createAgentFileStore({ dataDir: root, secret: SECRET })
        .readAudit(generated.agentId, 100);
      expect(repaired.some((event) => event.id === removed.id)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when an event with the same identity diverges from central audit", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-diverge-"));
    try {
      const generated = await generate(root);
      const auditPath = join(root, "agents", generated.agentId, "audit.ndjson");
      const events = (await readFile(auditPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      events.at(-1).event.reason = "tampered mirror content";
      await writeFile(auditPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

      await expect(service(root).getAgent(generated.agentId, CONTEXT.tenantId)).rejects.toMatchObject({
        code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed on a missing middle event instead of appending it as a false suffix", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-middle-gap-"));
    try {
      const generated = await generate(root);
      const auditPath = join(root, "agents", generated.agentId, "audit.ndjson");
      const events = (await readFile(auditPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      expect(events.length).toBeGreaterThan(2);
      events.splice(1, 1);
      await writeFile(auditPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

      await expect(service(root).getAgent(generated.agentId, CONTEXT.tenantId)).rejects.toMatchObject({
        code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when retained mirror events are reordered", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-reordered-"));
    try {
      const generated = await generate(root);
      const auditPath = join(root, "agents", generated.agentId, "audit.ndjson");
      const events = (await readFile(auditPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      expect(events.length).toBeGreaterThan(2);
      [events[0], events[1]] = [events[1], events[0]];
      await writeFile(auditPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");

      await expect(service(root).getAgent(generated.agentId, CONTEXT.tenantId)).rejects.toMatchObject({
        code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an unsigned forged prefix", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-unsigned-prefix-"));
    try {
      const generated = await generate(root);
      const auditPath = join(root, "agents", generated.agentId, "audit.ndjson");
      const original = await readFile(auditPath, "utf8");
      const forged = JSON.stringify({
        id: "age_forged_unsigned_prefix",
        eventType: "TOOL_ALLOWED",
        agentId: generated.agentId,
        tenantId: CONTEXT.tenantId,
        timestamp: NOW,
      });
      await writeFile(auditPath, `${forged}\n${original}`, "utf8");

      await expect(service(root).getAgent(generated.agentId, CONTEXT.tenantId)).rejects.toMatchObject({
        code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an authenticated unknown prefix while central audit is untruncated", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-auth-prefix-"));
    try {
      const generated = await generate(root);
      const files = createAgentFileStore({ dataDir: root, secret: SECRET });
      const original = await files.readAudit(generated.agentId, 100);
      const auditPath = join(root, "agents", generated.agentId, "audit.ndjson");
      await rm(auditPath);
      await files.appendAudit(generated.agentId, {
        id: "age_authenticated_but_not_central",
        eventType: "TOOL_ALLOWED",
        agentId: generated.agentId,
        tenantId: CONTEXT.tenantId,
        timestamp: NOW,
      });
      for (const event of original) await files.appendAudit(generated.agentId, event);

      await expect(service(root).getAgent(generated.agentId, CONTEXT.tenantId)).rejects.toMatchObject({
        code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts only authenticated ordered history prefixes after central truncation", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-truncated-prefix-"));
    const auditEnv = {
      AI_GATEWAY_AGENT_GOVERNANCE_AUDIT_MAX_RECORDS: "10",
      AI_GATEWAY_AGENT_GOVERNANCE_AUDIT_ARCHIVE_MAX_SEGMENTS: "1",
      AI_GATEWAY_AGENT_GOVERNANCE_AUDIT_ARCHIVE_MAX_BYTES: "1048576",
    };
    try {
      const current = service(root, auditEnv);
      const generated = await current.generateAgent({
        name: "truncated-mirror-agent",
        task: "produce retained audit history",
        requestedTools: ["file_read"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, CONTEXT);
      for (let index = 0; index < 35; index += 1) {
        await current.emitAudit({
          eventType: "TOOL_REQUESTED",
          agentId: generated.agentId,
          tenantId: CONTEXT.tenantId,
          toolName: "file_read",
          reason: `rotation-${index}`,
        });
      }
      expect(await readFile(join(root, "audit-events.jsonl"), "utf8")).toContain('"truncated":true');

      await expect(service(root, auditEnv).getAgent(generated.agentId, CONTEXT.tenantId))
        .resolves.toMatchObject({ agentId: generated.agentId, status: "ACTIVE" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a hard-linked audit target instead of appending outside its single-file boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-mirror-hardlink-"));
    try {
      const files = createAgentFileStore({ dataDir: root, secret: SECRET });
      const agentId = "agt_audit_hardlink";
      await files.appendAudit(agentId, {
        id: "age_initial",
        eventType: "TOOL_REQUESTED",
        agentId,
        tenantId: CONTEXT.tenantId,
        timestamp: NOW,
      });
      const auditPath = join(root, "agents", agentId, "audit.ndjson");
      await link(auditPath, join(root, "outside-audit-hardlink.ndjson"));
      await expect(files.appendAudit(agentId, {
        id: "age_must_not_append",
        eventType: "TOOL_COMPLETED",
        agentId,
        tenantId: CONTEXT.tenantId,
        toolName: "file_read",
        argumentsRedacted: true,
        resultStatus: "success",
        timestamp: NOW,
      })).rejects.toThrow(/single-link regular file/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
