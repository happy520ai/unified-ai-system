import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const PHASE = "Phase3988A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-3988a-system-completion-gap-audit.json");
const evidenceMdPath = resolve(evidenceDir, "phase-3988a-system-completion-gap-audit.md");
const docsPath = resolve(repoRoot, "docs/phase3988a-system-completion-gap-audit.md");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const consolePage = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const httpServer = readText("apps/ai-gateway-service/src/http/httpServer.js");
const providerKeyConfigStore = readText("apps/ai-gateway-service/src/provider-config/providerKeyConfigStore.js");
const capabilitySafeExecutionRouter = readText("apps/ai-gateway-service/src/chat-gateway/capabilitySafeExecutionRouter.js");
const workforceService = readText("apps/ai-gateway-service/src/workforce/workforceService.js");
const workforceRunner = readText("apps/ai-gateway-service/src/workforce/workforceRealLocalRunner.js");
const rootPackage = readText("package.json");
const servicePackage = readText("apps/ai-gateway-service/package.json");
const docs = existsSync(docsPath) ? readFileSync(docsPath, "utf8") : "";
const phase321Evidence = readJson(resolve(evidenceDir, "phase-321a-workbench-product-recovery.json")) ?? {};
const opencodeState = readJson(resolve(repoRoot, "docs/project-brain/opencode-autopilot-state.json")) ?? {};
const currentPhaseState = readJson(resolve(repoRoot, "docs/phase-orchestrator/current-phase-state.json")) ?? {};

const pageIds = uniqueMatches(consolePage, /data-page="([^"]+)"/g);
const topNavIds = uniqueMatches(consolePage, /data-nav="([^"]+)"/g);

const routes = {
  ui: httpServer.includes('url.pathname === "/ui"') || httpServer.includes('url.pathname === "/console"'),
  chatGatewayExecute: httpServer.includes('url.pathname === "/chat-gateway/execute"') || httpServer.includes('url.pathname === "/chat/gateway"'),
  chatGatewayDryRun: httpServer.includes('url.pathname === "/chat-gateway/dry-run-task"'),
  providerConfigStatus: httpServer.includes('url.pathname === "/provider-config/status"'),
  providerConfigSave: httpServer.includes('url.pathname === "/provider-config/save"'),
  providerConfigTest: httpServer.includes('url.pathname === "/provider-config/test"'),
  modelLibrary: httpServer.includes('url.pathname === "/model-library"'),
  modelLibraryMatrix: httpServer.includes('url.pathname === "/model-library/usability-matrix"'),
  approvals: httpServer.includes('url.pathname === "/approvals"'),
  approvalsCreate: httpServer.includes('url.pathname === "/approvals/create"'),
  localAgentIntentPreview: httpServer.includes('url.pathname === "/local-agent/intent-preview"'),
  localAgentOperationPlan: httpServer.includes('url.pathname === "/local-agent/operation-plan"'),
  localAgentPatchProposal: httpServer.includes('url.pathname === "/local-agent/patch-proposal"'),
  localOperationApplyApproved: httpServer.includes('url.pathname === "/local-operation/apply-approved"'),
  diagnostics: httpServer.includes('url.pathname === "/workbench/diagnostics/status"'),
  workforceRunLocal: httpServer.includes('url.pathname === "/workforce/run-local"'),
  knowledgeHealth: httpServer.includes('url.pathname === "/knowledge/health"'),
  workflowHealth: httpServer.includes('url.pathname === "/workflow/health"'),
};

