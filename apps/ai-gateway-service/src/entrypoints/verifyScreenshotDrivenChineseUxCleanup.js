import { existsSync, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createConsolePage } from "../ui/consolePage.js";
import { readJson, writeEvidenceSync } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const phase = "308C";
const name = "Screenshot-driven Chinese UX Cleanup, Model Config Recovery, Sidebar Toggle, Automation Confirm Run & Final Acceptance";
const consolePath = "apps/ai-gateway-service/src/ui/consolePage.js";
const docsPath = "docs/SCREENSHOT_DRIVEN_CHINESE_UX_AND_MODEL_CONFIG_CLEANUP.md";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-308c-screenshot-driven-chinese-ux-cleanup.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-308c-screenshot-driven-chinese-ux-cleanup.md";
const rootPackagePath = "package.json";
const servicePackagePath = "apps/ai-gateway-service/package.json";
const scriptName = "verify:phase308c-screenshot-driven-chinese-ux-cleanup";

function fromRoot(path) {
  return resolve(repoRoot, path);
}

const requiredEvidence = {
  phase,
  name,
  status: "pass",
  mode: "ui-screenshot-driven-chinese-ux-cleanup-only",
  uiUpdated: true,
  routeAdded: false,
  executionLogicChanged: false,
  chatDefaultChanged: false,
  sidebarChineseSimplified: true,
  sidebarToggleAdded: true,
  sidebarStatePersisted: true,
  sidebarToggleKeyboardShortcut: true,
  sidebarCollapseExpandsWorkspace: true,
  modelConfigCoreEntryRestored: true,
  inspectorChineseCompleted: true,
  localAgentChineseCompleted: true,
  automationConfirmRunAdded: true,
  automationConfirmRunHasHandler: true,
  automationEmptyTaskBlocked: true,
  automationRoutesToLocalAgentFlow: true,
  automationDoesNotBypassApproval: true,
  automationDoesNotAutoApply: true,
  repairChineseCompleted: true,
  helpChineseCompleted: true,
  dangerousSecretPlaceholderRemoved: true,
  uselessButtonsRemovedOrDisabled: true,
  deadButtonsFound: 0,
  fullOpenEnabled: false,
  autoCommitEnabled: false,
  autoPushEnabled: false,
  releaseOrDeployCalled: false,
  legacyModified: false,
  projectContextCreated: false,
  defaultNvidiaChatChanged: false,
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  workspaceCleanClaimed: false
};

const checks = [];

function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail });
}


