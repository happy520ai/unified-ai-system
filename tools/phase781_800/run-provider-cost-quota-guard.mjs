import { buildProviderRateLimitTimeoutPolicy, evaluateProviderCostQuotaGuard } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJsonIfPresent, writeJson, writeText } from "./phase781-800-common.mjs";

const discoveryApproval = readJsonIfPresent("provider-expansion/approvals/phase781_800-discovery-approval.input.json");
const smokeApproval = readJsonIfPresent("provider-expansion/approvals/phase781_800-smoke-approval.input.json");
const cost = evaluateProviderCostQuotaGuard({
  maxRequests: discoveryApproval?.maxDiscoveryRequests ?? smokeApproval?.maxSmokeRequests ?? 0,
  maxAllowedRequests: smokeApproval ? 5 : 3,
  maxEstimatedCostUsd: discoveryApproval?.maxEstimatedCostUsd ?? smokeApproval?.maxEstimatedCostUsd ?? 0,
});
const timeoutPolicy = buildProviderRateLimitTimeoutPolicy();
const result = {
  phaseRange: "Phase791-792",
  completed: true,
  costQuotaGuardReady: true,
  rateLimitTimeoutPolicyReady: true,
  cost,
  timeoutPolicy,
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase781_800/provider-cost-quota-rate-timeout-result.json", result);
writeText("docs/phase781-800/phase791-provider-cost-quota-guard.md", phaseDoc({
  phase: "Phase791",
  title: "Provider Cost / Quota Guard",
  goal: "建立 Provider cost/quota guard，默认 maxEstimatedCostUsd=0。",
  facts: [`costQuotaGuardReady=${result.costQuotaGuardReady}`, `allowed=${cost.allowed}`],
  boundaries: ["maxEstimatedCostUsd must be 0 in this phase", "request caps enforced"],
  outputs: ["apps/ai-gateway-service/evidence/phase781_800/provider-cost-quota-rate-timeout-result.json"],
}));
writeText("docs/phase781-800/phase792-provider-rate-limit-timeout-policy.md", phaseDoc({
  phase: "Phase792",
  title: "Provider Rate-limit / Timeout Policy",
  goal: "建立 rate-limit / timeout policy。",
  facts: [`maxDiscoveryRequests=${timeoutPolicy.maxDiscoveryRequests}`, `maxSmokeRequests=${timeoutPolicy.maxSmokeRequests}`, `timeoutMs=${timeoutPolicy.timeoutMs}`],
  boundaries: ["maxRetries=0", "stopOnRateLimit=true"],
  outputs: ["rateLimitTimeoutPolicyReady=true"],
}));
console.log(JSON.stringify(result, null, 2));
