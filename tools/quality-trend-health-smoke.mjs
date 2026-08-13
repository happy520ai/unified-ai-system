#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function parsePositiveInteger(raw, fallback) {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function parseBoolean(raw, fallback = false) {
  if (raw === undefined) return fallback;
  if (typeof raw === "boolean") return raw;
  const normalized = String(raw).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    outputJson: false,
    resultJsonPath: null,
    showHelp: false,
    unknownArgs: [],
    qualityThreshold: parsePositiveInteger(process.env.QUALITY_THRESHOLD, 165),
    requireTrendHealth: parseBoolean(process.env.QUALITY_REQUIRE_TREND_HEALTH, true),
    trendPath: ".tmp/quality-trend.json",
    trendSummaryPath: ".tmp/quality-trend-summary.md",
    trendGuardrailPath: ".tmp/quality-trend-guardrail.json",
    trendDigestPath: ".tmp/quality-trend-digest.md",
    trendDigestJsonPath: ".tmp/quality-trend-digest.json",
    trendCheckPath: ".tmp/quality-trend-check.json",
    trendRecommendationsPath: ".tmp/quality-trend-recommendations.md",
    trendIncidentBundlePath: ".tmp/quality-trend-incident-bundle.md",
    trendIncidentBundleJsonPath: ".tmp/quality-trend-incident-bundle.json",
    qualityScorecardPath: ".tmp/quality-scorecard.json",
    drillPath: ".tmp/circuit-recovery-drill-dry-run.json",
    qualityVerificationPath: ".tmp/quality-ci-verification.json",
    languagePolicyCheckPath: ".tmp/language-policy-check.json",
    languagePolicyExpiryPath: ".tmp/language-policy-expiry.json",
    languagePolicyScoreTarget: parsePositiveInteger(process.env.QUALITY_LANGUAGE_POLICY_SCORE_TARGET, 80),
    maxConsecutiveFailures: parsePositiveInteger(process.env.QUALITY_TREND_MAX_CONSECUTIVE_FAILURES, 3),
    maxScoreDropPoints: parsePositiveInteger(process.env.QUALITY_TREND_MAX_SCORE_DROP_POINTS, 20),
    minPassRatePercent: parsePositiveInteger(process.env.QUALITY_TREND_MIN_PASS_RATE_PERCENT, 70),
    shortWindow: 7,
    longWindow: 30,
    requireStableState: parseBoolean(process.env.QUALITY_TREND_REQUIRE_STABLE_STATE, false),
    skipHistorical: false,
    runTrendLog: true,
    hardBlock: false,
    maxSummaryReasons: 8,
    enforceGuardrails: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      values.outputJson = true;
      continue;
    }
    if (arg === "--result-json") {
      values.resultJsonPath = args[index + 1] ?? values.resultJsonPath;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      values.showHelp = true;
      continue;
    }
    if (arg === "--require-score") {
      values.qualityThreshold = parsePositiveInteger(args[index + 1], values.qualityThreshold);
      index += 1;
      continue;
    }
    if (arg.startsWith("--require-score=")) {
      values.qualityThreshold = parsePositiveInteger(arg.slice("--require-score=".length), values.qualityThreshold);
      continue;
    }
    if (arg === "--trend-health") {
      values.requireTrendHealth = parseBoolean(args[index + 1], values.requireTrendHealth);
      index += 1;
      continue;
    }
    if (arg === "--no-trend-health") {
      values.requireTrendHealth = false;
      continue;
    }
    if (arg === "--trend") {
      values.trendPath = args[index + 1] ?? values.trendPath;
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      values.trendSummaryPath = args[index + 1] ?? values.trendSummaryPath;
      index += 1;
      continue;
    }
    if (arg === "--guardrail") {
      values.trendGuardrailPath = args[index + 1] ?? values.trendGuardrailPath;
      index += 1;
      continue;
    }
    if (arg === "--check") {
      values.trendCheckPath = args[index + 1] ?? values.trendCheckPath;
      index += 1;
      continue;
    }
    if (arg === "--language-policy-check") {
      values.languagePolicyCheckPath = args[index + 1] ?? values.languagePolicyCheckPath;
      index += 1;
      continue;
    }
    if (arg === "--language-policy-expiry") {
      values.languagePolicyExpiryPath = args[index + 1] ?? values.languagePolicyExpiryPath;
      index += 1;
      continue;
    }
    if (arg === "--language-policy-score-target") {
      values.languagePolicyScoreTarget = parsePositiveInteger(args[index + 1], values.languagePolicyScoreTarget);
      index += 1;
      continue;
    }
    if (arg === "--recommendations") {
      values.trendRecommendationsPath = args[index + 1] ?? values.trendRecommendationsPath;
      index += 1;
      continue;
    }
    if (arg === "--incident-bundle") {
      values.trendIncidentBundlePath = args[index + 1] ?? values.trendIncidentBundlePath;
      index += 1;
      continue;
    }
    if (arg === "--incident-bundle-json") {
      values.trendIncidentBundleJsonPath = args[index + 1] ?? values.trendIncidentBundleJsonPath;
      index += 1;
      continue;
    }
    if (arg === "--digest-output") {
      values.trendDigestPath = args[index + 1] ?? values.trendDigestPath;
      index += 1;
      continue;
    }
    if (arg === "--digest-json") {
      values.trendDigestJsonPath = args[index + 1] ?? values.trendDigestJsonPath;
      index += 1;
      continue;
    }
    if (arg === "--quality") {
      values.qualityScorecardPath = args[index + 1] ?? values.qualityScorecardPath;
      index += 1;
      continue;
    }
    if (arg === "--drill") {
      values.drillPath = args[index + 1] ?? values.drillPath;
      index += 1;
      continue;
    }
    if (arg === "--verification") {
      values.qualityVerificationPath = args[index + 1] ?? values.qualityVerificationPath;
      index += 1;
      continue;
    }
    if (arg === "--short-window") {
      values.shortWindow = parsePositiveInteger(args[index + 1], values.shortWindow);
      index += 1;
      continue;
    }
    if (arg === "--long-window") {
      values.longWindow = parsePositiveInteger(args[index + 1], values.longWindow);
      index += 1;
      continue;
    }
    if (arg === "--max-consecutive-failures") {
      values.maxConsecutiveFailures = parsePositiveInteger(
        args[index + 1],
        values.maxConsecutiveFailures,
      );
      index += 1;
      continue;
    }
    if (arg === "--max-score-drop-points") {
      values.maxScoreDropPoints = parsePositiveInteger(
        args[index + 1],
        values.maxScoreDropPoints,
      );
      index += 1;
      continue;
    }
    if (arg === "--min-pass-rate-percent") {
      values.minPassRatePercent = parsePositiveInteger(
        args[index + 1],
        values.minPassRatePercent,
      );
      index += 1;
      continue;
    }
    if (arg === "--require-stable-state") {
      values.requireStableState = true;
      continue;
    }
    if (arg === "--skip-historical") {
      values.skipHistorical = true;
      continue;
    }
    if (arg === "--hard-block") {
      values.hardBlock = true;
      continue;
    }
    if (arg === "--allow-warnings") {
      values.allowWarnings = true;
      continue;
    }
    if (arg === "--max-summary-reasons") {
      values.maxSummaryReasons = parsePositiveInteger(
        args[index + 1],
        values.maxSummaryReasons,
      );
      index += 1;
      continue;
    }
    if (arg === "--enforce-guardrails") {
      values.enforceGuardrails = true;
      continue;
    }
    if (arg === "--no-trend-log") {
      values.runTrendLog = false;
      continue;
    }
    if (arg === "--with-trend-log") {
      values.runTrendLog = true;
      continue;
    }
    if (arg.startsWith("--")) {
      values.unknownArgs.push(arg);
      continue;
    }
  }
  return values;
}

