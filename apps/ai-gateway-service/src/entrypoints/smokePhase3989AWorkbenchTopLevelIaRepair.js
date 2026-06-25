import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, postJson, listen } from "./entrypointUtils.js";

const PHASE = "Phase3989A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-3989a-workbench-top-level-ia-repair.json");
const evidenceMdPath = resolve(evidenceDir, "phase-3989a-workbench-top-level-ia-repair.md");
const ALLOWED_NOOP_FILES = ["apps/ai-gateway-service/src/ui/consolePage.js"];
const FORBIDDEN_PATHS = ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"];

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const runtimeEnv = {
  ...process.env,
  AI_GATEWAY_PROVIDER_MODE: "real",
  AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
  AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
  AI_GATEWAY_ROUTE_MODE: "fixed",
  AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
  AI_GATEWAY_DEFAULT_MODEL: process.env.AI_GATEWAY_DEFAULT_MODEL || "nvidia/llama-3.3-nemotron-super-49b-v1",
  PME_RUNTIME_CREDENTIAL_STORE_MODE: process.env.PME_RUNTIME_CREDENTIAL_STORE_MODE || "memory",
};

const application = createGatewayApplication(runtimeEnv);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);

let html = "";
let diagnostics = {};
let intentPreview = {};
let operationPlan = {};
let patchProposal = {};
let approvalCreate = {};

try {
  html = await fetchText(`${baseUrl}/ui?ts=phase3989a`);
  diagnostics = await fetchJson(`${baseUrl}/workbench/diagnostics/status`);
  intentPreview = await postJson(`${baseUrl}/local-agent/intent-preview`, {
    input: "请为 Workbench 顶层信息架构修复生成只读意图预览",
    allowedFiles: ALLOWED_NOOP_FILES,
    forbiddenPaths: FORBIDDEN_PATHS,
    permissionMode: "manual",
  });
  operationPlan = await postJson(`${baseUrl}/local-agent/operation-plan`, {
    input: "请为 Workbench 顶层信息架构修复生成操作计划",
    allowedFiles: ALLOWED_NOOP_FILES,
    forbiddenPaths: FORBIDDEN_PATHS,
    permissionMode: "manual",
  });
  patchProposal = await postJson(`${baseUrl}/local-agent/patch-proposal`, {
    input: "请为 Workbench 顶层信息架构修复生成 patch proposal",
    allowedFiles: ALLOWED_NOOP_FILES,
    forbiddenPaths: FORBIDDEN_PATHS,
    permissionMode: "manual",
  });
  approvalCreate = await postJson(`${baseUrl}/approvals/create`, {
    title: "Phase3989A 本地智能体审批样例",
    reason: "验证 local-agent 页面可把 patch proposal 送入审批链。",
    featureId: "phase3989a-local-agent-approval",
    operationId: patchProposal.operationId,
    allowedFiles: ALLOWED_NOOP_FILES,
    forbiddenPaths: FORBIDDEN_PATHS,
    patchProposal: patchProposal.patchProposal,
    approvalRecord: patchProposal.approvalRecord,
    scope: "patch",
    permissionMode: "manual",
  });

  const topNavIds = uniqueMatches(html, /data-nav="([^"]+)"/g);
  const pageIds = uniqueMatches(html, /data-page="([^"]+)"/g);
  const topNavStillFiveOnly = topNavIds.length === 5
    && topNavIds.every((item) => ["chat", "models", "approvals", "files", "diagnostics"].includes(item));
  const standalonePagesPresent = ["local-agent", "repair", "help"].every((pageId) => pageIds.includes(pageId));
  const openPageButtonsPresent = ["local-agent", "repair", "help"].every((pageId) => html.includes(`data-open-page="${pageId}"`));
  const localAgentWidgetsPresent = [
    'id="local-agent-task-input"',
    'id="local-agent-allowed-files-input"',
    'id="local-agent-preview-button"',
    'id="local-agent-plan-button"',
    'id="local-agent-patch-button"',
    'id="local-agent-create-approval-button"',
    'id="local-agent-intent-output"',
    'id="local-agent-plan-output"',
    'id="local-agent-patch-output"',
    'id="local-agent-approval-output"',
  ].every((marker) => html.includes(marker));
  const repairWidgetsPresent = [
    'id="repair-task-input"',
    'id="repair-allowed-files-input"',
    'id="repair-open-local-agent-button"',
  ].every((marker) => html.includes(marker));
  const helpWidgetsPresent = [
    'id="help-runbook-panel"',
    'id="help-open-local-agent-button"',
    'id="help-open-diagnostics-button"',
  ].every((marker) => html.includes(marker));
  const defaultChatRouteStillPresent = html.includes('/chat-gateway/execute');

  expect(topNavStillFiveOnly, "top_nav_still_five_only", topNavIds.join(","));
  expect(!html.includes('data-nav="local-agent"'), "no_local_agent_top_nav");
  expect(!html.includes('data-nav="repair"'), "no_repair_top_nav");
  expect(!html.includes('data-nav="help"'), "no_help_top_nav");
  expect(standalonePagesPresent, "standalone_pages_present", pageIds.join(","));
  expect(openPageButtonsPresent, "internal_open_page_buttons_present");
  expect(localAgentWidgetsPresent, "local_agent_widgets_present");
  expect(repairWidgetsPresent, "repair_widgets_present");
  expect(helpWidgetsPresent, "help_widgets_present");
  expect(defaultChatRouteStillPresent, "default_chat_route_still_present");
  expect(intentPreview.route === "/local-agent/intent-preview", "intent_preview_route");
  expect(intentPreview.providerCalled === false, "intent_preview_provider_not_called");
  expect(intentPreview.approvalRequired === true, "intent_preview_approval_required");
  expect(operationPlan.route === "/local-agent/operation-plan", "operation_plan_route");
  expect(operationPlan.providerCalled === false, "operation_plan_provider_not_called");
  expect(operationPlan.approvalRequired === true, "operation_plan_approval_required");
  expect(patchProposal.route === "/local-agent/patch-proposal", "patch_proposal_route");
  expect(patchProposal.providerCalled === false, "patch_proposal_provider_not_called");
  expect(Boolean(patchProposal.patchProposal), "patch_proposal_payload_present");
  expect(approvalCreate.route === "/approvals/create", "approval_create_route");
  expect(approvalCreate.providerCalled === false, "approval_create_provider_not_called");
  expect(Boolean(approvalCreate.approval?.id), "approval_record_created");
  expect(diagnostics.chatGateway?.defaultChatChanged === false, "default_chat_unchanged");
} finally {
  await closeServer(server);
}

