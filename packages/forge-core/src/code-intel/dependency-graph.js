/**
 * @module dependency-graph
 * @description Builds and queries a dependency graph from a {@link CodebaseIndex}.
 * Resolves relative import specifiers to indexed file paths, then provides
 * fast lookups for both forward (dependencies) and reverse (dependents) edges,
 * including transitive closure computation for impact analysis.
 *
 * Heavy algorithms (resolution, cycles, topo sort, visualization) are
 * delegated to `dependency-graph-helpers.js`.
 */

import {
  resolveImport,
  findCycles as findCyclesHelper,
  topologicalSort as topologicalSortHelper,
  toMermaid as toMermaidHelper,
  toDot as toDotHelper,
  toSummary as toSummaryHelper,
} from './dependency-graph-helpers.js';

/**
 * @typedef {Object} GraphEdge
 * @property {string} from     - Importing file (relative path)
 * @property {string} to       - Imported file (relative path)
 * @property {string} source   - Original import specifier text
 */

/**
 * Directed dependency graph over a parsed codebase.
 *
 * - **dependencies** of file X = files that X imports.
 * - **dependents** of file X = files that import X.
 *
 * @example
 * ```js
 * const graph = new DependencyGraph(codebaseIndex);
 * const affected = graph.getDependents('src/utils/logger.js');
 * const chain    = graph.getImpactChain(['src/utils/logger.js', 'src/config.js']);
 * ```
 */
export class DependencyGraph {
  /** @type {import('./codebase-index.js').CodebaseIndex} */
  #index;

  /** @type {Map<string, Set<string>>} file -> set of files it imports */
  #dependencies;

  /** @type {Map<string, Set<string>>} file -> set of files that import it */
  #dependents;

  /** @type {GraphEdge[]} All resolved edges */
  #edges;

  /**
   * @param {import('./codebase-index.js').CodebaseIndex} codebaseIndex
   */
  constructor(codebaseIndex) {
    this.#index = codebaseIndex;
    this.#dependencies = new Map();
    this.#dependents = new Map();
    this.#edges = [];

    this.#buildGraph();
  }

  // ---------------------------------------------------------------------------
  // Graph construction
  // ---------------------------------------------------------------------------

  /**
   * Walk every file in the index, resolve each of its imports to an indexed
   * file, and populate the adjacency maps.
   */
  #buildGraph() {
    const allFiles = this.#index.getAllFiles();

    // Ensure every file has an entry even if it has no edges
    for (const file of allFiles) {
      this.#dependencies.set(file, new Set());
      this.#dependents.set(file, new Set());
    }

