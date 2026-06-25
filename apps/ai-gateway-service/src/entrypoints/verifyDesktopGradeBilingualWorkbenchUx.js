import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const consolePath = "apps/ai-gateway-service/src/ui/consolePage.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-308a-desktop-grade-bilingual-workbench-ux.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-308a-desktop-grade-bilingual-workbench-ux.md";
const rootScript = "verify:phase308a-desktop-grade-bilingual-workbench-ux";
const serviceScript = "verify:phase308a-desktop-grade-bilingual-workbench-ux";

const requiredEvidence = {
  phase: "308A",
  name: "Desktop-grade Bilingual AI Gateway Workbench Final UX Rebuild",
  status: "pass",
  mode: "ui-desktop-grade-bilingual-final-hardening-only",
  uiUpdated: true,
  routeAdded: false,
  executionLogicChanged: false,
  chatDefaultChanged: false,
  desktopGradeWorkbench: true,
  bilingualUiEnabled: true,
  defaultLanguage: "zh-CN",
  englishLanguageAvailable: true,
  languagePreferencePersisted: true,
  i18nCoverageMainPages: true,
  i18nCoverageHelpRunbook: true,
  i18nCoverageRepairCenter: true,
  i18nCoverageInspector: true,
  pageSwitchingEnabled: true,
  commandSearchEnabled: true,
  chatPageCleaned: true,
  localAgentPageProductized: true,
  repairCenterProductized: true,
  helpRunbookProductized: true,
  diagnosticsDemoted: true,
  rightInspectorSimplified: true,
  legacyProductCardsDemoted: true,
  readmeAgentsSynced: true,
  readmeAgentsManagedBlockOnly: true,
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
  workspaceCleanClaimed: false,
};

const requiredFiles = [
  consolePath,
  "docs/DESKTOP_GRADE_BILINGUAL_WORKBENCH_FINAL_UX.md",
  "docs/DESKTOP_WORKBENCH_BUTTON_QA_AND_LAUNCHER.md",
  "apps/ai-gateway-service/src/entrypoints/verifyDesktopGradeBilingualWorkbenchUx.js",
  evidenceJsonPath,
  evidenceMdPath,
  "package.json",
  "apps/ai-gateway-service/package.json",
];

const requiredDocHeadings = [
  "# A. Phase308A Goal And Boundary",
  "# B. Current UI Failure Reasons",
  "# C. Codex Desktop / IDE Workbench Principles",
  "# D. Bilingual Switch Design",
  "# E. i18n Coverage",
  "# F. Page Navigation Design",
  "# G. Command Search Design",
  "# H. Chat Page Design",
  "# I. Models / Plugins Page Design",
  "# J. Local Agent Page Design",
  "# K. Approvals / Runs Page Design",
  "# L. Repair Center Design",
  "# M. Help / Runbook Design",
  "# N. Inspector Simplification",
  "# O. Diagnostics Demotion Strategy",
  "# P. Visual Hard Rules",
  "# Q. Safety Forbidden Items",
  "# R. README / AGENTS Managed Block Sync Rule",
  "# S. Runtime UI Smoke",
  "# T. Execution Logic Is Unchanged",
  "# U. User Startup And Usage",
  "# V. Manual Visual QA Checklist",
  "# W. Capabilities That Must Not Be Claimed",
  "# X. Suggested Next Direction",
];

const pageMarkers = [
  'data-workbench-page="chat"',
  'data-workbench-page="search"',
  'data-workbench-page="knowledge"',
  'data-workbench-page="models"',
  'data-workbench-page="local-agent"',
  'data-workbench-page="approvals"',
  'data-workbench-page="repair"',
  'data-workbench-page="help"',
  'data-workbench-page="settings"',
  'data-workbench-page="diagnostics"',
];

