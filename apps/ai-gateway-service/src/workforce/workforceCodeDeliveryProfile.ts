import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceCodeDeliveryProfile, WorkforceCodeDeliveryProfileInput, WorkforceCodeDeliveryReadiness,
  WorkforceCodeDeliveryReview, WorkforceRoleExecutionProfile } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { readFrozenWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";

const PROFILE_KEYS = ["version", "mode", "profileId", "projectId", "baselineRevision", "roleId",
  "readPaths", "writePaths", "verification", "artifactLimits"];
const VERIFICATION_KEYS = ["verificationId", "command", "immutableTests", "image", "workspaceMode",
  "networkAccess", "timeoutMs", "maxMemoryMB", "maxOutputBytes", "pidsLimit", "cpus"];
const REVIEW_KEYS = ["version", "profile", "configuredRepositoryHash", "roleProfileHash"];
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const HASH = /^sha256:[a-f0-9]{64}$/u;
const PROTECTED = new Set([".git", ".gitattributes", ".gitmodules", ".gitconfig", ".forge", ".mcp.json", ".ssh", ".aws", ".azure", ".gcp", ".npmrc",
  ".netrc", ".git-credentials", "credentials", "credentials.json", "auth.json", "evidence"]);

export const CODE_DELIVERY_READINESS: WorkforceCodeDeliveryReadiness = Object.freeze({
  version: 1, executionAllowed: false, implementation: "unavailable", container: "not-checked",
  policy: "not-checked", worktree: "not-created", verification: "not-run",
});

/** Pure configuration parsing: no environment, files, containers, approvals or model calls. */
export function freezeWorkforceCodeDeliveryProfile(value: unknown): WorkforceCodeDeliveryProfile {
  const source = ownRecord(value, PROFILE_KEYS);
  const verification = ownRecord(source.verification, VERIFICATION_KEYS);
  const limits = ownRecord(source.artifactLimits, ["maxChangedFiles", "maxFileBytes", "maxDiffBytes"]);
  if (source.version !== 1 || source.mode !== "forge-owned-worktree-artifact" || source.roleId !== "backend-engineer"
    || typeof source.baselineRevision !== "string" || !/^[a-f0-9]{40}$/u.test(source.baselineRevision)
    || verification.workspaceMode !== "ro" || verification.networkAccess !== false) throw profileError();
  const readPaths = paths(source.readPaths, 32), writePaths = paths(source.writePaths, 8);
  const immutableTests = ownArray(verification.immutableTests, 8).map(value => {
    const test = ownRecord(value, ["path", "sha256"]);
    if (typeof test.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(test.sha256)) throw profileError();
    return Object.freeze({ path: safePath(test.path), sha256: test.sha256 });
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const readSet = new Set(readPaths), writeSet = new Set(writePaths.map(comparePath));
  if (writePaths.some(path => !readSet.has(path))
    || immutableTests.some(test => !readSet.has(test.path) || writeSet.has(comparePath(test.path)))
    || new Set(immutableTests.map(test => comparePath(test.path))).size !== immutableTests.length) throw profileError();
  const image = safeText(verification.image, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/:-]*@sha256:[a-f0-9]{64}$/u.test(image)) throw profileError();
  const cpus = verification.cpus;
  if (typeof cpus !== "number" || !Number.isFinite(cpus) || cpus < 0.1 || cpus > 1) throw profileError();
  const profile: WorkforceCodeDeliveryProfileInput = {
    version: 1, mode: "forge-owned-worktree-artifact", profileId: identifier(source.profileId),
    projectId: identifier(source.projectId), baselineRevision: source.baselineRevision, roleId: "backend-engineer",
    readPaths: Object.freeze(readPaths), writePaths: Object.freeze(writePaths),
    verification: Object.freeze({ verificationId: identifier(verification.verificationId),
      command: safeText(verification.command, 512), immutableTests: Object.freeze(immutableTests), image,
      workspaceMode: "ro", networkAccess: false, timeoutMs: integer(verification.timeoutMs, 1000, 30000),
      maxMemoryMB: integer(verification.maxMemoryMB, 64, 512), maxOutputBytes: integer(verification.maxOutputBytes, 1024, 65536),
      pidsLimit: integer(verification.pidsLimit, 16, 64), cpus }),
    artifactLimits: Object.freeze({ maxChangedFiles: integer(limits.maxChangedFiles, 1, writePaths.length),
      maxFileBytes: integer(limits.maxFileBytes, 1, 65536), maxDiffBytes: integer(limits.maxDiffBytes, 1, 262144) }),
  };
  return Object.freeze({ ...profile, profileHash: digest(profile) });
}

/** Reconstruct full durable data; a matching hash is not an execution capability. */
export function readFrozenWorkforceCodeDeliveryProfile(value: unknown): WorkforceCodeDeliveryProfile {
  const { profileHash, ...input } = ownRecord(value, [...PROFILE_KEYS, "profileHash"]);
  const profile = freezeWorkforceCodeDeliveryProfile(input);
  if (profileHash !== profile.profileHash) throw profileError();
  return profile;
}

export function createWorkforceCodeDeliveryReview(input: {
  profile: WorkforceCodeDeliveryProfile; configuredRepositoryHash: string; roleExecution?: WorkforceRoleExecutionProfile;
}): WorkforceCodeDeliveryReview {
  const profile = readFrozenWorkforceCodeDeliveryProfile(input.profile);
  if (typeof input.configuredRepositoryHash !== "string" || !HASH.test(input.configuredRepositoryHash) || !input.roleExecution) {
    throw codeDeliveryError("WORKFORCE_CODE_DELIVERY_BINDING_INVALID", 409, "Code delivery requires a repository and employee profile binding.");
  }
  const role = readFrozenWorkforceRoleExecutionProfile(input.roleExecution);
  const backend = role.bindings.find(binding => binding.roleId === profile.roleId);
  if (!backend) throw codeDeliveryError("WORKFORCE_CODE_DELIVERY_BINDING_INVALID", 409, "The code delivery employee role is unavailable.");
  if (backend.maxRequests < 3 || backend.maxOutputTokens < 16384 || role.maxTotalRequests < role.bindings.length + 2) {
    throw codeDeliveryError("WORKFORCE_CODE_DELIVERY_BUDGET_INSUFFICIENT", 403, "The approved model budget cannot cover analysis, compilation and one code worker.");
  }
  return Object.freeze({ version: 1, profile, configuredRepositoryHash: input.configuredRepositoryHash, roleProfileHash: role.profileHash });
}

export function readWorkforceCodeDeliveryReview(value: unknown, roleExecution?: WorkforceRoleExecutionProfile): WorkforceCodeDeliveryReview {
  const source = ownRecord(value, REVIEW_KEYS);
  if (source.version !== 1 || typeof source.configuredRepositoryHash !== "string") throw profileError();
  const review = createWorkforceCodeDeliveryReview({ profile: readFrozenWorkforceCodeDeliveryProfile(source.profile),
    configuredRepositoryHash: source.configuredRepositoryHash, roleExecution });
  if (source.roleProfileHash !== review.roleProfileHash) throw profileError();
  return review;
}

/** The only request field is a selector into the executor's private server configuration. */
export function readWorkforceCodeDeliverySelector(input: object): string | undefined {
  if (!Object.hasOwn(input, "codeDelivery")) return undefined;
  try {
    const property = Object.getOwnPropertyDescriptor(input, "codeDelivery");
    if (!property || !("value" in property)) throw profileError();
    return identifier(ownRecord(property.value, ["profileId"]).profileId);
  } catch {
    throw codeDeliveryError("WORKFORCE_CODE_DELIVERY_REQUEST_INVALID", 400, "codeDelivery must contain only a safe profileId selector.");
  }
}

export function codeDeliveryError(code: string, statusCode: number, message: string) {
  return Object.assign(new Error(message), { code, statusCode, category: statusCode >= 500 ? "configuration" : "authorization", retryable: false as const });
}

export function rejectUnimplementedCodeDelivery(): never {
  throw codeDeliveryError("WORKFORCE_CODE_DELIVERY_IMPLEMENTATION_UNAVAILABLE", 503,
    "Code delivery is not executable: its governed Forge, approved-file validation snapshot and evidence runtime are not connected.");
}

function ownRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) throw profileError();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field || !("value" in field) || !field.enumerable) throw profileError();
    result[key] = field.value;
  }
  return result;
}

