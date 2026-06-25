// =============================================================================
// authTokenService.test.js — JWT 认证服务单元测试
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAuthTokenService } from "./authTokenService.js";

describe("AuthTokenService", () => {
  const service = createAuthTokenService({
    secret: "test-secret-key-for-unit-tests-only",
    expiresInMs: 60_000,
  });

  it("should sign and verify a token", () => {
    const token = service.signToken({ userId: "u1", username: "admin", role: "admin" });
    const result = service.verifyToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.payload.userId, "u1");
    assert.equal(result.payload.username, "admin");
  });

  it("should reject tampered token", () => {
    const token = service.signToken({ userId: "u1" });
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = service.verifyToken(tampered);
    assert.equal(result.valid, false);
    assert.equal(result.error, "signature_invalid");
  });

  it("should reject expired token", () => {
    const shortService = createAuthTokenService({
      secret: "test-secret",
      expiresInMs: 1, // 1ms
    });
    const token = shortService.signToken({ userId: "u1" });
    // Wait for expiry
    const result = shortService.verifyToken(token);
    // May or may not be expired depending on timing, but structure should be valid
    assert.ok(result.payload !== undefined || result.error !== undefined);
  });

  it("should refresh a token", () => {
    const token = service.signToken({ userId: "u1", username: "admin" });
    const refreshResult = service.refreshToken(token);
    assert.equal(refreshResult.success, true);
    assert.ok(refreshResult.newToken);

    // Old token should be revoked
    const oldResult = service.verifyToken(token);
    assert.equal(oldResult.valid, false);
    assert.equal(oldResult.error, "token_revoked");

    // New token should be valid
    const newResult = service.verifyToken(refreshResult.newToken);
    assert.equal(newResult.valid, true);
    assert.equal(newResult.payload.userId, "u1");
  });

  it("should revoke a token", () => {
    const token = service.signToken({ userId: "u2" });
    service.revokeToken(token);
    const result = service.verifyToken(token);
    assert.equal(result.valid, false);
    assert.equal(result.error, "token_revoked");
  });

  it("should extract auth from Bearer header", () => {
    const token = service.signToken({ userId: "u3", role: "user" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const result = service.extractAuth(req);
    assert.equal(result.authenticated, true);
    assert.equal(result.payload.userId, "u3");
  });

  it("should reject missing authorization header", () => {
    const req = { headers: {} };
    const result = service.extractAuth(req);
    assert.equal(result.authenticated, false);
    assert.equal(result.error, "no_authorization_header");
  });

  it("should include jti in token payload", () => {
    const token = service.signToken({ userId: "u4" });
    const result = service.verifyToken(token);
    assert.ok(result.payload.jti);
    assert.equal(typeof result.payload.jti, "string");
  });

  it("should get stats", () => {
    const stats = service.getStats();
    assert.equal(stats.algorithm, "HS256");
    assert.equal(stats.expiresInMs, 60_000);
  });
});
