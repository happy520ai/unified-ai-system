import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import {
  WORKFORCE_REAL_LOCAL_RUN_MODE,
  runWorkforceRealLocal,
  createRealLocalSafetySummary,
} from "./workforceRealLocalRunner.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";

export function createWorkforceService(options = {}) {
  const planStore = createWorkforcePlanStore(options);

  // Controlled executor wires the tier governor + sandbox merger + budget +
  // diagnostic channel. These are created lazily inside the executor.
  const executor = createControlledExecutor({
    repoRoot: options.repoRoot,
    executionDir: options.executionDir,
    env: options.env,
  });

  return {
    getHealth() {
      const execInfo = executor.getInfo();
      return {
        phase: WORKFORCE_PHASE,
        status: "ready",
        mode: "controlled-execution-ready",
        ready: true,
        realLocalRunReady: true,
        controlledExecutionReady: true,
        executionEnabled: execInfo.executionEnabled,
        executionDryRun: execInfo.dryRun,
        tierGovernor: execInfo.tierGovernor,
        sandboxMerge: execInfo.sandboxMerge,
        runRoute: "POST /workforce/run-local",
        executeRoute: "POST /workforce/execute",
        runMode: WORKFORCE_REAL_LOCAL_RUN_MODE,
        roleCount: listWorkforceRoles().length,
        planStore: planStore.getInfo(),
        execution: execInfo,
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
    async execute(input = {}) {
      return executor.execute(input);
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

    // --- Controlled execution lifecycle passthroughs ---
    async approveExecution(planId, input) {
      return executor.approve(planId, input);
    },
    async checkExecutionApproval(planId) {
      return executor.checkApproval(planId);
    },
    async revokeExecutionApproval(planId, input) {
      return executor.revoke(planId, input);
    },
    async getExecutionStatus(planId) {
      return executor.status(planId);
    },
    async cancelExecution(planId) {
      return executor.cancel(planId);
    },
    async pauseExecution(planId) {
      return executor.pause(planId);
    },
    async resumeExecution(planId) {
      return executor.resume(planId);
    },

    // --- Autonomy budget / scope token / trust ladder ---
    resolveAutonomyMode(input = {}) {
      return executor.resolveAutonomyMode(input);
    },
    getSandboxMerger() {
      return executor.getSandboxMerger();
    },
    getAutonomyBudget() {
      return executor.getSandboxMerger().getBudget();
    },
    async getAutonomyUsage() {
      return executor.getSandboxMerger().getBudget().getUsage();
    },
    async issueAutonomyToken(input) {
      return executor.getSandboxMerger().getBudget().issueToken(input);
    },
    async revokeAutonomyToken(tokenId, revokedBy, reason) {
      return executor.getSandboxMerger().getBudget().revokeToken(tokenId, revokedBy, reason);
    },
    async getTrustSnapshot() {
      return executor.getSandboxMerger().getBudget().getTrustSnapshot();
    },
    getDiagnosticChannel() {
      return executor.getDiagnosticChannel();
    },
    async diagnosticRead(input) {
      return executor.getDiagnosticChannel().read(input);
    },

    // --- Tier governor (3-throttle capability system, front-end switch) ---
    async getCurrentTier() {
      return executor.getCurrentTier();
    },
    async setTier(input) {
      return executor.setTier(input);
    },
    async passGate(input) {
      return executor.passGate(input);
    },
    async fallBackTier(input) {
      return executor.fallBackTier(input);
    },
    getTierGovernor() {
      return executor.getTierGovernor();
    },
  };
}

function createSafetySummary() {
  return createRealLocalSafetySummary();
}