const uiFacts = {
  topNavIds,
  pageIds,
  hasChatPage: pageIds.includes("chat"),
  hasModelsPage: pageIds.includes("models"),
  hasApprovalsPage: pageIds.includes("approvals"),
  hasFilesPage: pageIds.includes("files"),
  hasDiagnosticsPage: pageIds.includes("diagnostics"),
  hasLocalAgentPage: pageIds.includes("local-agent") || topNavIds.includes("local-agent"),
  hasRepairPage: pageIds.includes("repair") || topNavIds.includes("repair"),
  hasHelpPage: pageIds.includes("help") || topNavIds.includes("help"),
  hasStandaloneSettingsPage: pageIds.includes("settings") || topNavIds.includes("settings"),
  selectedProviderPinnedToNvidia: consolePage.includes('selectedProvider: "nvidia"'),
  modelDropdownUsesSelectableGate:
    consolePage.includes('item.verificationStatus === "smoke_passed"') &&
    consolePage.includes("item.selectable === true") &&
    consolePage.includes("item.directChatAllowed === true"),
  providerTestButtonClaimsNoRealTask: consolePage.includes("检查配置状态（不调用真实任务）"),
  providerTestButtonShowsRealCallOutcome: consolePage.includes('showToast(result.realExternalCall ? "已执行真实连接测试。"'),
};

const providerFacts = {
  secretsRedacted: providerKeyConfigStore.includes("secretValueVisible: false") && providerKeyConfigStore.includes("secretsRedacted: true"),
  saveSupportsOpenRouter: providerKeyConfigStore.includes('const allowedProviders = ["nvidia", "openrouter"]'),
  testIsHardcodedNvidia: providerKeyConfigStore.includes('providerId: "nvidia"') &&
    providerKeyConfigStore.includes("createNvidiaUnifiedClient") &&
    providerKeyConfigStore.includes("client.chatCompletion"),
  defaultProviderIdOpenRouter: providerKeyConfigStore.includes('defaultProviderId: "openrouter"'),
  statusReadsNvidiaOnly: providerKeyConfigStore.includes('runtimeCredentialStore?.describe?.("nvidia")'),
};

const executionFacts = {
  executeRoutePinnedToNvidia: capabilitySafeExecutionRouter.includes('selected.providerId !== "nvidia"') &&
    capabilitySafeExecutionRouter.includes("Phase312A only allows NVIDIA real provider execution."),
  workloadRunLocalImplemented: workforceService.includes("runLocal(input = {})") && workforceRunner.includes("Local workforce orchestration completed"),
  phase321CollapsedToFiveBoards: Array.isArray(phase321Evidence.currentFiveModules) && phase321Evidence.currentFiveModules.length === 5,
  phase321ProviderTestRealExternalCall: phase321Evidence.providerTestRealExternalCall === true,
  opencodeGovernorReady: opencodeState.status === "passed" && opencodeState.resumeReady === true,
  currentPhaseStateStale:
    currentPhaseState.latestPhase === "Phase1955P-Retry-Fail" &&
    opencodeState.phaseId === "Phase3979A-OpenCode-Autopilot-Governor",
};

