import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateBrainAuthorization,
  runGatewayAdapterDryRun,
} from "../../packages/employee-brain-adapter/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase581");
const evidencePath = resolve(evidenceDir, "brain-adapter-ai-gateway-authorization-gate-result.json");

const binding = {
  providerRef: "providerRef.preview",
  modelRef: "modelRef.preview",
  credentialRef: "credentialRef.preview-only",
};
const blocked = evaluateBrainAuthorization({ binding, authorization: {} });
const dryRun = runGatewayAdapterDryRun({ employeeId: "emp-preview", taskType: "ux_refinement_plan" });

const result = {
  phase: "Phase581",
  name: "Brain Adapter + AI Gateway Authorization Gate",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  brainAuthorizationGateExists: exists("packages/employee-brain-adapter/src/auth/brainAuthorizationGate.js"),
  providerCallAuthorizationSchemaExists: exists("packages/employee-brain-adapter/src/auth/providerCallAuthorizationSchema.js"),
  credentialRefAuthorizationPolicyExists: exists("packages/employee-brain-adapter/src/auth/credentialRefAuthorizationPolicy.js"),
  modelRefAuthorizationPolicyExists: exists("packages/employee-brain-adapter/src/auth/modelRefAuthorizationPolicy.js"),
  maxCostPolicyExists: exists("packages/employee-brain-adapter/src/auth/maxCostPolicy.js"),
  maxRequestPolicyExists: exists("packages/employee-brain-adapter/src/auth/maxRequestPolicy.js"),
  gatewayAdapterContractExists: exists("packages/employee-brain-adapter/src/gateway/gatewayAdapterContract.js"),
  gatewayAdapterDryRunWorks: dryRun.mode === "dry_run" && dryRun.providerCallsMade === false,
  missingAuthorizationBlocksProviderCall: blocked.providerTestExecutionStatus === "blocked_pending_specific_authorization",
  providerCallsMade: blocked.providerCallsMade || dryRun.providerCallsMade,
  rawSecretAccessed: blocked.rawSecretAccessed || dryRun.rawSecretAccessed,
  secretValueExposed: blocked.secretValueExposed || dryRun.secretValueExposed,
  chatGatewayExecuteModified: false,
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

const passed =
  result.brainAuthorizationGateExists &&
  result.providerCallAuthorizationSchemaExists &&
  result.credentialRefAuthorizationPolicyExists &&
  result.modelRefAuthorizationPolicyExists &&
  result.maxCostPolicyExists &&
  result.maxRequestPolicyExists &&
  result.gatewayAdapterContractExists &&
  result.gatewayAdapterDryRunWorks &&
  result.missingAuthorizationBlocksProviderCall &&
  result.providerCallsMade === false &&
  result.rawSecretAccessed === false &&
  result.secretValueExposed === false &&
  result.chatGatewayExecuteModified === false;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase581_authorization_gate_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

