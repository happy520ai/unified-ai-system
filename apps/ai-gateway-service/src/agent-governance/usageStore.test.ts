import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createUsageStore } from "./usageStore.ts";

describe("agent governance usage store", () => {
  it("atomically reserves a hard tool-call ceiling under concurrency", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "agent-governance-usage-"));
    try {
      const store = createUsageStore({ dataDir });
      const results = await Promise.all(Array.from({ length: 32 }, () => (
        store.reserve("agt_concurrent", { maxToolCalls: 1 }, { toolCalls: 1 })
      )));
      expect(results.filter((result) => result.allowed)).toHaveLength(1);
      expect(results.filter((result) => !result.allowed)).toHaveLength(31);
      expect(await store.get("agt_concurrent")).toEqual({ toolCalls: 1, steps: 0, records: 0 });

      const reloaded = createUsageStore({ dataDir });
      expect(await reloaded.get("agt_concurrent")).toEqual({ toolCalls: 1, steps: 0, records: 0 });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("fails closed instead of resetting corrupt durable counters", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "agent-governance-usage-corrupt-"));
    try {
      await writeFile(join(dataDir, "usage.json"), "{not-json", "utf8");
      const store = createUsageStore({ dataDir });
      await expect(store.get("agt_corrupt")).rejects.toMatchObject({
        name: "GovernanceStateIntegrityError",
      });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
