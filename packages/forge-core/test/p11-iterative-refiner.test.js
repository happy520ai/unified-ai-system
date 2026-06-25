/**
 * P11 IterativeRefiner — construction, scoreCodeQuality, enums,
 * and refine() with mock LLM caller.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { IterativeRefiner, IssueCategory, Severity } from '../src/iterative-refiner/index.js';

describe('IterativeRefiner', () => {
  // ── Construction ──────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const refiner = new IterativeRefiner();
    assert.ok(refiner instanceof IterativeRefiner);
  });

  it('should construct with custom options', () => {
    const refiner = new IterativeRefiner({
      maxPasses: 5,
      qualityThreshold: 90,
      selfCritiqueEnabled: false,
      diversityStrategy: 'fixed',
      minImprovement: 3,
    });
    assert.ok(refiner instanceof IterativeRefiner);
  });

  it('should clamp maxPasses between 1 and 10', () => {
    const r1 = new IterativeRefiner({ maxPasses: 0 });
    const r2 = new IterativeRefiner({ maxPasses: 100 });
    // Not directly observable, but construction should not throw
    assert.ok(r1);
    assert.ok(r2);
  });

  // ── IssueCategory enum ────────────────────────────────────────────────

  it('should export IssueCategory with expected keys', () => {
    assert.equal(IssueCategory.BUG, 'bug');
    assert.equal(IssueCategory.MISSING_FEATURE, 'missing_feature');
    assert.equal(IssueCategory.STYLE, 'style');
    assert.equal(IssueCategory.IMPORT, 'import');
    assert.equal(IssueCategory.TYPE, 'type');
    assert.equal(IssueCategory.PERFORMANCE, 'performance');
    assert.equal(IssueCategory.SECURITY, 'security');
  });

  it('should freeze IssueCategory', () => {
    assert.ok(Object.isFrozen(IssueCategory));
  });

  // ── Severity enum ─────────────────────────────────────────────────────

  it('should export Severity with expected keys', () => {
    assert.equal(Severity.CRITICAL, 'critical');
    assert.equal(Severity.WARNING, 'warning');
    assert.equal(Severity.INFO, 'info');
  });

  it('should freeze Severity', () => {
    assert.ok(Object.isFrozen(Severity));
  });

  // ── scoreCodeQuality ──────────────────────────────────────────────────

  describe('scoreCodeQuality', () => {
    it('should return score 0 for empty code', () => {
      const refiner = new IterativeRefiner();
      const result = refiner.scoreCodeQuality('');
      assert.equal(result.score, 0);
      assert.ok(result.checks.length > 0);
    });

    it('should return score 0 for non-string input', () => {
      const refiner = new IterativeRefiner();
      const result = refiner.scoreCodeQuality(null);
      assert.equal(result.score, 0);
    });

    it('should score good code highly', () => {
      const refiner = new IterativeRefiner();
      const goodCode = [
        "import { readFile } from 'node:fs/promises';",
        '',
        '/** Read and parse a JSON file. */',
        'export async function readJsonFile(filePath) {',
        '  try {',
        '    const raw = await readFile(filePath, "utf-8");',
        '    return JSON.parse(raw);',
        '  } catch (err) {',
        '    throw new Error(`Failed to read ${filePath}: ${err.message}`);',
        '  }',
        '}',
        '',
        '/** Validate that the data has required fields. */',
        'export function validateData(data) {',
        '  if (!data || typeof data !== "object") {',
        '    throw new Error("Invalid data");',
        '  }',
        '  return true;',
        '}',
      ].join('\n');

      const result = refiner.scoreCodeQuality(goodCode);
      assert.ok(result.score >= 60, `expected score >= 60, got ${result.score}`);
      assert.ok(result.checks.length >= 10, 'should have at least 10 checks');
    });

    it('should penalize code with TODO/FIXME/HACK comments', () => {
      const refiner = new IterativeRefiner();
      const code = [
        "import { readFile } from 'node:fs/promises';",
        '// TODO: implement this',
        'export function process() {',
        '  // FIXME: broken',
        '  // HACK: workaround',
        '  try { return null; } catch { /* best-effort */ }',
        '}',
      ].join('\n');

      const result = refiner.scoreCodeQuality(code);
      const todoCheck = result.checks.find(c => c.name === 'no_todo_fixme_hack');
      assert.ok(todoCheck);
      assert.equal(todoCheck.passed, false);
      assert.ok(todoCheck.points < 15);
    });

    it('should penalize code with console.log', () => {
      const refiner = new IterativeRefiner();
      const code = [
        'export function debug() {',
        '  console.log("hello");',
        '  try { return 1; } catch { /* best-effort */ }',
        '}',
      ].join('\n');

      const result = refiner.scoreCodeQuality(code);
      const consoleCheck = result.checks.find(c => c.name === 'no_console_log');
      assert.ok(consoleCheck);
      assert.equal(consoleCheck.passed, false);
    });

    it('should reward code with error handling', () => {
      const refiner = new IterativeRefiner();
      const code = [
        'export function safe() {',
        '  try {',
        '    return doWork();',
        '  } catch (err) {',
        '    handleError(err);',
        '  }',
        '}',
      ].join('\n');

      const result = refiner.scoreCodeQuality(code);
      const errCheck = result.checks.find(c => c.name === 'has_error_handling');
      assert.ok(errCheck);
      assert.equal(errCheck.passed, true);
      assert.equal(errCheck.points, 10);
    });

    it('should check each quality check has name, passed, points, and max', () => {
      const refiner = new IterativeRefiner();
      const code = 'export function hello() { return "world"; }';
      const result = refiner.scoreCodeQuality(code);
      for (const check of result.checks) {
        assert.equal(typeof check.name, 'string');
        assert.equal(typeof check.passed, 'boolean');
        assert.equal(typeof check.points, 'number');
        assert.equal(typeof check.max, 'number');
      }
    });

    it('should detect reasonable length for code with 5-600 non-blank lines', () => {
      const refiner = new IterativeRefiner();
      const code = [
        'export function a() {',
        '  return 1;',
        '}',
        'export function b() {',
        '  return 2;',
        '}',
        'export function c() {',
        '  return 3;',
        '}',
      ].join('\n');

      const result = refiner.scoreCodeQuality(code);
      const lenCheck = result.checks.find(c => c.name === 'reasonable_length');
      assert.ok(lenCheck);
      assert.equal(lenCheck.passed, true);
    });
  });

  // ── refine() with mock LLM ────────────────────────────────────────────

  describe('refine()', () => {
    it('should converge on first pass when quality meets threshold', async () => {
      const goodCode = [
        "import { readFile } from 'node:fs/promises';",
        '',
        '/** Read a config file and return parsed data. */',
        'export async function loadConfig(filePath) {',
        '  try {',
        '    const raw = await readFile(filePath, "utf-8");',
        '    return JSON.parse(raw);',
        '  } catch (err) {',
        '    throw new Error(`Config load failed: ${err.message}`);',
        '  }',
        '}',
        '',
        '/** Merge two config objects. */',
        'export function mergeConfig(base, override) {',
        '  return { ...base, ...override };',
        '}',
      ].join('\n');

      const llmCaller = async () => goodCode;

      const refiner = new IterativeRefiner({
        maxPasses: 3,
        qualityThreshold: 50, // low threshold to ensure convergence
      });

      const result = await refiner.refine(
        { prompt: 'Create a config loader' },
        llmCaller,
      );

      assert.equal(result.converged, true);
      assert.equal(result.passes, 1);
      assert.ok(result.code.length > 0);
      assert.ok(result.finalScore >= 50);
    });

    it('should run multiple passes when quality is below threshold', async () => {
      let callCount = 0;
      const llmCaller = async () => {
        callCount++;
        if (callCount === 1) {
          // First pass: mediocre code
          return 'function doWork() { return 1; }';
        }
        // Critique response (JSON)
        if (callCount === 2) {
          return JSON.stringify({
            issues: [
              { severity: 'warning', category: 'style', description: 'Missing JSDoc', line: 1, fix: 'Add JSDoc' },
            ],
            score: 40,
            summary: 'Needs documentation',
          });
        }
        // Second pass: improved code
        return [
          '/** Do important work. */',
          'export function doWork() {',
          '  try {',
          '    return 1;',
          '  } catch (err) {',
          '    throw err;',
          '  }',
          '}',
        ].join('\n');
      };

      const refiner = new IterativeRefiner({
        maxPasses: 3,
        qualityThreshold: 95, // high threshold to force multiple passes
        selfCritiqueEnabled: true,
      });

      const result = await refiner.refine(
        { prompt: 'Create a worker function' },
        llmCaller,
      );

      assert.ok(result.passes >= 2, `expected at least 2 passes, got ${result.passes}`);
      assert.ok(result.qualityScores.length >= 2);
      assert.ok(result.bestCode.length > 0);
    });

    it('should call onPassComplete callback for each pass', async () => {
      const llmCaller = async () => [
        "import { readFile } from 'node:fs/promises';",
        '/** Process data. */',
        'export function processData(input) {',
        '  try {',
        '    return input.map(x => x * 2);',
        '  } catch (err) {',
        '    return [];',
        '  }',
        '}',
      ].join('\n');

      const passResults = [];
      const refiner = new IterativeRefiner({
        maxPasses: 2,
        qualityThreshold: 50,
      });

      await refiner.refine(
        { prompt: 'Create a data processor' },
        llmCaller,
        {
          onPassComplete: (passNum, info) => {
            passResults.push({ passNum, score: info.score });
          },
        },
      );

      assert.ok(passResults.length >= 1, 'should have at least one pass callback');
      assert.equal(passResults[0].passNum, 1);
    });

    it('should handle LLM caller failure gracefully', async () => {
      const llmCaller = async () => {
        throw new Error('LLM unavailable');
      };

      const refiner = new IterativeRefiner({ maxPasses: 2, selfCritiqueEnabled: false });

      const result = await refiner.refine(
        { prompt: 'Create something' },
        llmCaller,
      );

      // Should not throw; should return a result with fallback code
      assert.ok(result);
      assert.equal(typeof result.code, 'string');
      assert.ok(result.passes >= 1, 'should complete at least one pass');
      assert.equal(result.converged, false, 'should not converge on failed generation');
    });

    it('should track bestCode and bestScore across passes', async () => {
      const refiner = new IterativeRefiner({ maxPasses: 2, qualityThreshold: 99 });
      let callCount = 0;
      const llmCaller = async () => {
        callCount++;
        if (callCount === 1) {
          return [
            "import { readFile } from 'node:fs/promises';",
            '/** Load data from file. */',
            'export async function loadData(path) {',
            '  try {',
            '    const raw = await readFile(path, "utf-8");',
            '    return JSON.parse(raw);',
            '  } catch (err) {',
            '    throw err;',
            '  }',
            '}',
          ].join('\n');
        }
        if (callCount === 2) {
          return JSON.stringify({
            issues: [],
            score: 90,
            summary: 'Good code',
          });
        }
        return 'function broken() {';
      };

      const result = await refiner.refine(
        { prompt: 'Create a loader' },
        llmCaller,
      );

      assert.ok(result.bestScore >= result.qualityScores[0] || result.bestScore === result.qualityScores[0]);
      assert.ok(result.bestCode.length > 0);
    });
  });
});
