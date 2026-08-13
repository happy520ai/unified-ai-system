import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    trendPath: ".tmp/quality-trend.json",
    outputPath: ".tmp/quality-trend-summary.md",
    limit: 14,
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
      const raw = args[index + 1];
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        values.limit = Math.floor(parsed);
      }
      index += 1;
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

function buildTrendReport({ trend, limit }) {
  const records = Array.isArray(trend?.records) ? trend.records : [];
  const latest = records.slice(-limit).reverse();
  const latestRecord = latest[0] ?? null;

  let markdown = "";
  markdown += "# Quality Trend Summary\n\n";
  markdown += `- Total records: ${records.length}\n`;
  markdown += `- Reporting window: last ${Math.min(limit, records.length)} runs\n`;
  markdown += `- Schema version: ${trend?.schemaVersion ?? 1}\n`;
  markdown += `- Latest generated: ${formatDate(latestRecord?.recordedAtUtc)}\n\n`;

  const consecutiveFailures = (() => {
    let count = 0;
    for (const record of records.slice().reverse()) {
      if (record?.overall?.pass) break;
      count += 1;
    }
    return count;
  })();

  markdown += `- Consecutive failures (newest-first): ${consecutiveFailures}\n\n`;

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
    const runDetails = [item.runId ? `id=${item.runId}` : null, item.sha ? `sha=${item.sha.slice(0, 7)}` : null]
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

  return markdown;
}

function writeTrendReport(report, outputPath) {
  mkdirSync(resolve(repoRoot, dirname(outputPath)), { recursive: true });
  const absolutePath = resolve(repoRoot, outputPath);
  writeFileSync(absolutePath, `${report}\n`);
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

function main() {
  const args = parseArgs();
  const trend = readTrend(args.trendPath);
  if (!trend || !Array.isArray(trend.records)) {
    process.stderr.write(`quality trend not available: ${args.trendPath}\n`);
    process.exitCode = 1;
    return;
  }

  const report = buildTrendReport({ trend, limit: args.limit });
  const absolute = writeTrendReport(report, args.outputPath);
  publishStepSummary(report);
  process.stdout.write(`quality trend summary written: ${absolute}\n`);
  process.stdout.write(`records total: ${trend.records.length}\n`);
}

main();
