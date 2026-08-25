import { createHash } from "node:crypto";

const CACHE_KEY_PREFIX = "response-cache:tenant-v1:";
const MAX_TENANT_ID_LENGTH = 256;
const MAX_PUBLIC_CACHE_KEY_LENGTH = 1_024;

export interface ResponseCacheTenantIdentity {
  tenantId?: unknown;
}

export interface ResponseCacheTenantScope {
  readonly cacheKeyPrefix: string;
  readonly scopeVersion: "tenant-v1";
  scopeCacheKey(publicCacheKey: unknown): string;
}

export class ResponseCacheTenantScopeError extends Error {
  readonly category = "authorization";
  readonly retryable = false;
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "ResponseCacheTenantScopeError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createResponseCacheTenantScope(
  identity: ResponseCacheTenantIdentity | null | undefined,
): Readonly<ResponseCacheTenantScope> {
  const tenantId = readTenantId(identity);
  const tenantHash = sha256(`tenant\0${tenantId}`);
  const cacheKeyPrefix = `${CACHE_KEY_PREFIX}${tenantHash}:`;

  return Object.freeze({
    cacheKeyPrefix,
    scopeVersion: "tenant-v1" as const,
    scopeCacheKey(publicCacheKey: unknown): string {
      const normalizedKey = readPublicCacheKey(publicCacheKey);
      return `${cacheKeyPrefix}${sha256(`key\0${normalizedKey}`)}`;
    },
  });
}

function readTenantId(identity: ResponseCacheTenantIdentity | null | undefined): string {
  const tenantId = typeof identity?.tenantId === "string" ? identity.tenantId.trim() : "";
  if (!tenantId) {
    throw new ResponseCacheTenantScopeError(
      "RESPONSE_CACHE_TENANT_CONTEXT_REQUIRED",
      "A server-authenticated tenant context is required for response-cache access.",
      403,
    );
  }
  if (tenantId.length > MAX_TENANT_ID_LENGTH || /[\u0000-\u001f\u007f]/u.test(tenantId)) {
    throw new ResponseCacheTenantScopeError(
      "RESPONSE_CACHE_TENANT_CONTEXT_INVALID",
      "The server-authenticated tenant context is invalid.",
      403,
    );
  }
  return tenantId;
}

function readPublicCacheKey(value: unknown): string {
  const cacheKey = typeof value === "string" ? value.trim() : "";
  if (!cacheKey) {
    throw new ResponseCacheTenantScopeError(
      "RESPONSE_CACHE_KEY_REQUIRED",
      "A response-cache key is required.",
      400,
    );
  }
  if (cacheKey.length > MAX_PUBLIC_CACHE_KEY_LENGTH || /[\u0000-\u001f\u007f]/u.test(cacheKey)) {
    throw new ResponseCacheTenantScopeError(
      "RESPONSE_CACHE_KEY_INVALID",
      "The response-cache key is invalid.",
      400,
    );
  }
  return cacheKey;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
