#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
    showHelp: false,
    unknownArgs: [],
    qualityThreshold: parsePositiveInteger(process.env.QUALITY_THRESHOLD, 165),
    trendPath: ".tmp/quality-trend.json",
    trendSummaryPath: ".tmp/quality-trend-summary.md",
    trendGuardrailPath: ".tmp/quality-trend-guardrail.json",
    trendDigestPath: ".tmp/quality-trend-digest.md",
    trendDigestJsonPath: ".tmp/quality-trend-digest.json",
    trendCheckPath: ".tmp/quality-trend-check.json",
    qualityScorecardPath: ".tmp/quality-scorecard.json",
    drillPath: ".tmp/circuit-recovery-drill-dry-run.json",
    qualityVerificationPath: ".tmp/quality-ci-verification.json",
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
    "  --trend <path>             Trend history input path (default .tmp/quality-trend.json)",
    "  --summary <path>           Trend summary output path (default .tmp/quality-trend-summary.md)",
    "  --guardrail <path>         Guardrail output path (default .tmp/quality-trend-guardrail.json)",
    "  --check <path>             Trend-check output JSON path (default .tmp/quality-trend-check.json)",
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
    return null;
  }
}

function runCommand(script, args, timeoutMs = 180000) {
  const command = [script, "--", ...args];
  const result = spawnSync(pnpmCommand, command, {
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
      output: `failed to spawn ${pnpmCommand}: ${result.error.message}`,
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
  return args;
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
  console.log(`\nQUALITY TREND SMOKE: FAIL (${reason})`);
  if (detail) {
    console.log(detail);
  }
  logArtifacts(Array.from(artifacts).sort());
  process.exitCode = 1;
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
    options.qualityScorecardPath,
    options.drillPath,
    options.qualityVerificationPath,
    options.trendPath,
    options.trendSummaryPath,
    options.trendGuardrailPath,
    options.trendDigestPath,
    options.trendDigestJsonPath,
  ]);

  if (!options.skipHistorical && existsSync(resolve(repoRoot, options.trendPath))) {
    const precheck = runTrendEvaluation("historical-baseline", options);
    steps.push(precheck);
    if (!precheck.ok) {
      console.log("\nHistorical trend precheck reported issues (non-blocking).");
    }
  } else {
    console.log(`\nSkipping historical trend precheck: ${options.skipHistorical ? "skip-historical requested" : `${options.trendPath} missing`}`);
  }

  const ciResult = runCommand(
    "quality:ci:trend-health",
    ["--json", "--require-score", String(options.qualityThreshold)],
    240000,
  );
  steps.push({
    label: "quality-ci",
    ok: ciResult.ok,
    steps: [
      {
        command: "quality:ci:trend-health",
        ok: ciResult.ok,
        status: ciResult.status,
        output: ciResult.output,
        parsedOutput: parseJson(ciResult.output),
      },
    ],
    checkResult: parseJson(ciResult.output),
  });
  if (!ciResult.ok) {
    emitFailureSummary(options, steps, artifacts, "quality-ci-failed", "quality:ci:trend-health failed");
    return;
  }

  const verifyResult = runCommand(
    "quality:verify-artifacts:trend-health",
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
  steps.push({
    label: "artifacts-verify",
    ok: verifyResult.ok,
    steps: [
      {
        command: "quality:verify-artifacts:trend-health",
        ok: verifyResult.ok,
        status: verifyResult.status,
        output: verifyResult.output,
        parsedOutput: parseJson(verifyResult.output),
      },
    ],
    checkResult: parseJson(verifyResult.output),
  });
  if (verifyResult.output) {
    writeTextFile(
      options.qualityVerificationPath,
      `${verifyResult.output.endsWith("\n") ? verifyResult.output : `${verifyResult.output}\n`}`,
    );
  } else {
    writeTextFile(
      options.qualityVerificationPath,
      `${JSON.stringify({
        ok: verifyResult.ok,
        executedAtUtc: new Date().toISOString(),
        issues: ["no output from verify command"],
      }, null, 2)}\n`,
    );
  }

  if (!verifyResult.ok) {
    emitFailureSummary(
      options,
      steps,
      artifacts,
      "verify-artifacts-failed",
      "quality:verify-artifacts:trend-health failed",
    );
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

  const postcheck = runTrendEvaluation("post-run", options, true);
  steps.push(postcheck);
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

  if (options.outputJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
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

  process.exitCode = success ? 0 : 1;
}

main();
