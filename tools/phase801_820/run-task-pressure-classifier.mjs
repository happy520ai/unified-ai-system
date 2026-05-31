import { classifyTaskPressure, ROUTING_FIXTURES } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const classifications = ROUTING_FIXTURES.map((fixture) => ({
  taskId: fixture.taskId,
  ...classifyTaskPressure(fixture),
}));
const result = {
  phase: "Phase802",
  completed: true,
  taskPressureClassifierReady: true,
  classificationCount: classifications.length,
  classifications,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/task-pressure-classifier-result.json", result);
writeText("docs/phase802-task-pressure-classifier.md", phaseDoc({
  phase: "Phase802",
  title: "Task Pressure Classifier",
  goal: "Classify token, cost, latency, reasoning, reliability, and context pressure for route fixtures.",
  facts: [`classificationCount=${classifications.length}`, "modeRecommendation generated for each fixture"],
  boundaries: ["classifier performs no runtime execution"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/task-pressure-classifier-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
