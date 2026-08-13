import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function toPositiveInteger(raw, currentValue) {
  if (raw === undefined) return currentValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return currentValue;
  }
  const value = Math.floor(parsed);
  if (value <= 0) return currentValue;
  return value;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    trendPath: ".tmp/quality-trend.json",
    outputPath: ".tmp/quality-trend-summary.md",
    limit: 14,
    guardOutputPath: null,
    enforceGuardrails: false,
    maxConsecutiveFailures: null,
    maxScoreDropPoints: null,
    minPassRatePercent: null,
    requireStableState: false,
    outputJson: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--trend") {
      values.trendPath = args[index + 1] ?? values.trendPath;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      values.outputPath = args[index + 1] ?? values.outputPath;
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      values.limit = toPositiveInteger(args[index + 1], values.limit);
      index += 1;
      continue;
    }
    if (arg === "--guard-output") {
      values.guardOutputPath = args[index + 1] ?? values.guardOutputPath;
      index += 1;
      continue;
    }
    if (arg === "--max-consecutive-failures") {
      values.maxConsecutiveFailures = toPositiveInteger(
        args[index + 1],
        values.maxConsecutiveFailures,
      );
      index += 1;
      continue;
    }
    if (arg === "--max-score-drop-points") {
      values.maxScoreDropPoints = toPositiveInteger(
        args[index + 1],
        values.maxScoreDropPoints,
      );
      index += 1;
      continue;
    }
    if (arg === "--min-pass-rate-percent") {
      values.minPassRatePercent = toPositiveInteger(args[index + 1], values.minPassRatePercent);
      index += 1;
      continue;
    }
    if (arg === "--require-stable-state") {
      values.requireStableState = true;
      continue;
    }
    if (arg === "--enforce-guardrails") {
      values.enforceGuardrails = true;
      continue;
    }
    if (arg === "--json") {
      values.outputJson = true;
      continue;
    }
  }

  return values;
}

function readTrend(path) {
  const absolute = resolve(repoRoot, path);
  if (!existsSync(absolute)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(absolute, "utf8"));
  } catch {
    return null;
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "unknown";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }
  return date.toISOString();
}

