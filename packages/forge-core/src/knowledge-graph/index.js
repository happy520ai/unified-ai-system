/**
 * Knowledge Graph — lightweight, regex-based code knowledge graph.
 *
 * Parses project files to build a dependency map capturing:
 *   - File-level import/export relationships (ESM + CJS)
 *   - Class, function, and const definitions
 *   - Transitive impact analysis for change propagation
 *   - Circular dependency detection via DFS
 *
 * Unlike the AST-based {@link DependencyGraph}, this module intentionally
 * avoids heavy parsers — it uses regex heuristics so it can index thousands
 * of files in milliseconds with zero external dependencies.
 *
 * Usage:
 *   const graph = new KnowledgeGraph();
 *   graph.addFile('src/utils.js', fs.readFileSync('src/utils.js', 'utf8'));
 *   graph.addFile('src/app.js',   fs.readFileSync('src/app.js',   'utf8'));
 *   const impact = graph.getImpactAnalysis(['src/utils.js']);
 *   console.log(impact.total);   // all transitively affected files
 */

import {
  DEFAULT_EXTENSIONS,
  DEFAULT_MAX_DEPTH,
  detectLanguage,
  isTestFile,
  isConfigFile,
  isSourceFile,
} from './constants.js';
import {
  parseJsImports,
  parseJsExports,
  parseJsDefinitions,
  parsePython,
  parseGo,
  parseRust,
} from './parsers.js';
import {
  addEdge,
  resolveImport,
  findCircularDependencies,
  getStatus as computeStatus,
} from './graph-ops.js';

// ── KnowledgeGraph class ──────────────────────────────────────────────────

/**
 * A code knowledge graph that automatically parses project files to build a
 * dependency map capturing file-level, class-level, and function-level
 * import/export relationships.
 *
 * @example
 * ```js
 * const graph = new KnowledgeGraph();
 * graph.addFile('src/utils.js', fs.readFileSync('src/utils.js', 'utf8'));
 * const deps = graph.getDependents('src/utils.js');
 * ```
 */
export class KnowledgeGraph {
  /** @type {Map<string, GraphNode>} filePath -> node metadata */
  #nodes;

  /** @type {Map<string, Set<string>>} file -> set of files it imports (upstream) */
  #dependencies;

  /** @type {Map<string, Set<string>>} file -> set of files that import it (downstream) */
  #dependents;

  /** @type {GraphEdge[]} All resolved edges in the graph */
  #edges;

  /** @type {number} Maximum traversal depth for transitive operations */
  #maxDepth;

  /** @type {string[]} File extensions considered for path resolution */
  #supportedExtensions;

  /**
   * Create a new KnowledgeGraph.
   *
   * @param {object} [opts]
   * @param {number}   [opts.maxDepth=10] — maximum depth for transitive impact traversal
   * @param {string[]} [opts.supportedExtensions] — file extensions to try during path resolution
   */
  constructor(opts = {}) {
    this.#nodes = new Map();
    this.#dependencies = new Map();
    this.#dependents = new Map();
    this.#edges = [];
    this.#maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.#supportedExtensions = opts.supportedExtensions ?? [...DEFAULT_EXTENSIONS];
  }

  // ── File management ───────────────────────────────────────────────────

