type EnterpriseIdentityLike = {
  tenantId?: unknown;
};

class EnterpriseTenantAuthorizationError extends Error {
  readonly code: string;
  readonly category = "auth";
  readonly statusCode = 403;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EnterpriseTenantAuthorizationError";
    this.code = code;
  }
}

export function requireEnterpriseTenantId(
  identity: EnterpriseIdentityLike | null | undefined,
  code = "enterprise_tenant_context_required",
): string {
  const tenantId = normalizeTenantId(identity?.tenantId);
  if (!tenantId) {
    throw new EnterpriseTenantAuthorizationError(
      code,
      "An authenticated enterprise tenant context is required.",
    );
  }
  return tenantId;
}

export function assertEnterpriseTenantAccess(
  identity: EnterpriseIdentityLike | null | undefined,
  requestedTenantId: unknown,
  code = "enterprise_tenant_forbidden",
): string {
  const actorTenantId = requireEnterpriseTenantId(identity);
  const requested = normalizeTenantId(requestedTenantId);
  if (requested && requested !== actorTenantId) {
    throw new EnterpriseTenantAuthorizationError(
      code,
      "The authenticated credential cannot access the requested tenant.",
    );
  }
  return actorTenantId;
}

function normalizeTenantId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
