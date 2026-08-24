import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const serviceRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const repoRoot = resolve(serviceRoot, "../..");
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

function runProcess(command, args, cwd, envOverrides = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...envOverrides },
      stdio: "inherit",
      windowsHide: true,
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

async function runNodeTests(tests) {
  if (tests.length === 0) return 0;
  process.stdout.write(`\nRunning ${tests.length} node:test files\n`);
  return runProcess(process.execPath, ["--test", ...tests.map((test) => test.path)], serviceRoot, { NODE_ENV: "test" });
}

async function runVitestTests(tests, { processIsolated = false } = {}) {
  if (tests.length === 0) return 0;
  process.stdout.write(`\nRunning ${tests.length} Vitest files${processIsolated ? " in an isolated test process" : ""}\n`);
  const paths = tests.map((test) => relative(repoRoot, test.path).split(sep).join("/"));
  const isolationArgs = processIsolated ? ["--maxWorkers=1"] : [];
  return runProcess(
    process.execPath,
    [resolveVitestEntrypoint(), "run", ...isolationArgs, ...paths],
    repoRoot,
    { NODE_ENV: "test" },
  );
}

async function main() {
  const scope = parseOption("scope", "unit");
  const framework = parseOption("framework", "all");
  if (!supportedScopes.has(scope)) throw new Error(`Unsupported test scope: ${scope}`);
  if (!supportedFrameworks.has(framework)) throw new Error(`Unsupported test framework: ${framework}`);

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
  const vitestExit = await runVitestTests(vitestTests.filter((test) => !test.processIsolated));
  const isolatedVitestExit = await runVitestTests(
    vitestTests.filter((test) => test.processIsolated),
    { processIsolated: true },
  );
  if (nodeExit !== 0 || vitestExit !== 0 || isolatedVitestExit !== 0) {
    throw new Error(`Test suite failed: node=${nodeExit} vitest=${vitestExit} isolatedVitest=${isolatedVitestExit}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
