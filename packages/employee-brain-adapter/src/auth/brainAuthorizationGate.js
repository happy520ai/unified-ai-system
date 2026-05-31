import { validateProviderCallAuthorization } from "./providerCallAuthorizationSchema.js";
import { authorizeCredentialRef } from "./credentialRefAuthorizationPolicy.js";
import { authorizeModelRef } from "./modelRefAuthorizationPolicy.js";
import { validateMaxCostPolicy } from "./maxCostPolicy.js";
import { validateMaxRequestPolicy } from "./maxRequestPolicy.js";

export function evaluateBrainAuthorization({ binding = {}, authorization = {} } = {}) {
  const schema = validateProviderCallAuthorization(authorization);
  const credential = authorizeCredentialRef(binding.credentialRef, authorization);
  const model = authorizeModelRef(binding.modelRef, authorization);
  const cost = validateMaxCostPolicy(authorization);
  const requests = validateMaxRequestPolicy(authorization);
  const fanoutValid = Number.isInteger(Number(authorization.fanoutLimit)) && Number(authorization.fanoutLimit) > 0 && Number(authorization.fanoutLimit) <= 3;
  const providerAllowed = Array.isArray(authorization.allowedProviderRefs) && authorization.allowedProviderRefs.includes(binding.providerRef);
  const allowed = schema.valid && credential.allowed && model.allowed && cost.valid && requests.valid && fanoutValid && providerAllowed;
  return {
    allowed,
    providerTestExecutionStatus: allowed ? "authorized_not_executed_in_phase581" : "blocked_pending_specific_authorization",
    missingAuthorizationBlocksProviderCall: !allowed,
    approvalRequiredForRealProviderCall: true,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    checks: { schema, credential, model, cost, requests, fanoutValid, providerAllowed },
  };
}