function printUsage() {
  const lines = [
    "Usage:",
    "  pnpm quality:trend-health-smoke -- [options]",
    "",
    "Options:",
    "  --require-score <N>        Quality score threshold for quality:ci:trend-health",
    "  --result-json <path>       Write a clean machine-readable smoke result",
    "  --trend-health <boolean>   Enable trend health mode (default true)",
    "  --no-trend-health          Disable trend health mode; use quality:ci fallback for compatibility",
    "  --trend <path>             Trend history input path (default .tmp/quality-trend.json)",
    "  --summary <path>           Trend summary output path (default .tmp/quality-trend-summary.md)",
    "  --guardrail <path>         Guardrail output path (default .tmp/quality-trend-guardrail.json)",
    "  --check <path>             Trend-check output JSON path (default .tmp/quality-trend-check.json)",
    "  --language-policy-check <path> Language policy check artifact path (default .tmp/language-policy-check.json)",
    "  --language-policy-expiry <path> Language policy expiry artifact path (default .tmp/language-policy-expiry.json)",
    "  --language-policy-score-target <N> Minimum language policy fitness score threshold (default 80)",
    "  --recommendations <path>    Failure remediation output path (default .tmp/quality-trend-recommendations.md)",
    "  --incident-bundle <path>    Failure bundle markdown path (default .tmp/quality-trend-incident-bundle.md)",
    "  --incident-bundle-json <path> Failure bundle JSON path (default .tmp/quality-trend-incident-bundle.json)",
    "  --quality <path>           Input quality-scorecard path (default .tmp/quality-scorecard.json)",
    "  --drill <path>             Input drill path (default .tmp/circuit-recovery-drill-dry-run.json)",
    "  --verification <path>       Output verification path (default .tmp/quality-ci-verification.json)",
    "  --digest-output <path>      Trend digest output path (default .tmp/quality-trend-digest.md)",
    "  --digest-json <path>        Trend digest JSON output path (default .tmp/quality-trend-digest.json)",
    "  --short-window <N>         Digest short window (default 7)",
    "  --long-window <N>          Digest long window (default 30)",
    "  --max-consecutive-failures <N>",
    "                             Guardrail consecutive failure threshold (default 3)",
    "  --max-score-drop-points <N> Guardrail score-drop threshold (default 20)",
    "  --min-pass-rate-percent <N> Guardrail pass-rate threshold (default 70)",
    "  --require-stable-state      Force trend artifacts to require stability",
    "  --skip-historical           Skip pre-run historical baseline check",
    "  --no-trend-log              Skip quality:trend-log append step",
    "  --hard-block                Pass hard-block flag to quality:trend-check",
    "  --allow-warnings            Downgrade warnings in quality:trend-check",
    "  --max-summary-reasons <N>   Max reasons output in trend-check",
    "  --enforce-guardrails        Force trend summary guardrail enforcement",
    "  --json                      Print JSON summary for each script output",
    "  --help, -h                 Show this help and exit",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function parseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    for (let start = 0; start < raw.length; start += 1) {
      const opening = raw[start];
      if (opening !== "{" && opening !== "[") continue;
      const closing = opening === "{" ? "}" : "]";
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let end = start; end < raw.length; end += 1) {
        const character = raw[end];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (character === "\\") {
            escaped = true;
          } else if (character === '"') {
            inString = false;
          }
          continue;
        }
        if (character === '"') {
          inString = true;
          continue;
        }
        if (character === opening) depth += 1;
        if (character === closing) depth -= 1;
        if (depth !== 0) continue;
        try {
          return JSON.parse(raw.slice(start, end + 1));
        } catch {
          break;
        }
      }
    }
    return null;
  }
}

function readTextArtifact(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }
  try {
    return readFileSync(absolutePath, "utf8");
  } catch (error) {
    return null;
  }
}

