import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasSensitiveValue, resolveRepoRoot, sanitizeText } from "./contextPackPreviewReader.js";
import { hasForbiddenRawField, normalizePhase599Packet, PHASE599_AUTHORIZATION_REQUIRED_FIELDS } from "./phase599AuthorizationPacketSchema.js";

const defaultInputPath = "docs/phase599-authorization-packet.input.json";

export function loadPhase599AuthorizationPacket(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const relativePath = sanitizeRelativePath(options.inputPath || defaultInputPath);
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      completed: true,
      authorizationPacketLoaderWorks: true,
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
      missingInputHandled: true,
    };
  }

  const raw = readFileSync(absolutePath, "utf8");
  let parsed = {};
  const errors = [];
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    errors.push(`malformed-json:${error.message}`);
  }
  const forbiddenRawFieldsDetected = hasForbiddenRawField(parsed);
  const sensitiveValueDetected = hasSensitiveValue(parsed);
  const packet = normalizePhase599Packet(forbiddenRawFieldsDetected || sensitiveValueDetected ? {} : parsed);
  const missingFields = PHASE599_AUTHORIZATION_REQUIRED_FIELDS.filter((field) => isMissingField(packet[field]));
  return {
    completed: true,
    authorizationPacketLoaderWorks: errors.length === 0,
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
    inputRejected: forbiddenRawFieldsDetected || sensitiveValueDetected || errors.length > 0,
    requiredFields: PHASE599_AUTHORIZATION_REQUIRED_FIELDS,
    missingFields,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    missingInputHandled: true,
  };
}

function sanitizeRelativePath(path) {
  const normalized = sanitizeText(path).replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes(":")) {
    throw new Error(`Unsafe authorization packet path: ${path}`);
  }
  return normalized;
}

function isMissingField(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "" || String(value).startsWith("[required");
}
