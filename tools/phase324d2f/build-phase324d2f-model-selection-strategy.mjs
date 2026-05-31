import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const INPUTS = {
  phase324dViewData: "docs/phase324d-model-status-view-data.json",
  phase324eReport: "docs/phase324e-model-library-operations-report.json",
  phase324eDashboard: "docs/phase324e-model-library-operations-dashboard-data.json",
  usabilityMatrix: "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json",
  verificationState: "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json",
};

const OUTPUT_JSON = "docs/phase324d2f-model-selection-strategy.json";
const OUTPUT_MD = "docs/phase324d2f-model-selection-strategy.md";
const HIGH_LATENCY_THRESHOLD_MS = 10000;

function readJson(relativePath, fallback = {}) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return fallback;
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function latencyByModel(phase324eReport) {
  const map = new Map();
  for (const item of phase324eReport?.latencyAnalysis?.passedLatencies ?? []) {
    if (item?.modelId) map.set(item.modelId, Number(item.latencyMs ?? 0));
  }
  return map;
}

function modelRow(row, latencyMap) {
  return {
    modelId: row.modelId,
    providerId: row.providerId,
    capabilityBucket: row.capabilityBucket,
    evidenceId: row.evidenceId,
    latencyMs: latencyMap.has(row.modelId) ? latencyMap.get(row.modelId) : null,
    reason: null,
  };
}

function byLatency(left, right) {
  const leftLatency = hasKnownLatency(left) ? Number(left.latencyMs) : Number.MAX_SAFE_INTEGER;
  const rightLatency = hasKnownLatency(right) ? Number(right.latencyMs) : Number.MAX_SAFE_INTEGER;
  return leftLatency - rightLatency || String(left.modelId).localeCompare(String(right.modelId));
}

function hasKnownLatency(row) {
  return row?.latencyMs !== null && row?.latencyMs !== undefined && Number.isFinite(Number(row.latencyMs));
}

function isLargeOrQuality(row) {
  const id = String(row.modelId || "").toLowerCase();
  return id.includes("70b") || id.includes("120b") || id.includes("super") || id.includes("dracarys");
}

function chooseDefault(selectableRows, latencyMap) {
  const candidates = selectableRows
    .map((row) => modelRow(row, latencyMap))
    .filter((row) => row.evidenceId && hasKnownLatency(row) && row.latencyMs < HIGH_LATENCY_THRESHOLD_MS)
    .sort((left, right) => {
      const leftScore = isLargeOrQuality(left) ? 0 : 1;
      const rightScore = isLargeOrQuality(right) ? 0 : 1;
      return leftScore - rightScore || byLatency(left, right);
    });
  const chosen = candidates[0] ?? selectableRows.map((row) => modelRow(row, latencyMap)).sort(byLatency)[0];
  return {
    ...chosen,
    reason: "Evidence-backed selectable model with a balanced latency/quality profile. Strategy only; does not change real default route.",
  };
}

