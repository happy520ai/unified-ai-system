/**
 * @module impact-analyzer-helpers
 * @description Pure helper functions and constants extracted from
 * ImpactAnalyzer for file classification, risk assessment, and report
 * generation. All functions are stateless and receive data as parameters.
 */

import path from 'node:path';

// ---------------------------------------------------------------------------
// Heuristic patterns for test / route file detection
// ---------------------------------------------------------------------------

/** File-name patterns that indicate a test file. */
export const TEST_FILE_PATTERNS = [
  /\.(?:test|spec)\.(?:js|ts|jsx|tsx|mjs)$/,
  /(?:^|\/)(?:__tests__|test|tests)\//,
  /\.test-utils?\.(?:js|ts)$/,
];

/** File-name patterns that indicate a route / controller file. */
export const ROUTE_FILE_PATTERNS = [
  /(?:^|\/)(?:routes?|controllers?|api|endpoints?)\//,
  /\.(?:route|controller|api)\.(?:js|ts)$/,
];

/** File-name patterns for configuration files. */
export const CONFIG_FILE_PATTERNS = [
  /(?:^|\/)(?:config|configuration|settings)\//,
  /\.(?:config|conf)\.(?:js|ts|json)$/,
  /(?:^|\/)(?:\.env|config)\b/,
];

/** File-name patterns for middleware files. */
export const MIDDLEWARE_FILE_PATTERNS = [
  /(?:^|\/)(?:middleware|middlewares|hooks?|plugins?|interceptors?)\//,
  /\.(?:middleware|hook|plugin|interceptor)\.(?:js|ts)$/,
];

/** File-name patterns for shared / utility files. */
export const SHARED_FILE_PATTERNS = [
  /(?:^|\/)(?:utils?|helpers?|lib|common|shared|core|base)\//,
  /\.(?:util|helper|common|shared)\.(?:js|ts)$/,
];

// ---------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------

/**
 * @typedef {'low' | 'medium' | 'high' | 'critical'} RiskLevel
 */

/**
 * @typedef {Object} ImpactReport
 * @property {string[]} changedFiles       - The original input files
 * @property {string[]} directDependents   - Files that directly import any changed file
 * @property {string[]} transitiveDependents - Files transitively affected
 * @property {AffectedRoute[]} affectedRoutes - Route handlers in the impact zone
 * @property {string[]} affectedTests      - Test files that cover affected code
 * @property {string[]} affectedMiddleware  - Middleware/hooks in the impact zone
 * @property {RiskLevel} riskLevel         - Overall risk assessment
 * @property {number} blastRadius          - Total number of affected files
 * @property {string} summary              - Human-readable summary
 */

/**
 * @typedef {Object} AffectedRoute
 * @property {string} file   - File containing the route handler
 * @property {string} name   - Route name (e.g. "GET /api/users")
 * @property {number} line   - Line number of the route declaration
 */

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

/**
 * Find route handler symbols within the affected file set.
 * @param {Set<string>} affectedFiles
 * @param {import('./codebase-index.js').CodebaseIndex} index
 * @returns {AffectedRoute[]}
 */
export function findAffectedRoutes(affectedFiles, index) {
  const routes = [];

  for (const file of affectedFiles) {
    // Check if the file itself looks like a route file
    const isRouteFile = ROUTE_FILE_PATTERNS.some((p) => p.test(file));

    const parsed = index.getFile(file);
    if (!parsed) continue;

    for (const sym of parsed.symbols) {
      if (sym.type === 'route') {
        routes.push({
          file: sym.file,
          name: sym.name,
          line: sym.line,
        });
      }
    }

    // If it's a route file but we didn't find explicit route symbols,
    // still flag it as a potentially affected route file
    if (isRouteFile && !parsed.symbols.some((s) => s.type === 'route')) {
      routes.push({
        file,
        name: `(route file: ${path.basename(file)})`,
        line: 0,
      });
    }
  }

  return routes;
}

