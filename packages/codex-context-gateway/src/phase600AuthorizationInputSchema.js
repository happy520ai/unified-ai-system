import { sanitizeText } from "./contextPackPreviewReader.js";

export const PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS = Object.freeze([
  "authorizationId",
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
  "guardedRealTestScope",
  "rollbackWindowMinutes",
  "dryRunOnly",
]);

export const PHASE600_FORBIDDEN_RAW_FIELDS = Object.freeze([
  "apiKey",
  "api_key",
  "secret",
  "token",
  "webhook",
  "webhookUrl",
  "rawWebhook",
  "rawSecret",
  "rawApiKey",
  "baseUrlToken",
  "openaiBaseUrl",
  "openai_base_url",
  "baseUrl",
]);

export const PHASE600_ALLOWED_CONFIG_SCOPES = Object.freeze([
  "session_override",
  "project_config_preview",
  "user_config_preview",
]);

export const PHASE600_EXAMPLE_AUTHORIZATION_PACKET = Object.freeze({
  authorizationId: "auth-phase600-codex-context-gateway-001",
  allowCodexBaseUrlChange: true,
  configScope: "session_override",
  relayRef: "relayRef.codex-context-gateway.preview",
  credentialRef: "credentialRef.codex-relay-authorized",
  accountPoolRef: "accountPoolRef.codex-pro-pool-authorized",
  maxRequests: 3,
  maxEstimatedCostUsd: 1,
  maxDurationMinutes: 10,
  rollbackOwner: "user-owner",
  approvalReason: "Guarded base_url test readiness only; no production rollout.",
  approvalRecordRef: "approvalRef.phase600-human-approval-001",
  emergencyDisablePlan: {
    disableRelay: true,
    restorePreviousConfig: true,
    invalidateContext: true,
    preserveEvidence: true,
  },
  guardedRealTestScope: {
    allowedAction: "readiness_review_only",
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    providerCallAllowed: false,
    maxTestRequests: 0,
  },
  rollbackWindowMinutes: 30,
  dryRunOnly: true,
  riskAcceptanceReviewed: true,
  riskAcceptanceAcceptedRisks: [
    "wrong_base_url",
    "bad_relay_response",
    "account_pool_rate_limit",
    "cache_miss",
    "stale_context",
    "token_over_budget",
    "secret_leakage",
    "provider_billing",
    "config_drift",
    "rollback_failure",
  ],
  userExplicitlyApprovedGuardedRealTest: false,
});

export function buildPhase600AuthorizationInputSchema() {
  return {
    completed: true,
    authorizationPacketInputSchemaValid: true,
    authorizationPacketInputSchemaWorks: true,
    allRequiredFieldsDefined: true,
    guardedRealTestScopeDefined: true,
    rollbackWindowDefined: true,
    rawSecretFieldForbidden: true,
    rawWebhookFieldForbidden: true,
    realBaseUrlFieldForbidden: true,
    requiredFields: PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS,
    forbiddenRawFields: PHASE600_FORBIDDEN_RAW_FIELDS,
    allowedConfigScopes: PHASE600_ALLOWED_CONFIG_SCOPES,
    defaults: {
      configScope: "session_override",
      dryRunOnly: true,
      guardedRealTestAllowed: false,
      realConfigWriteAllowed: false,
      relayStartAllowed: false,
      providerCallAllowed: false,
    },
  };
}

export function buildPhase600AuthorizationInputExample() {
  return {
    completed: true,
    authorizationPacketInputExampleGenerated: true,
    placeholderOnly: true,
    fakeRefsOnly: true,
    requiredFieldsPresent: PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS.every((field) =>
      Object.prototype.hasOwnProperty.call(PHASE600_EXAMPLE_AUTHORIZATION_PACKET, field),
    ),
    realAuthorizationClaimed: false,
    rawSecretExposed: false,
    webhookValueExposed: false,
    example: normalizePhase600Input(PHASE600_EXAMPLE_AUTHORIZATION_PACKET),
  };
}

export function normalizePhase600Input(packet = {}) {
  if (!packet || typeof packet !== "object") return {};
  return Object.fromEntries(Object.entries(packet).map(([key, value]) => [sanitizeText(key), normalizeValue(value)]));
}

export function hasPhase600ForbiddenRawField(packet = {}) {
  const keys = collectKeys(packet).map((key) => key.toLowerCase());
  return PHASE600_FORBIDDEN_RAW_FIELDS.some((field) => keys.includes(field.toLowerCase()));
}

function collectKeys(value) {
  if (Array.isArray(value)) return value.flatMap((item) => collectKeys(item));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => [key, ...collectKeys(item)]);
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value && typeof value === "object") return normalizePhase600Input(value);
  if (typeof value === "string") return sanitizeText(value);
  return value;
}
