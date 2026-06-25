/**
 * @module dependency-graph-helpers
 * @description Pure helper functions extracted from DependencyGraph for
 * import resolution, cycle detection, topological sorting, and visualization.
 * All functions are stateless and receive data as parameters.
 */

import path from 'node:path';

/**
 * @typedef {Object} GraphEdge
 * @property {string} from     - Importing file (relative path)
 * @property {string} to       - Imported file (relative path)
 * @property {string} source   - Original import specifier text
 */

// ---------------------------------------------------------------------------
// Import resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to resolve an import specifier to a file that exists in the index.
 *
 * Resolution strategy:
 * 1. Skip bare specifiers (npm packages like 'express', 'lodash') -- they
 *    are not part of the local codebase.
 * 2. For relative specifiers (`./foo`, `../bar`), compute the absolute path
 *    relative to the importing file, then try to match against indexed files
 *    with various extensions and `/index` suffixes.
 * 3. For absolute or root-relative specifiers (`@/utils/foo`, `~/lib/bar`),
 *    strip common alias prefixes and try to match.
 *
 * @param {string} specifier - The raw import specifier
 * @param {string} fromFile  - The file that contains the import (relative path)
 * @param {string[]} allFiles - All indexed file paths
 * @returns {string|null} Resolved relative file path, or null
 */
export function resolveImport(specifier, fromFile, allFiles) {
  // Skip bare / npm package specifiers (no leading . or /)
  if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('@')) {
    return null;
  }

  // Handle path aliases: @/ or ~/ -> strip and try as relative to src/
  let normalized = specifier;
  if (/^[@~]\//.test(normalized)) {
    normalized = normalized.replace(/^[@~]\//, '');
    // Try under common source roots
    for (const root of ['src', 'lib', '']) {
      const candidate = root ? `${root}/${normalized}` : normalized;
      const match = matchFile(candidate, allFiles);
      if (match) return match;
    }
    return null;
  }

  // Handle absolute paths (unlikely in most projects but handle gracefully)
  if (specifier.startsWith('/')) {
    normalized = specifier.slice(1);
    return matchFile(normalized, allFiles);
  }

  // Relative import: resolve relative to the importing file's directory
  const fromDir = path.dirname(fromFile);
  normalized = path.posix.normalize(path.posix.join(fromDir, specifier));

  return matchFile(normalized, allFiles);
}

/**
 * Try to find an indexed file that matches the candidate path, trying
 * common extensions and `/index` fallbacks.
 *
 * @param {string} candidate - Normalized path (forward slashes, no extension)
 * @param {string[]} allFiles - All indexed file paths
 * @returns {string|null}
 */
