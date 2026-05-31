import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRunnerCommandDryRunMatrix } from "../../gvc/runnerCommandBridgeDryRun.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

const paths = {
  state: "docs/project-brain/timed-runner-state.json",
  control: "docs/project-brain/runner-control.json",
  executionHistory: "apps/ai-gateway-service/evidence/gvc-execution-history.json",
  latestControlEvidence: "apps/ai-gateway-service/evidence/phase2021-gvc-owner-control-panel/runner-control-result.json",
  cycleAudit: "apps/ai-gateway-service/evidence/phase2083-gvc-cycle-audit/result.json",
  cycleControllerSeal: "apps/ai-gateway-service/evidence/phase2086-gvc-high-value-autonomy-cycle-controller/result.json",
  cycleFinalSeal: "apps/ai-gateway-service/evidence/phase2086-gvc-cycle-controller-final-seal/result.json",
};

export function buildGvcRunnerDashboardSnapshot() {
  const state = readJson(paths.state) ?? {};
  const control = readJson(paths.control) ?? {};
  const history = readJson(paths.executionHistory) ?? {};
  const latestControlEvidence = readJson(paths.latestControlEvidence) ?? {};
  const cycleAudit = readJson(paths.cycleAudit) ?? {};
  const cycleControllerSeal = readJson(paths.cycleControllerSeal) ?? {};
  const cycleFinalSeal = readJson(paths.cycleFinalSeal) ?? {};
  const latestHistoryRecord = Array.isArray(history.records) ? history.records[history.records.length - 1] : null;
  const latestEvidenceRef = state.lastLoopEvidenceRef ?? latestControlEvidence.scenarioEvidence?.normal ?? latestHistoryRecord?.evidenceRef ?? paths.latestControlEvidence;
  const latestLoopEvidence = latestEvidenceRef ? readJson(latestEvidenceRef) : null;
  const loopQueueDecisions = Array.isArray(latestLoopEvidence?.queueDecisions) ? latestLoopEvidence.queueDecisions : [];
  const latestMutationResult = latestLoopEvidence?.mutationResult ?? null;
  const skippedApprovalRequiredTasks = Array.from(new Set([
    ...(Array.isArray(latestLoopEvidence?.skippedApprovalRequiredTasks) ? latestLoopEvidence.skippedApprovalRequiredTasks : []),
    ...loopQueueDecisions
      .filter((entry) => entry.decision === "approval_required")
      .map((entry) => entry.taskId)
      .filter(Boolean),
    ]));
  const qualityGate = readJson("apps/ai-gateway-service/evidence/phase2034-gvc-task-quality-gate/task-quality-verify-result.json") ?? {};
  const qualityGateBlockedCount = Number.isInteger(qualityGate.blockedLowValueTaskCount)
    ? qualityGate.blockedLowValueTaskCount
    : Array.isArray(qualityGate.blockedLowValueTasks)
      ? qualityGate.blockedLowValueTasks.length
      : 0;

  return {
    phaseId: "Phase2022-GVC-Runner-Dashboard-ReadOnly",
    readOnly: true,
    stateSource: paths.state,
    controlSource: paths.control,
    executionHistorySource: paths.executionHistory,
    latestControlEvidenceSource: paths.latestControlEvidence,
    runnerRunning: state.status === "passed" && state.currentBlocker === "none",
    runnerStatus: state.status ?? "unknown",
    paused: control.paused === true,
    stopRequested: control.stopRequested === true,
    loopsCompletedToday: Number.isInteger(state.loopsCompletedToday) ? state.loopsCompletedToday : 0,
    dailyLoopLimit: Number.isInteger(state.dailyLoopLimit) ? state.dailyLoopLimit : 500,
    intervalMs: Number.isInteger(state.intervalMs) ? state.intervalMs : 30000,
    autonomousMutationEnabled: state.autonomousMutationEnabled === true || latestLoopEvidence?.autonomousMutationEnabled === true,
    realMutationLoopsToday: Number.isInteger(state.realExecutionLoopsCompletedToday)
      ? state.realExecutionLoopsCompletedToday
      : Number.isInteger(latestLoopEvidence?.realExecutionLoopsCompletedToday)
        ? latestLoopEvidence.realExecutionLoopsCompletedToday
        : 0,
    lastMutationFiles: Array.isArray(latestMutationResult?.mutatedFiles) ? latestMutationResult.mutatedFiles : [],
    lastRollbackStatus: latestMutationResult?.rollbackPerformed === true ? latestMutationResult.status : "none",
    qualityGateBlockedCount,
    lastSelectedTaskId: state.lastSelectedTaskId ?? latestHistoryRecord?.phaseId ?? null,
    currentBlocker: state.currentBlocker ?? latestControlEvidence.blocker ?? "unknown",
    skippedApprovalRequiredTasks,
    safetyFlags: {
      dryRunOnly: control.dryRunOnly === true && state.dryRunOnly !== false,
      noProvider: control.noProvider === true,
      noSecret: control.noSecret === true,
      noDeploy: control.noDeploy === true,
      ownerManualStartOnly: state.ownerManualStartOnly !== false,
      windowsTaskSchedulerRegistered: state.windowsTaskSchedulerRegistered === true,
      startupAutoRunRegistered: state.startupAutoRunRegistered === true,
    },
    cycleStatus: {
      currentCycleState: cycleFinalSeal.status ?? cycleControllerSeal.status ?? "unknown",
      freshnessGateStatus: cycleAudit.freshnessGateStatus ?? (cycleControllerSeal.freshnessGateReady === true ? "passed" : "unknown"),
      plannerRefreshExecuted: cycleAudit.plannerRefreshExecuted === true || cycleControllerSeal.plannerRefreshReady === true,
      lastBatchMutationCount: Number(cycleAudit.realMutationLoopCount || cycleControllerSeal.realMutationLoopCount || 0),
      lastNoOpCount: Number(cycleAudit.noOpLoopCount || cycleControllerSeal.noOpLoopCount || 0),
      lastRollbackFailedCount: Number(cycleAudit.rollbackFailedCount || cycleControllerSeal.rollbackFailedCount || 0),
      duplicateTasksBlocked: Number(cycleAudit.duplicateTasksBlocked || cycleControllerSeal.duplicateTasksBlocked || 0),
      lowValueTasksBlocked: Number(cycleAudit.lowValueTasksBlocked || cycleControllerSeal.lowValueTasksBlocked || 0),
      nextRecommendedCycleAction: cycleFinalSeal.nextMode ?? cycleControllerSeal.nextMode ?? "Use gvc:cycle to advance product work.",
    },
    evidenceRefs: [
      latestEvidenceRef,
      paths.latestControlEvidence,
      paths.executionHistory,
      paths.cycleAudit,
      paths.cycleControllerSeal,
      paths.cycleFinalSeal,
    ].filter(Boolean),
    historyRecordCount: Number.isInteger(history.recordCount) ? history.recordCount : Array.isArray(history.records) ? history.records.length : 0,
    providerCallsMade: state.providerCallsMade === true || latestControlEvidence.providerCallsMade === true,
    secretRead: state.secretRead === true || latestControlEvidence.secretRead === true,
    deployExecuted: state.deployExecuted === true || latestControlEvidence.deployExecuted === true,
    chatModified: latestControlEvidence.chatModified === true,
    chatGatewayExecuteModified: state.chatGatewayExecuteModified === true || latestControlEvidence.chatGatewayExecuteModified === true,
    legacyModified: latestControlEvidence.legacyModified === true,
    projectContextModified: latestControlEvidence.projectContextModified === true,
    executionActionsExposed: false,
  };
}

