/**
 * Durable per-agent usage counters.
 *
 * Mutations are serialized and persisted before success is returned. Corrupt
 * state is never treated as an empty ledger: only a genuinely missing file may
 * initialize a fresh store. `reserve` performs the ceiling check and increment
 * in one critical section so concurrent calls cannot all pass the same check.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentUsageCounters, PolicyLimits } from "@unified-ai-system/shared-contracts";
import { resolveGovernanceSecret } from "./governanceSecret.ts";
import { createGovernanceStateFileBinding } from "./governanceStateAnchor.ts";

export interface UsageReservationResult {
  allowed: boolean;
  counters: AgentUsageCounters;
  reason?: "TOOL_CALL_LIMIT_REACHED" | "STEP_LIMIT_REACHED" | "RECORD_LIMIT_REACHED";
}

export interface UsageStore {
  get(agentId: string): Promise<AgentUsageCounters>;
  increment(agentId: string, field: keyof AgentUsageCounters): Promise<AgentUsageCounters>;
  reserve(
    agentId: string,
    limits: PolicyLimits | undefined | null,
    delta: Partial<AgentUsageCounters>,
  ): Promise<UsageReservationResult>;
  release(agentId: string, delta: Partial<AgentUsageCounters>): Promise<AgentUsageCounters>;
  reset(agentId: string): Promise<void>;
}

interface UsageFile {
  version: 1;
  updatedAt: string;
  usage: Record<string, AgentUsageCounters>;
}

const EMPTY_COUNTERS: AgentUsageCounters = Object.freeze({ toolCalls: 0, steps: 0, records: 0 });

export function createUsageStore(options: { dataDir?: string; now?: () => string; secret?: string } = {}): UsageStore {
  const dataDir = options.dataDir ?? ".data/agent-governance";
  const storePath = join(dataDir, "usage.json");
  const now = options.now ?? (() => new Date().toISOString());
  const state = createGovernanceStateFileBinding({
    filePath: storePath,
    secret: options.secret ?? resolveGovernanceSecret({ dataDir }),
    kind: "json",
    validateLegacy: (content) => { parseUsageFile(content.toString("utf8")); },
  });
  const usage = new Map<string, AgentUsageCounters>();
  let loadPromise: Promise<void> | null = null;
  let mutationTail: Promise<void> = Promise.resolve();

  function load(): Promise<void> {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      await state.verify();
      try {
        const raw = await readFile(storePath, "utf8");
        const data = parseUsageFile(raw);
        for (const [id, counters] of Object.entries(data.usage)) {
          usage.set(id, counters);
        }
      } catch (error) {
        if (isMissingFile(error)) return;
        if ((error as Error)?.name === "GovernanceUsageStoreCorrupt") throw error;
        throw corrupt("Usage store could not be parsed or read.", error);
      }
    })();
    return loadPromise;
  }

  async function persist(): Promise<void> {
    const file: UsageFile = {
      version: 1,
      updatedAt: now(),
      usage: Object.fromEntries(Array.from(usage.entries()).map(([id, counters]) => [id, { ...counters }])),
    };
    await state.commit(JSON.stringify(file, null, 2));
  }

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    async get(agentId) {
      assertAgentId(agentId);
      await load();
      await mutationTail;
      await state.verify();
      return { ...(usage.get(agentId) ?? EMPTY_COUNTERS) };
    },
    async increment(agentId, field) {
      const result = await this.reserve(agentId, null, { [field]: 1 });
      return result.counters;
    },
    async reserve(agentId, limits, delta) {
      assertAgentId(agentId);
      await load();
      return exclusive(async () => {
        await state.verify();
        const previous = { ...(usage.get(agentId) ?? EMPTY_COUNTERS) };
        const increment = normalizeDelta(delta);
        const next: AgentUsageCounters = {
          toolCalls: previous.toolCalls + increment.toolCalls,
          steps: previous.steps + increment.steps,
          records: previous.records + increment.records,
        };
        const reason = firstExceededLimit(next, limits);
        if (reason) return { allowed: false, counters: previous, reason };
        usage.set(agentId, next);
        try {
          await persist();
        } catch (error) {
          usage.set(agentId, previous);
          throw error;
        }
        return { allowed: true, counters: { ...next } };
      });
    },
    async release(agentId, delta) {
      assertAgentId(agentId);
      await load();
      return exclusive(async () => {
        await state.verify();
        const previous = { ...(usage.get(agentId) ?? EMPTY_COUNTERS) };
        const decrement = normalizeDelta(delta);
        const next = {
          toolCalls: Math.max(0, previous.toolCalls - decrement.toolCalls),
          steps: Math.max(0, previous.steps - decrement.steps),
          records: Math.max(0, previous.records - decrement.records),
        };
        usage.set(agentId, next);
        try {
          await persist();
        } catch (error) {
          usage.set(agentId, previous);
          throw error;
        }
        return { ...next };
      });
    },
    async reset(agentId) {
      assertAgentId(agentId);
      await load();
      await exclusive(async () => {
        await state.verify();
        const previous = usage.get(agentId);
        usage.set(agentId, { ...EMPTY_COUNTERS });
        try {
          await persist();
        } catch (error) {
          if (previous) usage.set(agentId, previous);
          else usage.delete(agentId);
          throw error;
        }
      });
    },
  };
}

function parseUsageFile(raw: string): UsageFile {
  let data: UsageFile;
  try { data = JSON.parse(raw) as UsageFile; }
  catch (error) { throw corrupt("Usage store could not be parsed.", error); }
  if (data?.version !== 1 || !data.usage || typeof data.usage !== "object" || Array.isArray(data.usage)) {
    throw corrupt("Usage store has an unsupported or malformed schema.");
  }
  const normalized: Record<string, AgentUsageCounters> = {};
  for (const [id, counters] of Object.entries(data.usage)) {
    assertAgentId(id);
    normalized[id] = normalizeCounters(counters);
  }
  return { ...data, usage: normalized };
}

function normalizeCounters(input: unknown): AgentUsageCounters {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw corrupt("Usage counters must be an object.");
  }
  const record = input as Record<string, unknown>;
  return {
    toolCalls: nonNegativeInteger(record.toolCalls, "toolCalls"),
    steps: nonNegativeInteger(record.steps, "steps"),
    records: nonNegativeInteger(record.records, "records"),
  };
}

function normalizeDelta(input: Partial<AgentUsageCounters>): AgentUsageCounters {
  return {
    toolCalls: nonNegativeInteger(input?.toolCalls ?? 0, "toolCalls delta"),
    steps: nonNegativeInteger(input?.steps ?? 0, "steps delta"),
    records: nonNegativeInteger(input?.records ?? 0, "records delta"),
  };
}

function firstExceededLimit(
  next: AgentUsageCounters,
  limits: PolicyLimits | undefined | null,
): UsageReservationResult["reason"] | undefined {
  if (typeof limits?.maxToolCalls === "number" && next.toolCalls > limits.maxToolCalls) {
    return "TOOL_CALL_LIMIT_REACHED";
  }
  if (typeof limits?.maxSteps === "number" && next.steps > limits.maxSteps) {
    return "STEP_LIMIT_REACHED";
  }
  if (typeof limits?.maxRecords === "number" && next.records > limits.maxRecords) {
    return "RECORD_LIMIT_REACHED";
  }
  return undefined;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw corrupt(`Usage ${field} must be a non-negative safe integer.`);
  }
  return Number(value);
}

function assertAgentId(agentId: string): void {
  if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)) {
    throw corrupt("Usage store received an invalid Agent id.");
  }
}

function corrupt(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "GovernanceUsageStoreCorrupt";
  return error;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}
