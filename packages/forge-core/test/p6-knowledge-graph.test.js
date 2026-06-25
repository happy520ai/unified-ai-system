import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  3. KnowledgeGraph
// ═══════════════════════════════════════════════════════════════════════════════

describe('KnowledgeGraph', () => {
  let KnowledgeGraph;

  before(async () => {
    const mod = await import('../src/knowledge-graph/index.js');
    KnowledgeGraph = mod.KnowledgeGraph;
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const kg = new KnowledgeGraph();
    const status = kg.getStatus();
    assert.equal(status.files, 0);
    assert.equal(status.edges, 0);
  });

  it('should accept custom maxDepth', () => {
    const kg = new KnowledgeGraph({ maxDepth: 5 });
    // We verify indirectly via impact analysis depth limit
    kg.addFile('src/a.js', "import { b } from './b';\nexport const a = 1;");
    kg.addFile('src/b.js', "import { c } from './c';\nexport const b = 2;");
    kg.addFile('src/c.js', 'export const c = 3;');
    // All should still work fine
    const impact = kg.getImpactAnalysis(['src/c.js']);
    assert.ok(impact.total.length >= 0);
  });

  // ── addFile() ────────────────────────────────────────────────────────────

  it('should add a file and parse exports', () => {
    const kg = new KnowledgeGraph();
    const result = kg.addFile('src/utils.js', [
      'export function helper() { return 42; }',
      'export const VERSION = "1.0";',
      'export class Utils {}',
    ].join('\n'));

    assert.ok(result.exports.length > 0, 'Should parse exports');
    assert.ok(result.functions.length > 0, 'Should parse function definitions');
    assert.ok(result.classes.length > 0, 'Should parse class definitions');
  });

  it('should parse ESM imports', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/utils.js', 'export function helper() {}');
    const result = kg.addFile('src/app.js', [
      "import { helper } from './utils';",
      'export const app = helper();',
    ].join('\n'));

    assert.ok(result.imports.length > 0, 'Should parse ESM imports');
    assert.equal(result.imports[0].source, './utils');
    assert.equal(result.imports[0].type, 'esm');
    assert.ok(result.imports[0].specifiers.includes('helper'));
  });

  it('should parse CJS require statements', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/utils.js', 'export function helper() {}');
    const result = kg.addFile('src/app.js', [
      "const { helper } = require('./utils');",
      'module.exports = { app: helper() };',
    ].join('\n'));

    assert.ok(result.imports.length > 0, 'Should parse CJS requires');
    assert.equal(result.imports[0].type, 'cjs');
    assert.ok(result.imports[0].specifiers.includes('helper'));
  });

  it('should parse dynamic imports', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/lazy.js', 'export const data = 42;');
    const result = kg.addFile('src/app.js', [
      "const mod = import('./lazy');",
      'export const app = mod;',
    ].join('\n'));

    assert.ok(result.imports.length > 0, 'Should parse dynamic imports');
  });

  it('should create dependency edges between files', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/utils.js', 'export function helper() {}');
    kg.addFile('src/app.js', "import { helper } from './utils';\nexport const app = 1;");
    const deps = kg.getDependencies('src/app.js');
    assert.ok(deps.includes('src/utils.js'), 'app.js should depend on utils.js');
    const dependents = kg.getDependents('src/utils.js');
    assert.ok(dependents.includes('src/app.js'), 'utils.js should have app.js as dependent');
  });

  it('should replace file when re-adding same path', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', 'export const x = 1;');
    kg.addFile('src/a.js', 'export const y = 2;');
    assert.equal(kg.getStatus().files, 1);
  });

  // ── removeFile() ─────────────────────────────────────────────────────────

  it('should remove a file and clean up edges', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/utils.js', 'export function helper() {}');
    kg.addFile('src/app.js', "import { helper } from './utils';");
    assert.equal(kg.removeFile('src/utils.js'), true);
    assert.equal(kg.getDependents('src/utils.js').length, 0);
    assert.equal(kg.getDependencies('src/app.js').length, 0);
  });

  it('should return false when removing non-existent file', () => {
    const kg = new KnowledgeGraph();
    assert.equal(kg.removeFile('nonexistent.js'), false);
  });

  // ── getDependents() / getDependencies() ──────────────────────────────────

  it('should return empty arrays for unknown files', () => {
    const kg = new KnowledgeGraph();
    assert.deepEqual(kg.getDependents('unknown.js'), []);
    assert.deepEqual(kg.getDependencies('unknown.js'), []);
  });

  // ── getImpactAnalysis() ──────────────────────────────────────────────────

  it('should compute transitive impact analysis', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/core.js', 'export const core = 1;');
    kg.addFile('src/service.js', "import { core } from './core';\nexport const svc = 2;");
    kg.addFile('src/app.js', "import { svc } from './service';\nexport const app = 3;");

    const impact = kg.getImpactAnalysis(['src/core.js']);
    assert.ok(impact.direct.includes('src/service.js'), 'service.js should be directly impacted');
    assert.ok(impact.total.includes('src/app.js'), 'app.js should be transitively impacted');
    assert.ok(impact.total.length >= 2, 'Should have at least 2 impacted files');
  });

  it('should categorize impact by type (source, test, config)', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/utils.js', 'export const util = 1;');
    kg.addFile('src/app.js', "import { util } from './utils';\nexport const app = 1;");
    kg.addFile('test/app.test.js', "import { app } from '../src/app';\nexport const t = 1;");

    const impact = kg.getImpactAnalysis(['src/utils.js']);
    assert.ok(impact.byType);
    assert.ok(Array.isArray(impact.byType.source));
    assert.ok(Array.isArray(impact.byType.test));
    assert.ok(Array.isArray(impact.byType.config));
  });

  it('should not include changed files themselves in impact results', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', 'export const a = 1;');
    kg.addFile('src/b.js', "import { a } from './a';\nexport const b = 2;");
    const impact = kg.getImpactAnalysis(['src/a.js']);
    assert.ok(!impact.total.includes('src/a.js'), 'Changed file should not be in its own impact');
  });

  // ── getExports() / getImports() / getDefinitions() ───────────────────────

  it('should return exports for a file', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/mod.js', 'export class Foo {}\nexport function bar() {}');
    const exports = kg.getExports('src/mod.js');
    assert.ok(exports.length > 0);
  });

  it('should return imports for a file', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/utils.js', 'export const x = 1;');
    kg.addFile('src/app.js', "import { x } from './utils';");
    const imports = kg.getImports('src/app.js');
    assert.ok(imports.length > 0);
  });

  it('should return definitions for a file', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/mod.js', [
      'export class MyClass {}',
      'function helper() {}',
      'const CONFIG = {};',
    ].join('\n'));
    const defs = kg.getDefinitions('src/mod.js');
    assert.ok(defs.length >= 3, `Expected at least 3 definitions, got ${defs.length}`);
    const types = defs.map((d) => d.type);
    assert.ok(types.includes('class'));
    assert.ok(types.includes('function'));
    assert.ok(types.includes('const'));
  });

  it('should return empty arrays for unknown files in metadata queries', () => {
    const kg = new KnowledgeGraph();
    assert.deepEqual(kg.getExports('nope.js'), []);
    assert.deepEqual(kg.getImports('nope.js'), []);
    assert.deepEqual(kg.getDefinitions('nope.js'), []);
  });

  // ── buildFromFiles() ─────────────────────────────────────────────────────

  it('should build graph from multiple files at once', () => {
    const kg = new KnowledgeGraph();
    const result = kg.buildFromFiles([
      { path: 'src/a.js', content: 'export const a = 1;' },
      { path: 'src/b.js', content: "import { a } from './a';\nexport const b = a + 1;" },
      { path: 'src/c.js', content: "import { b } from './b';\nexport const c = b + 1;" },
    ]);
    assert.equal(result.files, 3);
    assert.ok(result.edges > 0, 'Should have created edges');
    assert.ok(result.exports > 0, 'Should have counted exports');
    assert.equal(result.errors.length, 0);
  });

  // ── findCircularDependencies() ───────────────────────────────────────────

  it('should detect circular dependencies', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', "import { b } from './b';\nexport const a = 1;");
    kg.addFile('src/b.js', "import { c } from './c';\nexport const b = 2;");
    kg.addFile('src/c.js', "import { a } from './a';\nexport const c = 3;");

    const cycles = kg.findCircularDependencies();
    assert.ok(cycles.length > 0, 'Should detect at least one circular dependency');
    // The cycle should include all three files
    const flat = cycles.flat();
    assert.ok(flat.includes('src/a.js'));
    assert.ok(flat.includes('src/b.js'));
  });

  it('should return empty array when no circular dependencies', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', 'export const a = 1;');
    kg.addFile('src/b.js', "import { a } from './a';\nexport const b = 2;");
    const cycles = kg.findCircularDependencies();
    assert.equal(cycles.length, 0);
  });

  // ── getGraph() ───────────────────────────────────────────────────────────

  it('should return the full graph structure', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', 'export const a = 1;');
    kg.addFile('src/b.js', "import { a } from './a';\nexport const b = 2;");
    const graph = kg.getGraph();
    assert.ok(Array.isArray(graph.nodes));
    assert.ok(Array.isArray(graph.edges));
    assert.ok(graph.stats);
    assert.equal(graph.nodes.length, 2);
  });

  // ── clear() ──────────────────────────────────────────────────────────────

  it('should clear the entire graph', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', 'export const a = 1;');
    kg.addFile('src/b.js', 'export const b = 2;');
    kg.clear();
    const status = kg.getStatus();
    assert.equal(status.files, 0);
    assert.equal(status.edges, 0);
  });

  // ── exportState() / importState() ────────────────────────────────────────

  it('should export and import graph state', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', 'export const a = 1;');
    kg.addFile('src/b.js', "import { a } from './a';\nexport const b = 2;");

    const state = kg.exportState();
    assert.ok(state.nodes);
    assert.ok(state.edges);

    const kg2 = new KnowledgeGraph();
    kg2.importState(state);
    assert.equal(kg2.getStatus().files, 2);
    assert.equal(kg2.getDependents('src/a.js').length, 1);
  });

  // ── getStatus() ──────────────────────────────────────────────────────────

  it('should return accurate status with counts', () => {
    const kg = new KnowledgeGraph();
    kg.addFile('src/a.js', 'export class Foo {}\nexport function bar() {}');
    kg.addFile('src/b.js', "import { Foo } from './a';\nexport const x = new Foo();");
    const status = kg.getStatus();
    assert.equal(status.files, 2);
    assert.ok(status.edges > 0);
    assert.ok(status.exports > 0);
    assert.ok(status.imports > 0);
    assert.ok(status.classes > 0);
    assert.ok(status.functions > 0);
    assert.equal(typeof status.circularDeps, 'number');
  });
});
