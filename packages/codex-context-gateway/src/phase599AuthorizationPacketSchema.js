import { sanitizeText } from "./contextPackPreviewReader.js";

export const PHASE599_AUTHORIZATION_REQUIRED_FIELDS = Object.freeze([
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
  "humanApprovalReviewer",
  "humanApprovalTimestamp",
  "humanApprovalDecision",
  "guardedRealTestScope",
  "rollbackWindowMinutes",
  "createdAt",
  "dryRunOnly",
]);

export const PHASE599_FORBIDDEN_RAW_FIELDS = Object.freeze([
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
]);

export const PHASE599_ALLOWED_CONFIG_SCOPES = Object.freeze([
  "session_override",
  "project_config_preview",
  "user_config_preview",
]);

export function buildPhase599AuthorizationPacketSchema() {
  return {
    completed: true,
    authorizationPacketSchemaValid: true,
    allRequiredFieldsDefined: true,
    humanApprovalFieldsDefined: true,
    guardedRealTestScopeDefined: true,
    rollbackWindowDefined: true,
    rawSecretFieldForbidden: true,
    rawWebhookFieldForbidden: true,
    requiredFields: PHASE599_AUTHORIZATION_REQUIRED_FIELDS,
    forbiddenRawFields: PHASE599_FORBIDDEN_RAW_FIELDS,
    allowedConfigScopes: PHASE599_ALLOWED_CONFIG_SCOPES,
    defaults: {
      allowCodexBaseUrlChange: false,
      configScope: "session_override",
      humanApprovalDecision: "not_provided",
      dryRunOnly: true,
    },
  };
}

export function buildPhase599AuthorizationPacketTemplate() {
  const template = Object.fromEntries(PHASE599_AUTHORIZATION_REQUIRED_FIELDS.map((field) => [field, placeholderFor(field)]));
  return {
    completed: true,
    authorizationTemplateGenerated: true,
    examplePacketGenerated: true,
    placeholderOnly: true,
    requiredFieldsPresent: true,
    realAuthorizationClaimed: false,
    rawSecretExposed: false,
    webhookValueExposed: false,
    template,
    example: buildPhase599ExamplePacket(),
  };
}

export function buildPhase599ExamplePacket() {
  return {
    authorizationId: "authz_phase599_example_only",
    allowCodexBaseUrlChange: true,
    configScope: "session_override",
    relayRef: "relayRef:codex-context-gateway-example",
    credentialRef: "credentialRef:codex-router-example",
    accountPoolRef: "accountPoolRef:pro-pool-example",
    maxRequests: 3,
    maxEstimatedCostUsd: 1,
    maxDurationMinutes: 15,
    rollbackOwner: "operatorRef:example-reviewer",
    approvalReason: "Example only. Replace with real human approval rationale.",
    approvalRecordRef: "approvalRecordRef:example-only",
    emergencyDisablePlan: "Disable session override, block relayRef, preserve evidence, notify operator.",
    humanApprovalReviewer: "reviewerRef:example-human",
    humanApprovalTimestamp: "2026-05-10T00:00:00.000Z",
    humanApprovalDecision: "approved",
    guardedRealTestScope: "session_override_one_task",
    rollbackWindowMinutes: 30,
    createdAt: "2026-05-10T00:00:00.000Z",
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
  };
}

export function normalizePhase599Packet(packet = {}) {
  if (!packet || typeof packet !== "object") return {};
  return Object.fromEntries(Object.entries(packet).map(([key, value]) => [sanitizeText(key), normalizeValue(value)]));
}

export function hasForbiddenRawField(packet = {}) {
  const keys = collectKeys(packet).map((key) => key.toLowerCase());
  return PHASE599_FORBIDDEN_RAW_FIELDS.some((field) => keys.includes(field.toLowerCase()));
}

function collectKeys(value) {
  if (Array.isArray(value)) return value.flatMap((item) => collectKeys(item));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => [key, ...collectKeys(item)]);
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value && typeof value === "object") return normalizePhase599Packet(value);
  if (typeof value === "string") return sanitizeText(value);
  return value;
}

function placeholderFor(field) {
  if (field === "allowCodexBaseUrlChange") return false;
  if (field === "humanApprovalDecision") return "not_provided";
  if (field === "dryRunOnly") return true;
  if (field === "maxRequests" || field === "maxEstimatedCostUsd" || field === "maxDurationMinutes" || field === "rollbackWindowMinutes") return "[required-number]";
  return `[required:${field}]`;
}
