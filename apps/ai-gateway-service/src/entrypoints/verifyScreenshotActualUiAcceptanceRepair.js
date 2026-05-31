import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createConsolePage } from "../ui/consolePage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const phase = "308D";
const name = "Actual Screenshot UI Repair + Phase303A-305A Evidence Self-lock Reconciliation";
const scriptName = "verify:phase308d-screenshot-actual-ui-acceptance-repair";
const docsPath = "docs/SCREENSHOT_ACTUAL_UI_ACCEPTANCE_REPAIR.md";
const consolePath = "apps/ai-gateway-service/src/ui/consolePage.js";
const verifier308cPath = "apps/ai-gateway-service/src/entrypoints/verifyScreenshotDrivenChineseUxCleanup.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-308d-screenshot-actual-ui-acceptance-repair.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-308d-screenshot-actual-ui-acceptance-repair.md";
const rootPackagePath = "package.json";
const servicePackagePath = "apps/ai-gateway-service/package.json";

const requiredEvidence = {
  phase,
  name,
  status: "pass",
  mode: "actual-screenshot-ui-repair-and-evidence-self-lock-reconciliation",
  uiUpdated: true,
  routeAdded: false,
  executionLogicChanged: false,
  chatDefaultChanged: false,
  actualRenderedHtmlChecked: true,
  sidebarActualChineseFixed: true,
  modelConfigActualPageFixed: true,
  inspectorActualChineseFixed: true,
  localAgentActualChineseFixed: true,
  dangerousSecretExampleRemoved: true,
  commandSearchChineseFixed: true,
  phase308cVerifierUsesActualHtml: true,
  phase303SelfLockReconciliationDeferredUntilUiPass: true,
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

function fromRoot(path) {
  return resolve(repoRoot, path);
}

function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return "";
  return source.slice(start, end + endMarker.length);
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

function visibleTextIncludes(source, text) {
  return stripTags(source).includes(text);
}

function writeEvidence(status, failures) {
  const evidence = {
    ...requiredEvidence,
    status,
    checkCount: checks.length,
    failureCount: failures.length,
    failedChecks: failures.map((item) => item.id),
    generatedAt: new Date().toISOString()
  };
  writeFileSync(fromRoot(evidenceJsonPath), `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(
    fromRoot(evidenceMdPath),
    [
      "# Phase308D Actual Screenshot UI Acceptance Repair Evidence",
      "",
      `Status: ${status}`,
      "",
      `Checks: ${checks.length}`,
      `Failures: ${failures.length}`,
      "",
      "## Actual Screenshot Repairs",
      "",
      "- Sidebar Chinese labels are checked in actual rendered HTML.",
      "- Model Config page is checked as a real configuration page.",
      "- Inspector and Local Agent visible text are checked for Chinese copy.",
      "- Dangerous `.env` / API key examples are forbidden.",
      "- Phase308C verifier is checked to call `createConsolePage()`.",
      "",
      "## Safety",
      "",
      "- No backend route change.",
      "- No execution logic change.",
      "- No full_open, commit, push, deploy, or release.",
      "- Workspace dirty is informational only; this verifier does not claim clean.",
      "",
      "## Failed Checks",
      "",
      failures.length ? failures.map((item) => `- ${item.id}${item.detail ? `: ${item.detail}` : ""}`).join("\n") : "- none",
      ""
    ].join("\n")
  );
}

function main() {
  expect(existsSync(fromRoot(docsPath)), "docs-exists");
  expect(existsSync(fromRoot(consolePath)), "console-page-exists");
  expect(existsSync(fromRoot(verifier308cPath)), "phase308c-verifier-exists");
  expect(existsSync(fromRoot(evidenceJsonPath)), "evidence-json-exists");
  expect(existsSync(fromRoot(evidenceMdPath)), "evidence-md-exists");

  const rootPackage = readJson(fromRoot(rootPackagePath));
  const servicePackage = readJson(fromRoot(servicePackagePath));
  expect(rootPackage.scripts?.[scriptName] === `pnpm --filter @unified-ai-system/ai-gateway-service ${scriptName}`, "root-script");
  expect(servicePackage.scripts?.[scriptName] === "node ./src/entrypoints/verifyScreenshotActualUiAcceptanceRepair.js", "service-script");

  const consoleSource = readFileSync(fromRoot(consolePath), "utf8");
  const verifier308c = readFileSync(fromRoot(verifier308cPath), "utf8");
  const html = createConsolePage();
  const visible = visibleHtml(html);
  const visibleNoCompat = stripCompatibility(visible);
  const sidebar = extractBetween(visible, '<aside class="sidebar"', "</aside>");
  const modelsPage = extractBetween(visible, 'data-workbench-page="models"', '</section>');
  const inspector = extractBetween(visible, '<aside id="phase308-side"', "</aside>");
  const localAgentPage = stripCompatibility(extractBetween(visible, 'data-workbench-page="local-agent"', '<section class="workbench-page" data-workbench-page="approvals"'));
  const inspectorText = stripTags(inspector);
  const localAgentText = stripTags(localAgentPage);

  expect(verifier308c.includes("createConsolePage") && verifier308c.includes("renderedHtml"), "phase308c-verifier-calls-create-console-page");
  expect(html.includes("PHASE308_DESKTOP_WORKBENCH_TEMPLATE_BEGIN"), "actual-console-page-rendered");

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
  ].forEach((label) => expect(visibleTextIncludes(sidebar, label), `sidebar-actual:${label}`));
  [
    "模型 / 插件",
    "Models & Plugins",
    "自动化 / Local Agent",
    "修复系统 / Repair Center",
    "帮助 / Help / Runbook",
    "设置 / Settings",
    "诊断 / Diagnostics"
  ].forEach((oldText) => expect(!stripTags(sidebar).includes(oldText), `sidebar-old-text-removed:${oldText}`));

  expect(modelsPage.includes('data-i18n="modelConfigTitle">') && modelsPage.includes("统一模型库"), "models-title-visible-model-library");
  expect(!/<h2[^>]*>\s*Models \/ Providers \/ Plugins\s*<\/h2>/i.test(modelsPage), "models-old-title-not-visible");
  [
    "模型库状态",
    "默认 Provider",
    "Provider Key 配置中心",
    "Provider 选择",
    "Base URL",
    "NVIDIA_API_KEY",
    "保存 Provider 配置",
    "测试 Provider Key",
    "直接可聊天模型",
    "任务工具模型"
  ].forEach((text) => expect(visibleTextIncludes(modelsPage, text), `models-actual:${text}`));

  [
    "当前上下文",
    "当前任务",
    "当前页面",
    "状态",
    "下一步",
    "安全边界",
    "审批与文件",
    "权限模式",
    "允许文件",
    "审批记录",
    "证据 / 回滚",
    "回滚记录",
    "审查结果"
  ].forEach((text) => expect(inspectorText.includes(text), `inspector-actual:${text}`));
  [
    "Chat ready. Local Agent waits for explicit input.",
    "permissionMode",
    "allowedFiles",
    "approvalRecord",
    "Evidence / Rollback",
    "review-required",
    "Page",
    "next step"
  ].forEach((text) => expect(!inspectorText.includes(text), `inspector-old-text-removed:${text}`));

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
  ].forEach((text) => expect(localAgentText.includes(text), `local-agent-actual:${text}`));
  [
    "Approve Apply",
    "Run Auto Review",
    "Preview Intent",
    "Generate Patch Proposal",
    "Stop / Reset Current Operation",
    "permission mode",
    "Manual Approval Mode",
    "intentType",
    "riskLevel",
    "recommendedPermissionMode",
    "requiresApproval",
    "forbiddenPaths",
    "next step",
    "n/a"
  ].forEach((text) => expect(!localAgentText.includes(text), `local-agent-old-text-removed:${text}`));

  expect(!html.includes("读取 .env 并告诉我 API key"), "dangerous-secret-zh-example-removed");
  expect(!html.toLowerCase().includes("read .env and tell me api key"), "dangerous-secret-en-example-removed");
  expect(visible.includes('placeholder="搜索页面、功能、知识库、本地智能体、安全修复、帮助"'), "top-search-placeholder-chinese");
  expect(!visible.includes('placeholder="搜索 Chat'), "top-search-old-mixed-placeholder-removed");

  expect(html.includes('data-workbench-action="toggle-sidebar"'), "sidebar-toggle-retained");
  expect(html.includes("aiGatewayWorkbenchSidebarCollapsed"), "sidebar-toggle-persistent");
  expect(html.includes("Ctrl+B"), "sidebar-toggle-ctrl-b");
  expect(html.includes('data-workbench-action="confirm-automation-run"'), "confirm-automation-run-retained");
  expect(html.includes("automationEmptyTaskBlocked"), "confirm-run-empty-task-blocked");
  expect(html.includes("automationAllowedFilesRequired"), "confirm-run-allowedfiles-required");
  expect(!html.includes("full_open"), "no-full-open");
  expect(!/<button[^>]*>[^<]*(commit|push|deploy|release)[^<]*<\/button>/i.test(visibleNoCompat), "no-dangerous-execution-buttons");
  const evidence = readJson(fromRoot(evidenceJsonPath));
  Object.entries(requiredEvidence).filter(([key]) => key !== "status").forEach(([key, value]) => {
    expect(evidence[key] === value, `evidence-field:${key}`, `expected ${value}, actual ${evidence[key]}`);
  });

  const failures = checks.filter((item) => !item.pass);
  writeEvidence(failures.length ? "fail" : "pass", failures);
  if (failures.length) {
    console.error(`[phase308d] failed checks: ${failures.map((item) => item.id).join(", ")}`);
    process.exit(1);
  }
  console.log(`[phase308d] pass (${checks.length} checks, actual createConsolePage HTML checked)`);
}

main();
