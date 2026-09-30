import { readFileSync, readdirSync, mkdirSync, renameSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";

const serviceRoot = resolve(process.cwd());
const repoRoot = resolve(serviceRoot, "../..");
const sourceRoot = join(serviceRoot, "src");
const group = process.argv[2];

// Contract for a local trust-auth postgres fixture (F-079): loopback, no
// password, role and database both `gateway_test`. Only the contract is named
// here; the disposable fixture that implements it lives outside the repo.
const LOCAL_POSTGRES_PORT = Number(process.env.AI_GATEWAY_TEST_LOCAL_PG_PORT ?? 55443);
const LOCAL_POSTGRES_URL = `postgresql://gateway_test@127.0.0.1:${LOCAL_POSTGRES_PORT}/gateway_test`;

// The postgres integration cases skip themselves when no URL is present, and a
// skip is not evidence. CI sets the URL explicitly and always wins; locally the
// cases are real whenever the fixture is listening, so they should run then.
// This sits in the process that actually spawns vitest, so it holds whichever
// entry point started the suite. Detection is liveness only - nothing here
// starts a server, and a closed port leaves the cases skipped exactly as before.
if (!process.env.AI_GATEWAY_TEST_POSTGRES_URL) {
  const reachable = await new Promise((resolve) => {
    const socket = connect(LOCAL_POSTGRES_PORT, "127.0.0.1");
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
  if (reachable) {
    process.env.AI_GATEWAY_TEST_POSTGRES_URL = LOCAL_POSTGRES_URL;
    process.stderr.write(`local postgres fixture detected; running the postgres integration cases against ${LOCAL_POSTGRES_URL}\n`);
  }
}
const NAMED_GROUPS = new Map([
  ["agentic", ["agentic"]],
  ["agent-governance", ["agent-governance"]],
  ["capabilities", ["capabilities"]],
  ["workflow", ["workflow"]],
  ["http", ["http"]],
  ["forge-workforce", ["forge", "workforce"]],
  ["remaining", ["application", "core", "routing", "security", "real-capabilities"]],
]);

// The named roots above are a subset of src/. Any directory they do not name was
// silently outside the suite - 32 directories, 151 test files - because a file that
// no group reaches never runs in CI while its author sees it green locally. So
// "remaining" is not a fixed list: it is everything the OTHER groups do not
// claim, computed at run time. A new source directory is covered the day it is
// created, and the only way to exclude one is to say so here.
//
// The group being computed is excluded from "claimed": counting its own roots
// would drop them, which is how 35 files under application/core/routing/security
// /real-capabilities fell out of the suite the first time this was written.
function groupRoots(name) {
  if (name !== "remaining") return NAMED_GROUPS.get(name);
  const claimed = new Set(
    [...NAMED_GROUPS.entries()].filter(([groupName]) => groupName !== name).flatMap(([, roots]) => roots),
  );
  return readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !claimed.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

const groups = new Map([...NAMED_GROUPS.keys()].map((name) => [name, groupRoots(name)]));
if (!groups.has(group)) {
  console.error(`Unknown Vitest group: ${group ?? "(missing)"}`);
  process.exit(2);
}

// The suite already decided which scope this run is (unit by default, local or
// all on request) and passes it through here. A file marked `@test-scope local`
// is an explicit opt-in that a unit run must not collect: before this the
// directory walk collected it anyway and its own guard then skipped it, which
// left `skipped` positive on every run and made the completion gate unusable.
const scope = process.env.UAI_TEST_SCOPE ?? "unit";
const inScope = (source) => {
  const local = source.includes("@test-scope local");
  if (scope === "all") return true;
  return scope === "local" ? local : !local;
};

function collect(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collect(path));
    else if (/\.test\.(?:js|mjs|ts|mts)$/.test(entry.name)) {
      const source = readFileSync(path, "utf8");
      if (!/from ["']node:test["']/.test(source) && /\b(?:describe|it|test)\s*\(/.test(source) && inScope(source)) files.push(path);
    }
  }
  return files;
}

const roots = groups.get(group);
const files = roots.flatMap((root) => {
  const path = join(sourceRoot, root);
  try { return collect(path); } catch (error) { if (error?.code === "ENOENT") return []; throw error; }
}).sort();
if (files.length === 0) {
  console.error(`No Vitest files found for group ${group}`);
  process.exit(1);
}
const requireFromRoot = createRequire(join(repoRoot, "package.json"));
const vitestPackage = requireFromRoot.resolve("vitest/package.json");
const vitest = join(resolve(vitestPackage, ".."), "vitest.mjs");
const collectCoverage = process.env.UAI_COVERAGE_COLLECT === "1";
// Coverage is collected as a vitest blob, one per group, and merged once the
// whole suite has run. The blob reporter is a test reporter, and its coverage
// reporter is switched off: no report and no threshold may be produced before
// the merge, or every group after the first would fail the suite mid-run.
const coverageArgs = collectCoverage
  ? ["--reporter=blob", "--coverage", "--coverage.reporter=none"]
  : [];
const args = [vitest, "run", "--maxWorkers=1", ...coverageArgs, ...files.map((file) => relative(repoRoot, file).replaceAll("\\", "/"))];
console.log(`Vitest group ${group}: ${files.length} files${collectCoverage ? " (collecting coverage)" : ""}`);
const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: "inherit", env: { ...process.env, UAI_SUITE_PARALLEL_WORKERS: "1" } });
if (result.error) { console.error(result.error); process.exit(1); }
if (collectCoverage && result.status === 0) {
  const blobDir = process.env.UAI_COVERAGE_BLOBS;
  const produced = join(repoRoot, ".vitest-reports", "blob.json");
  if (!blobDir) {
    console.error("UAI_COVERAGE_COLLECT=1 requires UAI_COVERAGE_BLOBS to name the blob directory.");
    process.exit(1);
  }
  // The blob reporter always writes the same file name, so each group's result
  // is moved aside before the next group overwrites it.
  mkdirSync(blobDir, { recursive: true });
  renameSync(produced, join(blobDir, `blob-${group}.json`));
}
process.exit(result.status ?? 1);
