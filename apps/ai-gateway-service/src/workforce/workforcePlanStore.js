import { resolve } from "node:path";
import { tmpdir } from "node:os";
import * as workforcePlanConstants from "./workforcePlanStore-constants.js";
const {
  WORKFORCE_PLAN_STORE_PHASE, WORKFORCE_PLAN_STORE_MODE, WORKFORCE_PLAN_LIFECYCLE_PHASE,
  WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE, STORE_VERSION, DEFAULT_STORE_PATH,
} = workforcePlanConstants;
import {
  redactSecrets, createStoreError, createStoreSafety, readStore, writeStore,
  createPlanId, normalizePlanId, normalizePlan,
  normalizeClarificationAnswers, normalizeLifecycleState, normalizeApprovalDecision,
  createDefaultLifecyclePreview, createUpdatedLifecycle, updatePlanStateCurrent,
  toPlanSummary, createPackageClarificationSummary,
} from "./workforcePlanStore-utils.js";
import {
  normalizeOmxHandoffPreview, normalizeRoleTiers, normalizeEventLedgerPreview, appendEventLedgerEvent,
  createPackageHudPreview, normalizeExecutionReadinessPreflight, normalizeExternalOmxRunnerDesign,
  normalizeRunnerRequestQueuePreview, normalizeExecutionApprovalRecordPreview,
  normalizeExternalRunnerProtocolFreeze, normalizeAgentWorkforcePreviewFinalUxSeal,
  normalizeTemplateContext, normalizeProductTemplatesPreview,
} from "./workforcePlanStore-normalizers.js";
import {
  normalizeHandoffPackageManifest, normalizeCodexDesktopHandoffPack,
  normalizeManualCodexExecutionLoop, normalizeCodexResultReviewPreview, normalizeSafeDesktopRunnerDesign,
} from "./workforcePlanStore-codex.js";
import { formatTaskPackageMarkdown } from "./workforcePlanStore-markdown.js";
import { createTaskPackage, createPackageReviewPackagePreview, createPackageApprovalGatePreview } from "./workforcePlanStore-packages.js";

export { workforcePlanConstants as WORKFORCE_PLAN_CONSTANTS };
export { createWorkforcePlanStore };

function refreshReviewAndApprovalPreviews(taskPackage, updatedAt) {
  taskPackage.externalOmxRunnerDesign = normalizeExternalOmxRunnerDesign(taskPackage.externalOmxRunnerDesign);
  taskPackage.runnerRequestQueuePreview = normalizeRunnerRequestQueuePreview(taskPackage.runnerRequestQueuePreview);
  taskPackage.executionApprovalRecordPreview = normalizeExecutionApprovalRecordPreview(taskPackage.executionApprovalRecordPreview);
  taskPackage.externalRunnerProtocolFreeze = normalizeExternalRunnerProtocolFreeze(taskPackage.externalRunnerProtocolFreeze);
  taskPackage.agentWorkforcePreviewFinalUxSeal = normalizeAgentWorkforcePreviewFinalUxSeal(taskPackage.agentWorkforcePreviewFinalUxSeal);
  taskPackage.codexDesktopHandoffPack = normalizeCodexDesktopHandoffPack(taskPackage.codexDesktopHandoffPack || taskPackage.exportableJson?.codexDesktopHandoffPack, taskPackage);
  taskPackage.manualCodexExecutionLoop = normalizeManualCodexExecutionLoop(taskPackage.manualCodexExecutionLoop || taskPackage.exportableJson?.manualCodexExecutionLoop);
  taskPackage.codexResultReviewPreview = normalizeCodexResultReviewPreview(taskPackage.codexResultReviewPreview || taskPackage.exportableJson?.codexResultReviewPreview);
  taskPackage.safeDesktopRunnerDesign = normalizeSafeDesktopRunnerDesign(taskPackage.safeDesktopRunnerDesign || taskPackage.exportableJson?.safeDesktopRunnerDesign);
  taskPackage.handoffPackageManifest = normalizeHandoffPackageManifest(taskPackage.handoffPackageManifest || taskPackage.exportableJson?.handoffPackageManifest, taskPackage);
  taskPackage.eventLedgerPreview = appendEventLedgerEvent(taskPackage.eventLedgerPreview, "workforce.review.requested", updatedAt, `Review package requested for plan ${taskPackage.planId}.`);
  taskPackage.reviewPackagePreview = createPackageReviewPackagePreview({ source: taskPackage.reviewPackagePreview || taskPackage.exportableJson?.reviewPackagePreview, plan: taskPackage, planId: taskPackage.planId, savedAt: taskPackage.savedAt || updatedAt });
  taskPackage.approvalGatePreview = createPackageApprovalGatePreview({ source: taskPackage.approvalGatePreview || taskPackage.exportableJson?.approvalGatePreview, plan: taskPackage, planId: taskPackage.planId, updatedAt });
  taskPackage.workforceHudPreview = createPackageHudPreview(taskPackage);
  taskPackage.exportableJson = redactSecrets({
    ...(taskPackage.exportableJson || {}), reviewPackagePreview: taskPackage.reviewPackagePreview,
    approvalGatePreview: taskPackage.approvalGatePreview, eventLedgerPreview: taskPackage.eventLedgerPreview,
    executionReadinessPreflight: taskPackage.executionReadinessPreflight, externalOmxRunnerDesign: taskPackage.externalOmxRunnerDesign,
    runnerRequestQueuePreview: taskPackage.runnerRequestQueuePreview, executionApprovalRecordPreview: taskPackage.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: taskPackage.externalRunnerProtocolFreeze, agentWorkforcePreviewFinalUxSeal: taskPackage.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: taskPackage.codexDesktopHandoffPack, manualCodexExecutionLoop: taskPackage.manualCodexExecutionLoop,
    codexResultReviewPreview: taskPackage.codexResultReviewPreview, safeDesktopRunnerDesign: taskPackage.safeDesktopRunnerDesign,
    handoffPackageManifest: taskPackage.handoffPackageManifest, workforceHudPreview: taskPackage.workforceHudPreview,
  });
  return taskPackage;
}

