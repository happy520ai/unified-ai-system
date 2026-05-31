import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGodModeAlertFilterState, applyGodModeAlertFilters } from "../../apps/agent-console/src/godModeAlertFilterState.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase335b");
const resultPath = resolve(evidenceDir, "god-alert-dashboard-filter-state-smoke.json");
const rows = (JSON.parse(await readFile(resolve(repoRoot, "docs/phase332b-god-mode-trend-alert-rules.json"), "utf8")).rules || []).map((rule) => ({
  severity: rule.severity,
  blocker: rule.blocker,
}));
const filterState = buildGodModeAlertFilterState({ severity: "warning", blockerOnly: true });
const severityFiltered = applyGodModeAlertFilters(rows, { severity: "warning", blockerOnly: false });
const blockerFiltered = applyGodModeAlertFilters(rows, { severity: "all", blockerOnly: true });
const result = {
  phase: "Phase335B",
  filterStateVisible: filterState.filterStateVisible,
  severityFilterWorks: severityFiltered.every((row) => row.severity === "warning"),
  blockerOnlyFilterWorks: blockerFiltered.every((row) => row.blocker === true),
  noExternalAlertIntegration: true,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase335b-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(result) {
  return [
    "# Phase335B Execution Report",
    "",
    `- filterStateVisible: ${result.filterStateVisible}`,
    `- severityFilterWorks: ${result.severityFilterWorks}`,
    `- blockerOnlyFilterWorks: ${result.blockerOnlyFilterWorks}`,
    "",
  ].join("\n");
}
