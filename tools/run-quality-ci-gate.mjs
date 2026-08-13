import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    qualityThreshold: 165,
    outputJson: false,
    requireTrendHealth: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      values.outputJson = true;
      continue;
    }
    if (arg === "--require-trend-health") {
      values.requireTrendHealth = true;
      continue;
    }
    if (arg === "--require-score") {
      const raw = args[index + 1];
      if (raw && /^\d+$/.test(raw)) {
        values.qualityThreshold = Number(raw);
      }
      index += 1;
      continue;
    }
    const direct = arg.match(/^--require-score=(\d+)$/);
    if (direct) {
      values.qualityThreshold = Number(direct[1]);
    }
  }
  return values;
}

function parseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function runNodeScript(script, args, timeoutMs = 120000) {
  const result = spawnSync(
    process.execPath,
    [script, ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: timeoutMs,
      windowsHide: true,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stdout = (result.stdout ?? "").toString();
  const stderr = (result.stderr ?? "").toString();
  return {
    ok: result.status === 0,
    status: result.status ?? null,
    output: `${stdout}${stderr}`.trim(),
    parsedOutput: parseJson(stdout) || parseJson(stderr),
    rawStdout: stdout,
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function writeIfPossible(path, payload) {
  if (typeof payload === "string") {
    writeFileSync(resolve(repoRoot, path), payload);
  } else {
    writeFileSync(resolve(repoRoot, path), `${JSON.stringify(payload, null, 2)}\n`);
  }
}

function summarizeQuality(result) {
  return {
    ok: result.ok,
    status: result.status,
    pass: result.parsedOutput?.pass,
    score: result.parsedOutput?.score ?? null,
    maxScore: result.parsedOutput?.maxScore ?? null,
    percent: result.parsedOutput?.percent ?? null,
    parsed: !!result.parsedOutput,
    timedOut: result.timedOut,
    output: result.output,
  };
}

function summarizeDrill(result) {
  return {
    ok: result.ok,
    status: result.status,
    statusValue: result.parsedOutput?.status,
    recommendation: result.parsedOutput?.recommendation ?? null,
    parsed: !!result.parsedOutput,
    timedOut: result.timedOut,
    output: result.output,
  };
}

function summarizeTrendHealth(result) {
  if (!result || typeof result !== "object") {
    return { status: "not_available", blocked: false };
  }
  const trendHealth = result.parsedOutput?.trendHealth;
  if (!trendHealth || typeof trendHealth !== "object") {
    return { status: "missing", blocked: false };
  }
  return {
    status: String(trendHealth.status ?? "unknown"),
    blocked: Boolean(trendHealth.blocked),
  };
}

function summarizeTrendBundle(result) {
  const checks = result?.parsedOutput?.checks || {};
  const bundleCheck = checks.trendIncidentBundleSchema;
  if (!bundleCheck || typeof bundleCheck !== "object") {
    return {
      status: "missing",
      ok: false,
      source: ".tmp/quality-trend-incident-bundle.json",
      missing: true,
      malformed: false,
    };
  }
  return {
    status: bundleCheck.missing ? "not_collected" : bundleCheck.status,
    ok: Boolean(bundleCheck.ok),
    malformed: Boolean(bundleCheck.malformed),
    source: bundleCheck.source ?? ".tmp/quality-trend-incident-bundle.json",
    missing: Boolean(bundleCheck.missing),
  };
}

function publishStepSummary(summary) {
  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!stepSummaryPath) {
    return;
  }
  const lines = [
    "## Quality CI Gate",
    "",
    `- Overall result: ${summary.ok ? "PASS" : "FAIL"}`,
    `- Quality score threshold: ${summary.qualityThreshold}`,
    `- Quality score: ${summary.quality.score}/${summary.quality.maxScore} (${summary.quality.percent}%, pass=${String(summary.quality.pass)})`,
    `- Dry-run drill: ${summary.drill.statusValue ?? "unknown"}`,
    `- Artifact verification: ${summary.verification.ok ? "PASS" : "FAIL"}`,
    `- Trend health required in artifacts: ${summary.requireTrendHealth ? "yes" : "no"}`,
    `- Trend health: ${summary.trendHealth.status}${summary.trendHealth.blocked ? " (blocked)" : ""}`,
    `- Incident bundle: ${summary.trendIncidentBundle.status}${summary.trendIncidentBundle.missing ? " (not collected)" : ""}`,
    "",
    "| Check | Status |",
    "| --- | --- |",
    `| quality:score | ${summary.quality.parsed ? "parsed" : "not parsed"} |`,
    `| drill:dry-run | ${summary.drill.parsed ? "parsed" : "not parsed"} |`,
    `| incident bundle | ${summary.trendIncidentBundle.ok ? "pass" : "fail"} (${summary.trendIncidentBundle.status}) |`,
    `| trend health | ${summary.trendHealth.status} |`,
    `| artifacts verified | ${summary.verification.ok ? "pass" : "fail"} |`,
    "",
  ];
  appendFileSync(
    stepSummaryPath,
    `${lines.join("\n")}\n`,
    "utf8",
  );
}

function main() {
  const args = parseArgs();
  const qualityPath = ".tmp/quality-scorecard.json";
  const drillPath = ".tmp/circuit-recovery-drill-dry-run.json";
  const verificationPath = ".tmp/quality-ci-verification.json";

  mkdirSync(resolve(repoRoot, ".tmp"), { recursive: true });

  const qualityResult = runNodeScript(
    "./tools/quality-scorecard.mjs",
    ["--json", "--require-score", String(args.qualityThreshold)],
    180000,
  );
  writeIfPossible(qualityPath, qualityResult.rawStdout);

  const drillResult = runNodeScript(
    "./tools/circuit-recovery-drill.mjs",
    ["--dry-run", "--json"],
    30000,
  );
  writeIfPossible(drillPath, drillResult.rawStdout);

  const verifyResult = runNodeScript(
    "./tools/verify-ci-quality-artifacts.mjs",
    [
      "--json",
      "--quality",
      qualityPath,
      "--drill",
      drillPath,
      "--require-score",
      String(args.qualityThreshold),
      ...(args.requireTrendHealth ? ["--require-trend-health"] : []),
    ],
    30000,
  );
  writeIfPossible(verificationPath, verifyResult.rawStdout);

  const summary = {
    ok: qualityResult.ok && drillResult.ok && verifyResult.ok,
    qualityThreshold: args.qualityThreshold,
    quality: summarizeQuality(qualityResult),
    drill: summarizeDrill(drillResult),
    trendHealth: summarizeTrendHealth(qualityResult),
    trendIncidentBundle: summarizeTrendBundle(qualityResult),
    requireTrendHealth: args.requireTrendHealth,
    verification: {
      ok: verifyResult.ok,
      status: verifyResult.status,
      output: verifyResult.output,
    },
    executedAtUtc: new Date().toISOString(),
  };

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(`CI quality gate: ${summary.ok ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Quality pass=${String(summary.quality.pass)} status=${String(summary.quality.status)} score=${summary.quality.score}/${summary.quality.maxScore}\n`);
    process.stdout.write(`Dry-run drill status=${String(summary.drill.statusValue)}\n`);
  }

  publishStepSummary(summary);
  process.exitCode = summary.ok ? 0 : 1;
}

main();
