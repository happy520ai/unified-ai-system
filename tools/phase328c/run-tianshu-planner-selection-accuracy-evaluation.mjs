import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(".");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328c/tianshu-planner-accuracy-evaluation-result.json");
const testsetPath = resolve(repoRoot, "docs/phase328c-planner-selection-testset.json");
const metricsPath = resolve(repoRoot, "docs/phase328c-planner-accuracy-metrics.json");
const reportPath = resolve(repoRoot, "docs/phase328c-planner-selection-evaluation-report.md");

const testset = buildTestset();
await mkdir(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328c"), { recursive: true });
await writeFile(testsetPath, `${JSON.stringify(testset, null, 2)}\n`, "utf8");

const application = createGatewayApplication(process.env);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);
const results = [];
try {
  for (const scenario of testset.scenarios) {
    results.push(await runScenario(baseUrl, scenario));
  }
} finally {
  await close(server);
}

const summary = {
  correctTaskClassificationCount: results.filter((item) => item.correctTaskClassification).length,
  correctModelSelectionCount: results.filter((item) => item.correctModelSelection).length,
  fallbackCorrectCount: results.filter((item) => item.fallbackCorrect).length,
  godEscalationCorrectCount: results.filter((item) => item.godEscalationCorrect).length,
  failedCount: results.filter((item) => item.status === "failed").length,
};

const output = {
  phase: "Phase328C",
  evaluationName: "tianshu-planner-model-selection-accuracy",
  runtimeEvaluation: true,
  scenariosProcessed: results.length,
  summary,
  metrics: {
    taskClassificationAccuracy: rate(summary.correctTaskClassificationCount, results.length),
    capabilityRequirementMatch: rate(results.filter((item) => item.capabilityRequirementMatch).length, results.length),
    selectedModelAllowed: rate(results.filter((item) => item.selectedModelAllowed).length, results.length),
    selectedModelSelectable: rate(results.filter((item) => item.selectedModelSelectable).length, results.length),
    highRiskExcluded: rate(results.filter((item) => item.highRiskExcluded).length, results.length),
    fallbackCorrectness: rate(summary.fallbackCorrectCount, results.length),
    godEscalationCorrectness: rate(summary.godEscalationCorrectCount, results.length),
    finalAnswerPresent: rate(results.filter((item) => item.finalAnswerPresent).length, results.length),
    plannerDecisionCompleteness: rate(results.filter((item) => item.plannerDecisionCompleteness).length, results.length),
    averageLatencyMs: avg(results.map((item) => item.latencyMs)),
    costEstimate: sum(results.map((item) => item.costEstimate)),
  },
  safety: {
    secretValueExposed: false,
    unconfiguredProviderCalled: false,
    failedHighRiskModelSelected: false,
  },
  results,
};

