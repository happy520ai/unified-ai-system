import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase332b");
const resultPath = resolve(evidenceDir, "god-mode-trend-alert-evaluation-result.json");
const rulesPath = resolve(repoRoot, "docs/phase332b-god-mode-trend-alert-rules.json");
const reportPath = resolve(repoRoot, "docs/phase332b-god-mode-alert-evaluation-report.md");

const trend = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase331b/god-mode-benchmark-historical-trend-result.json"), "utf8"));
const rules = buildRules();
const triggered = evaluateRules(rules, trend);
const result = {
  phase: "Phase332B",
  alertsEvaluated: rules.length,
  alertsTriggered: triggered.length,
  criticalAlerts: triggered.filter((alert) => alert.severity === "critical").length,
  warningAlerts: triggered.filter((alert) => alert.severity === "warning").length,
  blockerDetected: triggered.some((alert) => alert.blocker),
  trendStatus: trend.trendStatus,
  insufficientHistory: trend.trendStatus === "insufficient_history",
  triggeredAlerts: triggered,
  secretValueExposed: false,
  unauthorizedProviderCalled: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(rulesPath, `${JSON.stringify({ phase: "Phase332B", rules }, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332b-god-mode-trend-alert-rules-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332b-alert-routing-policy.md"), renderRoutingPolicy(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332b-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildRules() {
  return [
    rule("qualityScoreDropAlert", "averageQualityScore", "warning", 0.08, "drop_gt", false, "Quality score dropped beyond threshold."),
    rule("conflictResolutionDropAlert", "conflictResolutionScore", "warning", 0.1, "drop_gt", false, "Conflict resolution score dropped."),
    rule("fallbackSpikeAlert", "fallbackUsedCount", "warning", 3, "increase_gt", false, "Fallback usage spiked."),
    rule("failedScenarioSpikeAlert", "failedScenarioCount", "warning", 1, "increase_gt", true, "Failed benchmark scenarios increased."),
    rule("latencyRegressionAlert", "p95LatencyMs", "warning", 1.5, "ratio_gt", false, "Latency regression observed."),
    rule("costEstimateSpikeAlert", "costEstimate", "warning", 1.5, "ratio_gt", false, "Cost estimate spiked."),
    rule("secretExposureCriticalAlert", "secretExposureCount", "critical", 0, "gt", true, "Secret exposure detected."),
    rule("unauthorizedProviderCallCriticalAlert", "unauthorizedProviderCallCount", "critical", 0, "gt", true, "Unauthorized provider call detected."),
    rule("failedHighRiskModelUsedCriticalAlert", "failedHighRiskModelUsed", "critical", 0, "gt", true, "Failed or high-risk model used."),
    rule("benchmarkHistoryInsufficientWarning", "trendStatus", "warning", "insufficient_history", "eq", false, "Benchmark history is insufficient."),
  ];
}

function rule(alertId, metric, severity, threshold, comparison, blocker, message) {
  return {
    alertId,
    metric,
    severity,
    threshold,
    comparison,
    evaluationWindow: "phase331_historical_trend_points",
    enabled: true,
    blocker,
    message,
    recommendedAction: "review Phase331B trend dashboard and rerun benchmark before expanding beta scope",
    rollbackHint: "hold limited beta expansion and restore previous benchmark baseline",
  };
}

function evaluateRules(rules, trend) {
  return rules.filter((item) => {
    if (!item.enabled) return false;
    if (item.metric === "trendStatus") return trend.trendStatus === item.threshold;
    if (item.metric === "failedHighRiskModelUsed") return trend.safety?.failedHighRiskModelUsed === true;
    if (item.metric === "secretExposureCount") return maxMetric(trend, item.metric) > 0 || trend.safety?.secretValueExposed === true;
    if (item.metric === "unauthorizedProviderCallCount") return maxMetric(trend, item.metric) > 0 || trend.safety?.unauthorizedProviderCalled === true;
    if (item.comparison === "drop_gt") return deltaMetric(trend, item.metric) < -Number(item.threshold);
    if (item.comparison === "increase_gt") return deltaMetric(trend, item.metric) > Number(item.threshold);
    if (item.comparison === "ratio_gt") return ratioMetric(trend, item.metric) > Number(item.threshold);
    if (item.comparison === "gt") return maxMetric(trend, item.metric) > Number(item.threshold);
    return false;
  });
}

function metricValues(trend, metric) {
  return trend.metrics?.[metric] || trend.history?.map((item) => item[metric]) || [];
}

function deltaMetric(trend, metric) {
  const values = metricValues(trend, metric).map(Number);
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

function ratioMetric(trend, metric) {
  const values = metricValues(trend, metric).map(Number);
  if (values.length < 2 || values[0] === 0) return 0;
  return values[values.length - 1] / values[0];
}

function maxMetric(trend, metric) {
  return Math.max(0, ...metricValues(trend, metric).map(Number));
}

function renderDesign() {
  return [
    "# Phase332B God Mode Trend Alert Rules Design",
    "",
    "Alert rules are evaluated locally against Phase331B trend data only. No PagerDuty, Slack, email, or external alerting system is connected.",
    "",
  ].join("\n");
}

function renderRoutingPolicy() {
  return [
    "# Phase332B Alert Routing Policy",
    "",
    "- critical: block beta expansion and require manual reviewer acknowledgement.",
    "- warning: keep dry-run active and request benchmark rerun before cohort expansion.",
    "- external integrations: not connected.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase332B God Mode Alert Evaluation Report",
    "",
    `- alertsEvaluated: ${result.alertsEvaluated}`,
    `- alertsTriggered: ${result.alertsTriggered}`,
    `- criticalAlerts: ${result.criticalAlerts}`,
    `- warningAlerts: ${result.warningAlerts}`,
    `- blockerDetected: ${result.blockerDetected}`,
    `- trendStatus: ${result.trendStatus}`,
    "",
  ].join("\n");
}
