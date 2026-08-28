import { existsSync, readFileSync } from "node:fs";
import { createResponseCacheTenantScope } from "./responseCacheTenantScope.ts";
import { DEFAULT_RESPONSE_CACHE_STORE_PATHS } from "./responseCacheStore.js";

const auditPath = DEFAULT_RESPONSE_CACHE_STORE_PATHS.audit;

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