const moduleMatrix = [
  {
    id: "chat_gateway_mainline",
    label: "Chat Gateway 主链",
    expected: "存在真实执行入口，返回 evidenceId，并保持 selectable gate。",
    status:
      routes.chatGatewayExecute && routes.chatGatewayDryRun && uiFacts.modelDropdownUsesSelectableGate
        ? "implemented_and_wired"
        : "missing",
    facts: [
      "POST /chat-gateway/execute 已接线。",
      "POST /chat-gateway/dry-run-task 已接线。",
      "聊天页发送动作直接调用 /chat-gateway/execute。",
      "普通聊天下拉仅保留 smoke_passed + selectable + directChatAllowed 模型。",
    ],
  },
  {
    id: "model_library_gate",
    label: "统一模型库与 selectable gate",
    expected: "模型库状态、可选性和 direct chat gate 必须在 UI 与后端同时生效。",
    status:
      routes.modelLibrary && routes.modelLibraryMatrix && uiFacts.modelDropdownUsesSelectableGate
        ? "implemented_and_wired"
        : "missing",
    facts: [
      "GET /model-library 与 /model-library/usability-matrix 已接线。",
      "模型库页展示 verificationStatus / selectable / evidenceId。",
      "普通聊天下拉二次过滤 capabilityBucket=chat/reasoning_chat/code。",
    ],
  },
  {
    id: "provider_config_center",
    label: "Provider 配置中心",
    expected: "多 Provider 状态检测、Base URL、模型测试、密钥不明文。",
    status:
      routes.providerConfigStatus && routes.providerConfigSave && routes.providerConfigTest && providerFacts.secretsRedacted
        ? "partial_integration"
        : "missing",
    facts: [
      "GET /provider-config/status、POST /provider-config/save、POST /provider-config/test 已接线。",
      "secretValueVisible=false，页面密码框不回显明文。",
      "当前 UI 只暴露 NVIDIA Base URL 和 NVIDIA API Key 输入。",
      "provider-config/test 通过 createNvidiaUnifiedClient + chatCompletion 走真实 NVIDIA 调用路径。",
    ],
  },
  {
    id: "multi_provider_runtime",
    label: "多 Provider 真打通",
    expected: "OpenAI / Claude / OpenRouter / MiMo 至少在配置中心、选择链路和执行链路上保持一致。",
    status:
      providerFacts.saveSupportsOpenRouter && executionFacts.executeRoutePinnedToNvidia && uiFacts.selectedProviderPinnedToNvidia
        ? "partial_integration"
        : "missing",
    facts: [
      "provider save 允许 nvidia/openrouter，但 status/test 主路径仍是 NVIDIA。",
      "前端 state.selectedProvider 固定为 nvidia。",
      "capabilitySafeExecutionRouter 明确阻断非 NVIDIA 真实执行。",
      "因此多 Provider 不是完整可用链，只是局部配置入口和未来槽位。",
    ],
  },
  {
    id: "required_workbench_boards",
    label: "Workbench 必要页面板块",
    expected: "Chat、模型配置、审批任务、安全修复、使用帮助、系统诊断、本地智能体需要清晰可达。",
    status:
      uiFacts.hasChatPage &&
      uiFacts.hasModelsPage &&
      uiFacts.hasApprovalsPage &&
      uiFacts.hasDiagnosticsPage &&
      !uiFacts.hasLocalAgentPage &&
      !uiFacts.hasRepairPage &&
      !uiFacts.hasHelpPage
        ? "partial_integration"
        : "missing",
    facts: [
      `当前 data-page 只有: ${pageIds.join(", ") || "none"}`,
      `当前 data-nav 只有: ${topNavIds.join(", ") || "none"}`,
      "本地智能体 / 安全修复 / 使用帮助没有作为一级页面存在。",
      "files 页当前是文件登记，不是安全修复页；diagnostics 页承担了部分设置语义。",
    ],
  },
  {
    id: "approvals_flow",
    label: "审批任务链",
    expected: "审批创建、批准、拒绝、批准后 apply 必须真实存在且不越权。",
    status:
      routes.approvals && routes.approvalsCreate && routes.localOperationApplyApproved
        ? "implemented_and_wired"
        : "missing",
    facts: [
      "GET /approvals、POST /approvals/create、POST /approvals/{id}/approve|reject 已接线。",
      "POST /local-operation/apply-approved 已接线。",
      "Phase321A evidence 显示未批准前 blocked、批准后 apply 成功。",
    ],
  },
  {
    id: "local_agent_execution",
    label: "本地智能体 / 本地操作链",
    expected: "意图预览、操作计划、patch proposal、approval record、apply-approved 形成闭环，并在 UI 中清晰可达。",
    status:
      routes.localAgentIntentPreview && routes.localAgentOperationPlan && routes.localAgentPatchProposal && !uiFacts.hasLocalAgentPage
        ? "partial_integration"
        : "missing",
    facts: [
      "POST /local-agent/intent-preview、/local-agent/operation-plan、/local-agent/patch-proposal 已接线。",
      "这些能力当前未作为一级 Workbench 页面提供，只能通过审批页或内部按钮绕到局部动作。",
      "因此闭环能力存在，但产品入口不完整。",
    ],
  },
  {
    id: "diagnostics_board",
    label: "系统诊断页",
    expected: "至少要有可打开的诊断页，展示 health / provider / model / recent execution 摘要。",
    status:
      routes.diagnostics && uiFacts.hasDiagnosticsPage
        ? "implemented_and_wired"
        : "missing",
    facts: [
      "GET /workbench/diagnostics/status 已接线。",
      "diagnostics 页展示 health、provider、模型数量、最近聊天结果和原始摘要。",
      "doctor 命令仍是只读提示，不会由 UI 直接执行。",
    ],
  },
  {
    id: "workforce_real_local",
    label: "Workforce 本地真实编排",
    expected: "至少形成本地运行、证据落盘和安全边界闭环。",
    status:
      routes.workforceRunLocal && executionFacts.workloadRunLocalImplemented
        ? "implemented_and_wired"
        : "missing",
    facts: [
      "POST /workforce/run-local 已接线。",
      "workforceRealLocalRunner 会生成计划、任务队列和 evidence，不调用 provider。",
      "该能力存在，但并未成为当前 /ui 五个一级页中的独立板块。",
    ],
  },
  {
    id: "phase_state_tracking",
    label: "阶段状态追踪",
    expected: "current-phase-state 应跟上最新已完成阶段，便于持续接管。",
    status: executionFacts.currentPhaseStateStale ? "partial_integration" : "implemented_and_wired",
    facts: [
      `docs/project-brain/opencode-autopilot-state.json 当前为 ${opencodeState.phaseId || "unknown"} / status=${opencodeState.status || "unknown"}`,
      `docs/phase-orchestrator/current-phase-state.json 当前 latestPhase=${currentPhaseState.latestPhase || "unknown"}`,
      "当前 phase-orchestrator 状态仍停在 Phase1955P-Retry-Fail，未反映 Phase321A / Phase3979A / 本轮审计。",
    ],
  },
];

