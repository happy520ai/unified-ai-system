import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkforceService } from "./workforceService.js";

function expectModuleOnly(state: unknown) {
  expect(state).toMatchObject({ workflowRunHandoff: { status: "module-only", implemented: true,
    runtimeConnected: false, enabled: false, enabledByDefault: false, lifecycleStatus: "handoff-disabled" }, drivesExecution: false });
  expect(JSON.stringify(state)).not.toContain("Workflow run handoff is not implemented.");
}

describe("Workforce handoff capability consistency", () => {
  it("keeps module implementation separate from connected execution through preview/save/read/export", async () => {
    const root = await mkdtemp(join(tmpdir(), "workforce-handoff-status-"));
    const service = createWorkforceService({ env: { WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json") } });
    try {
      const plan = service.plan({ goal: "A bounded status review" });
      expectModuleOnly(plan.planState);
      const saved = await service.savePlan({ plan }, "status-test");
      const read = await service.getPlan(saved.planId, "status-test");
      expectModuleOnly(read.taskPackage.planState);
      expectModuleOnly(read.plan.planState);
      const exported = await service.exportPlan(saved.planId, "status-test");
      expectModuleOnly(exported.taskPackage.planState);
      expect(exported.markdown).toContain("module-only");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not revive stale available/implemented-false claims supplied in a saved preview", async () => {
    const root = await mkdtemp(join(tmpdir(), "workforce-handoff-stale-"));
    const service = createWorkforceService({ env: { WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json") } });
    try {
      const plan = service.plan({ goal: "Legacy preview" });
      const stalePlan = { ...plan, planState: { ...plan.planState,
        workflowRunHandoff: { status: "handoff-available", implemented: false, enabled: true, runtimeConnected: true },
        hud: { blockers: ["Workflow run handoff is not implemented."] },
      } };
      const saved = await service.savePlan({ plan: stalePlan }, "status-test");
      // Simulate an old on-disk fixture, so read normalization is exercised
      // independently of the current save path. Never use an application store.
      const path = join(root, "plans.json");
      const stored = JSON.parse(await readFile(path, "utf8"));
      stored.plans[0].planState = stalePlan.planState;
      stored.plans[0].exportableJson.planState = stalePlan.planState;
      await writeFile(path, JSON.stringify(stored), "utf8");
      const read = await service.getPlan(saved.planId, "status-test");
      expectModuleOnly(read.taskPackage.planState);
      expectModuleOnly(read.plan.planState);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
