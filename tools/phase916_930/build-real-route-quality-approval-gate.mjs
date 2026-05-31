import {
  evaluateRealRouteQualityApprovalGate,
} from "../../packages/model-routing-engine/src/index.js";
import {
  approvalPath,
  ensurePhaseDirs,
  gatePath,
  phaseDoc,
  readJsonIfPresent,
  writeJson,
  writeText,
} from "./phase916-930-common.mjs";

ensurePhaseDirs();

const phase912915 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase912_915/phase912-915-final-result.json") || {};
const approval = readJsonIfPresent(approvalPath);
const gate = evaluateRealRouteQualityApprovalGate({ approval, phase912915 });

writeJson(gatePath, gate);
writeText("docs/phase916-930/phase916-real-route-quality-approval-gate.md", phaseDoc({
  title: "Phase916 Real Route Quality Approval Gate",
  goal: "Require a new bounded NVIDIA-only approval before broader real route quality testing.",
  facts: [
    `approvalPresent=${gate.approvalPresent}`,
    `authorizationComplete=${gate.authorizationComplete}`,
    `blocker=${gate.blocker}`,
  ],
  boundaries: [
    "maxTotalProviderRequests<=20",
    "maxEstimatedCostUsdTotal<=1.00",
    "maxRetries=0",
    "NVIDIA only",
  ],
  outputs: [gatePath],
}));

console.log(JSON.stringify(gate, null, 2));
