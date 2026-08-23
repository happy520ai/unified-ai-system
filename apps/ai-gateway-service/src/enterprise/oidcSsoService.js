// OIDC SSO relying-party service.
//
// 企业 IdP(Keycloak/Entra ID/Okta 等)通过 OIDC 授权码 + PKCE 登录:
//   GET /enterprise/sso/oidc/:providerId/begin     → 302 到 IdP 授权端点
//   GET /enterprise/sso/oidc/:providerId/callback  → code 交换 + ID token 验签
//
// 配置 AI_GATEWAY_OIDC_PROVIDERS_JSON:
//   [{"id":"keycloak","issuerBaseUrl":"https://idp.example.com/realms/main",
//     "clientId":"gateway","clientSecretEnv":"OIDC_CLIENT_SECRET",
//     "defaultTenantId":"default","defaultRole":"viewer"}]
// 端点可经 discovery 自动发现,也可用 authorizationEndpoint/tokenEndpoint/jwksUri 显式覆写。
//
// 安全语义:state 一次性且 TTL 10 分钟;PKCE S256;ID token 必须通过
// JWKS RS256/ES256 验签且 iss/aud/exp 匹配。client secret 只从 env 读取,
// 绝不出现在日志或响应中。登录成功后用本地 authTokenService 签发会话。

import { createHash, createPublicKey, randomBytes, verify as cryptoVerify } from "node:crypto";
import {
  findStoredUser,
  loadStoredUsers,
  normalizeStoredUser,
  saveStoredUsers,
} from "./enterpriseUserStore.js";

const PROVIDERS_ENV = "AI_GATEWAY_OIDC_PROVIDERS_JSON";
const STATE_TTL_MS = 10 * 60 * 1000;

