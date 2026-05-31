import { PROVIDER_EXPANSION_ALLOWLIST } from "./userOwnedCredentialRefSetup.js";

export function buildSmokeApprovalSchema() {
  return {
    phase: "Phase787",
    schemaName: "phase781_800-smoke-approval.input.schema",
    decision: "approved_execute_bounded_model_smoke",
    allowlistedProviderFamilies: PROVIDER_EXPANSION_ALLOWLIST,
    smokePrompt: "Reply with exactly: MODEL_SMOKE_OK",
    requiredFields: [
      "decision",
      "providerId",
      "providerFamily",
      "credentialRef",
      "modelIds",
      "allowDiscoveryCall",
      "allowSmokeCall",
      "allowSecretRead",
      "allowDeploy",
      "allowChatMutation",
      "allowChatGatewayExecuteMutation",
      "maxSmokeRequests",
      "maxRetries",
      "maxEstimatedCostUsd",
      "expiresAt",
      "approvalOwner",
      "acknowledgements",
    ],
  };
}

export function validateSmokeApproval(packet = {}, now = new Date()) {
  const failures = [];
  if (packet.decision !== "approved_execute_bounded_model_smoke") failures.push("decision_not_smoke_approval");
  if (!PROVIDER_EXPANSION_ALLOWLIST.includes(packet.providerFamily)) failures.push("provider_family_not_allowlisted");
  if (!packet.credentialRef) failures.push("credential_ref_missing");
  if (!Array.isArray(packet.modelIds)) failures.push("modelIds_must_be_array");
  if (Array.isArray(packet.modelIds) && packet.modelIds.length > 5) failures.push("modelIds_exceeds_max_5");
  if (packet.allowDiscoveryCall !== false) failures.push("allowDiscoveryCall_must_be_false");
  if (packet.allowSmokeCall !== true) failures.push("allowSmokeCall_not_true");
  if (packet.allowSecretRead !== false) failures.push("allowSecretRead_must_be_false");
  if (packet.allowDeploy !== false) failures.push("allowDeploy_must_be_false");
  if (packet.allowChatMutation !== false) failures.push("allowChatMutation_must_be_false");
  if (packet.allowChatGatewayExecuteMutation !== false) failures.push("allowChatGatewayExecuteMutation_must_be_false");
  if (Number(packet.maxSmokeRequests) < 1 || Number(packet.maxSmokeRequests) > 5) failures.push("maxSmokeRequests_out_of_bounds");
  if (Number(packet.maxRetries) !== 0) failures.push("maxRetries_must_be_0");
  if (Number(packet.maxEstimatedCostUsd) !== 0) failures.push("maxEstimatedCostUsd_must_be_0");
  if (!packet.expiresAt || Number.isNaN(Date.parse(packet.expiresAt)) || new Date(packet.expiresAt) <= now) failures.push("approval_expired_or_invalid");
  if (packet.approvalOwner !== "human-user") failures.push("approvalOwner_must_be_human-user");
  for (const field of ["credentialRefOnly", "rawSecretMustNotBePrinted", "notSelectableChange", "smokeDoesNotMeanProductionReady", "evidenceRequired"]) {
    if (packet.acknowledgements?.[field] !== true) failures.push(`ack_missing_${field}`);
  }
  return {
    valid: failures.length === 0,
    failures,
  };
}
