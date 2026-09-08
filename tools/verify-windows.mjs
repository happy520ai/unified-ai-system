import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { REPO_ROOT, CRITICAL_JS_FILES } from "./check-critical-js.mjs";

const require = createRequire(import.meta.url);
export const WINDOWS_TESTS = Object.freeze([
  "apps/ai-gateway-service/src/capabilities/localClientWindowsProtectedAuthorityAnchor.test.ts",
  "apps/ai-gateway-service/src/capabilities/localClientWindowsAuthorityBrokerService.test.ts",
  "apps/ai-gateway-service/src/capabilities/localClientConfigTransaction.test.ts",
]);
const STAGE_IDS = ["critical-js", "typecheck", "mcp-management", "windows-client-boundaries"];

export function validationEnvironment(source, home, temp) {
  const env = {};
  const allowed = new Set(["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "LANG", "LC_ALL", "PROCESSOR_ARCHITECTURE"]);
  for (const name of Object.keys(source)) {
    if (allowed.has(name.toUpperCase()) && typeof source[name] === "string") env[name.toUpperCase()] = source[name];
  }
  return { ...env, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home,
    TEMP: temp, TMP: temp, TMPDIR: temp, NODE_ENV: "test", CI: "1",
    AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false" };
}

export function testCounts(kind, output) {
  if (kind === "check") return null;
  let counts;
  if (kind === "vitest") {
    const value = JSON.parse(output);
    counts = { total: value.numTotalTests, passed: value.numPassedTests, failed: value.numFailedTests,
      skipped: (value.numPendingTests ?? 0) + (value.numTodoTests ?? 0) };
  } else {
    const read = name => Number([...output.matchAll(new RegExp(`^# ${name} (\\d+)\\s*$`, "gm"))].at(-1)?.[1] ?? NaN);
    counts = { total: read("tests"), passed: read("pass"), failed: read("fail"),
      skipped: read("skipped") + read("todo") };
  }
  if (!Object.values(counts).every(value => Number.isInteger(value) && value >= 0)
      || counts.total !== counts.passed + counts.failed + counts.skipped || counts.total === 0) {
    throw new Error("Test counts are missing or inconsistent.");
  }
  return counts;
}

export function runStages(stages, execute, checkpoint = () => {}) {
  const records = stages.map(stage => ({ id: stage.id, status: "not_run", reason: "pending", exitCode: null, counts: null }));
  for (let i = 0; i < stages.length; i++) {
    const record = records[i];
    Object.assign(record, { status: "failed", reason: "completion_not_confirmed", startedAt: new Date().toISOString() });
    checkpoint(records);
    try {
      const execution = execute(stages[i]);
      record.exitCode = execution.exitCode;
      if (execution.interrupted) {
        record.cleanupUnconfirmed = true; record.reason = "command_interrupted";
      } else if (execution.exitCode !== 0) {
        record.reason = "command_failed";
        try { record.counts = testCounts(stages[i].kind, execution.output); } catch { /* unknown counts stay null */ }
      }
      else {
        record.counts = testCounts(stages[i].kind, execution.output);
        const frameworkFailed = stages[i].kind === "vitest" && JSON.parse(execution.output).success === false;
        record.status = frameworkFailed || record.counts?.failed ? "failed" : record.counts?.passed === 0 ? "skipped" : "passed";
        record.reason = record.status === "passed" ? null : "tests_failed_or_not_executed";
      }
    } catch { record.reason = "command_or_report_invalid"; }
    record.finishedAt = new Date().toISOString();
    checkpoint(records);
    if (record.status !== "passed") {
      records.slice(i + 1).forEach(next => { next.reason = "prior_stage_not_passed"; });
      break;
    }
  }
  return records;
}

function sourceState(env) {
  const git = args => execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", windowsHide: true,
    env: { ...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(env.HOME, "gitconfig-disabled") },
    stdio: ["ignore", "pipe", "ignore"], timeout: 10000 }).trim();
  return { head: git(["rev-parse", "HEAD"]),
    worktree: git(["status", "--porcelain=v1", "--", ".", ":(top,literal,exclude).mcp.json", ":(glob,exclude)**/.env*"]) ? "dirty" : "clean",
    protectedPathsExcluded: [".mcp.json", "**/.env*"] };
}

export function main() {
  const startedAt = new Date().toISOString();
  const runId = `${startedAt.replace(/[:.]/g, "-")}-${randomUUID()}`;
  const outputDir = join(REPO_ROOT, "apps/ai-gateway-service/evidence/windows-validation", runId);
  mkdirSync(outputDir, { recursive: true });
  const reportPath = join(outputDir, "result.json");
  const report = { schemaVersion: 2, profileId: "windows-local-v1", runId, startedAt, status: "failed",
    cleanup: { confirmed: false },
    platform: process.platform, arch: process.arch, nodeVersion: process.version, vitestMaxWorkers: 2, source: null,
    stages: STAGE_IDS.map(id => ({ id, status: "not_run", reason: "prerequisites_not_completed", exitCode: null, counts: null })),
    coverage: { criticalJs: CRITICAL_JS_FILES, windowsTests: WINDOWS_TESTS,
      deployedWindowsServiceCertified: false, realClientCertified: false, realProviderCallsMade: false } };
  const save = () => {
    const pending = join(outputDir, `result-${randomUUID()}.tmp`);
    writeFileSync(pending, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    renameSync(pending, reportPath);
  };
  let scratch;
  try {
    scratch = realpathSync(mkdtempSync(join(tmpdir(), "uas-win-")));
    const home = join(scratch, "home"); const temp = join(scratch, "tmp");
    mkdirSync(home); mkdirSync(temp);
    const env = validationEnvironment(process.env, home, temp);
    report.source = sourceState(env);
    if (process.platform !== "win32") {
      report.status = "skipped"; report.reason = "windows_required";
      report.stages.forEach(stage => { stage.reason = "windows_required"; });
    } else {
      const vitestOutput = join(scratch, "vitest.json");
      const stages = [
        { id: "critical-js", kind: "check", args: [join(REPO_ROOT, "tools/check-critical-js.mjs")] },
        { id: "typecheck", kind: "check", args: [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"] },
        { id: "mcp-management", kind: "tap", args: ["--test", "--test-reporter=tap",
          "packages/mcp-service/src/health-server.test.ts", "packages/mcp-service/src/child-environment.test.js"] },
        { id: "windows-client-boundaries", kind: "vitest", args: [join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
          "run", "--maxWorkers=2", "--reporter=json", `--outputFile=${vitestOutput}`, ...WINDOWS_TESTS] },
      ];
      report.stages = runStages(stages, stage => {
        const child = spawnSync(process.execPath, stage.args, { cwd: REPO_ROOT, env, windowsHide: true,
          encoding: "utf8", timeout: 240000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
        // Never persist raw test stdout/stderr or assertion payloads.
        let output = child.stdout ?? "";
        if (stage.kind === "vitest") {
          try { output = readFileSync(vitestOutput, "utf8"); } catch { output = ""; }
        }
        return { exitCode: child.status ?? -1, interrupted: Boolean(child.error || child.signal), output };
      }, records => { report.stages = records; save(); });
      report.status = report.stages.every(stage => stage.status === "passed") ? "passed" : "failed";
      report.sourceAfter = sourceState(env);
      if (report.sourceAfter.head !== report.source.head || report.sourceAfter.worktree !== report.source.worktree) {
        report.status = "failed"; report.reason = "git_state_changed_during_validation";
      }
    }
  } catch { report.status = "failed"; report.reason = "validation_incomplete"; }
  finally {
    if (scratch) {
      if (report.stages.some(stage => stage.cleanupUnconfirmed)) report.scratchRetained = true;
      else {
        try {
          if (realpathSync(scratch) !== scratch) throw new Error("temporary root changed");
          rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        } catch { report.status = "failed"; report.reason = "temporary_cleanup_unconfirmed"; report.scratchRetained = true; }
      }
    }
    report.hasSkippedTests = report.stages.some(stage => (stage.counts?.skipped ?? 0) > 0);
    report.cleanup.confirmed = Boolean(scratch) && report.scratchRetained !== true
      && report.stages.every(stage => stage.cleanupUnconfirmed !== true);
    report.finishedAt = new Date().toISOString(); save();
  }
  process.stdout.write(`${JSON.stringify({ status: report.status, reportPath, source: report.source,
    stages: report.stages, hasSkippedTests: report.hasSkippedTests }, null, 2)}\n`);
  return report.status === "passed" ? 0 : report.status === "skipped" ? 2 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
