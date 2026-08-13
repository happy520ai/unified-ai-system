import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    qualityPath: ".tmp/quality-scorecard.json",
    drillPath: ".tmp/circuit-recovery-drill-dry-run.json",
    outputJson: false,
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

function main() {
  const args = parseArgs();
  const quality = readJson(args.qualityPath);
  const drill = readJson(args.drillPath);

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

  const issues = qualityIssues.concat(drillIssues);
  const result = {
    ok: issues.length === 0,
    artifacts: {
      quality: {
        path: quality.path,
        valid: quality.ok && qualityIssues.length === 0,
      },
      drill: {
        path: drill.path,
        valid: drill.ok && drillIssues.length === 0,
      },
    },
    checks: {
      qualityScore: quality.ok ? quality.parsed?.score : null,
      qualityMaxScore: quality.ok ? quality.parsed?.maxScore : null,
      drillStatus: drill.ok ? drill.parsed?.status : null,
      drillRecommendationPresent: drill.ok ? typeof drill.parsed?.recommendation === "string" : false,
    },
    issues,
    executedAtUtc: new Date().toISOString(),
  };

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const prefix = issues.length === 0 ? "PASS" : "FAIL";
    process.stdout.write(`Quality artifact verification: ${prefix}\n`);
    if (issues.length > 0) {
      process.stdout.write("Issues:\n");
      for (const issue of issues) {
        process.stdout.write(`- ${issue}\n`);
      }
    }
  }

  process.exitCode = issues.length === 0 ? 0 : 1;
}

main();
