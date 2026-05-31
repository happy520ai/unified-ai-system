import { runProviderDiscoveryAdapterV0 } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const approvalIntake = readJson("provider-expansion/discovery/discovery-approval-intake-result.json");
const readiness = readJson("apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json");
const discovery = runProviderDiscoveryAdapterV0({ approvalIntake, readiness });
const result = {
  ...discovery,
  completed: true,
  providerDiscoveryAdapterReady: true,
  discoveredModelCount: discovery.discoveredModels.length,
  ...baseSafety(),
};
writeJson("provider-expansion/discovery/provider-discovery-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/provider-discovery-adapter-result.json", result);
writeText("docs/phase781-800/phase785-provider-discovery-adapter-v0.md", phaseDoc({
  phase: "Phase785",
  title: "Provider Discovery Adapter v0",
  goal: "执行 bounded discovery adapter v0；无合规 approval 时写 not_executed_no_approval。",
  facts: [`status=${result.status}`, `realDiscoveryExecuted=${result.realDiscoveryExecuted}`, `discoveredModelCount=${result.discoveredModelCount}`],
  boundaries: ["providerCallsMade=false when no approval", "secretRead=false", "selectable unchanged"],
  outputs: ["provider-expansion/discovery/provider-discovery-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
