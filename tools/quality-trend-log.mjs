import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    qualityPath: ".tmp/quality-scorecard.json",
    verificationPath: ".tmp/quality-ci-verification.json",
    drillPath: ".tmp/circuit-recovery-drill-dry-run.json",
    trendPath: ".tmp/quality-trend.json",
    runId: process.env.GITHUB_RUN_ID ?? "",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
    runNumber: process.env.GITHUB_RUN_NUMBER ?? "",
    workflow: process.env.GITHUB_WORKFLOW ?? "",
    repository: process.env.GITHUB_REPOSITORY ?? "",
    ref: process.env.GITHUB_REF ?? "",
    sha: process.env.GITHUB_SHA ?? "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--quality") {
      values.qualityPath = args[index + 1] ?? values.qualityPath;
      index += 1;
      continue;
    }
    if (arg === "--verification") {
      values.verificationPath = args[index + 1] ?? values.verificationPath;
      index += 1;
      continue;
    }
    if (arg === "--drill") {
      values.drillPath = args[index + 1] ?? values.drillPath;
      index += 1;
      continue;
    }
    if (arg === "--trend") {
      values.trendPath = args[index + 1] ?? values.trendPath;
      index += 1;
      continue;
    }
  }

  return values;
}

function readJsonOrNull(path) {
  const resolved = resolve(repoRoot, path);
  if (!existsSync(resolved)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(resolved, "utf8"));
  } catch {
    return null;
  }
}

function getScoreStatus(qualitySummary, verificationSummary, drillSummary) {
  const issues = [];
  const qualityScore = qualitySummary?.score;
  const qualityMaxScore = qualitySummary?.maxScore;
  const qualityPercent = qualitySummary?.percent;
  const qualityPass = qualitySummary?.pass ?? false;
  const drillStatus = drillSummary?.status;
  const verificationOk = verificationSummary?.ok;
  const requiredScore = verificationSummary?.checks?.requiredScore;
  const requiredScoreMet = verificationSummary?.checks?.requiredScoreMet;
  const issuesFromVerification = Array.isArray(verificationSummary?.issues)
    ? verificationSummary.issues
    : [];

  if (!qualitySummary) {
    issues.push("quality-summary-missing");
  }
  if (!verificationSummary) {
    issues.push("verification-summary-missing");
  }
  if (!drillSummary) {
    issues.push("drill-summary-missing");
  }
  if (typeof qualityScore !== "number") {
    issues.push("quality-score-missing");
  }
  if (typeof qualityMaxScore !== "number") {
    issues.push("quality-max-score-missing");
  }
  if (typeof qualityPercent !== "number") {
    issues.push("quality-percent-missing");
  }

  return {
    qualityScore,
    qualityMaxScore,
    qualityPercent,
    qualityPass,
    drillStatus,
    verificationOk,
    requiredScore,
    requiredScoreMet,
    issues: issues.concat(issuesFromVerification).filter(Boolean),
  };
}

function toTrendRecord({ qualitySummary, verificationSummary, drillSummary, args }) {
  const scoreStatus = getScoreStatus(qualitySummary, verificationSummary, drillSummary);
  return {
    recordedAtUtc: new Date().toISOString(),
    source: "quality-ci-gate",
    workflow: args.workflow,
    runId: args.runId,
    runAttempt: args.runAttempt,
    runNumber: args.runNumber,
    ref: args.ref,
    sha: args.sha,
    repository: args.repository,
    quality: {
      score: scoreStatus.qualityScore,
      maxScore: scoreStatus.qualityMaxScore,
      percent: scoreStatus.qualityPercent,
      pass: scoreStatus.qualityPass,
      requiredScore: scoreStatus.requiredScore,
      requiredScoreMet: scoreStatus.requiredScoreMet,
    },
    drill: {
      status: scoreStatus.drillStatus,
      recommendation: drillSummary?.recommendation ?? null,
    },
    verification: {
      ok: scoreStatus.verificationOk ?? null,
      issues: scoreStatus.issues,
    },
    overall: {
      pass: Boolean(scoreStatus.verificationOk) && scoreStatus.qualityPass && Boolean(scoreStatus.issues.length === 0),
      reason: scoreStatus.issues.length === 0
        ? "pass"
        : "quality-ci-gate-failed",
    },
  };
}

function writeTrend(trendPath, record) {
  mkdirSync(resolve(repoRoot, dirname(trendPath)), { recursive: true });
  const existing = readJsonOrNull(trendPath);
  const payload = (() => {
    if (existing && Array.isArray(existing.records)) {
      const records = existing.records.concat([record]);
      return {
        ...existing,
        updatedAtUtc: new Date().toISOString(),
        records: records.slice(-365),
      };
    }
    if (existing && typeof existing === "object") {
      return {
        schemaVersion: 1,
        createdAtUtc: existing.createdAtUtc ?? new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
        records: [record],
      };
    }
    return {
      schemaVersion: 1,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
      records: [record],
    };
  })();

  writeFileSync(resolve(repoRoot, trendPath), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function main() {
  const args = parseArgs();
  const qualitySummary = readJsonOrNull(args.qualityPath);
  const verificationSummary = readJsonOrNull(args.verificationPath);
  const drillSummary = readJsonOrNull(args.drillPath);
  const latest = toTrendRecord({
    qualitySummary,
    verificationSummary,
    drillSummary,
    args,
  });
  const trend = writeTrend(args.trendPath, latest);

  process.stdout.write(`${JSON.stringify(latest, null, 2)}\n`);
  process.stdout.write(`Quality trend records: ${trend.records.length}\n`);
  process.exitCode = latest.overall.pass ? 0 : 1;
}

main();