function createWorkforcePlanStore({ env = process.env } = {}) {
  const storePath = resolve(env.WORKFORCE_PLAN_STORE_PATH || DEFAULT_STORE_PATH);
  return {
    getInfo() {
      return {
        phase: WORKFORCE_PLAN_STORE_PHASE, mode: WORKFORCE_PLAN_STORE_MODE,
        storage: "local-json-file",
        storageScope: env.WORKFORCE_PLAN_STORE_PATH ? "configured-dev-path" : "system-temp",
        projectFileWrites: false, secretValuesStored: false,
      };
    },
    async save(plan) {
      const normalizedPlan = normalizePlan(plan);
      const savedAt = new Date().toISOString();
      const planId = createPlanId(normalizedPlan, savedAt);
      const taskPackage = createTaskPackage({ plan: normalizedPlan, planId, savedAt });
      const store = await readStore(storePath);
      const plans = store.plans.filter((item) => item.planId !== planId);
      plans.unshift(taskPackage);
      await writeStore(storePath, { version: STORE_VERSION, updatedAt: savedAt, plans });
      return { success: true, phase: WORKFORCE_PLAN_STORE_PHASE, status: "saved", mode: WORKFORCE_PLAN_STORE_MODE, planId, savedAt, taskPackage, safety: createStoreSafety() };
    },
    async list() {
      const store = await readStore(storePath);
      return { success: true, phase: WORKFORCE_PLAN_STORE_PHASE, status: "listed", mode: WORKFORCE_PLAN_STORE_MODE, count: store.plans.length, plans: store.plans.map(toPlanSummary), safety: createStoreSafety() };
    },
    async get(planId) {
      const store = await readStore(storePath);
      const normalizedPlanId = normalizePlanId(planId);
      const taskPackage = store.plans.find((item) => item.planId === normalizedPlanId);
      if (!taskPackage) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", { userMessage: "保存的工作力计划未找到。", planId: normalizedPlanId });
      }
      return { success: true, phase: WORKFORCE_PLAN_STORE_PHASE, status: "found", mode: WORKFORCE_PLAN_STORE_MODE, planId: normalizedPlanId, taskPackage, plan: taskPackage.exportableJson, safety: createStoreSafety() };
    },
    async delete(planId) {
      const store = await readStore(storePath);
      const normalizedPlanId = normalizePlanId(planId);
      const beforeCount = store.plans.length;
      const plans = store.plans.filter((item) => item.planId !== normalizedPlanId);
      if (plans.length === beforeCount) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", { userMessage: "保存的工作力计划未找到。", planId: normalizedPlanId });
      }
      await writeStore(storePath, { version: STORE_VERSION, updatedAt: new Date().toISOString(), plans });
      return { success: true, phase: WORKFORCE_PLAN_STORE_PHASE, status: "deleted", mode: WORKFORCE_PLAN_STORE_MODE, planId: normalizedPlanId, deleted: true, remainingCount: plans.length, safety: createStoreSafety() };
    },
    async export(planId) {
      const result = await this.get(planId);
      const exportedAt = new Date().toISOString();
      const taskPackage = redactSecrets({
        ...result.taskPackage,
        planState: updatePlanStateCurrent(result.taskPackage.planState, "exported"),
        lifecyclePreview: createUpdatedLifecycle(result.taskPackage.lifecyclePreview, "exported", "Task package prepared for export preview.", exportedAt),
      });
      taskPackage.eventLedgerPreview = appendEventLedgerEvent(taskPackage.eventLedgerPreview, "workforce.plan.beforeExport", exportedAt, `Export preview prepared for plan ${taskPackage.planId}.`);
      taskPackage.executionReadinessPreflight = normalizeExecutionReadinessPreflight(taskPackage.executionReadinessPreflight);
      taskPackage.externalOmxRunnerDesign = normalizeExternalOmxRunnerDesign(taskPackage.externalOmxRunnerDesign);
      taskPackage.runnerRequestQueuePreview = normalizeRunnerRequestQueuePreview(taskPackage.runnerRequestQueuePreview);
      taskPackage.executionApprovalRecordPreview = normalizeExecutionApprovalRecordPreview(taskPackage.executionApprovalRecordPreview);
      taskPackage.externalRunnerProtocolFreeze = normalizeExternalRunnerProtocolFreeze(taskPackage.externalRunnerProtocolFreeze);
      taskPackage.agentWorkforcePreviewFinalUxSeal = normalizeAgentWorkforcePreviewFinalUxSeal(taskPackage.agentWorkforcePreviewFinalUxSeal);
      taskPackage.codexDesktopHandoffPack = normalizeCodexDesktopHandoffPack(taskPackage.codexDesktopHandoffPack ?? taskPackage.exportableJson?.codexDesktopHandoffPack, taskPackage);
      taskPackage.manualCodexExecutionLoop = normalizeManualCodexExecutionLoop(taskPackage.manualCodexExecutionLoop ?? taskPackage.exportableJson?.manualCodexExecutionLoop);
      taskPackage.codexResultReviewPreview = normalizeCodexResultReviewPreview(taskPackage.codexResultReviewPreview ?? taskPackage.exportableJson?.codexResultReviewPreview);
      taskPackage.safeDesktopRunnerDesign = normalizeSafeDesktopRunnerDesign(taskPackage.safeDesktopRunnerDesign ?? taskPackage.exportableJson?.safeDesktopRunnerDesign);
      taskPackage.selectedTemplate = redactSecrets(taskPackage.selectedTemplate ?? taskPackage.exportableJson?.selectedTemplate ?? null);
      taskPackage.templateContext = normalizeTemplateContext(taskPackage.templateContext ?? taskPackage.exportableJson?.templateContext, taskPackage.selectedTemplate);
      taskPackage.productTemplatesPreview = normalizeProductTemplatesPreview(taskPackage.productTemplatesPreview ?? taskPackage.exportableJson?.productTemplatesPreview, taskPackage.selectedTemplate);
      taskPackage.handoffPackageManifest = normalizeHandoffPackageManifest(taskPackage.handoffPackageManifest ?? taskPackage.exportableJson?.handoffPackageManifest, taskPackage);
      taskPackage.workforceHudPreview = createPackageHudPreview(taskPackage);
      taskPackage.exportableJson = redactSecrets({
        ...(taskPackage.exportableJson || {}), selectedTemplate: taskPackage.selectedTemplate,
        templateContext: taskPackage.templateContext, productTemplatesPreview: taskPackage.productTemplatesPreview,
        handoffPackageManifest: taskPackage.handoffPackageManifest, planState: taskPackage.planState,
        lifecyclePreview: taskPackage.lifecyclePreview, eventLedgerPreview: taskPackage.eventLedgerPreview,
        executionReadinessPreflight: taskPackage.executionReadinessPreflight, externalOmxRunnerDesign: taskPackage.externalOmxRunnerDesign,
        runnerRequestQueuePreview: taskPackage.runnerRequestQueuePreview, executionApprovalRecordPreview: taskPackage.executionApprovalRecordPreview,
        externalRunnerProtocolFreeze: taskPackage.externalRunnerProtocolFreeze, agentWorkforcePreviewFinalUxSeal: taskPackage.agentWorkforcePreviewFinalUxSeal,
        codexDesktopHandoffPack: taskPackage.codexDesktopHandoffPack, manualCodexExecutionLoop: taskPackage.manualCodexExecutionLoop,
        codexResultReviewPreview: taskPackage.codexResultReviewPreview, safeDesktopRunnerDesign: taskPackage.safeDesktopRunnerDesign,
        workforceHudPreview: taskPackage.workforceHudPreview,
      });
      refreshReviewAndApprovalPreviews(taskPackage, exportedAt);
      taskPackage.markdown = formatTaskPackageMarkdown({ plan: taskPackage, planId: taskPackage.planId, savedAt: taskPackage.savedAt });
      return { success: true, phase: WORKFORCE_PLAN_STORE_PHASE, status: "export_ready", mode: WORKFORCE_PLAN_STORE_MODE, planId: result.planId, formats: ["json", "markdown"], taskPackage, json: taskPackage, markdown: taskPackage.markdown, safety: createStoreSafety() };
    },
    async answerClarifications(planId, answers = []) {
      const normalizedPlanId = normalizePlanId(planId);
      const normalizedAnswers = normalizeClarificationAnswers(answers);
      const updatedAt = new Date().toISOString();
      const store = await readStore(storePath);
      const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
      if (index < 0) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", { userMessage: "保存的工作力计划未找到。", planId: normalizedPlanId });
      }
      const taskPackage = applyClarificationAnswers(store.plans[index], normalizedAnswers, updatedAt);
      store.plans[index] = taskPackage;
      await writeStore(storePath, { version: STORE_VERSION, updatedAt, plans: store.plans });
      return { success: true, phase: WORKFORCE_PLAN_LIFECYCLE_PHASE, status: "clarification_answers_saved", mode: WORKFORCE_PLAN_STORE_MODE, planId: normalizedPlanId, answeredCount: normalizedAnswers.length, taskPackage, lifecycle: taskPackage.lifecyclePreview, safety: createStoreSafety() };
    },
    async updateLifecycle(planId, input = {}) {
      const normalizedPlanId = normalizePlanId(planId);
      const nextState = normalizeLifecycleState(input.state);
      const updatedAt = new Date().toISOString();
      const store = await readStore(storePath);
      const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
      if (index < 0) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", { userMessage: "保存的工作力计划未找到。", planId: normalizedPlanId });
      }
      const taskPackage = applyLifecycleState(store.plans[index], nextState, input.note, updatedAt);
      store.plans[index] = taskPackage;
      await writeStore(storePath, { version: STORE_VERSION, updatedAt, plans: store.plans });
      return { success: true, phase: WORKFORCE_PLAN_LIFECYCLE_PHASE, status: "lifecycle_saved", mode: WORKFORCE_PLAN_STORE_MODE, planId: normalizedPlanId, lifecycle: taskPackage.lifecyclePreview, taskPackage, safety: createStoreSafety() };
    },
    async getReviewPackage(planId) {
      const result = await this.get(planId);
      const taskPackage = refreshReviewAndApprovalPreviews(result.taskPackage, new Date().toISOString());
      return { success: true, phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE, status: "review_package_ready", mode: WORKFORCE_PLAN_STORE_MODE, planId: result.planId, reviewPackagePreview: taskPackage.reviewPackagePreview, approvalGatePreview: taskPackage.approvalGatePreview, taskPackage, safety: createStoreSafety() };
    },
    async recordApprovalGate(planId, input = {}) {
      const normalizedPlanId = normalizePlanId(planId);
      const updatedAt = new Date().toISOString();
      const store = await readStore(storePath);
      const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
      if (index < 0) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", { userMessage: "保存的工作力计划未找到。", planId: normalizedPlanId });
      }
      const taskPackage = applyApprovalGateDecision(store.plans[index], input, updatedAt);
      store.plans[index] = taskPackage;
      await writeStore(storePath, { version: STORE_VERSION, updatedAt, plans: store.plans });
      return { success: true, phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE, status: "approval_gate_recorded", mode: WORKFORCE_PLAN_STORE_MODE, planId: normalizedPlanId, decision: taskPackage.approvalGatePreview?.currentDecision ?? null, reviewPackagePreview: taskPackage.reviewPackagePreview, approvalGatePreview: taskPackage.approvalGatePreview, taskPackage, safety: createStoreSafety() };
    },
  };
}

