import { createHash } from "node:crypto";
import { posix, win32 } from "node:path";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceCodeDeliveryProfile, WorkforceExternalRunnerProfile, WorkforceExternalRunnerProfileInput,
  WorkforceExternalRunnerReview } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { freezeWorkforceCodeDeliveryProfile } from "./workforceCodeDeliveryProfile.ts";

const PROFILE_KEYS = ["version", "mode", "profileId", "projectId", "roleId", "baselineRevision", "binary", "nativeModel", "disabledMcpServers", "limits", "artifact"];
const REVIEW_INPUT_KEYS = ["profile", "configuredRepositoryHash", "goal", "prompt", "sourceFilesHash"];
const HASH = /^sha256:[a-f0-9]{64}$/u, HEX = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u, MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;

export function externalRunnerError(code: string, message: string, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode, category: statusCode >= 500 ? "configuration" : "authorization", retryable: false as const });
}
function invalid(kind = "PROFILE"): never {
  throw externalRunnerError(`WORKFORCE_EXTERNAL_RUNNER_${kind}_INVALID`, "The external runner data is malformed, unsafe or inconsistent.", kind === "PROFILE" ? 503 : 400);
}
function ownRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) invalid();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field?.enumerable || !("value" in field)) invalid();
    result[key] = field.value;
  }
  return result;
}
function ownArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, index) => {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (!field?.enumerable || !("value" in field)) invalid();
    return field.value;
  });
}
function text(value: unknown, maximum: number, multiline = false): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || containsSensitivePublicationText(value)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value)
    || (multiline ? /\r(?!\n)/u : /[\t\r\n]/u).test(value)
    || Buffer.from(value, "utf8").toString("utf8") !== value) invalid();
  return value;
}
function identifier(value: unknown, model = false): string {
  const result = text(value, model ? 256 : 128);
  if (!(model ? MODEL_ID : ID).test(result)) invalid();
  return result;
}
function integer(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) invalid();
  return Number(value);
}
function binaryPath(value: unknown, platform: "win32" | "linux" | "darwin"): string {
  const path = text(value, 4096), windows = platform === "win32", api = windows ? win32 : posix;
  if (!api.isAbsolute(path) || (windows ? !/^[A-Za-z]:[\\/]/u.test(path) : path.startsWith("//"))) invalid();
  const segments = path.slice(windows ? 3 : 1).split(windows ? /[\\/]/u : /\//u);
  if (segments.some(segment => !segment || segment === "." || segment === ".."
    || windows && (/[. ]$/u.test(segment) || /[:*?<>|]/u.test(segment)))) invalid();
  const basename = api.basename(path);
  if (windows ? basename.toLowerCase() !== "codex.exe" : basename !== "codex") invalid();
  return api.normalize(path);
}
function artifactPolicy(source: Record<string, unknown>): WorkforceCodeDeliveryProfile {
  const artifact = ownRecord(source.artifact, ["readPaths", "writePaths", "verification", "artifactLimits"]);
  return freezeWorkforceCodeDeliveryProfile({ version: 1, mode: "forge-owned-worktree-artifact", profileId: source.profileId,
    projectId: source.projectId, roleId: source.roleId, baselineRevision: source.baselineRevision, ...artifact });
}

/** Pure profile validation: never reads executable files, native configuration, environment or process state. */
export function freezeWorkforceExternalRunnerProfile(value: unknown): WorkforceExternalRunnerProfile {
  try {
    const source = ownRecord(value, PROFILE_KEYS), binary = ownRecord(source.binary, ["path", "sha256", "version", "platform"]);
    const nativeModel = ownRecord(source.nativeModel, ["modelId", "providerId"]), limits = ownRecord(source.limits, ["timeoutMs", "maxInputBytes", "maxMessageBytes", "maxEvents"]);
    if (source.version !== 1 || source.mode !== "codex-app-server-owned-worktree" || source.roleId !== "backend-engineer"
      || typeof source.baselineRevision !== "string" || !/^[a-f0-9]{40}$/u.test(source.baselineRevision)
      || binary.version !== "0.153.4" || typeof binary.platform !== "string" || !["win32", "linux", "darwin"].includes(binary.platform)
      || typeof binary.sha256 !== "string" || !HEX.test(binary.sha256)) invalid();
    const platform = binary.platform as "win32" | "linux" | "darwin";
    const disabledMcpServers = ownArray(source.disabledMcpServers, 64).map(value => identifier(value)).sort();
    if (new Set(disabledMcpServers).size !== disabledMcpServers.length) invalid();
    const artifact = artifactPolicy(source);
    const profile: WorkforceExternalRunnerProfileInput = {
      version: 1, mode: "codex-app-server-owned-worktree", profileId: identifier(source.profileId), projectId: identifier(source.projectId),
      roleId: "backend-engineer", baselineRevision: source.baselineRevision,
      binary: Object.freeze({ path: binaryPath(binary.path, platform), sha256: binary.sha256, version: "0.153.4", platform }),
      nativeModel: Object.freeze({ modelId: identifier(nativeModel.modelId, true), providerId: identifier(nativeModel.providerId, true) }),
      disabledMcpServers: Object.freeze(disabledMcpServers),
      limits: Object.freeze({ timeoutMs: integer(limits.timeoutMs, 5000, 600000), maxInputBytes: integer(limits.maxInputBytes, 1024, 524288),
        maxMessageBytes: integer(limits.maxMessageBytes, 1024, 1048576), maxEvents: integer(limits.maxEvents, 16, 2048) }),
      artifact: Object.freeze({ readPaths: artifact.readPaths, writePaths: artifact.writePaths, verification: artifact.verification, artifactLimits: artifact.artifactLimits }),
    };
    return Object.freeze({ ...profile, profileHash: externalRunnerHash(profile) });
  } catch { return invalid(); }
}

export function readWorkforceExternalRunnerProfile(value: unknown): WorkforceExternalRunnerProfile {
  const { profileHash, ...source } = ownRecord(value, [...PROFILE_KEYS, "profileHash"]);
  const profile = freezeWorkforceExternalRunnerProfile(source);
  if (profileHash !== profile.profileHash) invalid();
  return profile;
}

/** Derives only the existing file and verification policy; it does not claim Forge executed the native task. */
export function externalRunnerArtifactPolicy(value: WorkforceExternalRunnerProfile): WorkforceCodeDeliveryProfile {
  const profile = readWorkforceExternalRunnerProfile(value);
  return artifactPolicy(profile as unknown as Record<string, unknown>);
}

/** Request JSON selects one private server profile; it cannot provide native launch settings. */
export function readWorkforceExternalRunnerSelector(input: object): string | undefined {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid("REQUEST");
    if (!Object.hasOwn(input, "externalRunner")) return undefined;
    const field = Object.getOwnPropertyDescriptor(input, "externalRunner");
    if (!field?.enumerable || !("value" in field)) invalid("REQUEST");
    return identifier(ownRecord(field.value, ["profileId"]).profileId);
  } catch { return invalid("REQUEST"); }
}

