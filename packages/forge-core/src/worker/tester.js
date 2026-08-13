import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseWorker } from './base.js';

/**
 * Tester Worker — writes and runs tests for implemented changes.
 * Dynamically detects the project's test framework from package.json.
 */
import { normalizeLanguageCandidate } from '../goal-refiner/helpers.js';

const NATIVE_TEST_FRAMEWORKS = Object.freeze({
  python: {
    framework: 'Python unittest',
    testCommand: 'python -m unittest discover',
    imports: 'Use Python standard-library unittest unless the repository already configures pytest.',
    exampleLanguage: 'python',
    example: [
      'from unittest import TestCase',
      'from src.my_module import MyClass',
      '',
      'class MyClassTest(TestCase):',
      '    def test_method_returns_expected_value(self):',
      '        self.assertEqual(MyClass().method(), expected)',
    ].join('\n'),
  },
  go: {
    framework: 'Go testing',
    testCommand: 'go test ./...',
    imports: 'Import testing plus only packages required by the test.',
    exampleLanguage: 'go',
    example: [
      'package mypackage',
      '',
      'import "testing"',
      '',
      'func TestMethodReturnsExpectedValue(t *testing.T) {',
      '    if got := NewMyType().Method(); got != expected {',
      '        t.Fatalf("Method() = %v, want %v", got, expected)',
      '    }',
      '}',
    ].join('\n'),
  },
  rust: {
    framework: 'Rust built-in test harness',
    testCommand: 'cargo test',
    imports: 'Keep unit tests beside the module when appropriate; use integration tests under tests/.',
    exampleLanguage: 'rust',
    example: [
      '#[cfg(test)]',
      'mod tests {',
      '    use super::*;',
      '',
      '    #[test]',
      '    fn method_returns_expected_value() {',
      '        assert_eq!(MyType::new().method(), expected);',
      '    }',
      '}',
    ].join('\n'),
  },
  java: {
    framework: 'project-configured JUnit',
    testCommand: './mvnw test or ./gradlew test, matching the repository build',
    imports: 'Use the JUnit version declared by Maven or Gradle; do not add a new test dependency.',
    exampleLanguage: 'java',
    example: [
      'import org.junit.jupiter.api.Test;',
      'import static org.junit.jupiter.api.Assertions.assertEquals;',
      '',
      'class MyClassTest {',
      '    @Test',
      '    void methodReturnsExpectedValue() {',
      '        assertEquals(expected, new MyClass().method());',
      '    }',
      '}',
    ].join('\n'),
  },
  csharp: {
    framework: 'project-configured .NET test framework',
    testCommand: 'dotnet test',
    imports: 'Use the existing xUnit, NUnit, or MSTest package and assertion style.',
    exampleLanguage: 'csharp',
    example: '// Read the test project first, then follow its existing test attributes and assertions.',
  },
  kotlin: {
    framework: 'project-configured Kotlin/JUnit test framework',
    testCommand: './gradlew test or ./mvnw test, matching the repository build',
    imports: 'Use the test framework and source set already declared by Gradle or Maven.',
    exampleLanguage: 'kotlin',
    example: '// Read existing Kotlin tests and preserve their JUnit/Kotest conventions.',
  },
  swift: {
    framework: 'Swift Testing or XCTest',
    testCommand: 'swift test',
    imports: 'Use the framework already configured by the Swift package or Xcode target.',
    exampleLanguage: 'swift',
    example: '// Read Package.swift and existing tests before choosing Swift Testing or XCTest.',
  },
  ruby: {
    framework: 'project-configured Ruby test framework',
    testCommand: 'bundle exec rake test or bundle exec rspec, matching the repository',
    imports: 'Use the Gemfile-selected Minitest or RSpec conventions.',
    exampleLanguage: 'ruby',
    example: '# Read existing tests first and preserve their helper and matcher conventions.',
  },
  php: {
    framework: 'project-configured PHP test framework',
    testCommand: 'vendor/bin/phpunit or composer test, matching composer.json',
    imports: 'Use Composer autoloading and the PHPUnit/Pest version already declared.',
    exampleLanguage: 'php',
    example: '// Read composer.json and existing tests before choosing PHPUnit or Pest syntax.',
  },
  cpp: {
    framework: 'project-configured C++ test harness',
    testCommand: 'ctest --test-dir build --output-on-failure when CTest is configured',
    imports: 'Read CMake, Meson, Bazel, or Make configuration and use the existing test library.',
    exampleLanguage: 'cpp',
    example: '// Preserve the repository test target, fixture, namespace, and assertion macros.',
  },
  c: {
    framework: 'project-configured C test harness',
    testCommand: 'use the repository build-system test target',
    imports: 'Read the build manifest and use the existing C test library without adding dependencies.',
    exampleLanguage: 'c',
    example: '/* Preserve the repository test runner and assertion macros. */',
  },
  shell: {
    framework: 'project-configured shell test harness',
    testCommand: 'use the repository test script; use bats only when configured',
    imports: 'Source only the repository test helper files required by the test.',
    exampleLanguage: 'bash',
    example: '# Preserve the target shell and existing test harness conventions.',
  },
  powershell: {
    framework: 'Pester',
    testCommand: 'Invoke-Pester',
    imports: 'Use the installed/configured Pester version and repository helper modules.',
    exampleLanguage: 'powershell',
    example: '# Read existing *.Tests.ps1 files and preserve their Describe/It conventions.',
  },
});

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
- Test files SHOULD follow project convention (matching existing test naming and language in this project).
- Include assertions for error cases, boundary values, and null/undefined handling
- Each test should have a descriptive name explaining what it validates

