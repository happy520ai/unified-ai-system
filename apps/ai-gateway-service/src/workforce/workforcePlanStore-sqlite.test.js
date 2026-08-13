import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import { createWorkforcePlan } from "./workforcePlanner.js";

function sqliteStore() {
  const dbPath = join(mkdtempSync(join(tmpdir(), "wfp-sqlite-")), "plans.db");
  return createWorkforcePlanStore({
    env: { WORKFORCE_PLAN_STORE_MODE: "sqlite", WORKFORCE_PLAN_STORE_PATH: dbPath },
  });
}

describe("workforcePlanStore — sqlite backend", () => {
  it("saves, lists, gets and deletes plans", async () => {
    const store = sqliteStore();
    const saved = await store.save(createWorkforcePlan({ goal: "sqlite save" }));
    expect(saved.planId).toBeDefined();

    const list = await store.list();
    expect(list.plans.length).toBe(1);
    expect(list.plans[0].goal).toBe("sqlite save");

    const retrieved = await store.get(saved.planId);
    expect(retrieved.plan.goal).toBe("sqlite save");

    await store.delete(saved.planId);
    const after = await store.list();
    expect(after.plans.length).toBe(0);
  });

  it("does not lose plans on concurrent saves", async () => {
    const store = sqliteStore();
    const goals = Array.from({ length: 25 }, (_, i) => `sqlite concurrent ${i}`);
    await Promise.all(goals.map((goal) => store.save(createWorkforcePlan({ goal }))));
    const list = await store.list();
    expect(list.plans.length).toBe(25);
  });
});
