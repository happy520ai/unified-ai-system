/**
 * QualityGate helper functions — pure utilities extracted from index.js.
 * @module quality-gate/helpers
 */

import { Script } from 'node:vm';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULTS = Object.freeze({
  minScore: 70,
  requireTests: false,
  requireTypes: false,
  forbiddenPatterns: [],
  requiredPatterns: [],
});

export const CheckSeverity = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

// ─── Pure Functions ───────────────────────────────────────────────────────────

/** Compare two versions of code and assess improvement. */
export function compareVersions(oldCode, newCode) {
  const oldLines = (oldCode || '').split('\n');
  const newLines = (newCode || '').split('\n');
  const oldImports = (oldCode || '').match(/^\s*(?:import\s|const\s+\w+\s*=\s*require\s*\()/gm) || [];
  const newImports = (newCode || '').match(/^\s*(?:import\s|const\s+\w+\s*=\s*require\s*\()/gm) || [];
  const oldHandlers = (oldCode || '').match(/\b(?:try\s*\{|\.catch\s*\()/g) || [];
  const newHandlers = (newCode || '').match(/\b(?:try\s*\{|\.catch\s*\()/g) || [];
  const oldTests = (oldCode || '').match(/\b(?:describe|it|test)\s*\(/g) || [];
  const newTests = (newCode || '').match(/\b(?:describe|it|test)\s*\(/g) || [];
  const oldComments = (oldCode || '').match(/(?:\/\*\*|\/\/\s+\w)/g) || [];
  const newComments = (newCode || '').match(/(?:\/\*\*|\/\/\s+\w)/g) || [];

  const changes = [];
  if (newLines.length !== oldLines.length) {
    const delta = newLines.length - oldLines.length;
    changes.push(`Line count: ${delta > 0 ? '+' : ''}${delta} (${oldLines.length} → ${newLines.length})`);
  }
  if (newImports.length !== oldImports.length) {
    changes.push(`Imports: ${newImports.length - oldImports.length > 0 ? '+' : ''}${newImports.length - oldImports.length} (${oldImports.length} → ${newImports.length})`);
  }
  if (newHandlers.length !== oldHandlers.length) {
    changes.push(`Error handlers: ${newHandlers.length - oldHandlers.length > 0 ? '+' : ''}${newHandlers.length - oldHandlers.length}`);
  }
  if (newTests.length !== oldTests.length) {
    changes.push(`Tests: ${newTests.length - oldTests.length > 0 ? '+' : ''}${newTests.length - oldTests.length}`);
  }
  if (newComments.length !== oldComments.length) {
    changes.push(`Comments: ${newComments.length - oldComments.length > 0 ? '+' : ''}${newComments.length - oldComments.length}`);
  }

  const improved = (
    newHandlers.length >= oldHandlers.length &&
    newImports.length >= oldImports.length &&
    newTests.length >= oldTests.length &&
    newLines.length > 0
  );

  return {
    improved,
    changes,
    delta: {
      lines: newLines.length - oldLines.length,
      imports: newImports.length - oldImports.length,
      handlers: newHandlers.length - oldHandlers.length,
      tests: newTests.length - oldTests.length,
      comments: newComments.length - oldComments.length,
    },
  };
}

/** Convert a character offset to a 1-based line number. */
export function offsetToLine(code, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < code.length; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

/** Check for common anti-patterns in generated code. */
export function checkAntiPatterns(code) {
  const findings = [];
  // 1. Empty catch blocks
  {
    const emptyCatch = /catch\s*\([^)]*\)\s*\{\s*\}/g;
    let m;
    while ((m = emptyCatch.exec(code)) !== null) {
      const line = offsetToLine(code, m.index);
      findings.push({
        pattern: 'empty_catch_block', severity: 'warning', line,
        suggestion: `Empty catch block at line ${line} — consider logging or rethrowing the error.`,
      });
    }
  }
  // 2. Hardcoded secrets
  {
    const secretPatterns = [
      /(?:api[_-]?key|secret|token|password|credential)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi,
      /(?:sk|pk|ak)[-_][A-Za-z0-9]{20,}/g,
    ];
    for (const pat of secretPatterns) {
      const m = code.match(pat);
      if (m) {
        findings.push({
          pattern: 'hardcoded_secret', severity: 'error',
          line: offsetToLine(code, code.indexOf(m[0])),
          suggestion: `Possible hardcoded secret detected: "${m[0].slice(0, 30)}..." — use environment variables instead.`,
        });
      }
    }
  }
  // 3. Star imports
  {
    const starImport = /import\s+\*\s+as\s+\w+\s+from/g;
    if (starImport.test(code)) {
      findings.push({
        pattern: 'star_import', severity: 'warning',
        suggestion: 'Overly broad import (import *) — prefer named imports for better tree-shaking.',
      });
    }
  }
  // 4. eval() usage
  {
    const evalUsage = /\beval\s*\(/g;
    let m;
    while ((m = evalUsage.exec(code)) !== null) {
      const lineStart = code.lastIndexOf('\n', m.index) + 1;
      const lineText = code.slice(lineStart, code.indexOf('\n', m.index));
      if (!lineText.trimStart().startsWith('//') && !lineText.trimStart().startsWith('*')) {
        findings.push({
          pattern: 'eval_usage', severity: 'error', line: offsetToLine(code, m.index),
          suggestion: 'eval() usage detected — this is a security risk. Use safer alternatives.',
        });
      }
    }
  }
  // 5. console.log
  {
    const consoleLog = /\bconsole\.log\s*\(/g;
    let m;
    let count = 0;
    while ((m = consoleLog.exec(code)) !== null) count++;
    if (count > 0) {
      findings.push({
        pattern: 'console_log', severity: 'warning',
        suggestion: `${count} console.log statement(s) found — remove from production code.`,
      });
    }
  }
  // 6. TODO-only functions
  {
    const todoOnlyFn = /(?:function\s+\w+|[a-zA-Z_$][\w$]*\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))\s*\{[\s\n]*\/\/\s*TODO[\s\S]*?\}/gi;
    if (todoOnlyFn.test(code)) {
      findings.push({
        pattern: 'todo_only_function', severity: 'warning',
        suggestion: 'Function with only a TODO comment — implement the function body.',
      });
    }
  }
  // 7. Infinite loop risk
  {
    const infiniteLoop = /while\s*\(\s*true\s*\)\s*\{/g;
    let m;
    while ((m = infiniteLoop.exec(code)) !== null) {
      const afterLoop = code.slice(m.index, m.index + 500);
      if (!/\b(?:break|return|throw)\b/.test(afterLoop)) {
        findings.push({
          pattern: 'infinite_loop_risk', severity: 'error', line: offsetToLine(code, m.index),
          suggestion: 'Possible infinite loop (while(true)) without break/return/throw.',
        });
      }
    }
  }
  // 8. Missing null checks
  {
    const longChain = /\b[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\.[a-zA-Z_$]/g;
    let chainCount = 0;
    let m;
    while ((m = longChain.exec(code)) !== null) {
      chainCount++;
      if (chainCount > 5) {
        findings.push({
          pattern: 'missing_null_check', severity: 'info',
          suggestion: 'Multiple deep property chains detected — consider optional chaining (?.) for null safety.',
        });
        break;
      }
    }
  }
  return findings;
}

/** Check bracket balancing for generic code. */
export function checkBalancedBrackets(code) {
  const errors = [];
  let braceDepth = 0, parenDepth = 0, bracketDepth = 0;
  let inString = false, stringChar = null, escaped = false;
  let inLineComment = false, inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1] || '';
    if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (inString) { if (ch === stringChar) inString = false; continue; }
    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
    if (braceDepth < -1 || parenDepth < -1 || bracketDepth < -1) {
      errors.push('Unbalanced closing brackets');
      break;
    }
  }
  if (braceDepth !== 0) errors.push(`Unbalanced braces (depth: ${braceDepth})`);
  if (parenDepth !== 0) errors.push(`Unbalanced parentheses (depth: ${parenDepth})`);
  if (bracketDepth !== 0) errors.push(`Unbalanced square brackets (depth: ${bracketDepth})`);
  return { errors };
}

/** Run a syntax check on the code. For JS uses node:vm; for TS/other uses structural checks. */
export function checkSyntax(code, language) {
  const errors = [];
  if (language === 'js') {
    try {
      new Script(code, { filename: 'quality-gate-check.js' });
    } catch (err) {
      errors.push(err.message || 'Unknown syntax error');
    }
  } else if (language === 'ts') {
    const balanceResult = checkBalancedBrackets(code);
    errors.push(...balanceResult.errors);
    const backtickCount = (code.match(/`/g) || []).length;
    if (backtickCount % 2 !== 0) errors.push('Unclosed template literal (odd number of backticks)');
    const singleQuotes = (code.match(/(?<!\\)'/g) || []).length;
    const doubleQuotes = (code.match(/(?<!\\)"/g) || []).length;
    if (singleQuotes % 2 !== 0) errors.push('Unclosed single-quoted string');
    if (doubleQuotes % 2 !== 0) errors.push('Unclosed double-quoted string');
  } else {
    const balanceResult = checkBalancedBrackets(code);
    errors.push(...balanceResult.errors);
  }
  return { valid: errors.length === 0, errors };
}

/** Detect the language of the code from content and task hints. */
export function detectLanguage(code, task) {
  if (task.expectedFiles?.length > 0) {
    const firstFile = task.expectedFiles[0];
    if (firstFile.endsWith('.ts') || firstFile.endsWith('.tsx')) return 'ts';
    if (firstFile.endsWith('.js') || firstFile.endsWith('.mjs') || firstFile.endsWith('.cjs')) return 'js';
  }
  if (task.language) return task.language;
  const hasTypeAnnotations = /(?::\s*(?:string|number|boolean|void|any|unknown|never)\b|\binterface\s+\w|\btype\s+\w+\s*=|<[A-Z]\w*>)/.test(code);
  const hasImportFrom = /\bimport\s+.*\bfrom\b/.test(code);
  const hasTypeScriptKeyword = /\b(?:as\s+const|satisfies\b|readonly\s+\[)/.test(code);
  if (hasTypeScriptKeyword || (hasTypeAnnotations && hasImportFrom)) return 'ts';
  if (hasImportFrom || /\b(?:const|let|class|function|export|import)\b/.test(code)) return 'js';
  return 'other';
}

/** Compute a quality score (0-100) from check results, weighted by severity. */
export function computeScore(checks) {
  if (checks.length === 0) return 0;
  let totalWeight = 0, earnedWeight = 0;
  for (const check of checks) {
    let weight;
    switch (check.severity) {
      case CheckSeverity.ERROR: weight = 10; break;
      case CheckSeverity.WARNING: weight = 3; break;
      case CheckSeverity.INFO: weight = 1; break;
      default: weight = 1;
    }
    totalWeight += weight;
    if (check.passed) earnedWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((earnedWeight / totalWeight) * 100);
}

/** Check code structure: exports, imports, parameters, dead code, error propagation. */
export function checkStructure(code, task) {
  const results = [];
  {
    const hasExports = /\b(?:export\s+(?:default\s+)?(?:class|function|const|let|var|async)|module\.exports\b)/.test(code);
    results.push({ check: 'has_exports', passed: hasExports,
      detail: hasExports ? 'Export declarations found' : 'No export declarations found' });
  }
  {
    const hasImports = /\b(?:import\s|require\s*\()/.test(code);
    const hasExternalRefs = /\b(?:new\s+\w{2,}|\w+\.\w+\()/g.test(code);
    const passed = hasImports || !hasExternalRefs;
    results.push({ check: 'imports_for_dependencies', passed,
      detail: passed ? 'OK' : 'External references used without import statements' });
  }
  {
    const fnDecls = code.match(/(?:function\s+\w+|=>)\s*\(/g) || [];
    const fnWithParams = code.match(/(?:function\s+\w+|=>)\s*\([^)]+\)/g) || [];
    const passed = fnDecls.length === 0 || fnWithParams.length > 0;
    results.push({ check: 'functions_have_parameters', passed,
      detail: passed ? 'OK' : 'All functions are zero-argument — may indicate placeholder code' });
  }
  results.push({ check: 'no_dead_code', passed: true, detail: 'Dead code heuristic: informational only' });
  {
    const catchBlocks = code.match(/catch\s*\([^)]*\)\s*\{([^}]*)\}/g) || [];
    const emptyCatches = catchBlocks.filter(b => /\{\s*\}/.test(b));
    const passed = emptyCatches.length === 0;
    results.push({ check: 'error_propagation', passed,
      detail: passed ? 'OK' : `${emptyCatches.length} empty catch block(s) — errors may be silently swallowed` });
  }
  return results;
}

/** Check generated code against task-specific requirements. */
export function checkRequirements(code, task) {
  const results = [];
  if (!task || typeof task !== 'object') return results;
  if (Array.isArray(task.requiredFunctions) && task.requiredFunctions.length > 0) {
    for (const fnName of task.requiredFunctions) {
      const pattern = new RegExp(`(?:function\\s+${fnName}\\b|(?:const|let|var)\\s+${fnName}\\s*=|${fnName}\\s*\\([^)]*\\)\\s*\\{)`, 'g');
      const found = pattern.test(code);
      results.push({ requirement: `function:${fnName}`, met: found,
        detail: found ? `Function "${fnName}" found` : `Required function "${fnName}" not found` });
    }
  }
  if (Array.isArray(task.requiredClasses) && task.requiredClasses.length > 0) {
    for (const className of task.requiredClasses) {
      const pattern = new RegExp(`class\\s+${className}\\b`, 'g');
      const found = pattern.test(code);
      results.push({ requirement: `class:${className}`, met: found,
        detail: found ? `Class "${className}" found` : `Required class "${className}" not found` });
    }
  }
  if (task.requireErrorHandling) {
    const hasErrorHandling = /\btry\s*\{/.test(code) || /\.catch\s*\(/.test(code);
    results.push({ requirement: 'error_handling', met: hasErrorHandling,
      detail: hasErrorHandling ? 'Error handling present' : 'Error handling required but not found' });
  }
  if (task.isTestFile || task.type === 'test') {
    const hasDescribe = /\bdescribe\s*\(/.test(code);
    const hasIt = /\b(?:it|test)\s*\(/.test(code);
    const hasAssertions = /\b(?:expect|assert|should)\b/.test(code);
    results.push({ requirement: 'test_structure', met: hasDescribe && hasIt,
      detail: hasDescribe && hasIt
        ? 'Test structure (describe + it/test) present'
        : `Test file missing structure: describe=${hasDescribe}, it/test=${hasIt}` });
    results.push({ requirement: 'test_assertions', met: hasAssertions,
      detail: hasAssertions ? 'Assertions found' : 'No assertions (expect/assert/should) found in test file' });
  }
  if (Array.isArray(task.expectedFiles) && task.expectedFiles.length > 0) {
    for (const filePath of task.expectedFiles) {
      const baseName = filePath.replace(/^.*[\\/]/, '').replace(/\.\w+$/, '');
      if (baseName.length > 1) {
        const pattern = new RegExp(`(?:import.*${baseName}|require.*${baseName}|from\\s+['"].*${baseName})`, 'i');
        const found = pattern.test(code);
        if (!found) {
          results.push({ requirement: `references:${baseName}`, met: false,
            detail: `Expected reference to "${baseName}" from ${filePath} not found` });
        }
      }
    }
  }
  if (Array.isArray(task.constraints) && task.constraints.length > 0) {
    for (const constraint of task.constraints) {
      if (typeof constraint === 'string' && constraint.startsWith('regex:')) {
        const regexStr = constraint.slice(6);
        try {
          const regex = new RegExp(regexStr);
          const found = regex.test(code);
          results.push({ requirement: `constraint:${regexStr.slice(0, 40)}`, met: found,
            detail: found ? 'Constraint met' : `Constraint not met: ${regexStr.slice(0, 60)}` });
        } catch { /* Invalid regex — skip */ }
      }
    }
  }
  return results;
}

// ─── JSDoc Type Definitions ──────────────────────────────────────────────────

/** @typedef {{ minScore: number, requireTests: boolean, requireTypes: boolean, forbiddenPatterns: Array<RegExp|string>, requiredPatterns: Array<RegExp|string> }} QualityGateOptions */
/** @typedef {{ passed: boolean, score: number, checks: QualityCheckResult[], blockingIssues: string[], warnings: string[] }} EvaluationResult */
/** @typedef {{ name: string, passed: boolean, severity: string, detail: string }} QualityCheckResult */
/** @typedef {{ pattern: string, severity: string, line?: number, suggestion: string }} AntiPatternResult */
/** @typedef {{ check: string, passed: boolean, detail: string }} StructureCheckResult */
/** @typedef {{ requirement: string, met: boolean, detail: string }} RequirementCheckResult */
/** @typedef {{ improved: boolean, changes: string[], delta: { lines: number, imports: number, handlers: number, tests: number, comments: number } }} VersionComparison */
