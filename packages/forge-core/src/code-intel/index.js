/**
 * @module code-intel
 * @description Main entry point for the Code Intelligence layer.
 *
 * Provides a unified {@link CodeIntelligence} facade that orchestrates AST
 * parsing, dependency graph construction, and impact analysis. This is the
 * primary public API consumed by the rest of the Forge system.
 *
 * @example
 * ```js
 * import { CodeIntelligence } from './code-intel/index.js';
 *
 * const intel = new CodeIntelligence();
 *
 * // Full project analysis
 * await intel.analyze('/path/to/project');
 *
 * // Get an LLM-friendly summary
 * const summary = intel.getCodebaseSummary();
 *
 * // Impact report for changed files
 * const report = intel.getImpactReport(['src/utils/auth.js']);
 * console.log(report.riskLevel);   // 'medium'
 * console.log(report.summary);
 * ```
 */

import { ASTParser } from './ast-parser.js';
import { CodebaseIndex } from './codebase-index.js';
import { DependencyGraph } from './dependency-graph.js';
import { ImpactAnalyzer } from './impact-analyzer.js';

// Re-export all sub-modules for consumers that need fine-grained access
export { ASTParser } from './ast-parser.js';
export { CodebaseIndex } from './codebase-index.js';
export { DependencyGraph } from './dependency-graph.js';
export { ImpactAnalyzer } from './impact-analyzer.js';

/**
 * @typedef {Object} AnalysisResult
 * @property {CodebaseIndex} index        - The parsed codebase index
 * @property {DependencyGraph} graph      - The resolved dependency graph
 * @property {ImpactAnalyzer} analyzer    - A ready-to-use impact analyzer
 * @property {string} summary             - LLM-friendly codebase summary
 * @property {number} fileCount           - Total files parsed
 * @property {number} edgeCount           - Total dependency edges resolved
 * @property {{ file: string, error: string }[]} errors - Files that failed to parse
 */

/**
 * High-level facade for the Code Intelligence layer.
 *
 * Manages the lifecycle of parsing, indexing, graph construction, and
 * impact analysis. Maintains internal state so that repeated queries
 * (e.g. multiple impact reports) reuse the same parsed data.
 */
export class CodeIntelligence {
  /** @type {ASTParser} */
  #parser;

  /** @type {CodebaseIndex|null} */
  #index = null;

  /** @type {DependencyGraph|null} */
  #graph = null;

  /** @type {ImpactAnalyzer|null} */
  #analyzer = null;

  /** @type {string|null} */
  #projectRoot = null;

  /** @type {AnalysisResult|null} */
  #lastResult = null;

  constructor() {
    this.#parser = new ASTParser();
  }

  // ---------------------------------------------------------------------------
  // Primary API
  // ---------------------------------------------------------------------------

  /**
   * Perform a full analysis of a project directory.
   *
   * This parses all source files, builds the symbol index, constructs
   * the dependency graph, and prepares the impact analyzer. Subsequent
   * calls to {@link getImpactReport} and {@link getCodebaseSummary}
   * reuse the cached results.
   *
   * @param {string} projectRoot - Absolute path to the project root
   * @param {{ patterns?: string[], ignore?: string[] }} [options]
   * @returns {Promise<AnalysisResult>}
   *
   * @throws {Error} If the project root does not exist or is not a directory
   */
  async analyze(projectRoot, options = {}) {
    // Parse the project
    this.#index = await this.#parser.parseProject(projectRoot, options);
    this.#projectRoot = projectRoot;

    // Build the dependency graph
    this.#graph = new DependencyGraph(this.#index);

    // Prepare the impact analyzer
    this.#analyzer = new ImpactAnalyzer(this.#index, this.#graph);

    // Generate the summary
    const summary = this.#index.toSummary();

    const errors = this.#index._parseErrors ?? [];

    this.#lastResult = {
      index: this.#index,
      graph: this.#graph,
      analyzer: this.#analyzer,
      summary,
      fileCount: this.#index.size,
      edgeCount: this.#graph.edgeCount,
      errors,
    };

