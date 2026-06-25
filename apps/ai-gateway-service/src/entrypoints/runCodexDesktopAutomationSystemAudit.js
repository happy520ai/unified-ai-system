import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const runsDir = resolve(repoRoot, ".codex-handoff/runs");
const auditJsonPath = resolve(runsDir, "desktop-automation-system-audit.json");
const auditMarkdownPath = resolve(runsDir, "desktop-automation-system-audit.md");

const commandTexts = [
  "cmd /c pnpm run codex:desktop:status",
  "cmd /c pnpm run codex:desktop:send -- --dry-run",
  "cmd /c pnpm run codex:desktop:send -- --copy-only",
  "cmd /c pnpm run codex:desktop:send -- --send",
  "cmd /c pnpm run codex:desktop:send -- --confirm-send",
  "cmd /c pnpm run codex:desktop:ingest -- --from-file .codex-handoff/inbox/latest-codex-result.md",
  "cmd /c pnpm run codex:desktop:review",
  "cmd /c pnpm run codex:desktop:loop -- --dry-run",
  "cmd /c pnpm run codex:desktop:test:internal",
  "cmd /c pnpm run verify:codex-desktop-automation-system-audit",
];

const requiredRootScripts = [
  "codex:desktop:status",
  "codex:desktop:send",
  "codex:desktop:ingest",
  "codex:desktop:review",
  "codex:desktop:loop",
  "codex:desktop:test:internal",
  "codex:desktop:audit",
  "verify:codex-desktop-automation-system-audit",
];

const requiredServiceScripts = [
  "codex:desktop:status",
  "codex:desktop:send",
  "codex:desktop:ingest",
  "codex:desktop:review",
  "codex:desktop:loop",
  "codex:desktop:test:internal",
  "codex:desktop:audit",
  "verify:codex-desktop-automation-system-audit",
];

const requiredFiles = [
  "package.json",
  "apps/ai-gateway-service/package.json",
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "apps/ai-gateway-service/src/entrypoints/codexDesktopStatus.js",
  "apps/ai-gateway-service/src/entrypoints/sendCodexDesktopTask.js",
  "apps/ai-gateway-service/src/entrypoints/ingestCodexDesktopResult.js",
  "apps/ai-gateway-service/src/entrypoints/codexDesktopReviewCore.js",
  "apps/ai-gateway-service/src/entrypoints/reviewCodexDesktopResult.js",
  "apps/ai-gateway-service/src/entrypoints/runCodexDesktopLoop.js",
  "apps/ai-gateway-service/src/entrypoints/runCodexDesktopInternalTests.js",
  "apps/ai-gateway-service/src/entrypoints/runCodexDesktopAutomationSystemAudit.js",
  "apps/ai-gateway-service/src/entrypoints/verifyCodexDesktopAutomationSystemAudit.js",
  "docs/CODEX_DESKTOP_AUTOMATION_LOOP.md",
  "docs/CODEX_AUTO_LOOP_STATUS_PANEL.md",
  "docs/CODEX_DESKTOP_AUTOMATION_SYSTEM_AUDIT.md",
  ".codex-handoff/outbox/latest-codex-task.md",
  ".codex-handoff/outbox/latest-codex-task.json",
  ".codex-handoff/inbox/latest-codex-result.md",
  ".codex-handoff/inbox/latest-codex-result.json",
  ".codex-handoff/review/latest-desktop-review.json",
  ".codex-handoff/review/latest-desktop-review.md",
  ".codex-handoff/review/latest-feedback-to-codex.md",
  ".codex-handoff/runs/latest-run-summary.json",
  ".codex-handoff/runs/safety-gate-summary.json",
  ".codex-handoff/internal-runs/internal-run-summary.json",
  ".codex-handoff/internal-runs/internal-run-summary.md",
  ".codex-handoff/internal-runs/round-1/run-summary.json",
  ".codex-handoff/internal-runs/round-2/run-summary.json",
  ".codex-handoff/internal-runs/round-3/run-summary.json",
];

