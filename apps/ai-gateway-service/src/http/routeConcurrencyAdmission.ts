type RouteConcurrencyLimits = Readonly<{
  maxGlobal: number;
  maxPerTenant: number;
}>;

const DEFAULT_ROUTE_CONCURRENCY_LIMITS: Readonly<Record<string, RouteConcurrencyLimits>> = Object.freeze({
  "/agent-exec/run": Object.freeze({ maxGlobal: 8, maxPerTenant: 4 }),
  "/forge/orchestrate": Object.freeze({ maxGlobal: 4, maxPerTenant: 2 }),
  "/mcp/call": Object.freeze({ maxGlobal: 16, maxPerTenant: 8 }),
  "/workforce/execute": Object.freeze({ maxGlobal: 8, maxPerTenant: 4 }),
  "/workflow/run": Object.freeze({ maxGlobal: 8, maxPerTenant: 4 }),
  "/v1/agents/generate": Object.freeze({ maxGlobal: 8, maxPerTenant: 4 }),
  "/v1/policies/activate": Object.freeze({ maxGlobal: 1, maxPerTenant: 1 }),
});

export type RouteConcurrencyAdmission = ReturnType<typeof createRouteConcurrencyAdmission>;

export function createRouteConcurrencyAdmission(options: { rawConfig?: unknown } = {}) {
  const limitsByRoute = parseLimits(options.rawConfig);
  const globalActive = new Map<string, number>();
  const tenantActive = new Map<string, number>();

  function tryAcquire(pathname: string, tenantId: unknown) {
    const routePath = canonicalizeRoutePath(pathname);
    const limits = limitsByRoute.get(routePath);
    if (!limits) return { allowed: true as const, pattern: null, release() {} };
    const tenant = typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : "unscoped";
    const tenantKey = `${routePath}\0${tenant}`;
    const activeGlobal = globalActive.get(routePath) ?? 0;
    const activeTenant = tenantActive.get(tenantKey) ?? 0;
    if (activeGlobal >= limits.maxGlobal || activeTenant >= limits.maxPerTenant) {
      return {
        allowed: false as const,
        pattern: routePath,
        limits,
        activeGlobal,
        activeTenant,
      };
    }
    globalActive.set(routePath, activeGlobal + 1);
    tenantActive.set(tenantKey, activeTenant + 1);
    let released = false;
    return {
      allowed: true as const,
      pattern: routePath,
      limits,
      release() {
        if (released) return;
        released = true;
        decrement(globalActive, routePath);
        decrement(tenantActive, tenantKey);
      },
    };
  }

  return Object.freeze({ tryAcquire });
}

function parseLimits(raw: unknown): Map<string, RouteConcurrencyLimits> {
  let overrides: unknown = raw;
  if (typeof raw === "string" && raw.trim()) {
    try { overrides = JSON.parse(raw); }
    catch { throw configurationError("AI_GATEWAY_ROUTE_CONCURRENCY_LIMITS must be valid JSON."); }
  }
  if (raw === undefined || raw === null || raw === "") overrides = {};
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw configurationError("AI_GATEWAY_ROUTE_CONCURRENCY_LIMITS must be a JSON object.");
  }
  const merged: Record<string, RouteConcurrencyLimits> = { ...DEFAULT_ROUTE_CONCURRENCY_LIMITS };
  const configuredRoutes = new Set<string>();
  for (const [route, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (!route.startsWith("/") || route.length > 256 || /[?#\u0000-\u001f\u007f]/u.test(route)) {
      throw configurationError("Route concurrency keys must be safe absolute URL paths.");
    }
    const routePath = canonicalizeRoutePath(route);
    if (configuredRoutes.has(routePath)) {
      throw configurationError(`Route concurrency configuration contains duplicate aliases for ${routePath}.`);
    }
    configuredRoutes.add(routePath);
    if (value === false || value === null) {
      delete merged[routePath];
      continue;
    }
    const record = typeof value === "number"
      ? { maxGlobal: value, maxPerTenant: value }
      : value;
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw configurationError(`Route concurrency limit for ${routePath} is malformed.`);
    }
    const candidate = record as Record<string, unknown>;
    if (Object.keys(candidate).some((key) => key !== "maxGlobal" && key !== "maxPerTenant")
      || !boundedPositiveInteger(candidate.maxGlobal)
      || !boundedPositiveInteger(candidate.maxPerTenant)
      || Number(candidate.maxPerTenant) > Number(candidate.maxGlobal)) {
      throw configurationError(`Route concurrency limit for ${routePath} is malformed or out of bounds.`);
    }
    merged[routePath] = Object.freeze({
      maxGlobal: Number(candidate.maxGlobal),
      maxPerTenant: Number(candidate.maxPerTenant),
    });
  }
  return new Map(Object.entries(merged));
}

export function canonicalizeRoutePath(pathname: string): string {
  return String(pathname ?? "").replace(/\/+$/u, "") || "/";
}

function boundedPositiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 10_000;
}

function decrement(map: Map<string, number>, key: string) {
  const next = (map.get(key) ?? 1) - 1;
  if (next <= 0) map.delete(key);
  else map.set(key, next);
}

function configurationError(message: string) {
  return Object.assign(new Error(message), {
    name: "RouteConcurrencyConfigurationError",
    code: "ROUTE_CONCURRENCY_CONFIGURATION_INVALID",
    category: "configuration",
  });
}
