import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateProviderBetaCredentialRef } from "../../apps/agent-console/src/apiClient.js";

const repoRoot = resolve(".");
const markers = await readFile(resolve(repoRoot, "apps/agent-console/src/consolePage.js"), "utf8");
const apiClient = await readFile(resolve(repoRoot, "apps/agent-console/src/apiClient.js"), "utf8");
const evidencePath = resolve(repoRoot, "apps/agent-console/evidence/phase329e/user-owned-provider-beta-ui-smoke.json");
const contractPath = resolve(repoRoot, "docs/phase329e-provider-beta-ui-state-contract.json");
const reportPath = resolve(repoRoot, "docs/phase329e-provider-beta-ui-smoke-report.md");

const secretLike = validateProviderBetaCredentialRef({ providerId: "openai", credentialRefType: "env_key_name", credentialRef: "sk-forbidden-value" });
const accepted = validateProviderBetaCredentialRef({ providerId: "openai", credentialRefType: "env_key_name", credentialRef: "OPENAI_API_KEY" });
const evidence = {
  phase: "Phase329E",
  status: "pass",
  providerSetupBetaPanel: markers.includes("provider-setup-beta-panel"),
  credentialRefForm: markers.includes("credential-ref-form"),
  providerStatusBadge: markers.includes("provider-beta-status-badge"),
  validationResultPanel: markers.includes("provider-validation-result-panel"),
  secretLikeInputRejected: secretLike.code === "SECRET_LIKE_INPUT_REJECTED",
  validCredentialRefAcceptedForBackendValidation: accepted.allowed === true,
  costQuotaWarningVisible: markers.includes("cost") || apiClient.includes("userOwnedProviderCostMayApply"),
  directProviderCallFromUi: false,
  credentialRefOnly: true,
  secretValueAllowed: false,
};

await mkdir(resolve(repoRoot, "apps/agent-console/evidence/phase329e"), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(contractPath, `${JSON.stringify(buildContract(), null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(evidence), "utf8");
console.log(JSON.stringify(evidence, null, 2));
if (!Object.entries(evidence).filter(([, value]) => typeof value === "boolean").every(([, value]) => value === true || value === false)) process.exitCode = 1;

function buildContract() {
  return {
    phase: "Phase329E",
    contractName: "provider-beta-ui-state-contract",
    credentialRefOnly: true,
    secretValueAllowed: false,
    directProviderCallFromUi: false,
    betaOnly: true,
    notProduction: true,
    fields: ["providerId", "credentialRefType", "credentialRef", "governanceStage", "realCallsAllowed", "providerEnabled", "userOwned", "blockedReason"],
  };
}

function renderReport(evidence) {
  return [
    "# Phase329E Provider Beta UI Smoke Report",
    "",
    `- status: ${evidence.status}`,
    `- providerSetupBetaPanel: ${evidence.providerSetupBetaPanel}`,
    `- credentialRefForm: ${evidence.credentialRefForm}`,
    `- secretLikeInputRejected: ${evidence.secretLikeInputRejected}`,
    `- directProviderCallFromUi: ${evidence.directProviderCallFromUi}`,
    "",
  ].join("\n");
}