function runCommand(script, args, timeoutMs = 180000) {
  const packageManagerEntrypoint = process.env.npm_execpath;
  const command = ["--silent", script, "--", ...args];
  const executable = packageManagerEntrypoint ? process.execPath : pnpmCommand;
  const spawnArgs = packageManagerEntrypoint
    ? [packageManagerEntrypoint, ...command]
    : command;
  const result = spawnSync(executable, spawnArgs, {
    cwd: repoRoot,
    windowsHide: true,
    encoding: "utf8",
    env: { ...process.env },
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout ?? ""}`.trim();
  const errors = `${result.stderr ?? ""}`.trim();
  const combined = [output, errors].filter(Boolean).join("\n").trim();
  const status = result.status ?? null;
  const ok = status === 0;

  if (combined) {
    console.log(`\n${script} output:\n${combined}`);
  }

  if (result.error) {
    return {
      script,
      args,
      ok: false,
      status: null,
      output: `failed to spawn ${executable}: ${result.error.message}`,
      parsedOutput: null,
    };
  }

  return {
    script,
    args,
    ok,
    status,
    output: combined,
    parsedOutput: parseJson(output),
  };
}

function logArtifacts(files) {
  if (!files.length) return;
  console.log("\nArtifacts:");
  for (const file of files) {
    console.log(`- ${file}`);
  }
}

function writeTextFile(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function buildTrendSummaryArgs(options) {
  const args = [
    "--trend",
    options.trendPath,
    "--output",
    options.trendSummaryPath,
    "--guard-output",
    options.trendGuardrailPath,
    "--max-consecutive-failures",
    String(options.maxConsecutiveFailures),
    "--max-score-drop-points",
    String(options.maxScoreDropPoints),
    "--min-pass-rate-percent",
    String(options.minPassRatePercent),
    "--json",
  ];
  if (options.requireStableState) {
    args.push("--require-stable-state");
  }
  if (options.enforceGuardrails) {
    args.push("--enforce-guardrails");
  }
  return args;
}

function buildTrendDigestArgs(options) {
  const args = [
    "--trend",
    options.trendPath,
    "--output",
    options.trendDigestPath,
    "--json-output",
    options.trendDigestJsonPath,
    "--short-window",
    String(options.shortWindow),
    "--long-window",
    String(options.longWindow),
    "--max-consecutive-failures",
    String(options.maxConsecutiveFailures),
    "--max-score-drop-points",
    String(options.maxScoreDropPoints),
    "--min-pass-rate-percent",
    String(options.minPassRatePercent),
    "--json",
  ];
  if (options.requireStableState) {
    args.push("--require-stable-state");
  }
  return args;
}

function buildTrendCheckArgs(options) {
  const args = [
    "--digest",
    options.trendDigestJsonPath,
    "--guardrail",
    options.trendGuardrailPath,
    "--summary",
    options.trendSummaryPath,
    "--language-policy-check",
    options.languagePolicyCheckPath,
    "--language-policy-expiry",
    options.languagePolicyExpiryPath,
    "--max-summary-reasons",
    String(options.maxSummaryReasons),
    "--json",
  ];
  if (options.allowWarnings) {
    args.push("--allow-warnings");
  }
  if (options.hardBlock) {
    args.push("--hard-block");
  }
  args.push(
    "--language-policy-score-target",
    String(options.languagePolicyScoreTarget ?? 80),
  );
  return args;
}

function collectFailedSteps(steps) {
  const failed = [];
  for (const step of steps) {
    if (!step.ok) {
      failed.push(step);
      continue;
    }
    if (step.checkResult && step.checkResult.blocked) {
      failed.push(step);
    }
  }
  return failed;
}

function collectStepIssues(step) {
  const issues = [];
  if (!step || !step.checkResult) return issues;

  if (step.label === "quality-ci" && Array.isArray(step.checkResult.issues)) {
    for (const issue of step.checkResult.issues) {
      issues.push(typeof issue === "string" ? issue : JSON.stringify(issue));
    }
    return issues;
  }
  if (step.label === "artifacts-verify" && Array.isArray(step.checkResult.issues)) {
    for (const issue of step.checkResult.issues) {
      issues.push(typeof issue === "string" ? issue : JSON.stringify(issue));
    }
    return issues;
  }
  if (typeof step.checkResult.status === "boolean") {
    issues.push(`step ${step.label} status=${step.checkResult.status}`);
  }
  return issues;
}

function buildLanguagePolicyReview(languagePolicyCheck, languagePolicyExpiry, languagePolicyFitness = null) {
  const issues = [];
  const actionItems = [];
  const safeFitness = languagePolicyFitness && typeof languagePolicyFitness === "object"
    ? languagePolicyFitness
    : null;
  const summary = {
    checkPresent: Boolean(languagePolicyCheck),
    expiryPresent: Boolean(languagePolicyExpiry),
    preferredLanguage: "TypeScript (for apps/packages runtime surfaces)",
    allowed: 0,
    violations: 0,
    expiredExceptions: 0,
    nearExpiryExceptions: 0,
    allowlistWarnings: 0,
    allowlistIssues: 0,
  };

  if (!languagePolicyCheck) {
    issues.push("Missing language-policy-check artifact at runtime; cannot evaluate preferred-language enforcement.");
    actionItems.push("Generate language-policy-check output before finalizing merge quality review.");
  } else {
    summary.allowed = Array.isArray(languagePolicyCheck.allowed) ? languagePolicyCheck.allowed.length : 0;
    summary.violations = Array.isArray(languagePolicyCheck.violations)
      ? languagePolicyCheck.violations.length
      : 0;
    summary.allowlistWarnings = Array.isArray(languagePolicyCheck.allowlistWarnings)
      ? languagePolicyCheck.allowlistWarnings.length
      : 0;
    summary.allowlistIssues = Array.isArray(languagePolicyCheck.allowlistIssues)
      ? languagePolicyCheck.allowlistIssues.length
      : 0;
    if (Array.isArray(languagePolicyCheck.violations) && languagePolicyCheck.violations.length > 0) {
      for (const violation of languagePolicyCheck.violations.slice(0, 20)) {
        const file = violation?.file ?? "unknown";
        const boundary = violation?.boundary ?? "unknown";
        const extension = violation?.extension ?? "unknown";
        const reason = violation?.reason ?? "policy mismatch";
        const recommendation = violation?.recommendation?.migrationHint
          || "convert file to TypeScript where feasible";
        issues.push(`${boundary}: ${file} uses ${extension}; ${reason}`);
        actionItems.push(
          `${file}: adopt ${recommendation} (default for boundary=${boundary}: ${summary.preferredLanguage})`,
        );
      }
    }

    for (const warning of Array.isArray(languagePolicyCheck.allowlistWarnings) ? languagePolicyCheck.allowlistWarnings : []) {
      issues.push(`language policy warning: ${warning}`);
      actionItems.push(`Fix allowlist warning: ${warning}`);
    }

    for (const issue of Array.isArray(languagePolicyCheck.allowlistIssues) ? languagePolicyCheck.allowlistIssues : []) {
      issues.push(`language policy check issue: ${issue}`);
      actionItems.push(`Remedy allowlist issue: ${issue}`);
    }
  }

  if (!languagePolicyExpiry) {
    issues.push("Missing language-policy-expiry artifact at runtime; cannot enforce migration timelines.");
    actionItems.push("Run language-policy-expiry before final language-policy sign-off.");
  } else {
    summary.expiredExceptions = Array.isArray(languagePolicyExpiry.expired)
      ? languagePolicyExpiry.expired.length
      : 0;
    summary.nearExpiryExceptions = Array.isArray(languagePolicyExpiry.nearExpiry)
      ? languagePolicyExpiry.nearExpiry.length
      : 0;

    if (Array.isArray(languagePolicyExpiry.expired) && languagePolicyExpiry.expired.length > 0) {
      for (const exception of languagePolicyExpiry.expired.slice(0, 20)) {
        const file = `${exception.type ?? "unknown"}:${exception.value ?? "unknown"}`;
        const removalBy = exception?.removalBy ?? "unknown";
        const owner = exception?.owner ?? "unknown";
        const migrationPlan = exception?.migrationPlan ?? "unknown";
        issues.push(`expired language exception: ${file} (owner=${owner}, removalBy=${removalBy})`);
        actionItems.push(
          `${file}: execute migrationPlan="${migrationPlan}" and close exception before removal date ${removalBy}.`,
        );
      }
    }

    for (const exception of Array.isArray(languagePolicyExpiry.nearExpiry) ? languagePolicyExpiry.nearExpiry.slice(0, 8) : []) {
      const file = `${exception.type ?? "unknown"}:${exception.value ?? "unknown"}`;
      const daysUntilRemoval = exception?.daysUntilRemoval ?? "unknown";
      issues.push(`language exception near expiry: ${file} (daysUntilRemoval=${daysUntilRemoval})`);
      actionItems.push(`Track ${file}: daysUntilRemoval=${daysUntilRemoval}; confirm migration/closure owner is set.`);
    }
  }

  const hasIssues = issues.length > 0;

  return {
    summary,
    reviewStatus: hasIssues || !languagePolicyCheck
      || !languagePolicyExpiry
      || languagePolicyCheck.ok === false
      || (Array.isArray(languagePolicyExpiry?.expired) && languagePolicyExpiry.expired.length > 0)
      ? "language-policy-issues"
      : "language-policy-ok",
    fitness: {
      score: safeFitness?.score ?? null,
      target: safeFitness?.target ?? 80,
      riskLevel: safeFitness?.riskLevel ?? "unknown",
      blocked: safeFitness?.blocked ?? false,
      counts: safeFitness?.counts ?? {},
      reasons: Array.isArray(safeFitness?.reasons) ? safeFitness.reasons : [],
      preferredLanguage: safeFitness?.preferredLanguage ?? summary.preferredLanguage,
    },
    issues,
    actionItems: [...new Set(actionItems)],
  };
}

function readMaybeJson(relativePath) {
  const raw = readTextArtifact(relativePath);
  if (raw === null) return null;
  return parseJson(raw);
}

function artifactDescriptor(path, parsedArtifact) {
  const raw = readTextArtifact(path);
  const size = raw === null ? 0 : raw.length;
  const marker = parsedArtifact === null ? "text" : "json";
  return {
    path,
    exists: raw !== null,
    size: size,
    type: raw === null ? "missing" : marker,
    missing: raw === null,
    parsed: parsedArtifact !== null,
  };
}

function buildIncidentBundle(options, steps, reason, detail) {
  const finalTrendCheck = steps.find((step) => step.label === "post-run")
    || steps.find((step) => step.label === "trend-check")
    || null;
  const finalCheck = finalTrendCheck?.checkResult || {};
  const recommendationText = readTextArtifact(options.trendRecommendationsPath) || "";

  const failedSteps = collectFailedSteps(steps);
  const failedStepSummary = failedSteps.map((step) => {
    const commandEntries = Array.isArray(step.steps) ? step.steps : [];
    const command = commandEntries[0]?.command ?? step.label;
    const status = commandEntries[0]?.status ?? "unknown";
    return `${command} status=${status}`;
  });

  const issueLines = [];
  for (const step of steps) {
    for (const issue of collectStepIssues(step)) {
      issueLines.push(issue);
    }
  }
  const languagePolicyCheck = readMaybeJson(options.languagePolicyCheckPath);
  const languagePolicyExpiry = readMaybeJson(options.languagePolicyExpiryPath);
  const languagePolicyFitness = finalCheck?.metrics?.languagePolicy ?? null;
  const languagePolicyReviewWithFitness = buildLanguagePolicyReview(
    languagePolicyCheck,
    languagePolicyExpiry,
    languagePolicyFitness,
  );
  const policySummaryFitness = languagePolicyReviewWithFitness.fitness || {};

  const policyIssues = Array.isArray(languagePolicyReviewWithFitness?.issues)
    ? languagePolicyReviewWithFitness.issues
    : [];
  const policyActions = Array.isArray(languagePolicyReviewWithFitness?.actionItems)
    ? languagePolicyReviewWithFitness.actionItems
    : [];
  const allIssues = [...issueLines, ...policyIssues];

  const trendSummary = {
    status: finalCheck.status ?? "unknown",
    severity: finalCheck.severity ?? "unknown",
    blocked: Boolean(finalCheck.blocked),
    reasons: Array.isArray(finalCheck.reasons) ? finalCheck.reasons : [],
    recommendation: finalCheck.recommendation ?? "No recommendation available",
  };

  const qualityScorecard = readMaybeJson(options.qualityScorecardPath);
  const trendDigest = readMaybeJson(options.trendDigestJsonPath);
  const trendGuardrail = readMaybeJson(options.trendGuardrailPath);
  const trendCheckArtifact = readMaybeJson(options.trendCheckPath);
  const verification = readMaybeJson(options.qualityVerificationPath);
  const trendLog = readMaybeJson(options.trendPath);
  const drill = readMaybeJson(options.drillPath);
  const scorecardTrendConsistency = qualityScorecard?.trendConsistency;
  const verificationTrendConsistency = verification?.trendConsistency;
  const trendConsistency = scorecardTrendConsistency || verificationTrendConsistency
    ? {
      ...(scorecardTrendConsistency ?? {}),
      ...(verificationTrendConsistency ?? {}),
      status: scorecardTrendConsistency?.status ?? verificationTrendConsistency?.status ?? "missing",
      ok: scorecardTrendConsistency?.ok ?? verificationTrendConsistency?.ok ?? false,
      checks: verificationTrendConsistency?.checks ?? scorecardTrendConsistency?.checks ?? {},
      checksRequired: verificationTrendConsistency?.checksRequired
        ?? scorecardTrendConsistency?.checksRequired
        ?? [],
      hasMissingRequired: scorecardTrendConsistency?.hasMissingRequired
        ?? verificationTrendConsistency?.hasMissingRequired
        ?? true,
      hasNotCollected: scorecardTrendConsistency?.hasNotCollected
        ?? verificationTrendConsistency?.hasNotCollected
        ?? false,
      requiresTrendHealth: options.requireTrendHealth,
    }
    : null;
  const bundleJson = {
    schemaVersion: 1,
    executedAtUtc: new Date().toISOString(),
    failureReason: reason,
    failureDetail: detail,
    qualityThreshold: options.qualityThreshold,
    thresholds: {
      maxConsecutiveFailures: options.maxConsecutiveFailures,
      maxScoreDropPoints: options.maxScoreDropPoints,
      minPassRatePercent: options.minPassRatePercent,
      shortWindow: options.shortWindow,
      longWindow: options.longWindow,
      requireStableState: options.requireStableState,
    },
    trendHealth: trendSummary,
    trendConsistency,
    languagePolicyReview: languagePolicyReviewWithFitness,
    failedSteps: failedStepSummary,
    extractedIssues: allIssues.slice(0, 30),
    artifacts: [
      artifactDescriptor(options.qualityScorecardPath, qualityScorecard),
      artifactDescriptor(options.drillPath, drill),
      artifactDescriptor(options.qualityVerificationPath, verification),
      artifactDescriptor(options.languagePolicyCheckPath, languagePolicyCheck),
      artifactDescriptor(options.languagePolicyExpiryPath, languagePolicyExpiry),
      artifactDescriptor(options.trendPath, trendLog),
      artifactDescriptor(options.trendSummaryPath, null),
      artifactDescriptor(options.trendGuardrailPath, trendGuardrail),
      artifactDescriptor(options.trendDigestPath, readMaybeJson(options.trendDigestPath)),
      artifactDescriptor(options.trendDigestJsonPath, trendDigest),
      artifactDescriptor(options.trendCheckPath, trendCheckArtifact),
      artifactDescriptor(options.trendRecommendationsPath, null),
      artifactDescriptor(options.trendIncidentBundlePath, null),
      artifactDescriptor(options.trendIncidentBundleJsonPath, null),
    ],
    recommendationText: recommendationText
      .split("\n")
      .filter(Boolean)
      .slice(0, 36),
  };

  writeTextFile(
    options.trendIncidentBundleJsonPath,
    `${JSON.stringify(bundleJson, null, 2)}\n`,
  );

  const lines = [
    "# Quality Trend Incident Bundle",
    "",
    `- Timestamp: ${bundleJson.executedAtUtc}`,
    `- Failure phase: ${bundleJson.failureReason}`,
    `- Trigger threshold: ${bundleJson.qualityThreshold}`,
    `- Final trend status: ${bundleJson.trendHealth.status}`,
    `- Final trend severity: ${bundleJson.trendHealth.severity}`,
    `- Blocked: ${bundleJson.trendHealth.blocked}`,
    `- Final trend consistency status: ${bundleJson.trendConsistency?.status ?? "missing"}`,
    `- Final trend consistency checks required: ${(bundleJson.trendConsistency?.checksRequired ?? []).join(", ") || "not recorded"}`,
    `- Language policy fitness score: ${policySummaryFitness?.score === null ? "n/a" : `${policySummaryFitness.score}/100`}`,
    `- Language policy fitness target: ${policySummaryFitness?.target ?? 80}`,
    `- Language policy fitness risk: ${policySummaryFitness?.riskLevel ?? "unknown"}`,
    `- Language policy fitness blocked: ${Boolean(policySummaryFitness?.blocked)}`,
    `- Final trend consistency hasMissingRequired: ${Boolean(bundleJson.trendConsistency?.hasMissingRequired)}`,
    `- Final trend consistency hasNotCollected: ${Boolean(bundleJson.trendConsistency?.hasNotCollected)}`,
    `- Final trend consistency requiresTrendHealth: ${Boolean(bundleJson.trendConsistency?.requiresTrendHealth)}`,
    "",
    "## Trend consistency checks",
    ...(Array.isArray(bundleJson.trendConsistency?.checksRequired)
      ? bundleJson.trendConsistency.checksRequired.map((checkKey) => {
        const check = bundleJson.trendConsistency?.checks?.[checkKey] ?? {};
        const status = check?.status ?? "missing";
        const statusText = String(status).toLowerCase();
        const checkResult = check?.ok === false || statusText === "missing"
          ? "fail"
          : statusText === "not_collected"
            ? "warn"
            : "pass";
        return `- ${checkKey}: ${checkResult} (${status})`;
      })
      : ["- no trend consistency checks recorded"]),
    "",
    "## Failed steps",
    ...(failedStepSummary.length > 0 ? failedStepSummary.map((entry) => `- ${entry}`) : ["- no failed steps recorded"]),
    "",
    "## Extracted issues",
    ...(issueLines.length > 0 ? issueLines.slice(0, 30).map((issue) => `- ${issue}`) : ["- no issues extracted"]),
    "",
    "## Trend reasons",
    ...(Array.isArray(finalCheck.reasons) && finalCheck.reasons.length > 0
      ? finalCheck.reasons.slice(0, 20).map((trendReason) => `- ${trendReason}`)
      : ["- no trend reasons recorded"]),
    "",
    "## Language policy review",
    `- Review status: ${languagePolicyReviewWithFitness?.reviewStatus ?? "unknown"}`,
    `- Preferred language context: ${languagePolicyReviewWithFitness?.summary?.preferredLanguage ?? "TypeScript for apps/packages"}`,
    `- Language policy check artifact: ${languagePolicyReviewWithFitness?.summary?.checkPresent ? "present" : "missing"}`,
    `- Language policy expiry artifact: ${languagePolicyReviewWithFitness?.summary?.expiryPresent ? "present" : "missing"}`,
    `- Check allowed entries: ${languagePolicyReviewWithFitness?.summary?.allowed ?? 0}`,
    `- Active violations: ${languagePolicyReviewWithFitness?.summary?.violations ?? 0}`,
    `- Expired exceptions: ${languagePolicyReviewWithFitness?.summary?.expiredExceptions ?? 0}`,
    `- Near-expiry exceptions: ${languagePolicyReviewWithFitness?.summary?.nearExpiryExceptions ?? 0}`,
    `- Allowlist warnings: ${languagePolicyReviewWithFitness?.summary?.allowlistWarnings ?? 0}`,
    `- Allowlist issues: ${languagePolicyReviewWithFitness?.summary?.allowlistIssues ?? 0}`,
    "",
    "## Language policy issues",
    ...(policyIssues.length > 0 ? policyIssues.slice(0, 20).map((entry) => `- ${entry}`) : ["- no policy issues extracted"]),
    "",
    "## Language policy recommended actions",
    ...(policyActions.length > 0 ? policyActions.slice(0, 20).map((entry) => `- ${entry}`) : ["- no immediate policy actions"]),
    "",
    "## Artifacts",
    ...bundleJson.artifacts.map((artifact) => `- ${artifact.path} (${artifact.exists ? `${artifact.type} / ${artifact.size} chars` : "missing"})`),
    "",
    "## Remediation file",
    ...(recommendationText
      ? recommendationText
        .split("\n")
        .filter((entry) => entry.trim().length > 0)
        .slice(0, 140)
        .map((entry) => (entry.trim().length > 0 ? `- ${entry}` : ""))
      : ["- no remediation file available"]),
    "",
  ];

  writeTextFile(
    options.trendIncidentBundlePath,
    `${lines.join("\n")}\n`,
  );
}

function buildFailureRecommendations(options, steps, reason, detail) {
  const finalTrendCheck = steps.find((step) => step.label === "post-run")
    || steps.find((step) => step.label === "trend-check")
    || null;
  const finalCheck = finalTrendCheck?.checkResult || {};
  const languagePolicyCheck = readMaybeJson(options.languagePolicyCheckPath);
  const languagePolicyExpiry = readMaybeJson(options.languagePolicyExpiryPath);
  const languagePolicyFitness = finalCheck?.metrics?.languagePolicy || null;
  const languagePolicyReview = buildLanguagePolicyReview(languagePolicyCheck, languagePolicyExpiry, languagePolicyFitness);
  const policyIssues = Array.isArray(languagePolicyReview?.issues)
    ? languagePolicyReview.issues
    : [];
  const policyActions = Array.isArray(languagePolicyReview?.actionItems)
    ? languagePolicyReview.actionItems
    : [];
  const lines = [];

  lines.push("# Quality Trend Failure Remediation");
  lines.push("");
  lines.push(`- Failed phase: ${reason}`);
  if (detail) {
    lines.push(`- Detail: ${detail}`);
  }
  lines.push(`- Timestamp: ${new Date().toISOString()}`);
  lines.push("");

  const failedSteps = collectFailedSteps(steps);
  if (failedSteps.length > 0) {
    lines.push("## Failed step list");
    for (const step of failedSteps) {
      const commandEntries = Array.isArray(step.steps) ? step.steps : [];
      const command = commandEntries[0]?.command ?? step.label;
      const status = commandEntries[0]?.status ?? "unknown";
      lines.push(`- ${command} (status ${status})`);
    }
    lines.push("");
  }

  const issueLines = [];
  for (const step of steps) {
    for (const issue of collectStepIssues(step)) {
      issueLines.push(issue);
    }
  }
  if (issueLines.length > 0) {
    lines.push("## Extracted issues");
    for (const issue of issueLines.slice(0, 16)) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }

  if (policyIssues.length > 0) {
    lines.push("## Language policy issues");
    for (const policyIssue of policyIssues.slice(0, 20)) {
      lines.push(`- ${policyIssue}`);
    }
    lines.push("");
  }

  if (Array.isArray(finalCheck.reasons) && finalCheck.reasons.length > 0) {
    lines.push("## Trend check reasons");
    for (const trendReason of finalCheck.reasons.slice(0, 16)) {
      lines.push(`- ${trendReason}`);
    }
    lines.push("");
  }

  if (typeof finalCheck.recommendation === "string" && finalCheck.recommendation.length > 0) {
    lines.push("## Trend check recommendation");
    lines.push(`- ${finalCheck.recommendation}`);
    lines.push("");
  }

  lines.push("## Language selection actions");
  lines.push(`- Language-policy review status: ${languagePolicyReview?.reviewStatus ?? "unknown"}`);
  lines.push(`- Language selection context: ${languagePolicyReview?.summary?.preferredLanguage ?? "TypeScript for apps/packages"}`);
  lines.push(`- Language policy fitness score: ${languagePolicyReview?.fitness?.score ?? "n/a"}`);
  lines.push(`- Language policy fitness risk: ${languagePolicyReview?.fitness?.riskLevel ?? "unknown"}`);
  lines.push(`- Language policy fitness target: ${languagePolicyReview?.fitness?.target ?? 80}`);
  for (const action of policyActions.slice(0, 20)) {
    lines.push(`- ${action}`);
  }
  if (policyActions.length === 0) {
    lines.push("- no specific language migration actions are currently required");
  }
  lines.push("");

  lines.push("## Immediate remediation actions");
  lines.push("- Re-run the smoke locally with exact inputs: `pnpm quality:trend-health-smoke -- --json --require-score " + `${options.qualityThreshold}` + "`");
  lines.push("- Collect a full evidence bundle by keeping all `.tmp/*trend*` outputs and `quality-ci-verification.json`.");
  lines.push("- Inspect the latest trend artifacts:");
  lines.push("  - `.tmp/quality-trend-summary.md`");
  lines.push("  - `.tmp/quality-trend-guardrail.json`");
  lines.push("  - `.tmp/quality-trend-digest.md`");
  lines.push("  - `.tmp/quality-trend-digest.json`");
  lines.push("  - `.tmp/quality-trend-check.json`");
  lines.push("  - `.tmp/language-policy-check.json`");
  lines.push("  - `.tmp/language-policy-expiry.json`");
  lines.push("");
  lines.push("## Focused commands");
  lines.push("- `pnpm quality:trend-summary -- --json --trend .tmp/quality-trend.json --output .tmp/quality-trend-summary.md --guard-output .tmp/quality-trend-guardrail.json --max-consecutive-failures ... --max-score-drop-points ... --min-pass-rate-percent ...`");
  lines.push("- `pnpm quality:trend-digest -- --json --trend .tmp/quality-trend.json --output .tmp/quality-trend-digest.md --json-output .tmp/quality-trend-digest.json --short-window 7 --long-window 30`");
  lines.push("- `pnpm quality:trend-check -- --json --digest .tmp/quality-trend-digest.json --guardrail .tmp/quality-trend-guardrail.json --summary .tmp/quality-trend-summary.md --language-policy-score-target 80 --max-summary-reasons 8`");
  lines.push("- `pnpm check:language-policy -- --json --head HEAD~1`");
  lines.push("- `pnpm report:language-policy-expiry -- --json`");
  lines.push("");
  lines.push("## Closure checks");
  lines.push("- Verify `pnpm quality:ci:trend-health -- --json --require-score " + `${options.qualityThreshold}` + "` passes.");
  lines.push("- Verify `pnpm quality:verify-artifacts:trend-health -- --json --quality .tmp/quality-scorecard.json --drill .tmp/circuit-recovery-drill-dry-run.json --require-score " + `${options.qualityThreshold}` + "` passes.");
  lines.push("- Re-run CI and confirm trend summary/check artifacts are stable in workflow summary.");

  writeTextFile(options.trendRecommendationsPath, `${lines.join("\n")}\n`);
}

function emitFailureBundle(options, steps, reason, detail) {
  buildFailureRecommendations(options, steps, reason, detail);
  buildIncidentBundle(options, steps, reason, detail);
}

function runTrendEvaluation(label, options, includeCheckOutput = false) {
  const executionLog = [];

  const summary = runCommand("quality:trend-summary", buildTrendSummaryArgs(options));
  executionLog.push({
    command: "quality:trend-summary",
    ok: summary.ok,
    status: summary.status,
    output: summary.output,
  });

  const digest = runCommand("quality:trend-digest", buildTrendDigestArgs(options), 240000);
  executionLog.push({
    command: "quality:trend-digest",
    ok: digest.ok,
    status: digest.status,
    output: digest.output,
  });

  const check = runCommand("quality:trend-check", buildTrendCheckArgs(options), 120000);
  executionLog.push({
    command: "quality:trend-check",
    ok: check.ok,
    status: check.status,
    output: check.output,
    parsedOutput: parseJson(check.output),
  });

  const checkPayload = check.parsedOutput ?? parseJson(check.output);
  if (includeCheckOutput && options.trendCheckPath) {
    if (checkPayload !== null) {
      writeTextFile(
        options.trendCheckPath,
        `${JSON.stringify(checkPayload, null, 2)}\n`,
      );
    } else if (check.output) {
      writeTextFile(options.trendCheckPath, `${check.output}\n`);
    }
  }

  return {
    label,
    ok: summary.ok && digest.ok && check.ok,
    steps: executionLog,
    checkResult: check.parsedOutput ?? null,
  };
}

function emitFailureSummary(options, steps, artifacts, reason, detail) {
  const summary = {
    ok: false,
    reason,
    detail,
    executedAtUtc: new Date().toISOString(),
    qualityThreshold: options.qualityThreshold,
    runTrendLog: options.runTrendLog,
    skipHistorical: options.skipHistorical,
    steps,
  };

  if (options.outputJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
  if (options.resultJsonPath) {
    writeTextFile(options.resultJsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  if (
    options.trendRecommendationsPath
    || options.trendIncidentBundlePath
    || options.trendIncidentBundleJsonPath
  ) {
    emitFailureBundle(options, steps, reason, detail);
  }
  if (options.trendRecommendationsPath) {
    console.log(`\nRemediation guidance written to: ${options.trendRecommendationsPath}`);
  }
  if (options.trendIncidentBundlePath) {
    console.log(`\nIncident bundle written to: ${options.trendIncidentBundlePath}`);
  }
  if (options.trendIncidentBundleJsonPath) {
    console.log(`\nIncident bundle JSON written to: ${options.trendIncidentBundleJsonPath}`);
  }
  console.log(`\nQUALITY TREND SMOKE: FAIL (${reason})`);
  if (detail) {
    console.log(detail);
  }
  logArtifacts(Array.from(artifacts).sort());
  process.exitCode = 1;
}

function persistVerificationResult(options, ciResult, verifyResult, requireTrendHealth) {
  const ciPayload = ciResult.parsedOutput ?? parseJson(ciResult.output);
  const verifyPayload = verifyResult.parsedOutput ?? parseJson(verifyResult.output);
  if (ciPayload) {
    const ciTrendConsistency = ciPayload.trendConsistency ?? {};
    const verifyTrendConsistency = verifyPayload?.trendConsistency ?? {};
    const payload = {
      ...ciPayload,
      ok: Boolean(ciPayload.ok) && Boolean(verifyPayload?.ok ?? verifyResult.ok),
      checks: verifyPayload?.checks ?? ciPayload.checks ?? {},
      trendConsistency: {
        ...ciTrendConsistency,
        ...verifyTrendConsistency,
        status: ciTrendConsistency.status ?? verifyTrendConsistency.status ?? "missing",
        ok: ciTrendConsistency.ok ?? verifyTrendConsistency.ok ?? false,
        requiresTrendHealth: requireTrendHealth,
      },
      artifactVerification: verifyPayload ?? {
        ok: verifyResult.ok,
        issues: ["verification output could not be parsed"],
      },
      issues: [
        ...(Array.isArray(ciPayload.issues) ? ciPayload.issues : []),
        ...(Array.isArray(verifyPayload?.issues) ? verifyPayload.issues : []),
      ],
      executedAtUtc: new Date().toISOString(),
    };
    writeTextFile(
      options.qualityVerificationPath,
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    return;
  }

  writeTextFile(
    options.qualityVerificationPath,
    `${JSON.stringify({
      ok: verifyResult.ok,
      executedAtUtc: new Date().toISOString(),
      issues: ["no output from verify command"],
    }, null, 2)}\n`,
  );
}

function runQualityGate(options, requireTrendHealth, label) {
  const ciCommand = requireTrendHealth ? "quality:ci:trend-health" : "quality:ci";
  const ciResult = runCommand(
    ciCommand,
    ["--json", "--require-score", String(options.qualityThreshold)],
    240000,
  );
  const ciStep = {
    label: `${label}-ci`,
    ok: ciResult.ok,
    steps: [
      {
        command: ciCommand,
        ok: ciResult.ok,
        status: ciResult.status,
        output: ciResult.output,
        parsedOutput: parseJson(ciResult.output),
      },
    ],
    checkResult: parseJson(ciResult.output),
  };
  if (!ciResult.ok) {
    return {
      ok: false,
      steps: [ciStep],
      reason: "quality-ci-failed",
      detail: `${ciCommand} failed`,
    };
  }

  const verifyCommand = requireTrendHealth
    ? "quality:verify-artifacts:trend-health"
    : "quality:verify-artifacts";
  const verifyResult = runCommand(
    verifyCommand,
    [
      "--json",
      "--quality",
      options.qualityScorecardPath,
      "--drill",
      options.drillPath,
      "--require-score",
      String(options.qualityThreshold),
    ],
    90000,
  );
  persistVerificationResult(options, ciResult, verifyResult, requireTrendHealth);
  const verifyStep = {
    label: `${label}-artifacts-verify`,
    ok: verifyResult.ok,
    steps: [
      {
        command: verifyCommand,
        ok: verifyResult.ok,
        status: verifyResult.status,
        output: verifyResult.output,
        parsedOutput: parseJson(verifyResult.output),
      },
    ],
    checkResult: parseJson(verifyResult.output),
  };

  return {
    ok: verifyResult.ok,
    steps: [ciStep, verifyStep],
    reason: verifyResult.ok ? null : "verify-artifacts-failed",
    detail: verifyResult.ok ? null : `${verifyCommand} failed`,
  };
}

function main() {
  const options = parseArgs();

  if (options.showHelp) {
    printUsage();
    process.exitCode = 0;
    return;
  }
  if (options.unknownArgs.length > 0) {
    console.log(`\nIgnored unknown arguments: ${options.unknownArgs.join(", ")}`);
  }

  const steps = [];
  const artifacts = new Set([
    options.trendCheckPath,
    options.trendRecommendationsPath,
    options.trendIncidentBundlePath,
    options.trendIncidentBundleJsonPath,
    options.qualityScorecardPath,
    options.drillPath,
    options.qualityVerificationPath,
    options.trendPath,
    options.trendSummaryPath,
    options.trendGuardrailPath,
    options.languagePolicyCheckPath,
    options.languagePolicyExpiryPath,
    options.trendDigestPath,
    options.trendDigestJsonPath,
  ]);

  const hasHistoricalTrend = !options.skipHistorical && existsSync(resolve(repoRoot, options.trendPath));
  const bootstrapTrendHealth = options.requireTrendHealth && !options.skipHistorical && !hasHistoricalTrend;

  if (hasHistoricalTrend) {
    const precheck = runTrendEvaluation("historical-baseline", options, true);
    steps.push(precheck);
    if (!precheck.ok) {
      console.log("\nHistorical trend precheck reported issues (non-blocking).");
    }
  } else {
    console.log(`\nSkipping historical trend precheck: ${options.skipHistorical ? "skip-historical requested" : `${options.trendPath} missing`}`);
  }

  if (bootstrapTrendHealth && !options.runTrendLog) {
    emitFailureSummary(
      options,
      steps,
      artifacts,
      "trend-bootstrap-disabled",
      "Strict trend health requires trend logging when no historical trend artifact exists.",
    );
    return;
  }

  const initialGate = runQualityGate(
    options,
    options.requireTrendHealth && !bootstrapTrendHealth,
    bootstrapTrendHealth ? "bootstrap-quality" : "quality",
  );
  steps.push(...initialGate.steps);
  if (!initialGate.ok) {
    emitFailureSummary(options, steps, artifacts, initialGate.reason, initialGate.detail);
    return;
  }

  if (options.runTrendLog) {
    const logResult = runCommand(
      "quality:trend-log",
      [
        "--quality",
        options.qualityScorecardPath,
        "--verification",
        options.qualityVerificationPath,
        "--drill",
        options.drillPath,
        "--trend",
        options.trendPath,
      ],
      45000,
    );
    steps.push({
      label: "trend-log",
      ok: logResult.ok,
      steps: [
        {
          command: "quality:trend-log",
          ok: logResult.ok,
          status: logResult.status,
          output: logResult.output,
          parsedOutput: parseJson(logResult.output),
        },
      ],
      checkResult: parseJson(logResult.output),
    });
    if (!logResult.ok) {
      emitFailureSummary(
        options,
        steps,
        artifacts,
        "trend-log-failed",
        "quality:trend-log failed",
      );
      return;
    }
  } else {
    console.log("\nSkipping optional trend-log step (--no-trend-log).");
  }

  let postcheck = runTrendEvaluation("post-run", options, true);
  steps.push(postcheck);

  if (bootstrapTrendHealth && postcheck.ok) {
    const strictGate = runQualityGate(options, true, "strict-quality");
    steps.push(...strictGate.steps);
    if (!strictGate.ok) {
      emitFailureSummary(options, steps, artifacts, strictGate.reason, strictGate.detail);
      return;
    }
    postcheck = runTrendEvaluation("post-bootstrap-strict", options, true);
    steps.push(postcheck);
  }

  const finalCheckResult = postcheck.checkResult || {};
  const success = postcheck.ok;
  const summary = {
    ok: success,
    executedAtUtc: new Date().toISOString(),
    qualityThreshold: options.qualityThreshold,
    runTrendLog: options.runTrendLog,
    skipHistorical: options.skipHistorical,
    finalTrendCheck: finalCheckResult,
    steps,
  };

  if (success) {
    buildFailureRecommendations(
      options,
      steps,
      "none",
      "Quality trend smoke completed without blocking findings.",
    );
    buildIncidentBundle(
      options,
      steps,
      "none",
      "Quality trend smoke completed without blocking findings.",
    );
  }

  if (options.outputJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
  if (options.resultJsonPath) {
    writeTextFile(options.resultJsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  }

  if (success) {
    console.log("\nQUALITY TREND SMOKE: PASS");
  } else {
    console.log("\nQUALITY TREND SMOKE: FAIL");
  }
  logArtifacts(Array.from(artifacts).sort());
  if (finalCheckResult?.status) {
    console.log(`\nFinal trend check status: ${finalCheckResult.status}`);
  }
  if (finalCheckResult?.blocked !== undefined) {
    console.log(`Final trend blocked: ${finalCheckResult.blocked}`);
  }
  if (finalCheckResult?.severity) {
    console.log(`Final trend severity: ${finalCheckResult.severity}`);
  }
  const finalLanguagePolicyFitness = finalCheckResult?.metrics?.languagePolicy;
  if (finalLanguagePolicyFitness) {
    console.log(
      `Final language policy fitness: ${finalLanguagePolicyFitness.score ?? "n/a"}/100`
      + ` (risk=${finalLanguagePolicyFitness.riskLevel ?? "unknown"}, target=${finalLanguagePolicyFitness.target ?? 80})`,
    );
  }

  process.exitCode = success ? 0 : 1;
}

main();
