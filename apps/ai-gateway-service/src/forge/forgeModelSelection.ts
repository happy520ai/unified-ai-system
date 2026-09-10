import type { ProviderTarget } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";

/** Optional, exact request selection. Absence retains the existing gateway policy. */
export function readForgeModelSelection(value: unknown): Readonly<ProviderTarget> | null {
  if (value === undefined || value === null) return null;
  const invalid = (): never => { throw Object.assign(new Error("Forge model selection requires bounded providerId and modelId."), {
    code: "FORGE_MODEL_SELECTION_INVALID", statusCode: 400,
  }); };
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) invalid();
  const fields = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(fields);
  if (keys.length !== 2 || !keys.includes("providerId") || !keys.includes("modelId")
    || keys.some(key => typeof key !== "string" || !Object.hasOwn(fields[key], "value"))) invalid();
  const { providerId, modelId } = value as ProviderTarget;
  if ([providerId, modelId].some(id => typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(id)
    || containsSensitivePublicationText(id))) invalid();
  return Object.freeze({ providerId, modelId });
}

export function readForgeOutputTokenLimit(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 16384) throw Object.assign(new Error("Forge output token limit must be 1–16384."), {
    code: "FORGE_MODEL_LIMIT_INVALID", statusCode: 400,
  });
  return Number(value);
}
