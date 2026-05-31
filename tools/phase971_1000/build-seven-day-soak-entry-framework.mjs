import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildSevenDaySoakEntryFramework } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildSevenDaySoakEntryFramework();
writeJson(paths.soakLedgerTemplate, result.dayTemplateDefaults);
writeDoc(paths.soakFramework, {
  title: "Seven-day Soak Framework",
  goal: "Prepare the local self-use seven-day soak entry framework without claiming completion.",
  facts: [`realSevenDaySoakCompleted=${result.realSevenDaySoakCompleted}`],
  boundaries: ["Entry framework only.", "Templates are not real logs."],
  outputs: [paths.soakLedgerTemplate],
});
writeDoc("docs/phase971-1000/phase991-seven-day-soak-entry-framework.md", {
  title: "Phase991 Seven-day Soak Entry Framework",
  goal: "Generate soak framework and ledger template.",
  facts: [`sevenDaySoakFrameworkReady=${result.sevenDaySoakFrameworkReady}`],
  boundaries: ["No completed soak claim."],
  outputs: [paths.soakFramework, paths.soakLedgerTemplate],
});
writeJson("model-routing/v1-closure/soak/seven-day-soak-framework-result.json", result);
logResult(result);
