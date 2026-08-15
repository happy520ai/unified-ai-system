#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LANGUAGE_POLICY_ALLOWLIST = resolve(repoRoot, "tools/language-policy-allowlist.json");
const DEFAULT_WARN_WITHIN_DAYS = 14;
const EXCEPTION_TYPES = new Set(["file", "fileSet", "pathPrefix", "pathPattern"]);
const REQUIRED_FIELDS = ["type", "value", "justification", "owner", "removalBy", "migrationPlan"];

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    allowlistPath: DEFAULT_LANGUAGE_POLICY_ALLOWLIST,
    warnWithinDays: DEFAULT_WARN_WITHIN_DAYS,
    outputJson: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--allowlist") {
      result.allowlistPath = args[index + 1] ?? result.allowlistPath;
      index += 1;
      continue;
    }
    if (arg === "--warn-within-days") {
      const raw = Number.parseInt(args[index + 1] ?? `${DEFAULT_WARN_WITHIN_DAYS}`, 10);
      result.warnWithinDays = Number.isFinite(raw) ? raw : DEFAULT_WARN_WITHIN_DAYS;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      result.outputJson = true;
      continue;
    }
  }

  if (!Number.isFinite(result.warnWithinDays) || result.warnWithinDays < 0) {
    result.warnWithinDays = DEFAULT_WARN_WITHIN_DAYS;
  }

  return result;
}

function parseDateUtc(dateText) {
  const normalized = `${dateText ?? ""}`.trim();
  if (!normalized) {
    return { ok: false, error: "empty date" };
  }

  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: `invalid date "${normalized}"` };
  }

  return { ok: true, value: date, text: normalized };
}

function parseAllowlist(path, warnings, issues) {
  const allowlistPath = resolve(repoRoot, path);
  if (!existsSync(allowlistPath)) {
    return { exceptions: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(allowlistPath, "utf8"));
  } catch (error) {
    issues.push(`failed to parse allowlist JSON: ${String(error.message)}`);
    return { exceptions: [] };
  }

  const exceptions = [];
  const legacyFieldMap = [
    { field: "allowedFiles", type: "file" },
    { field: "allowedPathPrefixes", type: "pathPrefix" },
    { field: "allowedPathPatterns", type: "pathPattern" },
  ];

  for (const legacy of legacyFieldMap) {
    const entries = parsed?.[legacy.field];
    if (!Array.isArray(entries)) {
      continue;
    }
    if (entries.length > 0) {
      warnings.push(
        `${legacy.field} is deprecated in allowlist; migrate each entry into exceptions[] by 2026-10-01 with justification/owner/removalBy/migrationPlan`,
      );
    }
    entries.forEach((entry, index) => {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        issues.push(`invalid ${legacy.field}[${index}] type: expected non-empty string`);
        return;
      }
      exceptions.push({
        type: legacy.type,
        value: `${entry}`.replaceAll("\\", "/"),
        justification: "legacy allowance",
        owner: "legacy",
        removalBy: "1970-01-01",
        migrationPlan: "migrate out of legacy field by 2026-10-01",
        fromLegacyField: legacy.field,
        legacyIndex: index,
      });
    });
  }

  if (!Array.isArray(parsed?.exceptions)) {
    if (parsed?.exceptions == null) {
      return { exceptions };
    }
    issues.push(`invalid "exceptions" field: expected array`);
    return { exceptions };
  }

  parsed.exceptions.forEach((entry, index) => {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push(`invalid exceptions[${index}] type: expected object`);
      return;
    }

    const normalized = {
      type: `${entry.type ?? ""}`.trim(),
      value: `${entry.value ?? ""}`.replaceAll("\\", "/").trim(),
      files: Array.isArray(entry.files)
        ? entry.files.map((file) => `${file ?? ""}`.replaceAll("\\", "/").trim())
        : [],
      justification: `${entry.justification ?? ""}`.trim(),
      owner: `${entry.owner ?? ""}`.trim(),
      removalBy: `${entry.removalBy ?? ""}`.trim(),
      migrationPlan: `${entry.migrationPlan ?? ""}`.trim(),
    };
    const missing = REQUIRED_FIELDS.filter((field) => `${entry?.[field] ?? ""}`.trim().length === 0);
    if (!EXCEPTION_TYPES.has(normalized.type)) {
      issues.push(`exceptions[${index}].type invalid: "${normalized.type || "<empty>"}"`);
    }
    if (
      normalized.type === "fileSet" &&
      (normalized.files.length === 0 || normalized.files.some((file) => file.length === 0))
    ) {
      issues.push(`exceptions[${index}].files must be a non-empty array of repository paths`);
    }
    if (missing.length > 0) {
      issues.push(`exceptions[${index}] missing required field(s): ${missing.join(", ")}`);
      return;
    }

    const parsedDate = parseDateUtc(normalized.removalBy);
    if (!parsedDate.ok) {
      issues.push(`exceptions[${index}].removalBy parse failed: ${parsedDate.error}`);
      return;
    }
    const hasEvidence = `${entry.pr ?? ""}`.trim().length > 0 || `${entry.issueId ?? ""}`.trim().length > 0;
    if (!hasEvidence) {
      issues.push(`exceptions[${index}] missing evidence trace: provide at least one of pr or issueId`);
    }

    exceptions.push({
      ...normalized,
      removalDateUtc: parsedDate.value.toISOString(),
      pr: entry.pr ? `${entry.pr}` : "",
      issueId: entry.issueId ? `${entry.issueId}` : "",
      notes: entry.notes ? `${entry.notes}` : "",
    });
  });

  return { exceptions };
}

