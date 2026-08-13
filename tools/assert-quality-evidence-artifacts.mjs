#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    requiredArtifacts: [],
    maxAgeMinutes: null,
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

    if (arg === "--max-age-minutes") {
      const raw = args[index + 1];
      const parsed = Number.parseInt(raw ?? "", 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        values.maxAgeMinutes = parsed;
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
    "Usage: node ./tools/assert-quality-evidence-artifacts.mjs --required-artifact <path> [--required-artifact <path> ...]",
    "  --json                    Print machine-readable output",
    "  --max-age-minutes <N>     Optional freshness check for JSON files with executedAtUtc",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function formatArtifactResult(path, details) {
  const executedAt = details.parsed?.executedAtUtc;
  return {
    path,
    exists: details.exists,
    size: details.size,
    parsed: details.parsed !== null,
    validJson: details.validJson,
    executedAtUtc: executedAt ?? null,
    stale: details.stale ?? false,
    issues: details.issues,
  };
}

function inspectArtifact(relativePath, maxAgeMinutes) {
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

  if (!relativePath.toLowerCase().endsWith(".json")) {
    return result;
  }

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

  const executedAtRaw = result.parsed?.executedAtUtc;
  if (typeof executedAtRaw === "string" && executedAtRaw.length > 0) {
    const executedAt = Date.parse(executedAtRaw);
    if (Number.isNaN(executedAt)) {
      result.issues.push(`artifact executedAtUtc invalid: ${relativePath}`);
    } else if (maxAgeMinutes !== null) {
      const ageMinutes = (Date.now() - executedAt) / 60000;
      if (ageMinutes > maxAgeMinutes) {
        result.stale = true;
        result.issues.push(
          `artifact stale: ${relativePath} executedAtUtc=${executedAtRaw} ageMinutes=${ageMinutes.toFixed(1)} > ${maxAgeMinutes}`,
        );
      }
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
  if (args.showHelp || args.requiredArtifacts.length === 0) {
    printUsage();
    process.exitCode = args.requiredArtifacts.length === 0 ? 1 : 0;
    return;
  }

  if (args.unknownArgs.length > 0) {
    process.stderr.write(`Unknown arguments ignored: ${args.unknownArgs.join(", ")}\n`);
  }

  const results = args.requiredArtifacts
    .filter((artifactPath) => typeof artifactPath === "string" && artifactPath.trim().length > 0)
    .map((artifactPath) => inspectArtifact(artifactPath.trim(), args.maxAgeMinutes));

  const issues = [];
  for (const artifact of results) {
    issues.push(...artifact.issues);
  }

  const output = {
    ok: issues.length === 0,
    requiredArtifacts: results.length,
    maxAgeMinutes: args.maxAgeMinutes,
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