function trendArrow(delta) {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function evaluateGuardrails(records, args) {
  const lookback = args.limit > 0 ? records.slice(-args.limit) : records;
  const latest = lookback[lookback.length - 1] ?? null;
  const previous = lookback[lookback.length - 2] ?? null;
  const passRate = lookback.length === 0
    ? 0
    : Number(
      ((lookback.reduce((sum, item) => (item?.overall?.pass ? sum + 1 : sum), 0) / lookback.length) * 100,
      ).toFixed(1),
    );

  const consecutiveFailures = (() => {
    let count = 0;
    for (const record of lookback.slice().reverse()) {
      if (record?.overall?.pass) break;
      count += 1;
    }
    return count;
  })();

  const latestScore = typeof latest?.quality?.score === "number" ? latest.quality.score : null;
  const previousScore = typeof previous?.quality?.score === "number"
    ? previous.quality.score
    : null;
  const latestScoreDelta = (latestScore === null || previousScore === null)
    ? null
    : latestScore - previousScore;
  const latestDrop = latestScoreDelta === null ? null : -latestScoreDelta;

  const largestDrop = (() => {
    if (lookback.length < 2) return null;
    let drop = 0;
    for (let index = 1; index < lookback.length; index += 1) {
      const left = lookback[index - 1];
      const right = lookback[index];
      const leftScore = typeof left?.quality?.score === "number" ? left.quality.score : null;
      const rightScore = typeof right?.quality?.score === "number" ? right.quality.score : null;
      if (leftScore === null || rightScore === null) {
        continue;
      }
      const candidate = leftScore - rightScore;
      if (candidate > drop) drop = candidate;
    }
    return drop;
  })();

  const issues = [];

  if (
    args.maxConsecutiveFailures !== null &&
    consecutiveFailures >= args.maxConsecutiveFailures
  ) {
    issues.push(
      `consecutive failures ${consecutiveFailures} meets or exceeds threshold ${args.maxConsecutiveFailures}`,
    );
  }

  if (
    args.maxScoreDropPoints !== null &&
    latestDrop !== null &&
    latestDrop > args.maxScoreDropPoints
  ) {
    issues.push(
      `single-run score drop ${latestDrop} exceeds threshold ${args.maxScoreDropPoints}`,
    );
  }

  if (
    args.minPassRatePercent !== null &&
    passRate < args.minPassRatePercent
  ) {
    issues.push(
      `window pass rate ${passRate}% is below threshold ${args.minPassRatePercent}%`,
    );
  }

  if (
    args.requireStableState &&
    (consecutiveFailures > 0 || passRate < (args.minPassRatePercent ?? 100))
  ) {
    issues.push("stable-state-required: unstable trend window detected");
  }

  return {
    pass: issues.length === 0,
    issues,
    checks: {
      consecutiveFailures,
      latestScore,
      previousScore,
      latestScoreDelta,
      latestSingleRunDrop: latestDrop,
      largestSingleRunDrop: largestDrop,
      passRate,
      lookbackSize: lookback.length,
      maxConsecutiveFailures: args.maxConsecutiveFailures,
      maxScoreDropPoints: args.maxScoreDropPoints,
      minPassRatePercent: args.minPassRatePercent,
      requireStableState: args.requireStableState,
    },
  };
}

function buildTrendReport({ trend, limit, guardrails }) {
  const records = Array.isArray(trend?.records) ? trend.records : [];
  const latest = records.slice(-limit).reverse();
  const latestRecord = latest[0] ?? null;

  let markdown = "";
  markdown += "# Quality Trend Summary\n\n";
  markdown += `- Total records: ${records.length}\n`;
  markdown += `- Reporting window: last ${Math.min(limit, records.length)} runs\n`;
  markdown += `- Schema version: ${trend?.schemaVersion ?? 1}\n`;
  markdown += `- Latest generated: ${formatDate(latestRecord?.recordedAtUtc)}\n`;
  markdown += `- Consecutive failures (newest-first): ${guardrails.checks.consecutiveFailures}\n`;
  if (guardrails.checks.latestScoreDelta === null) {
    markdown += "- Latest score delta: unknown\n";
  } else {
    markdown += `- Latest score delta: ${guardrails.checks.latestScoreDelta > 0 ? "+" : ""}${guardrails.checks.latestScoreDelta}\n`;
  }
  markdown += `- Guardrails enabled: ${guardrails.pass ? "pass" : "fail"}\n`;
  markdown += `- Stable state: ${guardrails.pass ? "stable" : "unstable"}\n`;
  markdown += `- Trend pass rate (${guardrails.checks.lookbackSize} runs): ${guardrails.checks.passRate}%\n`;
  if (guardrails.issues.length > 0) {
    markdown += "- Guardrail issues:\n";
    for (const issue of guardrails.issues) {
      markdown += `  - ${issue}\n`;
    }
  } else {
    markdown += "- Guardrail issues: none\n";
  }
  if (guardrails.checks.latestSingleRunDrop !== null) {
    markdown += `- Latest score drop: ${guardrails.checks.latestSingleRunDrop}\n`;
  }
  if (guardrails.checks.largestSingleRunDrop !== null) {
    markdown += `- Largest single run drop (full history): ${guardrails.checks.largestSingleRunDrop}\n`;
  }
  markdown += "\n";

  if (latest.length === 0) {
    markdown += "No trend data available.\n";
    return markdown;
  }

  markdown += "| time | run | score | pass | drill | verification | overall | required | notes |\n";
  markdown += "| --- | --- | --- | --- | --- | --- | --- | --- |\n";

  for (let index = 0; index < latest.length; index += 1) {
    const item = latest[index];
    const prev = latest[index + 1];
    const score = item.quality?.score;
    const maxScore = item.quality?.maxScore;
    const percent = item.quality?.percent;
    const pass = String(item.quality?.pass ?? false);
    const runLabel = item.runNumber ? `#${item.runNumber}` : "local";
    const runDetails = [
      item.runId ? `id=${item.runId}` : null,
      item.sha ? `sha=${item.sha.slice(0, 7)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const drift = (typeof score === "number" && typeof prev?.quality?.score === "number")
      ? `${trendArrow(score - prev.quality.score)} ${score - prev.quality.score}`
      : "N/A";

    const issues = Array.isArray(item.verification?.issues) && item.verification.issues.length > 0
      ? item.verification.issues.slice(0, 2).join(" / ")
      : "-";

    markdown += `| ${formatDate(item.recordedAtUtc)} | ${runLabel} ${runDetails} | ${score}/${maxScore} (${percent ?? "n/a"}%) ${drift} | ${pass} | ${item.drill?.status ?? "n/a"} | ${String(item.verification?.ok)} | ${item.overall?.pass ?? false} | ${item.quality?.requiredScore ?? "n/a"} | ${issues} |\n`;
  }

  if (guardrails.issues.length > 0) {
    markdown += "\n## Recommended triage actions\n\n";
    for (const note of buildTriageNotes(guardrails)) {
      markdown += `- ${note}\n`;
    }
  }

  return markdown;
}

function writeTrendReport(report, outputPath) {
  mkdirSync(resolve(repoRoot, dirname(outputPath)), { recursive: true });
  const absolutePath = resolve(repoRoot, outputPath);
  writeFileSync(absolutePath, `${report}\n`);
  return absolutePath;
}

function writeTrendJson(payload, outputPath) {
  const absolutePath = resolve(repoRoot, outputPath);
  const dirnamePath = dirname(absolutePath);
  mkdirSync(resolve(dirnamePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`);
  return absolutePath;
}

function publishStepSummary(content) {
  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!stepSummaryPath) return;
  appendToSummary(stepSummaryPath, content);
}

function appendToSummary(summaryPath, content) {
  writeFileSync(summaryPath, `${content}\n`, { flag: "a" });
}

function buildGuardSummary(args, trend, guardrails) {
  return {
    generatedAtUtc: new Date().toISOString(),
    trendFile: args.trendPath,
    outputFile: args.outputPath,
    totalRecords: Array.isArray(trend?.records) ? trend.records.length : 0,
    reportingWindow: Math.min(args.limit, Array.isArray(trend?.records) ? trend.records.length : 0),
    schemaVersion: trend?.schemaVersion ?? 1,
    latestRecord: Array.isArray(trend?.records) ? trend.records[trend.records.length - 1] : null,
    guardrails: {
      enabled:
        args.maxConsecutiveFailures !== null
        || args.maxScoreDropPoints !== null
        || args.minPassRatePercent !== null
        || args.requireStableState,
      enforce: args.enforceGuardrails,
      pass: guardrails.pass,
      state: guardrails.pass ? "stable" : "unstable",
      issues: guardrails.issues,
      checks: guardrails.checks,
      thresholds: {
        maxConsecutiveFailures: args.maxConsecutiveFailures,
        maxScoreDropPoints: args.maxScoreDropPoints,
        minPassRatePercent: args.minPassRatePercent,
        requireStableState: args.requireStableState,
      },
    },
  };
}

function buildTriageNotes(guardrails) {
  const notes = [];
  const issues = guardrails.issues ?? [];
  if (issues.length === 0) {
    notes.push("No guardrail action required; trend indicators are stable.");
    return notes;
  }

  for (const issue of issues) {
    if (issue.includes("consecutive failures")) {
      notes.push(
        "Consecutive failures indicate instability. Start from the latest failed verification artifacts and compare against the previous passing run.",
      );
    } else if (issue.includes("single-run score drop")) {
      notes.push(
        "Large one-run drop suggests a sudden regression. Compare `quality-scorecard.json` against previous run to find which check changed.",
      );
    } else if (issue.includes("window pass rate")) {
      notes.push(
        "Window pass rate is below threshold; check consecutive failures and latest failed verification payload.",
      );
    } else if (issue.includes("stable-state-required")) {
      notes.push(
        "Stable-state requirement triggered. Hold release/merge until trend trend returns to stable window behavior.",
      );
    } else {
      notes.push(`Investigate: ${issue}`);
    }
  }

  notes.push(
    "Run this full workflow locally with `pnpm quality:ci -- --json --require-score <threshold>` and inspect logs from `quality-ci-verification.json`.",
  );
  notes.push("Use `pnpm quality:trend-summary -- --trend .tmp/quality-trend.json --output .tmp/quality-trend-summary.md --guard-output .tmp/quality-trend-guardrail.json --json` for a machine-readable view.");
  return notes;
}

function main() {
  const args = parseArgs();
  const trend = readTrend(args.trendPath);
  if (!trend || !Array.isArray(trend.records)) {
    process.stderr.write(`quality trend not available: ${args.trendPath}\n`);
    process.exitCode = 1;
    return;
  }

  const guardrails = evaluateGuardrails(trend.records, args);
  const report = buildTrendReport({ trend, limit: args.limit, guardrails });
  const absolute = writeTrendReport(report, args.outputPath);
  publishStepSummary(report);
  const guardSummary = buildGuardSummary(args, trend, guardrails);
  if (args.guardOutputPath) {
    writeTrendJson(guardSummary, args.guardOutputPath);
  }
  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(guardSummary, null, 2)}\n`);
  }
  process.stdout.write(`quality trend summary written: ${absolute}\n`);
  process.stdout.write(`records total: ${trend.records.length}\n`);

  if (!guardrails.pass && args.enforceGuardrails) {
    process.stdout.write(`trend guardrail failed: ${guardrails.issues.length} issue(s)\n`);
    process.exitCode = 1;
  }
}

main();
