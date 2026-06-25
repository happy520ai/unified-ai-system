import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createWorkforceService } from "./workforceService.js";

describe("workforce-service", () => {
  let service;

  before(() => {
    service = createWorkforceService();
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    assert.equal(h.status, "ready");
    assert.equal(h.ready, true);
    assert.equal(h.roleCount, 7);
  });

  it("lists 7 workforce roles", () => {
    const agents = service.listAgents();
    assert.equal(agents.agents.length, 7);
    const roles = agents.agents.map((a) => a.roleId);
    assert.ok(roles.includes("ceo"));
    assert.ok(roles.includes("pm"));
    assert.ok(roles.includes("architect"));
    assert.ok(roles.includes("frontend-engineer"));
    assert.ok(roles.includes("backend-engineer"));
    assert.ok(roles.includes("qa"));
    assert.ok(roles.includes("reviewer"));
  });

  it("generates a workforce plan", () => {
    const plan = service.plan({ goal: "Build a login page" });
    assert.ok(plan.workforceId !== undefined);
    assert.equal(plan.goal, "Build a login page");
    assert.equal(plan.taskBreakdown.length, 7);
    assert.equal(plan.roleAssignments.length, 7);
    assert.ok(plan.deliverables.length > 0);
  });

  it("saves and retrieves plans", async () => {
    const plan = service.plan({ goal: "Test save" });
    const saved = await service.savePlan({ plan });
    assert.ok(saved.planId !== undefined);

    const list = await service.listPlans();
    assert.ok(list.plans.length > 0);

    const retrieved = await service.getPlan(saved.planId);
    assert.equal(retrieved.plan.goal, "Test save");

    await service.deletePlan(saved.planId);
    const afterDelete = await service.listPlans();
    assert.equal(afterDelete.plans.some((p) => p.planId === saved.planId), false);
  });

  it("exports plan as task package", async () => {
    const plan = service.plan({ goal: "Test export" });
    const saved = await service.savePlan({ plan });
    const exported = await service.exportPlan(saved.planId);
    assert.ok(exported.taskPackage !== undefined);
    assert.equal(exported.taskPackage.goal, "Test export");
    await service.deletePlan(saved.planId);
  });
});
