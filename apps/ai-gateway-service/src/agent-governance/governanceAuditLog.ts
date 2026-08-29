/**
 * Central governance audit log.
 *
 * Every governance event lands in one append-only JSONL stream plus the
 * agent's own audit.ndjson. Arguments are redacted before recording:
 * credential-bearing fields never enter the audit trail in plaintext.
 */

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  AGENT_GOVERNANCE_REDACTED_FIELDS,
} from "@unified-ai-system/shared-contracts";
import type { AgentGovernanceAuditEvent } from "@unified-ai-system/shared-contracts";

export interface GovernanceAuditLog {
  record(event: AgentGovernanceAuditEvent): Promise<void>;
  read(limit?: number): Promise<AgentGovernanceAuditEvent[]>;
}

export function createGovernanceAuditLog(options: { logPath?: string } = {}): GovernanceAuditLog {
  const logPath = options.logPath ?? ".data/agent-governance/audit-events.jsonl";
  let initialized = false;

  async function ensureDir(): Promise<void> {
    if (initialized) return;
    await mkdir(dirname(logPath), { recursive: true });
    initialized = true;
  }

  return {
    async record(event) {
      await ensureDir();
      await appendFile(logPath, `${JSON.stringify({ ...event, _id: randomUUID() })}\n`, "utf8");
    },
    async read(limit = 200) {
      try {
        const raw = await readFile(logPath, "utf8");
        const lines = raw.split("\n").filter((line) => line.trim() !== "");
        return lines.slice(-limit).map((line) => JSON.parse(line) as AgentGovernanceAuditEvent);
      } catch {
        return [];
      }
    },
  };
}

/**
 * Redact credential-bearing argument fields before audit recording.
 * Field names are matched case-insensitively against the deny list.
 */
export function redactArguments(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { value: typeof args };
  }
  const record = args as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const sensitive = AGENT_GOVERNANCE_REDACTED_FIELDS.some(
      (field) => key.toLowerCase().includes(field.toLowerCase()),
    );
    redacted[key] = sensitive ? "***REDACTED***" : truncate(value);
  }
  return redacted;
}

function truncate(value: unknown): unknown {
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}...(truncated)`;
  }
  return value;
}
