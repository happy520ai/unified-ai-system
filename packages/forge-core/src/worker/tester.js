import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseWorker } from './base.js';

/**
 * Tester Worker — writes and runs tests for implemented changes.
 * Dynamically detects the project's test framework from package.json.
 */
export class TesterWorker extends BaseWorker {
  constructor() {
    super({
      role: 'tester',
      systemPrompt: `You are the Forge Tester Worker — a test-focused agent that writes and validates code tests.

CRITICAL RULES (in priority order):
1. Your PRIMARY job is to CREATE TEST FILES using "write" actions. You MUST produce at least one "write" action.
2. You can run tests with "bash" AFTER writing them, but ONLY after the test files exist.
3. Output your JSON actions FIRST, then add explanation. Start your response with the JSON array.

Your workflow:
1. Read the implementation code to understand what needs testing
2. WRITE comprehensive test files (this is MANDATORY — you must create files!)
3. Run the tests with bash to verify they work
4. If tests fail, fix the test file or identify implementation bugs

Testing principles:
- Test both happy paths and edge cases
- Use the project's existing test framework (check package.json for test runner)
- Test files MUST be named *.test.js and placed in the test/ directory
- Include assertions for error cases, boundary values, and null/undefined handling
- Each test should have a descriptive name explaining what it validates

CRITICAL SYNTAX RULES:
- describe() callbacks MUST be closed with }); — NOT just } alone
- it() callbacks do NOT receive a "t" parameter. Use plain it('name', () => { ... }) — do NOT use it('name', (t) => { t.end() })
- For async tests, return a Promise or use async/await — do NOT use setTimeout + t.end()
- Every opening { must have a matching }, every ( must have a matching )
- Before outputting the "write" action, mentally verify: count all { and } brackets, count all ( and ) parens — they must match
- NEVER import JS built-in globals (Map, Set, Array, Promise, Object, Error, JSON, Math, Date, console, Buffer, URL, setTimeout, etc.) — they are always available without imports
- Only import from actual packages listed in package.json dependencies, or from project source files using relative paths (e.g., '../src/cache.js')
- Import the EXACT class/function name that is exported from the source file — read the source file first to check the export statement

Available actions:
- {"type": "read", "path": "src/file.js"} — read a file to understand the implementation
- {"type": "write", "path": "test/name.test.js", "content": "full test file content"} — CREATE a test file (REQUIRED!)
- {"type": "edit", "path": "test/name.test.js", "oldString": "...", "newString": "..."} — modify existing test file
- {"type": "bash", "command": "npm test"} — run tests (do this AFTER writing test files)

End with:
---SUMMARY---
Test files created: list of files. Test results: X passed, Y failed.
---END---`,
      tools: ['read', 'write', 'edit', 'bash'],
    });
  }

