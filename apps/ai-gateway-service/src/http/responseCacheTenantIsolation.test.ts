import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  ResponseCacheTenantScopeError,
  createResponseCacheTenantScope,
} from "../cache/responseCacheTenantScope.ts";
import {
  invalidateCache as invalidatePersistentCache,
  lookupCache as lookupPersistentCache,
  readCacheSummary as readPersistentCacheSummary,
  writeCacheRecord as writePersistentCacheRecord,
} from "../cache/responseCacheStore.js";
import { listResponseCacheAuditTrail } from "../cache/responseCacheAuditTrail.js";
import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";

describe("response-cache tenant isolation", () => {
  it("derives stable, disjoint storage namespaces from server tenant identities", () => {
    const publicKey = "response-cache:public-key";
    const tenantA = createResponseCacheTenantScope({ tenantId: "tenant-a" });
    const tenantB = createResponseCacheTenantScope({ tenantId: "tenant-b" });

    expect(tenantA.scopeCacheKey(publicKey)).toBe(tenantA.scopeCacheKey(publicKey));
    expect(tenantA.scopeCacheKey(publicKey)).not.toBe(tenantB.scopeCacheKey(publicKey));
    expect(tenantA.scopeCacheKey(publicKey)).toMatch(
      /^response-cache:tenant-v1:[a-f0-9]{64}:[a-f0-9]{64}$/,
    );
    expect(tenantA.cacheKeyPrefix).not.toContain("tenant-a");
  });

  it("makes every persistent cache operation fail closed without authenticated tenancy", () => {
    const expected = {
      code: "RESPONSE_CACHE_TENANT_CONTEXT_REQUIRED",
      statusCode: 403,
    };
    for (const operation of [
      () => lookupPersistentCache({ cacheKey: "response-cache:public-key" }),
      () => writePersistentCacheRecord({ cacheKey: "response-cache:public-key", response: "secret" }),
      () => invalidatePersistentCache({ cacheKey: "response-cache:public-key" }),
      () => readPersistentCacheSummary(),
      () => listResponseCacheAuditTrail(),
    ]) {
      expect(operation).toThrow(expect.objectContaining(expected));
    }
  });

  it("blocks authenticated cross-tenant reads, poisoning, invalidation, summaries, and audits", async () => {
    const harness = createRouteHarness();
    const publicKey = "response-cache:shared-public-key";

    const writeA = await harness.invoke("tenant-a", "POST", "/cache/write", {
      cacheKey: publicKey,
      response: "tenant-a-secret",
      tenantId: "tenant-b",
    });
    expect(writeA.body).toMatchObject({ cacheKey: publicKey, responsePreview: "tenant-a-secret" });

    const lookupB = await harness.invoke("tenant-b", "POST", "/cache/lookup", {
      cacheKey: publicKey,
      tenantId: "tenant-a",
    });
    expect(lookupB.body).toMatchObject({ cacheKey: publicKey, cacheDecision: "miss" });
    expect(JSON.stringify(lookupB.body)).not.toContain("tenant-a-secret");

    const invalidateB = await harness.invoke("tenant-b", "POST", "/cache/invalidate", {
      cacheKey: publicKey,
      tenantId: "tenant-a",
    });
    expect(invalidateB.body).toMatchObject({ cacheKey: publicKey, removed: false });

    const lookupA = await harness.invoke("tenant-a", "POST", "/cache/lookup", { cacheKey: publicKey });
    expect(lookupA.body).toMatchObject({
      cacheKey: publicKey,
      cacheDecision: "hit",
      responsePreview: "tenant-a-secret",
    });

    await harness.invoke("tenant-b", "POST", "/cache/write", {
      cacheKey: publicKey,
      response: "tenant-b-poison-attempt",
      tenantId: "tenant-a",
    });
    const lookupAAfterPoison = await harness.invoke("tenant-a", "POST", "/cache/lookup", {
      cacheKey: publicKey,
    });
    expect(lookupAAfterPoison.body.responsePreview).toBe("tenant-a-secret");

    const summaryA = await harness.invoke("tenant-a", "GET", "/cache/summary");
    const summaryB = await harness.invoke("tenant-b", "GET", "/cache/summary");
    expect(summaryA.body.recordCount).toBe(1);
    expect(summaryB.body.recordCount).toBe(1);

    const auditA = await harness.invoke("tenant-a", "GET", "/cache/audit");
    expect(JSON.stringify(auditA.body.events)).toContain("tenant-a-secret");
    expect(JSON.stringify(auditA.body.events)).not.toContain("tenant-b-poison-attempt");

    const keys = [...harness.records.keys()];
    const tenantA = createResponseCacheTenantScope({ tenantId: "tenant-a" });
    const tenantB = createResponseCacheTenantScope({ tenantId: "tenant-b" });
    expect(keys).toContain(tenantA.scopeCacheKey(publicKey));
    expect(keys).toContain(tenantB.scopeCacheKey(publicKey));
    expect(keys.every((key) => key !== publicKey)).toBe(true);
  });

  it("rejects cache access when the authenticated identity has no tenant", async () => {
    const harness = createRouteHarness();
    await expect(harness.invoke(undefined, "POST", "/cache/lookup", {
      cacheKey: "response-cache:public-key",
      tenantId: "attacker-supplied-tenant",
    })).rejects.toBeInstanceOf(ResponseCacheTenantScopeError);
    expect(harness.records.size).toBe(0);
  });
});

