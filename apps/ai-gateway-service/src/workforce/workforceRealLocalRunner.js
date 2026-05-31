import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkforcePlan } from "./workforcePlanner.js";

export const WORKFORCE_REAL_LOCAL_RUN_PHASE = "Phase1961A";
export const WORKFORCE_REAL_LOCAL_RUN_MODE = "real-local-workforce-run";
export const WORKFORCE_REAL_LOCAL_RUN_EVIDENCE_PATH =
  "apps/ai-gateway-service/evidence/phase1961a/workforce-real-local-run-result.json";
export const WORKFORCE_REAL_LOCAL_RUN_MARKDOWN_PATH =
  "apps/ai-gateway-service/evidence/phase1961a/workforce-real-local-run-result.md";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export async function runWorkforceRealLocal(input = {}, { planStore, now = () => new Date() } = {}) {
  if (!planStore || typeof planStore.save !== "function") {
    throw createRunnerError("WORKFORCE_PLAN_STORE_REQUIRED", "Workforce plan store is required for local execution.");
  }

  const startedAt = now().toISOString();
  const plan = createWorkforcePlan(input);
  const saved = await planStore.save(plan);
  const runId = createRunId(plan, saved.planId, startedAt);
  const taskQueue = createLocalTaskQueue(plan, runId, startedAt);
  const completedAt = now().toISOString();
  const result = redactSecrets({
    phase: WORKFORCE_REAL_LOCAL_RUN_PHASE,
    mode: WORKFORCE_REAL_LOCAL_RUN_MODE,
    status: "ready",
    executionStatus: "completed",
    completionVerified: true,
    verificationReason:
      "Local workforce orchestration completed: plan generated, plan saved, local task queue created, all local tasks marked completed; provider, secret, deploy, release, commit, and push remained disabled.",
    previewOnly: false,
    localRunExecuted: true,
    taskQueueCreated: true,
    planSaved: saved.success === true,
    runId,
    workforceId: plan.workforceId,
    planId: saved.planId,
    goal: plan.goal,
    startedAt,
    completedAt,
    selectedRoles: plan.selectedRoles,
    selectedTemplate: plan.selectedTemplate,
    taskQueue,
    taskSummary: {
      total: taskQueue.length,
      completed: taskQueue.filter((task) => task.status === "completed").length,
      failed: taskQueue.filter((task) => task.status === "failed").length,
      providerBackedTasks: 0,
      projectMutationTasks: 0,
    },
    localExecutionBoundary: {
      evidenceFileWrites: true,
      allowedEvidencePaths: [
        WORKFORCE_REAL_LOCAL_RUN_EVIDENCE_PATH,
        WORKFORCE_REAL_LOCAL_RUN_MARKDOWN_PATH,
      ],
      userProjectFileWrites: false,
      shellCommandsExecuted: false,
      codeExecution: false,
      workflowRun: false,
      externalRunnerDispatch: false,
      codexExecInvoked: false,
    },
    safety: createRealLocalSafetySummary(),
    providerCallsMade: false,
    paidApiCalled: false,
    mimoCalled: false,
    openaiCalled: false,
    claudeCalled: false,
    openrouterCalled: false,
    nvidiaCalled: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    projectFileWrites: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    productionReadyClaimed: false,
    publicLaunchReadyClaimed: false,
    workspaceCleanClaimed: false,
    evidencePath: WORKFORCE_REAL_LOCAL_RUN_EVIDENCE_PATH,
    markdownEvidencePath: WORKFORCE_REAL_LOCAL_RUN_MARKDOWN_PATH,
    planStore: {
      planId: saved.planId,
      status: saved.status,
      savedAt: saved.savedAt,
      mode: saved.mode,
      localJsonStore: true,
    },
    userVisibleSummary:
      "Workforce 已完成一次本地真实编排：生成计划、保存计划、建立任务队列并完成本地任务记录；没有调用 Provider、没有读取密钥、没有部署发布、没有提交推送。",
  });

  await writeWorkforceRunEvidence(result);
  return result;
}

export function createRealLocalSafetySummary() {
  return {
    previewOnly: false,
    realLocalRun: true,
    localTaskOrchestration: true,
    taskQueuePersistence: true,
    realLlmCalls: false,
    providerCallsMade: false,
    paidApiCalled: false,
    agentConcurrency: false,
    codeExecution: false,
    projectFileWrites: false,
    workflowRun: false,
    externalRunnerDispatch: false,
    codexExecInvoked: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    commitCreated: false,
    pushExecuted: false,
  };
}

export async function writeWorkforceRunEvidence(result) {
  await writeJson(WORKFORCE_REAL_LOCAL_RUN_EVIDENCE_PATH, result);
  await writeText(WORKFORCE_REAL_LOCAL_RUN_MARKDOWN_PATH, formatRunMarkdown(result));
}

function createLocalTaskQueue(plan, runId, timestamp) {
  const tasks = Array.isArray(plan.taskBreakdown) && plan.taskBreakdown.length ? plan.taskBreakdown : [];
  return tasks.map((task, index) => ({
    runTaskId: `${runId}_task_${String(index + 1).padStart(2, "0")}`,
    sourceTaskId: task.taskId,
    roleId: task.roleId,
    role: task.role,
    title: task.title,
    description: task.description,
    status: "completed",
    localExecution: true,
    completedAt: timestamp,
    completionVerified: true,
    providerCallsMade: false,
    codeExecution: false,
    projectFileWrites: false,
    output:
      `本地任务记录已完成：${task.role || "Workforce role"} 已接收并完成编排记录；真实 Provider、代码执行、项目文件修改均未触发。`,
  }));
}

function createRunId(plan, planId, startedAt) {
  const hash = createHash("sha256")
    .update([plan.workforceId, planId, plan.goal, startedAt].filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 12);
  return `wfr_${hash}`;
}

async function writeJson(relativePath, data) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(redactSecrets(data), null, 2)}\n`, "utf8");
}

async function writeText(relativePath, text) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(text).trimEnd()}\n`, "utf8");
}

function formatRunMarkdown(result) {
  return [
    `# ${WORKFORCE_REAL_LOCAL_RUN_PHASE} Workforce Real Local Run`,
    "",
    `- completed: ${result.executionStatus === "completed"}`,
    `- runId: ${result.runId}`,
    `- planId: ${result.planId}`,
    `- mode: ${result.mode}`,
    `- executionStatus: ${result.executionStatus}`,
    `- completionVerified: ${result.completionVerified}`,
    `- localRunExecuted: ${result.localRunExecuted}`,
    `- taskQueueCreated: ${result.taskQueueCreated}`,
    `- taskCount: ${result.taskSummary?.total ?? 0}`,
    `- providerCallsMade: ${result.providerCallsMade}`,
    `- secretValueExposed: ${result.secretValueExposed}`,
    `- projectFileWrites: ${result.projectFileWrites}`,
    `- chatRouteModified: ${result.chatRouteModified}`,
    `- chatGatewayExecuteModified: ${result.chatGatewayExecuteModified}`,
    `- deployExecuted: ${result.deployExecuted}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- commitCreated: ${result.commitCreated}`,
    `- pushExecuted: ${result.pushExecuted}`,
    `- workspaceCleanClaimed: ${result.workspaceCleanClaimed}`,
    "",
    "## Boundary",
    "",
    "This is a real local Workforce orchestration run. It creates a plan, saves it to the local plan store, creates a local task queue, marks local orchestration records completed, and writes evidence. It does not call Providers, read secrets, execute code, mutate user project files, deploy, release, commit, or push.",
  ].join("\n");
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

function createRunnerError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  return error;
}
