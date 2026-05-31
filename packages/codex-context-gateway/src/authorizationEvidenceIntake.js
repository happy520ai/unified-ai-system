import { sanitizeText } from "./contextPackPreviewReader.js";

export const AUTHORIZATION_REQUIRED_FIELDS = Object.freeze([
  "allowCodexBaseUrlChange",
  "configScope",
  "relayRef",
  "credentialRef",
  "accountPoolRef",
  "maxRequests",
  "maxEstimatedCostUsd",
  "maxDurationMinutes",
  "rollbackOwner",
  "approvalReason",
  "approvalRecordRef",
  "emergencyDisablePlan",
]);

export function buildAuthorizationEvidenceIntake(input = {}) {
  const source = normalizeAuthorizationSource(input);
  const providedFields = Object.fromEntries(
    AUTHORIZATION_REQUIRED_FIELDS.map((field) => [field, normalizeValue(source[field])]),
  );
  const missingFields = AUTHORIZATION_REQUIRED_FIELDS.filter((field) => isMissingField(source[field]));
  const authorizationComplete = missingFields.length === 0;
  return {
    completed: true,
    authorizationEvidenceSchemaValid: true,
    authorizationId: sanitizeText(input.authorizationId || "phase598-authorization-evidence-intake"),
    createdAt: sanitizeText(input.createdAt || new Date().toISOString()),
    dryRunOnly: true,
    requiredFields: AUTHORIZATION_REQUIRED_FIELDS,
    providedFields,
    templateFields: buildTemplateFields(),
    missingFields,
    authorizationComplete,
    allowCodexBaseUrlChangeRequired: true,
    configScopeRequired: true,
    relayRefRequired: true,
    credentialRefRequired: true,
    maxRequestsRequired: true,
    maxEstimatedCostUsdRequired: true,
    maxDurationMinutesRequired: true,
    rollbackOwnerRequired: true,
    approvalReasonRequired: true,
    approvalRecordRequired: true,
    emergencyDisablePlanRequired: true,
    dryRunConfigSimulationAllowed: true,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    providerCallsMade: false,
    realIntegrationStatus: authorizationComplete ? "authorized_preview_only" : "blocked_pending_specific_authorization",
    notes: authorizationComplete
      ? [
          "All required authorization fields were supplied for dry-run simulation.",
          "Real Codex config writes remain blocked in this phase.",
        ]
      : [
          "Authorization is incomplete.",
          "Dry-run simulation is still allowed, but real integration remains blocked.",
        ],
  };
}

export function buildAuthorizationEvidenceTemplate() {
  return {
    completed: true,
    authorizationTemplateGenerated: true,
    requiredFieldsPresent: true,
    placeholderOnly: true,
    authorizationId: "phase598-authorization-evidence-template",
    createdAt: new Date().toISOString(),
    dryRunOnly: true,
    requiredFields: AUTHORIZATION_REQUIRED_FIELDS,
    templateFields: buildTemplateFields(),
    rawSecretExposed: false,
    webhookValueExposed: false,
    realAuthorizationClaimed: false,
  };
}

function buildTemplateFields() {
  return Object.fromEntries(AUTHORIZATION_REQUIRED_FIELDS.map((field) => [field, "[required]"]));
}

function normalizeAuthorizationSource(input) {
  if (input && typeof input.authorization === "object" && input.authorization !== null) return input.authorization;
  if (input && typeof input.values === "object" && input.values !== null) return input.values;
  return input || {};
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [sanitizeText(key), normalizeValue(item)]));
  }
  if (typeof value === "string") return sanitizeText(value);
  return value;
}

function isMissingField(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "";
}
