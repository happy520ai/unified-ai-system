import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";

ensurePhaseDirs();
const template = readJsonIfPresent(paths.soakLedgerTemplate) || {
  date: null,
  minutesUsed: 0,
  tasksRun: [],
  providerRequests: 0,
  failures: [],
  evidenceRefs: [],
  issues: [],
  notes: "",
  isRealUseLog: false,
};
for (let day = 1; day <= 7; day += 1) {
  writeJson(`local-self-use/v1/soak/day-${String(day).padStart(2, "0")}.template.json`, {
    day,
    ...template,
    isRealUseLog: false,
  });
}
const result = {
  phase: "Phase992",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  dailySoakRecordTemplateReady: true,
  templateCount: 7,
  realSevenDaySoakCompleted: false,
};
writeDoc("docs/phase971-1000/phase992-daily-soak-record-template.md", {
  title: "Phase992 Daily Soak Record Template",
  goal: "Generate day-01 through day-07 soak templates.",
  facts: [`templateCount=${result.templateCount}`, "isRealUseLog=false by default"],
  boundaries: ["Templates only."],
  outputs: ["local-self-use/v1/soak/day-01.template.json"],
});
logResult(result);
