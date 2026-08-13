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

function summarizeTrendConsistency(result, requireTrendHealth = false) {
  const checks = result?.parsedOutput?.checks?.trendConsistency || {};
  const consistencyChecks = checks?.checks;
  const issueCodes = Array.isArray(checks?.issueCodes) ? checks.issueCodes : [];
  const requiredChecks = Array.isArray(checks?.checksRequired) && checks.checksRequired.length > 0
    ? checks.checksRequired
    : [
      "trendDigestHealth",
      "trendSummaryGuardrails",
      "trendDigestCheckConsistency",
    ];
  const issueCodeSummary = checks?.issueCodeSummary && typeof checks.issueCodeSummary === "object"
    ? checks.issueCodeSummary
    : summarizeIssueCodes(issueCodes);

  if (!consistencyChecks || typeof consistencyChecks !== "object") {
    return {
      status: "missing",
      ok: false,
      source: ".tmp/quality-scorecard.json",
      issueCodes: [],
      issueCodeSummary,
      checks: {},
      checksRequired: [],
    };
  }

  const checksEntries = Object.values(consistencyChecks);
  const hasMissingRequired = requiredChecks.some((key) => {
    const check = consistencyChecks[key];
    return !check || typeof check !== "object";
  });
  const hasCheckFail = checksEntries.some(
    (entry) => entry?.ok === false || entry?.status === "missing",
  );
  const hasNotCollected = checksEntries.some(
    (entry) => String(entry?.status ?? "").toLowerCase() === "not_collected",
  );
  const hasTrendGap = hasMissingRequired || hasNotCollected;
  const status = hasCheckFail || (requireTrendHealth && hasTrendGap)
    ? "fail"
    : hasTrendGap
      ? "degraded"
      : "pass";

  const ok = status === "pass" || (!requireTrendHealth && status === "degraded");

  const checksSummaryStatus = hasTrendGap || hasCheckFail
    ? {
      requireTrendHealth,
      hasMissingRequired,
      hasNotCollected,
      status,
    }
    : undefined;

  return {
    status,
    ok,
    source: ".tmp/quality-scorecard.json",
    checks: consistencyChecks,
    checksRequired: requiredChecks,
    issueCodes: issueCodes.slice(0, 16),
    issueCodeSummary,
    requiresTrendHealth: requireTrendHealth,
    ...checksSummaryStatus,
  };
}

function summarizeIssueCodes(issueCodes) {
  const summary = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
    blocking: false,
  };
  if (!Array.isArray(issueCodes)) {
    return summary;
  }
  for (const issue of issueCodes) {
    const severity = issue?.severity;
    if (severity === "high") summary.high += 1;
    else if (severity === "medium") summary.medium += 1;
    else if (severity === "low") summary.low += 1;
    else if (severity === "info") summary.info += 1;
    else summary.unknown += 1;
    summary.total += 1;
  }
  summary.blocking = summary.high > 0;
  return summary;
}

function summarizeIncidentBundleFromVerification(qualityResult, verifyResult) {
  const incidentBundle = verifyResult?.parsedOutput?.incidentBundle;
  const issueCodeSummary = verifyResult?.parsedOutput?.incidentBundle?.issueCodeSummary;
  if (incidentBundle && typeof incidentBundle === "object") {
    const hasJson = Boolean(incidentBundle.jsonPresent);
    const hasMd = Boolean(incidentBundle.mdPresent);
    const hasAny = hasJson || hasMd;
    const issueCodes = Array.isArray(incidentBundle.issueCodes) ? incidentBundle.issueCodes : [];
    const hasBlockingIssue = issueCodes.some((entry) => entry?.severity === "high");
    return {
      status: !hasAny ? "not_collected" : (incidentBundle.valid ? "valid" : "invalid"),
      ok: Boolean(incidentBundle.valid),
      highPriorityFailure: hasBlockingIssue,
      jsonPath: incidentBundle.jsonPath ?? ".tmp/quality-trend-incident-bundle.json",
      mdPath: incidentBundle.mdPath ?? ".tmp/quality-trend-incident-bundle.md",
      requireIncidentBundle: Boolean(incidentBundle.requireIncidentBundle),
      schemaVersion: incidentBundle.schemaVersion ?? null,
      markdownValid: Boolean(incidentBundle.markdownValid),
      markdownValidationIssues: Array.isArray(incidentBundle.markdownValidationIssues)
        ? incidentBundle.markdownValidationIssues.slice(0, 8)
        : [],
      issueCodes: issueCodes.slice(0, 16),
      malformed: !incidentBundle.valid,
      source: incidentBundle.jsonPath ?? ".tmp/quality-trend-incident-bundle.json",
      missing: !hasAny,
      issueCodeSummary: issueCodeSummary && typeof issueCodeSummary === "object"
        ? issueCodeSummary
        : undefined,
    };
  }

  return summarizeTrendBundle(qualityResult);
}

