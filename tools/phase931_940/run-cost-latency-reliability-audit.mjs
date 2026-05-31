import { auditCostLatencyReliability } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...auditCostLatencyReliability({ phase916930: readJsonIfPresent(paths.phase916RequiredFinal) || {} }),
  ...baseSafety(),
};

writeJson(paths.costLatencyReliability, result);
writeDoc("phase937-cost-latency-reliability-audit.md", {
  title: "Phase937 Cost Latency Reliability Audit",
  goal: "Audit cost, latency availability, and reliability signals from the Phase916-930 evidence.",
  facts: [
    `totalProviderRequests=${result.totalProviderRequests}`,
    `estimatedCostUsdTotal=${result.estimatedCostUsdTotal}`,
    `latencyEvidencePresent=${result.latencyEvidencePresent}`,
  ],
  boundaries: ["No new Provider request.", "Latency gap is a warning, not a blocker."],
  outputs: [paths.costLatencyReliability],
});
console.log(JSON.stringify(result, null, 2));
