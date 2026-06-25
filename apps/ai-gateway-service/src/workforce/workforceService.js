import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import {
  WORKFORCE_REAL_LOCAL_RUN_MODE,
  runWorkforceRealLocal,
  createRealLocalSafetySummary,
} from "./workforceRealLocalRunner.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";

/**
 * Create a provider adapter that calls the AI Gateway's /chat endpoint.
 * This bridges the workforce LLM executor to the gateway's multi-provider routing.
 *
 * @param {object} [options]
 * @param {string} [options.gatewayUrl] — gateway base URL
 * @returns {{ generate: function(object): Promise<{ text: string, usage: object, latencyMs: number }> }}
 */
function createGatewayProviderAdapter(options = {}) {
  const gatewayUrl = options.gatewayUrl ?? process.env.AI_GATEWAY_URL ?? "http://127.0.0.1:3100";

  return {
    async generate(providerRequest) {
      const messages = providerRequest?.request?.messages ?? [];
      const maxTokens = providerRequest?.request?.options?.maxOutputTokens ?? 4096;
      const temperature = providerRequest?.request?.options?.temperature ?? 0.3;
      const start = Date.now();

      const res = await fetch(`${gatewayUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          options: { maxOutputTokens: maxTokens, temperature },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        throw new Error(`Gateway /chat returned ${res.status}: ${await res.text().catch(() => "")}`);
      }

      const data = await res.json();
      const text = data?.data?.outputText ?? data?.choices?.[0]?.message?.content ?? "";
      const usage = data?.data?.usage ?? data?.usage ?? null;
      const latencyMs = Date.now() - start;

      return { text, usage, latencyMs };
    },
  };
}

export function createWorkforceService(options = {}) {
  const planStore = createWorkforcePlanStore(options);

  // Create gateway provider adapter for LLM-driven role execution
  const providerAdapter = createGatewayProviderAdapter(options);

  // Forge service reference (set after both services are created)
  let forgeServiceRef = null;

  // Controlled executor wires the tier governor + sandbox merger + budget +
  // diagnostic channel. These are created lazily inside the executor.
  const executor = createControlledExecutor({
    repoRoot: options.repoRoot,
    executionDir: options.executionDir,
    env: options.env,
    providerAdapter,
    get forgeService() { return forgeServiceRef; },
  });

  return {
    setForgeService(fs) {
      forgeServiceRef = fs;
    },
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