const statusCounts = countBy(moduleMatrix, "status");
const fullyImplementedExcludingDeploy = moduleMatrix.every((item) => item.status === "implemented_and_wired");

const requiredBoards = [
  "chat",
  "models",
  "approvals",
  "local-agent",
  "repair",
  "help",
  "diagnostics",
];

const boardCoverage = requiredBoards.map((boardId) => ({
  boardId,
  present: pageIds.includes(boardId) || topNavIds.includes(boardId),
}));

const currentBlockers = [];
if (!uiFacts.hasLocalAgentPage) currentBlockers.push("local_agent_top_level_page_missing");
if (!uiFacts.hasRepairPage) currentBlockers.push("safe_repair_top_level_page_missing");
if (!uiFacts.hasHelpPage) currentBlockers.push("help_top_level_page_missing");
if (providerFacts.testIsHardcodedNvidia) currentBlockers.push("provider_config_test_nvidia_only");
if (executionFacts.executeRoutePinnedToNvidia) currentBlockers.push("chat_gateway_real_execution_nvidia_only");
if (executionFacts.currentPhaseStateStale) currentBlockers.push("phase_orchestrator_state_stale");

const cannotClaim = [
  "不能声称除部署外全部板块都已真实实现。",
  "不能声称多 Provider 已在配置、选择、执行三个层面全部打通。",
  "不能声称本地智能体 / 安全修复 / 使用帮助已经作为独立一级页面交付。",
  "不能声称 phase-orchestrator 当前状态文件已经反映最新阶段。",
];

