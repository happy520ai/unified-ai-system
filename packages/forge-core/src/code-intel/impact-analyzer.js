/**
 * @module impact-analyzer
 * @description Analyzes the blast radius of code changes by combining the
 * {@link CodebaseIndex} symbol table with the {@link DependencyGraph}
 * transitive closure. Produces actionable impact reports including affected
 * routes, tests, and an overall risk assessment.
 *
 * Classification, risk assessment, and summary helpers are delegated to
 * `impact-analyzer-helpers.js`.
 */

import {
  MIDDLEWARE_FILE_PATTERNS,
  findAffectedRoutes,
  findAffectedTests,
  findFilesMatching,
  getAllTestFiles,
  assessRisk,
  buildSummary,
  emptyReport,
} from './impact-analyzer-helpers.js';

// ---------------------------------------------------------------------------
// ImpactAnalyzer
// ---------------------------------------------------------------------------

/**
 * Analyze the impact of code changes on the codebase.
 *
 * @example
 * ```js
 * const analyzer = new ImpactAnalyzer(codebaseIndex, dependencyGraph);
 * const report = analyzer.analyze(['src/utils/auth.js']);
 * console.log(report.riskLevel);  // 'medium'
 * console.log(report.affectedTests);  // ['tests/auth.test.js', ...]
 * ```
 */
export class ImpactAnalyzer {
  /** @type {import('./codebase-index.js').CodebaseIndex} */
  #index;

  /** @type {import('./dependency-graph.js').DependencyGraph} */
  #graph;

  /**
   * @param {import('./codebase-index.js').CodebaseIndex} codebaseIndex
   * @param {import('./dependency-graph.js').DependencyGraph} dependencyGraph
   */
  constructor(codebaseIndex, dependencyGraph) {
    this.#index = codebaseIndex;
    this.#graph = dependencyGraph;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Given a list of changed files, produce a full impact report.
   *
   * @param {string[]} changedFiles - Relative paths of modified files
   * @returns {import('./impact-analyzer-helpers.js').ImpactReport}
   */
  analyze(changedFiles) {
    if (!changedFiles || changedFiles.length === 0) {
      return emptyReport();
    }

    // Normalize changed file paths
    const normalized = changedFiles.map((f) => f.replace(/\\/g, '/'));

    // Compute the transitive impact chain
    const impact = this.#graph.getImpactChain(normalized);
    const { directDependents, transitiveDependents } = impact;

    // The full set of affected files = changed + direct + transitive
    const allAffected = new Set([
      ...normalized,
      ...directDependents,
      ...transitiveDependents,
    ]);

    // Classify affected files
    const affectedRoutes = findAffectedRoutes(allAffected, this.#index);
    const affectedTests = findAffectedTests(allAffected, this.#index, this.#graph);
    const affectedMiddleware = findFilesMatching(allAffected, MIDDLEWARE_FILE_PATTERNS);

    // Risk assessment
    const riskLevel = assessRisk(
      normalized,
      directDependents,
      transitiveDependents,
      affectedRoutes,
      affectedTests,
      affectedMiddleware,
    );

    const blastRadius = allAffected.size;

    // Summary
    const summary = buildSummary(
      normalized,
      directDependents,
      transitiveDependents,
      affectedRoutes,
      affectedTests,
      affectedMiddleware,
      riskLevel,
      blastRadius,
    );

    return {
      changedFiles: normalized,
      directDependents,
      transitiveDependents,
      affectedRoutes,
      affectedTests,
      affectedMiddleware,
      riskLevel,
      blastRadius,
      summary,
    };
  }

  /**
   * Quick check: would changing the given files require running tests?
   *
   * @param {string[]} changedFiles
   * @returns {{ needsTests: boolean, testFiles: string[], reason: string }}
   */
  shouldRunTests(changedFiles) {
    const report = this.analyze(changedFiles);

    if (report.affectedTests.length > 0) {
      return {
        needsTests: true,
        testFiles: report.affectedTests,
        reason: `${report.affectedTests.length} test file(s) cover the changed code`,
      };
    }

    // If no specific test files found but routes are affected, still recommend tests
    if (report.affectedRoutes.length > 0) {
      // Try to find any test files in the project
      const allTests = getAllTestFiles(this.#index);
      if (allTests.length > 0) {
        return {
          needsTests: true,
          testFiles: allTests,
          reason: `${report.affectedRoutes.length} route handler(s) changed; consider running full test suite`,
        };
      }
    }

    return {
      needsTests: false,
      testFiles: [],
      reason: 'No test files cover the changed code',
    };
  }

  /**
   * Generate a detailed diff-aware report comparing two sets of files.
   * Useful for understanding what changed between commits.
   *
   * @param {string[]} changedFiles
   * @param {{ includeMermaid?: boolean }} [options]
   * @returns {import('./impact-analyzer-helpers.js').ImpactReport & { mermaid?: string }}
   */
  analyzeWithVisualization(changedFiles, options = {}) {
    const report = this.analyze(changedFiles);

    if (options.includeMermaid) {
      const mermaid = this.#graph.toMermaid({
        highlightFiles: report.changedFiles,
        maxNodes: 50,
      });
      return { ...report, mermaid };
    }

    return report;
  }
}
