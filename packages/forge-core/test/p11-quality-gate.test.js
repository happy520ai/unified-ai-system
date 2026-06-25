/**
 * P11 QualityGate — construction, evaluate() with good/bad code,
 * anti-pattern detection, CheckSeverity enum, and structure checks.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QualityGate, CheckSeverity } from '../src/quality-gate/index.js';

describe('QualityGate', () => {
  // ── Construction ──────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const gate = new QualityGate();
    assert.ok(gate instanceof QualityGate);
  });

  it('should construct with custom options', () => {
    const gate = new QualityGate({
      minScore: 80,
      requireTests: true,
      requireTypes: true,
      forbiddenPatterns: [/eval\s*\(/],
      requiredPatterns: [/export/],
    });
    assert.ok(gate instanceof QualityGate);
  });

  // ── CheckSeverity enum ────────────────────────────────────────────────

  it('should export CheckSeverity with ERROR, WARNING, INFO', () => {
    assert.equal(CheckSeverity.ERROR, 'error');
    assert.equal(CheckSeverity.WARNING, 'warning');
    assert.equal(CheckSeverity.INFO, 'info');
  });

  it('should freeze CheckSeverity', () => {
    assert.ok(Object.isFrozen(CheckSeverity));
  });

  // ── evaluate() — good code ────────────────────────────────────────────

  it('should pass clean, well-structured code', async () => {
    const gate = new QualityGate({ minScore: 50 });
    const goodCode = [
      "'use strict';",
      '',
      'const { readFile } = require("node:fs/promises");',
      '',
      '/** Read and parse a JSON configuration file. */',
      'async function readConfig(filePath) {',
      '  try {',
      '    const raw = await readFile(filePath, "utf-8");',
      '    return JSON.parse(raw);',
      '  } catch (err) {',
      '    throw new Error("Config error: " + err.message);',
      '  }',
      '}',
      '',
      '/** Validate a configuration object. */',
      'function validateConfig(config) {',
      '  if (!config || typeof config !== "object") {',
      '    throw new Error("Invalid config");',
      '  }',
      '  return true;',
      '}',
      '',
      'module.exports = { readConfig, validateConfig };',
    ].join('\n');

    const result = await gate.evaluate(goodCode, {}, { language: 'js' });
    assert.equal(result.passed, true);
    assert.ok(result.score >= 50);
    assert.equal(result.blockingIssues.length, 0);
  });

  it('should return passed=true with score and checks array', async () => {
    const gate = new QualityGate();
    const code = [
      "import { join } from 'node:path';",
      '',
      '/** Build a file path. */',
      'export function buildPath(base, name) {',
      '  try {',
      '    return join(base, name);',
      '  } catch (err) {',
      '    throw err;',
      '  }',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    assert.equal(typeof result.passed, 'boolean');
    assert.equal(typeof result.score, 'number');
    assert.ok(Array.isArray(result.checks));
    assert.ok(Array.isArray(result.blockingIssues));
    assert.ok(Array.isArray(result.warnings));
  });

  // ── evaluate() — empty code ───────────────────────────────────────────

  it('should fail for empty code', async () => {
    const gate = new QualityGate();
    const result = await gate.evaluate('');
    assert.equal(result.passed, false);
    assert.equal(result.score, 0);
    assert.ok(result.blockingIssues.length > 0);
  });

  it('should fail for non-string input', async () => {
    const gate = new QualityGate();
    const result = await gate.evaluate(null);
    assert.equal(result.passed, false);
    assert.equal(result.score, 0);
  });

  // ── Anti-pattern detection ────────────────────────────────────────────

  it('should detect empty catch blocks as warnings', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const code = [
      'export function risky() {',
      '  try {',
      '    doSomething();',
      '  } catch { /* best-effort */ }',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const emptyCatchCheck = result.checks.find(c => c.name === 'anti_pattern:empty_catch_block');
    assert.ok(emptyCatchCheck, 'should detect empty catch block');
  });

  it('should detect hardcoded secrets as blocking errors', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const code = [
      'export function getConfig() {',
      '  const api_key = "sk-1234567890abcdefghij1234567890";',
      '  return { api_key };',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const secretCheck = result.checks.find(c => c.name === 'anti_pattern:hardcoded_secret');
    assert.ok(secretCheck, 'should detect hardcoded secret');
    assert.equal(secretCheck.severity, CheckSeverity.ERROR);
  });

  it('should detect eval() usage as blocking error', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const code = [
      'export function runCode(input) {',
      '  const result = eval(input);',
      '  return result;',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const evalCheck = result.checks.find(c => c.name === 'anti_pattern:eval_usage');
    assert.ok(evalCheck, 'should detect eval usage');
    assert.equal(evalCheck.severity, CheckSeverity.ERROR);
  });

  it('should detect console.log as warning', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const code = [
      'export function debug(x) {',
      '  console.log("debug:", x);',
      '  return x;',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const consoleCheck = result.checks.find(c => c.name === 'anti_pattern:console_log');
    assert.ok(consoleCheck, 'should detect console.log');
  });

  it('should detect star imports as warning', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const code = [
      "import * as utils from './utils.js';",
      'export function work() {',
      '  try { return utils.format(); } catch(e) { throw e; }',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const starCheck = result.checks.find(c => c.name === 'anti_pattern:star_import');
    assert.ok(starCheck, 'should detect star import');
  });

  // ── Structure checks ──────────────────────────────────────────────────

  it('should check for exports in structure', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const code = [
      'function internalOnly() {',
      '  return 42;',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const exportCheck = result.checks.find(c => c.name === 'structure:has_exports');
    assert.ok(exportCheck, 'should check for exports');
    assert.equal(exportCheck.passed, false);
  });

  it('should pass structure check for code with exports', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const code = [
      'export function hello() {',
      '  try {',
      '    return "world";',
      '  } catch (err) {',
      '    throw err;',
      '  }',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const exportCheck = result.checks.find(c => c.name === 'structure:has_exports');
    assert.ok(exportCheck);
    assert.equal(exportCheck.passed, true);
  });

  // ── Forbidden patterns ────────────────────────────────────────────────

  it('should block code matching forbidden patterns', async () => {
    const gate = new QualityGate({
      minScore: 0,
      forbiddenPatterns: [/process\.exit/],
    });
    const code = [
      'export function shutdown() {',
      '  process.exit(1);',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    assert.equal(result.passed, false);
    assert.ok(result.blockingIssues.some(b => b.includes('Forbidden pattern')));
  });

  // ── Required patterns ─────────────────────────────────────────────────

  it('should block code missing required patterns', async () => {
    const gate = new QualityGate({
      minScore: 0,
      requiredPatterns: [/use strict/],
    });
    const code = [
      'export function hello() {',
      '  return "world";',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    assert.equal(result.passed, false);
    assert.ok(result.blockingIssues.some(b => b.includes('Required pattern missing')));
  });

  // ── requireTests option ───────────────────────────────────────────────

  it('should require test patterns when requireTests is true', async () => {
    const gate = new QualityGate({ minScore: 0, requireTests: true });
    const code = [
      'export function add(a, b) {',
      '  return a + b;',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const testCheck = result.checks.find(c => c.name === 'has_tests');
    assert.ok(testCheck);
    assert.equal(testCheck.passed, false);
  });

  it('should pass test check when test patterns exist', async () => {
    const gate = new QualityGate({ minScore: 0, requireTests: true });
    const code = [
      "import { describe, it } from 'node:test';",
      "import assert from 'node:assert';",
      '',
      'describe("add", () => {',
      '  it("should add numbers", () => {',
      '    assert.equal(1 + 1, 2);',
      '  });',
      '});',
    ].join('\n');

    const result = await gate.evaluate(code);
    const testCheck = result.checks.find(c => c.name === 'has_tests');
    assert.ok(testCheck);
    assert.equal(testCheck.passed, true);
  });

  // ── requireTypes option ───────────────────────────────────────────────

  it('should warn when types are required but missing', async () => {
    const gate = new QualityGate({ minScore: 0, requireTypes: true });
    const code = [
      'export function greet(name) {',
      '  return "Hello " + name;',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code);
    const typeCheck = result.checks.find(c => c.name === 'has_types');
    assert.ok(typeCheck);
    assert.equal(typeCheck.passed, false);
  });

  // ── compareVersions ───────────────────────────────────────────────────

  it('should compare two code versions and report changes', () => {
    const gate = new QualityGate();
    const oldCode = [
      "import { readFile } from 'node:fs/promises';",
      'export function read() {',
      '  return readFile("a.txt", "utf-8");',
      '}',
    ].join('\n');

    const newCode = [
      "import { readFile } from 'node:fs/promises';",
      "import { join } from 'node:path';",
      '',
      '/** Read a file safely. */',
      'export function read(path) {',
      '  try {',
      '    return readFile(join(".", path), "utf-8");',
      '  } catch (err) {',
      '    throw err;',
      '  }',
      '}',
    ].join('\n');

    const comparison = gate.compareVersions(oldCode, newCode);
    assert.equal(typeof comparison.improved, 'boolean');
    assert.ok(Array.isArray(comparison.changes));
    assert.ok(typeof comparison.delta === 'object');
    assert.equal(typeof comparison.delta.lines, 'number');
    assert.equal(typeof comparison.delta.imports, 'number');
    assert.equal(typeof comparison.delta.handlers, 'number');
  });

  // ── Task-specific requirements ────────────────────────────────────────

  it('should check required functions from task', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const task = { requiredFunctions: ['calculateTotal'] };
    const code = [
      'export function calculateTotal(items) {',
      '  try {',
      '    return items.reduce((sum, i) => sum + i.price, 0);',
      '  } catch (err) {',
      '    throw err;',
      '  }',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code, task);
    const fnCheck = result.checks.find(c => c.name === 'requirement:function:calculateTotal');
    assert.ok(fnCheck);
    assert.equal(fnCheck.passed, true);
  });

  it('should fail when required function is missing', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const task = { requiredFunctions: ['calculateTotal'] };
    const code = [
      'export function otherFunction() {',
      '  try { return 1; } catch (e) { throw e; }',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code, task);
    const fnCheck = result.checks.find(c => c.name === 'requirement:function:calculateTotal');
    assert.ok(fnCheck);
    assert.equal(fnCheck.passed, false);
  });

  it('should check required classes from task', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const task = { requiredClasses: ['UserService'] };
    const code = [
      'export class UserService {',
      '  constructor(db) {',
      '    this.db = db;',
      '  }',
      '  async getUser(id) {',
      '    try {',
      '      return this.db.query(id);',
      '    } catch (err) {',
      '      throw err;',
      '    }',
      '  }',
      '}',
    ].join('\n');

    const result = await gate.evaluate(code, task);
    const clsCheck = result.checks.find(c => c.name === 'requirement:class:UserService');
    assert.ok(clsCheck);
    assert.equal(clsCheck.passed, true);
  });

  // ── Language detection ────────────────────────────────────────────────

  it('should detect TypeScript from task expectedFiles', async () => {
    const gate = new QualityGate({ minScore: 0 });
    const task = { expectedFiles: ['src/types.ts'] };
    const code = [
      'interface Config {',
      '  host: string;',
      '  port: number;',
      '}',
      'export function loadConfig(): Config {',
      '  return { host: "localhost", port: 3000 };',
      '}',
    ].join('\n');

    // Should not throw even with TS syntax
    const result = await gate.evaluate(code, task);
    assert.ok(result);
    assert.equal(typeof result.passed, 'boolean');
  });
});
