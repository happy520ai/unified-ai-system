export const CAPABILITY_NEURON_SCHEMA_VERSION = "capability-neuron-manifest-v1";

export const capabilityTypes = Object.freeze([
  "context",
  "safety",
  "planning",
  "review",
  "codex",
  "evidence",
  "ui",
  "provider",
  "other",
]);

export const capabilityStatuses = Object.freeze([
  "draft",
  "dry_run_passed",
  "blocked",
  "approval_required",
  "registered_preview",
  "disabled",
]);

export function createSafetyBoundary(overrides = {}) {
  return {
    providerCallsAllowed: false,
    secretReadAllowed: false,
    deployAllowed: false,
    chatMutationAllowed: false,
    chatGatewayExecuteMutationAllowed: false,
    codexConfigMutationAllowed: false,
    selfApprovalAllowed: false,
    ...overrides,
  };
}

export function createRuntimePolicy(overrides = {}) {
  return {
    kind: "dry_run",
    spawnable: true,
    maxSpawnDepth: 1,
    ttlSeconds: 300,
    maxRequests: 3,
    maxTokenBudget: 4000,
    enabledByDefault: false,
    ...overrides,
  };
}

export function createCapabilityNeuronManifest(input = {}) {
  const capabilityId = normalizeCapabilityId(input.capabilityId || input.displayName || input.intakeText || "capability-neuron");
  const type = capabilityTypes.includes(input.type) ? input.type : "other";
  const status = capabilityStatuses.includes(input.status) ? input.status : "draft";

  return {
    schemaVersion: CAPABILITY_NEURON_SCHEMA_VERSION,
    capabilityId,
    displayName: input.displayName || toDisplayName(capabilityId),
    description: input.description || "Dry-run capability neuron manifest draft.",
    createdFromNaturalLanguage: input.createdFromNaturalLanguage !== false,
    intakeText: input.intakeText || "",
    type,
    status,
    runtime: createRuntimePolicy(input.runtime),
    safety: createSafetyBoundary(input.safety),
    inputs: input.inputs || {},
    outputs: input.outputs || {},
    evidence: {
      required: true,
      schema: "gateway-capability-evidence-v1",
      ...(input.evidence || {}),
    },
    approval: {
      requiredForRuntime: true,
      currentStatus: "draft",
      ...(input.approval || {}),
    },
    rollback: {
      disableFlag: `TAIJI_DISABLE_${capabilityId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
      deletePaths: [],
      ...(input.rollback || {}),
    },
    synapse: {
      pressureTypes: [],
      modes: [],
      dependencies: [],
      weight: 0.5,
      ...(input.synapse || {}),
    },
  };
}

export function validateCapabilityNeuronManifest(manifest) {
  const failures = [];
  if (!manifest || typeof manifest !== "object") failures.push("manifest_object_required");
  if (!manifest?.capabilityId) failures.push("capability_id_required");
  if (!capabilityTypes.includes(manifest?.type)) failures.push("type_invalid");
  if (!capabilityStatuses.includes(manifest?.status)) failures.push("status_invalid");
  if (manifest?.runtime?.kind !== "dry_run") failures.push("runtime_kind_must_be_dry_run");
  if (manifest?.runtime?.enabledByDefault !== false) failures.push("runtime_enabled_by_default_must_be_false");
  if (manifest?.runtime?.maxSpawnDepth !== 1) failures.push("max_spawn_depth_must_be_1");
  if (manifest?.approval?.requiredForRuntime !== true) failures.push("approval_required_for_runtime");
  if (manifest?.safety?.selfApprovalAllowed !== false) failures.push("self_approval_must_be_false");
  if (manifest?.safety?.providerCallsAllowed !== false) failures.push("provider_calls_must_be_false");
  if (manifest?.safety?.secretReadAllowed !== false) failures.push("secret_read_must_be_false");
  return {
    valid: failures.length === 0,
    failures,
  };
}

export function normalizeCapabilityId(value) {
  return String(value || "capability-neuron")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "capability-neuron";
}

function toDisplayName(capabilityId) {
  return capabilityId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
