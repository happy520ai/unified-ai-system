import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import {
  WORKFORCE_REAL_LOCAL_RUN_MODE,
  runWorkforceRealLocal,
  createRealLocalSafetySummary,
} from "./workforceRealLocalRunner.js";
import { executeAllRolesWithLLM } from "./roleExecutorsLlm.js";
import { randomUUID } from "node:crypto";
import { createWorkforceLifecycleHooks } from "./workforceLifecycleHooks.ts";
import { createWorkforcePlanOperation, hookHash, hookIdentity, hookOperationId, assertHookScopeActive } from "./workforceHookOperations.ts";

export function createWorkforceService(options = {}) {
  const planStore = createWorkforcePlanStore(options);
  const lifecycleHooks = options.lifecycleHooks ?? createWorkforceLifecycleHooks();
  const planAndSave = createWorkforcePlanOperation({ hooks: lifecycleHooks, store: planStore, plan: createWorkforcePlan });

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
        lifecycleHooks: lifecycleHooks.getInfo(),
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
    planAndSave,
    close() { return planStore.close(); },
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
        ...((lifecycleHooks.getInfo().enabled || Object.hasOwn(input, "operationId")) ? { planAndSave: (body) => planAndSave(body, options) } : {}),
        planStore: {
          save: (plan) => planStore.save(plan, tenantId),
        },
      });
    },
    async savePlan(input = {}, tenantId, scope = {}) {
      if (!input.plan && input.goal && (lifecycleHooks.getInfo().enabled || Object.hasOwn(input, "operationId"))) {
        const result = await planAndSave(input, scope);
        return { ...result.saved, hookReplayed: result.replayed };
      }
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
    exportPlan(planId, tenantId, scope = {}) {
      return planStore.export(planId, tenantId, lifecycleHooks.getInfo().enabled ? async (saved) => {
        const identity = hookIdentity(scope);
        const payload = { goal: saved.taskPackage.goal, workforceId: saved.taskPackage.workforceId, planId: saved.planId, previewOnly: true };
        const operation = lifecycleHooks.begin({ kind: "export", operationId: hookOperationId("export", randomUUID(), identity),
          requestHash: hookHash(payload), identity, signal: scope.signal, deadlineAt: scope.deadlineAt });
        const { receipt } = await lifecycleHooks.run(operation.handle, "beforeExport", payload);
        assertHookScopeActive(scope);
        return receipt;
      } : undefined);
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
