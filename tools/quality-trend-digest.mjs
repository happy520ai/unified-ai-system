import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function toPositiveInteger(raw, currentValue) {
  if (raw === undefined) return currentValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return currentValue;
  const value = Math.floor(parsed);
  if (value <= 0) return currentValue;
  return value;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    trendPath: ".tmp/quality-trend.json",
    outputPath: ".tmp/quality-trend-digest.md",
    outputJsonPath: ".tmp/quality-trend-digest.json",
    jsonOutput: false,
    shortWindow: 7,
    longWindow: 30,
    maxConsecutiveFailures: 3,
    maxScoreDropPoints: 20,
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
    if (arg === "--json-output") {
      values.outputJsonPath = args[index + 1] ?? values.outputJsonPath;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      values.jsonOutput = true;
      continue;
    }
    if (arg === "--short-window") {
      values.shortWindow = toPositiveInteger(args[index + 1], values.shortWindow);
      index += 1;
      continue;
    }
    if (arg === "--long-window") {
      values.longWindow = toPositiveInteger(args[index + 1], values.longWindow);
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
  }

  return values;
}

function readTrend(path) {
  const absolute = resolve(repoRoot, path);
  if (!existsSync(absolute)) return null;
  try {
    const parsed = JSON.parse(readFileSync(absolute, "utf8"));
    return parsed?.records && Array.isArray(parsed.records) ? parsed : null;
  } catch {
    return null;
  }
}

function countRecentFailures(records, startIndex) {
  let count = 0;
  for (let index = startIndex; index >= 0; index -= 1) {
    if (records[index]?.overall?.pass) break;
    count += 1;
  }
  return count;
}

function evaluateIssueCounts(records, args) {
  const issues = {
    consecutiveFailuresBreaches: 0,
    scoreDropBreaches: 0,
    breachDetails: [],
    largestDrop: 0,
    largestDropRun: null,
  };

  for (let index = 1; index < records.length; index += 1) {
    const right = records[index];
    const left = records[index - 1];
    if (!left || !right) continue;
    const leftScore = left?.quality?.score;
    const rightScore = right?.quality?.score;
    if (typeof leftScore === "number" && typeof rightScore === "number") {
      const drop = Math.max(0, leftScore - rightScore);
      if (drop > issues.largestDrop) {
        issues.largestDrop = drop;
        issues.largestDropRun = {
          runIndex: index,
          leftRunId: left.runId,
          rightRunId: right.runId,
          drop,
          leftScore,
          rightScore,
          recordedAtUtc: right.recordedAtUtc ?? right.time,
        };
      }
      if (drop > args.maxScoreDropPoints) {
        issues.scoreDropBreaches += 1;
      }
    }
  }

  for (let index = 0; index < records.length; index += 1) {
    const runFailures = countRecentFailures(records, index);
    if (runFailures >= args.maxConsecutiveFailures) {
      issues.consecutiveFailuresBreaches += 1;
      issues.breachDetails.push({
        runIndex: index,
        recordedAtUtc: records[index]?.recordedAtUtc,
        runId: records[index]?.runId,
        consecutiveFailures: runFailures,
      });
      if (issues.breachDetails.length > 10) break;
    }
  }

  if (issues.breachDetails.length > 10) {
    issues.breachDetails = issues.breachDetails.slice(0, 10);
  }

  return issues;
}

function summarizeWindow(records, windowSize, args) {
  const normalizedWindow = windowSize <= 0 ? 1 : windowSize;
  const selected = records.slice(-normalizedWindow);
  if (selected.length === 0) {
    return {
      windowSize: normalizedWindow,
      records: 0,
      latestScore: null,
      earliestScore: null,
      scoreDelta: null,
      passCount: 0,
      failCount: 0,
      avgScorePercent: null,
      maxScore: null,
      minScore: null,
      consecutiveFailuresAtEnd: 0,
      issueCount: 0,
    };
  }

  const scores = selected
    .map((record) => record?.quality?.score)
    .filter((value) => typeof value === "number");

  const passes = selected.reduce(
    (sum, current) => (current?.overall?.pass ? sum + 1 : sum),
    0,
  );
  const fail = selected.length - passes;

  const issues = evaluateIssueCounts(selected, args);
  const latest = selected[selected.length - 1];
  const earliest = selected[0];
  const latestScore = typeof latest?.quality?.score === "number" ? latest.quality.score : null;
  const earliestScore = typeof earliest?.quality?.score === "number" ? earliest.quality.score : null;
  const scoreDelta = (latestScore === null || earliestScore === null) ? null : latestScore - earliestScore;

  const avgScorePercent = (() => {
    if (scores.length === 0) return null;
    const sum = scores.reduce((acc, value) => acc + value, 0);
    return Math.round((sum / scores.length) * 10) / 10;
  })();

  return {
    windowSize: normalizedWindow,
    records: selected.length,
    latestScore,
    earliestScore,
    scoreDelta,
    passCount: passes,
    failCount: fail,
    avgScorePercent,
    maxScore: scores.length ? Math.max(...scores) : null,
    minScore: scores.length ? Math.min(...scores) : null,
    consecutiveFailuresAtEnd: countRecentFailures(selected, selected.length - 1),
    issueCount: issues.consecutiveFailuresBreaches + issues.scoreDropBreaches,
    issueBreakdown: {
      consecutiveFailuresBreaches: issues.consecutiveFailuresBreaches,
      scoreDropBreaches: issues.scoreDropBreaches,
      largestDrop: issues.largestDrop,
      largestDropRun: issues.largestDropRun,
    },
  };
}