expect(routes.ui, "route_ui_exists");
expect(routes.chatGatewayExecute, "route_chat_gateway_execute_exists");
expect(routes.modelLibrary, "route_model_library_exists");
expect(routes.providerConfigStatus && routes.providerConfigSave && routes.providerConfigTest, "provider_config_routes_exist");
expect(routes.approvals && routes.approvalsCreate, "approval_routes_exist");
expect(routes.localAgentIntentPreview && routes.localAgentOperationPlan && routes.localAgentPatchProposal, "local_agent_routes_exist");
expect(routes.diagnostics, "diagnostics_route_exists");
expect(routes.workforceRunLocal, "workforce_run_local_route_exists");
expect(uiFacts.hasChatPage && uiFacts.hasModelsPage && uiFacts.hasApprovalsPage && uiFacts.hasFilesPage && uiFacts.hasDiagnosticsPage, "current_ui_five_page_shell_exists");
expect(!uiFacts.hasLocalAgentPage && !uiFacts.hasRepairPage && !uiFacts.hasHelpPage, "required_top_level_pages_missing_confirmed");
expect(uiFacts.selectedProviderPinnedToNvidia, "ui_provider_pinned_to_nvidia");
expect(providerFacts.secretsRedacted, "provider_secrets_redacted");
expect(providerFacts.testIsHardcodedNvidia, "provider_test_hardcoded_nvidia");
expect(executionFacts.executeRoutePinnedToNvidia, "execute_route_nvidia_only_confirmed");
expect(executionFacts.workloadRunLocalImplemented, "workforce_real_local_implemented");
expect(executionFacts.phase321CollapsedToFiveBoards, "phase321a_five_board_state_confirmed");
expect(executionFacts.opencodeGovernorReady, "opencode_governor_ready");
expect(docs.includes(PHASE), "docs_phase3988a_present", "docs/phase3988a-system-completion-gap-audit.md");
expect(rootPackage.includes("verify:phase3988a-system-completion-gap-audit"), "root_verify_script_present");
expect(servicePackage.includes("verify:phase3988a-system-completion-gap-audit"), "service_verify_script_present");
expect(!containsSecretLikeValue(JSON.stringify({ phase321Evidence, opencodeState, currentPhaseState })), "no_secret_like_value_in_inputs");

const failedChecks = checks.filter((item) => !item.pass);
const finalEvidence = {
  phase: PHASE,
  status: failedChecks.length === 0 ? "pass" : "fail",
  blocker: failedChecks.length === 0 ? null : failedChecks.map((item) => `${item.id}: ${item.detail}`),
  generatedAt: new Date().toISOString(),
  auditStatus: failedChecks.length === 0 ? "pass" : "fail",
  fullyImplementedExcludingDeploy,
  systemCompletionStatus: fullyImplementedExcludingDeploy ? "fully_implemented_excluding_deploy" : "gaps_detected",
  summary: {
    totalAuditedModules: moduleMatrix.length,
    implementedAndWired: statusCounts.implemented_and_wired ?? 0,
    partialIntegration: statusCounts.partial_integration ?? 0,
    missing: statusCounts.missing ?? 0,
    requiredBoardCount: requiredBoards.length,
    requiredBoardPresentCount: boardCoverage.filter((item) => item.present).length,
  },
  boardCoverage,
  moduleMatrix,
  currentBlockers,
  cannotClaim,
  opencodeGovernor: {
    phaseId: opencodeState.phaseId ?? null,
    status: opencodeState.status ?? null,
    resumeReady: opencodeState.resumeReady === true,
    nextTaskId: opencodeState.nextTaskId ?? null,
    roundsCompleted: opencodeState.roundsCompleted ?? null,
  },
  phaseStateTracking: {
    latestPhase: currentPhaseState.latestPhase ?? null,
    staleComparedWithOpencodeGovernor: executionFacts.currentPhaseStateStale,
  },
  supportingFacts: {
    routes,
    uiFacts,
    providerFacts,
    executionFacts,
    phase321Evidence: {
      status: phase321Evidence.status ?? null,
      currentFiveModules: phase321Evidence.currentFiveModules ?? [],
      hiddenLegacyEntries: phase321Evidence.hiddenLegacyEntries ?? [],
      providerTestRealExternalCall: phase321Evidence.providerTestRealExternalCall === true,
    },
  },
  verificationCommands: [
    "node --check apps/ai-gateway-service/src/entrypoints/verifyPhase3988ASystemCompletionGapAudit.js",
    "pnpm verify:phase3988a-system-completion-gap-audit",
    "pnpm verify:phase321a-workbench-product-recovery",
    "pnpm verify:phase107a-secret-safety",
    "pnpm health:phase12a",
    "pnpm doctor:phase13a",
    "pnpm verify:safe-regression-matrix",
    "pnpm -r --if-present check",
    "pnpm sync:readme-agents-current-state",
    "pnpm verify:phase306c-readme-agents-auto-sync-guard",
  ],
  changedFiles: [
    "docs/phase3988a-system-completion-gap-audit.md",
    "apps/ai-gateway-service/src/entrypoints/verifyPhase3988ASystemCompletionGapAudit.js",
    "apps/ai-gateway-service/package.json",
    "package.json",
    "apps/ai-gateway-service/evidence/phase-3988a-system-completion-gap-audit.json",
    "apps/ai-gateway-service/evidence/phase-3988a-system-completion-gap-audit.md",
  ],
  providerCallsMade: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  nvidiaCalled: false,
  embeddingBatchTrainingCalled: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  checks,
  failedChecks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(finalEvidence), "utf8");

