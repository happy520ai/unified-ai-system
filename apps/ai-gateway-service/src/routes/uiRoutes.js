export function createUiRoutes() {
  return [
    {
      method: "GET",
      path: "/ui",
      description: "Phase323E-1 skeleton only. Production wiring not attached yet.",
      matches(request) {
        return request.method === "GET" && (request.pathname === "/ui" || request.pathname === "/console");
      },
    },
  ];
}
