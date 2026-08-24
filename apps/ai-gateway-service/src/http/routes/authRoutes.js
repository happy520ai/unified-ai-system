// =============================================================================
// authRoutes.js — 认证路由模块
// POST /auth/login — 用户名密码登录
// POST /auth/refresh — Token 刷新
// POST /auth/revoke — Token 撤销
// GET  /auth/status — 认证状态
// =============================================================================

import { createHash, timingSafeEqual } from "node:crypto";

function safeCredentialEqual(actual, expected) {
  const actualDigest = createHash("sha256").update(String(actual ?? "")).digest();
  const expectedDigest = createHash("sha256").update(String(expected ?? "")).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

/**
 * 创建认证路由 handler 集合
 * @param {Object} application - Gateway application context
 * @param {Object} helpers - { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope }
 */
export function createAuthRoutes(application, helpers, env = process.env) {
  const { authTokenService } = application;
  const { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope } = helpers;

  const adminUsername = typeof env.ADMIN_USERNAME === "string" ? env.ADMIN_USERNAME.trim() : "";
  const adminPassword = typeof env.ADMIN_PASSWORD === "string" ? env.ADMIN_PASSWORD : "";
  const passwordLoginConfigured = Boolean(adminUsername && adminPassword && authTokenService);

  // ── POST /auth/login ──
  async function handleLogin(req, res, { startedAt, body }) {
    if (!body || typeof body !== "object") {
      writeJson(res, 400, createErrorEnvelope(
        "auth_invalid_json",
        "Login request body must be valid JSON with username and password.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    const { username, password } = body;

    if (!username || typeof username !== "string") {
      writeJson(res, 400, createErrorEnvelope(
        "auth_missing_username",
        "Username is required.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    if (!password || typeof password !== "string") {
      writeJson(res, 400, createErrorEnvelope(
        "auth_missing_password",
        "Password is required.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    // 尝试通过 authTokenService 认证（如果 enterpriseGovernanceService 支持）
    let authResult = null;
    if (authTokenService && typeof authTokenService.authenticateUser === "function") {
      authResult = authTokenService.authenticateUser(username, password);
      if (authResult && authResult.success) {
        writeServiceLog("auth_login_success", {
          method: "POST",
          path: "/auth/login",
          durationMs: Date.now() - startedAt,
        });
        writeJson(res, 200, createOkEnvelope({
          token: authResult.token,
          user: authResult.user,
          expiresIn: 86400,
        }, { startedAt }));
        return;
      }
    }

    // Explicit opt-in only. There are no development fallback credentials.
    if (
      passwordLoginConfigured
      && safeCredentialEqual(username, adminUsername)
      && safeCredentialEqual(password, adminPassword)
    ) {
      const token = authTokenService.signToken({ userId: "admin", username, role: "admin", permissions: ["*"] });

      writeServiceLog("auth_login_success", {
        method: "POST",
        path: "/auth/login",
        durationMs: Date.now() - startedAt,
      });

      writeJson(res, 200, createOkEnvelope({
        token,
        user: { username, role: "admin" },
        expiresIn: 86400,
      }, { startedAt }));
      return;
    }

    writeServiceLog("auth_login_failed", {
      method: "POST",
      path: "/auth/login",
      reason: passwordLoginConfigured ? "invalid_credentials" : "password_login_disabled",
      durationMs: Date.now() - startedAt,
    });

    writeJson(res, 401, createErrorEnvelope(
      "auth_invalid_credentials",
      "Invalid username or password.",
      { startedAt, category: "auth" },
    ));
  }

  // ── POST /auth/refresh ──
  async function handleRefresh(req, res, { startedAt, body }) {
    if (!body || !body.token) {
      writeJson(res, 400, createErrorEnvelope(
        "auth_refresh_missing_token",
        "Token is required for refresh.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    if (!authTokenService) {
      writeJson(res, 503, createErrorEnvelope(
        "auth_service_unavailable",
        "Auth token service is not available.",
        { startedAt, category: "internal" },
      ));
      return;
    }

    const result = authTokenService.refreshToken(body.token);
    if (result.success) {
      writeJson(res, 200, createOkEnvelope({
        token: result.newToken,
        expiresIn: 86400,
      }, { startedAt }));
    } else {
      writeJson(res, 401, createErrorEnvelope(
        "auth_refresh_failed",
        result.error || "Token refresh failed.",
        { startedAt, category: "auth" },
      ));
    }
  }

  // ── POST /auth/revoke ──
  async function handleRevoke(req, res, { startedAt, body }) {
    if (!body || !body.token) {
      writeJson(res, 400, createErrorEnvelope(
        "auth_revoke_missing_token",
        "Token is required for revocation.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    if (!authTokenService) {
      writeJson(res, 503, createErrorEnvelope(
        "auth_service_unavailable",
        "Auth token service is not available.",
        { startedAt, category: "internal" },
      ));
      return;
    }

    // Revocation is self-service logout: only a correctly signed token can be
    // revoked, so anonymous callers cannot flood the revocation store.
    const revoked = authTokenService.revokeToken(body.token);
    if (!revoked) {
      writeJson(res, 401, createErrorEnvelope(
        "auth_revoke_invalid_token",
        "A valid signed token is required for revocation.",
        { startedAt, category: "auth" },
      ));
      return;
    }
    writeJson(res, 200, createOkEnvelope({ revoked: true }, { startedAt }));
  }

  // ── GET /auth/status ──
  // Public surface: booleans only. Token service internals (algorithm,
  // revocation counts) are not unauthenticated reconnaissance material.
  async function handleStatus(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({
      authEnabled: Boolean(authTokenService),
      tokenService: !!authTokenService,
      passwordLoginConfigured,
    }, { startedAt }));
  }

  const handlers = new Map();
  handlers.set("POST /auth/login", { handler: handleLogin });
  handlers.set("POST /auth/refresh", { handler: handleRefresh });
  handlers.set("POST /auth/revoke", { handler: handleRevoke });
  handlers.set("GET /auth/status", { handler: handleStatus });

  return { handlers };
}
