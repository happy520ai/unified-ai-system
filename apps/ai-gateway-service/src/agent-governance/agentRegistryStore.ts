/**
 * Central agent registry store.
 *
 * Persisted, atomically-written registry of every governed agent with
 * lineage, classification, lifecycle status and policy hash. Tenant
 * reads are fail-closed: a missing or mismatched tenant scope is
 * indistinguishable from a missing agent.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";

export interface AgentRegistryStore {
  load(): Promise<void>;
  upsert(record: AgentRegistryRecord): Promise<void>;
  get(agentId: string, tenantId: string): Promise<AgentRegistryRecord | null>;
  getUnscoped(agentId: string): Promise<AgentRegistryRecord | null>;
  listByTenant(tenantId: string): Promise<AgentRegistryRecord[]>;
  countChildren(parentAgentId: string): Promise<number>;
  listByParent(parentAgentId: string): Promise<AgentRegistryRecord[]>;
  listAll(): Promise<AgentRegistryRecord[]>;
}

interface RegistryFile {
  version: 1;
  updatedAt: string;
  agents: Record<string, AgentRegistryRecord>;
}

export function createAgentRegistryStore(options: { storePath?: string; now?: () => string } = {}): AgentRegistryStore {
  const storePath = options.storePath ?? ".data/agent-governance/agents.json";
  const now = options.now ?? (() => new Date().toISOString());
  const agents = new Map<string, AgentRegistryRecord>();
  let loaded = false;
  let dirty = false;

  async function flush(): Promise<void> {
    if (!dirty) return;
    const file: RegistryFile = {
      version: 1,
      updatedAt: now(),
      agents: Object.fromEntries(agents),
    };
    await mkdir(dirname(storePath), { recursive: true });
    const tmpPath = `${storePath}.${randomUUID()}.tmp`;
    await writeFile(tmpPath, JSON.stringify(file, null, 2), "utf8");
    await rename(tmpPath, storePath);
    dirty = false;
  }

  async function load(): Promise<void> {
    if (loaded) return;
    await mkdir(dirname(storePath), { recursive: true });
    try {
      const raw = await readFile(storePath, "utf8");
      const data = JSON.parse(raw) as RegistryFile;
      if (data && typeof data === "object" && data.agents) {
        for (const [id, record] of Object.entries(data.agents)) {
          agents.set(id, record);
        }
      }
    } catch {
      // Fresh registry.
    }
    loaded = true;
  }

  function isTenantMatch(record: AgentRegistryRecord | undefined, tenantId: string): boolean {
    return Boolean(record)
      && typeof tenantId === "string" && tenantId.trim() !== ""
      && record?.tenantId === tenantId.trim();
  }

  return {
    load,
    async upsert(record) {
      await load();
      agents.set(record.agentId, record);
      dirty = true;
      await flush();
    },
    async get(agentId, tenantId) {
      await load();
      const record = agents.get(agentId);
      // Cross-tenant reads are indistinguishable from missing agents.
      if (!record || !isTenantMatch(record, tenantId)) return null;
      return record;
    },
    async getUnscoped(agentId) {
      await load();
      return agents.get(agentId) ?? null;
    },
    async listByTenant(tenantId) {
      await load();
      return Array.from(agents.values())
        .filter((record) => record.tenantId === tenantId)
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    },
    async countChildren(parentAgentId) {
      await load();
      let count = 0;
      for (const record of agents.values()) {
        if (record.parentAgentId === parentAgentId
          && record.status !== "REVOKED" && record.status !== "ARCHIVED") {
          count += 1;
        }
      }
      return count;
    },
    async listByParent(parentAgentId) {
      await load();
      return Array.from(agents.values()).filter((record) => record.parentAgentId === parentAgentId);
    },
    async listAll() {
      await load();
      return Array.from(agents.values());
    },
  };
}
