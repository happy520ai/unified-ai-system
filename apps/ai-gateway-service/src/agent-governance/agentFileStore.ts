/**
 * Per-agent file bundle store.
 *
 * Every governed agent gets an independent directory:
 *   {dataDir}/agents/{agentId}/
 *     agent.json            — identity, purpose, classification, lifecycle
 *     policy-delta.json     — instance rules + inheritance references
 *     effective-policy.json — compiled permission snapshot
 *     manifest.json         — hashes + HMAC signature
 *     audit.ndjson          — append-only audit trail
 *
 * Writes are atomic (tmp + rename). JSON is used instead of the
 * specification's YAML to stay dependency-free — the five-file semantics
 * (immutable delta, compiled snapshot, signed manifest, append-only
 * audit) are preserved exactly.
 */

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentGovernanceAuditEvent,
  AgentPolicyManifest,
  AgentRegistryRecord,
  EffectiveAgentPolicy,
  PolicyLayerContent,
} from "@unified-ai-system/shared-contracts";

export interface AgentPolicyDelta {
  agentId: string;
  inherits: Array<{ policyKey: string; version: number }>;
  instanceRules: PolicyLayerContent;
}

export interface AgentFileStore {
  writeAgentBundle(input: {
    record: AgentRegistryRecord;
    delta: AgentPolicyDelta;
    policy: EffectiveAgentPolicy;
    manifest: AgentPolicyManifest;
  }): Promise<void>;
  loadPolicy(agentId: string): Promise<EffectiveAgentPolicy | null>;
  loadManifest(agentId: string): Promise<AgentPolicyManifest | null>;
  loadDelta(agentId: string): Promise<AgentPolicyDelta | null>;
  appendAudit(agentId: string, event: AgentGovernanceAuditEvent): Promise<void>;
  readAudit(agentId: string, limit?: number): Promise<AgentGovernanceAuditEvent[]>;
  agentDir(agentId: string): string;
}

async function writeAtomicJson(path: string, value: unknown): Promise<void> {
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(value, null, 2), "utf8");
  await rename(tmpPath, path);
}

export function createAgentFileStore(options: { dataDir?: string } = {}): AgentFileStore {
  const dataDir = options.dataDir ?? ".data/agent-governance";

  function agentDir(agentId: string): string {
    // Agent ids are generated server-side (agt_<uuid>); reject anything
    // that could escape the directory.
    if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)) {
      throw new Error("Invalid agent id for file storage.");
    }
    return join(dataDir, "agents", agentId);
  }

  return {
    agentDir,
    async writeAgentBundle({ record, delta, policy, manifest }) {
      const dir = agentDir(record.agentId);
      await mkdir(dir, { recursive: true });
      await writeAtomicJson(join(dir, "agent.json"), record);
      await writeAtomicJson(join(dir, "policy-delta.json"), delta);
      await writeAtomicJson(join(dir, "effective-policy.json"), policy);
      await writeAtomicJson(join(dir, "manifest.json"), manifest);
    },
    async loadPolicy(agentId) {
      try {
        const raw = await readFile(join(agentDir(agentId), "effective-policy.json"), "utf8");
        return JSON.parse(raw) as EffectiveAgentPolicy;
      } catch {
        return null;
      }
    },
    async loadManifest(agentId) {
      try {
        const raw = await readFile(join(agentDir(agentId), "manifest.json"), "utf8");
        return JSON.parse(raw) as AgentPolicyManifest;
      } catch {
        return null;
      }
    },
    async loadDelta(agentId) {
      try {
        const raw = await readFile(join(agentDir(agentId), "policy-delta.json"), "utf8");
        return JSON.parse(raw) as AgentPolicyDelta;
      } catch {
        return null;
      }
    },
    async appendAudit(agentId, event) {
      const dir = agentDir(agentId);
      await mkdir(dir, { recursive: true });
      // Append-only: history is never rewritten.
      await appendFile(join(dir, "audit.ndjson"), `${JSON.stringify(event)}\n`, "utf8");
    },
    async readAudit(agentId, limit = 100) {
      try {
        const raw = await readFile(join(agentDir(agentId), "audit.ndjson"), "utf8");
        const lines = raw.split("\n").filter((line) => line.trim() !== "");
        return lines.slice(-limit).map((line) => JSON.parse(line) as AgentGovernanceAuditEvent);
      } catch {
        return [];
      }
    },
  };
}
