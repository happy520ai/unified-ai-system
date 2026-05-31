import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_PHASES = [
  ["107A", "apps/ai-gateway-service/evidence/phase-107a-secret-safety.json"],
  ["245A", "apps/ai-gateway-service/evidence/phase-245a-personal-value-closure.json"],
  ["255A", "apps/ai-gateway-service/evidence/phase-255a-personal-knowledge-value-closure.json"],
  ["268A", "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json"],
  ["269A", "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json"],
  ["270A", "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json"],
  ["271A", "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json"],
  ["272A", "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json"],
  ["273A", "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json"],
  ["274A", "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json"],
  ["275A", "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json"],
  ["276A", "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json"],
  ["277A", "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.json"],
];

const OPTIONAL_PHASES = [
  ["278A", "apps/ai-gateway-service/evidence/phase-278a-daily-knowledge-enrichment.json"],
];

export function auditPhaseEvidence(repoRoot) {
  const requiredResults = REQUIRED_PHASES.map(([phase, jsonPath]) => inspectEvidence(repoRoot, phase, jsonPath, true));
  const optionalResults = OPTIONAL_PHASES.map(([phase, jsonPath]) => inspectEvidence(repoRoot, phase, jsonPath, false));
  const requiredFailures = requiredResults.filter((item) => item.status !== "passed");
  return {
    status: requiredFailures.length === 0 ? "pass" : "fail",
    phaseEvidenceChecked: requiredResults.length + optionalResults.length,
    requiredResults,
    optionalResults,
    requiredFailures,
    verifiersPassedCount: requiredResults.filter((item) => item.status === "passed").length,
    verifiersFailedCount: requiredFailures.length,
  };
}

function inspectEvidence(repoRoot, phase, jsonPath, required) {
  const absoluteJson = resolve(repoRoot, jsonPath);
  const mdPath = jsonPath.replace(/\.json$/i, ".md");
  const absoluteMd = resolve(repoRoot, mdPath);
  if (!existsSync(absoluteJson)) {
    return {
      phase,
      status: required ? "missing" : "not_available_or_not_sealed",
      jsonPath,
      mdPath,
      jsonExists: false,
      mdExists: existsSync(absoluteMd),
      paidApiCallCount: 0,
      externalApiCalled: false,
      mimoApiCalled: false,
    };
  }
  try {
    const evidence = JSON.parse(readFileSync(absoluteJson, "utf8"));
    return {
      phase,
      status: evidence.status ?? "unknown",
      jsonPath,
      mdPath,
      jsonExists: true,
      mdExists: existsSync(absoluteMd),
      paidApiCallCount: evidence.paidApiCallCount ?? evidence.summary?.paidApiCallCount ?? 0,
      externalApiCalled: evidence.externalApiCalled === true || evidence.safety?.externalApiCalled === true,
      mimoApiCalled: evidence.mimoApiCalled === true || evidence.safety?.mimoApiCalled === true,
      defaultNvidiaChatLaneChanged: evidence.defaultNvidiaChatLaneChanged === true || evidence.safety?.defaultNvidiaChatLaneChanged === true,
      mimoSetAsDefault: evidence.mimoSetAsDefault === true || evidence.safety?.mimoSetAsDefault === true,
      productionReadiness: evidence.productionReadiness ?? evidence.scorecard?.productionReadiness ?? null,
    };
  } catch (error) {
    return {
      phase,
      status: "unreadable",
      jsonPath,
      mdPath,
      jsonExists: true,
      mdExists: existsSync(absoluteMd),
      error: error.message,
    };
  }
}
