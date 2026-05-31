import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasSensitiveValue, resolveRepoRoot, sanitizeValue } from "./contextPackPreviewReader.js";

export const phase602FinalConfirmationInputPath = "docs/phase602-final-execution-confirmation.input.json";

export function buildPhase602FinalConfirmationExample() {
  return {
    completed: true,
    finalConfirmationExampleGenerated: true,
    placeholderOnly: true,
    rawSecretExposed: false,
    rawWebhookExposed: false,
    example: {
      confirmationId: "confirm-phase602-one-shot-guarded-base-url-test-001",
      confirmedBy: "user-owner",
      decision: "approved_execute_one_shot_guarded_real_base_url_test",
      configScope: "session_override",
      maxRequests: 1,
      maxEstimatedCostUsd: 1,
      maxDurationMinutes: 10,
      providerCallAllowedForOneShot: true,
      persistentConfigWriteAllowed: false,
      projectConfigWriteAllowed: false,
      userConfigWriteAllowed: false,
      relayStartAllowed: false,
      useExistingRelayOnly: true,
      rollbackRequiredAfterTest: true,
      emergencyDisableRequired: true,
      approvalReason:
        "Approve one-shot guarded real base_url test using session_override only. No persistent config write, no deploy, no production rollout.",
      createdAt: "<ISO timestamp>",
    },
  };
}

export function loadPhase602FinalConfirmation(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const inputPath = options.inputPath || phase602FinalConfirmationInputPath;
  const absolutePath = resolve(repoRoot, inputPath);
  if (!existsSync(absolutePath)) {
    return {
      completed: true,
      finalConfirmationLoaderWorks: true,
      finalConfirmationExists: false,
      inputPath,
      missingConfirmationBlocks: true,
      blocker: "final_user_confirmation_missing",
      confirmationSchemaValidWhenProvided: true,
      providerCallAllowedForOneShotRequired: true,
      maxRequestsOneRequired: true,
      persistentConfigWriteForbidden: true,
      finalConfirmationApproved: false,
      missingFields: [],
      validationErrors: [],
      rawSecretAccessed: false,
      secretValueExposed: false,
      rawWebhookAccessed: false,
      webhookValueExposed: false,
    };
  }

  let packet = null;
  const validationErrors = [];
  try {
    packet = sanitizeValue(JSON.parse(readFileSync(absolutePath, "utf8")));
  } catch (error) {
    validationErrors.push(`invalid_json:${error.message}`);
  }

  const missingFields = requiredFields.filter((field) => !Object.prototype.hasOwnProperty.call(packet || {}, field));
  const forbiddenSensitiveValue = hasSensitiveValue(packet);
  if (forbiddenSensitiveValue) validationErrors.push("sensitive_value_detected");
  if (packet?.decision !== "approved_execute_one_shot_guarded_real_base_url_test") validationErrors.push("decision_not_one_shot_approval");
  if (packet?.configScope !== "session_override") validationErrors.push("config_scope_not_session_override");
  if (packet?.maxRequests !== 1) validationErrors.push("max_requests_not_one");
  if (packet?.providerCallAllowedForOneShot !== true) validationErrors.push("provider_call_not_authorized_for_one_shot");
  if (packet?.persistentConfigWriteAllowed !== false) validationErrors.push("persistent_config_write_not_forbidden");
  if (packet?.projectConfigWriteAllowed !== false) validationErrors.push("project_config_write_not_forbidden");
  if (packet?.userConfigWriteAllowed !== false) validationErrors.push("user_config_write_not_forbidden");
  if (packet?.relayStartAllowed !== false) validationErrors.push("relay_start_not_forbidden");
  if (packet?.useExistingRelayOnly !== true) validationErrors.push("existing_relay_only_not_required");
  if (packet?.rollbackRequiredAfterTest !== true) validationErrors.push("rollback_not_required");
  if (packet?.emergencyDisableRequired !== true) validationErrors.push("emergency_disable_not_required");

  const valid = missingFields.length === 0 && validationErrors.length === 0;
  return {
    completed: true,
    finalConfirmationLoaderWorks: true,
    finalConfirmationExists: true,
    inputPath,
    missingConfirmationBlocks: false,
    blocker: valid ? null : validationErrors.includes("provider_call_not_authorized_for_one_shot") ? "provider_call_not_authorized_for_one_shot" : "final_confirmation_invalid",
    confirmationSchemaValidWhenProvided: valid,
    providerCallAllowedForOneShotRequired: packet?.providerCallAllowedForOneShot === true,
    maxRequestsOneRequired: packet?.maxRequests === 1,
    persistentConfigWriteForbidden:
      packet?.persistentConfigWriteAllowed === false &&
      packet?.projectConfigWriteAllowed === false &&
      packet?.userConfigWriteAllowed === false,
    finalConfirmationApproved: valid,
    confirmation: valid ? packet : null,
    missingFields,
    validationErrors,
    rawSecretAccessed: false,
    secretValueExposed: forbiddenSensitiveValue,
    rawWebhookAccessed: false,
    webhookValueExposed: forbiddenSensitiveValue && /webhook/i.test(JSON.stringify(packet || {})),
  };
}

const requiredFields = Object.freeze([
  "confirmationId",
  "confirmedBy",
  "decision",
  "configScope",
  "maxRequests",
  "maxEstimatedCostUsd",
  "maxDurationMinutes",
  "providerCallAllowedForOneShot",
  "persistentConfigWriteAllowed",
  "projectConfigWriteAllowed",
  "userConfigWriteAllowed",
  "relayStartAllowed",
  "useExistingRelayOnly",
  "rollbackRequiredAfterTest",
  "emergencyDisableRequired",
  "approvalReason",
  "createdAt",
]);
