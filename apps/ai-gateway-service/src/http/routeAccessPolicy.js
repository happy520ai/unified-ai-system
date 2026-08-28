/**
 * Routes that must remain reachable before enterprise authentication is set up.
 * Keep this list read-only: mutation and execution endpoints require authorization.
 */
export function isPublicRoute(pathname) {
  return (
    pathname === "/health"
    || pathname === "/health/check"
    || pathname === "/livez"
    || pathname === "/healthz"
    || pathname === "/ready"
    || pathname === "/setup/readiness"
    || pathname === "/auth/status"
    || pathname === "/enterprise/health"
    || pathname === "/.well-known/agent-card.json"
    || pathname === "/.well-known/a2a-jwks.json"
    // SSO begin/callback:IdP 回跳面,靠一次性 state 防伪。
    || /^\/enterprise\/sso\/oidc\/[A-Za-z0-9._-]+\/(begin|callback)\/?$/.test(pathname)
    // SCIM 2.0:公共可达但由 SCIM Bearer token 自行鉴权(未配置即 404)。
    || pathname === "/scim/v2/Users"
    || /^\/scim\/v2\/Users\/[^/]+\/?$/.test(pathname)
  );
}