function ownArray(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) throw profileError();
  return Array.from({ length: value.length }, (_, index) => {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (!field || !("value" in field)) throw profileError();
    return field.value;
  });
}
function paths(value: unknown, maximum: number) {
  const result = ownArray(value, maximum).map(safePath).sort();
  if (new Set(result.map(comparePath)).size !== result.length) throw profileError();
  return result;
}
function safePath(value: unknown): string {
  const path = safeText(value, 256).replaceAll("\\", "/");
  if (path.startsWith("/") || /[:*?\[\]{}]/u.test(path)) throw profileError();
  for (const segment of path.split("/")) {
    const lower = segment.toLowerCase();
    if (!segment || segment === "." || segment === ".." || /[. ]$/u.test(segment)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment)
      || PROTECTED.has(lower) || /^\.env(?:\.|$)/iu.test(segment)
      || /\.(?:pem|key|pfx|p12|sqlite|db)$/iu.test(segment)) throw profileError();
  }
  return path;
}
function comparePath(value: string) { return value.toLowerCase(); }
function safeText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value) || containsSensitivePublicationText(value)) throw profileError();
  return value;
}
function identifier(value: unknown): string { const text = safeText(value, 128); if (!ID.test(text)) throw profileError(); return text; }
function integer(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw profileError();
  return Number(value);
}
function digest(value: unknown) { return "sha256:" + createHash("sha256").update(stableStringify(value)).digest("hex"); }
function profileError() { return codeDeliveryError("WORKFORCE_CODE_DELIVERY_PROFILE_INVALID", 503, "Code delivery profile is malformed, unsafe or inconsistent."); }