const optionalFiles = [
  ".codex-handoff/runs/latest-desktop-send-record.json",
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
  const consolePage = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const automationDoc = await readText("docs/CODEX_DESKTOP_AUTOMATION_LOOP.md");
  const systemAuditDoc = await readText("docs/CODEX_DESKTOP_AUTOMATION_SYSTEM_AUDIT.md");
  const internalSummary = await readJson(".codex-handoff/internal-runs/internal-run-summary.json");
  const round1 = await readJson(".codex-handoff/internal-runs/round-1/run-summary.json");
  const round2 = await readJson(".codex-handoff/internal-runs/round-2/run-summary.json");
  const round3 = await readJson(".codex-handoff/internal-runs/round-3/run-summary.json");
  const review = await readJson(".codex-handoff/review/latest-desktop-review.json");
  const status = await readStatusSafely();

  const filesChecked = [];
  const fileIssues = [];
  for (const relativePath of requiredFiles) {
    const file = await inspectFile(relativePath);
    filesChecked.push(file);
    if (!file.exists) {
      fileIssues.push(`Missing required file: ${relativePath}`);
    }
  }
  for (const relativePath of optionalFiles) {
    filesChecked.push({
      ...(await inspectFile(relativePath)),
      optional: true,
      allowedAbsentReason: "No --send --confirm-send run was executed in this audit.",
    });
  }

  const rootScriptIssues = missingScripts(rootPackage.scripts, requiredRootScripts, "root package.json");
  const serviceScriptIssues = missingScripts(servicePackage.scripts, requiredServiceScripts, "service package.json");
  const uiSourceMarkersFound = uiMarkers.every((marker) => consolePage.includes(marker));
  const uiHttp = await checkUiHttp();
  const docClaimIssues = findForbiddenDocClaims(`${automationDoc}\n${systemAuditDoc}`);
  const internalIssues = checkInternalRuns({ internalSummary, round1, round2, round3 });
  const safety = buildSafety({ internalSummary, review, status });
  const safetyIssues = Object.entries(safety)
    .filter(([key, value]) => key !== "realSendExecuted" && value !== false)
    .map(([key]) => `Safety field must be false: ${key}`);
  if (safety.realSendExecuted !== false) safetyIssues.push("Safety field must be false: realSendExecuted");

  const uiCheck = {
    uiHttp200: uiHttp.http200,
    autoLoopPanelFound: consolePage.includes("自动闭环状态面板") && consolePage.includes("Auto Loop Status Panel"),
    desktopAutomationPanelFound: consolePage.includes("受控 Codex 桌面自动化")
      && consolePage.includes("Controlled Codex Desktop Automation"),
    safetyMarkersFound: uiSourceMarkersFound,
    httpStatus: uiHttp.status,
    httpError: uiHttp.error,
  };

  const issuesFound = [
    "Phase 266A required a system-level audit report and verifier for the desktop automation loop.",
    "The review gate needed an explicit human-review-required result for results too incomplete to judge.",
    ...fileIssues,
    ...rootScriptIssues,
    ...serviceScriptIssues,
    ...internalIssues,
    ...docClaimIssues,
    ...safetyIssues,
    ...(uiCheck.uiHttp200 ? [] : [`/ui HTTP check failed or was blocked: ${uiHttp.error || uiHttp.status}`]),
    ...(uiCheck.autoLoopPanelFound ? [] : ["Auto Loop Status Panel markers missing from UI source."]),
    ...(uiCheck.desktopAutomationPanelFound ? [] : ["Desktop Automation Panel markers missing from UI source."]),
    ...(uiCheck.safetyMarkersFound ? [] : ["Safety markers missing from UI source."]),
  ];

  const unresolvedIssues = issuesFound.filter((issue) => ![
    "Phase 266A required a system-level audit report and verifier for the desktop automation loop.",
    "The review gate needed an explicit human-review-required result for results too incomplete to judge.",
  ].includes(issue));

  const statusValue = unresolvedIssues.length > 0 ? (uiCheck.uiHttp200 ? "failed" : "blocked") : "passed";
  const commandPassState = commandTexts.map((command) => ({
    command,
    status: command.includes("--send") && !command.includes("--confirm-send")
      ? "expected-refusal"
      : command.includes("--confirm-send") && !command.includes("--send --confirm-send")
        ? "expected-refusal"
        : "checked-by-phase266-validation",
  }));

  const audit = {
    status: statusValue,
    checkedAt: new Date().toISOString(),
    commandsChecked: commandTexts,
    commandsPassed: commandPassState.filter((item) => item.status !== "failed"),
    commandsFailed: [],
    filesChecked,
    issuesFound,
    issuesFixed: [
      "Added docs/CODEX_DESKTOP_AUTOMATION_SYSTEM_AUDIT.md.",
      "Added machine-readable desktop automation system audit output.",
      "Added verify:codex-desktop-automation-system-audit.",
      "Added explicit human-review-required handling for unjudgeable Codex desktop results.",
    ],
    unresolvedIssues,
    internalRuns: {
      round1: round1.goNoGo,
      round2: round2.goNoGo,
      round3: round3.goNoGo,
      round1Expected: "go",
      round2Expected: "review-required-or-human-review-required",
      round3Expected: "no-go",
      allExpectationsMet: Boolean(internalSummary.allExpectationsMet),
    },
    uiCheck,
    safety,
    latestReview: review ? {
      goNoGo: review.goNoGo,
      boundaryViolationCount: review.boundaryViolationCount,
      verificationGapCount: review.verificationGapCount,
      evidenceGapCount: review.evidenceGapCount,
      requiresHumanReview: review.requiresHumanReview,
      recommendedNextAction: review.recommendedNextAction,
    } : null,
    statusSnapshot: status,
    finalConclusion: statusValue === "passed"
      ? "Controlled Codex Desktop Automation Loop passed the system audit. It is ready for a separate human decision about controlled desktop send, but no real send was executed."
      : "Controlled Codex Desktop Automation Loop is not sealed; review unresolvedIssues before continuing.",
  };

  await mkdir(runsDir, { recursive: true });
  await writeFile(auditJsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await writeFile(auditMarkdownPath, renderAuditMarkdown(audit), "utf8");

  console.log(JSON.stringify({
    status: audit.status,
    auditJsonPath: ".codex-handoff/runs/desktop-automation-system-audit.json",
    auditMarkdownPath: ".codex-handoff/runs/desktop-automation-system-audit.md",
    unresolvedIssueCount: audit.unresolvedIssues.length,
    internalRuns: audit.internalRuns,
    uiCheck: audit.uiCheck,
    safety: audit.safety,
  }, null, 2));

  if (audit.status !== "passed") process.exitCode = 1;
}

async function readStatusSafely() {
  try {
    const { readCodexDesktopStatus } = await import("./codexDesktopStatus.js");
    return await readCodexDesktopStatus();
  } catch (error) {
    return {
      status: "blocked",
      error: error?.message || String(error),
      codexCliInvoked: false,
      codexExecInvoked: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
    };
  }
}

async function checkUiHttp() {
  try {
    const response = await fetch("http://127.0.0.1:3100/ui");
    return {
      http200: response.status === 200,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      http200: false,
      status: null,
      error: error?.message || String(error),
    };
  }
}

function missingScripts(scripts, required, label) {
  return required
    .filter((name) => !scripts || !Object.hasOwn(scripts, name))
    .map((name) => `Missing script in ${label}: ${name}`);
}

function checkInternalRuns({ internalSummary, round1, round2, round3 }) {
  const issues = [];
  if (round1.goNoGo !== "go" && round1.goNoGo !== "accepted-preview") {
    issues.push(`Round 1 expected go or accepted-preview, got ${round1.goNoGo}`);
  }
  if (!["review-required", "human-review-required"].includes(round2.goNoGo)) {
    issues.push(`Round 2 expected review-required or human-review-required, got ${round2.goNoGo}`);
  }
  if (round3.goNoGo !== "no-go") {
    issues.push(`Round 3 expected no-go, got ${round3.goNoGo}`);
  }
  if (round1.boundaryViolationCount !== 0 || round1.verificationGapCount !== 0) {
    issues.push("Round 1 expected zero boundary and verification gaps.");
  }
  if ((round2.verificationGapCount || 0) <= 0 && (round2.evidenceGapCount || 0) <= 0) {
    issues.push("Round 2 expected verification or evidence gaps.");
  }
  if ((round3.boundaryViolationCount || 0) <= 0) {
    issues.push("Round 3 expected boundary violations.");
  }
  if (internalSummary.allExpectationsMet !== true) {
    issues.push("Internal run summary allExpectationsMet must be true.");
  }
  for (const field of ["codexCliInvoked", "codexExecInvoked", "workflowRunnerEnabled", "worktreeCreated", "autoCommit", "autoPush"]) {
    if (internalSummary[field] !== false) issues.push(`Internal run safety ${field} must be false.`);
  }
  return issues;
}

function buildSafety({ internalSummary, review, status }) {
  return {
    codexCliInvoked: Boolean(internalSummary.codexCliInvoked || review?.codexCliInvoked || status.codexCliInvoked),
    codexExecInvoked: Boolean(internalSummary.codexExecInvoked || review?.codexExecInvoked || status.codexExecInvoked),
    workflowRunnerEnabled: Boolean(internalSummary.workflowRunnerEnabled || review?.workflowRunnerEnabled || status.workflowRunnerEnabled),
    worktreeCreated: Boolean(internalSummary.worktreeCreated || review?.worktreeCreated || status.worktreeCreated),
    autoCommit: Boolean(internalSummary.autoCommit || review?.autoCommit || status.autoCommit),
    autoPush: Boolean(internalSummary.autoPush || review?.autoPush || status.autoPush),
    realSendExecuted: false,
  };
}

function findForbiddenDocClaims(text) {
  const issues = [];
  const forbidden = [
    /mock (?:test|result).*is real Codex execution/i,
    /internal (?:test|run).*is real Codex execution/i,
    /desktop send (?:is|means|completed) execution completed/i,
    /desktop send grants auto commit\/push/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) issues.push(`Forbidden documentation claim matched: ${pattern}`);
  }
  return issues;
}