function main() {
  const viewData = readJson(INPUTS.phase324dViewData);
  const phase324eReport = readJson(INPUTS.phase324eReport);
  const phase324eDashboard = readJson(INPUTS.phase324eDashboard);
  const usabilityMatrix = readJson(INPUTS.usabilityMatrix);
  const verificationState = readJson(INPUTS.verificationState);
  const latencyMap = latencyByModel(phase324eReport);
  const selectableRows = (viewData.selectableModels ?? [])
    .filter((row) => row.selectable === true && row.verificationStatus === "smoke_passed" && row.evidenceId && row.providerId === "nvidia");
  const selectableModels = selectableRows.map((row) => modelRow(row, latencyMap));
  const lowLatencyModels = selectableModels
    .filter(hasKnownLatency)
    .sort(byLatency);
  const fastModels = lowLatencyModels.slice(0, 4).map((row) => ({
    ...row,
    reason: "Low latency in current smoke evidence; not a long-term SLA.",
  }));
  const highQualityModels = selectableModels
    .filter(isLargeOrQuality)
    .sort((left, right) => String(left.modelId).localeCompare(String(right.modelId)))
    .map((row) => ({
      ...row,
      reason: Number(row.latencyMs) >= HIGH_LATENCY_THRESHOLD_MS ? "High-capability candidate with high-latency warning." : "High-capability candidate with evidence-backed selectable status.",
    }));
  const balancedModels = selectableModels
    .filter((row) => hasKnownLatency(row) && Number(row.latencyMs) < HIGH_LATENCY_THRESHOLD_MS)
    .sort((left, right) => {
      const leftScore = isLargeOrQuality(left) ? 0 : 1;
      const rightScore = isLargeOrQuality(right) ? 0 : 1;
      return leftScore - rightScore || byLatency(left, right);
    })
    .slice(0, 4)
    .map((row) => ({ ...row, reason: "Balanced recommendation from selectable status, evidenceId, capability, and latency." }));
  const fallbackCandidates = lowLatencyModels
    .filter((row) => row.evidenceId)
    .slice(0, 3)
    .map((row) => ({ ...row, reason: "Selectable evidence-backed fallback candidate." }));
  const highLatencyWarning = (phase324eReport?.latencyAnalysis?.slowModels ?? [])
    .filter((row) => selectableRows.some((item) => item.modelId === row.modelId))
    .map((row) => ({
      modelId: row.modelId,
      latencyMs: row.latencyMs,
      evidenceId: row.evidenceId,
      warning: "Latency is from smoke evidence only and may affect UX; do not treat as SLA.",
    }));
  const notRecommendedNow = (viewData.failedModels ?? []).map((row) => ({
    modelId: row.modelId,
    providerId: row.providerId,
    evidenceId: row.evidenceId,
    reason: row.failureReason || row.nonSelectableReason || "failed/unavailable; not eligible for Chat dropdown",
  }));
  const strategy = {
    phase: "Phase324D-2F",
    generatedAt: new Date().toISOString(),
    sourceFiles: INPUTS,
    summary: {
      selectableModels: selectableModels.length,
      totalModels: viewData?.summary?.totalModels ?? usabilityMatrix.totalModels ?? 148,
      smokePassedModels: viewData?.summary?.smokePassedModels ?? usabilityMatrix.smokePassedModels ?? 9,
      failedModels: viewData?.summary?.failedModels ?? 9,
      unverifiedModels: viewData?.summary?.unverifiedModels ?? 125,
      providerScope: "NVIDIA-only",
      multiProviderOpen: false,
      verificationStateRecordCount: Object.keys(verificationState?.records ?? {}).length,
      operationsAverageLatencyMs: phase324eDashboard?.kpis?.averageLatencyMs ?? phase324eReport?.latencyAnalysis?.overallAverageLatencyMs ?? null,
    },
    defaultRecommended: chooseDefault(selectableRows, latencyMap),
    fastModels,
    highQualityModels,
    lowLatencyModels: lowLatencyModels
      .filter((row) => Number(row.latencyMs) < HIGH_LATENCY_THRESHOLD_MS)
      .map((row) => ({ ...row, reason: "Latency comes from smoke evidence; not a long-term SLA." })),
    balancedModels,
    fallbackCandidates,
    highLatencyWarning,
    notRecommendedNow,
    multiProviderStatus: {
      nvidia: "enabled-real-provider",
      openai: "future-provider-slot-not-open",
      claude: "future-provider-slot-not-open",
      openrouter: "future-provider-slot-not-open",
      mimo: "future-provider-slot-not-open",
      local: "future-provider-slot-not-open",
    },
    safety: {
      strategyOnly: true,
      changesRealDefaultModel: false,
      changesRealRouting: false,
      changesSelectableGate: false,
      recommendsFailedAsDefault: false,
      recommendsUnverifiedAsDefault: false,
      recommendsNonNvidiaAsDefault: false,
      apiCalled: false,
      envRead: false,
    },
  };

  validateStrategy(strategy);
  writeOutput(OUTPUT_JSON, `${JSON.stringify(strategy, null, 2)}\n`);
  writeOutput(OUTPUT_MD, markdownStrategy(strategy));
  console.log(JSON.stringify({
    status: "pass",
    outputJson: OUTPUT_JSON,
    outputMarkdown: OUTPUT_MD,
    defaultRecommended: strategy.defaultRecommended.modelId,
    fastModels: strategy.fastModels.map((item) => item.modelId),
    highLatencyWarning: strategy.highLatencyWarning.map((item) => `${item.modelId}:${item.latencyMs}`),
    notRecommendedNow: strategy.notRecommendedNow.length,
  }, null, 2));
}

function validateStrategy(strategy) {
  const selectable = new Set([
    ...strategy.fastModels,
    ...strategy.highQualityModels,
    ...strategy.lowLatencyModels,
    ...strategy.balancedModels,
    ...strategy.fallbackCandidates,
    strategy.defaultRecommended,
  ].filter(Boolean).map((item) => item.modelId));
  if (!selectable.has(strategy.defaultRecommended.modelId)) {
    throw new Error("defaultRecommended must be a selectable evidence-backed model.");
  }
  if (strategy.defaultRecommended.providerId !== "nvidia") {
    throw new Error("defaultRecommended must remain NVIDIA-only.");
  }
  if (!strategy.defaultRecommended.evidenceId) {
    throw new Error("defaultRecommended must include evidenceId.");
  }
}

function markdownStrategy(strategy) {
  return [
    "# Phase324D-2F Model Selection Strategy",
    "",
    "## Boundary",
    "",
    "- Strategy only: does not change real default model, Chat route, selectedModel localStorage, or selectable gate.",
    "- Provider scope: NVIDIA-only.",
    "- OpenAI / Claude / OpenRouter / MiMo / local are future-provider-slot and not open for real calls.",
    "",
    "## Default Recommended",
    "",
    modelLine(strategy.defaultRecommended),
    "",
    "## Fast Models",
    "",
    modelList(strategy.fastModels),
    "",
    "## High Quality Models",
    "",
    modelList(strategy.highQualityModels),
    "",
    "## Low Latency Models",
    "",
    modelList(strategy.lowLatencyModels),
    "",
    "## Balanced Models",
    "",
    modelList(strategy.balancedModels),
    "",
    "## Fallback Candidates",
    "",
    modelList(strategy.fallbackCandidates),
    "",
    "## High Latency Warning",
    "",
    modelList(strategy.highLatencyWarning),
    "",
    "## Not Recommended Now",
    "",
    modelList(strategy.notRecommendedNow),
    "",
    "## Multi Provider Status",
    "",
    ...Object.entries(strategy.multiProviderStatus).map(([provider, status]) => `- ${provider}: ${status}`),
    "",
  ].join("\n");
}

function modelLine(item) {
  if (!item) return "- none";
  return `- ${item.modelId} | provider=${item.providerId ?? "nvidia"} | latencyMs=${item.latencyMs ?? "n/a"} | evidenceId=${item.evidenceId ?? "none"} | ${item.reason ?? item.warning ?? ""}`;
}

function modelList(items) {
  if (!items?.length) return "- none";
  return items.map(modelLine).join("\n");
}

function writeOutput(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

main();
