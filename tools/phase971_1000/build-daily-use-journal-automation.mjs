import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildDailyUseJournalAutomation } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildDailyUseJournalAutomation();
writeJson(paths.dailyJournalTemplate, result.template);
writeDoc("docs/phase971-1000/phase989-daily-use-journal-automation.md", {
  title: "Phase989 Daily Use Journal Automation",
  goal: "Create daily use journal template for local self-use.",
  facts: [`dailyUseJournalReady=${result.dailyUseJournalReady}`],
  boundaries: ["Template only; no real-use claim."],
  outputs: [paths.dailyJournalTemplate],
});
logResult(result);
