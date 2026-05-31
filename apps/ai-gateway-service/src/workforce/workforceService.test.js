import { describe, it, expect, beforeAll } from "vitest";
import { createWorkforceService } from "./workforceService.js";

describe("workforce-service", () => {
  let service;

  beforeAll(() => {
    service = createWorkforceService();
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    expect(h.status).toBe("ready");
    expect(h.ready).toBe(true);
    expect(h.roleCount).toBe(7);
  });

  it("lists 7 workforce roles", () => {
    const agents = service.listAgents();
    expect(agents.agents.length).toBe(7);
    const roles = agents.agents.map((a) => a.roleId);
    expect(roles).toContain("ceo");
    expect(roles).toContain("pm");
    expect(roles).toContain("architect");
    expect(roles).toContain("frontend-engineer");
    expect(roles).toContain("backend-engineer");
    expect(roles).toContain("qa");
    expect(roles).toContain("reviewer");
  });

  it("generates a workforce plan", () => {
    const plan = service.plan({ goal: "Build a login page" });
    expect(plan.workforceId).toBeDefined();
    expect(plan.goal).toBe("Build a login page");
    expect(plan.taskBreakdown.length).toBe(7);
    expect(plan.roleAssignments.length).toBe(7);
    expect(plan.deliverables.length).toBeGreaterThan(0);
  });

  it("saves and retrieves plans", async () => {
    const plan = service.plan({ goal: "Test save" });
    const saved = await service.savePlan({ plan });
    expect(saved.planId).toBeDefined();

    const list = await service.listPlans();
    expect(list.plans.length).toBeGreaterThan(0);

    const retrieved = await service.getPlan(saved.planId);
    expect(retrieved.plan.goal).toBe("Test save");

    await service.deletePlan(saved.planId);
    const afterDelete = await service.listPlans();
    expect(afterDelete.plans.some((p) => p.planId === saved.planId)).toBe(false);
  });

  it("exports plan as task package", async () => {
    const plan = service.plan({ goal: "Test export" });
    const saved = await service.savePlan({ plan });
    const exported = await service.exportPlan(saved.planId);
    expect(exported.taskPackage).toBeDefined();
    expect(exported.taskPackage.goal).toBe("Test export");
    await service.deletePlan(saved.planId);
  });
});







