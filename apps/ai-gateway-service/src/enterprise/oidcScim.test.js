import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createOidcSsoService } from "./oidcSsoService.js";
import { createScimProvisioningService } from "./scimProvisioningService.js";
import { dispatchOidcScimRoutes, isOidcScimRoute } from "../http/oidcScimRoutes.js";
import { ROUTE_NOT_HANDLED } from "../http/httpRouteDispatch.js";

const workDir = mkdtempSync(join(tmpdir(), "uai-sso-"));
afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const ISSUER = "https://idp.example.com/realms/main";
const CLIENT_ID = "gateway";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-key-1";
const jwk = publicKey.export({ format: "jwk" });

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signIdToken({ sub = "user-42", aud = CLIENT_ID, iss = ISSUER, exp = Math.floor(Date.now() / 1000) + 600, email = "dev@example.com" } = {}, tamper = false) {
  const header = { alg: "RS256", typ: "JWT", kid: KID };
  const payload = { sub, aud, iss, exp, email, name: "Dev User" };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  let signature = createSign("RSA-SHA256").update(data).sign(privateKey);
  if (tamper) {
    signature = Buffer.from(signature);
    signature[signature.length - 1] ^= 0x01;
  }
  return `${data}.${signature.toString("base64url")}`;
}

function createFetchStub({ idToken }) {
  const tokenCalls = [];
  const fetchImpl = vi.fn(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/.well-known/openid-configuration")) {
      return jsonResponse(200, {
        authorization_endpoint: `${ISSUER}/protocol/openid_connect/auth`,
        token_endpoint: `${ISSUER}/protocol/openid_connect/token`,
        jwks_uri: `${ISSUER}/protocol/openid_connect/certs`,
      });
    }
    if (url.endsWith("/protocol/openid_connect/certs")) {
      return jsonResponse(200, { keys: [{ ...jwk, kid: KID, use: "sig", kty: "RSA", alg: "RS256" }] });
    }
    if (url.endsWith("/protocol/openid_connect/token")) {
      tokenCalls.push(new URLSearchParams(String(init?.body ?? "")));
      return jsonResponse(200, { id_token: typeof idToken === "function" ? idToken() : idToken, access_token: "at", token_type: "Bearer" });
    }
    return jsonResponse(404, {});
  });
  return { fetchImpl, tokenCalls };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const providerEnv = {
  AI_GATEWAY_OIDC_PROVIDERS_JSON: JSON.stringify([{
    id: "keycloak",
    issuerBaseUrl: ISSUER,
    clientId: CLIENT_ID,
    defaultTenantId: "tenant-sso",
    defaultRole: "viewer",
  }]),
};

