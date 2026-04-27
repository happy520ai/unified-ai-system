import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

export const WORKFORCE_PLAN_STORE_PHASE = "phase-102d-agent-workforce-plan-store";
export const WORKFORCE_PLAN_STORE_MODE = "dev-only-local-plan-store";

const STORE_VERSION = 1;
const DEFAULT_STORE_PATH = resolve(tmpdir(), "unified-ai-system", "workforce-plans.json");

export function createWorkforcePlanStore({ env = process.env } = {}) {
  const storePath = resolve(env.WORKFORCE_PLAN_STORE_PATH || DEFAULT_STORE_PATH);

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
    async save(plan) {
      const normalizedPlan = normalizePlan(plan);
      const savedAt = new Date().toISOString();
      const planId = createPlanId(normalizedPlan, savedAt);
      const taskPackage = createTaskPackage({ plan: normalizedPlan, planId, savedAt });
      const store = await readStore(storePath);
      const plans = store.plans.filter((item) => item.planId !== planId);
      plans.unshift(taskPackage);
      await writeStore(storePath, {
        version: STORE_VERSION,
        updatedAt: savedAt,
        plans,
      });

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
    },
    async list() {
      const store = await readStore(storePath);
      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "listed",
        mode: WORKFORCE_PLAN_STORE_MODE,
        count: store.plans.length,
        plans: store.plans.map(toPlanSummary),
        safety: createStoreSafety(),
      };
    },
    async get(planId) {
      const store = await readStore(storePath);
      const normalizedPlanId = normalizePlanId(planId);
      const taskPackage = store.plans.find((item) => item.planId === normalizedPlanId);
      if (!taskPackage) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
          userMessage: "没有找到这条历史计划，可能已经被删除。",
          planId: normalizedPlanId,
        });
      }

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
    async delete(planId) {
      const store = await readStore(storePath);
      const normalizedPlanId = normalizePlanId(planId);
      const beforeCount = store.plans.length;
      const plans = store.plans.filter((item) => item.planId !== normalizedPlanId);
      if (plans.length === beforeCount) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
          userMessage: "没有找到这条历史计划，可能已经被删除。",
          planId: normalizedPlanId,
        });
      }

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
        remainingCount: plans.length,
        safety: createStoreSafety(),
      };
    },
    async export(planId) {
      const result = await this.get(planId);
      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "export_ready",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: result.planId,
        formats: ["json", "markdown"],
        taskPackage: result.taskPackage,
        json: result.taskPackage,
        markdown: result.taskPackage.markdown,
        safety: createStoreSafety(),
      };
    },
  };
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw createStoreError("WORKFORCE_PLAN_REQUIRED", "Workforce plan is required.", {
      userMessage: "请先生成一个 AI 团队计划，再保存。",
    });
  }

  const goal = typeof plan.goal === "string" ? plan.goal.trim() : "";
  if (!goal) {
    throw createStoreError("WORKFORCE_PLAN_GOAL_REQUIRED", "Workforce plan goal is required.", {
      userMessage: "这条计划缺少目标，不能保存。",
    });
  }

  return redactSecrets(plan);
}

function normalizePlanId(planId) {
  const value = String(planId || "").trim();
  if (!/^wfp_[a-f0-9]{12}$/.test(value)) {
    throw createStoreError("WORKFORCE_PLAN_ID_INVALID", "Workforce plan id is invalid.", {
      userMessage: "计划 ID 格式不正确。",
      planId: value,
    });
  }
  return value;
}

function createPlanId(plan, savedAt) {
  const hash = createHash("sha256")
    .update([plan.workforceId, plan.goal, savedAt].filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 12);
  return `wfp_${hash}`;
}

