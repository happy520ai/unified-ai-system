import { readdir, readFile } from "node:fs/promises";
import { appendFileSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const serviceRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const repoRoot = resolve(serviceRoot, "../..");

// Diagnostics only: record which environment variables (never their values)
// the suite ran under, so runner-spawned environment differences are visible
// next to the tee'd phase output.
function recordSuiteEnvironmentSnapshot() {
  const sensitive = /TOKEN|KEY|SECRET|PASS|CREDENTIAL|AUTH/i;
  const plain = new Set(["TEMP", "TMP", "INIT_CWD", "NODE", "PNPM_SCRIPT_SRC_DIR", "npm_lifecycle_event", "ComSpec", "PROMPT"]);
  const entries = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (plain.has(name)) entries[name] = String(value);
    else entries[name] = sensitive.test(name) ? `<redacted:${String(value).length}>` : String(value).length;
  }
  const target = join(serviceRoot, "evidence", "matrix-suite-env.json");
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify({ argv: process.argv, platform: process.platform, cwd: process.cwd(), env: entries }, null, 1));
  } catch {
    // Diagnostics must never fail the suite.
  }
}
const supportedScopes = new Set(["unit", "local", "all"]);
const supportedFrameworks = new Set(["node", "vitest", "all"]);
const supportedTestExtensions = [".test.js", ".test.mjs", ".test.ts", ".test.mts"];

function parseOption(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

async function collectTestFiles(directory) {
  const files = [];

  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (
        entry.isFile()
        && supportedTestExtensions.some((extension) => entry.name.endsWith(extension))
      ) {
        files.push(path);
      }
    }
  }

  await visit(directory);
  return files;
}

function classifyFramework(source) {
  if (/\bfrom\s+["']vitest["']/.test(source)) return "vitest";
  if (/\bfrom\s+["']node:test["']/.test(source)) return "node";
  return "unsupported";
}

async function discoverTests() {
  const paths = [
    ...(await collectTestFiles(join(serviceRoot, "src"))),
    ...(await collectTestFiles(join(serviceRoot, "tests"))),
  ].sort();

  return Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, "utf8");
      return {
        path,
        framework: classifyFramework(source),
        scope: source.includes("@test-scope local") ? "local" : "unit",
        processIsolated: source.includes("@test-isolation process"),
      };
    }),
  );
}

function writeDiscoverySummary(tests) {
  const count = (predicate) => tests.filter(predicate).length;
  const summary = [
    `total=${tests.length}`,
    `unit=${count((test) => test.scope === "unit")}`,
    `local=${count((test) => test.scope === "local")}`,
    `node=${count((test) => test.framework === "node")}`,
    `vitest=${count((test) => test.framework === "vitest")}`,
    `process-isolated=${count((test) => test.processIsolated)}`,
  ];
  process.stdout.write(`gateway tests discovered: ${summary.join(" ")}\n`);
}

// The quality runner captures child output through a bounded pipe; teeing the
// phase streams into the ignored evidence directory keeps the full run
// diagnosable when that capture truncates.
const suiteLogPath = join(serviceRoot, "evidence", "matrix-suite-last.log");

function teeSuiteOutput(label, chunk) {
  try {
    mkdirSync(dirname(suiteLogPath), { recursive: true });
    appendFileSync(suiteLogPath, `[${label}] ${chunk}`);
  } catch {
    // Diagnostics must never fail the suite.
  }
}