function formatDate(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function buildDigest(trend, args) {
  const records = trend.records;
  const totalRecords = records.length;
  const shortSummary = summarizeWindow(records, args.shortWindow, args);
  const longSummary = summarizeWindow(records, args.longWindow, args);

  const trendTrend = (() => {
    if (shortSummary.scoreDelta === null || longSummary.scoreDelta === null) return "unknown";
    if (shortSummary.scoreDelta > 0 && longSummary.scoreDelta > 0) return "strong-improving";
    if (shortSummary.scoreDelta > 0 || longSummary.scoreDelta > 0) return "mixed";
    if (shortSummary.scoreDelta === 0 && longSummary.scoreDelta === 0) return "flat";
    if (shortSummary.scoreDelta < 0 && longSummary.scoreDelta < 0) return "regressing";
    return "mixed";
  })();

  return {
    generatedAtUtc: new Date().toISOString(),
    totalRecords,
    thresholds: {
      maxConsecutiveFailures: args.maxConsecutiveFailures,
      maxScoreDropPoints: args.maxScoreDropPoints,
    },
    shortWindow: shortSummary,
    longWindow: longSummary,
    trendState: trendTrend,
    sample: {
      latest: records[records.length - 1] ?? null,
    },
  };
}

function buildDigestMarkdown(digest) {
  const lines = [];
  lines.push("# Quality Trend Digest");
  lines.push("");
  lines.push(`- Total records: ${digest.totalRecords}`);
  lines.push(`- Trend health state: ${digest.trendState}`);
  lines.push(`- Short window: last ${digest.shortWindow.windowSize} runs`);
  lines.push(`- Long window: last ${digest.longWindow.windowSize} runs`);
  lines.push(`- Thresholds: consecutiveFailures>=${digest.thresholds.maxConsecutiveFailures}, singleRunDrop>${digest.thresholds.maxScoreDropPoints}`);

  for (const entry of [digest.shortWindow, digest.longWindow]) {
    lines.push("");
    lines.push(`## Window: last ${entry.windowSize} runs`);
    lines.push(`- Pass count: ${entry.passCount}`);
    lines.push(`- Fail count: ${entry.failCount}`);
    lines.push(`- Latest score: ${entry.latestScore === null ? "unknown" : entry.latestScore}`);
    lines.push(`- Earliest score: ${entry.earliestScore === null ? "unknown" : entry.earliestScore}`);
    lines.push(`- Score delta (end - start): ${entry.scoreDelta === null ? "unknown" : entry.scoreDelta}`);
    lines.push(`- Avg score: ${entry.avgScorePercent === null ? "unknown" : entry.avgScorePercent}`);
    lines.push(`- Max score: ${entry.maxScore === null ? "unknown" : entry.maxScore}`);
    lines.push(`- Min score: ${entry.minScore === null ? "unknown" : entry.minScore}`);
    lines.push(`- Consecutive failures at run end: ${entry.consecutiveFailuresAtEnd}`);
    lines.push(`- Trend issues in window: ${entry.issueCount}`);
    lines.push(`- Largest single-run drop: ${entry.issueBreakdown.largestDrop}`);
    if (entry.issueBreakdown.largestDropRun) {
      lines.push(`- Largest drop run id: ${entry.issueBreakdown.largestDropRun.rightRunId || "n/a"} (${formatDate(entry.issueBreakdown.largestDropRun.recordedAtUtc)})`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeText(path, content) {
  const absolute = resolve(repoRoot, path);
  mkdirSync(resolve(dirname(absolute)), { recursive: true });
  writeFileSync(absolute, `${content}\n`);
  return absolute;
}

function writeJson(path, payload) {
  const absolute = resolve(repoRoot, path);
  mkdirSync(resolve(dirname(absolute)), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`);
  return absolute;
}

function main() {
  const args = parseArgs();
  const trend = readTrend(args.trendPath);
  if (!trend) {
    process.stderr.write(`quality trend not available: ${args.trendPath}\n`);
    process.exitCode = 1;
    return;
  }

  const digest = buildDigest(trend, args);
  const markdown = buildDigestMarkdown(digest);
  const output = writeText(args.outputPath, markdown);
  const outputJson = writeJson(args.outputJsonPath, digest);
  process.stdout.write(`quality trend digest written: ${output}\n`);
  process.stdout.write(`quality trend digest json written: ${outputJson}\n`);

  if (args.jsonOutput) {
    process.stdout.write(`${JSON.stringify(digest, null, 2)}\n`);
  }
}

main();
