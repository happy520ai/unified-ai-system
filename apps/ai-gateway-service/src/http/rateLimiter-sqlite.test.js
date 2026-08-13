import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRateLimiter } from "./rateLimiter.js";

const tempDirs = [];
const limiters = [];

function createTempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), "ratelimit-sqlite-"));
  tempDirs.push(dir);
  return join(dir, "limits.sqlite");
}

function makeLimiter(options) {
  const limiter = createRateLimiter(options);
  limiters.push(limiter);
  return limiter;
}

afterEach(() => {
  for (const limiter of limiters.splice(0)) {
    limiter.close();
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("rate-limiter-sqlite", () => {
  it("enforces the limit with atomic increments in sqlite mode", () => {
    const limiter = makeLimiter({
      windowMs: 60_000,
      maxRequests: 3,
      storeMode: "sqlite",
      storePath: createTempDbPath(),
      storeNamespace: "test",
    });

    expect(limiter.check("10.0.0.1").allowed).toBe(true);
    expect(limiter.check("10.0.0.1").allowed).toBe(true);
    expect(limiter.check("10.0.0.1").allowed).toBe(true);
    const rejected = limiter.check("10.0.0.1");
    expect(rejected.allowed).toBe(false);
    expect(rejected.remaining).toBe(0);
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
  });

  it("shares counts across instances pointing at the same DB", () => {
    const dbPath = createTempDbPath();
    const a = makeLimiter({
      windowMs: 60_000, maxRequests: 3, storeMode: "sqlite", storePath: dbPath, storeNamespace: "shared",
    });
    const b = makeLimiter({
      windowMs: 60_000, maxRequests: 3, storeMode: "sqlite", storePath: dbPath, storeNamespace: "shared",
    });

    // Instance A consumes 2, instance B sees the shared count.
    expect(a.check("10.0.0.2").allowed).toBe(true);
    expect(a.check("10.0.0.2").allowed).toBe(true);
    expect(b.check("10.0.0.2").allowed).toBe(true); // 3rd shared request
    expect(b.check("10.0.0.2").allowed).toBe(false); // 4th exceeds shared limit
  });

  it("isolates different namespaces in the same DB", () => {
    const dbPath = createTempDbPath();
    const nsA = makeLimiter({
      windowMs: 60_000, maxRequests: 1, storeMode: "sqlite", storePath: dbPath, storeNamespace: "route-a",
    });
    const nsB = makeLimiter({
      windowMs: 60_000, maxRequests: 1, storeMode: "sqlite", storePath: dbPath, storeNamespace: "route-b",
    });

    expect(nsA.check("10.0.0.3").allowed).toBe(true);
    expect(nsA.check("10.0.0.3").allowed).toBe(false); // route-a limit hit
    expect(nsB.check("10.0.0.3").allowed).toBe(true); // route-b unaffected
  });

  it("keeps whitelist exempt in sqlite mode", () => {
    const limiter = makeLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      storeMode: "sqlite",
      storePath: createTempDbPath(),
      storeNamespace: "wl",
      whitelist: ["127.0.0.1"],
    });

    expect(limiter.check("127.0.0.1").allowed).toBe(true);
    expect(limiter.check("127.0.0.1").allowed).toBe(true);
    expect(limiter.check("127.0.0.1").allowed).toBe(true);
  });

  it("reports storeMode in stats", () => {
    const limiter = makeLimiter({
      windowMs: 60_000, maxRequests: 5, storeMode: "sqlite", storePath: createTempDbPath(), storeNamespace: "stats",
    });
    limiter.check("10.0.0.4");
    expect(limiter.getStats().storeMode).toBe("sqlite");
  });
});
