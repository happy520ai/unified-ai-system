import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createResponseCacheTenantScope } from "./responseCacheTenantScope.ts";

const auditPath = resolve(process.cwd(), "apps/ai-gateway-service/evidence/response-cache/response-cache-audit-trail.jsonl");

export function listResponseCacheAuditTrail(options = {}) {
  const tenantScope = createResponseCacheTenantScope(options.tenantScopeIdentity);
  const limit = Math.max(1, Math.min(500, Math.floor(Number(options.limit) || 100)));
  if (!existsSync(auditPath)) return [];
  return readFileSync(auditPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: "unparseable_audit_line" };
      }
    })
    .filter((entry) => (
      typeof entry.cacheKey === "string"
      && entry.cacheKey.startsWith(tenantScope.cacheKeyPrefix)
    ))
    .slice(-limit);
}
