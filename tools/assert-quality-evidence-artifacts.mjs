#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    showHelp: false,
    configPath: null,
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

    if (arg === "--config") {
      values.configPath = args[index + 1] ?? null;
      index += 1;
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
      const parsed = Number.parseInt(args[index + 1] ?? "", 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        values.maxAgeMinutes = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--max-timestamp-skew-minutes") {
      const parsed = Number.parseInt(args[index + 1] ?? "", 10);
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
    "  --config <path>                                  Load assertion policy from JSON",
    "  [--required-artifact <path> ...]                  Files that must exist",
    "  [--required-json-artifact <path> ...]             Files that must parse as JSON",
    "  [--required-timestamped-artifact <path> ...]      Files that must include a timestamp",
    "  [--required-timestamp-field <artifact>:<field> ...]",
    "                                                    Custom timestamp field per artifact",
    "  [--required-field <artifact>:<field> ...]         Require a field in a JSON artifact",
    "  [--max-age-minutes <N>]                          Optional freshness check for timestamped artifacts",
    "  [--max-timestamp-skew-minutes <N>]                Optional timestamp skew check",
    "  --json                                            Print machine-readable output",
    "  --help                                            Show usage",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function normalizePositiveInteger(raw, fallback = null) {
  if (raw === null || raw === undefined || raw === "") {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const value = Math.floor(parsed);
  return value > 0 ? value : fallback;
}

function normalizeArtifacts(...items) {
  const uniq = new Set();

  for (const value of items) {
    if (!Array.isArray(value)) {
      continue;
    }

    for (const item of value) {
      if (typeof item !== "string") {
        continue;
      }

      const trimmed = item.trim();
      if (trimmed.length > 0) {
        uniq.add(trimmed);
      }
    }
  }

  return Array.from(uniq);
}

function normalizeFieldList(...items) {
  const uniq = new Set();
  const result = [];

  for (const rawList of items) {
    if (!Array.isArray(rawList)) {
      continue;
    }

    for (const raw of rawList) {
      if (!raw || typeof raw !== "object") {
        continue;
      }
      const artifactPath = String(raw.artifactPath ?? "").trim();
      const fieldPath = String(raw.fieldPath ?? "").trim();
      if (!artifactPath || !fieldPath) {
        continue;
      }
      const key = `${artifactPath}::${fieldPath}`;
      if (uniq.has(key)) {
        continue;
      }
      uniq.add(key);
      result.push({ artifactPath, fieldPath });
    }
  }

  return result;
}

function readPolicy(policyPath) {
  if (!policyPath) {
    return { ok: true, policy: {} };
  }

  const absolutePolicy = resolve(repoRoot, policyPath);
  if (!existsSync(absolutePolicy)) {
    return {
      ok: false,
      errors: [`policy missing: ${policyPath}`],
      policy: {},
    };
  }

  try {
    const raw = readFileSync(absolutePolicy, "utf8");
    return { ok: true, policy: JSON.parse(raw), path: policyPath };
  } catch (error) {
    return {
      ok: false,
      errors: [`policy parse failed: ${policyPath}: ${String(error.message)}`],
      policy: {},
    };
  }
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

  const isJsonPath = relativePath.toLowerCase().endsWith(".json");
  if (!isJsonPath && requireJson) {
    result.issues.push(`artifact expected JSON but is not .json extension: ${relativePath}`);
    return result;
  }
  if (!isJsonPath) {
    return result;
  }

  try {
    result.parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
    result.validJson = true;
  } catch (error) {
    result.issues.push(`artifact not valid JSON: ${relativePath}: ${String(error.message)}`);
    return result;
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
  const policyResult = readPolicy(args.configPath);
  const policy = policyResult.policy ?? {};
  const policyErrors = policyResult.errors ?? [];

  const policyRequiredArtifacts = Array.isArray(policy.requiredArtifacts) ? policy.requiredArtifacts : [];
  const policyRequiredJsonArtifacts = Array.isArray(policy.requiredJsonArtifacts) ? policy.requiredJsonArtifacts : [];
  const policyRequiredTimestampedArtifacts = Array.isArray(policy.requiredTimestampedArtifacts)
    ? policy.requiredTimestampedArtifacts
    : [];
  const policyRequiredFields = normalizeFieldList(Array.isArray(policy.requiredFields) ? policy.requiredFields : []);
  const policyRequiredTimestampFieldArtifacts = normalizeFieldList(
    Array.isArray(policy.requiredTimestampFieldArtifacts) ? policy.requiredTimestampFieldArtifacts : [],
  );

  const cliRequiredFields = normalizeFieldList(args.requiredFields);
  const cliTimestampFieldArtifacts = normalizeFieldList(args.requiredTimestampFieldArtifacts);

  const requiredJsonArtifacts = normalizeArtifacts(
    policyRequiredJsonArtifacts,
    args.requiredJsonArtifacts,
    args.requiredTimestampedArtifacts,
  );

  const requiredTimestampedArtifacts = normalizeArtifacts(
    policyRequiredTimestampedArtifacts,
    args.requiredTimestampedArtifacts,
  );

  const requiredFields = normalizeFieldList(
    policyRequiredFields,
    cliRequiredFields,
  );

  const requiredTimestampFieldArtifacts = normalizeFieldList(
    policyRequiredTimestampFieldArtifacts,
    cliTimestampFieldArtifacts,
  );

  const requiredArtifacts = normalizeArtifacts(
    policyRequiredArtifacts,
    args.requiredArtifacts,
    requiredJsonArtifacts,
    requiredTimestampedArtifacts,
    requiredFields.map((entry) => entry.artifactPath),
    requiredTimestampFieldArtifacts.map((entry) => entry.artifactPath),
  );

  const maxAgeMinutes = args.maxAgeMinutes === null
    ? normalizePositiveInteger(policy.maxAgeMinutes, null)
    : args.maxAgeMinutes;

  const maxTimestampSkewMinutes = args.maxTimestampSkewMinutes === null
    ? normalizePositiveInteger(policy.maxTimestampSkewMinutes, null)
    : args.maxTimestampSkewMinutes;

  if (args.showHelp) {
    printUsage();
    return;
  }

  if (args.unknownArgs.length > 0) {
    process.stderr.write(`Unknown arguments ignored: ${args.unknownArgs.join(", ")}\n`);
  }

  if (policyErrors.length > 0) {
    process.stderr.write(`${policyErrors.join("\n")}\n`);
    if (requiredArtifacts.length === 0) {
      process.exitCode = 1;
      return;
    }
  }

  if (requiredArtifacts.length === 0) {
    printUsage();
    if (policyErrors.length === 0) {
      process.stderr.write("No assertion targets configured.\n");
    }
    process.exitCode = 1;
    return;
  }

  const resolveTimestampField = (artifactPath) => {
    const match = requiredTimestampFieldArtifacts.find((entry) => entry.artifactPath === artifactPath);
    return match && match.fieldPath.length > 0 ? match.fieldPath : "executedAtUtc";
  };

  const requiredJsonSet = new Set(requiredJsonArtifacts);
  const requiredTimestampSet = new Set(requiredTimestampedArtifacts);
  const results = requiredArtifacts
    .filter((artifactPath) => typeof artifactPath === "string" && artifactPath.trim().length > 0)
    .map((artifactPath) => {
      const normalized = artifactPath.trim();
      const isTimestamped = requiredTimestampSet.has(normalized);
      const requiredFieldsForArtifact = requiredFields.filter((entry) => entry.artifactPath === normalized);
      const requireJson = requiredJsonSet.has(normalized) || normalized.toLowerCase().endsWith(".json");

      return inspectArtifact(normalized, {
        requireJson,
        requireTimestamp: isTimestamped,
        requiredFields: requiredFieldsForArtifact,
        timestampField: resolveTimestampField(normalized),
        maxAgeMinutes: isTimestamped ? maxAgeMinutes : null,
      });
    });

  const timestamped = results.filter((artifact) => artifact.timestamp !== undefined);
  if (timestamped.length > 1 && maxTimestampSkewMinutes !== null) {
    const validTimestamps = timestamped
      .map((artifact) => Number(artifact.timestamp))
      .filter((value) => Number.isFinite(value));

    if (validTimestamps.length > 0) {
      const minTimestamp = Math.min(...validTimestamps);
      const maxTimestamp = Math.max(...validTimestamps);
      const skewMinutes = (maxTimestamp - minTimestamp) / 60000;

      if (skewMinutes > maxTimestampSkewMinutes) {
        const issue = `timestamp skew too large between timestamped artifacts: ${skewMinutes.toFixed(1)} minutes > ${maxTimestampSkewMinutes}`;
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
    ok: issues.length === 0 && policyErrors.length === 0,
    requiredArtifacts: results.length,
    policyPath: args.configPath,
    maxAgeMinutes,
    maxTimestampSkewMinutes,
    policyErrors,
    issues,
    artifacts: results.map((artifact) => formatArtifactResult(artifact.path, artifact)),
  };

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    printTextResult(results, issues.concat(policyErrors));
  }

  process.exitCode = output.ok ? 0 : 1;
}

main();
