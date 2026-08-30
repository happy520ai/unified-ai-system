/**
 * Central agent registry store.
 *
 * Persisted, atomically-written registry of every governed agent with
 * lineage, classification, lifecycle status and policy hash. Tenant
 * reads are fail-closed: a missing or mismatched tenant scope is
 * indistinguishable from a missing agent.
 */

import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";
import { resolveGovernanceSecret } from "./governanceSecret.ts";
import { createGovernanceStateFileBinding } from "./governanceStateAnchor.ts";

export interface AgentRegistryStore {
  load(): Promise<void>;
  upsert(record: AgentRegistryRecord): Promise<void>;
  /** Validates every record and persists the complete batch in one commit. */
  upsertMany(records: AgentRegistryRecord[]): Promise<void>;
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

export function createAgentRegistryStore(options: { storePath?: string; now?: () => string; secret?: string } = {}): AgentRegistryStore {
  const storePath = options.storePath ?? ".data/agent-governance/agents.json";
  const now = options.now ?? (() => new Date().toISOString());
  const state = createGovernanceStateFileBinding({
    filePath: storePath,
    secret: options.secret ?? resolveGovernanceSecret({ dataDir: dirname(storePath) }),
    kind: "json",
    validateLegacy: (content) => { parseRegistryFile(content.toString("utf8")); },
  });
  const agents = new Map<string, AgentRegistryRecord>();
  let loaded = false;
  let loadPromise: Promise<void> | null = null;
  let dirty = false;
  let mutationTail: Promise<void> = Promise.resolve();

  async function flush(): Promise<void> {
    if (!dirty) return;
    const file: RegistryFile = {
      version: 1,
      updatedAt: now(),
      agents: Object.fromEntries(agents),
    };
    await state.commit(JSON.stringify(file, null, 2));
    dirty = false;
  }

  async function load(): Promise<void> {
    if (loaded) return;
    if (!loadPromise) {
      loadPromise = (async () => {
        await state.verify();
        try {
          const raw = await readFile(storePath, "utf8");
          const data = parseRegistryFile(raw);
          for (const [id, candidate] of Object.entries(data.agents)) {
            agents.set(id, candidate);
          }
        } catch (error) {
          if (isMissingFile(error)) return;
          if ((error as Error)?.name === "GovernanceAgentRegistryCorrupt") throw error;
          throw corrupt("Agent registry could not be parsed or read.", error);
        }
        loaded = true;
      })();
    }
    await loadPromise;
  }

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  function isTenantMatch(record: AgentRegistryRecord | undefined, tenantId: string): boolean {
    return Boolean(record)
      && typeof tenantId === "string" && tenantId.trim() !== ""
      && record?.tenantId === tenantId.trim();
  }

  async function upsertMany(records: AgentRegistryRecord[]): Promise<void> {
    await load();
    if (!Array.isArray(records) || records.length === 0) return;
    const validated = records.map((record) => validateRecord(record?.agentId, record));
    const ids = new Set(validated.map((record) => record.agentId));
    if (ids.size !== validated.length) {
      throw corrupt("Agent registry batch contains duplicate identities.");
    }
    await exclusive(async () => {
      await state.verify();
      const previous = new Map<string, AgentRegistryRecord | null>();
      for (const record of validated) {
        previous.set(record.agentId, agents.get(record.agentId) ?? null);
        agents.set(record.agentId, record);
      }
      dirty = true;
      try {
        await flush();
      } catch (error) {
        for (const [agentId, prior] of previous) {
          if (prior) agents.set(agentId, prior);
          else agents.delete(agentId);
        }
        dirty = false;
        throw error;
      }
    });
  }

  return {
    load,
    async upsert(record) {
      await upsertMany([record]);
    },
    upsertMany,
    async get(agentId, tenantId) {
      await load();
      await state.verify();
      const record = agents.get(agentId);
      // Cross-tenant reads are indistinguishable from missing agents.
      if (!record || !isTenantMatch(record, tenantId)) return null;
      return structuredClone(record);
    },
    async getUnscoped(agentId) {
      await load();
      await state.verify();
      const record = agents.get(agentId);
      return record ? structuredClone(record) : null;
    },
    async listByTenant(tenantId) {
      await load();
      await state.verify();
      return Array.from(agents.values())
        .filter((record) => record.tenantId === tenantId)
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
        .map((record) => structuredClone(record));
    },
    async countChildren(parentAgentId) {
      await load();
      await state.verify();
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
      await state.verify();
      return Array.from(agents.values())
        .filter((record) => record.parentAgentId === parentAgentId)
        .map((record) => structuredClone(record));
    },
    async listAll() {
      await load();
      await state.verify();
      return Array.from(agents.values()).map((record) => structuredClone(record));
    },
  };
}

function parseRegistryFile(raw: string): RegistryFile {
  let data: RegistryFile;
  try { data = JSON.parse(raw) as RegistryFile; }
  catch (error) { throw corrupt("Agent registry could not be parsed.", error); }
  if (data?.version !== 1 || !data.agents || typeof data.agents !== "object" || Array.isArray(data.agents)) {
    throw corrupt("Agent registry has an unsupported or malformed schema.");
  }
  const agents: Record<string, AgentRegistryRecord> = {};
  for (const [id, candidate] of Object.entries(data.agents)) agents[id] = validateRecord(id, candidate);
  return { ...data, agents };
}

function validateRecord(id: string, input: unknown): AgentRegistryRecord {
  if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(id) || !input || typeof input !== "object" || Array.isArray(input)) {
    throw corrupt("Agent registry record identity is malformed.");
  }
  const record = input as AgentRegistryRecord;
  if (record.agentId !== id || typeof record.tenantId !== "string" || record.tenantId.trim() === ""
    || typeof record.ownerUserId !== "string" || record.ownerUserId.trim() === ""
    || typeof record.createdBy !== "string" || record.createdBy.trim() === ""
    || !Array.isArray(record.requestedTools) || !Array.isArray(record.grantedTools)
    || typeof record.policyHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(record.policyHash)
    || typeof record.status !== "string" || !Number.isSafeInteger(record.generationDepth)
    || record.generationDepth < 0 || !Number.isFinite(Date.parse(record.createdAt))
    || !Number.isFinite(Date.parse(record.expiresAt))) {
    throw corrupt(`Agent registry record ${id} is malformed.`);
  }
  return structuredClone(record);
}

function corrupt(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "GovernanceAgentRegistryCorrupt";
  return error;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}
