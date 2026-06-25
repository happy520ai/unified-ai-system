/**
 * Pure helpers for IterativeRefiner — constants, typedefs, and stateless utilities.
 *
 * @module iterative-refiner/helpers
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** @type {Readonly<import('./types.js').RefinerOptions>} */
export const DEFAULTS = Object.freeze({
  maxPasses: 3,
  qualityThreshold: 85,
  selfCritiqueEnabled: true,
  diversityStrategy: 'temperature',
  minImprovement: 5,
});

/**
 * Issue categories the self-critique step can identify.
 * @readonly
 * @enum {string}
 */
export const IssueCategory = Object.freeze({
  BUG: 'bug',
  MISSING_FEATURE: 'missing_feature',
  STYLE: 'style',
  IMPORT: 'import',
  TYPE: 'type',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
});

/**
 * Severity levels for critique issues.
 * @readonly
 * @enum {string}
 */
export const Severity = Object.freeze({
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
});

// ─── Pure Utility Functions ──────────────────────────────────────────────────

/**
 * Extract code from an LLM response, stripping markdown fences if present.
 *
 * @param {string} response
 * @returns {string}
 */
export function extractCode(response) {
  if (typeof response !== 'string') return '';

  let code = response.trim();

  // Strip markdown code fences (```js ... ``` or ``` ... ```)
  const fenceMatch = code.match(/```(?:\w+)?\s*\n([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    code = fenceMatch[1].trim();
  }

  // Strip leading/trailing blank lines
  code = code.replace(/^\n+/, '').replace(/\n+$/, '');

  return code;
}

/**
 * Basic syntax check using bracket and quote balancing.
 * This is a lightweight heuristic — not a full parser.
 *
 * @param {string} code
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function basicSyntaxCheck(code) {
  const errors = [];

  // Track bracket balance
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let stringChar = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inTemplate = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1] || '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++; // skip '/'
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && (inString || inTemplate)) {
      escaped = true;
      continue;
    }

    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }

    if (inTemplate) {
      if (ch === '`') inTemplate = false;
      continue;
    }

    // Detect comments
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++; // skip second '/'
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++; // skip '*'
      continue;
    }

    // Detect strings
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    // Track brackets
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;

    // Early detection of deeply negative balance
    if (braceDepth < -2 || parenDepth < -2 || bracketDepth < -2) {
      errors.push('Unbalanced closing brackets detected');
      break;
    }
  }

  if (braceDepth !== 0) errors.push(`Unbalanced braces: depth=${braceDepth}`);
  if (parenDepth !== 0) errors.push(`Unbalanced parentheses: depth=${parenDepth}`);
  if (bracketDepth !== 0) errors.push(`Unbalanced brackets: depth=${bracketDepth}`);

  return { valid: errors.length === 0, errors };
}

/**
 * Normalize a severity string to one of the known enum values.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSeverity(raw) {
  if (!raw) return Severity.WARNING;
  const lower = String(raw).toLowerCase();
  if (lower === 'critical' || lower === 'error' || lower === 'high') return Severity.CRITICAL;
  if (lower === 'info' || lower === 'low' || lower === 'minor') return Severity.INFO;
  return Severity.WARNING;
}

/**
 * Normalize a category string to one of the known enum values.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCategory(raw) {
  if (!raw) return IssueCategory.STYLE;
  const lower = String(raw).toLowerCase().replace(/[^a-z_]/g, '');
  const validCategories = Object.values(IssueCategory);
  if (validCategories.includes(lower)) return lower;
  // Fuzzy match
  if (lower.includes('bug') || lower.includes('error')) return IssueCategory.BUG;
  if (lower.includes('miss') || lower.includes('feature')) return IssueCategory.MISSING_FEATURE;
  if (lower.includes('import') || lower.includes('require')) return IssueCategory.IMPORT;
  if (lower.includes('type') || lower.includes('typing')) return IssueCategory.TYPE;
  if (lower.includes('perf') || lower.includes('speed') || lower.includes('slow')) return IssueCategory.PERFORMANCE;
  if (lower.includes('secur') || lower.includes('vuln') || lower.includes('xss')) return IssueCategory.SECURITY;
  return IssueCategory.STYLE;
}

/**
 * Parse the LLM critique response into a structured result.
 *
 * @param {string} response — raw LLM response text
 * @returns {CritiqueResult}
 */
export function parseCritiqueResponse(response) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { issues: [], score: 50, summary: 'No JSON found in critique response' };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.map(issue => ({
          severity: normalizeSeverity(issue.severity),
          category: normalizeCategory(issue.category),
          description: String(issue.description || ''),
          line: typeof issue.line === 'number' ? issue.line : null,
          fix: String(issue.fix || ''),
        }))
      : [];

    return {
      issues,
      score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50,
      summary: String(parsed.summary || ''),
    };
  } catch {
    return { issues: [], score: 50, summary: 'Failed to parse critique JSON' };
  }
}

