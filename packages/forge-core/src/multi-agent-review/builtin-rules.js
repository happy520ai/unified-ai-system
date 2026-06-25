/**
 * Built-in review rules for the multi-agent review system.
 */

import { ReviewCategory, ReviewSeverity } from './constants.js';

/**
 * @typedef {object} ReviewRule
 * @property {string} id — unique identifier
 * @property {string} name — human-readable name
 * @property {string} category — one of ReviewCategory
 * @property {string} severity — one of ReviewSeverity
 * @property {RegExp|Function} pattern — regex or function(content) => matches[]
 * @property {string} message — description shown on the issue
 * @property {Function} [fix] — optional auto-fix function(content) => string
 * @property {string[]} languages — array of language codes this rule applies to (e.g. ['js','ts']), or ['all'] for universal rules
 */

/** @type {ReviewRule[]} */
export const BUILTIN_RULES = [
  // ── Security ──────────────────────────────────────────────────────────
  {
    id: 'builtin:sec-hardcoded-secret',
    name: 'Hardcoded secret',
    category: ReviewCategory.SECURITY,
    severity: ReviewSeverity.CRITICAL,
    pattern: /(?:password|passwd|secret|api_key|apikey|token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    message: 'Possible hardcoded secret or credential detected.',
    languages: ['all'],
  },
  {
    id: 'builtin:sec-sql-injection',
    name: 'SQL injection pattern',
    category: ReviewCategory.SECURITY,
    severity: ReviewSeverity.ERROR,
    pattern: /(?:query|execute|exec)\s*\(\s*(?:`[^`]*\$\{[^}]+\}[^`]*`|['"][^'"]*['"]\s*\+\s*\w+)/,
    message: 'Potential SQL injection — use parameterised queries instead.',
    languages: ['all'],
  },
  {
    id: 'builtin:sec-eval',
    name: 'eval() usage',
    category: ReviewCategory.SECURITY,
    severity: ReviewSeverity.ERROR,
    pattern: /\beval\s*\(/,
    message: 'eval() usage is dangerous and may allow code injection.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:sec-unsafe-regex',
    name: 'Unsafe regex (ReDoS risk)',
    category: ReviewCategory.SECURITY,
    severity: ReviewSeverity.WARNING,
    pattern: /new\s+RegExp\s*\(\s*[^)]*(?:\([^)]*\)\+|\([^)]*\)\*|\([^)]*\)\{[^}]*\})\+/,
    message: 'Regex pattern may be vulnerable to ReDoS (catastrophic backtracking).',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:sec-inner-html',
    name: 'innerHTML assignment',
    category: ReviewCategory.SECURITY,
    severity: ReviewSeverity.WARNING,
    pattern: /\.innerHTML\s*=/,
    message: 'innerHTML assignment may lead to XSS vulnerabilities.',
    languages: ['js', 'ts'],
  },
  // ── Logic ─────────────────────────────────────────────────────────────
  {
    id: 'builtin:logic-unreachable',
    name: 'Unreachable code after return/throw',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.WARNING,
    pattern: /\b(?:return|throw)\b[^;\n]*[;\n][ \t]*[^\s}/\n]/,
    message: 'Code appears to be unreachable after a return or throw statement.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:logic-missing-error-handling',
    name: 'Missing error handling',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.WARNING,
    pattern: /\.then\s*\([^)]*\)(?!\s*\.catch)(?!\s*\.finally)/,
    message: 'Promise chain without .catch() — unhandled rejection risk.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:logic-infinite-loop',
    name: 'Infinite loop risk',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.ERROR,
    pattern: /while\s*\(\s*true\s*\)\s*\{(?![^}]*\b(?:break|return|throw)\b)/,
    message: 'while(true) loop with no visible break/return/throw — possible infinite loop.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:logic-off-by-one',
    name: 'Off-by-one risk',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.WARNING,
    pattern: /(?:<=\s*\w+\.length\b|\b\w+\.length\s*-?\s*0\b)/,
    message: 'Possible off-by-one error with length comparison.',
    languages: ['js', 'ts', 'go'],
  },
  // ── Style ─────────────────────────────────────────────────────────────
  {
    id: 'builtin:style-inconsistent-naming',
    name: 'Inconsistent variable naming',
    category: ReviewCategory.STYLE,
    severity: ReviewSeverity.INFO,
    pattern: /\b(?:var|let|const)\s+[a-z]+[A-Z][a-zA-Z]*_[a-z]/,
    message: 'Mixed camelCase and snake_case naming detected in the same declaration.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:style-excessive-function-length',
    name: 'Excessive function length (>100 lines)',
    category: ReviewCategory.STYLE,
    severity: ReviewSeverity.WARNING,
    pattern(content) {
      const matches = [];
      const lines = content.split('\n');
      let depth = 0;
      let fnStart = -1;
      for (let i = 0; i < lines.length; i++) {
        const open = (lines[i].match(/\{/g) || []).length;
        const close = (lines[i].match(/\}/g) || []).length;
        if (fnStart === -1 && /\b(?:function|=>)\b/.test(lines[i]) && open > 0) {
          fnStart = i;
          depth = open - close;
        } else if (fnStart !== -1) {
          depth += open - close;
        }
        if (fnStart !== -1 && depth <= 0) {
          const len = i - fnStart + 1;
          if (len > 100) {
            matches.push({ line: fnStart + 1, column: 0, detail: `Function is ${len} lines long.` });
          }
          fnStart = -1;
          depth = 0;
        }
      }
      return matches;
    },
    message: 'Function exceeds 100 lines — consider breaking it into smaller pieces.',
    languages: ['all'],
  },
  {
    id: 'builtin:style-deep-nesting',
    name: 'Deep nesting (>4 levels)',
    category: ReviewCategory.STYLE,
    severity: ReviewSeverity.WARNING,
    pattern(content) {
      const matches = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const leadingSpaces = lines[i].match(/^(\s*)/)[1].length;
        const indent = lines[i].startsWith('\t')
          ? lines[i].match(/^(\t*)/)[1].length
          : Math.floor(leadingSpaces / 2);
        if (indent > 4 && lines[i].trim().length > 0) {
          matches.push({ line: i + 1, column: 0, detail: `Nesting depth of ${indent} levels.` });
        }
      }
      return matches;
    },
    message: 'Code is nested more than 4 levels deep — consider extracting helper functions.',
    languages: ['all'],
  },
  {
    id: 'builtin:style-console-log',
    name: 'Console statement left in code',
    category: ReviewCategory.STYLE,
    severity: ReviewSeverity.INFO,
    pattern: /console\.(?:log|debug|info)\s*\(/,
    message: 'Console statement found — remove before production.',
    languages: ['js', 'ts'],
  },
  // ── Performance ───────────────────────────────────────────────────────
  {
    id: 'builtin:perf-n-plus-one',
    name: 'N+1 query pattern',
    category: ReviewCategory.PERFORMANCE,
    severity: ReviewSeverity.WARNING,
    pattern: /(?:for|forEach|map)\s*(?:\(|of|=>)[^)]*(?:await\s+)?(?:query|find|findOne|findById|select|get)\s*\(/,
    message: 'Possible N+1 query pattern — consider batch fetching.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:perf-string-concat-loop',
    name: 'String concatenation in loop',
    category: ReviewCategory.PERFORMANCE,
    severity: ReviewSeverity.WARNING,
    pattern: /(?:for|while)\s*\([^)]*\)[^{]*\{[^}]*\w+\s*\+=\s*(?:['"`]|\w+\.toString)/,
    message: 'String concatenation inside loop — consider using an array and join().',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:perf-missing-memoization',
    name: 'Missing memoization hint',
    category: ReviewCategory.PERFORMANCE,
    severity: ReviewSeverity.INFO,
    pattern: /function\s+\w+\s*\([^)]*\)\s*\{[^}]*\bfunction\s+\1\b/,
    message: 'Recursive function without memoization — may have exponential time complexity.',
    languages: ['js', 'ts'],
  },
  // ── Maintainability ───────────────────────────────────────────────────
  {
    id: 'builtin:maint-magic-number',
    name: 'Magic number',
    category: ReviewCategory.MAINTAINABILITY,
    severity: ReviewSeverity.INFO,
    pattern: /(?<![\w.])(?:[<>!=]=?|[+\-*/%])\s*(?:[2-9]\d{2,}|[1-9]\d{3,})(?![\w.])/m,
    message: 'Magic number detected — consider extracting to a named constant.',
    languages: ['all'],
  },
  {
    id: 'builtin:maint-missing-jsdoc',
    name: 'Missing JSDoc on export',
    category: ReviewCategory.MAINTAINABILITY,
    severity: ReviewSeverity.INFO,
    pattern(content) {
      const matches = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/\bexport\s+(?:function|class|const|let|var)\b/.test(lines[i])) {
          const prevLine = i > 0 ? lines[i - 1].trim() : '';
          if (!prevLine.endsWith('*/') && !prevLine.startsWith('*') && !prevLine.startsWith('/**')) {
            matches.push({ line: i + 1, column: 0, detail: 'Exported symbol lacks a JSDoc comment.' });
          }
        }
      }
      return matches;
    },
    message: 'Exported symbol is missing a JSDoc comment block.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:maint-large-file',
    name: 'Large file (>500 lines)',
    category: ReviewCategory.MAINTAINABILITY,
    severity: ReviewSeverity.WARNING,
    pattern(content) {
      const lineCount = content.split('\n').length;
      if (lineCount > 500) {
        return [{ line: 1, column: 0, detail: `File has ${lineCount} lines.` }];
      }
      return [];
    },
    message: 'File exceeds 500 lines — consider splitting into smaller modules.',
    languages: ['all'],
  },
  {
    id: 'builtin:maint-todo-fixme',
    name: 'Unresolved TODO/FIXME',
    category: ReviewCategory.MAINTAINABILITY,
    severity: ReviewSeverity.INFO,
    pattern: /(?:\/\/|#)\s*(?:TODO|FIXME|HACK|XXX)\b/,
    message: 'Unresolved TODO or FIXME comment found.',
    languages: ['all'],
  },
  // ── Testing ───────────────────────────────────────────────────────────
  {
    id: 'builtin:test-no-assertions',
    name: 'Test with no assertions',
    category: ReviewCategory.TESTING,
    severity: ReviewSeverity.WARNING,
    pattern(content) {
      const matches = [];
      const lines = content.split('\n');
      let inTest = false;
      let testStart = -1;
      let braceDepth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!inTest && /\b(?:it|test)\s*\(/.test(line)) {
          inTest = true;
          testStart = i;
          braceDepth = 0;
        }
        if (inTest) {
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;
          if (braceDepth <= 0 && i > testStart) {
            const block = lines.slice(testStart, i + 1).join('\n');
            if (!/\b(?:expect|assert|should|toEqual|toBe|toMatch|toThrow)\b/.test(block)) {
              matches.push({ line: testStart + 1, column: 0, detail: 'Test block has no assertions.' });
            }
            inTest = false;
          }
        }
      }
      return matches;
    },
    message: 'Test block contains no assertions — the test may not verify anything.',
    languages: ['js', 'ts'],
  },
  {
    id: 'builtin:test-empty-callback',
    name: 'Empty test callback',
    category: ReviewCategory.TESTING,
    severity: ReviewSeverity.WARNING,
    pattern: /(?:it|test)\s*\(\s*['"][^'"]*['"]\s*,\s*(?:\(\s*\)\s*=>\s*\{\s*\}|\(\s*\)\s*=>\s*(?:undefined|void\s+0)|function\s*\(\s*\)\s*\{\s*\})/,
    message: 'Test has an empty callback body — it will always pass.',
    languages: ['js', 'ts'],
  },
  // ── Python-specific rules ──────────────────────────────────────────────
  {
    id: 'builtin:py-mutable-default',
    name: 'Mutable default argument',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.ERROR,
    pattern: /def\s+\w+\s*\([^)]*=\s*(?:\[\]|\{\}|\bset\(\))/,
    message: 'Mutable default argument — shared across calls. Use None with a check inside the function body instead.',
    languages: ['python'],
  },
  {
    id: 'builtin:py-bare-except',
    name: 'Bare except clause',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.WARNING,
    pattern: /^\s*except\s*:/m,
    message: 'Bare except clause catches all exceptions including SystemExit and KeyboardInterrupt — specify an exception type.',
    languages: ['python'],
  },
  {
    id: 'builtin:py-eval-exec',
    name: 'eval()/exec() usage',
    category: ReviewCategory.SECURITY,
    severity: ReviewSeverity.ERROR,
    pattern: /\b(?:eval|exec)\s*\(/,
    message: 'eval()/exec() usage is dangerous and may allow arbitrary code execution.',
    languages: ['python'],
  },
  {
    id: 'builtin:py-missing-type-hints',
    name: 'Missing type hints on public function',
    category: ReviewCategory.MAINTAINABILITY,
    severity: ReviewSeverity.INFO,
    pattern(content) {
      const matches = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/);
        if (match && !match[1].startsWith('_')) {
          const params = match[2].trim();
          const hasReturnType = /\)\s*->/.test(lines[i]);
          const hasParamTypes = params.length === 0 || /:\s*\w/.test(params);
          if (!hasReturnType || !hasParamTypes) {
            matches.push({ line: i + 1, column: 0, detail: `Public function '${match[1]}' is missing type hints.` });
          }
        }
      }
      return matches;
    },
    message: 'Public function is missing type hints — add parameter and return type annotations.',
    languages: ['python'],
  },
  // ── Go-specific rules ──────────────────────────────────────────────────
  {
    id: 'builtin:go-unchecked-error',
    name: 'Unchecked error return',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.ERROR,
    pattern: /(?:_\s*(?:,\s*\w+)?\s*=\s*\w+\.\w+\s*\(|_\s*=\s*\w+\.\w+\s*\()/,
    message: 'Error return value is being discarded — always check errors in Go.',
    languages: ['go'],
  },
  {
    id: 'builtin:go-missing-body-close',
    name: 'Missing defer resp.Body.Close()',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.ERROR,
    pattern(content) {
      const matches = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/\b(?:http\.Get|http\.Post|http\.Do|client\.Do|client\.Get|client\.Post)\s*\(/.test(lines[i])) {
          // Check the next 5 lines for a defer resp.Body.Close()
          const context = lines.slice(i + 1, Math.min(i + 6, lines.length)).join('\n');
          if (!/defer\s+\w+\.Body\.Close\s*\(\s*\)/.test(context)) {
            matches.push({ line: i + 1, column: 0, detail: 'HTTP response body may not be closed — add defer resp.Body.Close().' });
          }
        }
      }
      return matches;
    },
    message: 'HTTP request without defer resp.Body.Close() — response body will leak.',
    languages: ['go'],
  },
  {
    id: 'builtin:go-goroutine-no-context',
    name: 'Goroutine without context',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.WARNING,
    pattern: /go\s+func\s*\(\s*\)\s*\{/,
    message: 'Goroutine launched without context.Context — may leak if the parent exits. Consider passing a context.',
    languages: ['go'],
  },
  // ── Rust-specific rules ────────────────────────────────────────────────
  {
    id: 'builtin:rust-unwrap',
    name: 'unwrap() on Result/Option',
    category: ReviewCategory.LOGIC,
    severity: ReviewSeverity.WARNING,
    pattern: /\b\w+\.unwrap\s*\(\s*\)/,
    message: 'unwrap() will panic on Err/None — use expect(), match, or the ? operator for proper error handling.',
    languages: ['rust'],
  },
  {
    id: 'builtin:rust-unnecessary-clone',
    name: 'Unnecessary clone()',
    category: ReviewCategory.PERFORMANCE,
    severity: ReviewSeverity.INFO,
    pattern: /\b\w+\.clone\s*\(\s*\)/,
    message: 'clone() call detected — consider borrowing with & or &mut where possible to avoid unnecessary copies.',
    languages: ['rust'],
  },
  {
    id: 'builtin:rust-unsafe-no-safety',
    name: 'unsafe block without safety comment',
    category: ReviewCategory.SECURITY,
    severity: ReviewSeverity.ERROR,
    pattern(content) {
      const matches = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/\bunsafe\s*\{/.test(lines[i])) {
          // Check preceding lines for a safety comment
          const prevLines = i > 0 ? lines.slice(Math.max(0, i - 3), i).join('\n') : '';
          if (!/\b[Ss]afety\b/.test(prevLines) && !/\/\/.*(?:SAFETY|safety)/.test(prevLines)) {
            matches.push({ line: i + 1, column: 0, detail: 'unsafe block lacks a // Safety: comment explaining why it is sound.' });
          }
        }
      }
      return matches;
    },
    message: 'unsafe block without a safety comment — document why the unsafe code is sound.',
    languages: ['rust'],
  },
];
