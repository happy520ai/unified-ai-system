import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import {
  WORKFORCE_REAL_LOCAL_RUN_MODE,
  runWorkforceRealLocal,
  createRealLocalSafetySummary,
} from "./workforceRealLocalRunner.js";
import { executeAllRolesWithLLM } from "./roleExecutorsLlm.js";

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
    async execute(input = {}, options = {}) {
      const goal = typeof input === "string" ? input : input.goal;
      if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
        const error = new Error("Workforce execute requires a goal.");
        error.code = "WORKFORCE_GOAL_REQUIRED";
        error.category = "validation";
        throw error;
      }

      const context = input.context ?? {};
      const providerAdapter = options.providerAdapter ?? null;
      const llmOptions = options.llmOptions ?? {};

      const result = await executeAllRolesWithLLM(goal, context, providerAdapter, llmOptions);

      return {
        phase: WORKFORCE_PHASE,
        status: "completed",
        goal,
        ...result,
        safety: createSafetySummary(),
      };
    },
    async runLocal(input = {}, options = {}) {
      const tenantId = options.tenantId;
      // runWorkforceRealLocal 只调用 planStore.save；这里包一层租户作用域，
      // 保证 /workforce/run-local 保存的计划同样盖上服务端派生的 tenantId。
      return runWorkforceRealLocal(input, {
        planStore: {
          save: (plan) => planStore.save(plan, tenantId),
        },
      });
    },
    async savePlan(input = {}, tenantId) {
      const plan = input.plan ?? (input.goal ? createWorkforcePlan(input) : null);
      return planStore.save(plan, tenantId);
    },
    listPlans(tenantId) {
      return planStore.list(tenantId);
    },
    getPlan(planId, tenantId) {
      return planStore.get(planId, tenantId);
    },
    deletePlan(planId, tenantId) {
      return planStore.delete(planId, tenantId);
    },
    exportPlan(planId, tenantId) {
      return planStore.export(planId, tenantId);
    },
    answerClarifications(planId, input = {}, tenantId) {
      return planStore.answerClarifications(planId, input.answers, tenantId);
    },
    updatePlanLifecycle(planId, input = {}, tenantId) {
      return planStore.updateLifecycle(planId, input, tenantId);
    },
    getPlanReviewPackage(planId, tenantId) {
      return planStore.getReviewPackage(planId, tenantId);
    },
    recordPlanApprovalGate(planId, input = {}, tenantId) {
      return planStore.recordApprovalGate(planId, input, tenantId);
    },
  };
}

function createSafetySummary() {
  return createRealLocalSafetySummary();
}