function createTaskPackage({ plan, planId, savedAt }) {
  const exportableJson = redactSecrets(plan.exportableJson || plan);
  return {
    planId,
    workforceId: plan.workforceId,
    goal: plan.goal,
    summary: plan.summary,
    roles: Array.isArray(plan.roleAssignments) ? plan.roleAssignments : [],
    taskBreakdown: Array.isArray(plan.taskBreakdown) ? plan.taskBreakdown : [],
    deliverables: Array.isArray(plan.deliverables) ? plan.deliverables : [],
    acceptanceCriteria: Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : [],
    risks: Array.isArray(plan.risks) ? plan.risks : [],
    nextActions: Array.isArray(plan.nextActions) ? plan.nextActions : [],
    limitations: Array.isArray(plan.limitations) ? plan.limitations : [],
    recommendedNextStep: plan.recommendedNextStep,
    markdown: redactSecrets(plan.markdown || formatTaskPackageMarkdown({ plan, planId, savedAt })),
    exportableJson,
    planVersion: plan.planVersion,
    createdAt: plan.createdAt,
    savedAt,
    meta: {
      phase: WORKFORCE_PLAN_STORE_PHASE,
      mode: WORKFORCE_PLAN_STORE_MODE,
      devOnly: true,
      projectFileWrites: false,
      secretValuesStored: false,
    },
  };
}

function formatTaskPackageMarkdown({ plan, planId, savedAt }) {
  const lines = [
    "# Agent Workforce Task Package",
    "",
    "- Plan ID: " + planId,
    "- Workforce ID: " + (plan.workforceId || "n/a"),
    "- Plan version: " + (plan.planVersion || "n/a"),
    "- Created at: " + (plan.createdAt || "n/a"),
    "- Saved at: " + savedAt,
    "- Goal: " + plan.goal,
    "",
    "## Summary",
    plan.summary || "",
    "",
    "## Roles",
  ]
    .concat((plan.roleAssignments || []).map((item) => "- " + item.role + ": " + item.responsibility))
    .concat([
      "",
      "## Tasks",
    ])
    .concat((plan.taskBreakdown || []).map((item) => "- " + item.taskId + " / " + item.role + ": " + item.description))
    .concat([
      "",
      "## Deliverables",
    ])
    .concat((plan.deliverables || []).map((item) => "- " + item.title + ": " + item.description + " (" + item.ownerRole + ")"))
    .concat([
      "",
      "## Acceptance Criteria",
    ])
    .concat((plan.acceptanceCriteria || []).map((item) => "- " + item))
    .concat([
      "",
      "## Risks",
    ])
    .concat((plan.risks || []).map((item) => "- " + item))
    .concat([
      "",
      "## Next Actions",
    ])
    .concat((plan.nextActions || []).map((item) => "- " + item));

  return lines.join("\n");
}

function toPlanSummary(plan) {
  return {
    planId: plan.planId,
    workforceId: plan.workforceId,
    goal: plan.goal,
    summary: plan.summary,
    planVersion: plan.planVersion,
    createdAt: plan.createdAt,
    savedAt: plan.savedAt,
    taskCount: plan.taskBreakdown?.length ?? 0,
    roleCount: plan.roles?.length ?? 0,
  };
}

async function readStore(storePath) {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    return {
      version: parsed.version === STORE_VERSION ? parsed.version : STORE_VERSION,
      updatedAt: parsed.updatedAt,
      plans: Array.isArray(parsed.plans) ? parsed.plans.map(redactSecrets) : [],
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        version: STORE_VERSION,
        updatedAt: null,
        plans: [],
      };
    }
    throw error;
  }
}

async function writeStore(storePath, store) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(redactSecrets(store), null, 2)}\n`, "utf8");
}

function redactSecrets(value) {
  if (typeof value === "string") {
    return value
      .replace(/AIza[0-9A-Za-z_-]{12,}/g, "AIza****redacted")
      .replace(/sk-[0-9A-Za-z_-]{8,}/g, "sk-****redacted")
      .replace(/nvapi-[0-9A-Za-z_-]{8,}/g, "nvapi-****redacted")
      .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=****redacted");
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSecrets(item)]));
  }

  return value;
}

function createStoreSafety() {
  return {
    devOnlyLocalStorage: true,
    realLlmCalls: false,
    codeExecution: false,
    projectFileWrites: false,
    workflowRun: false,
    secretValuesStored: false,
  };
}

function createStoreError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.details = details;
  return error;
}