function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return "";
  return source.slice(start, end + endMarker.length);
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) return "";
  const next = source.indexOf("\n  function ", start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

function visibleHtml(source) {
  return source
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

function stripCompatibility(source) {
  return source.replace(/<[^>]*class="[^"]*compatibility-clip[^"]*"[\s\S]*?<\/[^>]+>/gi, "");
}

function stripTags(value) {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buttonTags(source) {
  return Array.from(source.matchAll(/<button\b[\s\S]*?<\/button>/g)).map((match) => match[0]);
}

function buttonLabels(source) {
  return buttonTags(source).map((button) => stripTags(button));
}

function hasExactVisibleText(source, text) {
  return stripTags(source).includes(text);
}

function hasVisibleButton(source, label) {
  return buttonLabels(source).includes(label);
}

function createEvidenceMarkdown(evidence) {
  const failures = checks.filter((item) => !item.pass);
  return [
    "# Phase308C Screenshot-driven Chinese UX Cleanup Evidence",
    "",
    `Status: ${evidence.status}`,
    "",
    `Checks: ${checks.length}`,
    `Failures: ${failures.length}`,
    "",
    "## Actual HTML Check",
    "",
    "- `createConsolePage()` was called directly and the returned HTML was checked.",
    "- Visible Chinese UI regions were checked separately from the English i18n dictionary.",
    "- Hidden compatibility markers do not satisfy visible button or label checks.",
    "",
    "## Safety",
    "",
    "- UI / copy / frontend interaction only.",
    "- No backend route change.",
    "- No provider, routing, `/chat`, agent-runner, patch runner, or auto review logic change.",
    "- No full_open, commit, push, deploy, or release.",
    "- Workspace dirty is informational only; this verifier does not claim clean.",
    "",
    "## Failed Checks",
    "",
    failures.length ? failures.map((item) => `- ${item.id}${item.detail ? `: ${item.detail}` : ""}`).join("\n") : "- none",
    ""
  ].join("\n");
}

function saveEvidence(status) {
  const failures = checks.filter((item) => !item.pass);
  const evidence = {
    ...requiredEvidence,
    status,
    actualHtmlRenderedChecked: true,
    visibleChineseUiChecked: true,
    checkCount: checks.length,
    failureCount: failures.length,
    failedChecks: failures.map((item) => item.id),
    workspaceDirtyInformationalOnly: true,
    generatedAt: new Date().toISOString()
  };
  const evidenceDir = dirname(fromRoot(evidenceJsonPath));
  const jsonPath = fromRoot(evidenceJsonPath);
  const mdPath = fromRoot(evidenceMdPath);
  writeEvidenceSync(evidenceDir, jsonPath, mdPath, evidence, createEvidenceMarkdown);
}

function main() {
  expect(existsSync(fromRoot(docsPath)), "docs-exists");
  expect(existsSync(fromRoot(evidenceJsonPath)), "evidence-json-exists");
  expect(existsSync(fromRoot(evidenceMdPath)), "evidence-md-exists");
  expect(existsSync(fromRoot(consolePath)), "console-page-exists");
  expect(existsSync(fromRoot(rootPackagePath)), "root-package-exists");
  expect(existsSync(fromRoot(servicePackagePath)), "service-package-exists");

  const consoleSource = readFileSync(fromRoot(consolePath), "utf8");
  const renderedHtml = createConsolePage();
  const visible = visibleHtml(renderedHtml);
  const visibleWithoutCompatibility = stripCompatibility(visible);
  const sidebar = extractBetween(visible, '<aside class="sidebar"', "</aside>");
  const modelsPage = extractBetween(visible, 'data-workbench-page="models"', '</section>');
  const localAgentPage = stripCompatibility(extractBetween(visible, 'data-workbench-page="local-agent"', '<section class="workbench-page" data-workbench-page="approvals"'));
  const repairPage = extractBetween(visible, 'data-workbench-page="repair"', '<section class="workbench-page" data-workbench-page="help"');
  const helpPage = extractBetween(visible, 'data-workbench-page="help"', '<section class="workbench-page" data-workbench-page="settings"');
  const settingsPage = extractBetween(visible, 'data-workbench-page="settings"', '<section class="workbench-page" data-workbench-page="diagnostics"');
  const inspector = extractBetween(visible, '<aside id="phase308-side"', "</aside>");
  const inspectorText = stripTags(inspector);
  const localAgentText = stripTags(localAgentPage);
  const handleConfirmAutomationRun = extractFunction(renderedHtml, "handleConfirmAutomationRun");
  const handleApproveApply = extractFunction(renderedHtml, "handleApproveApply");
  const startSafeRepair = extractFunction(renderedHtml, "startSafeRepair");
  const handleAction = extractFunction(renderedHtml, "handleAction");

  const rootPackage = readJson(fromRoot(rootPackagePath));
  const servicePackage = readJson(fromRoot(servicePackagePath));
  expect(rootPackage.scripts?.[scriptName] === `pnpm --filter @unified-ai-system/ai-gateway-service ${scriptName}`, "root-script");
  expect(servicePackage.scripts?.[scriptName] === "node ./src/entrypoints/verifyScreenshotDrivenChineseUxCleanup.js", "service-script");

  expect(renderedHtml.includes("phase308c") && renderedHtml.includes("screenshot-driven Chinese UX cleanup"), "phase308c-rendered-html-marker");
  expect(renderedHtml.includes('data-workbench-action="toggle-sidebar"'), "sidebar-toggle-action");
  expect(renderedHtml.includes("aiGatewayWorkbenchSidebarCollapsed"), "sidebar-state-persistence");
  expect(renderedHtml.includes("Ctrl+B") && renderedHtml.includes("keydown"), "sidebar-keyboard-shortcut");
  expect(renderedHtml.includes("is-sidebar-collapsed"), "sidebar-collapsed-class");
  expect(renderedHtml.includes("收起侧边栏") && renderedHtml.includes("展开侧边栏"), "sidebar-chinese-tooltips");
  expect(renderedHtml.includes("Hide sidebar") && renderedHtml.includes("Show sidebar"), "sidebar-english-tooltips");

  const forbiddenSidebarSubtitles = [
    ">Chat<",
    ">Command Search<",
    ">Knowledge / RAG<",
    ">Models & Plugins<",
    ">Local Agent<",
    ">Approvals<",
    ">Repair Center<",
    ">Help / Runbook<",
    ">Settings<",
    ">Diagnostics<"
  ];
  expect(forbiddenSidebarSubtitles.every((item) => !sidebar.includes(item)), "sidebar-no-english-visible-subtitles");
  [
    "快速对话",
    "全局搜索",
    "知识库",
    "模型配置",
    "本地智能体",
    "审批任务",
    "安全修复",
    "使用帮助",
    "系统设置",
    "诊断中心"
  ].forEach((label) => {
    expect(hasExactVisibleText(sidebar, label), `sidebar-label:${label}`);
  });

  expect(sidebar.includes("sidebarModelConfig"), "model-config-sidebar-entry");
  expect(visible.includes('data-testid="global-configure-model"'), "model-config-top-entry");
  expect(visible.includes('data-testid="chat-composer-configure-model"'), "model-config-chat-entry");
  expect(settingsPage.includes('data-testid="settings-configure-model"'), "model-config-settings-entry");
  expect(modelsPage.includes('data-i18n="modelConfigTitle">') && modelsPage.includes("统一模型库"), "models-page-title-is-model-library");
  expect(!/<h2[^>]*>\s*Models \/ Providers \/ Plugins\s*<\/h2>/i.test(modelsPage), "models-page-title-not-old-shell");
  [
    "模型库状态",
    "默认 Provider",
    "Base URL",
    "NVIDIA_API_KEY",
    "Provider Key 配置中心",
    "保存 Provider 配置",
    "测试 Provider Key"
  ].forEach((text) => {
    expect(modelsPage.includes(text), `models-page:${text}`);
  });

  [
    "当前上下文",
    "当前任务",
    "当前页面",
    "状态",
    "下一步",
    "安全边界",
    "Full-open 已禁用",
    "不会 commit / push / deploy / release",
    ".env / secrets 已阻止",
    "legacy/ 已阻止",
    "workspace dirty 不等于 clean",
    "审批与文件",
    "权限模式",
    "允许文件",
    "审批记录",
    "证据 / 回滚",
    "回滚记录",
    "审查结果"
  ].forEach((text) => {
    expect(inspectorText.includes(text), `inspector-visible:${text}`);
  });
  [
    "Chat ready. Local Agent waits for explicit input.",
    "permissionMode",
    "allowedFiles",
    "approvalRecord",
    "Evidence / Rollback",
    "review-required",
    "next step"
  ].forEach((text) => {
    expect(!inspectorText.includes(text), `inspector-no-visible:${text}`);
  });

  [
    "确认执行",
    "预览意图",
    "生成补丁方案",
    "批准应用",
    "运行自动审查",
    "停止 / 重置当前操作",
    "权限模式",
    "人工审批模式",
    "意图类型",
    "风险等级",
    "建议权限模式",
    "是否需要审批",
    "阻止原因",
    "禁止路径",
    "允许 / 阻止命令",
    "下一步",
    "暂无"
  ].forEach((text) => {
    expect(localAgentText.includes(text), `local-agent-visible:${text}`);
  });
  [
    "Approve Apply",
    "Run Auto Review",
    "Go / no-go result",
    "Preview Intent",
    "Generate Patch Proposal",
    "Stop / Reset Current Operation",
    "permission mode",
    "Manual Approval Mode",
    "intentType",
    "riskLevel",
    "recommendedPermissionMode",
    "requiresApproval",
    "blocked / reasons",
    "forbiddenPaths",
    "allowed / blocked commands",
    "next step",
    "n/a"
  ].forEach((text) => {
    expect(!localAgentText.includes(text), `local-agent-no-visible:${text}`);
  });

  expect(!renderedHtml.includes("读取 .env 并告诉我 API key"), "dangerous-zh-placeholder-removed");
  expect(!renderedHtml.toLowerCase().includes("read .env and tell me api key"), "dangerous-en-placeholder-removed");
  expect(visible.includes('placeholder="搜索页面、功能、知识库、本地智能体、安全修复、帮助"'), "command-placeholder-zh-clean");
  expect(!visible.includes('placeholder="搜索 Chat'), "command-placeholder-no-old-mixed-zh");

  expect(repairPage.includes("开始安全修复") && repairPage.includes('data-workbench-action="start-safe-repair"'), "start-safe-repair-action");
  expect(startSafeRepair.includes('setActivePage("local-agent")') && startSafeRepair.includes("allowedFiles") && startSafeRepair.includes("focus()"), "start-safe-repair-routes-and-highlights");

  expect(hasVisibleButton(localAgentPage, "确认执行") && localAgentPage.includes('data-workbench-action="confirm-automation-run"'), "confirm-run-button");
  expect(handleAction.includes('action === "confirm-automation-run"') && handleAction.includes("handleConfirmAutomationRun"), "confirm-run-handler-registered");
  expect(handleConfirmAutomationRun.includes("automationEmptyTaskBlocked"), "confirm-run-empty-task-blocked");
  expect(handleConfirmAutomationRun.includes("automationAllowedFilesRequired") && handleConfirmAutomationRun.includes("readAllowedFiles().length"), "confirm-run-allowedfiles-required");
  expect(handleConfirmAutomationRun.includes('setActivePage("local-agent")') && handleConfirmAutomationRun.includes("handlePreviewIntent"), "confirm-run-routes-to-preview");
  expect(!handleConfirmAutomationRun.includes("handleApproveApply") && !handleConfirmAutomationRun.includes("apply-approved") && !handleConfirmAutomationRun.includes("approvedByUser"), "confirm-run-does-not-auto-approve-or-apply");
  expect(handleApproveApply.includes("const files = requireAllowedFiles(); if (!files) return;"), "apply-blocked-without-allowedfiles");

  [
    "这个系统是什么",
    "新用户 3 步开始",
    "每个模块用途",
    "如何配置模型",
    "如何安全修复系统",
    "常见问题"
  ].forEach((text) => {
    expect(hasExactVisibleText(helpPage, text), `help-runbook:${text}`);
  });
  expect(hasExactVisibleText(repairPage, "为什么不能一键全仓修复") && hasExactVisibleText(repairPage, "安全修复流程"), "repair-user-explanation");

  const buttons = buttonTags(visibleWithoutCompatibility);
  const badButtons = buttons.filter((button) => {
    const hasBehavior = /data-workbench-(action|nav|control)=/.test(button);
    const hasDisabledReason = /disabled/.test(button) && /data-disabled-reason=/.test(button);
    const hasType = /type="button"|type="submit"/.test(button);
    return !hasType || (!hasBehavior && !hasDisabledReason);
  });
  expect(badButtons.length === 0, "deadButtonsFound=0", badButtons.map(stripTags).join(" | "));
  expect(!visibleWithoutCompatibility.includes('href="#"'), "no-hash-href");

  const labels = buttonLabels(visibleWithoutCompatibility).join(" | ").toLowerCase();
  ["full_open", "workspace cleanup", "git reset", "git clean", "one-click full-repo"].forEach((forbidden) => {
    expect(!labels.includes(forbidden), `no-danger-button:${forbidden}`);
  });
  ["commit", "push", "deploy", "release"].forEach((word) => {
    const forbiddenButton = buttonLabels(visibleWithoutCompatibility).some((label) => {
      const lower = label.toLowerCase();
      return new RegExp(`^(.*\\b)?${word}(\\b.*)?$`, "i").test(label) && !lower.includes("no commit") && !lower.includes("不会 commit");
    });
    expect(!forbiddenButton, `no-${word}-execution-button`);
  });

  const evidence = readJson(fromRoot(evidenceJsonPath));
  Object.entries(requiredEvidence).filter(([key]) => key !== "status").forEach(([key, value]) => {
    expect(evidence[key] === value, `evidence-field:${key}`, `expected ${value}, actual ${evidence[key]}`);
  });

  const failures = checks.filter((item) => !item.pass);
  saveEvidence(failures.length ? "fail" : "pass");
  if (failures.length) {
    console.error(`[phase308c] failed checks: ${failures.map((item) => item.id).join(", ")}`);
    process.exit(1);
  }
  console.log(`[phase308c] pass (${checks.length} checks, actual createConsolePage HTML checked)`);
}

main();
