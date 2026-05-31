import { buildRoutePolicyTuningDesign } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...buildRoutePolicyTuningDesign({
    scoreAudit: readJsonIfPresent(paths.score) || {},
    modeAudit: readJsonIfPresent(paths.mode) || {},
    fallbackAudit: readJsonIfPresent(paths.fallback) || {},
    costLatencyReliabilityAudit: readJsonIfPresent(paths.costLatencyReliability) || {},
  }),
  ...baseSafety(),
};

writeJson(paths.tuning, result);
writeJson(paths.tuningPlan, result);
writeDoc("phase938-route-policy-tuning-design-pack.md", {
  title: "Phase938 Route Policy Tuning Design Pack",
  goal: "Prepare route policy tuning recommendations without applying them to runtime.",
  facts: [
    `tuningDesignOnly=${result.tuningDesignOnly}`,
    `appliedToRuntime=${result.appliedToRuntime}`,
    `requiresFutureApproval=${result.requiresFutureApproval}`,
  ],
  boundaries: ["No runtime policy mutation.", "No /chat or /chat-gateway/execute default change."],
  outputs: [paths.tuning, paths.tuningPlan],
});
console.log(JSON.stringify(result, null, 2));
