type RuntimeEnvironment = Record<string, string | undefined>;

type EnterpriseIdentity = {
  tenantId?: unknown;
} | null | undefined;

export type PlatformControlPlaneDecision = {
  required: boolean;
  allowed: boolean;
  code: "platform_tenant_required" | "platform_tenant_mismatch" | null;
};

const GLOBAL_MUTATION_PREFIXES = [
  "/providers",
  "/provider-config",
  "/models/import",
  "/model-library",
] as const;

const GLOBAL_MUTATION_PATHS = new Set([
  "/real-capabilities/activate-five",
]);

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolvePlatformTenantId(env: RuntimeEnvironment = process.env): string {
  return normalize(env.PME_ENTERPRISE_PLATFORM_TENANT_ID)
    || normalize(env.PME_AUTH_TENANT_ID)
    || "default";
}

export function isPlatformControlPlaneMutation(method: unknown, pathname: unknown): boolean {
  const normalizedMethod = normalize(method).toUpperCase();
  const normalizedPath = normalize(pathname).replace(/\/+$/u, "") || "/";
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) return false;
  if (GLOBAL_MUTATION_PATHS.has(normalizedPath)) return true;
  return GLOBAL_MUTATION_PREFIXES.some((prefix) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
}

export function evaluatePlatformControlPlaneAccess({
  method,
  pathname,
  identity,
  env = process.env,
}: {
  method: unknown;
  pathname: unknown;
  identity: EnterpriseIdentity;
  env?: RuntimeEnvironment;
}): PlatformControlPlaneDecision {
  if (!isPlatformControlPlaneMutation(method, pathname)) {
    return { required: false, allowed: true, code: null };
  }

  const tenantId = normalize(identity?.tenantId);
  if (!tenantId) {
    return { required: true, allowed: false, code: "platform_tenant_required" };
  }

  return tenantId === resolvePlatformTenantId(env)
    ? { required: true, allowed: true, code: null }
    : { required: true, allowed: false, code: "platform_tenant_mismatch" };
}
