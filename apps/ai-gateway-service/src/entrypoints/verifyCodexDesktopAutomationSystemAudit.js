import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const rootScripts = [
  "codex:desktop:status",
  "codex:desktop:send",
  "codex:desktop:ingest",
  "codex:desktop:review",
  "codex:desktop:loop",
  "codex:desktop:test:internal",
  "codex:desktop:audit",
  "verify:codex-desktop-automation-system-audit",
];

const serviceScripts = [
  "codex:desktop:status",
  "codex:desktop:send",
  "codex:desktop:ingest",
  "codex:desktop:review",
  "codex:desktop:loop",
  "codex:desktop:test:internal",
  "codex:desktop:audit",
  "verify:codex-desktop-automation-system-audit",
];

const uiMarkers = [
  "自动闭环状态面板",
  "Auto Loop Status Panel",
  "受控 Codex 桌面自动化",
  "Controlled Codex Desktop Automation",
  "outbox",
  "inbox",
  "review",
  "feedback",
  "go/no-go",
  "recommendedNextAction",
  "executionEnabled=false",
  "codexExecInvoked=false",
  "codexCliInvoked=false",
  "no workflow runner",
  "no worktree creation",
  "no auto commit/push",
  "approval-preview is not execution permission",
];

async function main() {
  const rootPackage = await readJson("package.json");
  const servicePackage = await readJson("apps/ai-gateway-service/package.json");
  const auditDoc = await readText("docs/CODEX_DESKTOP_AUTOMATION_SYSTEM_AUDIT.md");
  const automationDoc = await readText("docs/CODEX_DESKTOP_AUTOMATION_LOOP.md");
  const audit = await readJson(".codex-handoff/runs/desktop-automation-system-audit.json");
  const internalSummary = await readJson(".codex-handoff/internal-runs/internal-run-summary.json");
  const round1 = await readJson(".codex-handoff/internal-runs/round-1/run-summary.json");
  const round2 = await readJson(".codex-handoff/internal-runs/round-2/run-summary.json");
  const round3 = await readJson(".codex-handoff/internal-runs/round-3/run-summary.json");
  const consolePage = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

  const checks = {
    auditDocExists: await exists("docs/CODEX_DESKTOP_AUTOMATION_SYSTEM_AUDIT.md"),
    auditMarkdownExists: await exists(".codex-handoff/runs/desktop-automation-system-audit.md"),
    auditJsonExists: await exists(".codex-handoff/runs/desktop-automation-system-audit.json"),
    auditStatusPassed: audit.status === "passed",
    noUnresolvedIssues: Array.isArray(audit.unresolvedIssues) && audit.unresolvedIssues.length === 0,
    internalRunsAllExpectationsMet: audit.internalRuns?.allExpectationsMet === true && internalSummary.allExpectationsMet === true,
    round1Expected: ["go", "accepted-preview"].includes(round1.goNoGo) && ["go", "accepted-preview"].includes(audit.internalRuns?.round1),
    round2Expected: ["review-required", "human-review-required"].includes(round2.goNoGo)
      && ["review-required", "human-review-required"].includes(audit.internalRuns?.round2),
    round3Expected: round3.goNoGo === "no-go" && audit.internalRuns?.round3 === "no-go",
    round1NoBoundaryOrVerificationGap: round1.boundaryViolationCount === 0 && round1.verificationGapCount === 0,
    round2HasVerificationOrEvidenceGap: (round2.verificationGapCount || 0) > 0 || (round2.evidenceGapCount || 0) > 0,
    round3HasBoundaryViolation: (round3.boundaryViolationCount || 0) > 0,
    safetyCodexCliInvokedFalse: audit.safety?.codexCliInvoked === false,
    safetyCodexExecInvokedFalse: audit.safety?.codexExecInvoked === false,
    safetyWorkflowRunnerEnabledFalse: audit.safety?.workflowRunnerEnabled === false,
    safetyWorktreeCreatedFalse: audit.safety?.worktreeCreated === false,
    safetyAutoCommitFalse: audit.safety?.autoCommit === false,
    safetyAutoPushFalse: audit.safety?.autoPush === false,
    safetyRealSendExecutedFalse: audit.safety?.realSendExecuted === false,
    uiMarkersFound: uiMarkers.every((marker) => consolePage.includes(marker)),
    auditUiMarkersFound: audit.uiCheck?.autoLoopPanelFound === true
      && audit.uiCheck?.desktopAutomationPanelFound === true
      && audit.uiCheck?.safetyMarkersFound === true,
    packageScriptsExist: rootScripts.every((script) => Object.hasOwn(rootPackage.scripts || {}, script)),
    serviceScriptsExist: serviceScripts.every((script) => Object.hasOwn(servicePackage.scripts || {}, script)),
    docsHaveAuditScope: [
      "审查范围",
      "实际检查的命令",
      "实际检查的文件",
      "发现的问题",
      "实际修复的问题",
      "三轮内部测试结果",
      "UI 检查结果",
      "安全边界检查结果",
      "当前是否可以进入人工授权真实发送",
      "当前仍不能做什么",
      "最终结论",
    ].every((marker) => auditDoc.includes(marker)),
    docsDoNotClaimMockAsRealExecution: !hasForbiddenDocumentationClaim(`${auditDoc}\n${automationDoc}`),
    docsDoNotClaimDesktopSendExecutionCompleted: !hasDesktopSendExecutionCompletedClaim(`${auditDoc}\n${automationDoc}`),
  };

  const passed = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({
    status: passed ? "passed" : "failed",
    checks,
    auditPath: ".codex-handoff/runs/desktop-automation-system-audit.json",
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    realSendExecuted: false,
  }, null, 2));

  if (!passed) process.exitCode = 1;
}

function hasForbiddenDocumentationClaim(text) {
  return /mock (?:test|result).*is real Codex execution/i.test(text)
    || /internal (?:test|run).*is real Codex execution/i.test(text)
    || /本地 mock 测试是真实 Codex 执行/i.test(text)
    || /内部运行测试是真实 Codex 执行/i.test(text);
}

function hasDesktopSendExecutionCompletedClaim(text) {
  return /desktop send (?:is|means|completed) execution completed/i.test(text)
    || /desktop send grants auto commit\/push/i.test(text)
    || /桌面发送等于执行完成/.test(text)
    || /发送任务等于执行成功/.test(text);
}

async function exists(relativePath) {
  try {
    const info = await stat(resolve(repoRoot, relativePath));
    return info.isFile();
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
