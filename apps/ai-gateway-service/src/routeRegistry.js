import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createUiRoutes } from "./routes/uiRoutes.js";

export function createRouteRegistry() {
  const groups = {
    health: createHealthRoutes(),
    ui: createUiRoutes(),
  };
  const allRoutes = Object.values(groups).flat();

  return {
    groups,
    list() {
      return allRoutes.slice();
    },
    match(request) {
      return allRoutes.find((route) => typeof route.matches === "function" && route.matches(request)) ?? null;
    },
  };
}