describe("oidcSsoService", () => {
  it("runs the full code+PKCE flow, verifies the RS256 signature, and enrolls a user-store token", async () => {
    const usersPath = join(workDir, `users-${Date.now()}.json`);
    const idToken = signIdToken();
    const { fetchImpl, tokenCalls } = createFetchStub({ idToken });
    const sso = createOidcSsoService({ env: providerEnv, usersPath, fetchImpl });

    const redirectUri = "https://gw.example.com/enterprise/sso/oidc/keycloak/callback";
    const begin = await sso.beginLogin({ providerId: "keycloak", redirectUri });
    expect(begin.authorizationUrl).toContain("code_challenge_method=S256");
    const state = new URL(begin.authorizationUrl).searchParams.get("state");

    const result = await sso.completeLogin({ providerId: "keycloak", code: "auth-code-1", state, redirectUri });
    expect(result.identity.userId).toBe("sso:keycloak:user-42");
    expect(result.identity.tenantId).toBe("tenant-sso");
    expect(result.apiToken).toMatch(/^uai-sso_/);
    expect(result.created).toBe(true);

    // PKCE verifier 已在 token 交换中使用。
    expect(tokenCalls[0].get("code_verifier")).toHaveLength(64);
    expect(tokenCalls[0].get("client_id")).toBe(CLIENT_ID);

    // 二次登录:同一 SSO 用户刷新 token,不再新建记录。
    const begin2 = await sso.beginLogin({ providerId: "keycloak", redirectUri });
    const state2 = new URL(begin2.authorizationUrl).searchParams.get("state");
    const second = await sso.completeLogin({ providerId: "keycloak", code: "c2", state: state2, redirectUri });
    expect(second.created).toBe(false);
    expect(second.apiToken).not.toBe(result.apiToken);
  });

  it("rejects tampered signatures, bad states, mismatched issuers, and expired tokens", async () => {
    const usersPath = join(workDir, `users-sec-${Date.now()}.json`);
    const redirectUri = "https://gw.example.com/enterprise/sso/oidc/keycloak/callback";

    async function attempt(idTokenFactory) {
      const { fetchImpl } = createFetchStub({ idToken: idTokenFactory });
      const sso = createOidcSsoService({ env: providerEnv, usersPath, fetchImpl });
      const begin = await sso.beginLogin({ providerId: "keycloak", redirectUri });
      const state = new URL(begin.authorizationUrl).searchParams.get("state");
      return sso.completeLogin({ providerId: "keycloak", code: "x", state, redirectUri });
    }

    await expect(attempt(() => signIdToken({}, true))).rejects.toMatchObject({ code: "SSO_ID_TOKEN_SIGNATURE_INVALID" });
    await expect(attempt(() => signIdToken({ iss: "https://evil.example.com" }))).rejects.toMatchObject({ code: "SSO_ID_TOKEN_ISSUER_MISMATCH" });
    await expect(attempt(() => signIdToken({ aud: "other-client" }))).rejects.toMatchObject({ code: "SSO_ID_TOKEN_AUDIENCE_MISMATCH" });
    await expect(attempt(() => signIdToken({ exp: Math.floor(Date.now() / 1000) - 10 }))).rejects.toMatchObject({ code: "SSO_ID_TOKEN_EXPIRED" });

    // state 不可重放。
    const { fetchImpl } = createFetchStub({ idToken: signIdToken() });
    const sso = createOidcSsoService({ env: providerEnv, usersPath, fetchImpl });
    const begin = await sso.beginLogin({ providerId: "keycloak", redirectUri });
    const state = new URL(begin.authorizationUrl).searchParams.get("state");
    await sso.completeLogin({ providerId: "keycloak", code: "x", state, redirectUri });
    await expect(sso.completeLogin({ providerId: "keycloak", code: "x", state, redirectUri }))
      .rejects.toMatchObject({ code: "SSO_STATE_INVALID" });
    await expect(sso.completeLogin({ providerId: "keycloak", code: "x", state: randomBytes(12).toString("hex"), redirectUri }))
      .rejects.toMatchObject({ code: "SSO_STATE_INVALID" });
  });
});

describe("scimProvisioningService", () => {
  const scimEnv = { AI_GATEWAY_SCIM_BEARER_TOKEN: "scim-secret-token" };

  it("requires the bearer env and authenticates with timing-safe comparison", () => {
    const disabled = createScimProvisioningService({ env: {}, usersPath: join(workDir, "u.json") });
    expect(disabled.enabled).toBe(false);
    const scim = createScimProvisioningService({ env: scimEnv, usersPath: join(workDir, "u.json") });
    expect(scim.authorized({ headers: { authorization: "Bearer scim-secret-token" } })).toBe(true);
    expect(scim.authorized({ headers: { authorization: "Bearer wrong" } })).toBe(false);
    expect(scim.authorized({ headers: {} })).toBe(false);
  });

  it("creates, lists, patches, and deactivates users", () => {
    const usersPath = join(workDir, `scim-${Date.now()}.json`);
    const scim = createScimProvisioningService({ env: scimEnv, usersPath });

    const created = scim.createUser({ userName: "alice@example.com", tenantId: "t1", role: "viewer" });
    expect(created.status).toBe(201);
    expect(created.user.id).toBe("alice@example.com");
    expect(created.user.active).toBe(true);

    expect(scim.createUser({ userName: "alice@example.com" }).status).toBe(409);
    expect(scim.createUser({}).status).toBe(400);

    const listed = scim.listUsers({ filter: 'userName eq "alice@example.com"' });
    expect(listed.list.totalResults).toBe(1);
    expect(scim.listUsers({}).list.totalResults).toBe(1);

    const patched = scim.patchUser("alice@example.com", [{ op: "replace", path: "active", value: false }]);
    expect(patched.status).toBe(200);
    expect(patched.user.active).toBe(false);

    expect(scim.patchUser("alice@example.com", [{ op: "add", path: "active", value: true }]).status).toBe(400);
    expect(scim.patchUser("ghost@example.com", [{ op: "replace", path: "active", value: false }]).status).toBe(404);

    const fetched = scim.getUser("alice@example.com");
    expect(fetched.user.active).toBe(false);
    expect(scim.getStatus().supportedOperations).toContain("deactivate");
  });
});

