import { createHash } from "node:crypto";

const TENANT_SCOPE_PREFIX = "knowledge-tenant:v1:";
const TENANT_SCOPE_PATTERN = /^knowledge-tenant:v1:[a-f0-9]{64}$/u;
const MAX_TENANT_ID_LENGTH = 256;

export interface KnowledgeTenantIdentity {
  tenantId?: unknown;
}

export interface KnowledgeTenantScope {
  key: string;
  tenantId: string;
}

export interface KnowledgeTenantContext {
  tenantScopeIdentity?: KnowledgeTenantIdentity | null;
}

export function resolveKnowledgeTenantScope(
  identity: KnowledgeTenantIdentity | null | undefined,
  options: { required?: boolean } = {},
): KnowledgeTenantScope | null {
  const tenantId = typeof identity?.tenantId === "string" ? identity.tenantId.trim() : "";

  if (!tenantId) {
    if (options.required) {
      throw createTenantContextError();
    }
    return null;
  }

  if (tenantId.length > MAX_TENANT_ID_LENGTH) {
    const error = new Error("Authenticated knowledge tenant context is invalid.") as Error & {
      code?: string;
      category?: string;
      status?: number;
    };
    error.code = "KNOWLEDGE_TENANT_CONTEXT_INVALID";
    error.category = "authorization";
    error.status = 403;
    throw error;
  }

  const digest = createHash("sha256")
    .update("knowledge-tenant\0", "utf8")
    .update(tenantId, "utf8")
    .digest("hex");

  return Object.freeze({
    key: `${TENANT_SCOPE_PREFIX}${digest}`,
    tenantId,
  });
}

export function isKnowledgeTenantScopeKey(value: unknown): value is string {
  return typeof value === "string" && TENANT_SCOPE_PATTERN.test(value);
}

export function createKnowledgeTenantContext(
  identity: KnowledgeTenantIdentity | null | undefined,
): KnowledgeTenantContext {
  return Object.freeze({ tenantScopeIdentity: identity ?? null });
}

function createTenantContextError(): Error & {
  code?: string;
  category?: string;
  status?: number;
} {
  const error = new Error("Authenticated knowledge tenant context is required.") as Error & {
    code?: string;
    category?: string;
    status?: number;
  };
  error.code = "KNOWLEDGE_TENANT_CONTEXT_REQUIRED";
  error.category = "authorization";
  error.status = 403;
  return error;
}