  /**
   * Detect the project's test framework from package.json and inject framework-specific
   * instructions into the prompt.
   */
  async _getExtraContext(projectRoot, _task) {
    try {
      const pkgPath = join(projectRoot, 'package.json');
      const pkgRaw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgRaw);

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Detect test framework
      const framework = this.#detectFramework(allDeps, pkg);

      // Build framework-specific instructions
      return this.#buildFrameworkHint(framework, pkg);
    } catch {
      // If package.json is missing or unreadable, fall back to node:test
      return 'No package.json found. Use Node.js built-in test runner: import { describe, it } from \'node:test\'; import assert from \'node:assert\';';
    }
  }

  /**
   * Detect test framework from dependencies and scripts.
   * @param {object} deps — merged dependencies
   * @param {object} pkg — parsed package.json
   * @returns {{ framework: string, testCommand: string, imports: string, example: string }}
   */
  #detectFramework(deps, pkg) {
    const testScript = pkg.scripts?.test || '';

    // Jest
    if (deps.jest || testScript.includes('jest')) {
      return {
        framework: 'jest',
        testCommand: 'npx jest',
        imports: '// Jest globals (describe, it, expect, beforeEach, afterEach) are available without imports',
        example: `describe('MyClass', () => {
  it('should do something', () => {
    const obj = new MyClass();
    expect(obj.method()).toBe(expected);
  });

  it('should handle errors', () => {
    expect(() => new MyClass(null)).toThrow();
  });
});`,
      };
    }

    // Vitest
    if (deps.vitest || testScript.includes('vitest')) {
      return {
        framework: 'vitest',
        testCommand: 'npx vitest run',
        imports: "import { describe, it, expect } from 'vitest';",
        example: `import { describe, it, expect } from 'vitest';
import { MyClass } from '../src/myclass.js';

describe('MyClass', () => {
  it('should do something', () => {
    const obj = new MyClass();
    expect(obj.method()).toBe(expected);
  });
});`,
      };
    }

    // Mocha + Chai
    if (deps.mocha || testScript.includes('mocha')) {
      const hasChai = !!deps.chai;
      return {
        framework: 'mocha',
        testCommand: hasChai ? 'npx mocha' : 'npx mocha',
        imports: hasChai
          ? "import { expect } from 'chai';"
          : "import assert from 'node:assert';",
        example: hasChai
          ? `import { expect } from 'chai';
import { MyClass } from '../src/myclass.js';

describe('MyClass', () => {
  it('should do something', () => {
    const obj = new MyClass();
    expect(obj.method()).to.equal(expected);
  });
});`
          : `import assert from 'node:assert';
import { MyClass } from '../src/myclass.js';

describe('MyClass', () => {
  it('should do something', () => {
    const obj = new MyClass();
    assert.strictEqual(obj.method(), expected);
  });
});`,
      };
    }

    // Ava
    if (deps.ava || testScript.includes('ava')) {
      return {
        framework: 'ava',
        testCommand: 'npx ava',
        imports: "import test from 'ava';",
        example: `import test from 'ava';
import { MyClass } from '../src/myclass.js';

test('should do something', t => {
  const obj = new MyClass();
  t.is(obj.method(), expected);
});`,
      };
    }

    // Default: node:test
    return {
      framework: 'node:test',
      testCommand: 'node --test',
      imports: "import { describe, it } from 'node:test';\nimport assert from 'node:assert';",
      example: `import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MyClass } from '../src/myclass.js';

describe('MyClass', () => {
  it('should do something', () => {
    const obj = new MyClass();
    assert.strictEqual(obj.method(), expected);
  });

  it('should handle async', async () => {
    const obj = new MyClass();
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(obj.expired(), true);
  });
});`,
    };
  }

  /**
   * Build the framework hint text to inject into the prompt.
   */
  #buildFrameworkHint(framework, pkg) {
    const testCmd = pkg.scripts?.test || framework.testCommand;
    return `## Detected Test Framework: ${framework.framework}

Based on package.json analysis, this project uses **${framework.framework}** as its test framework.

### Import Statements
${framework.imports}

### Test Command
Run tests with: \`${testCmd}\`

### Example Test Structure
\`\`\`js
${framework.example}
\`\`\`

IMPORTANT: Use the exact import style and assertion syntax shown above for this framework. Do NOT mix assertion styles from different frameworks.`;
  }
}

/**
 * Verifier Worker — runs validation suites and produces evidence.
 */
export class VerifierWorker extends BaseWorker {
  constructor() {
    super({
      role: 'verifier',
      systemPrompt: `You are the Forge Verifier Worker — a validation agent that confirms changes are correct.

Your job is to run a comprehensive verification suite:
1. Type checking (if applicable)
2. Linting
3. Unit tests
4. Build check (if applicable)
5. Smoke test (start the app if applicable)

You MUST NOT modify any files. Only read and run commands.

Report each check with: PASS, FAIL, or SKIP (with reason).

End with:
---SUMMARY---
Verification results: X/Y checks passed. Overall: PASS|FAIL|PARTIAL.
---END---`,
      tools: ['read', 'bash'],
    });
  }
}
