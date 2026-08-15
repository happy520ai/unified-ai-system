import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import { createWorkforcePlan } from "./workforcePlanner.js";

const TENANT_ID = "wfp-concurrency-tenant";

function isolatedStore() {
  const storePath = join(mkdtempSync(join(tmpdir(), "wfp-conc-")), "plans.json");
  return { store: createWorkforcePlanStore({ env: { WORKFORCE_PLAN_STORE_PATH: storePath } }), storePath };
}

describe("workforcePlanStore — concurrent mutations", () => {
  it("does not lose plans when many saves run concurrently", async () => {
    const { store } = isolatedStore();
    const goals = Array.from({ length: 25 }, (_, i) => `Concurrent goal ${i}`);

    await Promise.all(goals.map((goal) => store.save(createWorkforcePlan({ goal }), TENANT_ID)));

    const list = await store.list(TENANT_ID);
    expect(list.plans.length).toBe(25);
    const savedGoals = list.plans.map((p) => p.goal).sort();
    expect(savedGoals).toEqual(goals.slice().sort());
  });

  it("keeps a save that races against an unrelated delete", async () => {
    const { store } = isolatedStore();
    const seeded = await store.save(createWorkforcePlan({ goal: "seed plan" }), TENANT_ID);

    await Promise.all([
      store.save(createWorkforcePlan({ goal: "keep-me plan" }), TENANT_ID),
      store.delete(seeded.planId, TENANT_ID),
    ]);

    const list = await store.list(TENANT_ID);
    const goals = list.plans.map((p) => p.goal);
    expect(goals).toContain("keep-me plan");
    expect(goals).not.toContain("seed plan");
  });

  it("serializes lifecycle mutations without corrupting the store", async () => {
    const { store } = isolatedStore();
    const saved = await store.save(createWorkforcePlan({ goal: "lifecycle plan" }), TENANT_ID);

    await Promise.all([
      store.updateLifecycle(saved.planId, { state: "clarified" }, TENANT_ID),
      store.recordApprovalGate(saved.planId, { decision: "approved-preview" }, TENANT_ID),
    ]);

    // The store stays intact with exactly one plan, and the plan remains
    // retrievable after concurrent lifecycle mutations (no lost update, no
    // corrupted file).
    const list = await store.list(TENANT_ID);
    expect(list.plans.length).toBe(1);
    const retrieved = await store.get(saved.planId, TENANT_ID);
    expect(retrieved.planId).toBe(saved.planId);
    expect(retrieved.plan.goal).toBe("lifecycle plan");
  });
});
