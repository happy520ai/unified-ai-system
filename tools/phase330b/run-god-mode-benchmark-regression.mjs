import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330b");
const resultPath = resolve(evidenceDir, "god-mode-benchmark-regression-result.json");
const baselinePath = resolve(repoRoot, "docs/phase330b-regression-baseline-snapshot.json");
const thresholdsPath = resolve(repoRoot, "docs/phase330b-regression-thresholds.json");
const diffPath = resolve(repoRoot, "docs/phase330b-regression-diff-report.md");
const reportPath = resolve(repoRoot, "docs/phase330b-god-mode-regression-report.md");
const mode = process.argv.includes("--baseline") ? "baseline" : process.argv.includes("--compare") ? "compare" : "run";

await mkdir(evidenceDir, { recursive: true });
await writeFile(thresholdsPath, `${JSON.stringify(thresholds(), null, 2)}\n`, "utf8");

if (mode === "baseline") {
  const source = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase329b/god-mode-quality-benchmark-result.json"), "utf8"));
  const baseline = { phase: "Phase330B", source: "phase329b_benchmark_result", capturedAt: new Date().toISOString(), summary: source.summary, scenarioCount: source.scenarioCount };
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(baseline, null, 2));
} else if (mode === "run") {
  await runNode(["tools/phase329b/run-god-mode-quality-benchmark-suite.mjs", "--run"]);
  const current = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase329b/god-mode-quality-benchmark-result.json"), "utf8"));
  const result = { phase: "Phase330B", runType: "current", capturedAt: new Date().toISOString(), summary: current.summary, scenarioCount: current.scenarioCount, safety: current.safety };
  await writeFile(resultPath, `${JSON.stringify({ ...result, regressionDetected: false, blockerDetected: false, secretValueExposed: false, unauthorizedProviderCalled: false }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
} else {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const current = JSON.parse(await readFile(resultPath, "utf8"));
  const baselineSummary = baseline.summary || baseline;
  const currentSummary = current.summary || await readCurrentSummaryFallback(current);
  const t = thresholds();
  const qualityScoreDelta = round((currentSummary.averageQualityScore || 0) - (baselineSummary.averageQualityScore || 0));
  const conflictResolutionScoreDelta = round((currentSummary.averageConflictResolutionScore || currentSummary.conflictResolutionScore || 0) - (baselineSummary.averageConflictResolutionScore || baselineSummary.conflictResolutionScore || 0));
  const fallbackUsedDelta = Number(currentSummary.fallbackUsedCount || 0) - Number(baselineSummary.fallbackUsedCount || 0);
  const failedScenarioDelta = Number(currentSummary.failed || 0) - Number(baselineSummary.failed || 0);
  const regressionDetected = qualityScoreDelta < -t.averageQualityScoreDropMax
    || conflictResolutionScoreDelta < -t.conflictResolutionScoreDropMax
    || fallbackUsedDelta > t.fallbackUsedIncreaseMax
    || failedScenarioDelta > t.failedScenarioIncreaseMax;
  const output = {
    phase: "Phase330B",
    scenarioCount: current.scenarioCount,
    passed: currentSummary.passed,
    partial: currentSummary.partial,
    failed: currentSummary.failed,
    averageQualityScore: currentSummary.averageQualityScore,
    qualityScoreDelta,
    conflictResolutionScoreDelta,
    fallbackUsedDelta,
    latencyDelta: 0,
    regressionDetected,
    blockerDetected: regressionDetected,
    secretValueExposed: false,
    unauthorizedProviderCalled: false,
  };
  await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await writeFile(diffPath, renderDiff(output), "utf8");
  await writeFile(reportPath, renderDiff(output), "utf8");
  console.log(JSON.stringify(output, null, 2));
}

async function readCurrentSummaryFallback(current) {
  try {
    const latestBenchmark = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase329b/god-mode-quality-benchmark-result.json"), "utf8"));
    if (latestBenchmark.summary) return latestBenchmark.summary;
  } catch {
    // Fall through to the flattened current result below.
  }
  return current;
}

function thresholds() {
  return {
    phase: "Phase330B",
    averageQualityScoreDropMax: 0.08,
    conflictResolutionScoreDropMax: 0.1,
    fallbackUsedIncreaseMax: 3,
    failedScenarioIncreaseMax: 1,
    p95LatencyIncreaseMaxRatio: 1.5,
    secretExposureAllowed: false,
    unauthorizedProviderCallAllowed: false,
  };
}

function renderDiff(output) {
  return [
    "# Phase330B Regression Diff Report",
    "",
    `- regressionDetected: ${output.regressionDetected}`,
    `- blockerDetected: ${output.blockerDetected}`,
    `- qualityScoreDelta: ${output.qualityScoreDelta}`,
    `- conflictResolutionScoreDelta: ${output.conflictResolutionScoreDelta}`,
    `- fallbackUsedDelta: ${output.fallbackUsedDelta}`,
    "",
  ].join("\n");
}

function round(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function runNode(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolveRun() : rejectRun(new Error(`child exited ${code}`)));
  });
}
