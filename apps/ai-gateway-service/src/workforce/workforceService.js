import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";

export function createWorkforceService(options = {}) {
  const planStore = createWorkforcePlanStore(options);

  return {
    getHealth() {
      return {
        phase: WORKFORCE_PHASE,
        status: "ready",
        mode: "deterministic-plan-preview",
        ready: true,
        roleCount: listWorkforceRoles().length,
        planStore: planStore.getInfo(),
        safety: createSafetySummary(),
      };
    },
    listAgents() {
      return {
        phase: WORKFORCE_PHASE,
        mode: "deterministic-plan-preview",
        agents: listWorkforceRoles(),
        safety: createSafetySummary(),
      };
    },
    plan(input) {
      return createWorkforcePlan(input);
    },
    async savePlan(input = {}) {
      const plan = input.plan ?? (input.goal ? createWorkforcePlan(input) : null);
      return planStore.save(plan);
    },
    listPlans() {
      return planStore.list();
    },
    getPlan(planId) {
      return planStore.get(planId);
    },
    deletePlan(planId) {
      return planStore.delete(planId);
    },
    exportPlan(planId) {
      return planStore.export(planId);
    },
  };
}

function createSafetySummary() {
  return {
    realLlmCalls: false,
    agentConcurrency: false,
    codeExecution: false,
    projectFileWrites: false,
    workflowRun: false,
    previewOnly: true,
  };
}
