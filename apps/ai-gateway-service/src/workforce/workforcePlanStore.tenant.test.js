import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import { createWorkforcePlan } from "./workforcePlanner.js";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function jsonStore() {
  const storePath = join(mkdtempSync(join(tmpdir(), "wfp-tenant-")), "plans.json");
  const store = createWorkforcePlanStore({ env: { WORKFORCE_PLAN_STORE_PATH: storePath } });
  return { store, storePath };
}

function sqliteStore() {
  const dbPath = join(mkdtempSync(join(tmpdir(), "wfp-tenant-sqlite-")), "plans.db");
  return createWorkforcePlanStore({
    env: { WORKFORCE_PLAN_STORE_MODE: "sqlite", WORKFORCE_PLAN_STORE_PATH: dbPath },
  });
}

async function seedTenantPlan(store, goal, tenantId) {
  const saved = await store.save(createWorkforcePlan({ goal }), tenantId);
  expect(saved.success).toBe(true);
  expect(saved.taskPackage.tenantId).toBe(tenantId);
  return saved;
}

async function expectPlanNotFound(promise) {
  await expect(promise).rejects.toMatchObject({ code: "WORKFORCE_PLAN_NOT_FOUND" });
}

describe("workforcePlanStore — tenant isolation (json backend)", () => {
  it("requires a tenant id when saving", async () => {
    const { store } = jsonStore();
    await expect(store.save(createWorkforcePlan({ goal: "no tenant" }))).rejects.toMatchObject({
      code: "WORKFORCE_PLAN_TENANT_REQUIRED",
    });
    await expect(store.save(createWorkforcePlan({ goal: "blank tenant" }), "   ")).rejects.toMatchObject({
      code: "WORKFORCE_PLAN_TENANT_REQUIRED",
    });
  });

  it("lists only the requesting tenant's plans", async () => {
    const { store } = jsonStore();
    await seedTenantPlan(store, "tenant a goal", TENANT_A);
    await seedTenantPlan(store, "tenant b goal", TENANT_B);

    const listA = await store.list(TENANT_A);
    expect(listA.count).toBe(1);
    expect(listA.plans.map((plan) => plan.goal)).toEqual(["tenant a goal"]);

    const listB = await store.list(TENANT_B);
    expect(listB.count).toBe(1);
    expect(listB.plans.map((plan) => plan.goal)).toEqual(["tenant b goal"]);

    expect((await store.list("tenant-c")).count).toBe(0);
    // Fail-closed: without a tenant scope nothing is visible.
    expect((await store.list()).count).toBe(0);
    expect((await store.list(undefined)).count).toBe(0);
  });

  it("treats cross-tenant get/export/review-package access as not-found", async () => {
    const { store } = jsonStore();
    const saved = await seedTenantPlan(store, "isolated goal", TENANT_A);

    expect((await store.get(saved.planId, TENANT_A)).plan.goal).toBe("isolated goal");
    await expectPlanNotFound(store.get(saved.planId, TENANT_B));
    await expectPlanNotFound(store.get(saved.planId));
    await expectPlanNotFound(store.export(saved.planId, TENANT_B));
    await expectPlanNotFound(store.getReviewPackage(saved.planId, TENANT_B));

    const exported = await store.export(saved.planId, TENANT_A);
    expect(exported.status).toBe("export_ready");
    const review = await store.getReviewPackage(saved.planId, TENANT_A);
    expect(review.status).toBe("review_package_ready");
  });

  it("treats cross-tenant delete and mutations as not-found", async () => {
    const { store } = jsonStore();
    const saved = await seedTenantPlan(store, "mutation target", TENANT_A);

    await expectPlanNotFound(store.delete(saved.planId, TENANT_B));
    await expectPlanNotFound(store.answerClarifications(saved.planId, [], TENANT_B));
    await expectPlanNotFound(store.updateLifecycle(saved.planId, { state: "clarified" }, TENANT_B));
    await expectPlanNotFound(store.recordApprovalGate(saved.planId, { decision: "approved-preview" }, TENANT_B));
    await expectPlanNotFound(store.delete(saved.planId));
    // The plan is untouched by the failed cross-tenant operations.
    expect((await store.list(TENANT_A)).count).toBe(1);

    await store.updateLifecycle(saved.planId, { state: "clarified" }, TENANT_A);
    await store.recordApprovalGate(saved.planId, { decision: "approved-preview" }, TENANT_A);
    const answered = await store.answerClarifications(saved.planId, [], TENANT_A);
    expect(answered.status).toBe("clarification_answers_saved");

    await store.delete(saved.planId, TENANT_A);
    expect((await store.list(TENANT_A)).count).toBe(0);
  });

  it("keeps legacy records without a tenant stamp invisible (fail-closed)", async () => {
    const { store, storePath } = jsonStore();
    const saved = await seedTenantPlan(store, "legacy candidate", TENANT_A);

    // Rewrite the stored record without a tenantId, simulating a store file
    // written before tenant stamping existed.
    const raw = JSON.parse(readFileSync(storePath, "utf8"));
    const legacy = raw.plans.find((plan) => plan.planId === saved.planId);
    expect(legacy).toBeDefined();
    delete legacy.tenantId;
    writeFileSync(storePath, JSON.stringify(raw), "utf8");

    expect((await store.list(TENANT_A)).count).toBe(0);
    await expectPlanNotFound(store.get(saved.planId, TENANT_A));
    await expectPlanNotFound(store.delete(saved.planId, TENANT_A));
    await expectPlanNotFound(store.updateLifecycle(saved.planId, { state: "clarified" }, TENANT_A));
  });

  it("does not let one tenant delete another tenant's plan under the same store", async () => {
    const { store } = jsonStore();
    const a = await seedTenantPlan(store, "tenant a keeps this", TENANT_A);

    await expectPlanNotFound(store.delete(a.planId, TENANT_B));
    expect((await store.list(TENANT_A)).count).toBe(1);
    expect((await store.list(TENANT_B)).count).toBe(0);
  });
});

describe("workforcePlanStore — tenant isolation (sqlite backend)", () => {
  it("scopes list/get/delete by tenant on the sqlite backend", async () => {
    const store = sqliteStore();
    const savedA = await seedTenantPlan(store, "sqlite tenant a", TENANT_A);
    await seedTenantPlan(store, "sqlite tenant b", TENANT_B);

    expect((await store.list(TENANT_A)).count).toBe(1);
    await expect(store.get(savedA.planId, TENANT_B)).rejects.toMatchObject({
      code: "WORKFORCE_PLAN_NOT_FOUND",
    });
    await expectPlanNotFound(store.delete(savedA.planId, TENANT_B));
    expect((await store.list(TENANT_A)).count).toBe(1);

    await store.delete(savedA.planId, TENANT_A);
    expect((await store.list(TENANT_A)).count).toBe(0);
    expect((await store.list(TENANT_B)).count).toBe(1);
  });
});