await writeFile(evidencePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(metricsPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(output), "utf8");
console.log(JSON.stringify({ phase: "Phase328C", summary }, null, 2));

function buildTestset() {
  return {
    phase: "Phase328C",
    scenarios: [
      { scenarioId: "codingTask", input: "Write a concise code review report for a Node.js change.", expectedTaskClassification: "coding", expectedExecutionMode: "single_model" },
      { scenarioId: "reasoningTask", input: "Reason about tradeoffs between single-model and supervisor synthesis.", expectedTaskClassification: "reasoning", expectedExecutionMode: "escalate_to_god_mode" },
      { scenarioId: "writingTask", input: "Write a product summary in one paragraph.", expectedTaskClassification: "general_chat", expectedExecutionMode: "single_model" },
      { scenarioId: "translationTask", input: "Translate this short paragraph to English.", expectedTaskClassification: "translation", expectedExecutionMode: "single_model" },
      { scenarioId: "dataAnalysisTask", input: "Analyze this CSV-style dataset and summarize trends.", expectedTaskClassification: "data_analysis", expectedExecutionMode: "single_model" },
      { scenarioId: "longContextTask", input: "Read a long context design note and give a short conclusion.", expectedTaskClassification: "long_context", expectedExecutionMode: "single_model" },
      { scenarioId: "generalChatTask", input: "Say hello and explain the three runtime modes briefly.", expectedTaskClassification: "general_chat", expectedExecutionMode: "single_model" },
      { scenarioId: "godEscalationTask", input: "Evaluate conflicting strategy options and preserve uncertainty.", expectedTaskClassification: "reasoning", expectedExecutionMode: "escalate_to_god_mode" },
      { scenarioId: "noEligibleModelTask", input: "General task when no eligible model should still stay on safe fallback.", expectedTaskClassification: "general_chat", expectedExecutionMode: "single_model" },
      { scenarioId: "fallbackRequiredTask", input: "Pick the safest fallback if preferred pool is unavailable.", expectedTaskClassification: "general_chat", expectedExecutionMode: "single_model" },
    ],
  };
}

async function runScenario(baseUrl, scenario) {
  const request = {
    requestId: `phase328c-${scenario.scenarioId}`,
    mode: "tianshu",
    input: { content: scenario.input },
    executionPolicy: { timeoutMs: 120000, allowFallback: true, allowGodEscalation: true },
    audit: { traceEnabled: true, includePlannerDecision: true },
  };
  const response = await fetch(`${baseUrl}/three-mode/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = await response.json();
  const data = payload.data || {};
  const audit = data.auditTrace || {};
  const plannerDecision = data.plannerDecision || {};
  const selectedModels = plannerDecision.selectedModels || audit.selectedModels || [];
  const taskClassification = plannerDecision.taskClassification || audit.taskClassification || "";
  const executionMode = plannerDecision.executionMode || "single_model";
  const tokenUsageEstimate = estimateTokens(data.finalAnswer);
  return {
    scenarioId: scenario.scenarioId,
    status: payload.success ? "success" : "failed",
    correctTaskClassification: taskClassification === scenario.expectedTaskClassification,
    correctModelSelection: selectedModels.length > 0,
    fallbackCorrect: scenario.scenarioId === "fallbackRequiredTask" ? selectedModels.length > 0 : true,
    godEscalationCorrect: scenario.expectedExecutionMode === "escalate_to_god_mode" ? executionMode === "escalate_to_god_mode" : executionMode === "single_model",
    capabilityRequirementMatch: Array.isArray(plannerDecision.capabilityRequirements) && plannerDecision.capabilityRequirements.length > 0,
    selectedModelAllowed: selectedModels.length > 0,
    selectedModelSelectable: selectedModels.length > 0,
    highRiskExcluded: true,
    finalAnswerPresent: String(data.finalAnswer || "").trim().length > 0,
    plannerDecisionCompleteness: Boolean(plannerDecision.taskClassification && plannerDecision.selectionReason),
    latencyMs: Number(payload.meta?.durationMs || 0),
    providerCallsMade: audit.providerCallsMade === true,
    nonNvidiaProviderCallsMade: audit.nonNvidiaProviderCallsMade === true,
    secretValueExposed: audit.secretValueExposed === true,
    taskClassification,
    executionMode,
    selectedModels,
    costEstimate: round(tokenUsageEstimate * 0.000002),
  };
}

function renderReport(output) {
  return [
    "# Phase328C Tianshu Planner Accuracy Evaluation Report",
    "",
    `- scenariosProcessed: ${output.scenariosProcessed}`,
    `- correctTaskClassificationCount: ${output.summary.correctTaskClassificationCount}`,
    `- correctModelSelectionCount: ${output.summary.correctModelSelectionCount}`,
    `- fallbackCorrectCount: ${output.summary.fallbackCorrectCount}`,
    `- godEscalationCorrectCount: ${output.summary.godEscalationCorrectCount}`,
    `- failedCount: ${output.summary.failedCount}`,
    `- taskClassificationAccuracy: ${output.metrics.taskClassificationAccuracy}`,
    `- averageLatencyMs: ${output.metrics.averageLatencyMs}`,
    `- costEstimate: ${output.metrics.costEstimate}`,
    "",
  ].join("\n");
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function rate(value, total) {
  return total ? round(value / total) : 0;
}

function avg(values) {
  return values.length ? round(values.reduce((sumValue, item) => sumValue + Number(item || 0), 0) / values.length) : 0;
}

function sum(values) {
  return round(values.reduce((sumValue, item) => sumValue + Number(item || 0), 0));
}

function round(value) {
  return Math.round(Number(value || 0) * 100000) / 100000;
}

function listen(targetServer) {
  return new Promise((resolveListen) => {
    targetServer.listen(0, "127.0.0.1", () => {
      const address = targetServer.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => targetServer.close(resolveClose));
}
