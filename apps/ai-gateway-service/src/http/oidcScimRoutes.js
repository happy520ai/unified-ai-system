// OIDC SSO + SCIM provisioning routes.
//
// GET /enterprise/sso/oidc/:providerId/begin      → 302 到 IdP 授权端点
// GET /enterprise/sso/oidc/:providerId/callback    → 完成 PKCE 交换+验签,登记 SSO 用户并签发 API token
// POST/GET/PATCH/DELETE /scim/v2/Users[/:id]       → SCIM 2.0 供给(Bearer 鉴权)
//
// SSO begin/callback 是 IdP 回跳面,靠一次性 state 防伪,按公共路由放行;
// SCIM 面未配置 Bearer token 时整体禁用(404),配置后由服务自身鉴权。

import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { createOidcSsoService } from "../enterprise/oidcSsoService.js";
import { createScimProvisioningService } from "../enterprise/scimProvisioningService.js";

const SSO_BEGIN_PATTERN = /^\/enterprise\/sso\/oidc\/([A-Za-z0-9._-]+)\/begin\/?$/;
const SSO_CALLBACK_PATTERN = /^\/enterprise\/sso\/oidc\/([A-Za-z0-9._-]+)\/callback\/?$/;
const SCIM_USERS_PATTERN = /^\/scim\/v2\/Users\/([^/]+)$/;
const SCIM_USERS_PATH = "/scim/v2/Users";
const oidcServices = new WeakMap();

export function isOidcScimRoute(pathname) {
  const path = String(pathname ?? "").replace(/\/+$/, "") || "/";
  return SSO_BEGIN_PATTERN.test(path)
    || SSO_CALLBACK_PATTERN.test(path)
    || path === SCIM_USERS_PATH
    || SCIM_USERS_PATTERN.test(path);
}

export function dispatchOidcScimRoutes(context) {
  const { application, request, response, startedAt, url, writeServiceLog } = context;
  const env = application?.runtimeEnv ?? process.env;
  // 用户存储路径可配置(测试注入/多实例共享均受益)。
  const usersPath = env.AI_GATEWAY_ENTERPRISE_USERS_PATH
    || env.PME_ENTERPRISE_USER_STORE_PATH
    || ".data/enterprise/users.json";

  const path = url.pathname.replace(/\/+$/, "") || "/";

  const beginMatch = SSO_BEGIN_PATTERN.exec(path);
  if (request.method === "GET" && beginMatch) {
    const sso = getOidcService({ application, env, usersPath, fetchImpl: context.fetchImpl });
    return handleSsoBegin({ sso, providerId: beginMatch[1], request, response, url, startedAt, writeServiceLog });
  }

  const callbackMatch = SSO_CALLBACK_PATTERN.exec(path);
  if (request.method === "GET" && callbackMatch) {
    const sso = getOidcService({ application, env, usersPath, fetchImpl: context.fetchImpl });
    return handleSsoCallback({ application, sso, providerId: callbackMatch[1], request, response, url, startedAt, writeServiceLog });
  }

  if (path === SCIM_USERS_PATH || SCIM_USERS_PATTERN.test(path)) {
    return handleScim({ application, env, request, response, url, startedAt, writeServiceLog, usersPath });
  }

  return ROUTE_NOT_HANDLED;
}

function getOidcService({ application, env, usersPath, fetchImpl }) {
  if (application && oidcServices.has(application)) {
    return oidcServices.get(application);
  }
  const sso = createOidcSsoService({
    env,
    usersPath,
    ...(typeof fetchImpl === "function" ? { fetchImpl } : {}),
  });
  if (application && typeof application === "object") {
    oidcServices.set(application, sso);
  }
  return sso;
}