  /**
   * Parse a single file and add its relationships to the graph.
   *
   * The content is scanned with regex patterns to extract imports, exports,
   * and definitions. An adjacency-list edge is created for every resolved
   * import that points to an already-indexed file.
   *
   * @param {string} filePath — absolute or project-relative file path
   * @param {string} content  — full file source text
   * @returns {{ exports: ExportInfo[], imports: ImportInfo[], classes: DefinitionInfo[], functions: DefinitionInfo[] }}
   */
  addFile(filePath, content) {
    // Remove previous version of this file if re-adding
    if (this.#nodes.has(filePath)) {
      this.removeFile(filePath);
    }

    const language = detectLanguage(filePath, content);
    let exports, imports, definitions;

    switch (language) {
      case 'python':
      case 'go':
      case 'rust': {
        const parsed = language === 'python' ? parsePython(content)
          : language === 'go' ? parseGo(content)
          : parseRust(content);
        exports = parsed.exports;
        imports = parsed.imports;
        definitions = parsed.definitions;
        break;
      }
      default: {
        // JS/TS — existing line-based parsing
        const lines = content.split('\n');
        exports = parseJsExports(lines);
        imports = parseJsImports(lines);
        definitions = parseJsDefinitions(lines);
      }
    }

    /** @type {GraphNode} */
    const node = {
      path: filePath,
      exports,
      imports,
      definitions,
      lastModified: Date.now(),
    };

    this.#nodes.set(filePath, node);
    this.#dependencies.set(filePath, new Set());
    this.#dependents.set(filePath, new Set());

    // Resolve imports and create edges to known files
    for (const imp of imports) {
      const resolved = resolveImport(this.#nodes, this.#supportedExtensions, imp.source, filePath);
      if (resolved && this.#nodes.has(resolved)) {
        addEdge(this.#dependencies, this.#dependents, this.#edges, filePath, resolved, 'imports');
      }
    }

    // Check if any already-indexed file imports this new file
    for (const [otherPath, otherNode] of this.#nodes) {
      if (otherPath === filePath) continue;
      for (const imp of otherNode.imports) {
        const resolved = resolveImport(this.#nodes, this.#supportedExtensions, imp.source, otherPath);
        if (resolved === filePath) {
          addEdge(this.#dependencies, this.#dependents, this.#edges, otherPath, filePath, 'imports');
        }
      }
    }

    const classes = definitions.filter((d) => d.type === 'class');
    const functions = definitions.filter((d) => d.type === 'function');

    return { exports, imports, classes, functions };
  }

  /**
   * Remove a file and all its edges from the graph.
   *
   * @param {string} filePath — file path to remove
   * @returns {boolean} — true if the file existed and was removed
   */
  removeFile(filePath) {
    if (!this.#nodes.has(filePath)) return false;

    // Remove edges where this file is the importer
    const deps = this.#dependencies.get(filePath) ?? new Set();
    for (const dep of deps) {
      this.#dependents.get(dep)?.delete(filePath);
    }

    // Remove edges where this file is imported
    const depnts = this.#dependents.get(filePath) ?? new Set();
    for (const dep of depnts) {
      this.#dependencies.get(dep)?.delete(filePath);
    }

    // Remove edges from the edge list
    this.#edges = this.#edges.filter((e) => e.from !== filePath && e.to !== filePath);

    // Clean up maps
    this.#nodes.delete(filePath);
    this.#dependencies.delete(filePath);
    this.#dependents.delete(filePath);

    return true;
  }

  // ── Dependency queries ────────────────────────────────────────────────

  /**
   * Get all files that directly depend on (import) the given file.
   *
   * @param {string} filePath — file to query
   * @returns {string[]} Array of files that import `filePath`
   */
  getDependents(filePath) {
    return [...(this.#dependents.get(filePath) ?? [])];
  }

  /**
   * Get all files that the given file directly depends on (imports).
   *
   * @param {string} filePath — file to query
   * @returns {string[]} Array of files that `filePath` imports
   */
  getDependencies(filePath) {
    return [...(this.#dependencies.get(filePath) ?? [])];
  }

  /**
   * Perform a full transitive impact analysis for a set of changed files.
   *
   * Uses BFS from each changed file, following dependent (reverse) edges up
   * to {@link #maxDepth} levels. Results are categorised into direct
   * (depth 1), indirect (depth > 1), and total (all depths combined).
   *
   * @param {string[]} filePaths — array of changed file paths
   * @returns {{ direct: string[], indirect: string[], total: string[], byType: { source: string[], test: string[], config: string[] } }}
   */
  getImpactAnalysis(filePaths) {
    /** @type {Set<string>} */
    const visited = new Set();
    /** @type {Set<string>} */
    const directSet = new Set();

    // BFS queue entries: [file, depth]
    /** @type {[string, number][]} */
    const queue = [];

    for (const root of filePaths) {
      visited.add(root);
      for (const dep of this.getDependents(root)) {
        if (!visited.has(dep)) {
          queue.push([dep, 1]);
        }
      }
    }

    while (queue.length > 0) {
      const [current, depth] = queue.shift();

      if (visited.has(current)) continue;
      if (depth > this.#maxDepth) continue;
      visited.add(current);

      if (depth === 1) {
        directSet.add(current);
      }

      for (const dep of this.getDependents(current)) {
        if (!visited.has(dep)) {
          queue.push([dep, depth + 1]);
        }
      }
    }

    // Remove the changed files themselves from the result sets
    const changedSet = new Set(filePaths);
    const direct = [...directSet].filter((f) => !changedSet.has(f));
    const indirect = [...visited].filter((f) => !directSet.has(f) && !changedSet.has(f));
    const total = [...direct, ...indirect];

    // Categorise by file type
    const byType = {
      source: total.filter((f) => isSourceFile(f)),
      test: total.filter((f) => isTestFile(f)),
      config: total.filter((f) => isConfigFile(f)),
    };

    return { direct, indirect, total, byType };
  }

  // ── Metadata queries ──────────────────────────────────────────────────

  /**
   * Get the exports of a file.
   *
   * @param {string} filePath
   * @returns {ExportInfo[]}
   */
  getExports(filePath) {
    return [...(this.#nodes.get(filePath)?.exports ?? [])];
  }

  /**
   * Get the imports of a file.
   *
   * @param {string} filePath
   * @returns {ImportInfo[]}
   */
  getImports(filePath) {
    return [...(this.#nodes.get(filePath)?.imports ?? [])];
  }

  /**
   * Get classes, functions, and consts defined in a file.
   *
   * @param {string} filePath
   * @returns {DefinitionInfo[]}
   */
  getDefinitions(filePath) {
    return [...(this.#nodes.get(filePath)?.definitions ?? [])];
  }

  // ── Bulk operations ───────────────────────────────────────────────────

  /**
   * Build the graph from multiple files at once.
   *
   * Files are added sequentially so that import resolution can reference
   * previously indexed files. Returns a summary of what was parsed.
   *
   * @param {Array<{ path: string, content: string }>} files
   * @returns {{ files: number, edges: number, exports: number, errors: Array<{ path: string, error: string }> }}
   */
  buildFromFiles(files) {
    let totalExports = 0;
    const errors = [];

    for (const file of files) {
      try {
        const result = this.addFile(file.path, file.content);
        totalExports += result.exports.length;
      } catch (err) {
        errors.push({ path: file.path, error: err.message });
      }
    }

    return {
      files: this.#nodes.size,
      edges: this.#edges.length,
      exports: totalExports,
      errors,
    };
  }

  /**
   * Get the complete graph as a serializable object.
   *
   * @returns {{ nodes: GraphNode[], edges: GraphEdge[], stats: object }}
   */
  getGraph() {
    const nodes = [...this.#nodes.values()];
    const edges = [...this.#edges];

    return {
      nodes,
      edges,
      stats: this.getStatus(),
    };
  }

  // ── Circular dependency detection ─────────────────────────────────────

  /**
   * Find all circular dependency chains in the graph using DFS.
   *
   * Each returned array is a cycle: the file paths forming the loop, with
   * the first element repeated at the end to close the ring.
   *
   * @returns {string[][]} Arrays of file paths forming cycles
   */
  findCircularDependencies() {
    return findCircularDependencies(this.#dependencies);
  }

  // ── Statistics ────────────────────────────────────────────────────────

  /**
   * Get graph statistics.
   *
   * @returns {{ files: number, edges: number, exports: number, imports: number, classes: number, functions: number, circularDeps: number }}
   */
  getStatus() {
    return computeStatus(this.#nodes, this.#edges, this.#dependencies);
  }

  /**
   * Clear the entire graph, removing all nodes, edges, and metadata.
   */
  clear() {
    this.#nodes.clear();
    this.#dependencies.clear();
    this.#dependents.clear();
    this.#edges = [];
  }

  // ── Persistence ───────────────────────────────────────────────────────

  /**
   * Export the full graph state for persistence.
   *
   * The returned object is JSON-serializable and can be stored to disk,
   * then later restored with {@link importState}.
   *
   * @returns {{ nodes: Array<[string, GraphNode]>, edges: GraphEdge[], maxDepth: number, supportedExtensions: string[] }}
   */
  exportState() {
    return {
      nodes: [...this.#nodes.entries()],
      edges: [...this.#edges],
      maxDepth: this.#maxDepth,
      supportedExtensions: [...this.#supportedExtensions],
    };
  }

  /**
   * Import a previously exported state, replacing the current graph.
   *
   * @param {object} state — object returned by {@link exportState}
   */
  importState(state) {
    // Validate state before destroying current graph (prevents data-loss on invalid input)
    if (!state || !Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
      throw new TypeError('importState requires a valid state object with nodes[] and edges[]');
    }

    this.clear();

    this.#maxDepth = state.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.#supportedExtensions = state.supportedExtensions ?? [...DEFAULT_EXTENSIONS];

    // Restore nodes
    for (const [filePath, node] of state.nodes) {
      this.#nodes.set(filePath, node);
      this.#dependencies.set(filePath, new Set());
      this.#dependents.set(filePath, new Set());
    }

    // Restore edges and rebuild adjacency lists
    for (const edge of state.edges) {
      this.#edges.push(edge);
      this.#dependencies.get(edge.from)?.add(edge.to);
      this.#dependents.get(edge.to)?.add(edge.from);
    }
  }

}
