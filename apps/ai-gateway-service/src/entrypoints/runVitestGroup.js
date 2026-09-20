import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const serviceRoot = resolve(process.cwd());
const repoRoot = resolve(serviceRoot, "../..");
const sourceRoot = join(serviceRoot, "src");
const group = process.argv[2];
const groups = new Map([
  ["agentic", ["agentic"]],
  ["agent-governance", ["agent-governance"]],
  ["capabilities", ["capabilities"]],
  ["workflow", ["workflow"]],
  ["http", ["http"]],
  ["forge-workforce", ["forge", "workforce"]],
  ["remaining", ["application", "core", "routing", "security", "real-capabilities"]],
]);
if (!groups.has(group)) {
  console.error(`Unknown Vitest group: ${group ?? "(missing)"}`);
  process.exit(2);
}

function collect(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collect(path));
    else if (/\.test\.(?:js|mjs|ts|mts)$/.test(entry.name)) {
      const source = readFileSync(path, "utf8");
      if (!/from ["']node:test["']/.test(source) && /\b(?:describe|it|test)\s*\(/.test(source)) files.push(path);
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
const args = [vitest, "run", "--maxWorkers=1", ...files.map((file) => relative(repoRoot, file).replaceAll("\\", "/"))];
console.log(`Vitest group ${group}: ${files.length} files`);
const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: "inherit", env: { ...process.env, UAI_SUITE_PARALLEL_WORKERS: "1" } });
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
