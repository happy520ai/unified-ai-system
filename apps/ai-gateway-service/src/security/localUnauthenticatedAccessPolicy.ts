export const LOCAL_UNAUTHENTICATED_ROLE = "local_preview";
export const LOCAL_UNAUTHENTICATED_PERMISSION = "local:preview";

const PUBLIC_PERMISSION = "public:read";
const FAKE_PROVIDER_IDS = new Set(["local-fake-provider", "backup-fake-provider"]);

type Environment = Record<string, string | undefined>;
type RequestLike = {
  method?: unknown;
  url?: unknown;
};

type RouteRule = {
  method: string;
  permission: string;
  pathname: RegExp;
};

const EXACT_ROUTE_PERMISSIONS = new Map<string, string>([
  ["GET /v1/models", "provider:read"],
  ["GET /models", "provider:read"],
  ["GET /v1/engines", "provider:read"],
  ["GET /engines", "provider:read"],
  ["GET /ws", "chat:use"],
  ["POST /v1/chat/completions", "chat:use"],
  ["POST /chat/completions", "chat:use"],
  ["POST /v1/completions", "chat:use"],
  ["POST /completions", "chat:use"],
  ["POST /v1/responses", "chat:use"],
  ["POST /responses", "chat:use"],
  ["POST /v1/messages", "chat:use"],
  ["POST /prompts/enhance", "chat:use"],
  ["POST /a2a/jsonrpc", "chat:use"],
  ["POST /chat", "chat:use"],
  ["POST /chat/stream", "chat:use"],
  ["POST /route", "chat:use"],
  ["POST /gateway/route", "chat:use"],
  ["POST /gateway/mock", "chat:use"],
]);

const DYNAMIC_ROUTE_RULES: RouteRule[] = [
  {
    method: "GET",
    permission: "provider:read",
    pathname: /^\/(?:v1\/)?models\/[^/]+$/u,
  },
  {
    method: "GET",
    permission: "provider:read",
    pathname: /^\/(?:v1\/)?engines\/[^/]+$/u,
  },
  {
    method: "POST",
    permission: "chat:use",
    pathname: /^\/openai\/deployments\/[^/]+\/(?:chat\/completions|completions|responses)$/u,
  },
  {
    method: "POST",
    permission: "chat:use",
    pathname: /^\/v1\/engines\/[^/]+\/(?:chat\/completions|completions)$/u,
  },
];

export const LOCAL_UNAUTHENTICATED_ROUTE_RULE_COUNT =
  EXACT_ROUTE_PERMISSIONS.size + DYNAMIC_ROUTE_RULES.length;

export function createLocalUnauthenticatedPreviewConfig(env: Environment = {}) {
  const providerMode = String(env.AI_GATEWAY_PROVIDER_MODE ?? "fake").trim().toLowerCase();
  const realProviderEnabled = readBoolean(env.AI_GATEWAY_REAL_PROVIDER_ENABLED, false);
  const requestedDefaultProvider = normalizeOptionalString(env.AI_GATEWAY_DEFAULT_PROVIDER);
  const requestedEnabledProviders = readList(env.AI_GATEWAY_ENABLED_PROVIDERS);
  const fakeSelectionOnly =
    (!requestedDefaultProvider || FAKE_PROVIDER_IDS.has(requestedDefaultProvider))
    && requestedEnabledProviders.every((providerId) => FAKE_PROVIDER_IDS.has(providerId));

  return Object.freeze({
    enabled: providerMode === "fake" && !realProviderEnabled && fakeSelectionOnly,
    providerMode,
    realProviderEnabled,
    fakeSelectionOnly,
    role: LOCAL_UNAUTHENTICATED_ROLE,
    permission: LOCAL_UNAUTHENTICATED_PERMISSION,
    routePolicy: "explicit-protocol-allowlist",
    routeRuleCount: LOCAL_UNAUTHENTICATED_ROUTE_RULE_COUNT,
  });
}

export function authorizeLocalUnauthenticatedRequest({
  request,
  permission,
  previewEnabled,
}: {
  request?: RequestLike;
  permission?: unknown;
  previewEnabled: boolean;
}) {
  if (permission === PUBLIC_PERMISSION) {
    return Object.freeze({ allowed: true, reason: "public_route" });
  }

  if (!previewEnabled) {
    return Object.freeze({
      allowed: false,
      code: "enterprise_auth_required_for_non_fake_mode",
      reason: "local_preview_disabled",
    });
  }

  const route = normalizeRequestRoute(request);
  if (!route) {
    return Object.freeze({
      allowed: false,
      code: "enterprise_local_preview_forbidden",
      reason: "request_route_invalid",
    });
  }

  const exactPermission = EXACT_ROUTE_PERMISSIONS.get(`${route.method} ${route.pathname}`);
  if (exactPermission === permission) {
    return Object.freeze({ allowed: true, reason: "explicit_protocol_route" });
  }

  const dynamicMatch = DYNAMIC_ROUTE_RULES.some((rule) =>
    rule.method === route.method
    && rule.permission === permission
    && rule.pathname.test(route.pathname));
  if (dynamicMatch) {
    return Object.freeze({ allowed: true, reason: "explicit_protocol_route" });
  }

  return Object.freeze({
    allowed: false,
    code: "enterprise_local_preview_forbidden",
    reason: "route_not_allowlisted",
  });
}

function normalizeRequestRoute(request?: RequestLike) {
  const method = typeof request?.method === "string"
    ? request.method.trim().toUpperCase()
    : "";
  if (!method || typeof request?.url !== "string" || !request.url.trim()) {
    return null;
  }

  try {
    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = url.pathname.length > 1
      ? url.pathname.replace(/\/+$/u, "")
      : url.pathname;
    return { method, pathname };
  } catch {
    return null;
  }
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function readList(value: unknown) {
  return typeof value === "string"
    ? value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean)
    : [];
}

function readBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value === "1" || String(value).toLowerCase() === "true";
}
