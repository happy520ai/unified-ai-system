// =============================================================================
// authRoutes.js — 认证路由模块
// POST /auth/login — 用户名密码登录
// POST /auth/refresh — Token 刷新
// POST /auth/revoke — Token 撤销
// GET  /auth/status — 认证状态
// =============================================================================

/**
 * 创建认证路由 handler 集合
 * @param {Object} application - Gateway application context
 * @param {Object} helpers - { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope }
 * @returns {Object} { handlers: Map<string, { handler: Function }> }
 */
export function createAuthRoutes(application, helpers) {
  const { authTokenService } = application;
  const { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope } = helpers;

  // In production, credentials MUST be set via environment variables
  const isProduction = process.env.NODE_ENV === "production";
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || (isProduction ? null : "admin");
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (isProduction ? null : "changeme");

  if (isProduction && (!ADMIN_USERNAME || !ADMIN_PASSWORD)) {
    console.error("[auth] CRITICAL: ADMIN_USERNAME and ADMIN_PASSWORD must be set in production");
  }

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
          username,
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

    // 回退：环境变量验证
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = authTokenService
        ? authTokenService.signToken({ userId: "admin", username, role: "admin", permissions: ["*"] })
        : null;

      writeServiceLog("auth_login_success", {
        method: "POST",
        path: "/auth/login",
        username,
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
      username,
      reason: "invalid_credentials",
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

    authTokenService.revokeToken(body.token);
    writeJson(res, 200, createOkEnvelope({ revoked: true }, { startedAt }));
  }

  // ── GET /auth/status ──
  async function handleStatus(_req, res, { startedAt }) {
    const stats = authTokenService ? authTokenService.getStats() : null;
    writeJson(res, 200, createOkEnvelope({
      authEnabled: true,
      tokenService: !!authTokenService,
      stats,
    }, { startedAt }));
  }

  const handlers = new Map();
  handlers.set("POST /auth/login", { handler: handleLogin });
  handlers.set("POST /auth/refresh", { handler: handleRefresh });
  handlers.set("POST /auth/revoke", { handler: handleRevoke });
  handlers.set("GET /auth/status", { handler: handleStatus });

  return { handlers };
}
