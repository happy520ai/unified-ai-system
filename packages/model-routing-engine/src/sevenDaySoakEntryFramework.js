import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildSevenDaySoakEntryFramework() {
  return {
    phase: "Phase991-995",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    sevenDaySoakFrameworkReady: true,
    dailySoakRecordTemplateReady: true,
    soakMetricsAggregatorReady: true,
    realSevenDaySoakCompleted: false,
    realThirtyDaySoakCompleted: false,
    dayTemplateDefaults: {
      date: null,
      minutesUsed: 0,
      tasksRun: [],
      providerRequests: 0,
      failures: [],
      evidenceRefs: [],
      issues: [],
      notes: "",
      isRealUseLog: false,
    },
    checklist: [
      "local startup",
      "route test",
      "evidence ledger",
      "issue ledger",
      "rollback",
      "safe mode",
      "provider budget",
      "daily journal",
    ],
    ...safetyFields(),
  };
}
