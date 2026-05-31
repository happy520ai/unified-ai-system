import { enforceRound2Budget } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, readModeResults, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...enforceRound2Budget({
    approvalGate: readJsonIfPresent(paths.approval) || {},
    modeResults: readModeResults(),
  }),
  ...baseSafety(),
};
result.blocker = result.recommended_sealed ? null : result.blocker || "round2_budget_guard_failed";
writeJson(paths.budget, result);
writeDoc("phase949-cost-latency-token-budget-enforcement.md", {
  title: "Phase949 Cost Latency Token Budget Enforcement",
  goal: "Verify Round 2 request count, retry count, budget, and token-saving boundaries.",
  facts: [`totalProviderRequests=${result.totalProviderRequests}`, `maxRetriesRespected=${result.maxRetriesRespected}`, `budgetExceeded=${result.budgetExceeded}`],
  boundaries: ["No retries.", "No request count above approval."],
  outputs: [paths.budget],
});
console.log(JSON.stringify(result, null, 2));
