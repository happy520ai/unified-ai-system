import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const auditPath = resolve(process.cwd(), "apps/ai-gateway-service/evidence/response-cache/response-cache-audit-trail.jsonl");

export function listResponseCacheAuditTrail(options = {}) {
  const limit = Number(options.limit ?? 100);
  if (!existsSync(auditPath)) return [];
  return readFileSync(auditPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: "unparseable_audit_line" };
      }
    });
}
