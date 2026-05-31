import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "Phase320A";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-320a-real-browser-full-module-acceptance.json");
const evidenceMdPath = resolve(evidenceDir, "phase-320a-real-browser-full-module-acceptance.md");
const browserSkillPath = "C:/Users/Administrator/.codex/plugins/cache/openai-bundled/browser-use/0.1.0-alpha1/skills/browser/SKILL.md";
const playwrightSkillPath = "C:/Users/Administrator/.codex/skills/playwright/SKILL.md";
const playwrightWrapperPath = "C:/Users/Administrator/.codex/skills/playwright/scripts/playwright_cli.sh";

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const targetUrl = "http://127.0.0.1:3100/ui?ts=phase320a-real-browser-full-test";
const browserSkillAvailable = existsSync(browserSkillPath);
const playwrightSkillAvailable = existsSync(playwrightSkillPath);
const playwrightWrapperAvailable = existsSync(playwrightWrapperPath);

let liveUiStatus = 0;
let liveUiChecks = {
  containsWorkbench: false,
  containsPmeMovingEarth: false,
  containsChatMain: false,
  containsModuleEntrypoints: false,
};

try {
  const response = await fetch(targetUrl);
  liveUiStatus = response.status;
  const html = await response.text();
  liveUiChecks = {
    containsWorkbench: html.includes("AI Gateway Workbench"),
    containsPmeMovingEarth: html.includes("PME 移动地球"),
    containsChatMain: html.includes('id="chat-shell"') && html.includes('id="chat-form"'),
    containsModuleEntrypoints: [
      'data-workbench-nav="chat"',
      'data-workbench-nav="models"',
      'data-workbench-nav="search"',
      'data-workbench-nav="local-agent"',
      'data-workbench-nav="approvals"',
      'data-workbench-nav="repair"',
      'data-workbench-nav="help"',
      'data-workbench-nav="settings"',
      'data-workbench-nav="diagnostics"',
    ].every((marker) => html.includes(marker)),
  };
} catch {
  liveUiStatus = 0;
}

const browserPluginAvailable = false;
const realBrowserUsed = false;
const browserPluginFailureReason = [
  browserSkillAvailable ? "Browser Use skill file is installed" : "Browser Use skill file is missing",
  "Codex session does not expose the required node_repl js tool for Browser Use iab control",
  playwrightSkillAvailable ? "Playwright skill file is installed" : "Playwright skill file is missing",
  playwrightWrapperAvailable ? "Playwright CLI wrapper is installed" : "Playwright CLI wrapper is missing",
  "Attempted Playwright CLI escalation was rejected by the runtime approval layer",
].join("; ");

expect(browserSkillAvailable || playwrightSkillAvailable, "browser_or_playwright_skill_installed");
expect(liveUiStatus === 200, "live_ui_status_200", `HTTP ${liveUiStatus}`);
expect(liveUiChecks.containsWorkbench, "live_ui_workbench_marker");
expect(liveUiChecks.containsPmeMovingEarth === false, "live_ui_not_pme_moving_earth");
expect(liveUiChecks.containsChatMain, "live_ui_chat_main_present");
expect(liveUiChecks.containsModuleEntrypoints, "live_ui_module_entrypoints_present");
expect(browserPluginAvailable === true, "browser_plugin_available", browserPluginFailureReason);
expect(realBrowserUsed === true, "real_browser_used", "Phase320A must not pass without a real browser session");

const failedChecks = checks.filter((item) => !item.pass);
const evidence = {
  phase: PHASE,
  status: "fail",
  sealed: false,
  blocker: "real_browser_plugin_unavailable",
  generatedAt: new Date().toISOString(),
  targetUrl,
  liveUiStatus,
  liveUiChecks,
  realBrowserUsed,
  browserPluginUsed: false,
  browserPluginName: browserSkillAvailable ? "browser-use iab (unavailable in current tool surface)" : "none",
  browserPluginAvailable,
  browserPluginFailureReason,
  playwrightSkillAvailable,
  playwrightWrapperAvailable,
  testedPages: [],
  testedButtons: [],
  failedButtons: [],
  jsErrorsFound: null,
  consoleErrors: [],
  emptyPagesFound: null,
  chatFlowWorks: false,
  modelConfigWorks: false,
  searchWorks: false,
  knowledgePageWorks: false,
  localAgentApprovalFlowWorks: false,
  approvalQueueWorks: false,
  safeRepairApprovalFlowWorks: false,
  fileContextWorks: false,
  pluginRegistryWorks: false,
  helpWorks: false,
  settingsWorks: false,
  diagnosticsWorks: false,
  evidenceDrawerWorks: false,
  blockedPolicyWorks: false,
  providerCalledForBlockedAction: false,
  localExecutionTriggeredWithoutApproval: false,
  secretExposed: false,
  defaultChatChanged: false,
  paidApiCalled: false,
  workspaceCleanClaimed: false,
  checks,
  failedChecks,
  verificationCommands: [
    "node --check apps/ai-gateway-service/src/entrypoints/smokePhase320ARealBrowserFullModule.js",
    "node --check apps/ai-gateway-service/src/entrypoints/verifyPhase320ARealBrowserFullModule.js",
    "cmd /c pnpm smoke:phase320a-real-browser-full-module",
    "cmd /c pnpm verify:phase320a-real-browser-full-module",
  ],
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderEvidenceMarkdown(evidence), "utf8");

console.log(JSON.stringify({
  status: evidence.status,
  blocker: evidence.blocker,
  realBrowserUsed: evidence.realBrowserUsed,
  browserPluginAvailable: evidence.browserPluginAvailable,
  browserPluginFailureReason: evidence.browserPluginFailureReason,
  liveUiStatus: evidence.liveUiStatus,
  checksFailed: failedChecks.length,
}, null, 2));

process.exitCode = 1;

function renderEvidenceMarkdown(data) {
  return [
    "# Phase320A Real Browser Full Module Acceptance",
    "",
    `- status: ${data.status}`,
    `- sealed: ${data.sealed}`,
    `- blocker: ${data.blocker}`,
    `- realBrowserUsed: ${data.realBrowserUsed}`,
    `- browserPluginUsed: ${data.browserPluginUsed}`,
    `- browserPluginName: ${data.browserPluginName}`,
    `- browserPluginAvailable: ${data.browserPluginAvailable}`,
    `- browserPluginFailureReason: ${data.browserPluginFailureReason}`,
    `- targetUrl: ${data.targetUrl}`,
    `- liveUiStatus: ${data.liveUiStatus}`,
    `- workspaceCleanClaimed: ${data.workspaceCleanClaimed}`,
    "",
    "Phase320A intentionally does not downgrade to DOM-only, HTTP-only, or programmatic click acceptance.",
    "A pass requires an actual Browser Use or Playwright-controlled browser session.",
    "",
  ].join("\n");
}
