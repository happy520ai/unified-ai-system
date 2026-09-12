import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { ForgeMediaTaskProfile, ForgeMediaTaskReview } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { readForgeModelSelection } from "./forgeModelSelection.ts";

export const MEDIA_TTS_TASK_ID = "media-tts";
export const mediaHash = (value: unknown) => createHash("sha256").update(stableStringify(value)).digest("hex");
export const mediaTextHash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
export function mediaTaskError(code: string, statusCode = 409) {
  return Object.assign(new Error("The approved speech task cannot be completed."), { code, statusCode, retryable: false, retrySafe: false });
}
function record(value: unknown, names: string[]): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw mediaTaskError("FORGE_MEDIA_INPUT_INVALID", 400);
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (keys.length !== names.length || keys.some(key => typeof key !== "string" || !names.includes(key) || !Object.hasOwn(fields[key], "value"))) throw mediaTaskError("FORGE_MEDIA_INPUT_INVALID", 400);
}
const id = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/u.test(value);
const tenant = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 128
  && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
const integer = (value: unknown, low: number, high: number) => Number.isSafeInteger(value) && Number(value) >= low && Number(value) <= high;
function readProfile(value: unknown): ForgeMediaTaskProfile {
  record(value, ["id", "tenantId", "providerId", "modelId", "voice", "format", "maxTextBytes", "maxAudioBytes", "maxDurationMs", "timeoutMs"]);
  const model = readForgeModelSelection({ providerId: value.providerId, modelId: value.modelId });
  if (!id(value.id) || !tenant(value.tenantId) || !model || !id(value.voice) || value.format !== "wav-pcm16"
    || [value.id, value.tenantId, value.voice].some(containsSensitivePublicationText)
    || !integer(value.maxTextBytes, 1, 16384) || !integer(value.maxAudioBytes, 46, 4194304)
    || !integer(value.maxDurationMs, 1, 120000) || !integer(value.timeoutMs, 1000, 60000)
    || (value.providerId === "local-fake-provider" && value.modelId !== "local-fake-model")) throw mediaTaskError("FORGE_MEDIA_PROFILE_INVALID", 503);
  return Object.freeze({ ...value }) as ForgeMediaTaskProfile;
}

/** Requests select a configured profile; server paths, URLs and voices cannot be injected. */
export function resolveGovernedMediaTaskRequest(env: Record<string, unknown>, input: unknown, tenantId: string): ForgeMediaTaskReview | null {
  if (input === undefined) return null;
  record(input, ["profileId", "text"]);
  if (!id(input.profileId) || typeof input.text !== "string" || !input.text.trim()
    || Buffer.byteLength(input.text, "utf8") > 16384 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.text)
    || containsSensitivePublicationText(input.text)) throw mediaTaskError("FORGE_MEDIA_INPUT_INVALID", 400);
  const raw = env.AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON;
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 32768) throw mediaTaskError("FORGE_MEDIA_PROFILE_UNAVAILABLE", 503);
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { throw mediaTaskError("FORGE_MEDIA_PROFILE_INVALID", 503); }
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 8) throw mediaTaskError("FORGE_MEDIA_PROFILE_INVALID", 503);
  const profiles: ForgeMediaTaskProfile[] = [];
  for (const value of entries) {
    const profile = readProfile(value);
    if (profiles.some(existing => existing.id === profile.id)) throw mediaTaskError("FORGE_MEDIA_PROFILE_INVALID", 503);
    profiles.push(profile);
  }
  const profile = profiles.find(value => value.id === input.profileId && value.tenantId === tenantId);
  if (!profile) throw mediaTaskError("FORGE_MEDIA_PROFILE_UNAVAILABLE", 404);
  const textBytes = Buffer.byteLength(input.text, "utf8");
  if (textBytes > profile.maxTextBytes) throw mediaTaskError("FORGE_MEDIA_TEXT_LIMIT", 400);
  return Object.freeze({ version: 1, kind: "tts", profile, profileHash: mediaHash(profile),
    text: input.text, textSha256: mediaTextHash(input.text), textBytes });
}
export function readGovernedMediaTaskReview(input: unknown): ForgeMediaTaskReview {
  record(input, ["version", "kind", "profile", "profileHash", "text", "textSha256", "textBytes"]);
  if (input.version !== 1 || input.kind !== "tts" || typeof input.profileHash !== "string" || !/^[a-f0-9]{64}$/u.test(input.profileHash)
    || typeof input.textSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(input.textSha256) || !integer(input.textBytes, 1, 16384)) throw mediaTaskError("FORGE_MEDIA_REVIEW_INVALID", 400);
  const profile = readProfile(input.profile);
  const normalized = resolveGovernedMediaTaskRequest({ AI_GATEWAY_FORGE_MEDIA_PROFILES_JSON: JSON.stringify([profile]) },
    { profileId: profile.id, text: input.text }, profile.tenantId)!;
  if (stableStringify(input) !== stableStringify(normalized)) throw mediaTaskError("FORGE_MEDIA_REVIEW_INVALID", 400);
  return normalized;
}
export function assertMediaModelSelection(review: ForgeMediaTaskReview, value: unknown): void {
  const selected = readForgeModelSelection(value);
  if (!selected || selected.providerId !== review.profile.providerId || selected.modelId !== review.profile.modelId) {
    throw mediaTaskError("FORGE_MEDIA_MODEL_SELECTION_MISMATCH", 400);
  }
}

/** This profile bounds one request in text bytes, audio bytes, duration and time. */
export function assertMediaOptions(review: ForgeMediaTaskReview, options: Record<string, any>): void {
  assertMediaModelSelection(review, options.modelSelection);
  const allowed = new Set(["mediaTask", "modelSelection", "enableCodeIntel", "useRefiner", "maxConcurrent", "checkpointAfter", "budget"]);
  if (Object.keys(options).some(key => !allowed.has(key))
    || (options.enableCodeIntel !== undefined && options.enableCodeIntel !== false)
    || (options.useRefiner !== undefined && options.useRefiner !== false)
    || (options.maxConcurrent !== undefined && !integer(options.maxConcurrent, 1, 8))
    || (options.checkpointAfter !== undefined && (!Array.isArray(options.checkpointAfter) || options.checkpointAfter.length !== 0))) {
    throw mediaTaskError("FORGE_MEDIA_OPTIONS_UNSUPPORTED", 400);
  }
  if (options.budget !== undefined && (!options.budget || typeof options.budget !== "object" || Array.isArray(options.budget)
    || Object.keys(options.budget).some(key => key !== "maxMinutes")
    || (options.budget.maxMinutes !== undefined && !integer(options.budget.maxMinutes, 1, 120)))) {
    throw Object.assign(mediaTaskError("FORGE_MEDIA_BUDGET_UNIT_UNSUPPORTED", 400), {
      message: "Speech does not report token or currency usage; use the configured text, audio and time limits.",
    });
  }
}
