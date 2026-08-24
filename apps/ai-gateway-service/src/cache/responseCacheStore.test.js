import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_RESPONSE_CACHE_STORE_PATHS,
  createResponseCacheStore,
} from "./responseCacheStore.js";
import { createResponseCacheTenantScope } from "./responseCacheTenantScope.ts";

const TENANT_SCOPE_IDENTITY = { tenantId: "response-cache-store-test" };

const createdDirs = [];

function tempPaths() {
  const dir = mkdtempSync(join(tmpdir(), "response-cache-store-"));
  createdDirs.push(dir);
  return {
    records: join(dir, "response-cache-records.jsonl"),
    index: join(dir, "response-cache-index.json"),
    summary: join(dir, "response-cache-summary.json"),
    audit: join(dir, "response-cache-audit-trail.jsonl"),
  };
}

function createTestStore(overrides = {}) {
  const paths = tempPaths();
  const store = createResponseCacheStore({ paths, auditFlushIntervalMs: 0, ...overrides });
  return { store, paths };
}

function writeEntry(store, cacheKey, overrides = {}) {
  return store.writeCacheRecord({
    cacheKey,
    tenantScopeIdentity: TENANT_SCOPE_IDENTITY,
    response: `response for ${cacheKey}`,
    ...overrides,
  });
}

function lookupEntry(store, cacheKey) {
  return store.lookupCache({ cacheKey, tenantScopeIdentity: TENANT_SCOPE_IDENTITY });
}

function readAuditLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

afterEach(() => {
  while (createdDirs.length > 0) {
    rmSync(createdDirs.pop(), { recursive: true, force: true });
  }
});

describe("responseCacheStore — index bounds and recovery", () => {
  it("anchors default evidence paths to the service module instead of process cwd", () => {
    for (const path of Object.values(DEFAULT_RESPONSE_CACHE_STORE_PATHS)) {
      expect(path.replace(/\\/g, "/")).toContain("/apps/ai-gateway-service/evidence/response-cache/");
      expect(path.replace(/\\/g, "/")).not.toContain("/apps/ai-gateway-service/apps/");
    }
  });

  it("caps the index and evicts the oldest entries when the cap is exceeded", async () => {
    const { store } = createTestStore({ maxIndexEntries: 2 });
    writeEntry(store, "response-cache:key-1");
    writeEntry(store, "response-cache:key-2");
    writeEntry(store, "response-cache:key-3");

    const summary = store.readCacheSummary({ tenantScopeIdentity: TENANT_SCOPE_IDENTITY });
    expect(summary.recordCount).toBe(2);
    expect(lookupEntry(store, "response-cache:key-1").cacheDecision).toBe("miss");
    expect(lookupEntry(store, "response-cache:key-2").cacheDecision).toBe("hit");
    expect(lookupEntry(store, "response-cache:key-3").cacheDecision).toBe("hit");
    await store.close();
  });

  it("evicts invalidated entries before live entries", async () => {
    const { store } = createTestStore({ maxIndexEntries: 2 });
    writeEntry(store, "response-cache:key-1");
    writeEntry(store, "response-cache:key-2");
    store.invalidateCache({ cacheKey: "response-cache:key-1", tenantScopeIdentity: TENANT_SCOPE_IDENTITY });
    writeEntry(store, "response-cache:key-3");

    // key-1 is invalidated, so it is evicted first when the cap is enforced;
    // both live entries survive.
    expect(lookupEntry(store, "response-cache:key-1").cacheDecision).toBe("miss");
    expect(lookupEntry(store, "response-cache:key-2").cacheDecision).toBe("hit");
    expect(lookupEntry(store, "response-cache:key-3").cacheDecision).toBe("hit");
    expect(store.readCacheSummary({ tenantScopeIdentity: TENANT_SCOPE_IDENTITY }).recordCount).toBe(2);
    await store.close();
  });

  it("clears expired entries on the write path", async () => {
    const { store } = createTestStore();
    writeEntry(store, "response-cache:short-ttl", { ttlMs: 1 });
    writeEntry(store, "response-cache:long-ttl", { ttlMs: 604_800_000 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    writeEntry(store, "response-cache:final");

    const summary = store.readCacheSummary({ tenantScopeIdentity: TENANT_SCOPE_IDENTITY });
    expect(summary.recordCount).toBe(2);
    expect(lookupEntry(store, "response-cache:short-ttl").cacheHitType).toBe("hard_miss");
    expect(lookupEntry(store, "response-cache:final").cacheDecision).toBe("hit");
    await store.close();
  });

  it("recovers from a corrupted index file instead of throwing", async () => {
    const { store, paths } = createTestStore();
    writeEntry(store, "response-cache:before-corruption");
    await store.close();

    writeFileSync(paths.index, "{ this is not valid json", "utf8");

    // The next write must not throw; it rebuilds a working index.
    expect(() => writeEntry(store, "response-cache:after-corruption")).not.toThrow();
    expect(lookupEntry(store, "response-cache:after-corruption").cacheDecision).toBe("hit");
    expect(lookupEntry(store, "response-cache:before-corruption").cacheDecision).toBe("miss");
    expect(JSON.parse(readFileSync(paths.index, "utf8"))).toBeTypeOf("object");
    await store.close();
  });
});

describe("responseCacheStore — buffered audit trail", () => {
  it("does not write the audit file per lookup; flush writes the batch", async () => {
    const { store, paths } = createTestStore();
    lookupEntry(store, "response-cache:audit-miss");
    writeEntry(store, "response-cache:audit-write");

    expect(existsSync(paths.audit)).toBe(false);

    await store.flush();
    const entries = readAuditLines(paths.audit);
    expect(entries.length).toBe(2);
    expect(entries.map((entry) => entry.event)).toEqual(["lookup", "write"]);
    await store.close();
  });

  it("caps the in-memory audit ring buffer", async () => {
    const { store, paths } = createTestStore({ auditBufferLimit: 3 });
    for (const key of ["k1", "k2", "k3", "k4", "k5"]) {
      lookupEntry(store, `response-cache:${key}`);
    }

    await store.flush();
    const scope = createResponseCacheTenantScope(TENANT_SCOPE_IDENTITY);
    const entries = readAuditLines(paths.audit);
    expect(entries.length).toBe(3);
    // Only the newest three lookups (k3, k4, k5) survive the ring buffer cap.
    expect(entries.map((entry) => entry.cacheKey)).toEqual(
      ["k3", "k4", "k5"].map((key) => scope.scopeCacheKey(`response-cache:${key}`)),
    );
    await store.close();
  });

  it("flushes the buffer periodically through the injected interval", async () => {
    const { store, paths } = createTestStore({ auditFlushIntervalMs: 20 });
    lookupEntry(store, "response-cache:timer-flush");

    await viWaitFor(() => expect(existsSync(paths.audit)).toBe(true));
    expect(readAuditLines(paths.audit).length).toBe(1);
    await store.close();
  });

  it("close() clears the timer and persists any pending audit entries", async () => {
    const { store, paths } = createTestStore();
    writeEntry(store, "response-cache:close-flush");
    expect(existsSync(paths.audit)).toBe(false);

    await store.close();
    expect(readAuditLines(paths.audit).length).toBe(1);

    // After close, no timer keeps running and further activity stays buffered
    // until an explicit flush.
    lookupEntry(store, "response-cache:after-close");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(readAuditLines(paths.audit).length).toBe(1);
  });
});

async function viWaitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await predicate();
      return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw lastError ?? new Error("viWaitFor timed out");
}