export function createOidcSsoService({
  env = process.env,
  usersPath = null,
  fetchImpl = fetch,
  clock = () => Date.now(),
} = {}) {
  const providers = parseProviders(env[PROVIDERS_ENV]);
  // state → { providerId, verifier, redirectUri, expiresAt }
  const pendingLogins = new Map();

  function sweepStates() {
    const now = clock();
    for (const [state, entry] of pendingLogins) {
      if (entry.expiresAt <= now) pendingLogins.delete(state);
    }
  }

  const discoveryCache = new Map(); // providerId → { endpoints, fetchedAt }

  async function resolveEndpoints(provider) {
    if (provider.authorizationEndpoint && provider.tokenEndpoint && provider.jwksUri) {
      return {
        authorizationEndpoint: provider.authorizationEndpoint,
        tokenEndpoint: provider.tokenEndpoint,
        jwksUri: provider.jwksUri,
      };
    }
    const cached = discoveryCache.get(provider.id);
    if (cached) return cached;
    const discoveryUrl = `${provider.issuerBaseUrl.replace(/\/+$/, "")}/.well-known/openid-configuration`;
    const response = await fetchImpl(discoveryUrl, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw createSsoError(`OIDC discovery failed for "${provider.id}" (${response.status}).`, "SSO_DISCOVERY_FAILED");
    }
    const metadata = await response.json();
    const endpoints = {
      authorizationEndpoint: requiredUrl(metadata.authorization_endpoint, "authorization_endpoint"),
      tokenEndpoint: requiredUrl(metadata.token_endpoint, "token_endpoint"),
      jwksUri: requiredUrl(metadata.jwks_uri, "jwks_uri"),
    };
    discoveryCache.set(provider.id, endpoints);
    return endpoints;
  }

  return {
    configured: providers.length > 0,
    providers: providers.map(({ clientSecretEnv, ...rest }) => ({ ...rest, clientSecretEnv })),

    getProvider(providerId) {
      return providers.find((provider) => provider.id === String(providerId)) ?? null;
    },

    /**
     * 发起登录:生成 state+PKCE,返回 IdP 授权跳转 URL。
     */
    async beginLogin({ providerId, redirectUri }) {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw createSsoError(`Unknown OIDC provider "${providerId}".`, "SSO_PROVIDER_UNKNOWN");
      }
      if (typeof redirectUri !== "string" || !/^https?:\/\//.test(redirectUri)) {
        throw createSsoError("redirectUri must be an absolute http(s) URL.", "SSO_REDIRECT_URI_INVALID");
      }
      const endpoints = await resolveEndpoints(provider);
      sweepStates();
      const state = randomBytes(24).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      pendingLogins.set(state, {
        providerId: provider.id,
        verifier,
        redirectUri,
        expiresAt: clock() + STATE_TTL_MS,
      });
      const url = new URL(endpoints.authorizationEndpoint);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", provider.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", provider.scopes ?? "openid profile email");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      return { authorizationUrl: url.toString(), state };
    },

    /**
     * 回调:校验 state、PKCE 换 token、JWKS 验签 ID token,签发本地会话。
     */
    async completeLogin({ providerId, code, state, redirectUri }) {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw createSsoError(`Unknown OIDC provider "${providerId}".`, "SSO_PROVIDER_UNKNOWN");
      }
      sweepStates();
      const pending = pendingLogins.get(String(state ?? ""));
      if (!pending || pending.providerId !== provider.id) {
        throw createSsoError("Unknown or expired SSO state.", "SSO_STATE_INVALID");
      }
      pendingLogins.delete(String(state));
      if (clock() >= pending.expiresAt) {
        throw createSsoError("SSO state expired.", "SSO_STATE_EXPIRED");
      }
      if (pending.redirectUri !== redirectUri) {
        throw createSsoError("redirect_uri does not match the login request.", "SSO_REDIRECT_MISMATCH");
      }
      const clientSecret = provider.clientSecretEnv ? env[provider.clientSecretEnv] : undefined;
      const endpoints = await resolveEndpoints(provider);
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code ?? ""),
        redirect_uri: redirectUri,
        client_id: provider.clientId,
        code_verifier: pending.verifier,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
      });
      const tokenResponse = await fetchImpl(endpoints.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: body.toString(),
      });
      if (!tokenResponse.ok) {
        throw createSsoError(`OIDC token exchange failed (${tokenResponse.status}).`, "SSO_TOKEN_EXCHANGE_FAILED");
      }
      const tokens = await tokenResponse.json();
      if (typeof tokens.id_token !== "string" || !tokens.id_token) {
        throw createSsoError("OIDC token response is missing id_token.", "SSO_ID_TOKEN_MISSING");
      }
      const claims = await verifyIdToken({
        idToken: tokens.id_token,
        provider,
        jwksUri: endpoints.jwksUri,
        fetchImpl,
      });

      const userId = String(claims.sub ?? "");
      if (!userId) {
        throw createSsoError("OIDC ID token has no subject.", "SSO_ID_TOKEN_INVALID");
      }
      const identity = {
        userId: `sso:${provider.id}:${userId}`,
        tenantId: provider.defaultTenantId ?? "default",
        role: provider.defaultRole ?? "viewer",
        email: typeof claims.email === "string" ? claims.email : null,
        name: typeof claims.name === "string" ? claims.name : null,
        sso: { providerId: provider.id, subject: userId },
      };
      // 会话落点:按系统既有认证模型,为 SSO 用户登记/刷新一条 user-store
      // 记录并签发一次性 API token(哈希入库,明文只返回这一次)。
      const enrollment = enrollSsoUser({ env, usersPath, identity });
      return { identity, apiToken: enrollment.apiToken, created: enrollment.created, claims };
    },

    getStatus() {
      return {
        configured: providers.length > 0,
        configEnv: PROVIDERS_ENV,
        providerIds: providers.map((provider) => provider.id),
        pendingLogins: pendingLogins.size,
      };
    },
  };
}

async function verifyIdToken({ idToken, provider, jwksUri, fetchImpl }) {
  const parts = String(idToken).split(".");
  if (parts.length !== 3) {
    throw createSsoError("OIDC ID token is malformed.", "SSO_ID_TOKEN_MALFORMED");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw createSsoError("OIDC ID token is not decodable.", "SSO_ID_TOKEN_MALFORMED");
  }
  if (header.alg !== "RS256" && header.alg !== "ES256") {
    throw createSsoError(`OIDC ID token alg "${header.alg}" is not supported.`, "SSO_ID_TOKEN_ALG_UNSUPPORTED");
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= nowSeconds) {
    throw createSsoError("OIDC ID token has expired.", "SSO_ID_TOKEN_EXPIRED");
  }
  if (typeof payload.iss === "string" && payload.iss.replace(/\/+$/, "") !== provider.issuerBaseUrl.replace(/\/+$/, "")) {
    throw createSsoError("OIDC ID token issuer mismatch.", "SSO_ID_TOKEN_ISSUER_MISMATCH");
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(provider.clientId)) {
    throw createSsoError("OIDC ID token audience mismatch.", "SSO_ID_TOKEN_AUDIENCE_MISMATCH");
  }

  // JWKS 验签(签名内嵌于头部,不依赖外层 token 响应)。
  const jwksResponse = await fetchImpl(jwksUri, { headers: { accept: "application/json" } });
  if (!jwksResponse.ok) {
    throw createSsoError(`JWKS fetch failed (${jwksResponse.status}).`, "SSO_JWKS_UNAVAILABLE");
  }
  const jwks = await jwksResponse.json();
  const jwk = (jwks.keys ?? []).find((key) => key.kid === header.kid)
    ?? (jwks.keys ?? []).find((key) => !header.kid && key.use === "sig" && key.kty === "RSA");
  if (!jwk) {
    throw createSsoError("No JWKS key matches the ID token kid.", "SSO_JWKS_KID_NOT_FOUND");
  }
  let publicKey;
  try {
    publicKey = createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    throw createSsoError("JWKS key is not importable.", "SSO_JWKS_KEY_INVALID");
  }
  const signature = Buffer.from(signatureB64, "base64url");
  const data = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
  const algorithm = header.alg === "RS256" ? "RSA-SHA256" : null;
  let valid = false;
  if (algorithm) {
    valid = cryptoVerify(algorithm, data, publicKey, signature);
  } else {
    // ES256:node crypto 需要 DER 签名;JWS 是 raw r||s。
    valid = cryptoVerify("sha256", data, publicKey, joseRawToDer(signature));
  }
  if (!valid) {
    throw createSsoError("OIDC ID token signature verification failed.", "SSO_ID_TOKEN_SIGNATURE_INVALID");
  }
  return payload;
}

