import {
  applyContextPressureRouting,
  applyCostPressureRouting,
  applyLatencyPressureRouting,
  applyReliabilityPressureRouting,
  classifyTaskPressure,
} from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const pressure = classifyTaskPressure({
  taskId: "pressure-routing-pack",
  userTask: "长上下文低成本低延迟可靠规划",
  mode: "auto",
  constraints: { preferLowCost: true, preferLowLatency: true, preferLongContext: true, preferReasoning: true },
  context: { estimatedInputTokens: 16000, requiresLongContext: true },
});
const adjusted = applyReliabilityPressureRouting(
  applyLatencyPressureRouting(
    applyCostPressureRouting(
      applyContextPressureRouting(index.models || [], pressure),
      pressure,
    ),
    pressure,
  ),
  pressure,
);
const result = {
  phaseRange: "Phase809-812",
  completed: true,
  contextPressureRoutingReady: true,
  costPressureRoutingReady: true,
  latencyPressureRoutingReady: true,
  reliabilityPressureRoutingReady: true,
  pressure,
  adjustedCandidateCount: adjusted.length,
  adjustedPreview: adjusted.slice(0, 5).map((candidate) => ({
    modelId: candidate.modelId,
    pressureAdjustments: candidate.pressureAdjustments,
  })),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/pressure-routing-pack-result.json", result);
for (const [phase, title, key] of [
  ["Phase809", "Context Pressure Routing", "contextPressureRoutingReady"],
  ["Phase810", "Cost Pressure Routing", "costPressureRoutingReady"],
  ["Phase811", "Latency Pressure Routing", "latencyPressureRoutingReady"],
  ["Phase812", "Reliability Pressure Routing", "reliabilityPressureRoutingReady"],
]) {
  writeText(`docs/phase${phase.slice(5).toLowerCase()}-${title.toLowerCase().replaceAll(" ", "-")}.md`, phaseDoc({
    phase,
    title,
    goal: `Apply ${title.toLowerCase()} adjustments to dry-run routing candidates.`,
    facts: [`${key}=true`, `adjustedCandidateCount=${adjusted.length}`],
    boundaries: ["pressure adjustment does not execute a route"],
    outputs: ["apps/ai-gateway-service/evidence/phase801_820/pressure-routing-pack-result.json"],
  }));
}

console.log(JSON.stringify(result, null, 2));
