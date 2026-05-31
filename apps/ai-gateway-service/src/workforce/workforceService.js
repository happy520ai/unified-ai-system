import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import {
  WORKFORCE_REAL_LOCAL_RUN_MODE,
  runWorkforceRealLocal,
  createRealLocalSafetySummary,
} from "./workforceRealLocalRunner.js";

export function createWorkforceService(options = {}) {
  const planStore = createWorkforcePlanStore(options);

  return {
    getHealth() {
      return {
        phase: WORKFORCE_PHASE,
        status: "ready",
        mode: "real-local-run-ready",
        ready: true,
        realLocalRunReady: true,
        runRoute: "POST /workforce/run-local",
        runMode: WORKFORCE_REAL_LOCAL_RUN_MODE,
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
    async runLocal(input = {}) {
      return runWorkforceRealLocal(input, { planStore });
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
    answerClarifications(planId, input = {}) {
      return planStore.answerClarifications(planId, input.answers);
    },
    updatePlanLifecycle(planId, input = {}) {
      return planStore.updateLifecycle(planId, input);
    },
    getPlanReviewPackage(planId) {
      return planStore.getReviewPackage(planId);
    },
    recordPlanApprovalGate(planId, input = {}) {
      return planStore.recordApprovalGate(planId, input);
    },
  };
}

function createSafetySummary() {
  return createRealLocalSafetySummary();
}