    for (const file of allFiles) {
      const parsed = this.#index.getFile(file);
      if (!parsed) continue;

      for (const imp of parsed.imports) {
        const resolved = resolveImport(imp.source, file, allFiles);
        if (resolved && allFiles.includes(resolved)) {
          this.#addEdge(file, resolved, imp.source);
        }
      }
    }
  }

  /**
   * Record a directed edge from `from` -> `to`.
   * @param {string} from
   * @param {string} to
   * @param {string} source
   */
  #addEdge(from, to, source) {
    this.#dependencies.get(from)?.add(to);
    this.#dependents.get(to)?.add(from);
    this.#edges.push({ from, to, source });
  }

  // ---------------------------------------------------------------------------
  // Query API
  // ---------------------------------------------------------------------------

  /**
   * Get files that **directly import** the given file.
   *
   * @param {string} filePath - Relative file path
   * @returns {string[]} Array of files that import `filePath`
   */
  getDependents(filePath) {
    return [...(this.#dependents.get(filePath) ?? [])];
  }

  /**
   * Get files that the given file **directly imports**.
   *
   * @param {string} filePath - Relative file path
   * @returns {string[]} Array of files that `filePath` imports
   */
  getDependencies(filePath) {
    return [...(this.#dependencies.get(filePath) ?? [])];
  }

  /**
   * Compute the full transitive impact chain for a set of changed files.
   *
   * Performs a breadth-first traversal of the reverse dependency graph
   * starting from every changed file, collecting all files that are
   * directly or transitively affected.
   *
   * @param {string[]} changedFiles - Relative paths of modified files
   * @returns {{
   *   directDependents: string[],
   *   transitiveDependents: string[],
   *   chain: Map<string, string[]>,
   *   maxDepth: number
   * }}
   */
  getImpactChain(changedFiles) {
    /** @type {Set<string>} */
    const visited = new Set();
    /** @type {Set<string>} */
    const directSet = new Set();
    /** @type {Map<string, string[]>} file -> path from root to this file */
    const chain = new Map();

    let maxDepth = 0;

    // BFS queue entries: [file, depth, pathFromRoot]
    /** @type {[string, number, string[]][]} */
    const queue = [];

    for (const root of changedFiles) {
      visited.add(root);
      for (const dep of this.getDependents(root)) {
        if (!visited.has(dep)) {
          queue.push([dep, 1, [root, dep]]);
        }
      }
    }

    while (queue.length > 0) {
      const [current, depth, pathFromRoot] = queue.shift();

      if (visited.has(current)) continue;
      visited.add(current);

      if (depth === 1) {
        directSet.add(current);
      }

      chain.set(current, pathFromRoot);
      if (depth > maxDepth) maxDepth = depth;

      for (const dep of this.getDependents(current)) {
        if (!visited.has(dep)) {
          queue.push([dep, depth + 1, [...pathFromRoot, dep]]);
        }
      }
    }

    const directDependents = [...directSet];
    const transitiveDependents = [...visited]
      .filter((f) => !directSet.has(f) && !changedFiles.includes(f));

    return {
      directDependents,
      transitiveDependents,
      chain,
      maxDepth,
    };
  }

  /**
   * Get all resolved edges in the graph.
   * @returns {GraphEdge[]}
   */
  getEdges() {
    return [...this.#edges];
  }

  /**
   * Get the total number of resolved dependency edges.
   * @returns {number}
   */
  get edgeCount() {
    return this.#edges.length;
  }

  /**
   * Get the total number of files in the graph.
   * @returns {number}
   */
  get nodeCount() {
    return this.#dependencies.size;
  }

  /**
   * Find all circular dependency chains in the graph.
   * @returns {string[][]} Array of cycles, where each cycle is an array of file paths
   */
  findCycles() {
    return findCyclesHelper(this.#dependencies, (node) => this.getDependencies(node));
  }

  /**
   * Compute a topological ordering of the graph.
   * Files with no dependencies come first.
   *
   * @returns {{ ordered: string[], hasCycles: boolean }}
   */
  topologicalSort() {
    return topologicalSortHelper(
      this.#dependencies,
      (file) => this.getDependents(file),
      (file) => this.getDependencies(file),
    );
  }

  // ---------------------------------------------------------------------------
  // Visualization
  // ---------------------------------------------------------------------------

  /**
   * Generate a Mermaid flowchart representation of the dependency graph.
   *
   * @param {{ maxNodes?: number, highlightFiles?: string[] }} [options]
   * @returns {string} Mermaid diagram source
   */
  toMermaid(options = {}) {
    return toMermaidHelper(this.#edges, this.#dependencies, options);
  }

  /**
   * Generate a DOT format graph (for Graphviz).
   *
   * @param {{ highlightFiles?: string[] }} [options]
   * @returns {string}
   */
  toDot(options = {}) {
    return toDotHelper(this.#edges, options);
  }

  /**
   * Generate a human-readable text summary of the graph.
   *
   * @returns {string}
   */
  toSummary() {
    return toSummaryHelper(
      this.#dependencies,
      this.#dependents,
      this.#edges.length,
      () => this.findCycles(),
    );
  }
}