function main() {
  const args = parseArgs();
  const output = {
    generatedAtUtc: new Date().toISOString(),
    allowlistPath: args.allowlistPath,
    warnWithinDays: args.warnWithinDays,
    scannedCount: 0,
    expired: [],
    nearExpiry: [],
    valid: [],
    warnings: [],
    issues: [],
  };

  const warnings = [];
  const issues = [];
  const parsedAllowlist = parseAllowlist(args.allowlistPath, warnings, issues);
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const warnThresholdMs = Math.max(args.warnWithinDays, 0) * 24 * 60 * 60 * 1000;

  for (const exception of parsedAllowlist.exceptions) {
    const removal = new Date(exception.removalDateUtc ?? `${exception.removalBy ?? ""}T00:00:00Z`);
    const daysUntilRemoval = Math.floor((removal.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
    const enriched = {
      ...exception,
      daysUntilRemoval,
    };

    output.scannedCount += 1;
    if (removal.getTime() < todayUtc.getTime()) {
      output.expired.push(enriched);
      continue;
    }
    if (daysUntilRemoval <= (args.warnWithinDays - 1) + 1) {
      output.nearExpiry.push(enriched);
      continue;
    }
    output.valid.push(enriched);
  }

  output.warnings = warnings;
  output.issues = issues;
  output.warnWithinDays = args.warnWithinDays;

  if (output.issues.length === 0 && output.expired.length > 0) {
    output.issues.push(`${output.expired.length} exception(s) already expired`);
  }

  output.expired.sort((left, right) => new Date(left.removalBy).getTime() - new Date(right.removalBy).getTime());
  output.nearExpiry.sort((left, right) => left.daysUntilRemoval - right.daysUntilRemoval);
  output.valid.sort((left, right) => left.value.localeCompare(right.value));

  output.summary = {
    total: output.scannedCount,
    expiredCount: output.expired.length,
    nearExpiryCount: output.nearExpiry.length,
    validCount: output.valid.length,
  };

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(`Language policy expiry report for ${args.allowlistPath}\n`);
    process.stdout.write(`Generated: ${output.generatedAtUtc}\n`);
    process.stdout.write(`Scanned exceptions: ${output.scannedCount}\n`);
    process.stdout.write(`Expired: ${output.expired.length}\n`);
    process.stdout.write(`Near expiry (${args.warnWithinDays}d): ${output.nearExpiry.length}\n`);
    if (output.issues.length > 0) {
      process.stdout.write("Issues:\n");
      for (const issue of output.issues) {
        process.stdout.write(`- ${issue}\n`);
      }
    }
    if (output.warnings.length > 0) {
      process.stdout.write("Warnings:\n");
      for (const warning of output.warnings) {
        process.stdout.write(`- ${warning}\n`);
      }
    }
  }

  process.exitCode = output.issues.length > 0 ? 1 : 0;
}

main();
