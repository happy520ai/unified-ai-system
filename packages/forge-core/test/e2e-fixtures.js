/**
 * Shared fixtures and helpers for E2E integration tests.
 */

import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// MockLLM: returns predictable JSON responses based on prompt patterns
// ---------------------------------------------------------------------------

export function mockCallLLM(userPrompt) {
  const prompt = (userPrompt || '').toLowerCase();

  if (prompt.includes('implement') || prompt.includes('write') || prompt.includes('create')) {
    return {
      actions: [
        {
          type: 'write',
          path: 'src/generated.js',
          content: '// Auto-generated module\nexport function greet(name) {\n  return `Hello, ${name}!`;\n}\n',
        },
      ],
      summary: 'Implemented the requested module with a greet function.',
    };
  }

  if (prompt.includes('test') || prompt.includes('verify')) {
    return {
      actions: [
        {
          type: 'write',
          path: 'test/generated.test.js',
          content:
            "import assert from 'node:assert';\nimport { greet } from '../src/generated.js';\n" +
            "assert.strictEqual(greet('world'), 'Hello, world!');\n",
        },
      ],
      summary: 'Wrote a test file for the generated module.',
    };
  }

  if (prompt.includes('explore') || prompt.includes('analyze') || prompt.includes('read')) {
    return {
      actions: [],
      summary: 'Analyzed the project structure. Found 3 source files with no issues.',
    };
  }

  return {
    actions: [],
    summary: 'No specific action required.',
  };
}

// ---------------------------------------------------------------------------
// TempProject: creates a temp directory with sample source files
// ---------------------------------------------------------------------------

export class TempProject {
  constructor() {
    this.dir = null;
  }

  async setup() {
    this.dir = await mkdtemp(join(tmpdir(), 'forge-e2e-'));

    await mkdir(join(this.dir, 'src'), { recursive: true });
    await mkdir(join(this.dir, 'test'), { recursive: true });

    await writeFile(
      join(this.dir, 'package.json'),
      JSON.stringify(
        { name: 'forge-e2e-sample', version: '1.0.0', type: 'module' },
        null,
        2,
      ),
      'utf-8',
    );

    await writeFile(
      join(this.dir, 'src', 'index.js'),
      [
        "import { formatName } from './utils.js';",
        '',
        'export function main() {',
        "  const name = formatName('world');",
        '  return `Hello, ${name}!`;',
        '}',
        '',
      ].join('\n'),
      'utf-8',
    );

    await writeFile(
      join(this.dir, 'src', 'utils.js'),
      [
        'export function formatName(name) {',
        '  return name.charAt(0).toUpperCase() + name.slice(1);',
        '}',
        '',
        'export function slugify(text) {',
        "  return text.toLowerCase().replace(/\\s+/g, '-');",
        '}',
        '',
      ].join('\n'),
      'utf-8',
    );

    return this.dir;
  }

  async teardown() {
    if (this.dir) {
      await rm(this.dir, { recursive: true, force: true });
      this.dir = null;
    }
  }
}
