export const SAFETY_COST_SOURCES_SCHEMA_VERSION = "phase1206.safety-cost-sources.v1";

export const requiredSafetyBlockIds = [
  "unauthorized_provider_call",
  "secret_read_requested",
  "chat_gateway_execute_integration_requested",
  "deploy_requested",
  "real_semantic_claim_requested",
];

export function buildSafetyCostSources(input = {}) {
  const blockedReasons = new Set(input.readout?.blockedCandidates?.map((candidate) => candidate.reason) || []);
  for (const reason of requiredSafetyBlockIds) blockedReasons.add(reason);

  return {
    schemaVersion: SAFETY_COST_SOURCES_SCHEMA_VERSION,
    phase: "Phase1206",
    verificationMode: "synthetic-dry-run",
    safetyNegativeSources: [...blockedReasons].map((reason) => source(reason, "safety_negative_source")),
    forbiddenCapabilitySources: [
      source("runtime_worker_creation_requested", "forbidden_capability_source"),
      source("provider_trigger_button_requested", "forbidden_capability_source"),
      source("main_chain_default_enable_requested", "forbidden_capability_source"),
    ],
    costConstraintSources: [
      source("free_api_budget_preserved", "cost_constraint_source"),
      source("batch_embedding_training_blocked", "cost_constraint_source"),
      source("provider_retry_limit_zero_for_dry_run", "cost_constraint_source"),
    ],
    providerBoundarySources: [
      source("openai_blocked_by_default", "provider_boundary_source"),
      source("claude_blocked_by_default", "provider_boundary_source"),
      source("openrouter_blocked_by_default", "provider_boundary_source"),
      source("mimo_blocked_by_default", "provider_boundary_source"),
      source("volcengine_blocked_by_default", "provider_boundary_source"),
      source("nvidia_blocked_by_default", "provider_boundary_source"),
    ],
    secretBoundarySources: [
      source("api_key_read_blocked", "secret_boundary_source"),
      source("token_read_blocked", "secret_boundary_source"),
      source("auth_json_read_blocked", "secret_boundary_source"),
    ],
    deploymentBoundarySources: [
      source("deploy_blocked", "deployment_boundary_source"),
      source("release_blocked", "deployment_boundary_source"),
      source("tag_blocked", "deployment_boundary_source"),
      source("artifact_upload_blocked", "deployment_boundary_source"),
    ],
    blockedRequestMatrix: requiredSafetyBlockIds.map((id) => ({
      id,
      blocked: true,
      completionVerified: true,
      providerCalled: false,
      reason: "blocked_by_phase1206_synthetic_negative_source",
    })),
    trace: {
      syntheticOnly: true,
      evidenceRef: "apps/ai-gateway-service/evidence/phase1206-safety-cost-sources/safety-cost-sources-result.json",
    },
  };
}

export function validateSafetyCostSources(sources) {
  const errors = [];
  if (sources?.schemaVersion !== SAFETY_COST_SOURCES_SCHEMA_VERSION) errors.push("schemaVersion_invalid");
  if (sources?.phase !== "Phase1206") errors.push("phase_invalid");
  for (const field of ["safetyNegativeSources", "forbiddenCapabilitySources", "costConstraintSources", "providerBoundarySources", "secretBoundarySources", "deploymentBoundarySources"]) {
    if (!Array.isArray(sources?.[field]) || sources[field].length === 0) errors.push(`${field}_missing`);
  }
  const blockText = JSON.stringify(sources || {});
  for (const id of requiredSafetyBlockIds) {
    if (!blockText.includes(id)) errors.push(`${id}_missing`);
  }
  if (sources?.trace?.syntheticOnly !== true) errors.push("syntheticOnly_not_true");
  return {
    valid: errors.length === 0,
    errors,
  };
}

function source(id, sourceType) {
  return {
    id,
    sourceType,
    blocksRuntime: true,
    providerCalled: false,
    secretRead: false,
    dryRunOnly: true,
  };
}