/**
 * Score code quality using heuristic checks (no LLM required).
 *
 * @param {string} code — generated source code
 * @param {object} task — the original task descriptor
 * @returns {{ score: number, checks: QualityCheck[] }}
 */
export function scoreCodeQuality(code, task = {}) {
  /** @type {QualityCheck[]} */
  const checks = [];

  if (typeof code !== 'string' || code.trim().length === 0) {
    return { score: 0, checks: [{ name: 'non_empty', passed: false, points: 0, max: 100 }] };
  }

  const lines = code.split('\n');
  const trimmedCode = code.trim();

  // 1. Has imports (if the task or code expects them): +10
  {
    const hasImports = /\b(?:import\s|require\s*\()/.test(trimmedCode);
    const expectsImports = !!(task.expectedFiles?.length) || /(?:import|require|from)\b/.test(trimmedCode);
    const passed = hasImports || !expectsImports;
    checks.push({ name: 'has_imports', passed, points: passed ? 10 : 0, max: 10 });
  }

  // 2. Has exports: +10
  {
    const hasExports = /\b(?:export\s|module\.exports\b)/.test(trimmedCode);
    checks.push({ name: 'has_exports', passed: hasExports, points: hasExports ? 10 : 0, max: 10 });
  }

  // 3. No TODO/FIXME/HACK comments: +5 per absence (max 15)
  {
    const todos = (trimmedCode.match(/\bTODO\b/gi) || []).length;
    const fixmes = (trimmedCode.match(/\bFIXME\b/gi) || []).length;
    const hacks = (trimmedCode.match(/\bHACK\b/gi) || []).length;
    const total = todos + fixmes + hacks;
    const pts = total === 0 ? 15 : Math.max(0, 15 - total * 5);
    checks.push({ name: 'no_todo_fixme_hack', passed: total === 0, points: pts, max: 15 });
  }

  // 4. Consistent indentation: +5
  {
    const indents = lines
      .filter(l => l.length > 0 && l.trim().length > 0)
      .map(l => {
        const m = l.match(/^(\s+)/);
        return m ? m[1] : '';
      })
      .filter(s => s.length > 0);
    const hasTabs = indents.some(s => s.includes('\t'));
    const hasSpaces = indents.some(s => /^ +$/.test(s));
    const consistent = !hasTabs || !hasSpaces; // mixing is bad
    checks.push({ name: 'consistent_indentation', passed: consistent, points: consistent ? 5 : 0, max: 5 });
  }

  // 5. Has error handling (try/catch or .catch): +10
  {
    const hasTryCatch = /\btry\s*\{/.test(trimmedCode);
    const hasCatchMethod = /\.catch\s*\(/.test(trimmedCode);
    const hasOnError = /\bon\w*Error\b/.test(trimmedCode);
    const passed = hasTryCatch || hasCatchMethod || hasOnError;
    checks.push({ name: 'has_error_handling', passed, points: passed ? 10 : 0, max: 10 });
  }

  // 6. No console.log in production code: +5
  {
    // console.error / console.warn are acceptable
    const hasConsoleLog = /\bconsole\.log\s*\(/.test(trimmedCode);
    const isTestFile = /\.(test|spec)\./i.test(task.expectedFiles?.[0] || '');
    const passed = !hasConsoleLog || isTestFile;
    checks.push({ name: 'no_console_log', passed, points: passed ? 5 : 0, max: 5 });
  }

  // 7. Function/class declarations present: +10
  {
    const hasFunction = /(?:function\s+\w|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|class\s+\w)/.test(trimmedCode);
    checks.push({ name: 'has_declarations', passed: hasFunction, points: hasFunction ? 10 : 0, max: 10 });
  }

  // 8. No syntax errors (basic bracket/quote balancing): +15
  {
    const syntaxResult = basicSyntaxCheck(trimmedCode);
    checks.push({ name: 'no_syntax_errors', passed: syntaxResult.valid, points: syntaxResult.valid ? 15 : 0, max: 15 });
  }

  // 9. Reasonable length (not too short, not too long): +5
  {
    const nonBlankLines = lines.filter(l => l.trim().length > 0).length;
    const passed = nonBlankLines >= 5 && nonBlankLines <= 600;
    checks.push({ name: 'reasonable_length', passed, points: passed ? 5 : 0, max: 5 });
  }

  // 10. Has JSDoc or meaningful comments: +5
  {
    const hasJSDoc = /\/\*\*[\s\S]*?\*\//.test(trimmedCode);
    const hasLineComments = /\/\/\s+\w{3,}/.test(trimmedCode); // at least 3-char comment
    const passed = hasJSDoc || hasLineComments;
    checks.push({ name: 'has_comments', passed, points: passed ? 5 : 0, max: 5 });
  }

  // 11. Matches expected file patterns: +10
  {
    let passed = false;
    if (task.expectedFiles?.length > 0) {
      // Check that code references or mentions expected file names/modules
      const codeNames = task.expectedFiles.map(f => {
        const base = f.replace(/^.*[\\/]/, '').replace(/\.\w+$/, '');
        return base.toLowerCase();
      });
      const matched = codeNames.some(name =>
        trimmedCode.toLowerCase().includes(name) || name.length === 0,
      );
      passed = matched;
    } else {
      // No expected files — neutral pass
      passed = true;
    }
    checks.push({ name: 'matches_expected_files', passed, points: passed ? 10 : 0, max: 10 });
  }

  const score = checks.reduce((sum, c) => sum + c.points, 0);
  return { score: Math.min(100, score), checks };
}

/**
 * Build the generation prompt for a given pass.
 *
 * @param {object} task
 * @param {number} passNumber
 * @returns {string}
 */
export function buildGenerationPrompt(task, passNumber) {
  const sections = [];

  sections.push(`## Task\n${task.prompt || 'Generate code based on the context provided.'}`);

  if (task.context) {
    sections.push(`## Codebase Context\n${task.context}`);
  }

  if (task.expectedFiles?.length > 0) {
    sections.push(`## Expected Output Files\n${task.expectedFiles.map(f => `- ${f}`).join('\n')}`);
  }

  if (task.constraints?.length > 0) {
    sections.push(`## Constraints\n${task.constraints.map(c => `- ${c}`).join('\n')}`);
  }

  if (passNumber === 1) {
    sections.push(
      '## Coding Standards\n' +
      '- Use ESM imports (import/export) unless the context shows CommonJS.\n' +
      '- Add JSDoc comments for all public functions and classes.\n' +
      '- Include proper error handling with try/catch.\n' +
      '- Use descriptive variable and function names.\n' +
      '- Keep functions focused — single responsibility.\n' +
      '- No console.log in production code.\n' +
      '- No TODO/FIXME/HACK markers.\n',
    );
  }

  sections.push('## Output\nGenerate the complete code. Output ONLY the code — no explanations, no markdown fences.');

  return sections.join('\n\n');
}

/**
 * Build the improvement prompt with previous code and critique issues.
 *
 * @param {string} previousCode
 * @param {CritiqueResult|null} critique
 * @param {object} task
 * @param {number} passNumber
 * @returns {string}
 */
export function buildImprovementPrompt(previousCode, critique, task, passNumber) {
  const sections = [];

  sections.push(`## Original Task\n${task.prompt || 'Improve the code.'}`);

  sections.push(`## Current Code (Pass ${passNumber - 1})\n\`\`\`\n${previousCode}\n\`\`\``);

  if (critique && critique.issues.length > 0) {
    // Sort issues by severity: critical first
    const sortedIssues = [...critique.issues].sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

    const issueList = sortedIssues.map((issue, idx) => {
      const lineRef = issue.line ? ` (line ~${issue.line})` : '';
      const fixHint = issue.fix ? `\n   Suggested fix: ${issue.fix}` : '';
      return `${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}${lineRef}${fixHint}`;
    }).join('\n');

    sections.push(`## Issues to Fix\n${issueList}`);
  } else {
    sections.push('## Improvement Goals\nGeneral quality improvement — polish, documentation, edge cases.');
  }

  // Pass-specific strategy
  if (passNumber === 2) {
    sections.push(
      '## Strategy: Bug Fix Pass\n' +
      'Focus on fixing bugs, missing imports, type issues, and missing error handling.\n' +
      'Do NOT refactor working code. Make targeted fixes only.',
    );
  } else if (passNumber >= 3) {
    sections.push(
      '## Strategy: Polish Pass\n' +
      'Focus on code style, documentation, edge-case handling, and minor improvements.\n' +
      'Ensure all public APIs have JSDoc comments.\n' +
      'Remove any remaining console.log statements.',
    );
  }

  if (task.constraints?.length > 0) {
    sections.push(`## Constraints (MUST follow)\n${task.constraints.map(c => `- ${c}`).join('\n')}`);
  }

  sections.push('## Output\nOutput ONLY the improved code. No explanations, no markdown fences.');

  return sections.join('\n\n');
}

/**
 * Get the LLM temperature for a given pass number based on the diversity strategy.
 *
 * @param {string} diversityStrategy
 * @param {number} passNumber
 * @returns {number}
 */
export function getTemperatureForPass(diversityStrategy, passNumber) {
  switch (diversityStrategy) {
    case 'temperature':
      // Decrease temperature in later passes for more focused refinement
      return Math.max(0.05, 0.3 - (passNumber - 1) * 0.1);
    case 'fixed':
      return 0.15;
    case 'increasing':
      // Increase temperature for more creative attempts if earlier ones failed
      return Math.min(0.5, 0.1 + (passNumber - 1) * 0.15);
    default:
      return 0.2;
  }
}