export function renderGvcRunnerDashboardPanel() {
  const snapshot = buildGvcRunnerDashboardSnapshot();
  const commandPreviews = buildRunnerCommandDryRunMatrix();
  const skipped = snapshot.skippedApprovalRequiredTasks.length > 0
    ? snapshot.skippedApprovalRequiredTasks.map((taskId) => `<span>${escapeHtml(taskId)}</span>`).join("")
    : "<span>none</span>";
  const evidenceRows = snapshot.evidenceRefs.slice(0, 4).map((ref) => `
                    <li><code>${escapeHtml(ref)}</code></li>`).join("");
  const safetyRows = [
    ["dryRunOnly", snapshot.safetyFlags.dryRunOnly],
    ["noProvider", snapshot.safetyFlags.noProvider],
    ["noSecret", snapshot.safetyFlags.noSecret],
    ["noDeploy", snapshot.safetyFlags.noDeploy],
    ["manual start only", snapshot.safetyFlags.ownerManualStartOnly],
    ["Windows Task Scheduler", snapshot.safetyFlags.windowsTaskSchedulerRegistered ? "registered" : "not registered"],
    ["startup auto-run", snapshot.safetyFlags.startupAutoRunRegistered ? "registered" : "not registered"],
  ].map(([label, value]) => `
                    <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("");
  const mutationFiles = snapshot.lastMutationFiles.length > 0
    ? snapshot.lastMutationFiles.map((file) => `<span>${escapeHtml(file)}</span>`).join("")
    : "<span>none</span>";
  const cycle = snapshot.cycleStatus;
  const commandPreviewCards = commandPreviews.map((preview) => `
                    <article class="comparison-card" data-gvc-runner-command-preview-card="${escapeHtml(preview.commandIntent)}">
                      <strong>${escapeHtml(commandLabel(preview.commandIntent))}</strong>
                      <p>${escapeHtml(preview.previewSummary)}</p>
                      <small>realWritePerformed=${escapeHtml(preview.realWritePerformed)} · processSignalSent=${escapeHtml(preview.processSignalSent)}</small>
                    </article>`).join("");

  return `
              <section class="gvc-runner-dashboard-readonly-panel" id="gvc-runner-dashboard-readonly-panel" data-phase2022-gvc-runner-dashboard="true" data-phase2023-gvc-runner-command-bridge="true" data-phase2043-gvc-dashboard-real-mutation-status="true" data-gvc-runner-readonly="true" data-gvc-runner-command-bridge-dry-run="true" aria-label="GVC Runner read-only dashboard">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">GVC Runner</div>
                    <h3>Runner 状态面�?/h3>
                    <p>只读展示本地 timed runner 状态；这里不会启动、暂停、停�?runner，也不会调用 Provider�?/p>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <div class="radar-grid" data-gvc-runner-status-grid="true">
                  <span>runner 是否运行 <strong>${escapeHtml(snapshot.runnerRunning ? "running" : snapshot.runnerStatus)}</strong></span>
                  <span>当前是否 paused <strong>${escapeHtml(snapshot.paused)}</strong></span>
                  <span>今日 loop 次数 <strong>${escapeHtml(`${snapshot.loopsCompletedToday}/${snapshot.dailyLoopLimit}`)}</strong></span>
                  <span>最近执行任�?<strong>${escapeHtml(snapshot.lastSelectedTaskId ?? "none")}</strong></span>
                  <span>最�?blocker <strong>${escapeHtml(snapshot.currentBlocker)}</strong></span>
                  <span>history records <strong>${escapeHtml(snapshot.historyRecordCount)}</strong></span>
                </div>
                <div class="radar-grid" data-gvc-runner-real-mutation-status="true">
                  <span>autonomousMutationEnabled <strong>${escapeHtml(snapshot.autonomousMutationEnabled)}</strong></span>
                  <span>realMutationLoopsToday <strong>${escapeHtml(snapshot.realMutationLoopsToday)}</strong></span>
                  <span>lastRollbackStatus <strong>${escapeHtml(snapshot.lastRollbackStatus)}</strong></span>
                  <span>qualityGateBlockedCount <strong>${escapeHtml(snapshot.qualityGateBlockedCount)}</strong></span>
                </div>
                <div class="arena-strip" data-gvc-runner-last-mutation-files="true">
                  <strong>lastMutationFiles</strong>
                  ${mutationFiles}
                </div>
                <div class="arena-strip" data-gvc-runner-skipped-approval="true">
                  <strong>skipped approval_required</strong>
                  ${skipped}
                </div>
                <div class="eyebrow">safety flags</div>
                <div class="radar-grid" data-gvc-runner-safety-flags="true">
${safetyRows}
                </div>
                <div class="comparison-footer" data-gvc-runner-boundary="true">
                  <span>providerCallsMade=${escapeHtml(snapshot.providerCallsMade)}</span>
                  <span>secretRead=${escapeHtml(snapshot.secretRead)}</span>
                  <span>deployExecuted=${escapeHtml(snapshot.deployExecuted)}</span>
                  <span>chatGatewayExecuteModified=${escapeHtml(snapshot.chatGatewayExecuteModified)}</span>
                </div>
                <section class="comparison-panel" id="gvc-cycle-dashboard-readonly-panel" data-phase2085-gvc-cycle-dashboard-readonly="true" data-gvc-cycle-dashboard-readonly="true" aria-label="GVC cycle controller read-only status">
                  <div class="drilldown-head">
                    <div>
                      <div class="eyebrow">GVC Cycle</div>
                      <h3>Cycle Controller 只读状�?/h3>
                      <p>展示 freshness gate、planner refresh、batch audit �?final seal；这里只读，不会�?runner-control，也不会启动 runner�?/p>
                    </div>
                    <span class="tour-chip">read-only</span>
                  </div>
                  <div class="radar-grid" data-gvc-cycle-status-grid="true">
                    <span>currentCycleState <strong>${escapeHtml(cycle.currentCycleState)}</strong></span>
                    <span>freshnessGateStatus <strong>${escapeHtml(cycle.freshnessGateStatus)}</strong></span>
                    <span>plannerRefreshExecuted <strong>${escapeHtml(cycle.plannerRefreshExecuted)}</strong></span>
                    <span>lastBatchMutationCount <strong>${escapeHtml(cycle.lastBatchMutationCount)}</strong></span>
                    <span>lastNoOpCount <strong>${escapeHtml(cycle.lastNoOpCount)}</strong></span>
                    <span>lastRollbackFailedCount <strong>${escapeHtml(cycle.lastRollbackFailedCount)}</strong></span>
                    <span>duplicateTasksBlocked <strong>${escapeHtml(cycle.duplicateTasksBlocked)}</strong></span>
                    <span>lowValueTasksBlocked <strong>${escapeHtml(cycle.lowValueTasksBlocked)}</strong></span>
                  </div>
                  <div class="arena-strip" data-gvc-cycle-next-action="true">
                    <strong>nextRecommendedCycleAction</strong>
                    <span>${escapeHtml(cycle.nextRecommendedCycleAction)}</span>
                  </div>
                </section>
                <section class="comparison-panel" id="gvc-runner-command-bridge-dry-run-panel" data-gvc-runner-command-bridge-panel="true">
                  <div class="drilldown-head">
                    <div>
                      <div class="eyebrow">Command Bridge</div>
                      <h3>Runner 控制意图 dry-run</h3>
                      <p>这三个操作只生成 command preview，不会写 runner-control.json，不会停止进程�?/p>
                    </div>
                    <span class="tour-chip">dry-run only</span>
                  </div>
                  <div class="comparison-footer" data-gvc-runner-command-actions="true" aria-label="GVC runner dry-run command preview actions">
                    <button type="button" class="ghost" data-gvc-runner-command-intent="pause">暂停</button>
                    <button type="button" class="ghost" data-gvc-runner-command-intent="resume">继续</button>
                    <button type="button" class="ghost" data-gvc-runner-command-intent="stop">停止</button>
                  </div>
                  <div class="comparison-grid" data-gvc-runner-command-preview-grid="true">
${commandPreviewCards}
                  </div>
                  <div class="scenario-dry-run-result" id="gvc-runner-command-preview-result" data-gvc-runner-command-preview-result="true" hidden>
                    <h3 id="gvc-runner-command-preview-title">Command preview</h3>
                    <p id="gvc-runner-command-preview-copy">选择暂停、继续或停止后，这里只显�?dry-run command preview�?/p>
                    <div class="comparison-footer" data-gvc-runner-command-preview-boundary="true">
                      <span>wouldWriteControlFile=true</span>
                      <span>realWritePerformed=false</span>
                      <span>processSignalSent=false</span>
                      <span>providerCallsMade=false</span>
                    </div>
                  </div>
                </section>
                <details class="drilldown-panel" data-gvc-runner-evidence="true">
                  <summary>evidence 路径</summary>
                  <ul class="surface-muted">
${evidenceRows}
                  </ul>
                </details>
              </section>`;
}

function commandLabel(commandIntent) {
  if (commandIntent === "pause") return "暂停 preview";
  if (commandIntent === "resume") return "继续 preview";
  return "停止 preview";
}

function readJson(relativePath) {
  const filePath = resolve(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