function createRouteHarness() {
  const records = new Map<string, Record<string, unknown>>();
  const audit: Array<Record<string, unknown>> = [];

  const scopeAccess = (input: { cacheKey: string; tenantScopeIdentity?: { tenantId?: string } }) => {
    const scope = createResponseCacheTenantScope(input.tenantScopeIdentity);
    return { scope, storageKey: scope.scopeCacheKey(input.cacheKey) };
  };
  const lookupCache = vi.fn(async (input) => {
    const { storageKey } = scopeAccess(input);
    const record = records.get(storageKey);
    const result = record
      ? { cacheDecision: "hit", cacheHitType: "exact_hit", servedFromCache: true, ...record }
      : { cacheDecision: "miss", cacheHitType: "hard_miss", cacheKey: storageKey };
    audit.push({ event: "lookup", ...result });
    return result;
  });
  const writeCacheRecord = vi.fn(async (input) => {
    const { storageKey } = scopeAccess(input);
    const record = {
      cacheKey: storageKey,
      responsePreview: String(input.response ?? ""),
      cacheDecision: "hit",
      cacheHitType: "exact_hit",
    };
    records.set(storageKey, record);
    audit.push({ event: "write", ...record });
    return record;
  });
  const invalidateCache = vi.fn(async (input) => {
    const { storageKey } = scopeAccess(input);
    const removed = records.delete(storageKey);
    const result = { cacheKey: storageKey, removed, cacheDecision: "miss", cacheHitType: "stale_miss" };
    audit.push({ event: "invalidate", ...result });
    return result;
  });
  const readResponseCacheSummary = vi.fn(async ({ tenantScopeIdentity }) => {
    const scope = createResponseCacheTenantScope(tenantScopeIdentity);
    return {
      recordCount: [...records.keys()].filter((key) => key.startsWith(scope.cacheKeyPrefix)).length,
    };
  });
  const listAudit = vi.fn(async ({ tenantScopeIdentity, limit = 100 }) => {
    const scope = createResponseCacheTenantScope(tenantScopeIdentity);
    return audit.filter((entry) => (
      typeof entry.cacheKey === "string" && entry.cacheKey.startsWith(scope.cacheKeyPrefix)
    )).slice(-limit);
  });

  async function invoke(
    tenantId: string | undefined,
    method: string,
    pathname: string,
    body: Record<string, unknown> = {},
  ) {
    let responseStatus = 0;
    let responseBody: Record<string, unknown> = {};
    const request = {
      method,
      enterpriseIdentity: { userId: `${tenantId ?? "missing"}-user`, tenantId },
    };
    await dispatchHttpRoutes03({
      request,
      response: {},
      url: new URL(`http://gateway.test${pathname}`),
      startedAt: Date.now(),
      createOkEnvelope: (data: Record<string, unknown>) => data,
      createResponseCacheKey: (input: Record<string, unknown>) => ({
        cacheKey: `response-cache:${sha256(String(input.prompt ?? input.query ?? ""))}`,
      }),
      createResponseCachePolicy: () => ({ mode: "test" }),
      invalidateCache,
      listResponseCacheAuditTrail: listAudit,
      lookupCache,
      readCapabilityJson: async () => body,
      readResponseCacheSummary,
      writeCacheRecord,
      writeCapabilityError: ({ error }: { error: unknown }) => { throw error; },
      writeJson: (_response: unknown, status: number, payload: Record<string, unknown>) => {
        responseStatus = status;
        responseBody = payload;
      },
    });
    return { status: responseStatus, body: responseBody };
  }

  return { invoke, records };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
