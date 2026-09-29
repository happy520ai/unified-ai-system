// Runs the maintained test suite while collecting coverage, then merges the
// per-group coverage blobs into one report.
//
// The suite is deliberately NOT run twice: the groups already run once, so the
// collection rides along with them (blob reporter per group) and a final
// `--merge-reports` pass produces the single report and evaluates thresholds.
// That keeps a second full suite - and with it the 30-minute CI budget - out of
// the picture.
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const blobDir = join(repoRoot, ".tmp", "coverage-blobs");
const vitestReports = join(repoRoot, ".vitest-reports");

function run(command, args, extraEnv) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

rmSync(blobDir, { recursive: true, force: true });
rmSync(vitestReports, { recursive: true, force: true });

const suiteExit = run("pnpm", ["test"], {
  UAI_COVERAGE_COLLECT: "1",
  UAI_COVERAGE_BLOBS: blobDir,
  UAI_SUITE_PARALLEL_WORKERS: "1",
});
if (suiteExit !== 0) {
  process.stderr.write(`Test suite failed with exit ${suiteExit}; no coverage report is produced.\n`);
  process.exit(suiteExit);
}

const mergeExit = run("node", ["node_modules/vitest/vitest.mjs", "run", "--merge-reports", blobDir, "--coverage"], {});
if (mergeExit !== 0) {
  process.stderr.write("Coverage merge failed; the report is incomplete.\n");
  process.exit(mergeExit);
}
process.stdout.write(`Coverage report written to ${join(repoRoot, "coverage")}\n`);

const floorExit = run("node", ["tools/check-coverage-thresholds.mjs"], {});
if (floorExit !== 0) {
  process.stderr.write("Coverage floors are not met.\n");
  process.exit(floorExit);
}
