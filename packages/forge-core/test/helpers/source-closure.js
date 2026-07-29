import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const closureCache = new Map();
const localModulePattern =
  /\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["'](\.[^"']+)["']/g;

function isWithinRoot(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function resolveLocalModule(importerPath, specifier, sourceRoot) {
  const base = resolve(dirname(importerPath), specifier);
  const candidates = extname(base)
    ? [base]
    : [base, `${base}.js`, `${base}.mjs`, join(base, "index.js")];
  return candidates.find(
    (candidate) =>
      isWithinRoot(sourceRoot, candidate) &&
      existsSync(candidate) &&
      [".js", ".mjs", ".cjs"].includes(extname(candidate)),
  );
}

export function readModuleClosure(entryPath, sourceRoot) {
  const root = resolve(sourceRoot);
  const entry = resolve(entryPath);
  if (!isWithinRoot(root, entry)) {
    throw new Error(`Source entry is outside the configured root: ${entry}`);
  }

  const cacheKey = `${root}\0${entry}`;
  if (closureCache.has(cacheKey)) return closureCache.get(cacheKey);

  const visited = new Set();
  const chunks = [];

  function visit(filePath) {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(localModulePattern)) {
      const dependency = resolveLocalModule(filePath, match[1], root);
      if (dependency) visit(dependency);
    }

    chunks.push(`\n/* source: ${relative(root, filePath).split(sep).join("/")} */\n${source}`);
  }

  visit(entry);
  const closure = chunks.join("\n");
  closureCache.set(cacheKey, closure);
  return closure;
}

export function createSourceReader(sourceRoot) {
  const root = resolve(sourceRoot);
  return function readSource(filePath, encoding = "utf8") {
    const target = resolve(filePath);
    if (
      isWithinRoot(root, target) &&
      [".js", ".mjs", ".cjs"].includes(extname(target))
    ) {
      return readModuleClosure(target, root);
    }
    return readFileSync(target, encoding);
  };
}
