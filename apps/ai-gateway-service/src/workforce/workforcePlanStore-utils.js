import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { STORE_VERSION } from "./workforcePlanStore-constants.js";

export function redactSecrets(value) {
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

export function createStoreError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.details = details;
  return error;
}

export function createStoreSafety() {
  return {
    devOnlyLocalStorage: true,
    realLlmCalls: false,
    codeExecution: false,
    projectFileWrites: false,
    workflowRun: false,
    secretValuesStored: false,
  };
}

export async function readStore(storePath) {
  try {
    const content = await readFile(storePath, "utf8");
    if (!content || !content.trim()) {
      return { version: STORE_VERSION, updatedAt: null, plans: [] };
    }
    const parsed = JSON.parse(content);
    return {
      version: parsed.version === STORE_VERSION ? parsed.version : STORE_VERSION,
      updatedAt: parsed.updatedAt,
      plans: Array.isArray(parsed.plans) ? parsed.plans.map(redactSecrets) : [],
    };
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) {
      return { version: STORE_VERSION, updatedAt: null, plans: [] };
    }
    throw error;
  }
}

export async function writeStore(storePath, store) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(redactSecrets(store), null, 2)}\n`, "utf8");
}

export function createPlanId(plan, savedAt) {
  const hash = createHash("sha256")
    .update([plan.workforceId, plan.goal, savedAt].filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 12);
  return `wfp_${hash}`;
}

export function normalizePlanId(planId) {
  const value = String(planId || "").trim();
  if (!/^wfp_[a-f0-9]{12}$/.test(value)) {
    throw createStoreError("WORKFORCE_PLAN_ID_INVALID", "Workforce plan id is invalid.", {
      userMessage: "Plan ID format is invalid.",
      planId: value,
    });
  }
  return value;
}

export function normalizePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw createStoreError("WORKFORCE_PLAN_REQUIRED", "Workforce plan is required.", {
      userMessage: "Please provide an AI workforce plan.",
    });
  }
  const goal = typeof plan.goal === "string" ? plan.goal.trim() : "";
  if (!goal) {
    throw createStoreError("WORKFORCE_PLAN_GOAL_REQUIRED", "Workforce plan goal is required.", {
      userMessage: "Please enter a goal for the workforce plan.",
    });
  }
  return redactSecrets(plan);
}

export function normalizeClarificationAnswers(answers) {
  const items = Array.isArray(answers) ? answers : [];
  return items
    .map((item) => ({
      questionId: String(item?.questionId || "").trim(),
      answer: String(item?.answer || "").trim().slice(0, 1_000),
      answeredAt: item?.answeredAt || new Date().toISOString(),
      previewOnly: false,
    }))
    .filter((item) => item.questionId && item.answer);
}

export function normalizeLifecycleState(state) {
  const value = String(state || "").trim();
  const allowed = ["draft", "clarified", "saved", "exported", "handoff-disabled", "consensus_ready", "export_ready", "archived"];
  if (!allowed.includes(value)) {
    throw createStoreError("WORKFORCE_LIFECYCLE_STATE_INVALID", "Workforce lifecycle state is invalid.", {
      userMessage: "Workforce lifecycle state is outside the allowed preview states.",
      allowed,
      state: value,
    });
  }
  return value;
}

export function normalizeApprovalDecision(decision) {
  const value = String(decision || "").trim();
  const allowed = ["approved-preview", "changes-requested", "rejected-preview"];
  if (!allowed.includes(value)) {
    throw createStoreError("WORKFORCE_APPROVAL_DECISION_INVALID", "Workforce approval gate decision is invalid.", {
      userMessage: "Workforce approval gate decision is outside the allowed preview decisions.",
      allowed,
      decision: value,
    });
  }
  return value;
}

export function createDefaultLifecyclePreview(savedAt) {
  return {
    current: "saved",
    persisted: true,
    history: [{ state: "saved", at: savedAt, note: "Plan package saved for preview review." }],
    allowedTransitions: ["draft", "clarified", "saved", "exported", "handoff-disabled", "consensus_ready", "export_ready", "archived"],
    executionEnabled: true,
    workflowRunEnabled: true,
  };
}

export function createUpdatedLifecycle(lifecycle, state, note, updatedAt) {
  const base = lifecycle && typeof lifecycle === "object" ? lifecycle : createDefaultLifecyclePreview(updatedAt);
  const history = Array.isArray(base.history) ? base.history : [];
  return {
    ...base,
    current: state,
    persisted: true,
    history: [...history, { state, at: updatedAt, note }],
    allowedTransitions: ["draft", "clarified", "saved", "exported", "handoff-disabled", "consensus_ready", "export_ready", "archived"],
    executionEnabled: true,
    workflowRunEnabled: true,
  };
}

export function updatePlanStateCurrent(planState, state) {
  const current = ["draft", "clarified", "consensus_ready", "export_ready"].includes(state) ? state : "export_ready";
  const lifecycleStatus = ["draft", "clarified", "saved", "exported", "handoff-disabled"].includes(state)
    ? state
    : (state === "consensus_ready" ? "clarified" : "saved");
  return {
    ...(planState || {}),
    current,
    lifecycleStatus,
    lifecycleStatuses: ["draft", "clarified", "saved", "exported", "handoff-disabled"],
    states: ["draft", "clarified", "consensus_ready", "export_ready", "archived"],
    previewOnly: false,
    drivesExecution: false,
    workflowRunHandoff: {
      status: "disabled",
      lifecycleStatus: "handoff-disabled",
      implemented: false,
      enabled: false,
      reason: "Phase140A persists lifecycle preview state only and does not call POST /workflow/run.",
    },
  };
}

export function toPlanSummary(plan) {
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
    selectedTemplate: plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "n/a",
    execution: "enabled",
    lifecycleState: plan.lifecyclePreview?.current || plan.planState?.current || "draft",
    lifecycleStatus: plan.planState?.lifecycleStatus || plan.lifecyclePreview?.current || "draft",
    answeredClarificationCount: plan.clarificationAnswers?.length ?? 0,
    unresolvedClarificationCount: plan.unresolvedClarifications?.length ?? 0,
    reviewPackageStatus: plan.reviewPackagePreview?.status || "ready-for-human-review",
    approvalGateStatus: plan.approvalGatePreview?.status || "waiting-human-review",
    approvalDecision: plan.approvalGatePreview?.currentDecision || null,
  };
}

export function createPackageClarificationSummary(questions = [], answers = []) {
  const answerByQuestion = new Map((Array.isArray(answers) ? answers : []).map((item) => [item.questionId, item]));
  const answeredClarifications = (Array.isArray(questions) ? questions : [])
    .filter((question) => answerByQuestion.has(question.questionId))
    .map((question) => {
      const answer = answerByQuestion.get(question.questionId);
      return {
        questionId: question.questionId,
        topic: question.topic,
        question: question.question,
        answer: answer.answer,
        answeredAt: answer.answeredAt || null,
        previewOnly: false,
      };
    });
  const unresolvedClarifications = (Array.isArray(questions) ? questions : [])
    .filter((question) => question.required && !answerByQuestion.has(question.questionId))
    .map((question) => ({
      questionId: question.questionId,
      topic: question.topic,
      question: question.question,
      required: true,
      previewOnly: false,
    }));
  return { answeredClarifications, unresolvedClarifications };
}
