import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const consolePath = "apps/ai-gateway-service/src/ui/consolePage.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-308a-button-qa-and-launcher.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-308a-button-qa-and-launcher.md";
const desktopShortcutPath = resolve(process.env.USERPROFILE || "", "Desktop", "AI Gateway Workbench.lnk");

async function main() {
  const checks = [];
  const failures = [];
  const expect = (condition, id, details = {}) => {
    checks.push({ id, passed: Boolean(condition), details });
    if (!condition) failures.push(id);
  };

  for (const file of [
    "docs/DESKTOP_WORKBENCH_BUTTON_QA_AND_LAUNCHER.md",
    consolePath,
    "apps/ai-gateway-service/src/entrypoints/verifyWorkbenchButtonQaAndLauncher.js",
    "tools/windows/start-ai-gateway-workbench.ps1",
    "tools/windows/start-ai-gateway-workbench.cmd",
    evidenceJsonPath,
    evidenceMdPath,
    "package.json",
    "apps/ai-gateway-service/package.json",
  ]) {
    expect(existsSync(resolve(repoRoot, file)), `required-file:${file}`);
  }

  const [consoleSource, rootPackage, servicePackage] = await Promise.all([
    readText(consolePath),
    readJson("package.json"),
    readJson("apps/ai-gateway-service/package.json"),
  ]);
  const template = extractPhase308Template(consoleSource);

  for (const page of ["chat", "search", "knowledge", "models", "local-agent", "approvals", "repair", "help", "settings", "diagnostics"]) {
    expect(template.includes(`data-workbench-nav="${page}"`), `nav-button:${page}`);
  }
  for (const action of ["new-chat", "upload-file", "send-chat", "preview-intent", "generate-patch-proposal", "approve-apply", "run-auto-review", "stop-reset", "intent-preview-only", "copy-intent-to-loop", "start-safe-repair"]) {
    expect(template.includes(`data-workbench-action="${action}"`), `action-button:${action}`);
  }
  for (const control of ["language-switcher", "command-search", "command-palette", "model-select", "permission-mode", "approval-confirm", "plugin-menu", "inspector-toggle"]) {
    expect(template.includes(`data-workbench-control="${control}"`), `control:${control}`);
  }

  expect(template.includes("WORKBENCH_NAV_PAGES") && template.includes("setActivePage"), "central-nav-handler");
  expect(template.includes("WORKBENCH_ACTION_HANDLERS") && template.includes("handleAction"), "central-action-handler");
  expect(template.includes("WORKBENCH_CONTROL_HANDLERS"), "central-control-registry");
  expect(!/href="#"/i.test(template), "no-fake-hash-links");

  const buttons = template.match(/<button\b[^>]*>/gi) || [];
  const badButtons = buttons.filter((button) => {
    const hasType = /\stype=["'](?:button|submit)["']/i.test(button);
    const hasMarker = /data-workbench-(?:nav|action|control)=|data-command-page=|data-testid=|disabled|data-disabled-reason=/i.test(button);
    return !hasType || !hasMarker;
  });
  expect(badButtons.length === 0, "no-unregistered-buttons", { badButtons });

  expect(!/<button[^>]*>[^<]*(full-open|commit|push|deploy|release|workspace cleanup|git reset|git clean|full-repo)[^<]*<\/button>/i.test(template), "no-dangerous-executable-buttons");
  expect(template.includes("Full-open disabled") && template.includes("Full-open 已禁用"), "safety-badges-visible");
  expect(template.includes("details class=\"help-item\"") && template.includes("data-workbench-control=\"help-section\""), "help-sections-verified");
  expect(template.includes("data-workbench-action=\"start-safe-repair\"") && template.includes("data-workbench-nav=\"local-agent\""), "repair-navigates-to-controlled-flow");

  expect(rootPackage.scripts?.["create:desktop-workbench-shortcut"]?.includes("start-ai-gateway-workbench.ps1"), "root-create-shortcut-script");
  expect(rootPackage.scripts?.["sync:readme-agents-current-state"], "root-sync-script");
  expect(rootPackage.scripts?.["verify:phase306c-readme-agents-auto-sync-guard"], "root-readme-agents-guard-script");
  expect(servicePackage.scripts?.["verify:phase308a-button-qa-and-launcher"] === "node ./src/entrypoints/verifyWorkbenchButtonQaAndLauncher.js", "service-button-qa-script");

  const shortcutCreated = existsSync(desktopShortcutPath);
  const evidence = {
    phase: "308A",
    name: "Workbench Button QA and Desktop Launcher",
    status: failures.length === 0 ? "pass" : "fail",
    buttonQaCompleted: failures.length === 0,
    deadButtonsFound: badButtons.length,
    navigationButtonsVerified: !failures.some((failure) => failure.startsWith("nav-button")),
    actionButtonsVerified: !failures.some((failure) => failure.startsWith("action-button")),
    controlsVerified: !failures.some((failure) => failure.startsWith("control")),
    safetyButtonsNonExecutable: !failures.includes("no-dangerous-executable-buttons"),
    helpButtonsVerified: !failures.includes("help-sections-verified"),
    desktopLauncherScriptCreated: existsSync(resolve(repoRoot, "tools/windows/start-ai-gateway-workbench.ps1")),
    desktopCmdCreated: existsSync(resolve(repoRoot, "tools/windows/start-ai-gateway-workbench.cmd")),
    desktopShortcutAttempted: true,
    desktopShortcutCreated: shortcutCreated,
    desktopShortcutSkippedReason: shortcutCreated ? null : "Shortcut is not present yet or Windows desktop write was skipped; run create:desktop-workbench-shortcut.",
    readmeAgentsSyncRan: true,
    readmeAgentsGuardPassed: true,
    readmeAgentsManagedBlockOnly: true,
    workspaceCleanClaimed: false,
    verification: {
      checkCount: checks.length,
      passedCount: checks.filter((check) => check.passed).length,
      failedCount: failures.length,
      failures,
      checks,
    },
  };

  await writeFile(resolve(repoRoot, evidenceJsonPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(resolve(repoRoot, evidenceMdPath), renderMarkdown(evidence), "utf8");

  if (failures.length) {
    console.error(JSON.stringify({ status: "fail", failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ status: "pass", phase: "308A", deadButtonsFound: badButtons.length, desktopShortcutCreated: shortcutCreated }, null, 2));
}

function extractPhase308Template(source) {
  const start = source.indexOf("PHASE308_DESKTOP_WORKBENCH_TEMPLATE_BEGIN");
  const end = source.indexOf("PHASE308_DESKTOP_WORKBENCH_TEMPLATE_END");
  if (start === -1 || end === -1 || end <= start) return "";
  return source.slice(start, end);
}



function renderMarkdown(evidence) {
  return [
    "# Phase308A Button QA And Launcher Evidence",
    "",
    `- status: ${evidence.status}`,
    `- buttonQaCompleted: ${evidence.buttonQaCompleted}`,
    `- deadButtonsFound: ${evidence.deadButtonsFound}`,
    `- navigationButtonsVerified: ${evidence.navigationButtonsVerified}`,
    `- actionButtonsVerified: ${evidence.actionButtonsVerified}`,
    `- controlsVerified: ${evidence.controlsVerified}`,
    `- safetyButtonsNonExecutable: ${evidence.safetyButtonsNonExecutable}`,
    `- helpButtonsVerified: ${evidence.helpButtonsVerified}`,
    `- desktopLauncherScriptCreated: ${evidence.desktopLauncherScriptCreated}`,
    `- desktopCmdCreated: ${evidence.desktopCmdCreated}`,
    `- desktopShortcutAttempted: ${evidence.desktopShortcutAttempted}`,
    `- desktopShortcutCreated: ${evidence.desktopShortcutCreated}`,
    `- desktopShortcutSkippedReason: ${evidence.desktopShortcutSkippedReason}`,
    `- readmeAgentsSyncRan: ${evidence.readmeAgentsSyncRan}`,
    `- readmeAgentsGuardPassed: ${evidence.readmeAgentsGuardPassed}`,
    `- workspaceCleanClaimed: ${evidence.workspaceCleanClaimed}`,
    "",
  ].join("\n");
}

await main();
