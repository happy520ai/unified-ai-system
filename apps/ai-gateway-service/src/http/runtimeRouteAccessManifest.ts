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
  ["POST /chat/gateway", "chat:use"],
  ["POST /three-mode/execute", "workflow:run"],
  ["POST /chat-gateway/dry-run-task", "chat:use"],
  ["POST /chat-gateway/latency-dry-run", "chat:use"],
  ["POST /connectors/feishu/send", "connector:write"],
  ["POST /connectors/wecom/send", "connector:write"],
  ["POST /runtime-candidate/codex-exec-crs/dry-run-smoke", "workflow:run"],
  ["POST /runtime-candidate/codex-exec-crs/guarded-one-shot", "workflow:run"],
  ["POST /runtime-candidate/codex-exec-crs/reliability", "workflow:run"],
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
