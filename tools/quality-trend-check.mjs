import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SEVERITY_SCORE = {
  none: 0,
  info: 1,
  warning: 2,
  critical: 3,
};

function toPositiveInteger(raw, fallback) {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const value = Math.floor(parsed);
  if (value <= 0) return fallback;
  return value;
}

function toSeverity(raw) {
  if (!raw) return "info";
  const normalized = String(raw).toLowerCase();
  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("warning") || normalized.includes("unstable")) return "warning";
  return "info";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const output = {
    digestPath: ".tmp/quality-trend-digest.json",
    guardrailPath: ".tmp/quality-trend-guardrail.json",
    summaryPath: ".tmp/quality-trend-summary.md",
    requireHardBlock: false,
    allowWarnings: false,
    outputJson: false,
    maxSummaryReasons: 5,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--digest") {
      output.digestPath = args[index + 1] ?? output.digestPath;
      index += 1;
      continue;
    }
    if (arg === "--guardrail") {
      output.guardrailPath = args[index + 1] ?? output.guardrailPath;
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      output.summaryPath = args[index + 1] ?? output.summaryPath;
      index += 1;
      continue;
    }
    if (arg === "--hard-block") {
      output.requireHardBlock = true;
      continue;
    }
    if (arg === "--allow-warnings") {
      output.allowWarnings = true;
      continue;
    }
    if (arg === "--max-summary-reasons") {
      output.maxSummaryReasons = toPositiveInteger(
        args[index + 1],
        output.maxSummaryReasons,
      );
      index += 1;
      continue;
    }
    if (arg === "--json") {
      output.outputJson = true;
      continue;
    }
  }

  return output;
}

function readJson(path) {
  const absolute = resolve(repoRoot, path);
  if (!existsSync(absolute)) return null;
  try {
    const raw = readFileSync(absolute, "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function toUnique(values) {
  return [...new Set(values)];
}

function hasCriticalReason(reasonText) {
  const text = String(reasonText).toLowerCase();
  return [
    "consecutive failures",
    "single-run score drop",
    "stable-state-required",
    "window pass rate",
    "issue count",
  ].some((needle) => text.includes(needle));
}

function classifyDigest(digest) {
  if (!digest || typeof digest !== "object") {
    return null;
  }

  const state = digest.state;
  const trendState = digest.trendState;
  const unstableReasons = Array.isArray(digest.unstableReasons)
    ? digest.unstableReasons
    : [];

  if (state === "stable" && trendState !== "regressing") {
    return {
      status: "stable",
      severity: "none",
      blocked: false,
      reasons: [],
      recommendation: "No automated trend alarm required.",
    };
  }

  const critical = unstableReasons.some((reason) => hasCriticalReason(reason));
  if (state === "unstable" && critical) {
    return {
      status: "unstable-critical",
      severity: "critical",
      blocked: true,
      reasons: unstableReasons,
      recommendation: "Block merge/release. Resolve trend instability and rerun quality:ci locally.",
    };
  }

  if (state === "unstable" || trendState === "regressing") {
    return {
      status: "unstable-warning",
      severity: "warning",
      blocked: false,
      reasons: unstableReasons,
      recommendation: "Hold deployment if strict stability policy is enabled; perform immediate verification before merge/release.",
    };
  }

  return {
    status: "attention",
    severity: "info",
    blocked: false,
    reasons: unstableReasons,
    recommendation: "Trend is noisy; verify latest artifacts before promoting.",
  };
}

function classifyGuardrail(guardrails) {
  const state = guardrails?.guardrails?.state;
  if (!state || state === "stable") return null;

  const issues = Array.isArray(guardrails?.guardrails?.issues)
    ? guardrails.guardrails.issues
    : [];
  const critical = issues.some((issue) => hasCriticalReason(issue));

  return {
    status: "guardrail-unstable",
    severity: critical ? "critical" : "warning",
    blocked: critical,
    reasons: issues,
    recommendation: "Review quality trend summary and verification payload before merge/release.",
  };
}

function aggregateFindings(findings) {
  const normalized = findings.filter(Boolean);
  if (normalized.length === 0) return null;

  const aggregate = {
    status: "unknown",
    severity: "none",
    blocked: false,
    reasons: [],
    recommendation: "No recommendation available.",
  };

  for (const finding of normalized) {
    if (finding.reasons?.length) {
      aggregate.reasons.push(...finding.reasons);
    }

    if (finding.blocked) {
      aggregate.blocked = true;
    }

    if (SEVERITY_SCORE[finding.severity] >= SEVERITY_SCORE[aggregate.severity]) {
      aggregate.severity = toSeverity(finding.severity);
      aggregate.status = finding.status;
      aggregate.recommendation = finding.recommendation ?? aggregate.recommendation;
    }
  }

  aggregate.reasons = toUnique(aggregate.reasons);
  return aggregate;
}

function summarize() {
  const args = parseArgs();
  const digest = readJson(args.digestPath);
  const guardrail = readJson(args.guardrailPath);
  const summaryPath = resolve(repoRoot, args.summaryPath);

  const findings = [
    classifyDigest(digest),
    classifyGuardrail(guardrail),
  ];

  if (findings.every((finding) => finding === null)) {
    findings.push({
      status: "missing-input",
      severity: "critical",
      blocked: true,
      reasons: [
        `Could not read required artifact: ${args.digestPath}`,
      ],
      recommendation: "Generate trend artifacts (`quality:trend-digest` / `quality:trend-summary`) before continuing.",
    });
  }

  const summary = aggregateFindings(findings);
  if (!summary) {
    process.stdout.write("quality trend check failed to produce a result\n");
    process.exitCode = 1;
    return;
  }

  const previewReasons = summary.reasons.slice(0, args.maxSummaryReasons);
  const payload = {
    status: summary.status,
    severity: summary.severity,
    blocked: summary.blocked,
    reasons: summary.reasons,
    recommendation: summary.recommendation,
    inputs: {
      digestPath: args.digestPath,
      guardrailPath: args.guardrailPath,
      summaryPath: args.summaryPath,
      summaryExists: existsSync(summaryPath),
    },
    metrics: {
      trendState: digest?.trendState ?? guardrail?.guardrails?.checks?.trendState,
      state: digest?.state,
      totalRecords: digest?.totalRecords,
      thresholds: digest?.thresholds ?? guardrail?.guardrails?.checks?.thresholds ?? null,
    },
  };

  if (summary.blocked && args.allowWarnings && summary.severity !== "critical") {
    payload.blocked = false;
    payload.status = `${payload.status}-downgraded`;
  }

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Quality trend check status: ${payload.status}\n`);
    process.stdout.write(`Severity: ${payload.severity}\n`);
    process.stdout.write(`Blocked: ${payload.blocked}\n`);
    if (previewReasons.length > 0) {
      process.stdout.write("Top reasons:\n");
      for (const reason of previewReasons) {
        process.stdout.write(`- ${reason}\n`);
      }
    } else {
      process.stdout.write("No reasons reported.\n");
    }
    process.stdout.write(`${payload.recommendation}\n`);
  }

  if (summary.blocked && args.requireHardBlock) {
    process.stdout.write("quality trend hard block: fail\n");
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

summarize();
