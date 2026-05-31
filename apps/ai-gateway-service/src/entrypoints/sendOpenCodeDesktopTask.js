import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  copyToClipboard,
  defaultDesktopDetection,
  openCodeLoopPaths,
  pasteToDesktopWindow,
  printJson,
  readJsonIfPresent,
  relativeFromRoot,
  safeStat,
  writeJson,
} from "./opencodeLoopShared.js";
import { previewLatestRepoSession } from "./opencodeDbSafeReader.js";

const defaultWindowTitlePattern = "OpenCode";
const defaultProcessPattern = "OpenCode";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const task = await loadTask();
  const preflight = buildPreflight(task);
  const desktop = defaultDesktopDetection();

  if (options.mode === "dry-run") {
    printJson({
      status: "dry-run",
      taskTitle: task.json.title || "(untitled)",
      taskLength: task.markdown.length,
      preflight,
      desktopInstalled: desktop.installed,
      copiedToClipboard: false,
      pastedToDesktop: false,
      sent: false,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  ensurePreflightPassed(preflight);

  if (options.mode === "copy-only") {
    await copyToClipboard(task.markdown);
    printJson({
      status: "copy-only",
      copiedToClipboard: true,
      pastedToDesktop: false,
      sent: false,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  if (options.mode === "paste-only") {
    await copyToClipboard(task.markdown);
    const pasteResult = await pasteToDesktopWindow({
      windowTitlePattern: options.windowTitlePattern,
      processPattern: options.processPattern,
      sendEnter: false,
    });
    printJson({
      status: pasteResult.windowFound ? "paste-only" : "blocked",
      blocker: pasteResult.windowFound ? null : "opencode_desktop_window_not_found",
      copiedToClipboard: true,
      pastedToDesktop: Boolean(pasteResult.pasted),
      sent: false,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  if (!options.send || !options.confirmSend) {
    throw new Error("Sending to OpenCode Desktop requires both --send and --confirm-send.");
  }

  await copyToClipboard(task.markdown);
  const beforePreview = await previewLatestRepoSession({
    repoRoot: task.json.projectRoot || openCodeLoopPaths.outboxDir.replace(/\.opencode-handoff[\\/]outbox$/u, ""),
    dbPath: options.dbPath,
  }).catch(() => ({
    candidateSession: null,
  }));
  const pasteResult = await pasteToDesktopWindow({
    windowTitlePattern: options.windowTitlePattern,
    processPattern: options.processPattern,
    sendEnter: true,
  });
  if (!pasteResult.windowFound) {
    printJson({
      status: "blocked",
      blocker: "opencode_desktop_window_not_found",
      copiedToClipboard: true,
      pastedToDesktop: false,
      sent: false,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  const sentAt = new Date().toISOString();
  const sentAtMs = Date.now();
  const record = {
    sentAt,
    sentAtMs,
    mode: "controlled-opencode-desktop-send",
    taskId: task.json.taskId || null,
    taskTitle: task.json.title || null,
    copiedToClipboard: true,
    pastedToDesktop: Boolean(pasteResult.pasted),
    sent: true,
    processName: pasteResult.processName || null,
    windowTitle: pasteResult.title || null,
    sessionCandidateId: beforePreview.candidateSession?.id || null,
    sessionCandidateTitle: beforePreview.candidateSession?.title || null,
    dbPath: options.dbPath,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: "This record only confirms the task was sent to the OpenCode Desktop UI. It does not confirm execution completion; ingest/review is still required.",
  };
  await mkdir(openCodeLoopPaths.runsDir, { recursive: true });
  await writeJson(openCodeLoopPaths.sendRecordJsonPath, record);
  await writeFile(
    openCodeLoopPaths.sendRecordMarkdownPath,
    [
      "# OpenCode Desktop Send Record",
      "",
      `- sentAt: ${sentAt}`,
      `- taskId: ${record.taskId || "unknown"}`,
      `- taskTitle: ${record.taskTitle || "unknown"}`,
      `- copiedToClipboard: ${record.copiedToClipboard}`,
      `- pastedToDesktop: ${record.pastedToDesktop}`,
      `- sent: ${record.sent}`,
      `- sessionCandidateId: ${record.sessionCandidateId || "none"}`,
      "- providerCalledByThisProcess=false",
      "- codexCliInvoked=false",
      "- codexExecInvoked=false",
      "- workflowRunnerEnabled=false",
      "- worktreeCreated=false",
      "- autoCommit=false",
      "- autoPush=false",
      "",
      record.note,
      "",
    ].join("\n"),
    "utf8",
  );
  printJson({
    status: "sent-to-desktop",
    recordPath: relativeFromRoot(openCodeLoopPaths.sendRecordJsonPath),
    copiedToClipboard: true,
    pastedToDesktop: Boolean(pasteResult.pasted),
    sent: true,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });
}

function parseArgs(args) {
  const options = {
    mode: "dry-run",
    send: false,
    confirmSend: false,
    windowTitlePattern: defaultWindowTitlePattern,
    processPattern: defaultProcessPattern,
    dbPath: openCodeLoopPaths.defaultDbPath,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") options.mode = "dry-run";
    else if (arg === "--copy-only") options.mode = "copy-only";
    else if (arg === "--paste-only") options.mode = "paste-only";
    else if (arg === "--send") {
      options.mode = "send";
      options.send = true;
    } else if (arg === "--confirm-send") {
      options.confirmSend = true;
    } else if (arg === "--window-title-pattern") {
      options.windowTitlePattern = args[index + 1] || defaultWindowTitlePattern;
      index += 1;
    } else if (arg === "--process-pattern") {
      options.processPattern = args[index + 1] || defaultProcessPattern;
      index += 1;
    } else if (arg === "--db-path") {
      options.dbPath = args[index + 1] || openCodeLoopPaths.defaultDbPath;
      index += 1;
    } else if (arg !== "--") {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function loadTask() {
  const markdownStats = await safeStat(openCodeLoopPaths.outboxMarkdownPath);
  const jsonStats = await safeStat(openCodeLoopPaths.outboxJsonPath);
  if (!markdownStats.exists || !jsonStats.exists) {
    throw new Error("Missing OpenCode outbox task. Run opencode:desktop:seed-task first.");
  }
  return {
    markdown: await readFile(openCodeLoopPaths.outboxMarkdownPath, "utf8"),
    json: await readJsonIfPresent(openCodeLoopPaths.outboxJsonPath),
    markdownStats,
    jsonStats,
  };
}

function buildPreflight(task) {
  const checks = {
    taskMarkdownExists: task.markdownStats.exists,
    taskJsonExists: task.jsonStats.exists,
    executionEnabledFalse: task.json?.executionEnabled === false,
    providerCalledFalse: task.json?.providerCalledByThisPhase !== true,
    noCommitPush:
      task.json?.autoCommit === false
      && (task.json?.autoPush === false || task.json?.autoCommitPush === false),
    noPlaintextSecret: !/nvapi-|sk-|tp-/i.test(task.markdown),
  };
  return {
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

function ensurePreflightPassed(preflight) {
  if (!preflight.passed) {
    throw new Error(`OpenCode Desktop send preflight failed: ${JSON.stringify(preflight.checks)}`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