function applyClarificationAnswers(taskPackage, answers, updatedAt) {
  const clarificationSummary = createPackageClarificationSummary(taskPackage.clarifyQuestions || [], answers);
  const next = redactSecrets({
    ...taskPackage, clarificationAnswers: answers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    lifecyclePreview: createUpdatedLifecycle(taskPackage.lifecyclePreview, "clarified", "Clarification answers saved in preview store.", updatedAt),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}), clarificationAnswers: next.clarificationAnswers,
    answeredClarifications: next.answeredClarifications, unresolvedClarifications: next.unresolvedClarifications,
    lifecyclePreview: next.lifecyclePreview, executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign, runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview, externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal, codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop, codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign, workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, "clarified"),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

function applyLifecycleState(taskPackage, state, note, updatedAt) {
  const next = redactSecrets({
    ...taskPackage,
    lifecyclePreview: createUpdatedLifecycle(taskPackage.lifecyclePreview, state, note || `Lifecycle preview moved to ${state}.`, updatedAt),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}), lifecyclePreview: next.lifecyclePreview,
    executionReadinessPreflight: next.executionReadinessPreflight, externalOmxRunnerDesign: next.externalOmxRunnerDesign,
    runnerRequestQueuePreview: next.runnerRequestQueuePreview, executionApprovalRecordPreview: next.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze, agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: next.codexDesktopHandoffPack, manualCodexExecutionLoop: next.manualCodexExecutionLoop,
    codexResultReviewPreview: next.codexResultReviewPreview, safeDesktopRunnerDesign: next.safeDesktopRunnerDesign,
    workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, state === "archived" ? "export_ready" : state),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

