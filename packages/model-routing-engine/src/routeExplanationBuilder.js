export function buildRouteExplanation(route = {}) {
  const selected = route.selected?.primaryModelId || "none";
  const pressure = route.taskPressure || {};
  return [
    `mode=${route.mode}`,
    `selected=${selected}`,
    `tokenPressure=${pressure.tokenPressure || "low"}`,
    `costPressure=${pressure.costPressure || "low"}`,
    `latencyPressure=${pressure.latencyPressure || "low"}`,
    `reasoningPressure=${pressure.reasoningPressure || "low"}`,
    "dryRunOnly=true",
    "providerCallsMade=false",
  ].join("; ");
}
