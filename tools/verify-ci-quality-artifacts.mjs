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
    requireScore: 0,
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

  const qualityParsed = quality.ok ? quality.parsed : null;
  const drillParsed = drill.ok ? drill.parsed : null;
  const qualityIssuesFinal = [...qualityIssues];
  const drillIssuesFinal = [...drillIssues];

  if (args.requireScore > 0 && qualityParsed?.score != null) {
    if (qualityParsed.score < args.requireScore) {
      qualityIssuesFinal.push(`quality score ${qualityParsed.score} below required ${args.requireScore}`);
    }
  } else if (args.requireScore > 0 && !qualityParsed) {
    qualityIssuesFinal.push(`quality score could not be verified; required score is ${args.requireScore}`);
  }

  const finalIssues = qualityIssuesFinal.concat(drillIssuesFinal);

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