/**
 * Find test files within the affected set, plus any test files that
 * import from affected non-test files.
 *
 * @param {Set<string>} affectedFiles
 * @param {import('./codebase-index.js').CodebaseIndex} index
 * @param {import('./dependency-graph.js').DependencyGraph} graph
 * @returns {string[]}
 */
export function findAffectedTests(affectedFiles, index, graph) {
  const testFiles = new Set();

  // Tests that are themselves in the affected set
  for (const file of affectedFiles) {
    if (TEST_FILE_PATTERNS.some((p) => p.test(file))) {
      testFiles.add(file);
    }
  }

  // Tests that import from affected (non-test) files but aren't in the set yet
  const allFiles = index.getAllFiles();
  for (const file of allFiles) {
    if (testFiles.has(file)) continue;
    if (!TEST_FILE_PATTERNS.some((p) => p.test(file))) continue;

    const deps = graph.getDependencies(file);
    for (const dep of deps) {
      if (affectedFiles.has(dep)) {
        testFiles.add(file);
        break;
      }
    }
  }

  return [...testFiles];
}

/**
 * Find files in the affected set matching a set of patterns.
 * @param {Set<string>} affectedFiles
 * @param {RegExp[]} patterns
 * @returns {string[]}
 */
export function findFilesMatching(affectedFiles, patterns) {
  const matched = [];
  for (const file of affectedFiles) {
    if (patterns.some((p) => p.test(file))) {
      matched.push(file);
    }
  }
  return matched;
}

/**
 * Get all test files in the entire codebase index.
 * @param {import('./codebase-index.js').CodebaseIndex} index
 * @returns {string[]}
 */
export function getAllTestFiles(index) {
  return index
    .getAllFiles()
    .filter((f) => TEST_FILE_PATTERNS.some((p) => p.test(f)));
}

// ---------------------------------------------------------------------------
// Risk assessment
// ---------------------------------------------------------------------------

/**
 * Compute a risk level based on the blast radius and the types of files
 * affected.
 *
 * Scoring heuristic:
 * - Base score from total blast radius
 * - Bonus for route changes (public API surface)
 * - Bonus for middleware/config changes (cross-cutting concerns)
 * - Bonus for shared utility changes (widely imported)
 * - Reduction if only test files changed
 *
 * @param {string[]} changedFiles
 * @param {string[]} directDependents
 * @param {string[]} transitiveDependents
 * @param {AffectedRoute[]} affectedRoutes
 * @param {string[]} affectedTests
 * @param {string[]} affectedMiddleware
 * @returns {RiskLevel}
 */
