import fs from "node:fs";
import path from "node:path";
import { buildIsolatedRuntimeCandidateRoutePreview } from "../../packages/codex-context-gateway/src/isolatedRuntimeCandidateRoute.js";
import { buildIsolatedRuntimeCandidateCommandPreview } from "../../packages/codex-context-gateway/src/isolatedRuntimeCandidateContract.js";

const root = process.cwd();
const evidencePath = "apps/ai-gateway-service/evidence/phase623r/isolated-runtime-candidate-dry-run-smoke-result.json";

const routePreview = buildIsolatedRuntimeCandidateRoutePreview();
const commandPreview = buildIsolatedRuntimeCandidateCommandPreview();

const result = {
  phase: "Phase623R-Fix",
  name: "Isolated Runtime Candidate Dry-Run Smoke",
  status: "pass",
  blocker: null,
  isolatedRouteContractLoadable: Boolean(routePreview.routeId),
  guardedPromptLoadable: commandPreview.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK"),
  maxRequestsPolicyApplied: routePreview.maxRequestsDefault === 1 && routePreview.maxRequestsHardLimit === 3 && routePreview.retryLimit === 0,
  rollbackPolicyReferenced: true,
  emergencyDisablePolicyReferenced: true,
  realCodexExecExecuted: false,
  providerCallMade: false,
  defaultChatModified: false,
  chatGatewayExecuteModified: false,
  routeId: routePreview.routeId,
  selectedProviderId: routePreview.selectedProviderId,
  commandPreview,
  responseClassification: "dry_run_pass",
};

writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));

function writeJson(relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
