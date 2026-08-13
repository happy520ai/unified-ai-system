import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    qualityPath: ".tmp/quality-scorecard.json",
    drillPath: ".tmp/circuit-recovery-drill-live.json",
    incidentBundleJsonPath: ".tmp/quality-trend-incident-bundle.json",
    incidentBundleMdPath: ".tmp/quality-trend-incident-bundle.md",
    incidentBundleSchemaPath: "tools/quality-trend-incident-bundle.schema.json",
    outputJson: false,
    requireScore: 0,
    requireTrendHealth: false,
    requireIncidentBundle: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      values.outputJson = true;
      continue;
    }
    if (arg === "--quality") {
      values.qualityPath = args[index + 1] ?? values.qualityPath;
      index += 1;
      continue;
    }
    if (arg === "--drill") {
      values.drillPath = args[index + 1] ?? values.drillPath;
      index += 1;
      continue;
    }
    if (arg === "--require-score") {
      const raw = args[index + 1];
      if (raw && /^\d+$/.test(raw)) {
        values.requireScore = Number(raw);
      }
      index += 1;
      continue;
    }
    if (arg === "--require-trend-health") {
      values.requireTrendHealth = true;
      continue;
    }
    if (arg === "--incident-bundle-json") {
      values.incidentBundleJsonPath = args[index + 1] ?? values.incidentBundleJsonPath;
      index += 1;
      continue;
    }
    if (arg === "--incident-bundle-md") {
      values.incidentBundleMdPath = args[index + 1] ?? values.incidentBundleMdPath;
      index += 1;
      continue;
    }
    if (arg === "--incident-bundle-schema") {
      values.incidentBundleSchemaPath = args[index + 1] ?? values.incidentBundleSchemaPath;
      index += 1;
      continue;
    }
    if (arg === "--require-incident-bundle") {
      values.requireIncidentBundle = true;
      continue;
    }
  }
  return values;
}

function readJson(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      ok: false,
      path: relativePath,
      issue: `file not found: ${relativePath}`,
      parsed: null,
    };
  }

  try {
    const raw = readFileSync(absolutePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ok: true,
      path: relativePath,
      parsed,
    };
  } catch (error) {
    return {
      ok: false,
      path: relativePath,
      issue: `invalid json: ${String(error.message)}`,
      parsed: null,
    };
  }
}

function verifyQuality(summary) {
  const issues = [];
  const requiredArrayFields = ["checks"];
  const requiredNumberFields = ["score", "maxScore", "percent"];

  for (const field of requiredArrayFields) {
    if (!Array.isArray(summary?.[field])) {
      issues.push(`quality summary missing array field: ${field}`);
    }
  }

  for (const field of requiredNumberFields) {
    if (typeof summary?.[field] !== "number") {
      issues.push(`quality summary missing number field: ${field}`);
    }
  }

  if (typeof summary?.executedAtUtc !== "string" || !summary.executedAtUtc) {
    issues.push("quality summary missing executedAtUtc timestamp");
  }

  if (typeof summary?.pass !== "boolean") {
    issues.push("quality summary missing pass boolean");
  }

  if (typeof summary?.packageVersion !== "string" || !summary.packageVersion) {
    issues.push("quality summary missing packageVersion");
  }

  return issues;
}

function verifyDrill(summary) {
  const issues = [];

  if (summary?.status !== "recovered") {
    issues.push(`drill summary status is ${String(summary?.status)}; expected recovered`);
  }

  if (!Array.isArray(summary?.expected) || summary.expected.length < 3) {
    issues.push("drill summary missing expected array");
  }

  if (typeof summary?.recommendation !== "string" || !summary.recommendation) {
    issues.push("drill summary missing recommendation");
  }

  if (!summary?.config || typeof summary.config !== "object") {
    issues.push("drill summary missing config object");
  }

  const requiredChecks = [
    "baselineHealthReady",
    "baselineClosed",
    "serverFailureObserved",
    "openObserved",
    "openReadinessBlocked",
    "halfOpenObserved",
    "closedObserved",
    "finalHealthReady",
    "managedGatewayCleanedUp",
  ];
  for (const check of requiredChecks) {
    if (summary?.checks?.[check] !== true) {
      issues.push(`drill check is not true: ${check}`);
    }
  }
  if (summary?.managedGateway?.cleanedUp !== true) {
    issues.push("drill managed gateway cleanup was not verified");
  }
  if (summary?.realProviderCallsMade !== false) {
    issues.push("drill did not prove realProviderCallsMade=false");
  }

  return issues;
}

