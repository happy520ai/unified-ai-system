import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProviderCallAuthorization } from "../../packages/employee-brain-adapter/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase585");
const evidencePath = resolve(evidenceDir, "guarded-real-provider-workforce-test-authorization-gate-result.json");

const missing = validateProviderCallAuthorization({});
const partial = validateProviderCallAuthorization({
  allowProviderCall: true,
  allowedProviderRefs: ["providerRef.preview"],
});

const result = {
  phase: "Phase585",
  name: "Guarded Real Provider Workforce Test Authorization Gate",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  authorizationGateExists: exists("packages/employee-brain-adapter/src/auth/brainAuthorizationGate.js"),
  requiredFieldsDefined: exists("packages/employee-brain-adapter/src/auth/providerCallAuthorizationSchema.js"),
  missingAuthorizationBlocks: missing.valid === false,
  partialAuthorizationBlocks: partial.valid === false,
  maxRequestsRequired: missing.missing.includes("maxRequests"),
  maxEstimatedCostUsdRequired: missing.missing.includes("maxEstimatedCostUsd"),
  fanoutLimitRequired: missing.missing.includes("fanoutLimit"),
  providerTestExecutionStatus: "blocked_pending_specific_authorization",
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  deployExecuted: false,
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

const passed =
  result.authorizationGateExists &&
  result.requiredFieldsDefined &&
  result.missingAuthorizationBlocks &&
  result.partialAuthorizationBlocks &&
  result.maxRequestsRequired &&
  result.maxEstimatedCostUsdRequired &&
  result.fanoutLimitRequired &&
  result.providerCallsMade === false &&
  result.rawSecretAccessed === false &&
  result.secretValueExposed === false &&
  result.deployExecuted === false;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase585_authorization_gate_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