function applyApprovalGateDecision(taskPackage, input, updatedAt) {
  const decision = normalizeApprovalDecision(input.decision);
  const reviewer = String(input.reviewer || input.approver || "human-reviewer").trim().slice(0, 120) || "human-reviewer";
  const note = String(input.note || "").trim().slice(0, 1_000);
  const base = refreshReviewAndApprovalPreviews(redactSecrets({ ...taskPackage }), updatedAt);
  const history = Array.isArray(base.approvalGatePreview?.decisionHistory) ? base.approvalGatePreview.decisionHistory : [];
  const decisionEvent = { decision, reviewer, note, decidedAt: updatedAt, previewOnly: false, executionEnabled: true, workflowRun: false, projectFileWrites: false };
  const statusByDecision = { "approved-preview": "approved-preview-recorded", "changes-requested": "changes-requested-recorded", "rejected-preview": "rejected-preview-recorded" };
  const approvalGatePreview = redactSecrets({
    ...base.approvalGatePreview, status: statusByDecision[decision], currentDecision: decision,
    reviewer, note, decidedAt: updatedAt, persisted: true, executionEnabled: true, workflowRunEnabled: true, projectFileWrites: false,
    decisionHistory: [...history, decisionEvent],
  });
  const next = redactSecrets({
    ...base, approvalGatePreview,
    eventLedgerPreview: appendEventLedgerEvent(base.eventLedgerPreview, "workforce.approval.recorded", updatedAt, `Approval gate decision ${decision} recorded as preview metadata.`),
    lifecyclePreview: createUpdatedLifecycle(base.lifecyclePreview, "handoff-disabled", "Human approval gate preview recorded; workflow run remains disabled.", updatedAt),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}), approvalGatePreview, eventLedgerPreview: next.eventLedgerPreview,
    lifecyclePreview: next.lifecyclePreview, executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign, runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview, externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal, codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop, codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign, workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, "handoff-disabled"),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}
