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
const LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT = ".tmp/language-policy-check.json";
const LANGUAGE_POLICY_DEFAULT_EXPIRY_ARTIFACT = ".tmp/language-policy-expiry.json";

function normalizeSeverity(raw) {
  const normalized = String(raw ?? "").toLowerCase();
  if (["high", "medium", "low", "info", "unknown", "warning", "critical"].includes(normalized)) {
    return normalized === "warning" ? "medium" : normalized === "critical" ? "high" : normalized;
  }
  return "unknown";
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
  if (!Array.isArray(issueCodes)) return summary;
  for (const issue of issueCodes) {
    const severity = normalizeSeverity(issue?.severity);
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

function computeLanguagePolicyFitness(languagePolicyCheck, languagePolicyExpiry, target = 80) {
  const counts = {
    allowed: Array.isArray(languagePolicyCheck?.allowed) ? languagePolicyCheck.allowed.length : 0,
    violations: Array.isArray(languagePolicyCheck?.violations) ? languagePolicyCheck.violations.length : 0,
    allowlistWarnings: Array.isArray(languagePolicyCheck?.allowlistWarnings) ? languagePolicyCheck.allowlistWarnings.length : 0,
    allowlistIssues: Array.isArray(languagePolicyCheck?.allowlistIssues) ? languagePolicyCheck.allowlistIssues.length : 0,
    expiredExceptions: Array.isArray(languagePolicyExpiry?.expired) ? languagePolicyExpiry.expired.length : 0,
    nearExpiryExceptions: Array.isArray(languagePolicyExpiry?.nearExpiry) ? languagePolicyExpiry.nearExpiry.length : 0,
  };

  if (!languagePolicyCheck || !languagePolicyExpiry) {
    return {
      score: 0,
      riskLevel: "critical",
      blocked: true,
      counts,
      target,
      reasons: ["language policy artifacts missing; score is unavailable."],
      preferredLanguage: "TypeScript (for apps/packages runtime surfaces)",
    };
  }

  const base = 100;
  const penalties = {
    violation: 32,
    allowlistWarning: 6,
    allowlistIssue: 10,
    expiredException: 20,
    nearExpiryException: 5,
    checkFailed: 12,
    missingMeta: 8,
  };
  let score = base
    - counts.violations * penalties.violation
    - counts.allowlistWarnings * penalties.allowlistWarning
    - counts.allowlistIssues * penalties.allowlistIssue
    - counts.expiredExceptions * penalties.expiredException
    - Math.min(counts.nearExpiryExceptions, 12) * penalties.nearExpiryException;

  if (languagePolicyCheck.ok === false) {
    score -= penalties.checkFailed;
  }
  if (!Array.isArray(languagePolicyCheck?.issues)) {
    score -= penalties.missingMeta;
  }

  const clamped = Math.max(0, Math.min(100, score));
  const riskLevel = clamped >= 85
    ? "healthy"
    : clamped >= 70
      ? "attention"
      : clamped >= 55
        ? "warning"
        : "critical";
  const blocked = clamped < 60 || counts.violations > 0 || counts.expiredExceptions > 0;

  const reasons = [];
  const issueCount = Array.isArray(languagePolicyCheck?.issues) ? languagePolicyCheck.issues.length : 0;
  if (issueCount > 0) {
    reasons.push(`language policy check metadata issues remain: ${issueCount}`);
  }
  if (counts.violations > 0) {
    reasons.push(`language policy rule violations remain: ${counts.violations}`);
  }
  if (counts.expiredExceptions > 0) {
    reasons.push(`language policy exceptions expired: ${counts.expiredExceptions}`);
  }
  if (counts.allowlistIssues > 0) {
    reasons.push(`language policy exception metadata issues: ${counts.allowlistIssues}`);
  }
  if (counts.nearExpiryExceptions > 0) {
    reasons.push(`language policy exceptions near expiry: ${counts.nearExpiryExceptions}`);
  }
  if (counts.violations > 0) {
    reasons.push(
      `language policy score reduction: -${counts.violations * penalties.violation} from ${counts.violations} violation(s)`,
    );
  }

  return {
    score: clamped,
      riskLevel,
      blocked,
      counts,
      target,
      reasons,
      preferredLanguage: "TypeScript (for apps/packages runtime surfaces)",
  };
}

function reasonToIssueCode(reasonText) {
  const reason = String(reasonText ?? "").toLowerCase();
  if (reason.includes("consecutive failures")) {
    return {
      code: "trend_consecutive_failures",
      severity: "high",
      message: reasonText,
      artifactPath: ".tmp/quality-trend-guardrail.json",
    };
  }
  if (reason.includes("single-run score drop")) {
    return {
      code: "trend_score_drop_single_run",
      severity: "medium",
      message: reasonText,
      artifactPath: ".tmp/quality-trend-guardrail.json",
    };
  }
  if (reason.includes("window pass rate")) {
    return {
      code: "trend_window_pass_rate",
      severity: "medium",
      message: reasonText,
      artifactPath: ".tmp/quality-trend-guardrail.json",
    };
  }
  if (reason.includes("stable-state-required")) {
    return {
      code: "trend_stable_state_required",
      severity: "high",
      message: reasonText,
      artifactPath: ".tmp/quality-trend-guardrail.json",
    };
  }
  if (reason.includes("language policy exception expired") || (reason.includes("expired") && reason.includes("exception"))) {
    return {
      code: "language_policy_exception_expired",
      severity: "high",
      message: reasonText,
      artifactPath: ".tmp/language-policy-expiry.json",
    };
  }
  if (reason.includes("missing evidence trace")) {
    return {
      code: "language_policy_missing_evidence",
      severity: "high",
      message: reasonText,
      artifactPath: ".tmp/language-policy-check.json",
    };
  }
  if (
    reason.includes("missing required field") && reason.includes("migrationplan")
  ) {
    return {
      code: "language_policy_missing_migration_plan",
      severity: "high",
      message: reasonText,
      artifactPath: ".tmp/language-policy-check.json",
    };
  }
  if (reason.includes("language policy artifact")) {
    return {
      code: "language_policy_artifact_missing",
      severity: "high",
      message: reasonText,
      artifactPath: ".tmp/language-policy-check.json",
    };
  }
  if (reason.includes("language policy warning") || (reason.includes("deprecated") && reason.includes("language policy"))) {
    return {
      code: "language_policy_allowlist_warning",
      severity: "medium",
      message: reasonText,
      artifactPath: ".tmp/language-policy-check.json",
    };
  }
  return {
    code: "trend_issue_unknown",
    severity: "info",
    message: reasonText,
    artifactPath: ".tmp/quality-trend-guardrail.json",
  };
}

function mapLanguagePolicyTextToIssueCode(messageText, artifactPath) {
  const reason = String(messageText ?? "").toLowerCase();
  if (reason.includes("exception expired") || (reason.includes("expired") && reason.includes("exception"))) {
    return {
      code: "language_policy_exception_expired",
      severity: "high",
      message: String(messageText ?? ""),
      artifactPath,
      source: "quality-trend-check",
    };
  }
  if (reason.includes("missing evidence trace")) {
    return {
      code: "language_policy_missing_evidence",
      severity: "high",
      message: String(messageText ?? ""),
      artifactPath,
      source: "quality-trend-check",
    };
  }
  if (reason.includes("missing required field") && reason.includes("migrationplan")) {
    return {
      code: "language_policy_missing_migration_plan",
      severity: "high",
      message: String(messageText ?? ""),
      artifactPath,
      source: "quality-trend-check",
    };
  }
  if (reason.includes("invalid") && reason.includes("date")) {
    return {
      code: "language_policy_invalid_removal_date",
      severity: "high",
      message: String(messageText ?? ""),
      artifactPath,
      source: "quality-trend-check",
    };
  }
  if (reason.includes("legacy") || reason.includes("deprecated") || reason.includes("language policy warning")) {
    return {
      code: "language_policy_allowlist_warning",
      severity: "medium",
      message: String(messageText ?? ""),
      artifactPath,
      source: "quality-trend-check",
    };
  }
  if (reason.includes("missing required field")) {
    return {
      code: "language_policy_missing_metadata",
      severity: "high",
      message: String(messageText ?? ""),
      artifactPath,
      source: "quality-trend-check",
    };
  }
  if (reason.includes("violation") || reason.includes("runtime path uses js")) {
    return {
      code: "language_policy_violation_blocked",
      severity: "high",
      message: String(messageText ?? ""),
      artifactPath,
      source: "quality-trend-check",
    };
  }
  return {
    code: "language_policy_check_issue",
    severity: "medium",
    message: String(messageText ?? ""),
    artifactPath,
    source: "quality-trend-check",
  };
}

function dedupeIssueCodes(issueCodes) {
  return issueCodes.filter((value, index, array) => {
    const key = `${value.code}:${value.severity}`;
    const firstIndex = array.findIndex((item) => `${item.code}:${item.severity}` === key);
    return firstIndex === index;
  });
}

function buildLanguagePolicyIssueCodes(languagePolicyCheck, languagePolicyExpiry) {
  const issueCodes = [];
  const addIssue = (code, message, severity, artifactPath) => {
    issueCodes.push({
      code,
      severity,
      message: String(message),
      artifactPath,
      source: "quality-trend-check",
    });
  };

  for (const warning of Array.isArray(languagePolicyCheck?.allowlistWarnings)
    ? languagePolicyCheck.allowlistWarnings
    : []) {
    issueCodes.push(
      mapLanguagePolicyTextToIssueCode(
        `language policy allowlist warning: ${warning}`,
        LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT,
      ),
    );
  }

  for (const issue of Array.isArray(languagePolicyCheck?.allowlistIssues)
    ? languagePolicyCheck.allowlistIssues
    : []) {
    issueCodes.push(mapLanguagePolicyTextToIssueCode(issue, LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT));
  }

  for (const violation of Array.isArray(languagePolicyCheck?.violations)
    ? languagePolicyCheck.violations
    : []) {
    addIssue(
      "language_policy_violation_blocked",
      `${violation.boundary ?? "unknown"}: ${violation.file ?? "unknown"} (${violation.extension ?? "unknown"}) ${violation.reason ?? "unknown"}${
        violation.remedy ? ` remedy=${violation.remedy}` : ""
      }`,
      "high",
      LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT,
    );
  }

  for (const exception of Array.isArray(languagePolicyExpiry?.expired) ? languagePolicyExpiry.expired : []) {
    addIssue(
      "language_policy_exception_expired",
      `language policy exception expired: ${exception.type ?? "unknown"}:${exception.value ?? "unknown"} (owner=${exception.owner ?? "unknown"}, removalBy=${exception.removalBy ?? "unknown"}, migrationPlan=${exception.migrationPlan ?? "unknown"}, trace=${exception.pr ? `pr=${exception.pr}` : ""}${exception.issueId ? `${exception.pr ? ", " : ""}issue=${exception.issueId}` : ""})`,
      "high",
      LANGUAGE_POLICY_DEFAULT_EXPIRY_ARTIFACT,
    );
  }

  for (const issue of Array.isArray(languagePolicyExpiry?.issues)
    ? languagePolicyExpiry.issues
    : []) {
    issueCodes.push(mapLanguagePolicyTextToIssueCode(issue, LANGUAGE_POLICY_DEFAULT_EXPIRY_ARTIFACT));
  }

  const nearExpiry = Array.isArray(languagePolicyExpiry?.nearExpiry) ? languagePolicyExpiry.nearExpiry : [];
  for (const exception of nearExpiry.slice(0, 8)) {
    addIssue(
      "language_policy_exception_near_expiry",
      `language policy exception near expiry: ${exception.type ?? "unknown"}:${exception.value ?? "unknown"} (daysUntilRemoval=${exception.daysUntilRemoval ?? "unknown"}, owner=${exception.owner ?? "unknown"}, removalBy=${exception.removalBy ?? "unknown"}, migrationPlan=${exception.migrationPlan ?? "unknown"})`,
      "low",
      LANGUAGE_POLICY_DEFAULT_EXPIRY_ARTIFACT,
    );
  }

  return dedupeIssueCodes(issueCodes);
}

function classifyLanguagePolicyArtifacts(
  languagePolicyCheck,
  languagePolicyExpiry,
  languagePolicyCheckPath,
  languagePolicyExpiryPath,
) {
  const reasons = [];
  const issueCodes = [];

  if (!languagePolicyCheck && !languagePolicyExpiry) {
    reasons.push(`Could not read required language policy artifacts: ${languagePolicyCheckPath}, ${languagePolicyExpiryPath}`);
    issueCodes.push({
      code: "language_policy_artifact_missing",
      severity: "high",
      message: `language policy artifacts missing: check=${languagePolicyCheckPath}, expiry=${languagePolicyExpiryPath}`,
      artifactPath: languagePolicyCheckPath,
      source: "quality-trend-check",
    });
  } else {
    if (!languagePolicyCheck) {
      reasons.push(`Could not read language policy check artifact: ${languagePolicyCheckPath}`);
      issueCodes.push({
        code: "language_policy_artifact_missing",
        severity: "medium",
        message: `language policy check artifact missing: ${languagePolicyCheckPath}`,
        artifactPath: languagePolicyCheckPath,
        source: "quality-trend-check",
      });
    }
    if (!languagePolicyExpiry) {
      reasons.push(`Could not read language policy expiry artifact: ${languagePolicyExpiryPath}`);
      issueCodes.push({
        code: "language_policy_artifact_missing",
        severity: "medium",
        message: `language policy expiry artifact missing: ${languagePolicyExpiryPath}`,
        artifactPath: languagePolicyExpiryPath,
        source: "quality-trend-check",
      });
    }
  }

  issueCodes.push(...buildLanguagePolicyIssueCodes(languagePolicyCheck, languagePolicyExpiry));

  for (const issue of languagePolicyCheck?.allowlistWarnings ?? []) {
    reasons.push(`language policy warning: ${String(issue)}`);
  }
  for (const issue of languagePolicyCheck?.allowlistIssues ?? []) {
    reasons.push(`language policy check issue: ${String(issue)}`);
  }
  for (const violation of languagePolicyCheck?.violations ?? []) {
    reasons.push(
      `language policy violation: ${violation?.boundary ?? "unknown"}:${violation?.file ?? "unknown"} (${violation?.extension ?? "unknown"}) ${violation?.reason ?? "unknown"}`,
    );
  }
  for (const exception of languagePolicyExpiry?.expired ?? []) {
    reasons.push(
      `language policy exception expired: ${exception?.type ?? "unknown"}:${exception?.value ?? "unknown"} (removalBy=${exception?.removalBy ?? "unknown"}, owner=${exception?.owner ?? "unknown"})`,
    );
  }
  for (const issue of languagePolicyExpiry?.issues ?? []) {
    reasons.push(`language policy expiry issue: ${String(issue)}`);
  }
  for (const exception of languagePolicyExpiry?.nearExpiry ?? []) {
    reasons.push(
      `language policy exception near expiry: ${exception?.type ?? "unknown"}:${exception?.value ?? "unknown"} (daysUntilRemoval=${exception?.daysUntilRemoval ?? "unknown"})`,
    );
  }

  if (reasons.length === 0 && issueCodes.length === 0) {
    return null;
  }

  const hasBlockingIssue = issueCodes.some((issue) => issue?.severity === "high");
  return {
    status: hasBlockingIssue ? "language-policy-blocking" : "language-policy-warning",
    severity: hasBlockingIssue ? "critical" : "warning",
    blocked: hasBlockingIssue,
    reasons,
    recommendation: "Fix language policy exception and expiry issues before proceeding.",
    issueCodes: dedupeIssueCodes(issueCodes),
  };
}

function buildIssueCodesFromTrendCheck(summary, languagePolicyIssueCodes = []) {
  const issueCodes = [];
  const reasonIssues = Array.isArray(summary?.reasons) ? summary.reasons : [];
  for (const reason of reasonIssues) {
    issueCodes.push({
      ...reasonToIssueCode(reason),
      source: "quality-trend-check",
    });
  }
  if (summary?.blocked) {
    issueCodes.push({
      code: "trend_check_blocked",
      severity: "high",
      message: "quality trend check is blocked",
      artifactPath: ".tmp/quality-trend-guardrail.json",
      source: "quality-trend-check",
    });
  }
  issueCodes.push(...Array.isArray(languagePolicyIssueCodes) ? languagePolicyIssueCodes : []);
  return dedupeIssueCodes(issueCodes);
}

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
    languagePolicyCheckPath: LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT,
    languagePolicyExpiryPath: LANGUAGE_POLICY_DEFAULT_EXPIRY_ARTIFACT,
    requireHardBlock: false,
    allowWarnings: false,
    outputJson: false,
    maxSummaryReasons: 5,
    languagePolicyScoreTarget: 80,
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
    if (arg === "--language-policy-check") {
      output.languagePolicyCheckPath = args[index + 1] ?? output.languagePolicyCheckPath;
      index += 1;
      continue;
    }
    if (arg === "--language-policy-expiry") {
      output.languagePolicyExpiryPath = args[index + 1] ?? output.languagePolicyExpiryPath;
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
    if (arg === "--language-policy-score-target") {
      const target = Number(args[index + 1]);
      output.languagePolicyScoreTarget = Number.isFinite(target) ? target : output.languagePolicyScoreTarget;
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
    "language policy exception",
    "language policy missing evidence",
    "language policy check issue",
    "language policy violation",
    "language policy artifact",
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
  const languagePolicyCheck = readJson(args.languagePolicyCheckPath ?? LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT);
  const languagePolicyExpiry = readJson(args.languagePolicyExpiryPath ?? LANGUAGE_POLICY_DEFAULT_EXPIRY_ARTIFACT);
  const languagePolicyFitness = computeLanguagePolicyFitness(
    languagePolicyCheck,
    languagePolicyExpiry,
    args.languagePolicyScoreTarget,
  );
  const languagePolicyFinding = classifyLanguagePolicyArtifacts(
    languagePolicyCheck,
    languagePolicyExpiry,
    args.languagePolicyCheckPath ?? LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT,
    args.languagePolicyExpiryPath ?? LANGUAGE_POLICY_DEFAULT_EXPIRY_ARTIFACT,
  );
  const summaryPath = resolve(repoRoot, args.summaryPath);

  const findings = [
    classifyDigest(digest),
    classifyGuardrail(guardrail),
    languagePolicyFinding,
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

  const issueCodes = buildIssueCodesFromTrendCheck(summary, languagePolicyFinding?.issueCodes);
  const languagePolicyFitnessBelowTarget = languagePolicyFitness?.score < args.languagePolicyScoreTarget;
  const languagePolicyFitnessReasons = Array.isArray(languagePolicyFitness?.reasons)
    ? languagePolicyFitness.reasons
    : [];
  if (languagePolicyFitnessBelowTarget) {
    languagePolicyFitnessReasons.push(
      `Language policy fitness ${languagePolicyFitness.score}/100 below target ${args.languagePolicyScoreTarget}.`,
    );
  }

  if (languagePolicyFitnessBelowTarget) {
    const severity = languagePolicyFitness.riskLevel === "critical" || languagePolicyFitness.riskLevel === "warning"
      ? "high"
      : "medium";
    issueCodes.push({
      code: "language_policy_fitness_low",
      severity,
      message: `language policy fitness ${languagePolicyFitness.score}/100 below target ${args.languagePolicyScoreTarget}`,
      artifactPath: args.languagePolicyCheckPath ?? LANGUAGE_POLICY_DEFAULT_CHECK_ARTIFACT,
      source: "quality-trend-check",
    });
  }

  const allReasons = [
    ...new Set([...summary.reasons, ...languagePolicyFitnessReasons]),
  ];
  const summaryReasons = allReasons.slice(0, args.maxSummaryReasons);
  const issueCodeSummary = summarizeIssueCodes(issueCodes);
  const payload = {
    executedAtUtc: new Date().toISOString(),
    status: summary.status,
    severity: summary.severity,
    blocked: summary.blocked || Boolean(languagePolicyFitness?.blocked) || languagePolicyFitnessBelowTarget,
    reasons: allReasons,
    issueCodes,
    issueCodeSummary,
    recommendation: summary.recommendation,
    inputs: {
      digestPath: args.digestPath,
      guardrailPath: args.guardrailPath,
      languagePolicyCheckPath: args.languagePolicyCheckPath,
      languagePolicyExpiryPath: args.languagePolicyExpiryPath,
      summaryPath: args.summaryPath,
      summaryExists: existsSync(summaryPath),
    },
    metrics: {
      trendState: digest?.trendState ?? guardrail?.guardrails?.checks?.trendState,
      state: digest?.state,
      totalRecords: digest?.totalRecords,
      thresholds: digest?.thresholds ?? guardrail?.guardrails?.checks?.thresholds ?? null,
      languagePolicy: languagePolicyFitness,
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
    if (summaryReasons.length > 0) {
      process.stdout.write("Top reasons:\n");
      for (const reason of summaryReasons) {
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