function runProcess(command, args, cwd, envOverrides = {}) {
  const phaseLabel = args.join(" ").slice(0, 60);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...envOverrides },
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      teeSuiteOutput(phaseLabel, chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      teeSuiteOutput(phaseLabel, chunk);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Test process terminated by ${signal}`));
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}

function resolveVitestEntrypoint() {
  const requireFromRoot = createRequire(join(repoRoot, "package.json"));
  const packagePath = requireFromRoot.resolve("vitest/package.json");
  return join(dirname(packagePath), "vitest.mjs");
}

// Windows runner environments can hand the suite a short-form (8.3) TEMP whose
// realpath differs from the raw value, tripping the governed workspace path
// guards. Normalize every phase to the expanded (long-form) system temp; the
// temp must stay outside the repository because governance state guards
// reject repo-internal paths.
const phaseEnv = { NODE_ENV: "test" };
if (process.platform === "win32") {
  try {
    // realpathSync.native is required: the plain realpath keeps 8.3 short
    // names on Windows, and the guards compare against the expanded form.
    const expandedTemp = realpathSync.native(tmpdir());
    phaseEnv.TEMP = expandedTemp;
    phaseEnv.TMP = expandedTemp;
  } catch {
    // Keep the inherited temp when it cannot be expanded.
  }
}

async function runNodeTests(tests) {
  if (tests.length === 0) return 0;
  process.stdout.write(`\nRunning ${tests.length} node:test files\n`);
  return runProcess(process.execPath, ["--test", ...tests.map((test) => test.path)], serviceRoot, phaseEnv);
}

async function runVitestTests(tests, { processIsolated = false } = {}) {
  if (tests.length === 0) return 0;
  process.stdout.write(`\nRunning ${tests.length} Vitest files${processIsolated ? " in an isolated test process" : ""}\n`);
  const paths = tests.map((test) => relative(repoRoot, test.path).split(sep).join("/"));
  const isolationArgs = processIsolated ? ["--maxWorkers=1"] : [];
  // Optional workstation cap for the parallel phase: heavily loaded machines
  // (background trading apps, antivirus) time out heavy suites at full
  // parallelism. CI leaves this unset and keeps default workers.
  const parallelWorkers = Number(process.env.UAI_SUITE_PARALLEL_WORKERS);
  if (!processIsolated && Number.isInteger(parallelWorkers) && parallelWorkers >= 1 && parallelWorkers <= 8) {
    isolationArgs.push(`--maxWorkers=${parallelWorkers}`);
  }
  return runProcess(
    process.execPath,
    [resolveVitestEntrypoint(), "run", ...isolationArgs, ...paths],
    repoRoot,
    phaseEnv,
  );
}

async function main() {
  const scope = parseOption("scope", "unit");
  const framework = parseOption("framework", "all");
  if (!supportedScopes.has(scope)) throw new Error(`Unsupported test scope: ${scope}`);
  if (!supportedFrameworks.has(framework)) throw new Error(`Unsupported test framework: ${framework}`);

  recordSuiteEnvironmentSnapshot();
  const discovered = await discoverTests();
  writeDiscoverySummary(discovered);

  const unsupported = discovered.filter((test) => test.framework === "unsupported");
  if (unsupported.length > 0) {
    const paths = unsupported.map((test) => relative(serviceRoot, test.path)).join(", ");
    throw new Error(`Test files must import vitest or node:test: ${paths}`);
  }

  const selected = discovered.filter(
    (test) =>
      (scope === "all" || test.scope === scope) &&
      (framework === "all" || test.framework === framework),
  );
  if (selected.length === 0) throw new Error(`No tests selected for scope=${scope} framework=${framework}`);

  const nodeExit = await runNodeTests(selected.filter((test) => test.framework === "node"));
  const vitestTests = selected.filter((test) => test.framework === "vitest");
  // Resource-heavy parser tests must enter their dedicated process before the
  // large Vitest pool. On constrained Windows runners, starting this fork only
  // after ~1,400 tests can make the OS terminate it even though the file passes
  // independently; process isolation should not inherit prior pool pressure.
  const isolatedVitestExit = await runVitestTests(
    vitestTests.filter((test) => test.processIsolated),
    { processIsolated: true },
  );
  const vitestExit = await runVitestTests(vitestTests.filter((test) => !test.processIsolated));
  if (nodeExit !== 0 || vitestExit !== 0 || isolatedVitestExit !== 0) {
    throw new Error(`Test suite failed: node=${nodeExit} vitest=${vitestExit} isolatedVitest=${isolatedVitestExit}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
