import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuthTokenService } from "./authTokenService.js";

// Security regression suite: revocation must survive restarts, expired
// tokens must not refresh, and only signed tokens can be revoked.
describe("authTokenService security semantics", () => {
  it("keeps a revoked token invalid across service instances via the persisted jti store", () => {
    const storePath = join(mkdtempSync(join(tmpdir(), "auth-revoke-")), "revoked-jtis.json");
    try {
      const first = createAuthTokenService({ secret: "a".repeat(64), revocationStorePath: storePath });
      const token = first.signToken({ userId: "u1" });
      expect(first.verifyToken(token).valid).toBe(true);
      expect(first.revokeToken(token)).toBe(true);
      expect(first.verifyToken(token).valid).toBe(false);

      const second = createAuthTokenService({ secret: "a".repeat(64), revocationStorePath: storePath });
      expect(second.verifyToken(token).valid).toBe(false);
      expect(second.verifyToken(token).error).toBe("token_revoked");
    } finally {
      rmSync(join(storePath, ".."), { recursive: true, force: true });
    }
  });

  it("rejects refresh for expired tokens", () => {
    const service = createAuthTokenService({
      secret: "b".repeat(64),
      revocationStorePath: null,
      expiresInMs: 5,
    });
    const token = service.signToken({ userId: "u1" });
    return new Promise((resolve) => setTimeout(() => {
      const result = service.refreshToken(token);
      expect(result.success).toBe(false);
      expect(result.error).toBe("token_expired");
      resolve();
    }, 20));
  });

  it("refuses to revoke unsigned or malformed tokens", () => {
    const service = createAuthTokenService({ secret: "c".repeat(64), revocationStorePath: null });
    expect(service.revokeToken("garbage")).toBe(false);
    expect(service.revokeToken("a.b.c")).toBe(false);

    const other = createAuthTokenService({ secret: "d".repeat(64), revocationStorePath: null });
    const foreignToken = other.signToken({ userId: "u1" });
    expect(service.revokeToken(foreignToken)).toBe(false);
  });

  it("refresh rotates: the old token is revoked and the new one works", () => {
    const service = createAuthTokenService({ secret: "e".repeat(64), revocationStorePath: null });
    const token = service.signToken({ userId: "u1" });
    const result = service.refreshToken(token);
    expect(result.success).toBe(true);
    expect(service.verifyToken(token).valid).toBe(false);
    expect(service.verifyToken(result.newToken).valid).toBe(true);
  });
});
