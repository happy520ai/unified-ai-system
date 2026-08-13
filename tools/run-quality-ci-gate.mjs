import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const values = {
    qualityThreshold: 165,
    outputJson: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      values.outputJson = true;
      continue;
    }
    if (arg === "--require-score") {
      const raw = args[index + 1];
      if (raw && /^\d+$/.test(raw)) {
        values.qualityThreshold = Number(raw);
      }
      index += 1;
      continue;
    }
    const direct = arg.match(/^--require-score=(\d+)$/);
    if (direct) {
      values.qualityThreshold = Number(direct[1]);
    }
  }
  return values;
}

function parseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function runNodeScript(script, args, timeoutMs = 120000) {
  const result = spawnSync(
    process.execPath,
    [script, ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: timeoutMs,
      windowsHide: true,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stdout = (result.stdout ?? "").toString();
  const stderr = (result.stderr ?? "").toString();
  return {
    ok: result.status === 0,
    status: result.status ?? null,
    output: `${stdout}${stderr}`.trim(),
    parsedOutput: parseJson(stdout) || parseJson(stderr),
    rawStdout: stdout,
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function writeIfPossible(path, payload) {
  if (typeof payload === "string") {
    writeFileSync(resolve(repoRoot, path), payload);
  } else {
    writeFileSync(resolve(repoRoot, path), `${JSON.stringify(payload, null, 2)}\n`);
  }
}

function summarizeQuality(result) {
  return {
    ok: result.ok,
    status: result.status,
    pass: result.parsedOutput?.pass,
    score: result.parsedOutput?.score ?? null,
    maxScore: result.parsedOutput?.maxScore ?? null,
    percent: result.parsedOutput?.percent ?? null,
    parsed: !!result.parsedOutput,
    timedOut: result.timedOut,
    output: result.output,
  };
}

function summarizeDrill(result) {
  return {
    ok: result.ok,
    status: result.status,
    statusValue: result.parsedOutput?.status,
    recommendation: result.parsedOutput?.recommendation ?? null,
    parsed: !!result.parsedOutput,
    timedOut: result.timedOut,
    output: result.output,
  };
}

function main() {
  const args = parseArgs();
  const qualityPath = ".tmp/quality-scorecard.json";
  const drillPath = ".tmp/circuit-recovery-drill-dry-run.json";
  const verificationPath = ".tmp/quality-ci-verification.json";

  mkdirSync(resolve(repoRoot, ".tmp"), { recursive: true });

  const qualityResult = runNodeScript(
    "./tools/quality-scorecard.mjs",
    ["--json", "--require-score", String(args.qualityThreshold)],
    180000,
  );
  writeIfPossible(qualityPath, qualityResult.rawStdout);

  const drillResult = runNodeScript(
    "./tools/circuit-recovery-drill.mjs",
    ["--dry-run", "--json"],
    30000,
  );
  writeIfPossible(drillPath, drillResult.rawStdout);

  const verifyResult = runNodeScript(
    "./tools/verify-ci-quality-artifacts.mjs",
    ["--json", "--quality", qualityPath, "--drill", drillPath],
    30000,
  );
  writeIfPossible(verificationPath, verifyResult.rawStdout);

  const summary = {
    ok: qualityResult.ok && drillResult.ok && verifyResult.ok,
    qualityThreshold: args.qualityThreshold,
    quality: summarizeQuality(qualityResult),
    drill: summarizeDrill(drillResult),
    verification: {
      ok: verifyResult.ok,
      status: verifyResult.status,
      output: verifyResult.output,
    },
    executedAtUtc: new Date().toISOString(),
  };

  if (args.outputJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(`CI quality gate: ${summary.ok ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Quality pass=${String(summary.quality.pass)} status=${String(summary.quality.status)} score=${summary.quality.score}/${summary.quality.maxScore}\n`);
    process.stdout.write(`Dry-run drill status=${String(summary.drill.statusValue)}\n`);
  }

  process.exitCode = summary.ok ? 0 : 1;
}

main();