CRITICAL SYNTAX RULES:
- Follow the selected language and the repository's existing test framework exactly.
- For JavaScript/TypeScript, close describe()/it() callbacks with }); and do not mix node:test, Jest, Vitest, Mocha, or AVA assertion styles.
- Use the language's native asynchronous-test mechanism; do not use arbitrary sleeps as synchronization.
- Every opening { must have a matching }, every ( must have a matching )
- Before outputting the "write" action, mentally verify: count all { and } brackets, count all ( and ) parens — they must match
- Do not import runtime built-ins as module dependencies. Import only packages and project symbols.
- Only import from actual packages listed in package.json dependencies, or from project source files using relative paths (e.g., '../src/cache.<ext>')
- Import the EXACT class/function name that is exported from the source file — read the source file first to check the export statement

Available actions:
- {"type": "read", "path": "src/file.ext"} — read a file to understand the implementation
- {"type": "write", "path": "test/name.ext", "content": "full test file content"} — CREATE a test file (REQUIRED!)
- {"type": "edit", "path": "test/name.ext", "oldString": "...", "newString": "..."} — modify existing test file
- {"type": "bash", "command": "project test command"} — run tests (do this AFTER writing test files)

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
  async _getExtraContext(projectRoot, task = {}) {
    const nativeFramework = this.#detectNativeFramework(task);
    if (nativeFramework) {
      return this.#buildFrameworkHint(nativeFramework, { scripts: {} });
    }

    try {
      const pkgPath = join(projectRoot, 'package.json');
      const pkgRaw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgRaw);

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Detect test framework
      const framework = this.#detectFramework(allDeps, pkg, task);

      // Build framework-specific instructions
      return this.#buildFrameworkHint(framework, pkg);
    } catch {
      const framework = this.#detectFramework({}, { scripts: {} }, task);
      return this.#buildFrameworkHint(framework, { scripts: {} });
    }
  }

  #detectNativeFramework(task) {
    const language = normalizeLanguageCandidate(task?.language);
    if (!language || language === 'js' || language === 'ts' || language === 'other') return null;
    const framework = NATIVE_TEST_FRAMEWORKS[language];
    return framework ? { ...framework, detectionBasis: 'the task language and repository-native conventions' } : null;
  }

  /**
   * Detect test framework from dependencies and scripts.
   * @param {object} deps — merged dependencies
   * @param {object} pkg — parsed package.json
   * @returns {{ framework: string, testCommand: string, imports: string, example: string }}
   */
  #detectFramework(deps, pkg, task = {}) {
    const testScript = pkg.scripts?.test || '';
    const sourceFileExt = this.#resolveSourceFileExtension(deps, task);
    const sourceImport = `../src/myclass.${sourceFileExt}`;

    // Jest
    if (deps.jest || testScript.includes('jest')) {
      return {
        framework: 'jest',
        testCommand: 'npx jest',
        imports: '// Jest globals (describe, it, expect, beforeEach, afterEach) are available without imports',
        exampleLanguage: sourceFileExt,
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
        exampleLanguage: sourceFileExt,
        example: `import { describe, it, expect } from 'vitest';
import { MyClass } from '${sourceImport}';

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
        exampleLanguage: sourceFileExt,
        imports: hasChai
          ? "import { expect } from 'chai';"
          : "import assert from 'node:assert';",
        example: hasChai
          ? `import { expect } from 'chai';
import { MyClass } from '${sourceImport}';

describe('MyClass', () => {
  it('should do something', () => {
    const obj = new MyClass();
    expect(obj.method()).to.equal(expected);
  });
});`
          : `import assert from 'node:assert';
import { MyClass } from '${sourceImport}';

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
        exampleLanguage: sourceFileExt,
        example: `import test from 'ava';
import { MyClass } from '${sourceImport}';

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
      exampleLanguage: sourceFileExt,
      example: `import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MyClass } from '${sourceImport}';

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
   * Resolve source extension for test examples from available dependency context.
   * @param {object} deps
   * @returns {string}
   */
  #resolveSourceFileExtension(deps, task = {}) {
    const taskLanguage = normalizeLanguageCandidate(task?.language);
    if (taskLanguage === 'ts') return 'ts';
    if (taskLanguage === 'js') return 'js';
    if (!deps) return 'js';
    return deps.typescript || deps['ts-jest'] || deps['ts-node'] || deps['ts-loader'] || deps.tsx
      ? 'ts'
      : 'js';
  }

  /**
   * Build the framework hint text to inject into the prompt.
   */
  #buildFrameworkHint(framework, pkg) {
    const testCmd = pkg.scripts?.test || framework.testCommand;
    const codeFenceLanguage = framework.exampleLanguage || 'text';
    const detectionBasis = framework.detectionBasis || 'package.json analysis';
    return `## Detected Test Framework: ${framework.framework}

Based on ${detectionBasis}, this project uses **${framework.framework}** as its test framework.

### Import Statements
${framework.imports}

### Test Command
Run tests with: \`${testCmd}\`

### Example Test Structure
\`\`\`${codeFenceLanguage}
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
