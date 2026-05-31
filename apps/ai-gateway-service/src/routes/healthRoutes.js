export function createHealthRoutes() {
  return [
    {
      method: "GET",
      path: "/health/check",
      description: "Phase323E-1 skeleton only. Production wiring not attached yet.",
      matches(request) {
        return request.method === "GET" && (request.pathname === "/health" || request.pathname === "/health/check");
      },
    },
    {
      method: "GET",
      path: "/setup/readiness",
      description: "Phase323E-1 skeleton only. Production wiring not attached yet.",
      matches(request) {
        return request.method === "GET" && request.pathname === "/setup/readiness";
      },
    },
  ];
}
