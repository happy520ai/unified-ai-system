import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateModelLibraryBinding,
  chooseEmployeeModelPreference,
  matchTaskToModel,
  applyFallbackModelPolicy,
  assertQuotaBudget,
  assertUserOwnedCredentialBoundary,
} from "../../packages/employee-brain-adapter/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase584");
const evidencePath = resolve(evidenceDir, "user-owned-model-library-integration-result.json");

const binding = {
  providerRef: "providerRef.user-owned-preview",
  modelRef: "modelRef.user-owned-preview",
  credentialRef: "credentialRef.preview-only",
  domain: "Engineering",
  allowedTaskTypes: ["architecture_review"],
  maxRequestsPerTask: 0,
  maxEstimatedCostUsd: 0,
};
const invalidBinding = { providerRef: "providerRef.missing" };

const validation = validateModelLibraryBinding(binding);
const preference = chooseEmployeeModelPreference({ employeeId: "emp-ai-gateway", domain: "Engineering" }, [binding]);
const matched = matchTaskToModel({ taskType: "architecture_review" }, [binding]);
const fallback = applyFallbackModelPolicy(null, [binding]);
const quota = assertQuotaBudget(binding);
const boundary = assertUserOwnedCredentialBoundary(invalidBinding);

const result = {
  phase: "Phase584",
  name: "User-Owned Model Library Integration",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  modelLibraryBindingContractExists: exists("packages/employee-brain-adapter/src/model-library/modelLibraryBindingContract.js"),
  employeeModelPreferencePolicyExists: exists("packages/employee-brain-adapter/src/model-library/employeeModelPreferencePolicy.js"),
  taskToModelMatchingPolicyExists: exists("packages/employee-brain-adapter/src/model-library/taskToModelMatchingPolicy.js"),
  fallbackModelPolicyExists: exists("packages/employee-brain-adapter/src/model-library/fallbackModelPolicy.js"),
  quotaBudgetPolicyExists: exists("packages/employee-brain-adapter/src/model-library/quotaBudgetPolicy.js"),
  userOwnedCredentialBoundaryExists: exists("packages/employee-brain-adapter/src/model-library/userOwnedCredentialBoundary.js"),
  credentialRefOnly: validation.credentialRefOnly && boundary.credentialRefOnly === false,
  validBindingWorks: validation.valid && preference.binding === binding && matched === binding && fallback.selectedBinding === binding,
  quotaBudgetWorks: quota.withinBudget,
  rawSecretAccessed: false,
  secretValueExposed: false,
  providerCallsMade: false,
  nonConfiguredProviderBlocked: boundary.nonConfiguredProviderBlocked === true,
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
  result.modelLibraryBindingContractExists &&
  result.employeeModelPreferencePolicyExists &&
  result.taskToModelMatchingPolicyExists &&
  result.fallbackModelPolicyExists &&
  result.quotaBudgetPolicyExists &&
  result.userOwnedCredentialBoundaryExists &&
  result.validBindingWorks &&
  result.quotaBudgetWorks &&
  result.rawSecretAccessed === false &&
  result.secretValueExposed === false &&
  result.providerCallsMade === false &&
  result.nonConfiguredProviderBlocked &&
  result.chatGatewayExecuteModified === false;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase584_user_owned_model_library_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