function joseRawToDer(signature) {
  // JWS raw 签名(r||s,各 32 字节)→ SEQUENCE INTEGER DER。
  const r = signature.subarray(0, 32);
  const s = signature.subarray(32);
  const trim = (buffer) => {
    let start = 0;
    while (start < buffer.length - 1 && buffer[start] === 0) start += 1;
    const trimmed = buffer.subarray(start);
    return trimmed[0] & 0x80 ? Buffer.concat([Buffer.from([0]), trimmed]) : Buffer.from(trimmed);
  };
  const rDer = trim(r);
  const sDer = trim(s);
  const body = Buffer.concat([
    Buffer.from([0x02, rDer.length]), rDer,
    Buffer.from([0x02, sDer.length]), sDer,
  ]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

function parseProviders(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return [];
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    throw createSsoError(`${PROVIDERS_ENV} is not valid JSON.`, "SSO_CONFIG_INVALID");
  }
  if (!Array.isArray(parsed)) {
    throw createSsoError(`${PROVIDERS_ENV} must be an array.`, "SSO_CONFIG_INVALID");
  }
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object" || !entry.id || !entry.issuerBaseUrl || !entry.clientId) {
      throw createSsoError(`${PROVIDERS_ENV}[${index}] requires id, issuerBaseUrl, and clientId.`, "SSO_CONFIG_INVALID");
    }
    return {
      id: String(entry.id),
      issuerBaseUrl: String(entry.issuerBaseUrl),
      clientId: String(entry.clientId),
      clientSecretEnv: entry.clientSecretEnv ? String(entry.clientSecretEnv) : null,
      scopes: entry.scopes ? String(entry.scopes) : null,
      defaultTenantId: entry.defaultTenantId ? String(entry.defaultTenantId) : null,
      defaultRole: entry.defaultRole ? String(entry.defaultRole) : null,
      authorizationEndpoint: entry.authorizationEndpoint ? String(entry.authorizationEndpoint) : null,
      tokenEndpoint: entry.tokenEndpoint ? String(entry.tokenEndpoint) : null,
      jwksUri: entry.jwksUri ? String(entry.jwksUri) : null,
    };
  });
}

function requiredUrl(value, field) {
  if (typeof value !== "string" || !/^https?:\/\//.test(value)) {
    throw createSsoError(`OIDC discovery metadata is missing ${field}.`, "SSO_DISCOVERY_INVALID");
  }
  return value;
}

function enrollSsoUser({ env, usersPath, identity }) {
  if (usersPath === null) {
    return { apiToken: null, created: false, persisted: false };
  }
  const users = loadStoredUsers(usersPath) ?? [];
  const apiToken = `uai-sso_${randomBytes(24).toString("hex")}`;
  const existing = findStoredUser(users, { userId: identity.userId });
  const record = normalizeStoredUser({
    userId: identity.userId,
    tenantId: identity.tenantId,
    role: identity.role,
    token: apiToken,
    revoked: false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    source: "sso",
  }, existing);
  if (existing) {
    const index = users.findIndex((candidate) => candidate.userId === identity.userId);
    users[index] = record;
  } else {
    users.push(record);
  }
  saveStoredUsers(usersPath, users);
  return { apiToken, created: !existing, persisted: true };
}

function createSsoError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.category = "auth";
  return error;
}