function trendConsistencyStatusDisplay(trendConsistency) {
  const status = trendConsistency?.status ?? "missing";
  if (status === "degraded") {
    return "warn";
  }
  if (trendConsistency?.ok) {
    return "pass";
  }
  return "fail";
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
    `- Trend consistency: ${summary.trendConsistency?.status ?? "missing"}${summary.trendConsistency?.checksRequired?.length > 0 ? ` (${summary.trendConsistency.checksRequired.join(", ")})` : ""}`,
    `- Incident bundle: ${summary.trendIncidentBundle.status}${summary.trendIncidentBundle.missing ? " (not collected)" : ""}`,
    `- Incident bundle markdown: ${summary.trendIncidentBundle.markdownValid === undefined ? "not checked" : (summary.trendIncidentBundle.markdownValid ? "valid" : "invalid")}`,
    `- Issue codes: ${summary.issueCodes?.length ?? 0} total${summary.issueCodeSummary?.blocking ? " (blocking)" : ""}`,
    `- Issue code breakdown: high=${summary.issueCodeSummary?.high ?? 0}, medium=${summary.issueCodeSummary?.medium ?? 0}, low=${summary.issueCodeSummary?.low ?? 0}, info=${summary.issueCodeSummary?.info ?? 0}, unknown=${summary.issueCodeSummary?.unknown ?? 0}`,
    "",
    "| Check | Status |",
    "| --- | --- |",
    `| quality:score | ${summary.quality.parsed ? "parsed" : "not parsed"} |`,
    `| drill:dry-run | ${summary.drill.parsed ? "parsed" : "not parsed"} |`,
    `| trend consistency | ${trendConsistencyStatusDisplay(summary.trendConsistency)} (${summary.trendConsistency?.status ?? "missing"}) |`,
    `| incident bundle | ${summary.trendIncidentBundle.ok ? "pass" : "fail"} (${summary.trendIncidentBundle.status}) |`,
    `| trend health | ${summary.trendHealth.status} |`,
    `| artifacts verified | ${summary.verification.ok ? "pass" : "fail"} |`,
    "",
  ];
  if (Array.isArray(summary.issueCodes) && summary.issueCodes.length > 0) {
    lines.push("### Trend issue codes");
    lines.push("");
    for (const code of summary.issueCodes.slice(0, 24)) {
      const codeText = code?.code ? String(code.code) : "unknown";
      const severity = code?.severity ? String(code.severity) : "unknown";
      const message = code?.message ? String(code.message) : "";
      lines.push(`- [${severity}] ${codeText}: ${message}`);
    }
    lines.push("");
  }
  appendFileSync(
    stepSummaryPath,
    `${lines.join("\n")}\n`,
    "utf8",
  );
}

function flattenIssueCodes(trendIncidentBundle) {
  const issueCodes = Array.isArray(trendIncidentBundle?.issueCodes) ? trendIncidentBundle.issueCodes : [];
  const source = trendIncidentBundle?.source ?? null;
  const normalized = [];
  const seen = new Set();

  for (const issue of issueCodes) {
    const code = issue?.code ? String(issue.code) : "unknown";
    const rawSeverity = issue?.severity;
    const normalizedSeverity = typeof rawSeverity === "string"
      ? rawSeverity.toLowerCase()
      : "unknown";
    const severity = ["high", "medium", "low", "info", "unknown"].includes(normalizedSeverity)
      ? normalizedSeverity
      : "unknown";
    const key = `${code}:${severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      code,
      severity,
      message: issue?.message ?? "",
      artifactPath: issue?.artifactPath ?? null,
      source: issue?.source ?? source,
    });
  }

  if (issueCodes.some((issue) => String(issue?.severity ?? "unknown") === "high")) {
    const synthetic = {
      code: "incident_bundle_blocking_failure",
      severity: "high",
      message: "One or more high-severity incident bundle issues are blocking CI quality gate",
      artifactPath: null,
      source,
    };
    const syntheticKey = `${synthetic.code}:${synthetic.severity}`;
    if (!seen.has(syntheticKey)) {
      seen.add(syntheticKey);
      normalized.push(synthetic);
    }
  }
  return normalized;
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

  const qualityParsedOutput = qualityResult.parsedOutput;
  const trendHealth = qualityParsedOutput?.trendHealth;
  const requireIncidentBundle = Boolean(
    args.requireTrendHealth && trendHealth && (
      trendHealth.status === "not_collected"
      || trendHealth.blocked === true
    ),
  );

  const verifyResult = runNodeScript(
    "./tools/verify-ci-quality-artifacts.mjs",
    [
      "--json",
      "--quality",
      qualityPath,
      "--drill",
      drillPath,
      "--incident-bundle-json",
      ".tmp/quality-trend-incident-bundle.json",
      "--incident-bundle-md",
      ".tmp/quality-trend-incident-bundle.md",
      "--incident-bundle-schema",
      "tools/quality-trend-incident-bundle.schema.json",
      ...(requireIncidentBundle ? ["--require-incident-bundle"] : []),
      "--require-score",
      String(args.qualityThreshold),
      ...(args.requireTrendHealth ? ["--require-trend-health"] : []),
    ],
    30000,
  );
  writeIfPossible(verificationPath, verifyResult.rawStdout);
  const incidentBundleSummary = summarizeIncidentBundleFromVerification(qualityResult, verifyResult);
  const verificationParsedOutput = verifyResult?.parsedOutput || null;
  const verificationIssueCodes = Array.isArray(verificationParsedOutput?.issueCodes)
    ? verificationParsedOutput.issueCodes
    : incidentBundleSummary?.issueCodes;
  const issueCodes = flattenIssueCodes({
    issueCodes: verificationIssueCodes ?? [],
    source: ".tmp/quality-ci-verification.json",
  });
  const issueCodeSummary = summarizeIssueCodes(issueCodes);
  const trendConsistency = summarizeTrendConsistency(
    verifyResult,
    args.requireTrendHealth,
  );

  const summary = {
    ok: qualityResult.ok && drillResult.ok && verifyResult.ok,
    issueCodes,
    issueCodeSummary,
    qualityThreshold: args.qualityThreshold,
    quality: summarizeQuality(qualityResult),
    drill: summarizeDrill(drillResult),
    trendHealth: summarizeTrendHealth(qualityResult),
    trendConsistency,
    trendIncidentBundle: incidentBundleSummary,
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