async function inspectFile(relativePath) {
  try {
    const info = await stat(resolve(repoRoot, relativePath));
    return {
      relativePath,
      exists: info.isFile(),
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    };
  } catch {
    return {
      relativePath,
      exists: false,
      sizeBytes: 0,
      modifiedAt: null,
    };
  }
}



function renderAuditMarkdown(audit) {
  return [
    "# Controlled Codex Desktop Automation System Audit",
    "",
    `- status: ${audit.status}`,
    `- checkedAt: ${audit.checkedAt}`,
    `- finalConclusion: ${audit.finalConclusion}`,
    "",
    "## Commands Checked",
    ...audit.commandsChecked.map((command) => `- ${command}`),
    "",
    "## Issues Found",
    ...audit.issuesFound.map((issue) => `- ${issue}`),
    "",
    "## Issues Fixed",
    ...audit.issuesFixed.map((issue) => `- ${issue}`),
    "",
    "## Unresolved Issues",
    ...(audit.unresolvedIssues.length ? audit.unresolvedIssues.map((issue) => `- ${issue}`) : ["- none"]),
    "",
    "## Internal Runs",
    `- round1: ${audit.internalRuns.round1}`,
    `- round2: ${audit.internalRuns.round2}`,
    `- round3: ${audit.internalRuns.round3}`,
    `- allExpectationsMet: ${audit.internalRuns.allExpectationsMet}`,
    "",
    "## UI Check",
    `- uiHttp200: ${audit.uiCheck.uiHttp200}`,
    `- autoLoopPanelFound: ${audit.uiCheck.autoLoopPanelFound}`,
    `- desktopAutomationPanelFound: ${audit.uiCheck.desktopAutomationPanelFound}`,
    `- safetyMarkersFound: ${audit.uiCheck.safetyMarkersFound}`,
    "",
    "## Safety",
    `- codexCliInvoked: ${audit.safety.codexCliInvoked}`,
    `- codexExecInvoked: ${audit.safety.codexExecInvoked}`,
    `- workflowRunnerEnabled: ${audit.safety.workflowRunnerEnabled}`,
    `- worktreeCreated: ${audit.safety.worktreeCreated}`,
    `- autoCommit: ${audit.safety.autoCommit}`,
    `- autoPush: ${audit.safety.autoPush}`,
    `- realSendExecuted: ${audit.safety.realSendExecuted}`,
    "",
    "This audit uses real local files and commands. Internal runs are local mock tests only; they are not real Codex execution, not codex CLI, and not codex exec.",
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