function validateSchemaInstance(instance, schema) {
  const issues = [];
  if (!schema || typeof schema !== "object" || schema === null) {
    return issues;
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (!(key in (instance || {}))) {
      issues.push(`missing field: ${key}`);
    }
  }

  const properties = schema.properties || {};
  for (const [field, definition] of Object.entries(properties)) {
    if (!(field in (instance || {})) || definition == null) {
      continue;
    }
    const value = instance[field];
    const type = definition.type;
    if (!type) {
      continue;
    }
    if (type === "array" && !Array.isArray(value)) {
      issues.push(`${field} expected array`);
      continue;
    }
    if (type === "object" && (value === null || typeof value !== "object" || Array.isArray(value))) {
      issues.push(`${field} expected object`);
      continue;
    }
    if (type === "string" && typeof value !== "string") {
      issues.push(`${field} expected string`);
      continue;
    }
    if (type === "number" && typeof value !== "number") {
      issues.push(`${field} expected number`);
      continue;
    }
    if (type === "boolean" && typeof value !== "boolean") {
      issues.push(`${field} expected boolean`);
      continue;
    }

    if (type === "object" && definition.required && Array.isArray(definition.required)) {
      const nestedRequired = definition.required;
      for (const nestedKey of nestedRequired) {
        if (!Object.prototype.hasOwnProperty.call(value, nestedKey)) {
          issues.push(`${field}.${nestedKey} missing`);
        }
      }
    }
  }
  return issues;
}