export function matchFile(candidate, allFiles) {
  const extensions = ['', '.js', '.ts', '.mjs', '.mts', '.cjs', '.jsx', '.tsx', '.json'];
  const suffixes = ['', '/index'];

  // Normalize the candidate: strip any existing extension
  const base = candidate.replace(/\.(js|ts|mjs|mts|cjs|jsx|tsx|json)$/, '');

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

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

/**
 * Find all circular dependency chains in the graph.
 *
 * Uses DFS with cycle detection. Returns arrays of file paths forming
 * each detected cycle.
 *
 * @param {Map<string, Set<string>>} dependencies - file -> set of files it imports
 * @param {(file: string) => string[]} getDeps - Function to get dependencies of a file
 * @returns {string[][]} Array of cycles, where each cycle is an array of file paths
 */
export function findCycles(dependencies, getDeps) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();

  /**
   * @param {string} node
   * @param {string[]} currentPath
   */
  const dfs = (node, currentPath) => {
    if (inStack.has(node)) {
      // Found a cycle: extract it
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

    for (const dep of getDeps(node)) {
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

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

/**
 * Compute a topological ordering of the graph.
 * Files with no dependencies come first.
 *
 * @param {Map<string, Set<string>>} dependencies - file -> set of files it imports
 * @param {(file: string) => string[]} getDependentsFn - Function to get dependents
 * @param {(file: string) => string[]} getDepsFn - Function to get dependencies
 * @returns {{ ordered: string[], hasCycles: boolean }}
 */
export function topologicalSort(dependencies, getDependentsFn, getDepsFn) {
  const ordered = [];
  const processed = new Set();

  // Start with nodes that have zero dependencies
  const queue = [];
  for (const [file, deps] of dependencies) {
    if (deps.size === 0) {
      queue.push(file);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (processed.has(current)) continue;
    processed.add(current);
    ordered.push(current);

    // For each file that depends on `current`, decrement its dependency count
    for (const dependent of getDependentsFn(current)) {
      const remaining = getDepsFn(dependent).filter(
        (d) => !processed.has(d),
      );
      if (remaining.length === 0 && !processed.has(dependent)) {
        queue.push(dependent);
      }
    }
  }

  // Add any remaining unprocessed files (part of cycles)
  for (const file of dependencies.keys()) {
    if (!processed.has(file)) {
      ordered.push(file);
    }
  }

  return {
    ordered,
    hasCycles: ordered.length !== dependencies.size || processed.size !== dependencies.size,
  };
}

// ---------------------------------------------------------------------------
// Visualization: Mermaid
// ---------------------------------------------------------------------------

/**
 * Generate a Mermaid flowchart representation of the dependency graph.
 *
 * @param {GraphEdge[]} edges
 * @param {Map<string, Set<string>>} dependencies
 * @param {{ maxNodes?: number, highlightFiles?: string[] }} [options]
 * @returns {string} Mermaid diagram source
 */
export function toMermaid(edges, dependencies, options = {}) {
  const { maxNodes = 100, highlightFiles = [] } = options;
  const highlightSet = new Set(highlightFiles);
  const lines = ['flowchart TD'];

  // Assign short IDs to files
  const fileIds = new Map();
  let idCounter = 0;

  const getId = (file) => {
    if (!fileIds.has(file)) {
      fileIds.set(file, `F${idCounter++}`);
    }
    return fileIds.get(file);
  };

  // Limit the number of nodes to keep the diagram readable
  const filesToInclude = new Set();
  let edgeCount = 0;

  for (const edge of edges) {
    if (edgeCount >= maxNodes) break;
    filesToInclude.add(edge.from);
    filesToInclude.add(edge.to);
    edgeCount++;
  }

  // If no edges, include all files as isolated nodes
  if (edges.length === 0) {
    for (const file of dependencies.keys()) {
      if (filesToInclude.size >= maxNodes) break;
      filesToInclude.add(file);
    }
  }

  // Node declarations with labels
  for (const file of filesToInclude) {
    const id = getId(file);
    const label = path.basename(file);
    const isHighlighted = highlightSet.has(file);
    if (isHighlighted) {
      lines.push(`    ${id}["${label}"]:::changed`);
    } else {
      lines.push(`    ${id}["${label}"]`);
    }
  }

  lines.push('');

  // Edges
  for (const edge of edges) {
    if (!filesToInclude.has(edge.from) || !filesToInclude.has(edge.to)) continue;
    const fromId = getId(edge.from);
    const toId = getId(edge.to);
    lines.push(`    ${fromId} --> ${toId}`);
  }

  // Style for highlighted nodes
  if (highlightSet.size > 0) {
    lines.push('');
    lines.push('    classDef changed fill:#ff6b6b,stroke:#c92a2a,color:#fff');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Visualization: DOT
// ---------------------------------------------------------------------------

/**
 * Generate a DOT format graph (for Graphviz).
 *
 * @param {GraphEdge[]} edges
 * @param {{ highlightFiles?: string[] }} [options]
 * @returns {string}
 */
export function toDot(edges, options = {}) {
  const { highlightFiles = [] } = options;
  const highlightSet = new Set(highlightFiles);
  const lines = ['digraph dependencies {', '  rankdir=LR;', '  node [shape=box, fontsize=10];'];

  for (const edge of edges) {
    const fromLabel = path.basename(edge.from);
    const toLabel = path.basename(edge.to);
    const fromColor = highlightSet.has(edge.from) ? 'red' : 'black';
    const toColor = highlightSet.has(edge.to) ? 'red' : 'black';

    lines.push(`  "${edge.from}" [label="${fromLabel}", fontcolor="${fromColor}"];`);
    lines.push(`  "${edge.to}" [label="${toLabel}", fontcolor="${toColor}"];`);
    lines.push(`  "${edge.from}" -> "${edge.to}";`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable text summary of the graph.
 *
 * @param {Map<string, Set<string>>} dependencies
 * @param {Map<string, Set<string>>} dependents
 * @param {number} edgeCount
 * @param {() => string[][]} findCyclesFn
 * @returns {string}
 */
export function toSummary(dependencies, dependents, edgeCount, findCyclesFn) {
  const lines = [];
  lines.push(`# Dependency Graph Summary`);
  lines.push('');
  lines.push(`- **Nodes (files)**: ${dependencies.size}`);
  lines.push(`- **Edges (imports)**: ${edgeCount}`);

  // Compute some statistics
  const depCounts = [];
  const dependentCounts = [];

  for (const [file, deps] of dependencies) {
    depCounts.push({ file, count: deps.size });
  }
  for (const [file, deps] of dependents) {
    dependentCounts.push({ file, count: deps.size });
  }

  // Most depended-upon files (highest number of dependents)
  dependentCounts.sort((a, b) => b.count - a.count);
  const topDependedUpon = dependentCounts.filter((d) => d.count > 0).slice(0, 10);

  if (topDependedUpon.length > 0) {
    lines.push('');
    lines.push('## Most Depended-Upon Files');
    for (const { file, count } of topDependedUpon) {
      lines.push(`- **${file}** (${count} dependents)`);
    }
  }

  // Files with most dependencies
  depCounts.sort((a, b) => b.count - a.count);
  const topDeps = depCounts.filter((d) => d.count > 0).slice(0, 10);

  if (topDeps.length > 0) {
    lines.push('');
    lines.push('## Files With Most Dependencies');
    for (const { file, count } of topDeps) {
      lines.push(`- **${file}** (imports ${count} files)`);
    }
  }

  // Circular dependencies
  const cycles = findCyclesFn();
  if (cycles.length > 0) {
    lines.push('');
    lines.push(`## Circular Dependencies (${cycles.length} detected)`);
    for (const cycle of cycles.slice(0, 5)) {
      lines.push(`- ${cycle.join(' -> ')}`);
    }
    if (cycles.length > 5) {
      lines.push(`- ... and ${cycles.length - 5} more cycles`);
    }
  }

  // Isolated files (no dependencies and no dependents)
  const isolated = [];
  for (const [file, deps] of dependencies) {
    const dependentsOf = dependents.get(file);
    if (deps.size === 0 && (!dependentsOf || dependentsOf.size === 0)) {
      isolated.push(file);
    }
  }

  if (isolated.length > 0) {
    lines.push('');
    lines.push(`## Isolated Files (${isolated.length})`);
    for (const file of isolated.slice(0, 10)) {
      lines.push(`- ${file}`);
    }
    if (isolated.length > 10) {
      lines.push(`- ... and ${isolated.length - 10} more`);
    }
  }

  return lines.join('\n');
}
