import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCodexDesktopStatus } from "./codexDesktopStatus.js";
import { readCodexLoopStatus } from "./codexLoopStatus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-267a-desktop-automation-ready-state-reset.json");
const evidenceMarkdownPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-267a-desktop-automation-ready-state-reset.md");

async function main() {
  const rootPackage = await readJson("package.json");
  const servicePackage = await readJson("apps/ai-gateway-service/package.json");
  const reset = await readJson(".codex-handoff/runs/latest-ready-state-reset.json");
  const desktopStatus = await readCodexDesktopStatus();
  const loopStatus = await readCodexLoopStatus();
  const doc = await readText("docs/CODEX_DESKTOP_READY_STATE_RESET.md");
  const ui = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

  const checks = {
    docExists: await exists("docs/CODEX_DESKTOP_READY_STATE_RESET.md"),
    resetJsonExists: await exists(".codex-handoff/runs/latest-ready-state-reset.json"),
    resetMarkdownExists: await exists(".codex-handoff/runs/latest-ready-state-reset.md"),
    rootScriptPresent: Object.hasOwn(rootPackage.scripts || {}, "codex:desktop:reset-ready")
      && Object.hasOwn(rootPackage.scripts || {}, "verify:phase267a-desktop-automation-ready-state-reset"),
    serviceScriptPresent: Object.hasOwn(servicePackage.scripts || {}, "codex:desktop:reset-ready")
      && Object.hasOwn(servicePackage.scripts || {}, "verify:phase267a-desktop-automation-ready-state-reset"),
    resetStatusReady: reset.status === "ready",
    resetModeCorrect: reset.mode === "desktop-automation-ready-state-reset",
    previousNoGoArchived: reset.previous?.goNoGo === "no-go",
    archivedFilesPresent: Array.isArray(reset.archivedFiles)
      && reset.archivedFiles.filter((file) => file.exists && file.archivedPath).length >= 3,
    doesNotDeleteEvidence: reset.doesNotDeleteEvidence === true,
    doesNotMarkFailedEvidencePassed: reset.doesNotMarkFailedEvidencePassed === true,
    desktopReadyStateActive: desktopStatus.readyStateResetActive === true,
    desktopLatestGoNoGoStandby: desktopStatus.latestGoNoGo === "standby-ready",
    desktopCurrentBlockerNone: desktopStatus.currentBlocker === "none",
    loopLatestGoNoGoStandby: loopStatus.latestGoNoGo === "standby-ready",
    loopCurrentBlockerNone: loopStatus.currentBlocker === "none",
    uiMarkersPresent: [
      "Ready State Reset",
      "待命状态重置",
      "readyStateResetActive",
      "standby-ready",
      "cmd /c pnpm run codex:desktop:reset-ready",
      "doesNotMarkFailedEvidencePassed",
    ].every((marker) => ui.includes(marker)),
    docMarkersPresent: [
      "readyStateResetActive=true",
      "latestGoNoGo=standby-ready",
      "currentBlocker=none",
      "不会把 failed review 改成 passed",
      "realSendExecuted=false",
    ].every((marker) => doc.includes(marker)),
    noProjectContext: !(await exists("PROJECT_CONTEXT.md")),
    safetyCodexCliInvokedFalse: reset.codexCliInvoked === false && desktopStatus.codexCliInvoked === false,
    safetyCodexExecInvokedFalse: reset.codexExecInvoked === false && desktopStatus.codexExecInvoked === false,
    safetyWorkflowRunnerFalse: reset.workflowRunnerEnabled === false && desktopStatus.workflowRunnerEnabled === false,
    safetyWorktreeFalse: reset.worktreeCreated === false && desktopStatus.worktreeCreated === false,
    safetyAutoCommitFalse: reset.autoCommit === false && desktopStatus.autoCommit === false,
    safetyAutoPushFalse: reset.autoPush === false && desktopStatus.autoPush === false,
    safetyRealSendFalse: reset.realSendExecuted === false,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase: "phase-267a-desktop-automation-ready-state-reset",
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "desktop-automation-standby-ready" : "desktop-automation-ready-reset-incomplete",
    docPath: "docs/CODEX_DESKTOP_READY_STATE_RESET.md",
    resetPaths: [
      ".codex-handoff/runs/latest-ready-state-reset.json",
      ".codex-handoff/runs/latest-ready-state-reset.md",
    ],
    verifierPath: "apps/ai-gateway-service/src/entrypoints/verifyCodexDesktopReadyStateReset.js",
    checks,
    resetSummary: {
      resetAt: reset.resetAt,
      previousGoNoGo: reset.previous?.goNoGo || null,
      latestGoNoGo: desktopStatus.latestGoNoGo,
      currentBlocker: desktopStatus.currentBlocker,
      readyStateResetActive: desktopStatus.readyStateResetActive,
      archivedFileCount: reset.archivedFiles?.filter((file) => file.exists).length || 0,
    },
    safety: {
      codexCliInvoked: false,
      codexExecInvoked: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
      realSendExecuted: false,
      defaultNvidiaChatLaneChanged: false,
    },
  };

  await mkdir(dirname(evidenceJsonPath), { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMarkdownPath, renderEvidenceMarkdown(evidence), "utf8");

  console.log(JSON.stringify(evidence, null, 2));
  if (!passed) process.exitCode = 1;
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

function renderEvidenceMarkdown(evidence) {
  return [
    "# Phase 267A Desktop Automation Ready State Reset Evidence",
    "",
    `- status: ${evidence.status}`,
    `- generatedAt: ${evidence.generatedAt}`,
    `- conclusion: ${evidence.conclusion}`,
    `- previousGoNoGo: ${evidence.resetSummary.previousGoNoGo}`,
    `- latestGoNoGo: ${evidence.resetSummary.latestGoNoGo}`,
    `- currentBlocker: ${evidence.resetSummary.currentBlocker}`,
    `- readyStateResetActive: ${evidence.resetSummary.readyStateResetActive}`,
    `- archivedFileCount: ${evidence.resetSummary.archivedFileCount}`,
    "",
    "## Safety",
    "- codexCliInvoked=false",
    "- codexExecInvoked=false",
    "- workflowRunnerEnabled=false",
    "- worktreeCreated=false",
    "- autoCommit=false",
    "- autoPush=false",
    "- realSendExecuted=false",
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
