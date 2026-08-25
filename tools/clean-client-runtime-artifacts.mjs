import { lstat, realpath, rm, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = resolve(repoRoot, ".tmp");
const execute = process.argv.includes("--execute");
const allowedNames = [
  "client-runtime-catalog.mcp-registry.global.json",
  "client-runtime-catalog.mcp-registry.json",
  "client-runtime-catalog.mcp-registry.worldwide.json",
  "client-runtime-codex",
  "client-runtime-codex-home",
  "client-runtime-codex-schema",
  "client-runtime-hosts",
  "client-runtime-inspector",
  "client-runtime-mainstream-evidence.json",
  "client-runtime-node",
  "client-runtime-promptfoo",
  "client-runtime-python",
  "codex-public-candidate-index",
];
const onlyArgument = process.argv.find((argument) => argument.startsWith("--only="));
const requestedNames = onlyArgument
  ? onlyArgument.slice("--only=".length).split(",").filter(Boolean)
  : allowedNames;
const unknownNames = requestedNames.filter((name) => !allowedNames.includes(name));
if (requestedNames.length === 0 || unknownNames.length > 0) {
  throw new Error(
    `Cleanup targets must be non-empty allowlisted names. Unknown: ${unknownNames.join(", ") || "none"}`,
  );
}

function isInside(parent, target) {
  const pathFromParent = relative(parent, target);
  return pathFromParent.length > 0
    && !pathFromParent.startsWith("..")
    && !isAbsolute(pathFromParent);
}

async function inspectTarget(name, resolvedTempRoot) {
  const target = resolve(tempRoot, name);
  if (!isInside(tempRoot, target)) {
    throw new Error(`Refusing cleanup target outside .tmp: ${target}`);
  }

  let stats;
  try {
    stats = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return { name, target, status: "missing" };
    throw error;
  }

  if (stats.isSymbolicLink()) {
    return { name, target, status: execute ? "removed-link" : "would-remove-link", stats };
  }

  const resolvedTarget = await realpath(target);
  if (!isInside(resolvedTempRoot, resolvedTarget)) {
    throw new Error(`Refusing cleanup target whose real path escaped .tmp: ${resolvedTarget}`);
  }
  return { name, target, status: execute ? "removed" : "would-remove", stats };
}

const resolvedRepoRoot = await realpath(repoRoot);
const resolvedTempRoot = await realpath(tempRoot);
if (!isInside(resolvedRepoRoot, resolvedTempRoot)) {
  throw new Error(`Refusing cleanup because .tmp escaped the repository: ${resolvedTempRoot}`);
}

const results = [];
for (const name of [...new Set(requestedNames)]) {
  const result = await inspectTarget(name, resolvedTempRoot);
  if (execute && result.status === "removed-link") {
    await unlink(result.target);
  } else if (execute && result.status === "removed") {
    await rm(result.target, {
      recursive: result.stats.isDirectory(),
      force: true,
      maxRetries: 20,
      retryDelay: 200,
    });
  }
  results.push({ name: result.name, path: result.target, status: result.status });
}

console.log(JSON.stringify({
  ok: true,
  mode: execute ? "execute" : "dry-run",
  repoRoot,
  tempRoot,
  targets: results,
}, null, 2));
