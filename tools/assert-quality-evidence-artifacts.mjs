#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    requiredArtifacts: [],
    requiredJsonArtifacts: [],
    requiredTimestampedArtifacts: [],
    requiredTimestampFieldArtifacts: [],
    requiredFields: [],
    maxAgeMinutes: null,
    maxTimestampSkewMinutes: null,
    outputJson: false,
    unknownArgs: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      values.outputJson = true;
      continue;
    }

    if (arg === "--required-artifact") {
      values.requiredArtifacts.push(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--required-json-artifact") {
      values.requiredJsonArtifacts.push(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--required-timestamped-artifact") {
      values.requiredTimestampedArtifacts.push(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--required-timestamp-field") {
      const raw = args[index + 1];
      if (typeof raw === "string" && raw.includes(":")) {
        const [artifactPath, fieldPath] = raw.split(":", 2);
        values.requiredTimestampFieldArtifacts.push({
          artifactPath: artifactPath ?? "",
          fieldPath: fieldPath ?? "executedAtUtc",
        });
      }
      index += 1;
      continue;
    }

    if (arg === "--required-field") {
      const raw = args[index + 1];
      if (typeof raw === "string" && raw.includes(":")) {
        const [artifactPath, fieldPath] = raw.split(":", 2);
        values.requiredFields.push({
          artifactPath: artifactPath ?? "",
          fieldPath: fieldPath ?? "",
        });
      }
      index += 1;
      continue;
    }

    if (arg === "--max-age-minutes") {
      const raw = args[index + 1];
      const parsed = Number.parseInt(raw ?? "", 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        values.maxAgeMinutes = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--max-timestamp-skew-minutes") {
      const raw = args[index + 1];
      const parsed = Number.parseInt(raw ?? "", 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        values.maxTimestampSkewMinutes = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--help") {
      values.showHelp = true;
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
    "Usage: node ./tools/assert-quality-evidence-artifacts.mjs",
    "  [--required-artifact <path> ...]        Files that must exist",
    "  [--required-json-artifact <path> ...]   Files that must parse as JSON",
    "  --json                    Print machine-readable output",
    "  --max-age-minutes <N>     Optional freshness check for JSON files with executedAtUtc",
    "  --max-timestamp-skew-minutes <N>",
    "                            Maximum gap in minutes allowed across timestamped artifacts",
    "  --required-timestamp-field <artifact>:<field>",
    "                            Custom timestamp field for an artifact",
    "  --required-json-artifact <path>",
    "                            Require a JSON-parsed artifact and mark as JSON-required",
    "  --required-timestamped-artifact <path>",
    "                            Require executedAtUtc and freshness consistency for this JSON artifact",
    "  --required-field <artifact>:<field>",
    "                            Require a field in a JSON artifact (supports dotted path)",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function formatArtifactResult(path, details) {
  return {
    path,
    exists: details.exists,
    size: details.size,
    parsed: details.parsed !== null,
    validJson: details.validJson,
    executedAtUtc: details.timestamp ?? null,
    timestampField: details.timestampField ?? null,
    stale: details.stale ?? false,
    timestampSkewMinutes: details.timestampSkewMinutes ?? null,
    issues: details.issues,
  };
}

function getFieldValue(object, fieldPath) {
  if (!object || typeof object !== "object" || !fieldPath) {
    return undefined;
  }
  const segments = String(fieldPath).split(".");
  let cursor = object;
  for (const segment of segments) {
    if (cursor == null || typeof cursor !== "object" || !(segment in cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function inspectArtifact(relativePath, options) {
  const {
    requireJson = false,
    timestampField = "executedAtUtc",
    requireTimestamp = false,
    requiredFields = [],
    maxAgeMinutes = null,
  } = options;
  const absolutePath = resolve(repoRoot, relativePath);
  const result = {
    path: relativePath,
    exists: false,
    size: 0,
    parsed: null,
    validJson: false,
    stale: false,
    issues: [],
  };

  if (!existsSync(absolutePath)) {
    result.issues.push(`artifact missing: ${relativePath}`);
    return result;
  }

  try {
    const stats = statSync(absolutePath);
    result.exists = true;
    result.size = stats.size;
    if (result.size <= 0) {
      result.issues.push(`artifact empty: ${relativePath}`);
      return result;
    }
  } catch (error) {
    result.issues.push(`artifact stat failed: ${relativePath}: ${String(error.message)}`);
    return result;
  }

  if (!relativePath.toLowerCase().endsWith(".json") && requireJson) {
    result.issues.push(`artifact expected JSON but is not .json extension: ${relativePath}`);
    return result;
  }

  if (!relativePath.toLowerCase().endsWith(".json")) {
    return result;
  }

  const shouldParseJson = requireJson || relativePath.toLowerCase().endsWith(".json");

  if (shouldParseJson) {
    let raw;
    try {
      raw = readFileSync(absolutePath, "utf8");
    } catch (error) {
      result.issues.push(`artifact read failed: ${relativePath}: ${String(error.message)}`);
      return result;
    }

    try {
      result.parsed = JSON.parse(raw);
      result.validJson = true;
    } catch (error) {
      result.issues.push(`artifact not valid JSON: ${relativePath}: ${String(error.message)}`);
      return result;
    }
  }

  if (requireTimestamp) {
    const timestampFieldPath = timestampField.length === 0 ? "executedAtUtc" : timestampField;
    const timestampRaw = getFieldValue(result.parsed, timestampFieldPath);
    result.timestampField = timestampFieldPath;
    if (typeof timestampRaw !== "string" || timestampRaw.length === 0) {
      result.issues.push(`artifact missing ${timestampFieldPath}: ${relativePath}`);
      return result;
    }
    const executedAt = Date.parse(timestampRaw);
    if (Number.isNaN(executedAt)) {
      result.issues.push(`artifact ${timestampFieldPath} invalid: ${relativePath}`);
    } else {
      result.timestamp = executedAt;
      if (maxAgeMinutes !== null) {
        const ageMinutes = (Date.now() - executedAt) / 60000;
        if (ageMinutes > maxAgeMinutes) {
        result.stale = true;
        result.issues.push(
          `artifact stale: ${relativePath} ${timestampFieldPath}=${timestampRaw} ageMinutes=${ageMinutes.toFixed(1)} > ${maxAgeMinutes}`,
        );
        }
      }
    }
  }

  for (const { artifactPath, fieldPath } of requiredFields) {
    if (artifactPath !== relativePath) {
      continue;
    }
    const value = getFieldValue(result.parsed, fieldPath);
    if (value === undefined) {
      result.issues.push(`artifact missing required field ${fieldPath}: ${relativePath}`);
    }
  }

  return result;
}

function normalizeArtifacts(values) {
  const uniq = new Set();
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        uniq.add(trimmed);
      }
    }
  }
  return Array.from(uniq);
}

function printTextResult(results, issues) {
  const prefix = issues.length === 0 ? "PASS" : "FAIL";
  process.stdout.write(`Quality evidence artifact assertion: ${prefix}\n`);
  if (issues.length === 0) {
    process.stdout.write(`Artifacts checked: ${results.length}\n`);
    return;
  }
  for (const issue of issues) {
    process.stdout.write(`- ${issue}\n`);
  }
}

function main() {
  const args = parseArgs();
  if (args.showHelp || args.requiredArtifacts.length === 0) {
    printUsage();
    process.exitCode = args.requiredArtifacts.length === 0 ? 1 : 0;
    return;
  }

  if (args.unknownArgs.length > 0) {
    process.stderr.write(`Unknown arguments ignored: ${args.unknownArgs.join(", ")}\n`);
  }

  const requiredArtifactsSet = new Set(
    normalizeArtifacts(
      args.requiredArtifacts.concat(
        args.requiredJsonArtifacts,
        args.requiredTimestampedArtifacts,
      ),
    ),
  );
  const requiredJsonSet = new Set(
    normalizeArtifacts(args.requiredJsonArtifacts.concat(args.requiredTimestampedArtifacts)),
  );
  const requiredTimestampSet = new Set(normalizeArtifacts(args.requiredTimestampedArtifacts));
  const requiredFieldMap = args.requiredFields;
  const requiredTimestampFieldMap = args.requiredTimestampFieldArtifacts;

  const resolveTimestampField = (artifactPath) => {
    const normalized = artifactPath.trim();
    const match = requiredTimestampFieldMap.find((entry) => entry.artifactPath === normalized);
    return match && typeof match.fieldPath === "string" && match.fieldPath.length > 0
      ? match.fieldPath
      : "executedAtUtc";
  };

  const results = Array.from(requiredArtifactsSet)
    .filter((artifactPath) => typeof artifactPath === "string" && artifactPath.trim().length > 0)
    .map((artifactPath) => {
      const normalized = artifactPath.trim();
      const isTimestamped = requiredTimestampSet.has(normalized);
      const requiredFields = requiredFieldMap.filter((entry) => entry.artifactPath === normalized);
      const requireJson = requiredJsonSet.has(normalized) || normalized.toLowerCase().endsWith(".json");
      const timestampField = resolveTimestampField(normalized);
      return inspectArtifact(normalized, {
        requireJson,
        requireTimestamp: isTimestamped,
        timestampField,
        requiredFields,
        maxAgeMinutes: isTimestamped ? args.maxAgeMinutes : null,
      });
    });

  const timestamped = results.filter((artifact) => artifact.timestamp !== undefined);
  if (timestamped.length > 1 && args.maxTimestampSkewMinutes !== null) {
    const validTimestamps = timestamped
      .map((artifact) => Number(artifact.timestamp))
      .filter((value) => Number.isFinite(value));
    if (validTimestamps.length > 0) {
      const minTimestamp = Math.min(...validTimestamps);
      const maxTimestamp = Math.max(...validTimestamps);
      const skewMinutes = (maxTimestamp - minTimestamp) / 60000;
      if (skewMinutes > args.maxTimestampSkewMinutes) {
        const issue = `timestamp skew too large between timestamped artifacts: ${skewMinutes.toFixed(1)} minutes > ${args.maxTimestampSkewMinutes}`;
        for (const artifact of results) {
          artifact.issues.push(issue);
          artifact.timestampSkewMinutes = skewMinutes;
        }
      }
    }
  }

  const issues = [];
  for (const artifact of results) {
    issues.push(...artifact.issues);
  }

  const output = {
    ok: issues.length === 0,
    requiredArtifacts: results.length,
    maxAgeMinutes: args.maxAgeMinutes,
    maxTimestampSkewMinutes: args.maxTimestampSkewMinutes,
    issues,
    artifacts: results.map((artifact) => formatArtifactResult(artifact.path, artifact)),
  };

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    printTextResult(results, issues);
  }

  process.exitCode = output.ok ? 0 : 1;
}

main();
