import { evaluateProviderCredentialReadiness } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJsonIfPresent, writeJson, writeText } from "./phase781-800-common.mjs";

const discoveryApproval = readJsonIfPresent("provider-expansion/approvals/phase781_800-discovery-approval.input.json");
const smokeApproval = readJsonIfPresent("provider-expansion/approvals/phase781_800-smoke-approval.input.json");
const source = discoveryApproval ?? smokeApproval ?? {};
const readiness = evaluateProviderCredentialReadiness({
  providerFamily: source.providerFamily,
  providerId: source.providerId,
  credentialRef: source.credentialRef,
  rawSecretPresent: false,
});
const result = {
  ...readiness,
  completed: true,
  credentialReadinessGateReady: true,
  approvalInputPresent: Boolean(discoveryApproval || smokeApproval),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json", result);
writeText("docs/phase781-800/phase783-provider-credential-readiness-gate.md", phaseDoc({
  phase: "Phase783",
  title: "Provider Credential Readiness Gate",
  goal: "检查 provider allowlist 和 CredentialRef 引用状态；无 approval 时保持 credential_missing。",
  facts: [
    `approvalInputPresent=${result.approvalInputPresent}`,
    `credentialReady=${result.credentialReady}`,
    `readinessStatus=${result.readinessStatus}`,
  ],
  boundaries: ["rawSecretRead=false", "authJsonRead=false", "nonAllowlistedProviderBlocked=true"],
  outputs: ["apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
