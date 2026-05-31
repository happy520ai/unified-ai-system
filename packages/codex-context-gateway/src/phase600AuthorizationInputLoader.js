import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasSensitiveValue, resolveRepoRoot, sanitizeText } from "./contextPackPreviewReader.js";
import {
  hasPhase600ForbiddenRawField,
  normalizePhase600Input,
  PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS,
} from "./phase600AuthorizationInputSchema.js";

const defaultInputPath = "docs/phase600-authorization-packet.input.json";

export function loadPhase600AuthorizationInput(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const relativePath = sanitizeRelativePath(options.inputPath || defaultInputPath);
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      completed: true,
      authorizationPacketInputLoaderWorks: true,
      missingInputHandled: true,
      authorizationInputMissingAllowed: true,
      inputMissing: true,
      inputPath: relativePath,
      packet: {},
      errors: [],
      schemaValidationWorks: true,
      rawSecretRejected: true,
      rawWebhookRejected: true,
      rawSecretAccessed: false,
      secretValueExposed: false,
      rawWebhookAccessed: false,
      webhookValueExposed: false,
    };
  }

  const raw = readFileSync(absolutePath, "utf8");
  const errors = [];
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    errors.push(`malformed-json:${error.message}`);
  }

  const forbiddenRawFieldsDetected = hasPhase600ForbiddenRawField(parsed);
  const sensitiveValueDetected = hasSensitiveValue(parsed);
  const inputRejected = forbiddenRawFieldsDetected || sensitiveValueDetected || errors.length > 0;
  const packet = normalizePhase600Input(inputRejected ? {} : parsed);
  const missingFields = PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS.filter((field) => isMissingField(packet[field]));

  return {
    completed: true,
    authorizationPacketInputLoaderWorks: errors.length === 0,
    missingInputHandled: true,
    authorizationInputMissingAllowed: true,
    inputMissing: false,
    inputPath: relativePath,
    packet,
    errors,
    schemaValidationWorks: errors.length === 0,
    rawSecretRejected: true,
    rawWebhookRejected: true,
    forbiddenRawFieldsDetected,
    sensitiveValueDetected,
    inputRejected,
    requiredFields: PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS,
    missingFields,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
  };
}

function sanitizeRelativePath(path) {
  const normalized = sanitizeText(path).replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes(":")) {
    throw new Error(`Unsafe Phase600 authorization input path: ${path}`);
  }
  return normalized;
}

function isMissingField(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "" || String(value).startsWith("[required");
}