describe("oidcScimRoutes dispatcher", () => {
  it("recognises SSO and SCIM paths and honors method semantics", async () => {
    expect(isOidcScimRoute("/enterprise/sso/oidc/keycloak/begin")).toBe(true);
    expect(isOidcScimRoute("/scim/v2/Users/alice")).toBe(true);
    expect(isOidcScimRoute("/v1/chat/completions")).toBe(false);

    const env = {
      ...providerEnv,
      AI_GATEWAY_SCIM_BEARER_TOKEN: "scim-secret-token",
      AI_GATEWAY_ENTERPRISE_USERS_PATH: join(workDir, `dispatcher-${Date.now()}.json`),
    };
    // SCIM 未配置时不接管(返回 NOT_HANDLED → 路由面 404)。
    const notHandled = await dispatchOidcScimRoutes(createContext({
      env: providerEnv,
      method: "GET",
      path: "/scim/v2/Users",
    }));
    expect(notHandled).toBe(ROUTE_NOT_HANDLED);

    const unauthorizedContext = createContext({ env, method: "GET", path: "/scim/v2/Users" });
    await dispatchOidcScimRoutes(unauthorizedContext);
    expect(unauthorizedContext.response.statusCode).toBe(401);

    const createContextAuthorized = createContext({ env, method: "POST", path: "/scim/v2/Users", body: { userName: "bob@example.com" }, headers: { authorization: "Bearer scim-secret-token" } });
    await dispatchOidcScimRoutes(createContextAuthorized);
    expect(createContextAuthorized.response.statusCode).toBe(201);

    const beginContext = createContext({ env, method: "GET", path: "/enterprise/sso/oidc/keycloak/begin", fetchImpl: createFetchStub({ idToken: signIdToken() }).fetchImpl });
    await dispatchOidcScimRoutes(beginContext);
    expect(beginContext.response.statusCode).toBe(302);
    expect(String(beginContext.response.headers.location)).toContain("code_challenge");
  });
});

function createContext({ env, method, path, body = null, headers = {}, fetchImpl }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
  request.method = method;
  request.headers = headers;
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.writableEnded = false;
  response.destroyed = false;
  response.headersSent = false;
  response.writeHead = (statusCode, writeHeaders = {}) => {
    response.statusCode = statusCode;
    response.headers = writeHeaders;
    response.headersSent = true;
  };
  response.write = () => true;
  response.end = (payload) => {
    if (payload !== undefined) {
      try {
        response.body = JSON.parse(String(payload));
      } catch {
        response.body = payload;
      }
    }
    response.writableEnded = true;
  };
  return {
    application: { runtimeEnv: env },
    request,
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1:4010${path}`),
    writeServiceLog: vi.fn(),
    ...(fetchImpl ? { fetchImpl } : {}),
  };
}

// 供 dispatcher 内部使用真实 origin 的 URL。
void createHash;
