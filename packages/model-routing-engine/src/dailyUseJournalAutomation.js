import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildDailyUseJournalAutomation() {
  return {
    phase: "Phase989",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    dailyUseJournalReady: true,
    template: {
      date: null,
      tasks: [],
      modeUsed: null,
      whatWorked: [],
      whatFailed: [],
      newCapabilityIdea: [],
      providerRequestCount: 0,
      evidenceRefs: [],
      severity: null,
    },
    ...safetyFields(),
  };
}