export function assessRisk(
  changedFiles,
  directDependents,
  transitiveDependents,
  affectedRoutes,
  affectedTests,
  affectedMiddleware,
) {
  let score = 0;

  // Blast radius contribution
  const totalAffected =
    changedFiles.length + directDependents.length + transitiveDependents.length;
  score += Math.min(totalAffected * 2, 40); // Cap at 40

  // Changed files themselves
  for (const file of changedFiles) {
    // Config files are high-risk
    if (CONFIG_FILE_PATTERNS.some((p) => p.test(file))) {
      score += 15;
    }
    // Shared utilities are medium-high risk
    if (SHARED_FILE_PATTERNS.some((p) => p.test(file))) {
      score += 10;
    }
    // Route files are medium risk
    if (ROUTE_FILE_PATTERNS.some((p) => p.test(file))) {
      score += 10;
    }
    // Middleware is high-risk (cross-cutting)
    if (MIDDLEWARE_FILE_PATTERNS.some((p) => p.test(file))) {
      score += 12;
    }
    // Test-only changes are low risk
    if (TEST_FILE_PATTERNS.some((p) => p.test(file))) {
      score -= 5;
    }
  }

  // Affected route handlers
  score += affectedRoutes.length * 5;

  // Affected middleware
  score += affectedMiddleware.length * 5;

  // Large transitive fan-out is risky
  if (transitiveDependents.length > 10) {
    score += 10;
  }
  if (transitiveDependents.length > 30) {
    score += 10;
  }

  // Map score to risk level
  if (score <= 15) return 'low';
  if (score <= 40) return 'medium';
  if (score <= 70) return 'high';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

/**
 * Build a human-readable summary string.
 *
 * @param {string[]} changedFiles
 * @param {string[]} directDependents
 * @param {string[]} transitiveDependents
 * @param {AffectedRoute[]} affectedRoutes
 * @param {string[]} affectedTests
 * @param {string[]} affectedMiddleware
 * @param {RiskLevel} riskLevel
 * @param {number} blastRadius
 * @returns {string}
 */
export function buildSummary(
  changedFiles,
  directDependents,
  transitiveDependents,
  affectedRoutes,
  affectedTests,
  affectedMiddleware,
  riskLevel,
  blastRadius,
) {
  const lines = [];

  lines.push(`## Impact Analysis Report`);
  lines.push('');
  lines.push(`**Risk Level**: ${riskLevel.toUpperCase()}`);
  lines.push(`**Blast Radius**: ${blastRadius} file(s) affected`);
  lines.push('');

  // Changed files
  lines.push(`### Changed Files (${changedFiles.length})`);
  for (const f of changedFiles) {
    lines.push(`- ${f}`);
  }
  lines.push('');

  // Direct dependents
  if (directDependents.length > 0) {
    lines.push(`### Direct Dependents (${directDependents.length})`);
    for (const f of directDependents) {
      lines.push(`- ${f}`);
    }
    lines.push('');
  }

  // Transitive dependents
  if (transitiveDependents.length > 0) {
    lines.push(`### Transitive Dependents (${transitiveDependents.length})`);
    for (const f of transitiveDependents.slice(0, 20)) {
      lines.push(`- ${f}`);
    }
    if (transitiveDependents.length > 20) {
      lines.push(`- ... and ${transitiveDependents.length - 20} more`);
    }
    lines.push('');
  }

  // Affected routes
  if (affectedRoutes.length > 0) {
    lines.push(`### Affected Routes (${affectedRoutes.length})`);
    for (const r of affectedRoutes) {
      const loc = r.line > 0 ? `:${r.line}` : '';
      lines.push(`- **${r.name}** (${r.file}${loc})`);
    }
    lines.push('');
  }

  // Affected tests
  if (affectedTests.length > 0) {
    lines.push(`### Affected Tests (${affectedTests.length})`);
    for (const t of affectedTests) {
      lines.push(`- ${t}`);
    }
    lines.push('');
  }

  // Affected middleware
  if (affectedMiddleware.length > 0) {
    lines.push(`### Affected Middleware (${affectedMiddleware.length})`);
    for (const m of affectedMiddleware) {
      lines.push(`- ${m}`);
    }
    lines.push('');
  }

  // Recommendations
  lines.push('### Recommendations');
  if (riskLevel === 'critical' || riskLevel === 'high') {
    lines.push('- Run the **full test suite** before merging');
    lines.push('- Request a **thorough code review** focusing on integration points');
  }
  if (affectedRoutes.length > 0) {
    lines.push('- Verify affected API endpoints with integration tests');
  }
  if (affectedMiddleware.length > 0) {
    lines.push('- Test middleware changes across all affected request paths');
  }
  if (affectedTests.length > 0) {
    lines.push(`- Run at least: ${affectedTests.slice(0, 5).join(', ')}`);
  }
  if (riskLevel === 'low') {
    lines.push('- Standard review and test process should suffice');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Empty report
// ---------------------------------------------------------------------------

/**
 * Return an empty report for when there are no changed files.
 * @returns {ImpactReport}
 */
export function emptyReport() {
  return {
    changedFiles: [],
    directDependents: [],
    transitiveDependents: [],
    affectedRoutes: [],
    affectedTests: [],
    affectedMiddleware: [],
    riskLevel: 'low',
    blastRadius: 0,
    summary: '## Impact Analysis Report\n\nNo changed files provided. Nothing to analyze.',
  };
}
