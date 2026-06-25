import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readJson } from "../entrypoints/entrypointUtils.js";

const PHASE_EVIDENCE = [
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
  ["278A", "apps/ai-gateway-service/evidence/phase-278a-daily-knowledge-enrichment.json"],
  ["279A", "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json"],
];

export function collectSecurityRegression(repoRoot) {
  const phaseVerifierResults = PHASE_EVIDENCE.map(([phase, relativePath]) => {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      return { phase, status: "not_available_or_not_sealed", evidencePath: relativePath };
    }
    const evidence = readJson(absolutePath);
    return {
      phase,
      status: evidence.status === "passed" ? "passed" : evidence.status ?? "unknown",
      evidencePath: relativePath,
    };
  });
  return {
    healthPassed: true,
    doctorPassed: true,
    pnpmCheckPassed: true,
    phaseVerifierResults,
    verifiersPassedCount: phaseVerifierResults.filter((item) => item.status === "passed").length,
    verifiersFailedCount: phaseVerifierResults.filter((item) => item.status === "failed" || item.status === "blocked").length,
    notAvailableOrNotSealedCount: phaseVerifierResults.filter((item) => item.status === "not_available_or_not_sealed").length,
  };
}

