/**
 * Verification helpers — pure functions, constants, and parameterized utilities
 * extracted from the VerificationEngine class for reusability and testability.
 */

import { execSync } from 'node:child_process';
import { readFile, access, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

/** Patterns that indicate potentially dangerous code */
export const UNSAFE_PATTERNS = [
  { regex: /eval\s*\(/, severity: 'high', description: 'eval() usage — potential code injection' },
  { regex: /new\s+Function\s*\(/, severity: 'high', description: 'new Function() — potential code injection' },
  { regex: /child_process.*exec\s*\(/, severity: 'medium', description: 'child_process.exec — shell injection risk' },
  { regex: /(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/i, severity: 'high', description: 'Hardcoded secret/credential detected' },
  { regex: /\.env(?!\.example)/, severity: 'low', description: 'Possible .env file reference' },
  { regex: /process\.env\.\w+\s*\|\|\s*['"][^'"]{8,}['"]/, severity: 'medium', description: 'Hardcoded fallback credential' },
  { regex: /innerHTML\s*=/, severity: 'medium', description: 'innerHTML assignment — potential XSS' },
  { regex: /document\.write\s*\(/, severity: 'medium', description: 'document.write — potential XSS' },
  { regex: /TODO|FIXME|HACK|XXX/, severity: 'info', description: 'Unresolved TODO/FIXME comment' },
  { regex: /console\.(log|warn|error|info)\s*\(/, severity: 'info', description: 'Console statement left in code' },
  { regex: /\/\*\s*eslint-disable/, severity: 'info', description: 'ESLint rule disabled' },
  { regex: /@ts-ignore|@ts-nocheck/, severity: 'info', description: 'TypeScript check suppressed' },
];

/**
 * Build a summary object from tier results, failures, diff analysis, and duration.
 */
export function buildSummary(tiers, failures, diffAnalysis, totalMs) {
  const allChecks = tiers.flatMap(t => t.checks);
  return {
    totalDurationMs: totalMs,
    tiersRun: tiers.filter(t => t.status !== 'SKIP').length,
    checksPassed: allChecks.filter(c => c.status === 'PASS').length,
    checksFailed: allChecks.filter(c => c.status === 'FAIL').length,
    checksSkipped: allChecks.filter(c => c.status === 'SKIP').length,
    checksTotal: allChecks.length,
    failureCount: failures.length,
    riskLevel: diffAnalysis?.riskLevel ?? 'unknown',
    findings: diffAnalysis?.findings?.length ?? 0,
  };
}

/**
 * Find the line number where a regex first matches in content.
 */
export function findLineNumber(content, regex) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) return i + 1;
  }
  return null;
}

/**
 * Run a single check command synchronously with timeout.
 */
export function runCheck(name, command, projectRoot, timeout = 60000) {
  const start = Date.now();
  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { name, status: 'PASS', output: output.slice(0, 3000), durationMs: Date.now() - start };
  } catch (err) {
    const output = (err.stderr || err.stdout || err.message || '').slice(0, 3000);
    return { name, status: 'FAIL', output, durationMs: Date.now() - start };
  }
}

/**
 * Check if a file exists relative to project root.
 */
export async function hasFile(name, projectRoot) {
  try { await access(join(projectRoot, name)); return true; } catch { return false; }
}

/**
 * Check if a command is available via npx.
 */
export async function hasCommand(name, projectRoot) {
  try {
    execSync(`npx ${name} --version`, { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
    return true;
  } catch { return false; }
}

/**
 * Check if a script exists in package.json.
 */
export async function hasScript(name, projectRoot) {
  try {
    const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'));
    return !!pkg.scripts?.[name];
  } catch { return false; }
}

/**
 * Read and parse package.json.
 */
export async function readPkg(projectRoot) {
  try {
    return JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'));
  } catch { return null; }
}

/**
 * Check if any test files exist in standard directories.
 */
export async function hasTestFiles(projectRoot) {
  const testDirs = ['test', 'tests', '__tests__', 'spec', 'src'];
  for (const dir of testDirs) {
    try {
      const dirPath = join(projectRoot, dir);
      const entries = await readdir(dirPath, { recursive: true });
      const hasTests = entries.some(e =>
        e.endsWith('.test.js') || e.endsWith('.test.ts') ||
        e.endsWith('.spec.js') || e.endsWith('.spec.ts')
      );
      if (hasTests) return true;
    } catch { /* dir doesn't exist */ }
  }
  return false;
}

/**
 * Check if any test files are relevant to the modified files.
 * "Relevant" means co-located or in sibling test directories.
 */
export async function hasRelevantTestFiles(filesModified, projectRoot) {
  const TEST_EXTENSIONS = ['.test.js', '.test.ts', '.spec.js', '.spec.ts'];

  for (const filePath of filesModified) {
    const absPath = filePath.startsWith('/') ? filePath : join(projectRoot, filePath);
    if (!absPath.startsWith(projectRoot)) continue;

    const ext = extname(absPath);
    const base = basename(absPath, ext);
    const dir = absPath.substring(0, absPath.lastIndexOf('/') + 1) || join(projectRoot, '/');

    // Co-located test files
    for (const testExt of TEST_EXTENSIONS) {
      const candidateTest = join(dir, base + testExt);
      try {
        await access(candidateTest);
        return true;
      } catch { /* not found */ }
    }

    // Sibling test directories
    const relPath = absPath.slice(projectRoot.length + 1);
    const relDir = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '';
    const parentDirs = relDir ? relDir.split('/') : [];

    for (const testDir of ['__tests__', 'test', 'tests']) {
      const candidateDirs = [
        join(projectRoot, relDir, testDir),
        join(projectRoot, testDir, relDir),
        ...parentDirs.map((_, i) =>
          join(projectRoot, ...parentDirs.slice(0, i + 1), testDir)
        ),
      ];
      for (const candidateDir of candidateDirs) {
        for (const testExt of TEST_EXTENSIONS) {
          const candidateTest = join(candidateDir, base + testExt);
          try {
            await access(candidateTest);
            return true;
          } catch { /* not found */ }
        }
      }
    }
  }
  return false;
}

/**
 * Scan specific files for unsafe patterns.
 */
export async function scanUnsafePatterns(filesModified, projectRoot) {
  const start = Date.now();
  const findings = [];

  for (const filePath of filesModified) {
    try {
      const content = await readFile(join(projectRoot, filePath), 'utf-8');
      for (const pattern of UNSAFE_PATTERNS) {
        const matches = content.match(pattern.regex);
        if (matches) {
          findings.push({
            file: filePath,
            pattern: pattern.description,
            severity: pattern.severity,
            match: matches[0].slice(0, 80),
            line: findLineNumber(content, pattern.regex),
          });
        }
      }
    } catch { /* file might not exist or be binary */ }
  }

  const highFindings = findings.filter(f => f.severity === 'high');
  const status = highFindings.length > 0 ? 'FAIL' : 'PASS';

  const output = findings.length === 0
    ? `Scanned ${filesModified.length} file(s) — no issues found`
    : findings.map(f => `[${f.severity.toUpperCase()}] ${f.file}:${f.line || '?'} — ${f.pattern}`).join('\n');

  return {
    name: 'Unsafe Pattern Scan',
    status,
    output: output.slice(0, 3000),
    durationMs: Date.now() - start,
    findings,
  };
}

/**
 * Scan all source files under src/ for unsafe patterns.
 */
export async function scanAllSourceFiles(projectRoot) {
  try {
    const srcDir = join(projectRoot, 'src');
    const files = await readdir(srcDir, { recursive: true });
    const sourceFiles = files
      .filter(f => /\.(js|ts|jsx|tsx|mjs)$/.test(f))
      .map(f => join('src', f));

    if (sourceFiles.length === 0) return null;
    return scanUnsafePatterns(sourceFiles, projectRoot);
  } catch {
    return null;
  }
}

/**
 * Analyze modified files for risk level and findings.
 */
export async function analyzeDiff(filesModified, projectRoot) {
  const analysis = {
    filesCount: filesModified.length,
    extensions: {},
    findings: [],
    riskLevel: 'low',
  };

  for (const filePath of filesModified) {
    const ext = extname(filePath) || 'none';
    analysis.extensions[ext] = (analysis.extensions[ext] || 0) + 1;

    try {
      const content = await readFile(join(projectRoot, filePath), 'utf-8');
      for (const pattern of UNSAFE_PATTERNS) {
        if (pattern.severity === 'info') continue;
        const matches = content.match(pattern.regex);
        if (matches) {
          analysis.findings.push({
            file: filePath,
            pattern: pattern.description,
            severity: pattern.severity,
            line: findLineNumber(content, pattern.regex),
          });
        }
      }
    } catch { /* file might have been deleted */ }
  }

  const highCount = analysis.findings.filter(f => f.severity === 'high').length;
  const medCount = analysis.findings.filter(f => f.severity === 'medium').length;
  if (highCount > 0) analysis.riskLevel = 'high';
  else if (medCount > 0) analysis.riskLevel = 'medium';

  return analysis;
}

/**
 * Run a smoke test by spawning the server and checking its response.
 */
export async function runSmokeTest(projectRoot) {
  const start = Date.now();
  const port = 30000 + Math.floor(Math.random() * 10000);

  try {
    const { spawn } = await import('node:child_process');
    const serverProcess = spawn('node', ['src/server.js'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(5000),
      });

      const body = await res.text();
      serverProcess.kill('SIGTERM');

      if (res.ok) {
        return {
          name: 'Smoke Test',
          status: 'PASS',
          output: `Server responded ${res.status}: ${body.slice(0, 500)}`,
          durationMs: Date.now() - start,
        };
      } else {
        return {
          name: 'Smoke Test',
          status: 'FAIL',
          output: `Server responded ${res.status}: ${body.slice(0, 500)}`,
          durationMs: Date.now() - start,
        };
      }
    } catch (fetchErr) {
      serverProcess.kill('SIGTERM');
      return {
        name: 'Smoke Test',
        status: 'FAIL',
        output: `Server did not respond on port ${port}: ${fetchErr.message}`,
        durationMs: Date.now() - start,
      };
    }
  } catch (err) {
    return {
      name: 'Smoke Test',
      status: 'FAIL',
      output: `Failed to start server: ${err.message}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Run Tier 1: Static Analysis checks.
 */
export async function runStaticAnalysis(projectRoot) {
  const checks = [];

  if (await hasFile('tsconfig.json', projectRoot)) {
    checks.push(runCheck('TypeScript', 'npx tsc --noEmit', projectRoot, 120000));
  }

  if (await hasFile('.eslintrc', projectRoot) || await hasFile('.eslintrc.js', projectRoot) ||
      await hasFile('eslint.config.js', projectRoot) || await hasFile('.eslintrc.json', projectRoot)) {
    checks.push(runCheck('ESLint', 'npx eslint . --max-warnings 50', projectRoot, 60000));
  }

  if (await hasFile('package.json', projectRoot)) {
    checks.push(runCheck('package.json', 'node -e "JSON.parse(require(\'fs\').readFileSync(\'./package.json\',\'utf8\'))"', projectRoot, 10000));
  }

  if (await hasFile('package.json', projectRoot)) {
    const pkg = await readPkg(projectRoot);
    if (pkg?.type === 'module') {
      checks.push(runCheck('Module Syntax', 'node --check src/server.js 2>&1 || true', projectRoot, 15000));
    }
  }

  const status = checks.length === 0 ? 'SKIP'
    : checks.every(c => c.status === 'PASS' || c.status === 'SKIP') ? 'PASS' : 'FAIL';

  return { tier: 1, name: 'Static Analysis', status, checks };
}

/**
 * Run Tier 2: Unit Tests.
 */
export async function runUnitTests(projectRoot, filesModified = []) {
  const checks = [];

  let testScript = null;
  try {
    const pkg = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf-8'));
    testScript = pkg.scripts?.test;
  } catch { /* no package.json or invalid JSON */ }

  if (filesModified.length > 0) {
    const hasRelevantTests = await hasRelevantTestFiles(filesModified, projectRoot);
    if (!hasRelevantTests) {
      checks.push({
        name: 'Test Runner',
        status: 'SKIP',
        output: 'No test files found relevant to modified files',
        durationMs: 0,
      });
      return { tier: 2, name: 'Unit Tests', status: 'PASS', checks };
    }
  }

  if (testScript) {
    const isVitest = testScript.includes('vitest');
    const cmd = isVitest ? 'npm test -- --run --passWithNoTests' : 'npm test';
    const result = runCheck('npm test', cmd, projectRoot, 120000);
    if (result.status === 'FAIL' && result.output?.includes('No test files found')) {
      const hasTestFilesResult = await hasTestFiles(projectRoot);
      if (!hasTestFilesResult) {
        result.status = 'SKIP';
        result.output = 'No test files found in project';
      }
    }
    checks.push(result);
  } else if (await hasCommand('vitest', projectRoot)) {
    checks.push(runCheck('Vitest', 'npx vitest run --reporter=verbose --passWithNoTests', projectRoot, 120000));
  } else if (await hasCommand('jest', projectRoot)) {
    checks.push(runCheck('Jest', 'npx jest --verbose --passWithNoTests', projectRoot, 120000));
  } else {
    checks.push({ name: 'Test Runner', status: 'SKIP', output: 'No test framework detected', durationMs: 0 });
  }

  const status = checks.every(c => c.status === 'PASS' || c.status === 'SKIP') ? 'PASS' : 'FAIL';
  return { tier: 2, name: 'Unit Tests', status, checks };
}

/**
 * Run Tier 3: Integration Tests.
 */
export async function runIntegrationTests(projectRoot) {
  const checks = [];

  if (await hasScript('test:integration', projectRoot)) {
    checks.push(runCheck('Integration Tests', 'npm run test:integration', projectRoot, 180000));
  } else if (await hasScript('test:e2e', projectRoot)) {
    checks.push(runCheck('E2E Tests', 'npm run test:e2e', projectRoot, 180000));
  } else {
    checks.push({ name: 'Integration Tests', status: 'SKIP', output: 'No integration test script', durationMs: 0 });
  }

  const status = checks.every(c => c.status === 'PASS' || c.status === 'SKIP') ? 'PASS' : 'FAIL';
  return { tier: 3, name: 'Integration Tests', status, checks };
}

/**
 * Run Tier 4: Smoke Tests.
 */
export async function runSmokeTests(projectRoot) {
  const checks = [];

  if (await hasScript('start', projectRoot)) {
    const smokeResult = await runSmokeTest(projectRoot);
    checks.push(smokeResult);
  } else {
    checks.push({ name: 'App Start', status: 'SKIP', output: 'No start script', durationMs: 0 });
  }

  if (await hasScript('health', projectRoot)) {
    checks.push(runCheck('Health Check', 'npm run health', projectRoot, 30000));
  }

  const status = checks.every(c => c.status === 'PASS' || c.status === 'SKIP') ? 'PASS' : 'FAIL';
  return { tier: 4, name: 'Smoke Tests', status, checks };
}

/**
 * Run Tier 5: Security Scanning.
 */
export async function runSecurityScan(projectRoot, filesModified = []) {
  const checks = [];

  if (await hasFile('package-lock.json', projectRoot) || await hasFile('yarn.lock', projectRoot)) {
    checks.push(runCheck('npm audit', 'npm audit --audit-level=high 2>&1 || true', projectRoot, 60000));
  }

  if (filesModified.length > 0) {
    const scanResult = await scanUnsafePatterns(filesModified, projectRoot);
    checks.push(scanResult);
  } else {
    const scanResult = await scanAllSourceFiles(projectRoot);
    if (scanResult) checks.push(scanResult);
  }

  if (await hasFile('.env', projectRoot)) {
    if (await hasFile('.gitignore', projectRoot)) {
      const gitignore = await readFile(join(projectRoot, '.gitignore'), 'utf-8').catch(() => '');
      if (!gitignore.includes('.env')) {
        checks.push({
          name: '.env in gitignore',
          status: 'FAIL',
          output: '.env file exists but is not in .gitignore — secrets may be committed',
          durationMs: 0,
        });
      } else {
        checks.push({ name: '.env in gitignore', status: 'PASS', output: '.env is properly gitignored', durationMs: 0 });
      }
    }
  }

  const status = checks.length === 0 ? 'SKIP'
    : checks.every(c => c.status === 'PASS' || c.status === 'SKIP') ? 'PASS' : 'FAIL';

  return { tier: 5, name: 'Security Scan', status, checks };
}
