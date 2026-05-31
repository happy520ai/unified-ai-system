import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasSensitiveValue, resolveRepoRoot, sanitizeValue } from "./contextPackPreviewReader.js";

export const phase604FinalConfirmationInputPath = "docs/phase604-final-execution-confirmation.input.json";

export function buildPhase604FinalConfirmationExample() {
  return {
    completed: true,
    finalConfirmationExampleGenerated: true,
    placeholderOnly: true,
    rawSecretExposed: false,
    rawWebhookExposed: false,
    example: {
      confirmationId: "confirm-phase604-custom-model-provider-one-shot-001",
      confirmedBy: "user-owner",
      decision: "approved_execute_custom_model_provider_guarded_one_shot_test",
      configRoute: "model_provider",
      preferredProviderId: "crs",
      fallbackProviderId: "pme_context_gateway",
      maxRequests: 1,
      retryLimit: 0,
      maxDurationMinutes: 10,
      providerCallAllowedForOneShot: true,
      authJsonAccessAllowed: false,
      persistentUserConfigWriteAllowed: false,
      persistentProjectConfigWriteAllowed: false,
      temporaryProjectConfigAllowed: false,
      rollbackRequiredAfterTest: true,
      approvalReason:
        "Approve one-shot custom model_provider route test. No auth.json access, no persistent config write, no production rollout.",
      createdAt: "<ISO timestamp>",
    },
  };
}

export function loadPhase604FinalConfirmation(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const inputPath = options.inputPath || phase604FinalConfirmationInputPath;
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
      finalConfirmationApproved: false,
      providerCallAllowedForOneShotRequired: true,
      maxRequestsOneRequired: true,
      retryLimitZeroRequired: true,
      authJsonAccessForbidden: true,
      persistentConfigWriteForbidden: true,
      temporaryProjectConfigForbidden: true,
      placeholderDetected: false,
      missingFields: [],
      validationErrors: [],
      rawSecretAccessed: false,
      secretValueExposed: false,
      rawWebhookAccessed: false,
      webhookValueExposed: false,
      authJsonRead: false,
      authJsonTouched: false,
      bomStripped: false,
      parseErrorReason: null,
    };
  }

  let packet = null;
  let bomStripped = false;
  let parseErrorReason = null;
  const validationErrors = [];
  try {
    const rawText = readFileSync(absolutePath, "utf8");
    const text = rawText.replace(/^\uFEFF/, "");
    bomStripped = rawText !== text;
    packet = sanitizeValue(JSON.parse(text));
  } catch (error) {
    parseErrorReason = error instanceof Error ? error.message : String(error);
    validationErrors.push(`invalid_json:${parseErrorReason}`);
  }

  const missingFields = packet
    ? requiredFields.filter((field) => !Object.prototype.hasOwnProperty.call(packet, field))
    : [];
  const forbiddenSensitiveValue = packet ? hasSensitiveValue(packet) : false;
  const placeholderDetected = packet ? JSON.stringify(packet).includes("<ISO timestamp>") : false;
  if (packet) {
    if (forbiddenSensitiveValue) validationErrors.push("sensitive_value_detected");
    if (placeholderDetected) validationErrors.push("placeholder_confirmation_not_allowed");
    if (packet.decision !== "approved_execute_custom_model_provider_guarded_one_shot_test") validationErrors.push("decision_not_phase604_approval");
    if (packet.configRoute !== "model_provider") validationErrors.push("config_route_not_model_provider");
    if (!packet.preferredProviderId) validationErrors.push("preferred_provider_missing");
    if (!packet.fallbackProviderId) validationErrors.push("fallback_provider_missing");
    if (packet.maxRequests !== 1) validationErrors.push("max_requests_not_one");
    if (packet.retryLimit !== 0) validationErrors.push("retry_limit_not_zero");
    if (Number(packet.maxDurationMinutes) > 10) validationErrors.push("max_duration_too_large");
    if (packet.providerCallAllowedForOneShot !== true) validationErrors.push("provider_call_not_authorized_for_one_shot");
    if (packet.authJsonAccessAllowed !== false) validationErrors.push("auth_json_access_not_forbidden");
    if (packet.persistentUserConfigWriteAllowed !== false) validationErrors.push("persistent_user_config_write_not_forbidden");
    if (packet.persistentProjectConfigWriteAllowed !== false) validationErrors.push("persistent_project_config_write_not_forbidden");
    if (packet.temporaryProjectConfigAllowed !== false) validationErrors.push("temporary_project_config_not_forbidden");
    if (packet.rollbackRequiredAfterTest !== true) validationErrors.push("rollback_not_required");
  }

  const valid = missingFields.length === 0 && validationErrors.length === 0;
  return {
    completed: true,
    finalConfirmationLoaderWorks: true,
    finalConfirmationExists: true,
    inputPath,
    missingConfirmationBlocks: false,
    blocker: valid
      ? null
      : parseErrorReason
        ? "final_confirmation_invalid"
        : validationErrors.includes("provider_call_not_authorized_for_one_shot")
          ? "provider_call_not_authorized_for_one_shot"
          : "final_confirmation_invalid",
    confirmationSchemaValidWhenProvided: valid,
    finalConfirmationApproved: valid,
    providerCallAllowedForOneShotRequired: packet?.providerCallAllowedForOneShot === true,
    maxRequestsOneRequired: packet?.maxRequests === 1,
    retryLimitZeroRequired: packet?.retryLimit === 0,
    authJsonAccessForbidden: packet?.authJsonAccessAllowed === false,
    persistentConfigWriteForbidden:
      packet?.persistentUserConfigWriteAllowed === false && packet?.persistentProjectConfigWriteAllowed === false,
    temporaryProjectConfigForbidden: packet?.temporaryProjectConfigAllowed === false,
    placeholderDetected,
    confirmation: valid ? packet : null,
    missingFields,
    validationErrors,
    bomStripped,
    parseErrorReason,
    rawSecretAccessed: false,
    secretValueExposed: forbiddenSensitiveValue,
    rawWebhookAccessed: false,
    webhookValueExposed: forbiddenSensitiveValue && /webhook/i.test(JSON.stringify(packet || {})),
    authJsonRead: false,
    authJsonTouched: false,
  };
}

const requiredFields = Object.freeze([
  "confirmationId",
  "confirmedBy",
  "decision",
  "configRoute",
  "preferredProviderId",
  "fallbackProviderId",
  "maxRequests",
  "retryLimit",
  "maxDurationMinutes",
  "providerCallAllowedForOneShot",
  "authJsonAccessAllowed",
  "persistentUserConfigWriteAllowed",
  "persistentProjectConfigWriteAllowed",
  "temporaryProjectConfigAllowed",
  "rollbackRequiredAfterTest",
  "approvalReason",
  "createdAt",
]);
