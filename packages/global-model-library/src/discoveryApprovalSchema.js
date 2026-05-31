import { PROVIDER_EXPANSION_ALLOWLIST } from "./userOwnedCredentialRefSetup.js";

export function buildDiscoveryApprovalSchema() {
  return {
    phase: "Phase784",
    schemaName: "phase781_800-discovery-approval.input.schema",
    decision: "approved_execute_bounded_provider_discovery",
    allowlistedProviderFamilies: PROVIDER_EXPANSION_ALLOWLIST,
    requiredFields: [
      "decision",
      "providerId",
      "providerFamily",
      "credentialRef",
      "allowDiscoveryCall",
      "allowSmokeCall",
      "allowSecretRead",
      "allowDeploy",
      "allowChatMutation",
      "allowChatGatewayExecuteMutation",
      "maxDiscoveryRequests",
      "maxEstimatedCostUsd",
      "expiresAt",
      "approvalOwner",
      "acknowledgements",
    ],
    safetyDefaults: {
      allowSmokeCall: false,
      allowSecretRead: false,
      allowDeploy: false,
      allowChatMutation: false,
      allowChatGatewayExecuteMutation: false,
      maxDiscoveryRequests: 3,
      maxEstimatedCostUsd: 0,
    },
  };
}

export function validateDiscoveryApproval(packet = {}, now = new Date()) {
  const failures = [];
  if (packet.decision !== "approved_execute_bounded_provider_discovery") failures.push("decision_not_discovery_approval");
  if (!PROVIDER_EXPANSION_ALLOWLIST.includes(packet.providerFamily)) failures.push("provider_family_not_allowlisted");
  if (!packet.credentialRef) failures.push("credential_ref_missing");
  if (packet.allowDiscoveryCall !== true) failures.push("allowDiscoveryCall_not_true");
  if (packet.allowSmokeCall !== false) failures.push("allowSmokeCall_must_be_false");
  if (packet.allowSecretRead !== false) failures.push("allowSecretRead_must_be_false");
  if (packet.allowDeploy !== false) failures.push("allowDeploy_must_be_false");
  if (packet.allowChatMutation !== false) failures.push("allowChatMutation_must_be_false");
  if (packet.allowChatGatewayExecuteMutation !== false) failures.push("allowChatGatewayExecuteMutation_must_be_false");
  if (Number(packet.maxDiscoveryRequests) < 1 || Number(packet.maxDiscoveryRequests) > 3) failures.push("maxDiscoveryRequests_out_of_bounds");
  if (Number(packet.maxEstimatedCostUsd) !== 0) failures.push("maxEstimatedCostUsd_must_be_0");
  if (!packet.expiresAt || Number.isNaN(Date.parse(packet.expiresAt)) || new Date(packet.expiresAt) <= now) failures.push("approval_expired_or_invalid");
  if (packet.approvalOwner !== "human-user") failures.push("approvalOwner_must_be_human-user");
  for (const field of ["credentialRefOnly", "rawSecretMustNotBePrinted", "notSelectableChange", "evidenceRequired"]) {
    if (packet.acknowledgements?.[field] !== true) failures.push(`ack_missing_${field}`);
  }
  return {
    valid: failures.length === 0,
    failures,
  };
}