    return this.#lastResult;
  }

  /**
   * Generate an impact report for a set of changed files.
   *
   * Requires that {@link analyze} has been called first.
   *
   * @param {string[]} changedFiles - Relative paths of changed files
   * @returns {import('./impact-analyzer.js').ImpactReport}
   *
   * @throws {Error} If analyze() has not been called yet
   */
  getImpactReport(changedFiles) {
    this.#ensureAnalyzed();
    return this.#analyzer.analyze(changedFiles);
  }

  /**
   * Generate an impact report with optional Mermaid visualization.
   *
   * @param {string[]} changedFiles
   * @param {{ includeMermaid?: boolean }} [options]
   * @returns {import('./impact-analyzer.js').ImpactReport & { mermaid?: string }}
   */
  getImpactReportWithVisualization(changedFiles, options = {}) {
    this.#ensureAnalyzed();
    return this.#analyzer.analyzeWithVisualization(changedFiles, options);
  }

  /**
   * Check whether changing the given files would require running tests.
   *
   * @param {string[]} changedFiles
   * @returns {{ needsTests: boolean, testFiles: string[], reason: string }}
   */
  shouldRunTests(changedFiles) {
    this.#ensureAnalyzed();
    return this.#analyzer.shouldRunTests(changedFiles);
  }

  /**
   * Get an LLM-friendly summary of the codebase.
   *
   * @param {{ maxFiles?: number, maxSymbolsPerFile?: number }} [options]
   * @returns {string}
   */
  getCodebaseSummary(options = {}) {
    this.#ensureAnalyzed();
    return this.#index.toSummary(options);
  }

  /**
   * Get a summary of the dependency graph.
   * @returns {string}
   */
  getGraphSummary() {
    this.#ensureAnalyzed();
    return this.#graph.toSummary();
  }

  /**
   * Get a Mermaid diagram of the dependency graph.
   *
   * @param {{ maxNodes?: number, highlightFiles?: string[] }} [options]
   * @returns {string}
   */
  getDependencyMermaid(options = {}) {
    this.#ensureAnalyzed();
    return this.#graph.toMermaid(options);
  }

  // ---------------------------------------------------------------------------
  // Accessors for internal components (advanced usage)
  // ---------------------------------------------------------------------------

  /**
   * Get the underlying codebase index.
   * @returns {CodebaseIndex|null}
   */
  get index() {
    return this.#index;
  }

  /**
   * Get the underlying dependency graph.
   * @returns {DependencyGraph|null}
   */
  get graph() {
    return this.#graph;
  }

  /**
   * Get the underlying impact analyzer.
   * @returns {ImpactAnalyzer|null}
   */
  get analyzer() {
    return this.#analyzer;
  }

  /**
   * Whether the intelligence layer has been initialized with a project.
   * @returns {boolean}
   */
  get isAnalyzed() {
    return this.#index !== null;
  }

  /**
   * Get the project root from the last analysis.
   * @returns {string|null}
   */
  get projectRoot() {
    return this.#projectRoot;
  }

  // ---------------------------------------------------------------------------
  // Convenience methods
  // ---------------------------------------------------------------------------

  /**
   * Find all files that import a given file.
   *
   * @param {string} filePath - Relative path
   * @returns {string[]}
   */
  getDependents(filePath) {
    this.#ensureAnalyzed();
    return this.#graph.getDependents(filePath);
  }

  /**
   * Find all files that a given file imports.
   *
   * @param {string} filePath - Relative path
   * @returns {string[]}
   */
  getDependencies(filePath) {
    this.#ensureAnalyzed();
    return this.#graph.getDependencies(filePath);
  }

  /**
   * Find a symbol by name across all files.
   *
   * @param {string} name
   * @returns {import('./codebase-index.js').SymbolEntry[]}
   */
  findSymbol(name) {
    this.#ensureAnalyzed();
    return this.#index.findSymbol(name);
  }

  /**
   * Find which file exports a given symbol.
   *
   * @param {string} symbolName
   * @returns {string|null}
   */
  findExportingFile(symbolName) {
    this.#ensureAnalyzed();
    return this.#index.findExportingFile(symbolName);
  }

  /**
   * Get the entry points of the project.
   * @returns {string[]}
   */
  getEntryPoints() {
    this.#ensureAnalyzed();
    return this.#index.getEntryPoints();
  }

  /**
   * Detect circular dependencies in the project.
   * @returns {string[][]}
   */
  findCircularDependencies() {
    this.#ensureAnalyzed();
    return this.#graph.findCycles();
  }

  /**
   * Parse a single file (does not require a full project analysis).
   *
   * @param {string} filePath - Absolute or relative path to the file
   * @returns {Promise<import('./codebase-index.js').ParsedFile>}
   */
  async parseSingleFile(filePath) {
    return this.#parser.parseFile(filePath);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensure that {@link analyze} has been called. Throws if not.
   * @throws {Error}
   */
  #ensureAnalyzed() {
    if (!this.#index) {
      throw new Error(
        'CodeIntelligence has not been initialized. Call analyze(projectRoot) first.',
      );
    }
  }
}