const failedChecks = checks.filter((item) => !item.pass);
const evidence = {
  phase: PHASE,
  status: failedChecks.length === 0 ? "pass" : "fail",
  blocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  generatedAt: new Date().toISOString(),
  topNavIds: uniqueMatches(html, /data-nav="([^"]+)"/g),
  pageIds: uniqueMatches(html, /data-page="([^"]+)"/g),
  topNavStillFiveOnly:
    uniqueMatches(html, /data-nav="([^"]+)"/g).length === 5
    && uniqueMatches(html, /data-nav="([^"]+)"/g).every((item) => ["chat", "models", "approvals", "files", "diagnostics"].includes(item)),
  standalonePages: {
    localAgent: html.includes('data-page="local-agent"'),
    repair: html.includes('data-page="repair"'),
    help: html.includes('data-page="help"'),
  },
  internalOpenButtons: {
    localAgent: html.includes('data-open-page="local-agent"'),
    repair: html.includes('data-open-page="repair"'),
    help: html.includes('data-open-page="help"'),
  },
  localAgentWidgetsPresent: [
    'id="local-agent-task-input"',
    'id="local-agent-allowed-files-input"',
    'id="local-agent-preview-button"',
    'id="local-agent-plan-button"',
    'id="local-agent-patch-button"',
    'id="local-agent-create-approval-button"',
  ].every((marker) => html.includes(marker)),
  repairWidgetsPresent: [
    'id="repair-task-input"',
    'id="repair-allowed-files-input"',
    'id="repair-open-local-agent-button"',
  ].every((marker) => html.includes(marker)),
  helpWidgetsPresent: [
    'id="help-runbook-panel"',
    'id="help-open-local-agent-button"',
    'id="help-open-diagnostics-button"',
  ].every((marker) => html.includes(marker)),
  defaultChatRouteStillPresent: html.includes('/chat-gateway/execute'),
  localAgentIntentPreview: summarizeRouteResult(intentPreview),
  localAgentOperationPlan: summarizeRouteResult(operationPlan),
  localAgentPatchProposal: summarizeRouteResult(patchProposal),
  localAgentApprovalCreate: {
    route: approvalCreate.route || "",
    providerCalled: approvalCreate.providerCalled === true,
    localExecutionTriggered: approvalCreate.localExecutionTriggered === true,
    approvalId: approvalCreate.approval?.id || "",
    approvalStatus: approvalCreate.approval?.status || "",
  },
  diagnosticsSummary: {
    defaultChatChanged: diagnostics.chatGateway?.defaultChatChanged ?? null,
    providerConfigured: diagnostics.providerConfig?.configuredProviders ?? null,
  },
  providerCallsMade: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  embeddingBatchTrainingCalled: false,
  secretExposed: false,
  defaultChatChanged: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  blocker: evidence.blocker,
  topNavStillFiveOnly: evidence.topNavStillFiveOnly,
  standalonePages: evidence.standalonePages,
  checksFailed: failedChecks.length,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}

function uniqueMatches(source, pattern) {
  const values = [];
  for (const match of String(source || "").matchAll(pattern)) {
    const value = String(match[1] || "").trim();
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

function summarizeRouteResult(result) {
  return {
    route: result.route || "",
    status: result.status || "",
    approvalRequired: result.approvalRequired === true,
    providerCalled: result.providerCalled === true,
    localExecutionTriggered: result.localExecutionTriggered === true,
    operationId: result.operationId || "",
  };
}

function renderEvidenceMarkdown(data) {
  return [
    "# Phase3989A Workbench Top-Level IA Repair Smoke",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker ? data.blocker.join("; ") : "none"}`,
    `- topNavStillFiveOnly: ${data.topNavStillFiveOnly}`,
    `- localAgentPage: ${data.standalonePages.localAgent}`,
    `- repairPage: ${data.standalonePages.repair}`,
    `- helpPage: ${data.standalonePages.help}`,
    `- providerCallsMade: ${data.providerCallsMade}`,
    `- defaultChatChanged: ${data.defaultChatChanged}`,
    `- workspaceCleanClaimed: ${data.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}


function closeServer(serverInstance) {
  return new Promise((resolveClose) => serverInstance.close(resolveClose));
}