async function handleSsoBegin({ sso, providerId, request, response, url, startedAt, writeServiceLog }) {
  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/enterprise/sso/oidc/${encodeURIComponent(providerId)}/callback`;
  try {
    const { authorizationUrl } = await sso.beginLogin({ providerId, redirectUri });
    writeServiceLog?.("oidc_sso_begin", {
      method: "GET",
      path: url.pathname,
      providerId,
      durationMs: Date.now() - startedAt,
    });
    response.writeHead(302, { location: authorizationUrl });
    response.end();
  } catch (error) {
    writeServiceLog?.("oidc_sso_begin_failed", {
      method: "GET",
      path: url.pathname,
      providerId,
      code: error?.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, {
      error: {
        code: error?.code ?? "SSO_BEGIN_FAILED",
        message: error?.message ?? "SSO login could not be started.",
      },
    });
  }
}

async function handleSsoCallback({ application, sso, providerId, request, response, url, startedAt, writeServiceLog }) {
  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/enterprise/sso/oidc/${encodeURIComponent(providerId)}/callback`;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  try {
    const result = await sso.completeLogin({ providerId, code, state, redirectUri });
    application?.enterpriseGovernanceService?.refreshUsers?.();
    writeServiceLog?.("oidc_sso_completed", {
      method: "GET",
      path: url.pathname,
      providerId,
      userId: result.identity.userId,
      created: result.created,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, {
      ok: true,
      providerId,
      identity: result.identity,
      // 一次性下发:API token 明文只在登录响应中出现一次(哈希已入库)。
      apiToken: result.apiToken,
      tokenGuidance: "Use this token as the Authorization: Bearer credential for gateway APIs.",
    });
  } catch (error) {
    writeServiceLog?.("oidc_sso_failed", {
      method: "GET",
      path: url.pathname,
      providerId,
      code: error?.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 401, {
      error: {
        code: error?.code ?? "SSO_CALLBACK_FAILED",
        message: error?.message ?? "SSO login could not be completed.",
      },
    });
  }
}

async function handleScim({ application, env, request, response, url, startedAt, writeServiceLog, usersPath }) {
  const scim = createScimProvisioningService({
    env,
    usersPath,
    onUsersChanged: () => application?.enterpriseGovernanceService?.refreshUsers?.(),
  });
  if (!scim.enabled) {
    // 未配置 Bearer token:整个 SCIM 面不存在。
    return ROUTE_NOT_HANDLED;
  }
  if (!scim.authorized(request)) {
    writeJson(response, 401, {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: "401",
      detail: "Invalid or missing SCIM bearer token.",
    });
    return;
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";
  const userMatch = SCIM_USERS_PATTERN.exec(path);

  if (request.method === "POST" && path === SCIM_USERS_PATH) {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(response, 400, scimErrorPayload(400, "Request body must be valid JSON."));
      return;
    }
    const result = scim.createUser(body);
    writeJson(response, result.status, result.user ?? result.error);
    return;
  }

  if (request.method === "GET" && userMatch) {
    const result = scim.getUser(decodeURIComponent(userMatch[1]));
    writeJson(response, result.status, result.user ?? result.error);
    return;
  }

  if (request.method === "GET" && path === SCIM_USERS_PATH) {
    const result = scim.listUsers({ filter: url.searchParams.get("filter") });
    writeJson(response, result.status, result.list);
    return;
  }

  if (request.method === "PATCH" && userMatch) {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(response, 400, scimErrorPayload(400, "Request body must be valid JSON."));
      return;
    }
    const result = scim.patchUser(decodeURIComponent(userMatch[1]), body?.Operations);
    writeJson(response, result.status, result.user ?? result.error);
    return;
  }

  if (request.method === "DELETE" && userMatch) {
    const result = scim.deactivateUser(decodeURIComponent(userMatch[1]));
    writeJson(response, result.status, result.user ?? result.error);
    return;
  }

  writeJson(response, 405, scimErrorPayload(405, "Method not supported on the SCIM surface."));
}

function scimErrorPayload(status, detail) {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    status: String(status),
    detail,
  };
}
