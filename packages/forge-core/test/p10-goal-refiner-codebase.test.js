import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import GoalRefiner from '../src/goal-refiner/index.js';
import { clearLLMCache } from '../src/llm-client.js';
import {
  createMockStore,
  restoreFetch,
  runRefine,
  successFetch,
  makeTempProject,
} from './p10-goal-refiner-fixtures.js';

// ============================================================================
// 9. Codebase Probing (tested through codebaseProfile in refine result)
// ============================================================================

describe('codebase probing (via refine codebaseProfile)', () => {
  afterEach(() => { restoreFetch(); });

  it('detects React framework from package.json dependencies', async () => {
    clearLLMCache();
    const dir = await makeTempProject({
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add component at src/components/Button.jsx', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.frameworks.includes('React'),
        `expected React in frameworks, got: ${result.codebaseProfile.frameworks}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects Express framework from dependencies', async () => {
    clearLLMCache();
    const dir = await makeTempProject({
      dependencies: { express: '^4.18.0' },
    });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add route at src/routes/api.js', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.frameworks.includes('Express'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects Next.js framework from dependencies', async () => {
    clearLLMCache();
    const dir = await makeTempProject({
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
    });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add page at src/pages/about.jsx', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.frameworks.includes('Next.js'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects vitest test framework from devDependencies', async () => {
    clearLLMCache();
    const dir = await makeTempProject({
      devDependencies: { vitest: '^1.0.0' },
    });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add test suite at test/utils.test.js', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.testFrameworks.includes('vitest'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects jest test framework from devDependencies', async () => {
    clearLLMCache();
    const dir = await makeTempProject({
      devDependencies: { jest: '^29.0.0' },
    });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add test at test/app.test.js', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.testFrameworks.includes('jest'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects ESM module system from package.json type field', async () => {
    clearLLMCache();
    const dir = await makeTempProject({ type: 'module' });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add module at src/modules/auth.js', projectRoot: dir },
        successFetch(),
      );
      assert.equal(result.codebaseProfile.moduleSystem, 'esm');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects CJS module system from package.json type field', async () => {
    clearLLMCache();
    const dir = await makeTempProject({ type: 'commonjs' });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add module at src/modules/db.js', projectRoot: dir },
        successFetch(),
      );
      assert.equal(result.codebaseProfile.moduleSystem, 'cjs');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects monorepo from pnpm-workspace.yaml', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add package at packages/new-lib/src/index.js', projectRoot: dir },
        successFetch(),
      );
      assert.equal(result.codebaseProfile.monorepo, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects monorepo from lerna.json', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await writeFile(join(dir, 'lerna.json'), '{}');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add package at packages/core/src/index.js', projectRoot: dir },
        successFetch(),
      );
      assert.equal(result.codebaseProfile.monorepo, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports monorepo=false when no workspace markers exist', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add feature at src/feature.js', projectRoot: dir },
        successFetch(),
      );
      assert.equal(result.codebaseProfile.monorepo, false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects TypeScript language from .ts files', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.ts'), 'export const x = 1;\n');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add type guard at src/guards/type.ts', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.languages.includes('ts'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects JavaScript language from .js files', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'app.js'), 'export default {};\n');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add utility at src/utils/format.js', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.languages.includes('js'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('counts files by extension', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'a.js'), '');
    await writeFile(join(dir, 'src', 'b.js'), '');
    await writeFile(join(dir, 'src', 'c.ts'), '');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add helper at src/helpers/parse.js', projectRoot: dir },
        successFetch(),
      );
      const counts = result.codebaseProfile.fileCountsByExt;
      assert.ok(counts['.js'] >= 2, `expected at least 2 .js files, got ${counts['.js']}`);
      assert.ok(counts['.ts'] >= 1, `expected at least 1 .ts file, got ${counts['.ts']}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('skips node_modules and .git directories during probing', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await mkdir(join(dir, 'node_modules', 'some-pkg'), { recursive: true });
    await writeFile(join(dir, 'node_modules', 'some-pkg', 'index.js'), '');
    await mkdir(join(dir, '.git'), { recursive: true });
    await writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add feature at src/feature.js', projectRoot: dir },
        successFetch(),
      );
      const treeStr = result.codebaseProfile.tree.join(',');
      assert.ok(!treeStr.includes('node_modules'), 'node_modules should be skipped');
      assert.ok(!treeStr.includes('.git/'), '.git should be skipped');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reads entry points when src/index.js exists', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.js'), 'export { default } from "./app";\n');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add bootstrap at src/bootstrap.js', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.entryPoints.includes('src/index.js'));
      assert.ok(result.codebaseProfile.entryPointContents.length > 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports totalFileCount > 0 for non-empty projects', async () => {
    clearLLMCache();
    const dir = await makeTempProject();
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'a.js'), '');
    await writeFile(join(dir, 'src', 'b.js'), '');
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner({ enableReview: false }),
        store,
        { goalText: 'Add module at src/module.js', projectRoot: dir },
        successFetch(),
      );
      assert.ok(result.codebaseProfile.totalFileCount > 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
