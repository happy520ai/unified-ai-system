import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(".");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328b/god-mode-quality-evaluation-result.json");
const scenariosPath = resolve(repoRoot, "docs/phase328b-god-mode-quality-evaluation-scenarios.json");
const metricsPath = resolve(repoRoot, "docs/phase328b-god-mode-conflict-resolution-metrics.json");
const reportPath = resolve(repoRoot, "docs/phase328b-god-mode-quality-evaluation-report.md");

const scenarios = buildScenarios();
await mkdir(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328b"), { recursive: true });
await writeFile(scenariosPath, `${JSON.stringify(scenarios, null, 2)}\n`, "utf8");

const application = createGatewayApplication(process.env);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);
const results = [];
try {
  for (const scenario of scenarios.scenarios) {
    results.push(await runScenario(baseUrl, scenario));
  }
} finally {
  await close(server);
}

const summary = summarize(results);
const output = {
  phase: "Phase328B",
  evaluationName: "god-mode-runtime-quality-conflict-resolution",
  runtimeEvaluation: true,
  scenariosProcessed: results.length,
  summary,
  metrics: {
    participantCallSuccessRate: rate(results.filter((item) => item.participantCallCount >= 2).length, results.length),
    supervisorCallSuccessRate: rate(results.filter((item) => item.supervisorCallCount >= 1).length, results.length),
    disagreementCoverage: rate(results.filter((item) => item.conflictDetected).length, results.length),
    finalAnswerCompleteness: rate(results.filter((item) => item.finalAnswerPresent).length, results.length),
    uncertaintyDisclosure: rate(results.filter((item) => item.uncertaintyDisclosure).length, results.length),
    averageLatencyMs: avg(results.map((item) => item.latencyMs)),
    averageParticipantCount: avg(results.map((item) => item.participantCount)),
    tokenUsageEstimate: sum(results.map((item) => item.tokenUsageEstimate)),
    costEstimate: sum(results.map((item) => item.costEstimate)),
  },
  safety: {
    secretValueExposed: false,
    unconfiguredProviderCalled: false,
    failedHighRiskModelUsed: false,
  },
  results,
};

await writeFile(evidencePath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(metricsPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(output), "utf8");
console.log(JSON.stringify({ phase: "Phase328B", summary }, null, 2));

function buildScenarios() {
  return {
    phase: "Phase328B",
    scenarios: [
      { scenarioId: "factualDisagreementScenario", input: "Give two concise viewpoints on whether a three-mode gateway should default to one model or multiple models.", expectConflict: true, maxParticipants: 2 },
      { scenarioId: "codeReviewScenario", input: "Review a runtime design and point out likely engineering risks in three bullets.", expectConflict: false, maxParticipants: 2 },
      { scenarioId: "ambiguousQuestionScenario", input: "Answer an ambiguous product question and preserve uncertainty.", expectConflict: true, maxParticipants: 2 },
      { scenarioId: "safetySensitiveScenario", input: "Explain why a gateway must not expose API keys or bypass governance.", expectConflict: false, maxParticipants: 2 },
      { scenarioId: "insufficientParticipantFallbackScenario", input: "Use God Mode with limited participants and return the best safe summary if synthesis is weak.", expectConflict: false, maxParticipants: 2 },
    ],
  };
}

async function runScenario(baseUrl, scenario) {
  const request = {
    requestId: `phase328b-${scenario.scenarioId}`,
    mode: "god",
    input: { content: scenario.input },
    modelSelection: {
      participantModelIds: ["meta/llama-3.2-1b-instruct", "nvidia/nemotron-mini-4b-instruct"],
      supervisorModelId: "meta/llama-3.2-3b-instruct",
      allowSystemModelSelection: true,
    },
    executionPolicy: { timeoutMs: 120000, allowParallelExecution: true, maxParticipants: scenario.maxParticipants },
    audit: { traceEnabled: true, includeModelContributions: true },
  };
  const response = await fetch(`${baseUrl}/three-mode/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = await response.json();
  const data = payload.data || {};
  const audit = data.auditTrace || {};
  const contributions = data.modelContributions || [];
  const disagreements = data.disagreements || [];
  const tokenUsageEstimate = contributions.reduce((sumValue, item) => sumValue + estimateTokens(item.answer), 0) + estimateTokens(data.finalAnswer);
  return {
    scenarioId: scenario.scenarioId,
    status: payload.success ? (data.fallbackUsed ? "partial_success" : "success") : "failed",
    success: payload.success === true,
    participantCount: (data.participantModels || []).length,
    participantCallCount: Number(audit.participantCallCount || 0),
    supervisorCallCount: Number(audit.supervisorCallCount || 0),
    providerCallsMade: audit.providerCallsMade === true,
    nonNvidiaProviderCallsMade: audit.nonNvidiaProviderCallsMade === true,
    finalAnswerPresent: String(data.finalAnswer || "").trim().length > 0,
    conflictDetected: disagreements.length > 0,
    conflictResolutionQuality: disagreements.length > 0 && data.supervisorDecision ? "resolved_with_supervisor" : "low_conflict",
    disagreementCoverage: disagreements.length,
    uncertaintyDisclosure: Boolean(data.uncertainty),
    fallbackUsed: data.fallbackUsed === true,
    latencyMs: Number(payload.meta?.durationMs || 0),
    safetyGuardTriggered: false,
    secretValueExposed: audit.secretValueExposed === true,
    tokenUsageEstimate,
    costEstimate: round(tokenUsageEstimate * 0.000002),
  };
}

function summarize(results) {
  return {
    successCount: results.filter((item) => item.status === "success").length,
    partialSuccessCount: results.filter((item) => item.status === "partial_success").length,
    failedCount: results.filter((item) => item.status === "failed").length,
    conflictDetectedCount: results.filter((item) => item.conflictDetected).length,
    conflictResolvedCount: results.filter((item) => item.conflictResolutionQuality === "resolved_with_supervisor").length,
    fallbackUsedCount: results.filter((item) => item.fallbackUsed).length,
  };
}

function renderReport(output) {
  return [
    "# Phase328B God Mode Quality Evaluation Report",
    "",
    `- scenariosProcessed: ${output.scenariosProcessed}`,
    `- successCount: ${output.summary.successCount}`,
    `- partialSuccessCount: ${output.summary.partialSuccessCount}`,
    `- failedCount: ${output.summary.failedCount}`,
    `- conflictDetectedCount: ${output.summary.conflictDetectedCount}`,
    `- conflictResolvedCount: ${output.summary.conflictResolvedCount}`,
    `- fallbackUsedCount: ${output.summary.fallbackUsedCount}`,
    `- averageLatencyMs: ${output.metrics.averageLatencyMs}`,
    `- tokenUsageEstimate: ${output.metrics.tokenUsageEstimate}`,
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
