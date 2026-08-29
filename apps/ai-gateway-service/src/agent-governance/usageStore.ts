/**
 * Per-agent usage counters (tool calls, steps, records).
 *
 * Enforced on every tool call against the compiled policy limits;
 * persisted atomically so ceilings survive restarts.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentUsageCounters } from "@unified-ai-system/shared-contracts";

export interface UsageStore {
  get(agentId: string): Promise<AgentUsageCounters>;
  increment(agentId: string, field: keyof AgentUsageCounters): Promise<AgentUsageCounters>;
  reset(agentId: string): Promise<void>;
}

interface UsageFile {
  version: 1;
  updatedAt: string;
  usage: Record<string, AgentUsageCounters>;
}

export function createUsageStore(options: { dataDir?: string; now?: () => string } = {}): UsageStore {
  const dataDir = options.dataDir ?? ".data/agent-governance";
  const storePath = join(dataDir, "usage.json");
  const now = options.now ?? (() => new Date().toISOString());
  const usage = new Map<string, AgentUsageCounters>();
  let loaded = false;
  let dirty = false;

  async function flush(): Promise<void> {
    if (!dirty) return;
    const file: UsageFile = {
      version: 1,
      updatedAt: now(),
      usage: Object.fromEntries(usage),
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
      const data = JSON.parse(raw) as UsageFile;
      if (data && typeof data === "object" && data.usage) {
        for (const [id, counters] of Object.entries(data.usage)) {
          usage.set(id, counters);
        }
      }
    } catch {
      // Fresh store.
    }
    loaded = true;
  }

  return {
    async get(agentId) {
      await load();
      return usage.get(agentId) ?? { toolCalls: 0, steps: 0, records: 0 };
    },
    async increment(agentId, field) {
      await load();
      const current = usage.get(agentId) ?? { toolCalls: 0, steps: 0, records: 0 };
      current[field] += 1;
      usage.set(agentId, current);
      dirty = true;
      await flush();
      return current;
    },
    async reset(agentId) {
      await load();
      usage.set(agentId, { toolCalls: 0, steps: 0, records: 0 });
      dirty = true;
      await flush();
    },
  };
}
