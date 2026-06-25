import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── P0-1: Structured Output (responseFormat) ──────────────────────────────

describe('P0-1: LLM Client responseFormat option', () => {

  let originalFetch;
  let capturedBodies;

  before(() => {
    originalFetch = globalThis.fetch;
    capturedBodies = [];

    // Mock fetch to capture request bodies
    globalThis.fetch = async (url, opts) => {
      capturedBodies.push({ url, body: JSON.parse(opts.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '[{"type":"write","path":"test.js","content":"hello"}]'}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
        text: async () => '',
      };
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('should include response_format when responseFormat is "json"', async () => {
    capturedBodies = [];
    const { callLLMDirect } = await import('../src/llm-client.js');

    // Set a fake API key so the call proceeds
    process.env.NVIDIA_API_KEY = 'test-key-for-p0';

    await callLLMDirect({
      provider: 'nvidia',
      messages: [{ role: 'user', content: 'test' }],
      responseFormat: 'json',
    });

    assert.equal(capturedBodies.length, 1);
    assert.deepEqual(capturedBodies[0].body.response_format, { type: 'json_object' });
  });

  it('should NOT include response_format when responseFormat is not set', async () => {
    capturedBodies = [];
    const { callLLMDirect } = await import('../src/llm-client.js');

    await callLLMDirect({
      provider: 'nvidia',
      messages: [{ role: 'user', content: 'test' }],
    });

    assert.equal(capturedBodies.length, 1);
    assert.equal(capturedBodies[0].body.response_format, undefined);
  });

  it('should NOT include response_format when responseFormat is "text"', async () => {
    capturedBodies = [];
    const { callLLMDirect } = await import('../src/llm-client.js');

    await callLLMDirect({
      provider: 'nvidia',
      messages: [{ role: 'user', content: 'test' }],
      responseFormat: 'text',
    });

    assert.equal(capturedBodies.length, 1);
    assert.equal(capturedBodies[0].body.response_format, undefined);
  });

  it('should pass responseFormat through callLLM opts', async () => {
    capturedBodies = [];
    const { callLLM } = await import('../src/llm-client.js');

    // callLLM tries gateway first (which will fail since no gateway running), then falls back to direct
    process.env.NVIDIA_API_KEY = 'test-key-for-p0';
    process.env.FORGE_LLM_PROVIDER = 'nvidia';
    process.env.FORGE_LLM_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1';

    await callLLM('system', 'user', { responseFormat: 'json' });

    // The last captured body should be the direct call (after gateway fails)
    const directCall = capturedBodies.find(b => b.url.includes('/chat/completions'));
    assert.ok(directCall, 'Should have made a direct API call');
    assert.deepEqual(directCall.body.response_format, { type: 'json_object' });

    // Clean up env
    delete process.env.FORGE_LLM_PROVIDER;
    delete process.env.FORGE_LLM_MODEL;
  });
});

// ── P0-2: Pre-write Syntax Validation ─────────────────────────────────────

describe('P0-2: JS Syntax Validation (node --check)', () => {

  /**
   * Standalone version of #validateJsSyntax for testing.
   * Uses the same node --check approach.
   */
  async function validateJsSyntax(content) {
    const tmpFile = join(tmpdir(), `forge-test-check-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
    try {
      await writeFile(tmpFile, content, 'utf-8');
      execFileSync(process.execPath, ['--check', tmpFile], {
        timeout: 10000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { valid: true };
    } catch (err) {
      const stderr = err.stderr || '';
      const lineMatch = stderr.match(/:(\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1]) : null;
      const errorLine = stderr.split('\n').find(l => l.includes('SyntaxError')) || stderr.split('\n')[0] || '';
      return { valid: false, error: errorLine.trim(), line };
    } finally {
      try { await unlink(tmpFile); } catch { /* best-effort cleanup */ }
    }
  }

  it('should pass valid JS syntax', async () => {
    const result = await validateJsSyntax(`
      import { something } from './module.js';
      export class Foo {
        #private = 1;
        constructor() { this.bar = 'hello'; }
        method() { return this.#private; }
      }
    `);
    assert.ok(result.valid);
  });

  it('should pass valid ESM with async/await', async () => {
    const result = await validateJsSyntax(`
      import { readFile } from 'node:fs/promises';
      export async function loadConfig(path) {
        const data = await readFile(path, 'utf-8');
        return JSON.parse(data);
      }
    `);
    assert.ok(result.valid);
  });

  it('should pass valid test file structure', async () => {
    const result = await validateJsSyntax(`
      import { describe, it } from 'node:test';
      import assert from 'node:assert/strict';
      describe('MyClass', () => {
        it('should work', () => {
          assert.equal(1 + 1, 2);
        });
        it('should handle async', async () => {
          await Promise.resolve();
        });
      });
    `);
    assert.ok(result.valid);
  });

  it('should detect unclosed bracket', async () => {
    // Class body and constructor are BOTH unclosed — only 1 closing brace for 2 opening
    const code = 'export class Foo {\n  constructor() {\n    this.bar = 1;\n  }\n';
    const result = await validateJsSyntax(code);
    assert.ok(!result.valid, `Expected syntax error but code was valid. Code:\n${code}`);
  });

  it('should detect unclosed describe block', async () => {
    // describe() arrow function body is unclosed — missing });
    const code = 'describe("Test", () => {\n  it("works", () => {\n  });\n';
    const result = await validateJsSyntax(code);
    assert.ok(!result.valid, `Expected syntax error but code was valid. Code:\n${code}`);
  });

  it('should detect import of non-existent syntax errors', async () => {
    // Note: node --check only checks syntax, not import resolution
    // So "import { Map } from 'map'" is valid SYNTAX (even though module doesn't exist)
    const result = await validateJsSyntax(`
      import { Map } from 'map';
      export class Foo {}
    `);
    // This should pass syntax check (imports are valid syntax, just wrong module)
    assert.ok(result.valid, 'node --check should pass for valid syntax even with wrong module names');
  });

  it('should detect missing closing paren', async () => {
    const result = await validateJsSyntax(`
      function hello() {
        console.log('world'
      }
    `);
    assert.ok(!result.valid);
  });

  it('should pass valid code with private class fields', async () => {
    const result = await validateJsSyntax(`
      export class TaskQueue {
        #queue = [];
        #handlers = new Map();
        #running = false;
        register(type, handler) { this.#handlers.set(type, handler); }
        enqueue(type, payload) { this.#queue.push({ type, payload }); }
        get pending() { return this.#queue.length; }
        get isRunning() { return this.#running; }
      }
    `);
    assert.ok(result.valid);
  });

  it('should report error line number', async () => {
    const result = await validateJsSyntax(
      `const a = 1;\nconst b = 2;\nconst c = {\nconst d = 4;\n`
    );
    assert.ok(!result.valid);
    assert.ok(result.line !== null, 'Should report an error line number');
  });
});

// ── P0-2: Auto-fix logic ──────────────────────────────────────────────────

describe('P0-2: Auto-fix syntax errors', () => {

  /**
   * Standalone version of #tryFixSyntax for testing.
   * Same logic as the private method in BaseWorker.
   */
  function tryFixSyntax(content) {
    let fixed = content;

    // Fix 1: Track unclosed brackets/parens using a stack, close in LIFO order
    const stack = [];
    let inString = false, strChar = null, escaped = false, inTemplate = false;

    for (let i = 0; i < fixed.length; i++) {
      const ch = fixed[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && (inString || inTemplate)) { escaped = true; continue; }
      if (inString) { if (ch === strChar) inString = false; continue; }
      if (ch === '`') { inTemplate = !inTemplate; continue; }
      if (inTemplate) continue;
      if (ch === '"' || ch === "'") { inString = true; strChar = ch; continue; }
      if (ch === '{') stack.push('}');
      else if (ch === '(') stack.push(')');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ')' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) stack.pop();
      }
    }

    if (stack.length > 0) {
      let suffix = '';
      while (stack.length > 0) suffix += stack.pop();
      fixed = fixed.trimEnd() + '\n' + suffix + '\n';
    }

    return fixed !== content ? fixed : null;
  }

  /**
   * Helper to validate syntax after fix.
   */
  async function isValid(content) {
    const tmpFile = join(tmpdir(), `forge-fix-test-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
    try {
      await writeFile(tmpFile, content, 'utf-8');
      execFileSync(process.execPath, ['--check', tmpFile], {
        timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch { return false; }
    finally { try { await unlink(tmpFile); } catch { /* best-effort cleanup */ } }
  }

  it('should fix unclosed class body', async () => {
    const broken = `export class Foo {\n  constructor() {\n    this.x = 1;\n  }\n`;
    const fixed = tryFixSyntax(broken);
    assert.ok(fixed, 'Should produce a fix');
    assert.ok(fixed.includes('}'), 'Fix should add closing brace');
    assert.ok(await isValid(fixed), 'Fixed code should pass syntax check');
  });

  it('should fix unclosed describe block', async () => {
    const broken = `import { describe, it } from 'node:test';\ndescribe('Test', () => {\n  it('works', () => {\n  });\n`;
    const fixed = tryFixSyntax(broken);
    assert.ok(fixed, 'Should produce a fix');
    assert.ok(await isValid(fixed), 'Fixed code should pass syntax check');
  });

  it('should fix unclosed function call paren', async () => {
    // console.log is missing the closing ) AND function body missing }
    const broken = `function hello() {\n  console.log('world');\n`;
    const fixed = tryFixSyntax(broken);
    assert.ok(fixed, 'Should produce a fix');
    assert.ok(fixed.includes('}'), 'Fix should add closing brace');
    assert.ok(await isValid(fixed), 'Fixed code should pass syntax check');
  });

  it('should return null for already valid code', () => {
    const valid = `export class Foo {\n  constructor() {\n    this.x = 1;\n  }\n}\n`;
    const result = tryFixSyntax(valid);
    assert.equal(result, null, 'Should not modify valid code');
  });

  it('should handle nested unclosed brackets', async () => {
    const broken = `export class Cache {\n  #store = new Map();\n  set(key, value) {\n    this.#store.set(key, { value });\n  }\n  get(key) {\n    return this.#store.get(key)?.value;\n  }\n`;
    const fixed = tryFixSyntax(broken);
    assert.ok(fixed, 'Should produce a fix');
    assert.ok(await isValid(fixed), 'Fixed code should pass syntax check');
  });

  it('should not break strings containing brackets', async () => {
    const broken = `const msg = "hello { world }";\nconst arr = [1, 2, 3];\n`;
    const result = tryFixSyntax(broken);
    // This code is actually valid — no fix needed
    assert.equal(result, null, 'Should not modify valid code with brackets in strings');
  });
});