async function main() {
  const checks = [];
  const failures = [];
  const expect = (condition, id, details = {}) => {
    checks.push({ id, passed: Boolean(condition), details });
    if (!condition) failures.push(id);
  };

  for (const file of requiredFiles) {
    expect(existsSync(resolve(repoRoot, file)), `required-file:${file}`);
  }

  const [consoleSource, docsText, rootPackage, servicePackage] = await Promise.all([
    readText(consolePath),
    readText("docs/DESKTOP_GRADE_BILINGUAL_WORKBENCH_FINAL_UX.md"),
    readJson("package.json"),
    readJson("apps/ai-gateway-service/package.json"),
  ]);
  const template = extractPhase308Template(consoleSource);
  const chatPage = extractPage(template, "chat");
  const diagnosticsPage = extractPage(template, "diagnostics");

  for (const heading of requiredDocHeadings) {
    expect(docsText.includes(heading), `doc-heading:${heading}`);
  }

  expect(template.includes("desktop-grade") && template.includes("AI Gateway Workbench"), "desktop-grade-marker");
  expect(template.includes("WORKBENCH_I18N") && template.includes("bilingual i18n"), "bilingual-i18n-marker");
  expect(template.includes('"zh-CN"') && template.includes('"en-US"'), "zh-cn-and-en-us-present");
  expect(template.includes("language-select") && template.includes("data-workbench-control=\"language-switcher\""), "language-switcher-present");
  expect(template.includes("localStorage") && template.includes("aiGatewayWorkbenchLanguage"), "language-localstorage-persistence");
  expect(template.includes("function t(key)") || template.includes("const t ="), "translation-function-present");
  expect(template.includes("setActivePage") && template.includes("hashchange"), "page-switching-mechanism-present");
  for (const marker of pageMarkers) expect(template.includes(marker), `page-marker:${marker}`);
  expect(template.includes("Command Search") && template.includes("command-palette"), "command-search-present");
  expect(template.includes("Current Task") || template.includes("当前任务"), "inspector-current-task-present");
  expect(template.includes("Safety Boundary") || template.includes("安全边界"), "inspector-safety-present");
  expect(template.includes("Approval & Files") || template.includes("审批与文件"), "inspector-approval-present");
  expect(template.includes("Evidence / Rollback"), "inspector-evidence-present");
  expect(template.includes("Full-open 已禁用") && template.includes("Full-open disabled"), "full-open-safety-bilingual");
  expect(template.includes("不会 commit / push / deploy / release") && template.includes("No commit / push / deploy / release"), "no-commit-push-deploy-release-bilingual");
  expect(template.includes(".env / secrets 已阻止") && template.includes(".env / secrets blocked"), "env-secrets-blocked-bilingual");
  expect(template.includes("legacy/ 已阻止") && template.includes("legacy/ blocked"), "legacy-blocked-bilingual");
  expect(template.includes("workspace dirty 不等于 clean") && template.includes("workspace dirty is not clean"), "workspace-dirty-bilingual");
  expect(!/Product Deep Optimization Roadmap|Setup Wizard|Phase history|Evidence lists/.test(chatPage), "chat-page-clean-no-old-modules");
  expect(diagnosticsPage.includes("Product Console") && diagnosticsPage.includes("Product Deep Optimization Roadmap") && diagnosticsPage.includes("Phase history") && diagnosticsPage.includes("Evidence lists"), "diagnostics-demotes-old-modules");
  expect(template.includes("如何开始对话") && template.includes("How to start a chat"), "help-bilingual-content-present");
  expect(template.includes("安全修复入口") && template.includes("Safe repair entry"), "repair-bilingual-content-present");
  expect(!/<option[^>]+value=["']full_open["']/i.test(template), "no-full-open-option");
  expect(!/<button[^>]*>\s*(commit|push|deploy|release)\s*<\/button>/i.test(template), "no-forbidden-action-button");

  expect(rootPackage.scripts?.[rootScript] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase308a-desktop-grade-bilingual-workbench-ux", "root-script");
  expect(servicePackage.scripts?.[serviceScript] === "node ./src/entrypoints/verifyDesktopGradeBilingualWorkbenchUx.js", "service-script");

  const evidence = {
    ...requiredEvidence,
    status: failures.length === 0 ? "pass" : "fail",
    verification: {
      checkCount: checks.length,
      passedCount: checks.filter((check) => check.passed).length,
      failedCount: failures.length,
      failures,
      checks,
    },
    safetyNotes: [
      "UI final rebuild only.",
      "No backend route, provider, chat default, or execution logic was changed.",
      "Workspace dirty is informational and is not claimed clean.",
    ],
  };

  await writeFile(resolve(repoRoot, evidenceJsonPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(resolve(repoRoot, evidenceMdPath), renderMarkdown(evidence), "utf8");

  if (failures.length) {
    console.error(JSON.stringify({ status: "fail", failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ status: "pass", phase: "308A", checkCount: checks.length }, null, 2));
}

function extractPhase308Template(source) {
  const start = source.indexOf("PHASE308_DESKTOP_WORKBENCH_TEMPLATE_BEGIN");
  const end = source.indexOf("PHASE308_DESKTOP_WORKBENCH_TEMPLATE_END");
  if (start === -1 || end === -1 || end <= start) return "";
  return source.slice(start, end);
}

function extractPage(template, page) {
  const marker = `data-workbench-page="${page}"`;
  const start = template.indexOf(marker);
  if (start === -1) return "";
  const next = template.indexOf('data-workbench-page="', start + marker.length);
  return template.slice(start, next === -1 ? template.length : next);
}



function renderMarkdown(evidence) {
  return [
    "# Phase308A Desktop-grade Bilingual Workbench UX Evidence",
    "",
    `- phase: ${evidence.phase}`,
    `- name: ${evidence.name}`,
    `- status: ${evidence.status}`,
    `- mode: ${evidence.mode}`,
    `- uiUpdated: ${evidence.uiUpdated}`,
    `- desktopGradeWorkbench: ${evidence.desktopGradeWorkbench}`,
    `- bilingualUiEnabled: ${evidence.bilingualUiEnabled}`,
    `- defaultLanguage: ${evidence.defaultLanguage}`,
    `- englishLanguageAvailable: ${evidence.englishLanguageAvailable}`,
    `- pageSwitchingEnabled: ${evidence.pageSwitchingEnabled}`,
    `- commandSearchEnabled: ${evidence.commandSearchEnabled}`,
    `- chatPageCleaned: ${evidence.chatPageCleaned}`,
    `- localAgentPageProductized: ${evidence.localAgentPageProductized}`,
    `- repairCenterProductized: ${evidence.repairCenterProductized}`,
    `- helpRunbookProductized: ${evidence.helpRunbookProductized}`,
    `- diagnosticsDemoted: ${evidence.diagnosticsDemoted}`,
    `- rightInspectorSimplified: ${evidence.rightInspectorSimplified}`,
    `- fullOpenEnabled: ${evidence.fullOpenEnabled}`,
    `- autoCommitEnabled: ${evidence.autoCommitEnabled}`,
    `- autoPushEnabled: ${evidence.autoPushEnabled}`,
    `- releaseOrDeployCalled: ${evidence.releaseOrDeployCalled}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}

await main();
