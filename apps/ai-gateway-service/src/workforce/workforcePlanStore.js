import { resolve } from "node:path";
import {
  DEFAULT_STORE_PATH,
  STORE_VERSION,
  WORKFORCE_PLAN_LIFECYCLE_PHASE,
  WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
  WORKFORCE_PLAN_STORE_MODE,
  WORKFORCE_PLAN_STORE_PHASE,
} from "./workforcePlanStore-constants.js";
export {
  WORKFORCE_PLAN_STORE_PHASE,
  WORKFORCE_PLAN_STORE_MODE,
  WORKFORCE_PLAN_LIFECYCLE_PHASE,
  WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
  WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE,
  WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE,
  WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE,
  WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE,
  WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE,
  WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE,
  WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE,
  WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE,
  WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE,
  WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE,
  WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE,
  WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE,
  WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE,
} from "./workforcePlanStore-constants.js";
import {
  createPlanId,
  createStoreError,
  createStoreSafety,
  createUpdatedLifecycle,
  normalizeClarificationAnswers,
  normalizeLifecycleState,
  normalizePlan,
  normalizePlanId,
  readStore as jsonReadStore,
  redactSecrets,
  sealWorkforcePreviewSafety,
  toPlanSummary,
  updatePlanStateCurrent,
  writeStore as jsonWriteStore,
} from "./workforcePlanStore-utils.js";
import { createSqliteStoreBackend } from "./workforcePlanStore-sqlite.js";
import {
  appendEventLedgerEvent,
  createPackageHudPreview,
  normalizeAgentWorkforcePreviewFinalUxSeal,
  normalizeExecutionApprovalRecordPreview,
  normalizeExecutionReadinessPreflight,
  normalizeExternalOmxRunnerDesign,
  normalizeExternalRunnerProtocolFreeze,
  normalizeProductTemplatesPreview,
  normalizeRunnerRequestQueuePreview,
  normalizeTemplateContext,
} from "./workforcePlanStore-normalizers.js";
import {
  normalizeCodexDesktopHandoffPack,
  normalizeCodexResultReviewPreview,
  normalizeHandoffPackageManifest,
  normalizeManualCodexExecutionLoop,
  normalizeSafeDesktopRunnerDesign,
} from "./workforcePlanStore-codex.js";
import { createTaskPackage } from "./workforcePlanStore-packages.js";
import { formatTaskPackageMarkdown } from "./workforcePlanStore-markdown.js";
import {
  applyApprovalGateDecision,
  applyClarificationAnswers,
  applyLifecycleState,
  refreshReviewAndApprovalPreviews,
} from "./workforcePlanStore-mutations.js";

// Serialize read-modify-write mutations per store path. The store is backed by
// a single JSON file, so concurrent saves/deletes would otherwise interleave a
// read-modify-write cycle and lose updates (last-writer-wins data loss). Each
// mutation chains onto the previous one for the same path.
const storeMutationQueues = new Map();

function sealTaskPackage(taskPackage) {
  const sealed = sealWorkforcePreviewSafety(taskPackage);
  sealed.exportableJson = sealWorkforcePreviewSafety(sealed.exportableJson || {});
  sealed.markdown = formatTaskPackageMarkdown({
    plan: sealed,
    planId: sealed.planId,
    savedAt: sealed.savedAt,
  });
  return sealed;
}

function serializeStoreMutation(storePath, operation) {
  const previous = storeMutationQueues.get(storePath) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  storeMutationQueues.set(storePath, current.catch(() => {}));
  return current;
}

// ── 租户隔离（fail-closed）───────────────────────────────────────────────────
// 每条 taskPackage 保存时盖章 tenantId；所有读取/变更都按传入 tenantId 过滤。
// 记录租户与传入租户不匹配（或记录没有租户字段，例如旧数据）一律按
// WORKFORCE_PLAN_NOT_FOUND 处理——与不存在同语义，不泄露记录是否存在。

function requirePlanTenantId(tenantId) {
  const normalized = typeof tenantId === "string" ? tenantId.trim() : "";
  if (!normalized) {
    throw createStoreError("WORKFORCE_PLAN_TENANT_REQUIRED", "Workforce plan store tenant id is required.", {
      userMessage: "A server-derived tenant id is required for workforce plan operations.",
    });
  }
  return normalized;
}

