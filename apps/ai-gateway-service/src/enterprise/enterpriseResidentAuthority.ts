import { createHash } from "node:crypto";
import type { VirtualKeyRequestAccounting } from "./virtualKeyRequestAccounting.ts";

/** A lookup reference only. The original task's signed grant supplies authorization to reuse it. */
export type ResidentAuthorityRef = Readonly<{
  version: 1; kind: "configured-user" | "virtual-key"; fingerprint: string; tenantId: string; userId: string;
}>;
export type ResidentAuthorityIdentity = Readonly<{
  tenantId: string; userId: string; role: string; permissions: readonly string[]; apiKeyFingerprint?: string;
}>;
export type ResidentAuthorityAuthorization = Readonly<{
  identity: ResidentAuthorityIdentity; identityHash: string; expiresAt: string | null;
  accounting: VirtualKeyRequestAccounting | undefined; assertActive(): Promise<void>;
}>;
export function residentAuthorityError(code: string, statusCode = 403) {
  return Object.assign(new Error("The current enterprise authority does not authorize this resident operation."), {
    code, statusCode, category: statusCode === 429 ? "rate_limit" : statusCode >= 500 ? "unavailable" : "auth", retryable: false,
  });
}
function text(value: unknown, maximum = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}
export function readResidentAuthorityRef(value: unknown): ResidentAuthorityRef {
  const keys = ["version", "kind", "fingerprint", "tenantId", "userId"];
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== keys.length) throw residentAuthorityError("RESIDENT_AUTHORITY_REFERENCE_INVALID");
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw residentAuthorityError("RESIDENT_AUTHORITY_REFERENCE_INVALID");
    output[key] = descriptor.value;
  }
  if (output.version !== 1 || !["configured-user", "virtual-key"].includes(String(output.kind))
    || typeof output.fingerprint !== "string" || !/^[a-f0-9]{12}$/u.test(output.fingerprint)
    || !text(output.tenantId) || !text(output.userId)
    || output.kind === "virtual-key" && output.userId !== `api-key:${output.fingerprint}`) throw residentAuthorityError("RESIDENT_AUTHORITY_REFERENCE_INVALID");
  return Object.freeze(output) as ResidentAuthorityRef;
}
export function residentAuthorityIdentity(value: {
  tenantId?: unknown; userId?: unknown; role?: unknown; permissions?: unknown; apiKeyFingerprint?: unknown;
}): ResidentAuthorityIdentity {
  if (!value || !text(value.tenantId) || !text(value.userId) || !text(value.role, 128)
    || !Array.isArray(value.permissions) || value.permissions.some(permission => !text(permission, 128))
    || value.apiKeyFingerprint !== undefined && (typeof value.apiKeyFingerprint !== "string" || !/^[a-f0-9]{12}$/u.test(value.apiKeyFingerprint))) {
    throw residentAuthorityError("RESIDENT_AUTHORITY_IDENTITY_INVALID");
  }
  const permissions = Object.freeze([...new Set<string>(value.permissions)].sort());
  return Object.freeze({ tenantId: value.tenantId, userId: value.userId, role: value.role, permissions,
    ...(typeof value.apiKeyFingerprint === "string" ? { apiKeyFingerprint: value.apiKeyFingerprint } : {}) });
}
export function residentAuthorityIdentityHash(ref: ResidentAuthorityRef, identity: ResidentAuthorityIdentity): string {
  return "sha256:" + createHash("sha256").update(JSON.stringify({ reference: readResidentAuthorityRef(ref), identity: residentAuthorityIdentity(identity) })).digest("hex");
}