function readJsonLoose(path) {
  try {
    const absolute = resolve(repoRoot, path);
    if (!existsSync(absolute)) return null;
    const raw = readFileSync(absolute, "utf8");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readTextLoose(path) {
  try {
    return readFileSync(resolve(repoRoot, path), "utf8");
  } catch {
    return null;
  }
}

function normalizeIssueCodes(rawIssueCodes, fallbackSource = null) {
  const source = typeof fallbackSource === "string" ? fallbackSource : null;
  const issueCodes = Array.isArray(rawIssueCodes) ? rawIssueCodes : [];
  const normalized = [];
  const seen = new Set();

  for (const issue of issueCodes) {
    const code = issue?.code ? String(issue.code) : "unknown";
    const rawSeverity = issue?.severity;
    const normalizedSeverity = typeof rawSeverity === "string"
      ? rawSeverity.toLowerCase()
      : "unknown";
    const key = `${code}:${["high", "medium", "low", "info", "unknown"].includes(normalizedSeverity) ? normalizedSeverity : "unknown"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      code,
      severity: ["high", "medium", "low", "info", "unknown"].includes(normalizedSeverity)
        ? normalizedSeverity
        : "unknown",
      message: issue?.message ? String(issue.message) : "",
      artifactPath: issue?.artifactPath ?? null,
      source: issue?.source ?? source,
    });
  }

  const hasBlockingIssue = normalized.some((issue) => issue.severity === "high");
  if (hasBlockingIssue && !normalized.some((issue) => issue.code === "incident_bundle_blocking_failure")) {
    const synthetic = {
      code: "incident_bundle_blocking_failure",
      severity: "high",
      message: "One or more high-severity incident bundle issues are blocking CI quality gate",
      artifactPath: null,
      source: source ?? "verify-ci-quality-artifacts",
    };
    const syntheticKey = `${synthetic.code}:${synthetic.severity}`;
    if (!seen.has(syntheticKey)) {
      normalized.push(synthetic);
      seen.add(syntheticKey);
    }
  }
  return normalized;
}

function summarizeIssueCodes(issueCodes) {
  const summary = {
    total: issueCodes.length,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
    blocking: false,
  };
  for (const issue of issueCodes) {
    if (issue.severity === "high") summary.high += 1;
    else if (issue.severity === "medium") summary.medium += 1;
    else if (issue.severity === "low") summary.low += 1;
    else if (issue.severity === "info") summary.info += 1;
    else summary.unknown += 1;
  }
  summary.blocking = summary.high > 0;
  return summary;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = [];
  const seen = new Set();
  for (const entry of value) {
    const normalizedEntry = String(entry);
    if (!seen.has(normalizedEntry)) {
      normalized.push(normalizedEntry);
      seen.add(normalizedEntry);
    }
  }
  normalized.sort();
  return normalized;
}

function compareTrendConsistencyArtifacts(qualityTrendConsistency, incidentTrendConsistency, requireTrendHealth) {
  const issues = [];
  const issueCodes = [];

  const addIssue = (code, message, severity = "high", artifactPath = null) => {
    issues.push(message);
    issueCodes.push({
      code,
      severity,
      message,
      artifactPath,
      source: "verify-ci-quality-artifacts",
    });
  };

  if (!incidentTrendConsistency || typeof incidentTrendConsistency !== "object") {
    addIssue(
      "trend_consistency_parity_missing_in_incident_bundle",
      "incident bundle trendConsistency payload is missing or invalid",
      "high",
      ".tmp/quality-trend-incident-bundle.json",
    );
    return { issues, issueCodes };
  }

  const qualityChecksRequired = normalizeStringList(qualityTrendConsistency?.checksRequired);
  const incidentChecksRequired = normalizeStringList(incidentTrendConsistency?.checksRequired);

  if (JSON.stringify(qualityChecksRequired) !== JSON.stringify(incidentChecksRequired)) {
    addIssue(
      "trend_consistency_parity_checks_required_mismatch",
      `trendConsistency.checksRequired mismatch: verification=[${qualityChecksRequired.join(", ")}] incident=[${incidentChecksRequired.join(", ")}]`,
      requireTrendHealth ? "high" : "medium",
      ".tmp/quality-ci-verification.json",
    );
  }

  if (String(qualityTrendConsistency?.status ?? "") !== String(incidentTrendConsistency?.status ?? "")) {
    addIssue(
      "trend_consistency_parity_status_mismatch",
      `trendConsistency.status mismatch: verification=${String(qualityTrendConsistency?.status ?? "missing")} incident=${String(incidentTrendConsistency?.status ?? "missing")}`,
      "high",
      ".tmp/quality-ci-verification.json",
    );
  }

  const requiredChecks = qualityChecksRequired.length > 0
    ? qualityChecksRequired
    : ["trendDigestHealth", "trendSummaryGuardrails", "trendDigestCheckConsistency"];
  const qualityChecks = qualityTrendConsistency?.checks || {};
  const incidentChecks = incidentTrendConsistency?.checks || {};

  for (const key of requiredChecks) {
    const verificationCheck = qualityChecks[key];
    const incidentCheck = incidentChecks[key];

    if (!verificationCheck && incidentCheck) {
      addIssue(
        "trend_consistency_parity_missing_verification_check",
        `trendConsistency check "${key}" present in incident bundle but missing from verification`,
        requireTrendHealth ? "high" : "medium",
        ".tmp/quality-ci-verification.json",
      );
      continue;
    }
    if (verificationCheck && !incidentCheck) {
      addIssue(
        "trend_consistency_parity_missing_incident_check",
        `trendConsistency check "${key}" present in verification but missing from incident bundle`,
        "high",
        ".tmp/quality-trend-incident-bundle.json",
      );
      continue;
    }
    if (!verificationCheck && !incidentCheck) {
      continue;
    }

    if (String(verificationCheck?.status ?? "") !== String(incidentCheck?.status ?? "")) {
      addIssue(
        "trend_consistency_parity_check_status_mismatch",
        `trendConsistency check "${key}" status mismatch: verification=${String(verificationCheck?.status ?? "missing")} incident=${String(incidentCheck?.status ?? "missing")}`,
        "high",
        ".tmp/quality-trend-incident-bundle.json",
      );
    }
    if (Boolean(verificationCheck?.ok) !== Boolean(incidentCheck?.ok)) {
      addIssue(
        "trend_consistency_parity_check_ok_mismatch",
        `trendConsistency check "${key}" ok mismatch: verification=${Boolean(verificationCheck?.ok)} incident=${Boolean(incidentCheck?.ok)}`,
        "high",
        ".tmp/quality-trend-incident-bundle.json",
      );
    }
  }

  if (Boolean(qualityTrendConsistency?.hasMissingRequired) !== Boolean(incidentTrendConsistency?.hasMissingRequired)) {
    addIssue(
      "trend_consistency_parity_has_missing_required_mismatch",
      `trendConsistency.hasMissingRequired mismatch: verification=${Boolean(qualityTrendConsistency?.hasMissingRequired)} incident=${Boolean(incidentTrendConsistency?.hasMissingRequired)}`,
      "high",
      ".tmp/quality-trend-incident-bundle.json",
    );
  }

  if (Boolean(qualityTrendConsistency?.hasNotCollected) !== Boolean(incidentTrendConsistency?.hasNotCollected)) {
    addIssue(
      "trend_consistency_parity_has_not_collected_mismatch",
      `trendConsistency.hasNotCollected mismatch: verification=${Boolean(qualityTrendConsistency?.hasNotCollected)} incident=${Boolean(incidentTrendConsistency?.hasNotCollected)}`,
      "high",
      ".tmp/quality-trend-incident-bundle.json",
    );
  }

  if (
    requireTrendHealth
    && Boolean(qualityTrendConsistency?.requiresTrendHealth) !== Boolean(incidentTrendConsistency?.requiresTrendHealth)
  ) {
    addIssue(
      "trend_consistency_parity_requires_trend_health_mismatch",
      `trendConsistency.requiresTrendHealth mismatch: verification=${Boolean(qualityTrendConsistency?.requiresTrendHealth)} incident=${Boolean(incidentTrendConsistency?.requiresTrendHealth)}`,
      "high",
      ".tmp/quality-trend-incident-bundle.json",
    );
  }

  return { issues, issueCodes };
}

function validateIncidentBundleMarkdownText(markdownText) {
  const issues = [];
  if (typeof markdownText !== "string" || markdownText.length === 0) {
    return issues;
  }
  if (!/^#\s+Quality Trend Incident Bundle/im.test(markdownText)) {
    issues.push("incident bundle markdown missing required title");
  }
  if (!/##\s+Failed steps/i.test(markdownText)) {
    issues.push("incident bundle markdown missing Failed steps section");
  }
  if (!/##\s+Extracted issues/i.test(markdownText)) {
    issues.push("incident bundle markdown missing Extracted issues section");
  }
  if (!/##\s+Trend reasons/i.test(markdownText)) {
    issues.push("incident bundle markdown missing Trend reasons section");
  }
  if (!/##\s+Artifacts/i.test(markdownText)) {
    issues.push("incident bundle markdown missing Artifacts section");
  }
  if (!/Final trend status:/i.test(markdownText)) {
    issues.push("incident bundle markdown missing Final trend status");
  }
  return issues;
}

function collectTrendConsistencyChecks(qualityParsed, requireTrendHealth = false) {
  const checks = qualityParsed?.executedChecks ?? {};
  const requiredChecks = [
    "trendDigestHealth",
    "trendSummaryGuardrails",
    "trendDigestCheckConsistency",
  ];
  const issueCodes = [];
  const issues = [];
  const checksSummary = {};

  for (const key of requiredChecks) {
    const check = checks[key];
    const checkLabel = `quality-scorecard:${key}`;
    const missingSeverity = requireTrendHealth ? "high" : "medium";
    if (!check || typeof check !== "object") {
      if (requireTrendHealth) {
        issues.push(
          `${checkLabel} result missing from quality summary${requireTrendHealth ? " while trend health is required" : ""}`,
        );
      }
      issueCodes.push({
        code: `${key}_missing`,
        severity: missingSeverity,
        message: `${checkLabel} did not emit executable check result`,
        artifactPath: "tools/quality-scorecard.mjs",
        source: "quality-scorecard",
      });
      checksSummary[key] = {
        status: "missing",
        ok: false,
      };
      continue;
    }

    checksSummary[key] = {
      status: check.status ?? "unknown",
      source: check.source ?? null,
      ok: Boolean(check.ok),
      missing: Boolean(check.missing),
      malformed: Boolean(check.malformed),
      issueCount: Array.isArray(check.issueCodes) ? check.issueCodes.length : 0,
    };

    const statusText = String(check.status ?? "").toLowerCase();
    if (requireTrendHealth && statusText === "not_collected") {
      issues.push(`${checkLabel} was not collected in this quality run while trend health is required`);
      issueCodes.push({
        code: `${key}_not_collected`,
        severity: "high",
        message: `${checkLabel} result is not_collected while trend health is required`,
        artifactPath: "tools/quality-scorecard.mjs",
        source: "quality-scorecard",
      });
      checksSummary[key].ok = false;
      continue;
    }

    if (Array.isArray(check.issueCodes)) {
      for (const issue of check.issueCodes) {
        issueCodes.push({
          code: issue?.code ? String(issue.code) : `${key}_issue`,
          severity: issue?.severity ? String(issue.severity) : "unknown",
          message: issue?.message ? String(issue.message) : `trend check ${key} reported an issue`,
          artifactPath: issue?.artifactPath ?? check.source ?? null,
          source: issue?.source ?? "quality-scorecard",
        });
      }
    }
  }

  const normalizedIssueCodes = normalizeIssueCodes(issueCodes, "verify-ci-quality-artifacts");
  const issueCodeSummary = summarizeIssueCodes(normalizedIssueCodes);
  const checksEntries = Object.values(checksSummary);
  const hasMissingRequired = requiredChecks.some((checkKey) => checksSummary[checkKey]?.status === "missing");
  const hasNotCollected = checksEntries.some(
    (entry) => String(entry?.status ?? "").toLowerCase() === "not_collected",
  );
  const hasCheckFail = checksEntries.some(
    (entry) => !entry || entry.status === "missing" || entry.ok === false,
  );
  const status = hasCheckFail || (requireTrendHealth && hasNotCollected)
    ? "fail"
    : hasNotCollected
      ? "degraded"
      : "pass";
  const ok = status === "pass" || (!requireTrendHealth && status === "degraded");

  if (!ok) {
    if (requireTrendHealth) {
      issues.push("quality trend consistency checks failed in strict trend-health mode");
    } else {
      issues.push("quality trend consistency checks failed in compatibility mode");
    }
  }

  return {
    issues,
    issueCodes: normalizedIssueCodes,
    issueCodeSummary,
    checks: checksSummary,
    checksRequired: requiredChecks,
    hasMissingRequired,
    hasNotCollected,
    status,
    ok,
    requiresTrendHealth: requireTrendHealth,
  };
}

function verifyIncidentBundle(args) {
  const issues = [];
  const issueCodes = [];
  const addIssue = (code, message, details = {}) => {
    issues.push(message);
    issueCodes.push({
      code,
      message,
      ...details,
    });
  };

  const bundleText = readTextLoose(args.incidentBundleMdPath);
  const bundle = readJsonLoose(args.incidentBundleJsonPath);
  const schema = readJsonLoose(args.incidentBundleSchemaPath);
  const markdownText = bundleText && typeof bundleText === "string" ? bundleText : "";

  const jsonExists = Boolean(bundle);
  const mdExists = typeof bundleText === "string" && bundleText.length > 0;
  const markdownValidationIssues = mdExists ? validateIncidentBundleMarkdownText(markdownText) : [];

  if (args.requireIncidentBundle) {
    if (!jsonExists) {
      addIssue("incident_bundle_json_missing", `incident bundle json not present: ${args.incidentBundleJsonPath}`, {
        severity: "high",
        artifactPath: args.incidentBundleJsonPath,
      });
    }
    if (!mdExists) {
      addIssue("incident_bundle_markdown_missing", `incident bundle markdown not present: ${args.incidentBundleMdPath}`, {
        severity: "high",
        artifactPath: args.incidentBundleMdPath,
      });
    }
  } else if (jsonExists && !mdExists) {
    addIssue("incident_bundle_markdown_missing", `incident bundle markdown missing: ${args.incidentBundleMdPath}`, {
      severity: "medium",
      artifactPath: args.incidentBundleMdPath,
      source: "pair-consistency-check",
    });
  } else if (mdExists && !jsonExists) {
    addIssue("incident_bundle_json_missing", `incident bundle json missing for markdown artifact: ${args.incidentBundleJsonPath}`, {
      severity: "medium",
      artifactPath: args.incidentBundleJsonPath,
      source: "pair-consistency-check",
    });
  }

  if (jsonExists) {
    if (bundle && bundle.schemaVersion !== 1) {
      addIssue(
        "incident_bundle_schema_version_invalid",
        `incident bundle schemaVersion expected 1 but got ${String(bundle.schemaVersion)}`,
        {
          severity: "high",
          artifactPath: args.incidentBundleJsonPath,
          observed: bundle.schemaVersion,
        },
      );
    }
    if (schema) {
      const schemaIssues = validateSchemaInstance(bundle, schema);
      if (schemaIssues.length > 0) {
        addIssue(
          "incident_bundle_schema_invalid",
          `incident bundle schema validation failed: ${schemaIssues.join(", ")}`,
          {
            severity: "high",
            artifactPath: args.incidentBundleJsonPath,
            validationErrors: schemaIssues,
          },
        );
      }
      if (markdownValidationIssues.length > 0) {
        addIssue(
          "incident_bundle_markdown_invalid",
          `incident bundle markdown validation failed: ${markdownValidationIssues.join(", ")}`,
          {
            severity: "medium",
            artifactPath: args.incidentBundleMdPath,
            validationErrors: markdownValidationIssues,
          },
        );
      }
    } else if (args.requireIncidentBundle || args.requireTrendHealth) {
      addIssue("incident_bundle_schema_missing", `incident bundle schema missing: ${args.incidentBundleSchemaPath}`, {
        severity: "high",
        artifactPath: args.incidentBundleSchemaPath,
      });
      if (jsonExists && markdownValidationIssues.length > 0) {
        addIssue(
          "incident_bundle_markdown_invalid",
          `incident bundle markdown validation failed: ${markdownValidationIssues.join(", ")}`,
          {
            severity: "medium",
            artifactPath: args.incidentBundleMdPath,
            validationErrors: markdownValidationIssues,
          },
        );
      }
    }
  }

  const normalizedIssueCodes = normalizeIssueCodes(issueCodes, "verify-ci-quality-artifacts");
  const issueCodeSummary = summarizeIssueCodes(normalizedIssueCodes);

  return {
    jsonPath: args.incidentBundleJsonPath,
    mdPath: args.incidentBundleMdPath,
    parsedBundle: bundle,
    jsonPresent: jsonExists,
    mdPresent: mdExists,
    schemaVersion: bundle?.schemaVersion ?? null,
    markdownValid: markdownValidationIssues.length === 0,
    markdownValidationIssues,
    issueCodes: normalizedIssueCodes,
    issueCodeSummary,
    valid: issues.length === 0,
    issues,
  };
}

function main() {
  const args = parseArgs();
  const quality = readJson(args.qualityPath);
  const drill = readJson(args.drillPath);
  const incidentBundle = verifyIncidentBundle(args);
  const trendConsistency = collectTrendConsistencyChecks(
    quality.parsed,
    args.requireTrendHealth,
  );

  const qualityIssues = [];
  const drillIssues = [];

  if (!quality.ok) {
    qualityIssues.push(quality.issue);
  }

  if (!drill.ok) {
    drillIssues.push(drill.issue);
  }

  if (quality.ok) {
    qualityIssues.push(...verifyQuality(quality.parsed));
  }

  if (drill.ok) {
    drillIssues.push(...verifyDrill(drill.parsed));
  }

  const qualityParsed = quality.ok ? quality.parsed : null;
  const drillParsed = drill.ok ? drill.parsed : null;
  const qualityIssuesFinal = [...qualityIssues];
  const drillIssuesFinal = [...drillIssues];
  const incidentBundleIssuesFinal = [...incidentBundle.issues];
  const trendConsistencyParity = incidentBundle.jsonPresent || args.requireIncidentBundle
    ? compareTrendConsistencyArtifacts(
      trendConsistency,
      incidentBundle.parsedBundle?.trendConsistency,
      args.requireTrendHealth,
    )
    : { issues: [], issueCodes: [] };

  if (qualityParsed?.trendHealth && typeof qualityParsed.trendHealth === "object") {
    const trendBlocked = Boolean(qualityParsed.trendHealth.blocked);
    if (trendBlocked) {
      qualityIssuesFinal.push(
        `quality trend health is blocked (status=${qualityParsed.trendHealth.status ?? "unknown"})`,
      );
    }
    const trendStatus = qualityParsed.trendHealth.status;
    if (args.requireTrendHealth && trendStatus === "not_collected") {
      qualityIssuesFinal.push("quality scorecard missing trend health evidence (trend-health status not collected)");
    }
  }

  if (args.requireScore > 0 && qualityParsed?.score != null) {
    if (qualityParsed.score < args.requireScore) {
      qualityIssuesFinal.push(`quality score ${qualityParsed.score} below required ${args.requireScore}`);
    }
  } else if (args.requireScore > 0 && !qualityParsed) {
    qualityIssuesFinal.push(`quality score could not be verified; required score is ${args.requireScore}`);
  }

  const finalIssues = qualityIssuesFinal.concat(drillIssuesFinal);
  finalIssues.push(...incidentBundleIssuesFinal);
  finalIssues.push(...trendConsistency.issues);
  finalIssues.push(...trendConsistencyParity.issues);

  const issueCodes = normalizeIssueCodes(
    [...incidentBundle.issueCodes, ...trendConsistency.issueCodes, ...trendConsistencyParity.issueCodes],
    "verify-ci-quality-artifacts",
  );
  const issueCodeSummary = summarizeIssueCodes(issueCodes);

  const result = {
    ok: finalIssues.length === 0,
    issueCodes,
    issueCodeSummary,
    artifacts: {
      quality: {
        path: quality.path,
        valid: quality.ok && qualityIssuesFinal.length === 0,
      },
      drill: {
        path: drill.path,
        valid: drill.ok && drillIssuesFinal.length === 0,
      },
    },
    incidentBundle: {
      jsonPath: incidentBundle.jsonPath,
      mdPath: incidentBundle.mdPath,
      jsonPresent: incidentBundle.jsonPresent,
      mdPresent: incidentBundle.mdPresent,
      issueCodes: incidentBundle.issueCodes,
      valid: incidentBundle.valid,
      requireIncidentBundle: args.requireIncidentBundle,
      schemaPath: args.incidentBundleSchemaPath,
    },
      checks: {
      qualityScore: qualityParsed?.score ?? null,
      qualityMaxScore: qualityParsed?.maxScore ?? null,
      drillStatus: drillParsed?.status ?? null,
      drillRecommendationPresent: typeof drillParsed?.recommendation === "string",
        requiredScore: args.requireScore,
        requiredScoreMet: args.requireScore > 0 ? (qualityParsed?.score ?? 0) >= args.requireScore : true,
      },
      trendConsistency: {
        checks: trendConsistency.checks,
        issueCodes: trendConsistency.issueCodes,
        issueCodeSummary: trendConsistency.issueCodeSummary,
        checksRequired: [
          "trendDigestHealth",
          "trendSummaryGuardrails",
          "trendDigestCheckConsistency",
        ],
      },
    issues: finalIssues,
    executedAtUtc: new Date().toISOString(),
  };

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const prefix = finalIssues.length === 0 ? "PASS" : "FAIL";
    process.stdout.write(`Quality artifact verification: ${prefix}\n`);
    if (finalIssues.length > 0) {
      process.stdout.write("Issues:\n");
      for (const issue of finalIssues) {
        process.stdout.write(`- ${issue}\n`);
      }
    }
  }

  process.exitCode = finalIssues.length === 0 ? 0 : 1;
}

main();
