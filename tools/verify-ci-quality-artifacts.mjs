import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    qualityPath: ".tmp/quality-scorecard.json",
    drillPath: ".tmp/circuit-recovery-drill-dry-run.json",
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

  if (summary?.status !== "dry-run") {
    issues.push(`drill summary status is ${String(summary?.status)}; expected dry-run`);
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

function verifyIncidentBundle(args) {
  const issues = [];
  const bundleText = readTextLoose(args.incidentBundleMdPath);
  const bundle = readJsonLoose(args.incidentBundleJsonPath);
  const schema = readJsonLoose(args.incidentBundleSchemaPath);
  const markdownText = bundleText && typeof bundleText === "string" ? bundleText : "";

  const jsonExists = Boolean(bundle);
  const mdExists = typeof bundleText === "string" && bundleText.length > 0;
  const markdownValidationIssues = mdExists ? validateIncidentBundleMarkdownText(markdownText) : [];

  if (args.requireIncidentBundle) {
    if (!jsonExists) {
      issues.push(`incident bundle json not present: ${args.incidentBundleJsonPath}`);
    }
    if (!mdExists) {
      issues.push(`incident bundle markdown not present: ${args.incidentBundleMdPath}`);
    }
  } else if (jsonExists && !mdExists) {
    issues.push(`incident bundle markdown missing: ${args.incidentBundleMdPath}`);
  } else if (mdExists && !jsonExists) {
    issues.push(`incident bundle json missing for markdown artifact: ${args.incidentBundleJsonPath}`);
  }

  if (jsonExists) {
    if (bundle && bundle.schemaVersion !== 1) {
      issues.push(`incident bundle schemaVersion expected 1 but got ${String(bundle.schemaVersion)}`);
    }
    if (schema) {
      const schemaIssues = validateSchemaInstance(bundle, schema);
      if (schemaIssues.length > 0) {
        issues.push(`incident bundle schema validation failed: ${schemaIssues.join(", ")}`);
      }
      if (markdownValidationIssues.length > 0) {
        issues.push(`incident bundle markdown validation failed: ${markdownValidationIssues.join(", ")}`);
      }
    } else if (args.requireIncidentBundle || args.requireTrendHealth) {
      issues.push(`incident bundle schema missing: ${args.incidentBundleSchemaPath}`);
      if (jsonExists && markdownValidationIssues.length > 0) {
        issues.push(`incident bundle markdown validation failed: ${markdownValidationIssues.join(", ")}`);
      }
    }
  }

  return {
    jsonPath: args.incidentBundleJsonPath,
    mdPath: args.incidentBundleMdPath,
    jsonPresent: jsonExists,
    mdPresent: mdExists,
    schemaVersion: bundle?.schemaVersion ?? null,
    markdownValid: markdownValidationIssues.length === 0,
    markdownValidationIssues,
    valid: issues.length === 0,
    issues,
  };
}

function main() {
  const args = parseArgs();
  const quality = readJson(args.qualityPath);
  const drill = readJson(args.drillPath);
  const incidentBundle = verifyIncidentBundle(args);

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

  const result = {
    ok: finalIssues.length === 0,
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
