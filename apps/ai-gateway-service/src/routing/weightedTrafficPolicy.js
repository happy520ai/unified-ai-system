// Weighted traffic policy (operator-configured routing splits + shadow traffic).
//
// AI_GATEWAY_WEIGHTED_ROUTES_JSON:
// [
//   {
//     "name": "canary-openai",
//     "match": { "model": "gpt-4o", "providerId": null, "source": "openai-compatible-api" },
//     "weights": { "openai": 90, "azure-openai": 10 },
//     "shadow": { "providerId": "openai-candidate", "percent": 5 }
//   }
// ]
//
// 语义:
// - weights 按整数百分比在匹配请求上覆写 provider 选择(总和不必为 100,
//   按权重比例归一);缺省 match 字段表示通配。
// - shadow 为旁路观测:命中百分比的请求在主响应完成后向 shadow provider
//   异步复制一份调用,绝不影响主响应;调用会单独进入用量/成本账本。
//   真实 provider shadow 还需 AI_GATEWAY_SHADOW_REAL_PROVIDER_ENABLED=true。
// - 解析失败 fail-closed:配置错误直接拒绝启用并保留显式错误,绝不静默。

const CONFIG_ENV = "AI_GATEWAY_WEIGHTED_ROUTES_JSON";
const MAX_ROUTES = 32;

export function createWeightedTrafficPolicy({
  env = process.env,
  random = Math.random,
  now = () => Date.now(),
} = {}) {
  const parseResult = parseConfig(env[CONFIG_ENV]);
  if (!parseResult.ok) {
    return {
      enabled: false,
      configError: parseResult.error,
      describe: () => ({ enabled: false, configError: parseResult.error, configEnv: CONFIG_ENV }),
      apply: () => null,
      shouldShadow: () => null,
    };
  }
  const routes = parseResult.routes;

  function matchRoute(route, request) {
    const match = route.match ?? {};
    if (match.model && request.model !== match.model) return false;
    if (match.providerId && request.providerId !== match.providerId) return false;
    if (match.source && request.metadata?.source !== match.source) return false;
    return true;
  }

  return {
    enabled: routes.length > 0,
    describe: () => ({
      enabled: routes.length > 0,
      configEnv: CONFIG_ENV,
      routeCount: routes.length,
      routes: routes.map((route) => ({
        name: route.name ?? null,
        weights: route.weights,
        ...(route.shadow ? { shadow: { providerId: route.shadow.providerId, percent: route.shadow.percent } } : {}),
      })),
    }),
    /**
     * 命中加权路由时返回 { overrideProviderId, routeName },否则 null。
     */
    apply(request) {
      for (const route of routes) {
        if (!matchRoute(route, request)) continue;
        const entries = Object.entries(route.weights ?? {}).filter(([, weight]) => Number(weight) > 0);
        if (entries.length === 0) continue;
        const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
        let point = random() * total;
        for (const [providerId, weight] of entries) {
          point -= Number(weight);
          if (point <= 0) {
            return { overrideProviderId: providerId, routeName: route.name ?? null };
          }
        }
        const [lastProviderId] = entries[entries.length - 1];
        return { overrideProviderId: lastProviderId, routeName: route.name ?? null };
      }
      return null;
    },
    /**
     * 命中影子路由时返回 { providerId, percent, routeName },否则 null。
     */
    shouldShadow(request) {
      for (const route of routes) {
        if (!route.shadow) continue;
        if (!matchRoute(route, request)) continue;
        if (random() * 100 < Number(route.shadow.percent)) {
          return {
            providerId: String(route.shadow.providerId),
            percent: Number(route.shadow.percent),
            routeName: route.name ?? null,
          };
        }
      }
      return null;
    },
    now,
  };
}

function parseConfig(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { ok: true, routes: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return { ok: false, error: `${CONFIG_ENV} is not valid JSON.` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: `${CONFIG_ENV} must be a JSON array of route rules.` };
  }
  if (parsed.length > MAX_ROUTES) {
    return { ok: false, error: `${CONFIG_ENV} supports at most ${MAX_ROUTES} route rules.` };
  }
  const routes = [];
  for (const [index, rule] of parsed.entries()) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      return { ok: false, error: `${CONFIG_ENV}[${index}] must be an object.` };
    }
    const weights = rule.weights;
    if (weights === undefined || !weights || typeof weights !== "object" || Array.isArray(weights)) {
      return { ok: false, error: `${CONFIG_ENV}[${index}].weights must be an object of providerId → percent.` };
    }
    for (const [providerId, weight] of Object.entries(weights)) {
      if (!providerId || !Number.isFinite(Number(weight)) || Number(weight) < 0) {
        return { ok: false, error: `${CONFIG_ENV}[${index}].weights.${providerId} must be a non-negative number.` };
      }
    }
    if (rule.shadow !== undefined) {
      if (!rule.shadow || typeof rule.shadow !== "object"
        || !rule.shadow.providerId
        || !Number.isFinite(Number(rule.shadow.percent))
        || Number(rule.shadow.percent) < 0 || Number(rule.shadow.percent) > 100) {
        return { ok: false, error: `${CONFIG_ENV}[${index}].shadow must be { providerId, percent(0-100) }.` };
      }
    }
    routes.push({
      name: typeof rule.name === "string" && rule.name ? rule.name : null,
      match: rule.match && typeof rule.match === "object" ? rule.match : {},
      weights,
      ...(rule.shadow ? { shadow: rule.shadow } : {}),
    });
  }
  return { ok: true, routes };
}