console.log(JSON.stringify({
  status: finalEvidence.status,
  blocker: finalEvidence.blocker,
  fullyImplementedExcludingDeploy: finalEvidence.fullyImplementedExcludingDeploy,
  systemCompletionStatus: finalEvidence.systemCompletionStatus,
  implementedAndWired: finalEvidence.summary.implementedAndWired,
  partialIntegration: finalEvidence.summary.partialIntegration,
  missing: finalEvidence.summary.missing,
  currentBlockers: finalEvidence.currentBlockers,
  checksFailed: finalEvidence.failedChecks.length,
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

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function containsSecretLikeValue(source) {
  return /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|pk[-_][A-Za-z0-9._-]{8,}|ak[-_][A-Za-z0-9._-]{8,})\b/i.test(String(source ?? ""));
}

function renderMarkdown(data) {
  const matrixLines = data.moduleMatrix.map((item) =>
    `| ${item.label} | ${item.status} | ${item.facts.join("<br>")} |`,
  );
  const blockerLines = data.currentBlockers.length
    ? data.currentBlockers.map((item) => `- ${item}`).join("\n")
    : "- none";
  const cannotClaimLines = data.cannotClaim.map((item) => `- ${item}`).join("\n");

  return [
    `# ${PHASE} System Completion Gap Audit`,
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker ? data.blocker.join("; ") : "none"}`,
    `- fullyImplementedExcludingDeploy: ${data.fullyImplementedExcludingDeploy}`,
    `- systemCompletionStatus: ${data.systemCompletionStatus}`,
    `- implementedAndWired: ${data.summary.implementedAndWired}`,
    `- partialIntegration: ${data.summary.partialIntegration}`,
    `- missing: ${data.summary.missing}`,
    `- providerCallsMade: ${data.providerCallsMade}`,
    `- secretValueExposed: ${data.secretValueExposed}`,
    `- workspaceCleanClaimed: ${data.workspaceCleanClaimed}`,
    "",
    "## Module Matrix",
    "",
    "| Module | Status | Facts |",
    "| --- | --- | --- |",
    ...matrixLines,
    "",
    "## Current Blockers",
    "",
    blockerLines,
    "",
    "## Cannot Claim",
    "",
    cannotClaimLines,
    "",
    "## Validation Commands",
    "",
    ...data.verificationCommands.map((command) => `- ${command}`),
    "",
  ].join("\n");
}
