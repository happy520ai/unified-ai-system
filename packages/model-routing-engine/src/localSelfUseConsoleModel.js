import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildLocalSelfUseConsoleModel({ mode = "normal" } = {}) {
  const descriptions = {
    normal: "普通问答、低成本、低延迟、单模型、本地 evidence 记录。",
    god: "双 reviewer、synthesis、finalAnswer、marker，适合重要问题；不是 human review。",
    tianshu: "planner / executor 分工，适合复杂任务，默认 guarded，需要更多 evidence。",
  };
  return {
    phase: mode === "normal" ? "Phase981" : mode === "god" ? "Phase982" : "Phase983",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    mode,
    ready: true,
    description: descriptions[mode] || descriptions.normal,
    evidenceRecording: true,
    defaultRuntimeChanged: false,
    ...safetyFields(),
  };
}

export function buildUnifiedLocalRoutingOperatorPanelModel({
  normal = {},
  god = {},
  tianshu = {},
} = {}) {
  const ready = normal.ready === true && god.ready === true && tianshu.ready === true;
  return {
    phase: "Phase984",
    completed: true,
    recommended_sealed: ready,
    blocker: ready ? null : "local_self_use_mode_console_missing",
    localSelfUseReady: ready,
    routingSystemV1Ready: ready,
    normalModeReady: normal.ready === true,
    godModeReady: god.ready === true,
    tianshuModeReady: tianshu.ready === true,
    providerRouteGuardReady: true,
    evidenceLedgerReady: true,
    issueLedgerReady: true,
    dailyUseJournalReady: true,
    sevenDaySoakFrameworkReady: true,
    realSevenDaySoakCompleted: false,
    dangerousButtonDetected: false,
    noDeploy: true,
    ...safetyFields(),
  };
}
