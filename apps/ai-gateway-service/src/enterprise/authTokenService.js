// =============================================================================
// authTokenService.js — JWT Token 认证服务
// 基于 HMAC-SHA256，复用 enterpriseGovernanceService 用户体系
// 无外部依赖，使用 node:crypto
// =============================================================================

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ALGORITHM = "HS256";
const DEFAULT_EXPIRES_IN_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_REFRESH_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7d

/**
 * 创建认证 Token 服务
 * @param {Object} options
 * @returns {Object} { signToken, verifyToken, refreshToken, authenticateUser, authMiddleware }
 */
export function createAuthTokenService(options = {}) {
  const secret = options.secret ?? process.env.AUTH_TOKEN_SECRET ?? randomBytes(32).toString("hex");
  const expiresInMs = options.expiresInMs ?? DEFAULT_EXPIRES_IN_MS;
  const refreshExpiresInMs = options.refreshExpiresInMs ?? DEFAULT_REFRESH_EXPIRES_IN_MS;
  const enterpriseGovernanceService = options.enterpriseGovernanceService;

  // Revocation list keyed by jti with the token's exp. Persisted to disk so
  // revocations survive restarts; expired entries are purged instead of
  // blindly evicting the oldest (which could resurrect a revoked token).
  const revokedJtis = new Map();
  const MAX_BLACKLIST_SIZE = 10000;
  const revocationStorePath = options.revocationStorePath === null
    ? null
    : resolve(options.revocationStorePath ?? ".data/enterprise/revoked-jtis.json");

  function loadRevocations() {
    if (!revocationStorePath) return;
    try {
      if (!existsSync(revocationStorePath)) return;
      const parsed = JSON.parse(readFileSync(revocationStorePath, "utf8"));
      const now = Date.now();
      for (const [jti, exp] of Object.entries(parsed ?? {})) {
        if (typeof jti === "string" && jti && Number.isFinite(Number(exp)) && Number(exp) > now) {
          revokedJtis.set(jti, Number(exp));
        }
      }
    } catch {
      // A corrupted revocation store must not brick the service; it starts
      // empty and the next revoke rewrites it.
    }
  }

  function persistRevocations() {
    if (!revocationStorePath) return;
    try {
      mkdirSync(dirname(revocationStorePath), { recursive: true });
      writeFileSync(revocationStorePath, JSON.stringify(Object.fromEntries(revokedJtis)), "utf8");
    } catch {
      // Persistence failures degrade to in-memory revocation only.
    }
  }

  function purgeExpiredRevocations() {
    const now = Date.now();
    for (const [jti, exp] of revokedJtis) {
      if (exp <= now) revokedJtis.delete(jti);
    }
  }

  loadRevocations();

  /**
   * Base64url 编码
   */
  function base64url(input) {
    return Buffer.from(input)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  /**
   * Base64url 解码
   */
  function base64urlDecode(input) {
    let str = input.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    return Buffer.from(str, "base64").toString("utf8");
  }

  /**
   * HMAC-SHA256 签名
   */
  function hmacSign(data) {
    return createHmac("sha256", secret).update(data).digest("base64url");
  }

  /**
   * 签发 Token
   * @param {Object} payload - { userId, username, role, permissions }
   * @param {Object} opts - { expiresInMs }
   * @returns {string} JWT token
   */
  function signToken(payload, opts = {}) {
    const now = Date.now();
    const exp = now + (opts.expiresInMs ?? expiresInMs);

    const header = { alg: ALGORITHM, typ: "JWT" };
    const tokenPayload = {
      ...payload,
      iat: now,
      exp,
      jti: randomBytes(8).toString("hex"),
    };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(tokenPayload));
    const signature = hmacSign(`${headerB64}.${payloadB64}`);

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * 验证 Token
   * @param {string} token
   * @returns {Object} { valid, payload, error }
   */
  function verifyToken(token) {
    if (!token || typeof token !== "string") {
      return { valid: false, error: "token_missing" };
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "token_malformed" };
    }

    const [headerB64, payloadB64, signature] = parts;

    // 验证签名
    const expectedSignature = hmacSign(`${headerB64}.${payloadB64}`);
    try {
      const sigBuf = Buffer.from(signature, "base64url");
      const expectedBuf = Buffer.from(expectedSignature, "base64url");
      if (!timingSafeEqual(sigBuf, expectedBuf)) {
        return { valid: false, error: "signature_invalid" };
      }
    } catch {
      return { valid: false, error: "signature_invalid" };
    }

    // 解析 payload
    try {
      const payload = JSON.parse(base64urlDecode(payloadB64));

      // 检查撤销（jti 级，重启与淘汰均不失效）
      if (payload.jti && revokedJtis.has(payload.jti)) {
        return { valid: false, error: "token_revoked", payload };
      }

      // 检查过期
      if (payload.exp && Date.now() > payload.exp) {
        return { valid: false, error: "token_expired", payload };
      }

      return { valid: true, payload };
    } catch {
      return { valid: false, error: "payload_malformed" };
    }
  }

  /**
   * 刷新 Token（仅未过期 Token 可刷新旋转；过期 Token 必须重新认证）
   * @param {string} token
   * @returns {Object} { success, newToken, error }
   */
  function refreshToken(token) {
    const result = verifyToken(token);
    if (!result.valid) {
      return { success: false, error: result.error };
    }

    // 撤销旧 Token
    revokeToken(token);

    // 签发新 Token
    const { iat, exp, jti, ...payload } = result.payload;
    const newToken = signToken(payload);

    return { success: true, newToken };
  }

  /**
   * 撤销 Token（签名校验通过后按 jti 撤销；返回是否真实撤销）
   */
  function revokeToken(token) {
    if (!token || typeof token !== "string") return false;

    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSignature = hmacSign(`${headerB64}.${payloadB64}`);
    try {
      const sigBuf = Buffer.from(signature, "base64url");
      const expectedBuf = Buffer.from(expectedSignature, "base64url");
      if (!timingSafeEqual(sigBuf, expectedBuf)) return false;
    } catch {
      return false;
    }

    let payload;
    try {
      payload = JSON.parse(base64urlDecode(payloadB64));
    } catch {
      return false;
    }
    if (!payload?.jti) return false;

    purgeExpiredRevocations();
    revokedJtis.set(payload.jti, Number(payload.exp ?? Date.now() + expiresInMs));

    // 超上限时淘汰"最临近自然过期"的条目（而非最早插入的），已过期的先清
    if (revokedJtis.size > MAX_BLACKLIST_SIZE) {
      let soonest = null;
      for (const [jti, exp] of revokedJtis) {
        if (!soonest || exp < soonest.exp) soonest = { jti, exp };
      }
      if (soonest) revokedJtis.delete(soonest.jti);
    }

    persistRevocations();
    return true;
  }

  /**
   * 用户认证（复用企业认证）
   * @param {string} username
   * @param {string} password
   * @returns {Object} { success, token, user, error }
   */
  function authenticateUser(username, password) {
    if (!enterpriseGovernanceService) {
      return { success: false, error: "auth_service_unavailable" };
    }

    try {
      // 调用企业认证服务验证用户
      const user = enterpriseGovernanceService.authenticateUser?.(username, password);
      if (!user) {
        return { success: false, error: "invalid_credentials" };
      }

      // 签发 Token
      const token = signToken({
        userId: user.id ?? user.userId,
        username: user.username,
        role: user.role,
        permissions: user.permissions ?? [],
      });

      return { success: true, token, user: { username: user.username, role: user.role } };
    } catch (error) {
      return { success: false, error: error.message ?? "authentication_failed" };
    }
  }

  /**
   * HTTP 认证中间件
   * @param {Object} req - HTTP 请求
   * @returns {Object} { authenticated, payload, error }
   */
  function extractAuth(req) {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
      return { authenticated: false, error: "no_authorization_header" };
    }

    // Bearer token
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const result = verifyToken(token);
      return {
        authenticated: result.valid,
        payload: result.payload,
        error: result.error,
      };
    }

    // API Key（向后兼容）
    if (authHeader.startsWith("ApiKey ")) {
      const apiKey = authHeader.slice(7).trim();
      // 简单 API Key 验证（可扩展为数据库查询）
      if (enterpriseGovernanceService?.validateApiKey?.(apiKey)) {
        return { authenticated: true, payload: { authMethod: "api_key" } };
      }
      return { authenticated: false, error: "invalid_api_key" };
    }

    return { authenticated: false, error: "unsupported_auth_scheme" };
  }

  /**
   * 获取认证统计
   */
  function getStats() {
    return {
      algorithm: ALGORITHM,
      expiresInMs,
      refreshExpiresInMs,
      blacklistSize: revokedJtis.size,
      maxBlacklistSize: MAX_BLACKLIST_SIZE,
      revocationPersisted: Boolean(revocationStorePath),
      secretConfigured: !!options.secret || !!process.env.AUTH_TOKEN_SECRET,
    };
  }

  return {
    signToken,
    verifyToken,
    refreshToken,
    revokeToken,
    authenticateUser,
    extractAuth,
    getStats,
  };
}