function isPlanTenantMatch(taskPackage, tenantId) {
  const normalizedTenantId = typeof tenantId === "string" ? tenantId.trim() : "";
  const recordTenantId = typeof taskPackage?.tenantId === "string" ? taskPackage.tenantId.trim() : "";
  return Boolean(normalizedTenantId) && Boolean(recordTenantId) && normalizedTenantId === recordTenantId;
}

function createPlanTenantMismatchError(planId) {
  return createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
    userMessage: "???????????????????",
    planId,
  });
}

export function createWorkforcePlanStore({ env = process.env } = {}) {
  const storePath = resolve(env.WORKFORCE_PLAN_STORE_PATH || DEFAULT_STORE_PATH);
  // Storage backend: "sqlite" uses node:sqlite (ACID + cross-process safe),
  // default "json" keeps the original atomic-file backend (backwards compatible).
  const backend = env.WORKFORCE_PLAN_STORE_MODE === "sqlite"
    ? createSqliteStoreBackend(storePath)
    : null;
  const readStore = backend ? backend.readStore : jsonReadStore;
  const writeStore = backend ? backend.writeStore : jsonWriteStore;

  return {
    getInfo() {
      return {
        phase: WORKFORCE_PLAN_STORE_PHASE,
        mode: WORKFORCE_PLAN_STORE_MODE,
        storage: "local-json-file",
        storageScope: env.WORKFORCE_PLAN_STORE_PATH ? "configured-dev-path" : "system-temp",
        projectFileWrites: false,
        secretValuesStored: false,
      };
    },
    async save(plan, tenantId) {
      const scopedTenantId = requirePlanTenantId(tenantId);
      return serializeStoreMutation(storePath, async () => {
        const normalizedPlan = normalizePlan(plan);
        const savedAt = new Date().toISOString();
        const planId = createPlanId(normalizedPlan, savedAt);
        const taskPackage = sealTaskPackage({
          ...createTaskPackage({ plan: normalizedPlan, planId, savedAt }),
          tenantId: scopedTenantId,
        });

        if (backend) {
          // 原子 upsert：跨进程安全，避免 read-modify-write 的 lost update。
          backend.upsert(taskPackage);
        } else {
          const store = await readStore(storePath);
          const plans = store.plans.filter((item) => item.planId !== planId);
          plans.unshift(taskPackage);
          await writeStore(storePath, {
            version: STORE_VERSION,
            updatedAt: savedAt,
            plans,
          });
        }

        return {
          success: true,
          phase: WORKFORCE_PLAN_STORE_PHASE,
          status: "saved",
          mode: WORKFORCE_PLAN_STORE_MODE,
          planId,
          savedAt,
          taskPackage,
          safety: createStoreSafety(),
        };
      });
    },
    async list(tenantId) {
      const plans = backend ? backend.listPlans() : (await readStore(storePath)).plans;
      const visiblePlans = plans.filter((plan) => isPlanTenantMatch(plan, tenantId));
      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "listed",
        mode: WORKFORCE_PLAN_STORE_MODE,
        count: visiblePlans.length,
        plans: visiblePlans.map((plan) => toPlanSummary(sealWorkforcePreviewSafety(plan))),
        safety: createStoreSafety(),
      };
    },
    async get(planId, tenantId) {
      const normalizedPlanId = normalizePlanId(planId);
      const storedTaskPackage = backend
        ? backend.get(normalizedPlanId)
        : (await readStore(storePath)).plans.find((item) => item.planId === normalizedPlanId);
      if (!storedTaskPackage || !isPlanTenantMatch(storedTaskPackage, tenantId)) {
        throw createPlanTenantMismatchError(normalizedPlanId);
      }
      const taskPackage = sealTaskPackage(storedTaskPackage);

      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "found",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: normalizedPlanId,
        taskPackage,
        plan: taskPackage.exportableJson,
        safety: createStoreSafety(),
      };
    },
    async delete(planId, tenantId) {
      const normalizedPlanId = normalizePlanId(planId);
      return serializeStoreMutation(storePath, async () => {
        if (backend) {
          // 原子删除：跨进程安全。先取回校验租户再删除（不依赖 SQL 过滤）。
          const storedTaskPackage = backend.get(normalizedPlanId);
          if (!storedTaskPackage || !isPlanTenantMatch(storedTaskPackage, tenantId)) {
            throw createPlanTenantMismatchError(normalizedPlanId);
          }
          backend.remove(normalizedPlanId);
          return {
            success: true,
            phase: WORKFORCE_PLAN_STORE_PHASE,
            status: "deleted",
            mode: WORKFORCE_PLAN_STORE_MODE,
            planId: normalizedPlanId,
            deleted: true,
            remainingCount: backend.listPlans().filter((plan) => isPlanTenantMatch(plan, tenantId)).length,
            safety: createStoreSafety(),
          };
        }

        const store = await readStore(storePath);
        const target = store.plans.find((item) => item.planId === normalizedPlanId);
        if (!target || !isPlanTenantMatch(target, tenantId)) {
          throw createPlanTenantMismatchError(normalizedPlanId);
        }
        const plans = store.plans.filter((item) => item.planId !== normalizedPlanId);

        await writeStore(storePath, {
          version: STORE_VERSION,
          updatedAt: new Date().toISOString(),
          plans,
        });

        return {
          success: true,
          phase: WORKFORCE_PLAN_STORE_PHASE,
          status: "deleted",
          mode: WORKFORCE_PLAN_STORE_MODE,
          planId: normalizedPlanId,
          deleted: true,
          remainingCount: plans.filter((item) => isPlanTenantMatch(item, tenantId)).length,
          safety: createStoreSafety(),
        };
      });
    },
    async export(planId, tenantId) {
      const result = await this.get(planId, tenantId);
      const exportedAt = new Date().toISOString();
      const taskPackage = redactSecrets({
        ...result.taskPackage,
        planState: updatePlanStateCurrent(result.taskPackage.planState, "exported"),
        lifecyclePreview: createUpdatedLifecycle(
          result.taskPackage.lifecyclePreview,
          "exported",
          "Task package prepared for export preview.",
          exportedAt,
        ),
      });
      taskPackage.eventLedgerPreview = appendEventLedgerEvent(
        taskPackage.eventLedgerPreview,
        "workforce.plan.beforeExport",
        exportedAt,
        `Export preview prepared for plan ${taskPackage.planId}.`,
      );
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
      taskPackage.productTemplatesPreview = normalizeProductTemplatesPreview(
        taskPackage.productTemplatesPreview ?? taskPackage.exportableJson?.productTemplatesPreview,
        taskPackage.selectedTemplate,
      );
      taskPackage.handoffPackageManifest = normalizeHandoffPackageManifest(taskPackage.handoffPackageManifest ?? taskPackage.exportableJson?.handoffPackageManifest, taskPackage);
      taskPackage.workforceHudPreview = createPackageHudPreview(taskPackage);
      taskPackage.exportableJson = redactSecrets({
        ...(taskPackage.exportableJson || {}),
        selectedTemplate: taskPackage.selectedTemplate,
        templateContext: taskPackage.templateContext,
        productTemplatesPreview: taskPackage.productTemplatesPreview,
        handoffPackageManifest: taskPackage.handoffPackageManifest,
        planState: taskPackage.planState,
        lifecyclePreview: taskPackage.lifecyclePreview,
        eventLedgerPreview: taskPackage.eventLedgerPreview,
        executionReadinessPreflight: taskPackage.executionReadinessPreflight,
        externalOmxRunnerDesign: taskPackage.externalOmxRunnerDesign,
        runnerRequestQueuePreview: taskPackage.runnerRequestQueuePreview,
        executionApprovalRecordPreview: taskPackage.executionApprovalRecordPreview,
        externalRunnerProtocolFreeze: taskPackage.externalRunnerProtocolFreeze,
        agentWorkforcePreviewFinalUxSeal: taskPackage.agentWorkforcePreviewFinalUxSeal,
        codexDesktopHandoffPack: taskPackage.codexDesktopHandoffPack,
        manualCodexExecutionLoop: taskPackage.manualCodexExecutionLoop,
        codexResultReviewPreview: taskPackage.codexResultReviewPreview,
        safeDesktopRunnerDesign: taskPackage.safeDesktopRunnerDesign,
        workforceHudPreview: taskPackage.workforceHudPreview,
      });
      refreshReviewAndApprovalPreviews(taskPackage, exportedAt);
      const sealedTaskPackage = sealTaskPackage(taskPackage);
      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "export_ready",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: result.planId,
        formats: ["json", "markdown"],
        taskPackage: sealedTaskPackage,
        json: sealedTaskPackage,
        markdown: sealedTaskPackage.markdown,
        safety: createStoreSafety(),
      };
    },
    async answerClarifications(planId, answers = [], tenantId) {
      return serializeStoreMutation(storePath, async () => {
        const normalizedPlanId = normalizePlanId(planId);
        const normalizedAnswers = normalizeClarificationAnswers(answers);
        const updatedAt = new Date().toISOString();
        const store = await readStore(storePath);
        const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
        if (index < 0 || !isPlanTenantMatch(store.plans[index], tenantId)) {
          throw createPlanTenantMismatchError(normalizedPlanId);
        }

        const taskPackage = sealTaskPackage(applyClarificationAnswers(store.plans[index], normalizedAnswers, updatedAt));
        store.plans[index] = taskPackage;
        await writeStore(storePath, {
          version: STORE_VERSION,
          updatedAt,
          plans: store.plans,
        });

        return {
          success: true,
          phase: WORKFORCE_PLAN_LIFECYCLE_PHASE,
          status: "clarification_answers_saved",
          mode: WORKFORCE_PLAN_STORE_MODE,
          planId: normalizedPlanId,
          answeredCount: normalizedAnswers.length,
          taskPackage,
          lifecycle: taskPackage.lifecyclePreview,
          safety: createStoreSafety(),
        };
      });
    },
    async updateLifecycle(planId, input = {}, tenantId) {
      return serializeStoreMutation(storePath, async () => {
        const normalizedPlanId = normalizePlanId(planId);
        const nextState = normalizeLifecycleState(input.state);
        const updatedAt = new Date().toISOString();
        const store = await readStore(storePath);
        const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
        if (index < 0 || !isPlanTenantMatch(store.plans[index], tenantId)) {
          throw createPlanTenantMismatchError(normalizedPlanId);
        }

        const taskPackage = sealTaskPackage(applyLifecycleState(store.plans[index], nextState, input.note, updatedAt));
        store.plans[index] = taskPackage;
        await writeStore(storePath, {
          version: STORE_VERSION,
          updatedAt,
          plans: store.plans,
        });

        return {
          success: true,
          phase: WORKFORCE_PLAN_LIFECYCLE_PHASE,
          status: "lifecycle_saved",
          mode: WORKFORCE_PLAN_STORE_MODE,
          planId: normalizedPlanId,
          lifecycle: taskPackage.lifecyclePreview,
          taskPackage,
          safety: createStoreSafety(),
        };
      });
    },
    async getReviewPackage(planId, tenantId) {
      const result = await this.get(planId, tenantId);
      const taskPackage = sealTaskPackage(refreshReviewAndApprovalPreviews(result.taskPackage, new Date().toISOString()));
      return {
        success: true,
        phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
        status: "review_package_ready",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: result.planId,
        reviewPackagePreview: taskPackage.reviewPackagePreview,
        approvalGatePreview: taskPackage.approvalGatePreview,
        taskPackage,
        safety: createStoreSafety(),
      };
    },
    async recordApprovalGate(planId, input = {}, tenantId) {
      return serializeStoreMutation(storePath, async () => {
        const normalizedPlanId = normalizePlanId(planId);
        const updatedAt = new Date().toISOString();
        const store = await readStore(storePath);
        const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
        if (index < 0 || !isPlanTenantMatch(store.plans[index], tenantId)) {
          throw createPlanTenantMismatchError(normalizedPlanId);
        }

        const taskPackage = sealTaskPackage(applyApprovalGateDecision(store.plans[index], input, updatedAt));
        store.plans[index] = taskPackage;
        await writeStore(storePath, {
          version: STORE_VERSION,
          updatedAt,
          plans: store.plans,
        });

        return {
          success: true,
          phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
          status: "approval_gate_recorded",
          mode: WORKFORCE_PLAN_STORE_MODE,
          planId: normalizedPlanId,
          decision: taskPackage.approvalGatePreview?.currentDecision ?? null,
          reviewPackagePreview: taskPackage.reviewPackagePreview,
          approvalGatePreview: taskPackage.approvalGatePreview,
          taskPackage,
          safety: createStoreSafety(),
        };
      });
    },
  };
}