export function createWorkforceExternalRunnerReview(input: {
  profile: WorkforceExternalRunnerProfile; configuredRepositoryHash: string; goal: string; prompt: string; sourceFilesHash: string;
}): WorkforceExternalRunnerReview {
  try {
    const source = ownRecord(input, REVIEW_INPUT_KEYS), profile = readWorkforceExternalRunnerProfile(source.profile);
    if (typeof source.configuredRepositoryHash !== "string" || !HASH.test(source.configuredRepositoryHash)
      || typeof source.sourceFilesHash !== "string" || !HEX.test(source.sourceFilesHash)) invalid("REVIEW");
    const goal = text(source.goal, 4000, true), prompt = text(source.prompt, profile.limits.maxInputBytes, true);
    if (Buffer.byteLength(prompt, "utf8") > profile.limits.maxInputBytes) invalid("REVIEW");
    const review = { version: 1 as const, profile, configuredRepositoryHash: source.configuredRepositoryHash, goal, prompt, sourceFilesHash: source.sourceFilesHash };
    return Object.freeze({ ...review, reviewHash: externalRunnerHash(review) });
  } catch { return invalid("REVIEW"); }
}
export function readWorkforceExternalRunnerReview(value: unknown): WorkforceExternalRunnerReview {
  try {
    const { version, reviewHash, ...source } = ownRecord(value, ["version", ...REVIEW_INPUT_KEYS, "reviewHash"]);
    if (version !== 1) invalid("REVIEW");
    const review = createWorkforceExternalRunnerReview(source as Parameters<typeof createWorkforceExternalRunnerReview>[0]);
    if (reviewHash !== review.reviewHash) invalid("REVIEW");
    return review;
  } catch { return invalid("REVIEW"); }
}

/** Canonical JSON hashing with descriptor checks before stableStringify can access any fields. */
export function externalRunnerHash(value: unknown): string {
  let nodes = 0, bytes = 0;
  const seen = new WeakSet<object>();
  function count(value: string): void {
    if (value.length > 1048576) invalid("HASH");
    bytes += Buffer.byteLength(JSON.stringify(value), "utf8");
    if (bytes > 1048576) invalid("HASH");
  }
  function inspect(item: unknown, depth: number): void {
    if (++nodes > 50000 || depth > 32) invalid("HASH");
    if (item === null || typeof item === "string" || typeof item === "boolean") { count(String(item)); return; }
    if (typeof item === "number" && Number.isFinite(item) && (!Number.isInteger(item) || Number.isSafeInteger(item))) { count(String(item)); return; }
    if (!item || typeof item !== "object" || seen.has(item)) invalid("HASH");
    seen.add(item);
    const keys = Reflect.ownKeys(item);
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype || keys.length !== item.length + 1) invalid("HASH");
      for (let index = 0; index < item.length; index++) {
        const field = Object.getOwnPropertyDescriptor(item, String(index));
        if (!field?.enumerable || !("value" in field)) invalid("HASH");
        inspect(field.value, depth + 1);
      }
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) invalid("HASH");
      for (const key of keys) {
        const field = Object.getOwnPropertyDescriptor(item, key);
        if (typeof key !== "string" || !field?.enumerable || !("value" in field)) invalid("HASH");
        count(key);
        inspect(field.value, depth + 1);
      }
    }
    seen.delete(item);
  }
  inspect(value, 0);
  const serialized = stableStringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 1048576) invalid("HASH");
  return "sha256:" + createHash("sha256").update(serialized, "utf8").digest("hex");
}
