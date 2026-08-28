export const UNKNOWN_ROUTE_PERMISSION = "route:unknown";

const RUNTIME_ROUTE_PERMISSION_OVERRIDES = new Map<string, string>([
  ["GET /workbench/feature-status", "dashboard:read"],
  ["GET /approvals", "workflow:run"],
  ["GET /plugin-registry", "provider:read"],
  ["GET /real-capabilities/status", "dashboard:read"],
  ["GET /chat-gateway/task-matrix", "dashboard:read"],
  ["GET /chat-gateway/latency-policy", "dashboard:read"],
  ["GET /workbench/diagnostics/status", "dashboard:read"],
  ["POST /approvals/create", "workflow:run"],
  ["POST /local-operation/apply-approved", "workflow:approve"],
  ["POST /file-context/select", "workflow:run"],
  ["POST /chat-gateway/execute", "chat:use"],
  ["POST /three-mode/execute", "workflow:run"],
  ["POST /chat/gateway", "chat:use"],
  ["POST /chat-gateway/dry-run-task", "chat:use"],
  ["POST /chat-gateway/latency-dry-run", "chat:use"],
  ["POST /connectors/feishu/send", "connector:write"],
  ["POST /connectors/wecom/send", "connector:write"],
  ["POST /runtime-candidate/codex-exec-crs/dry-run-smoke", "workflow:run"],
  ["POST /runtime-candidate/codex-exec-crs/guarded-one-shot", "workflow:run"],
  ["POST /runtime-candidate/codex-exec-crs/reliability", "workflow:run"],
  ["GET /local-clients/status", "dashboard:read"],
  ["GET /local-clients/health", "dashboard:read"],
  ["GET /local-clients/registry", "audit:read"],
  ["GET /local-clients/intelligence", "dashboard:read"],
  ["POST /local-clients/discover", "workflow:approve"],
  ["POST /local-clients/discover/system", "workflow:approve"],
  ["POST /local-clients/maintenance", "workflow:approve"],
  ["POST /local-clients/smart-manage", "workflow:approve"],
  ["POST /local-clients/register", "workflow:approve"],
  ["POST /local-clients/disable", "workflow:approve"],
  ["POST /local-clients/revoke", "workflow:approve"],
  ["POST /local-clients/route", "workflow:run"],
  ["POST /local-clients/provider-route", "workflow:run"],
  ["POST /local-clients/verify", "workflow:approve"],
  ["POST /local-clients/executions/preview", "workflow:run"],
  ["POST /local-clients/executions/approve", "workflow:approve"],
  ["POST /local-clients/executions/execute", "workflow:approve"],
  ["POST /local-clients/execute", "workflow:approve"],
  ["POST /local-clients/heartbeat", "local-client:telemetry"],
  ["POST /local-clients/feedback", "local-client:telemetry"],
  ["GET /local-clients/onboarding/profiles", "dashboard:read"],
  ["POST /local-clients/onboarding/plans", "workflow:run"],
  ["POST /local-clients/onboarding/approve", "workflow:approve"],
  ["POST /local-clients/onboarding/apply", "workflow:approve"],
  ["POST /local-clients/onboarding/rollback", "workflow:approve"],
  ["POST /local-clients/onboarding/recover", "workflow:approve"],
]);

function normalizePath(pathname: unknown) {
  const value = String(pathname ?? "/").trim() || "/";
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

export function resolveRuntimeRoutePermissionOverride(method: unknown, pathname: unknown) {
  const normalizedMethod = String(method ?? "GET").toUpperCase();
  const normalizedPath = normalizePath(pathname);
  const exactPermission = RUNTIME_ROUTE_PERMISSION_OVERRIDES.get(`${normalizedMethod} ${normalizedPath}`);
  if (exactPermission) return exactPermission;

  if (
    normalizedMethod === "POST"
    && /^\/approvals\/[^/]+\/(?:approve|reject)$/.test(normalizedPath)
  ) {
    return "workflow:approve";
  }

  if (
    normalizedMethod === "GET"
    && /^\/chat-gateway\/evidence\/[^/]+$/.test(normalizedPath)
  ) {
    return "audit:read";
  }

  if (
    normalizedMethod === "GET"
    && /^\/local-clients\/executions\/[^/]+$/.test(normalizedPath)
  ) {
    return "dashboard:read";
  }

  if (
    normalizedMethod === "GET"
    && /^\/local-clients\/onboarding\/profiles\/[^/]+(?:\/verify)?$/.test(normalizedPath)
  ) {
    return "audit:read";
  }

  if (
    normalizedMethod === "POST"
    && /^\/local-clients\/executions\/[^/]+\/cancel$/.test(normalizedPath)
  ) {
    return "workflow:approve";
  }

  return null;
}

type UnmappedRouteDecision = {
  isPublic: boolean;
  permission: string;
  authorizationAllowed: boolean;
};

export function shouldRejectUnmappedRoute(decision: UnmappedRouteDecision) {
  return decision.isPublic === false && decision.permission === UNKNOWN_ROUTE_PERMISSION;
}
