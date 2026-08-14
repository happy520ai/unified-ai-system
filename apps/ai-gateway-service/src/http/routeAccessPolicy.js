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
  );
}
