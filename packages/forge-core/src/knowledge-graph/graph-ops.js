/**
 * @fileoverview Graph operations extracted from KnowledgeGraph class.
 * Pure functions that operate on graph state (nodes, dependencies, dependents, edges).
 */

import path from 'node:path';

// ── Edge management ────────────────────────────────────────────────────────

/**
 * Record a directed edge from `from` -> `to`.
 *
 * @param {Map<string, Set<string>>} dependencies — adjacency list (forward)
 * @param {Map<string, Set<string>>} dependents   — adjacency list (reverse)
 * @param {Array<{from: string, to: string, type: string}>} edges — edge list
 * @param {string} from — importing file
 * @param {string} to   — imported file
 * @param {string} type — edge type ('imports' | 'extends' | 'uses')
 */
export function addEdge(dependencies, dependents, edges, from, to, type) {
  dependencies.get(from)?.add(to);
  dependents.get(to)?.add(from);
  edges.push({ from, to, type });
}

// ── Import resolution ──────────────────────────────────────────────────────

/**
 * Try to find a known file matching the candidate path, trying common
 * extensions and `/index` fallbacks.
 *
 * @param {string[]} supportedExtensions — list of extensions to try
 * @param {string}   candidate — normalised path (no extension)
 * @param {string[]} allFiles  — all indexed file paths
 * @returns {string|null}
 */
function matchFile(supportedExtensions, candidate, allFiles) {
  const extensions = ['', ...supportedExtensions];
  const suffixes = ['', '/index'];

  // Strip any existing extension
  const base = candidate.replace(/\.(js|ts|mjs|mts|cjs|jsx|tsx|json|vue|svelte|py|go|rs)$/, '');

  for (const suffix of suffixes) {
    for (const ext of extensions) {
      const attempt = base + suffix + ext;
      if (allFiles.includes(attempt)) {
        return attempt;
      }
    }
  }

  return null;
}

/**
 * Attempt to resolve an import specifier to a known file path.
 *
 * Resolution strategy:
 * 1. Skip bare specifiers (npm packages).
 * 2. For relative specifiers (`./foo`, `../bar`), resolve relative to the
 *    importing file's directory and try extension / index suffixes.
 * 3. For alias specifiers (`@/`, `~/`), strip the prefix and try under
 *    common source roots (`src/`, `lib/`, root).
 *
 * @param {Map<string, object>} nodes — all indexed nodes
 * @param {string[]} supportedExtensions — list of extensions to try
 * @param {string} specifier — raw import specifier
 * @param {string} fromFile  — the file containing the import
 * @returns {string|null} Resolved file path, or null
 */
export function resolveImport(nodes, supportedExtensions, specifier, fromFile) {
  // Skip bare / npm package specifiers
  if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('@') && !specifier.startsWith('~')) {
    // Handle Python-style dotted module paths (e.g., 'os.path', 'collections.abc')
    if (specifier.includes('.')) {
      const fromDir = path.dirname(fromFile);
      const asRelative = specifier.replace(/\./g, '/');
      const normalized = path.posix.normalize(path.posix.join(fromDir, asRelative));
      const match = matchFile(supportedExtensions, normalized, [...nodes.keys()]);
      if (match) return match;
    }
    return null;
  }

  const allFiles = [...nodes.keys()];

  // Handle Python-style relative imports (e.g., `from .utils import helper`)
  if (/^\.+\w/.test(specifier) && !specifier.includes('/')) {
    const fromDir = path.dirname(fromFile);
    const converted = specifier.replace(/\.+/g, (match) => match.replace(/\./g, '.') + '/').replace(/^\.\//, './');
    const pySpecifier = specifier.replace(/\./g, '/');
    const normalized = path.posix.normalize(path.posix.join(fromDir, pySpecifier));
    const match = matchFile(supportedExtensions, normalized, allFiles);
    if (match) return match;
  }

  // Handle path aliases: @/ or ~/
  if (/^[@~]\//.test(specifier)) {
    const normalized = specifier.replace(/^[@~]\//, '');
    for (const root of ['src', 'lib', '']) {
      const candidate = root ? `${root}/${normalized}` : normalized;
      const match = matchFile(supportedExtensions, candidate, allFiles);
      if (match) return match;
    }
    return null;
  }

  // Handle absolute paths
  if (specifier.startsWith('/')) {
    const normalized = specifier.slice(1);
    return matchFile(supportedExtensions, normalized, allFiles);
  }

  // Relative import: resolve relative to the importing file's directory
  const fromDir = path.dirname(fromFile);
  const normalized = path.posix.normalize(path.posix.join(fromDir, specifier));

  return matchFile(supportedExtensions, normalized, allFiles);
}

// ── Circular dependency detection ──────────────────────────────────────────

/**
 * Find all circular dependency chains in the graph using DFS.
 *
 * Each returned array is a cycle: the file paths forming the loop, with
 * the first element repeated at the end to close the ring.
 *
 * @param {Map<string, Set<string>>} dependencies — adjacency list (forward)
 * @returns {string[][]} Arrays of file paths forming cycles
 */
export function findCircularDependencies(dependencies) {
  /** @type {string[][]} */
  const cycles = [];
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {Set<string>} */
  const inStack = new Set();

  /**
   * DFS walk with path tracking.
   * @param {string} node
   * @param {string[]} currentPath
   */
  const dfs = (node, currentPath) => {
    if (inStack.has(node)) {
      // Found a cycle — extract it
      const cycleStart = currentPath.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push([...currentPath.slice(cycleStart), node]);
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    currentPath.push(node);

    const deps = dependencies.get(node) ?? new Set();
    for (const dep of deps) {
      dfs(dep, currentPath);
    }

    currentPath.pop();
    inStack.delete(node);
  };

  for (const file of dependencies.keys()) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  return cycles;
}

// ── Statistics ─────────────────────────────────────────────────────────────

/**
 * Compute graph statistics.
 *
 * @param {Map<string, object>} nodes — all indexed nodes
 * @param {Array<{from: string, to: string, type: string}>} edges — edge list
 * @param {Map<string, Set<string>>} dependencies — adjacency list (forward)
 * @returns {{ files: number, edges: number, exports: number, imports: number, classes: number, functions: number, circularDeps: number }}
 */
export function getStatus(nodes, edges, dependencies) {
  let totalExports = 0;
  let totalImports = 0;
  let totalClasses = 0;
  let totalFunctions = 0;

  for (const node of nodes.values()) {
    totalExports += node.exports.length;
    totalImports += node.imports.length;
    totalClasses += node.definitions.filter((d) => d.type === 'class').length;
    totalFunctions += node.definitions.filter((d) => d.type === 'function').length;
  }

  return {
    files: nodes.size,
    edges: edges.length,
    exports: totalExports,
    imports: totalImports,
    classes: totalClasses,
    functions: totalFunctions,
    circularDeps: findCircularDependencies(dependencies).length,
  };
}
