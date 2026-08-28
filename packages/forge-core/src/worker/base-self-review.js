/**
 * Self-review utilities for BaseWorker.
 * Validates syntax and types of modified files, attempts auto-fix.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateJsSyntax, tryFixSyntax } from './base-syntax-utils.js';

/**
 * Self-review modified files: check JS syntax and TS types.
 * Attempts auto-fix for syntax issues.
 * @param {string} projectRoot
 * @param {Array} filesModified
 * @param {object} options
 * @param {object|null} options.sandboxExecutor
 * @param {AbortSignal} [options.signal]
 * @returns {{ valid: boolean, issues: Array, autoFixed: number }}
 */
export async function selfReview(projectRoot, filesModified, options = {}) {
  const issues = [];
  let autoFixed = 0;
  const jsFiles = [], tsFiles = [];
  for (const fm of filesModified) {
    const fp = fm.path || fm;
    if (typeof fp !== 'string') continue;
    if (fp.match(/\.(m?js|cjs)$/)) jsFiles.push(fp);
    else if (fp.match(/\.tsx?$/)) tsFiles.push(fp);
  }
  if (jsFiles.length === 0 && tsFiles.length === 0) return { valid: true, issues: [], autoFixed: 0 };
  const { execFileSync } = await import('node:child_process');
  for (const relPath of jsFiles) {
    const fullPath = resolve(projectRoot, relPath);
    try {
      execFileSync(process.execPath, ['--check', fullPath], { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      const stderr = err.stderr || err.message || '';
      const errorLine = stderr.split('\n').find(l => l.includes('SyntaxError')) || stderr.split('\n')[0] || 'Unknown syntax error';
      issues.push({ file: relPath, error: errorLine.trim(), type: 'syntax' });
    }
  }
  if (tsFiles.length > 0) {
    try {
      await import('node:fs/promises').then(fs => fs.access(join(projectRoot, 'tsconfig.json')));
      if (!options.sandboxExecutor) {
        issues.push({
          file: tsFiles[0],
          error: 'SANDBOX_BACKEND_UNAVAILABLE: TypeScript project checks require an attested isolation backend.',
          type: 'sandbox',
        });
      } else {
        const tscResult = await options.sandboxExecutor.execute(
          'npx --no-install tsc --noEmit --skipLibCheck',
          {
            cwd: projectRoot,
            level: 'full',
            workspaceMode: 'ro',
            timeout: 30_000,
            signal: options.signal,
          },
        );
        if (tscResult.exitCode !== 0) {
          const output = tscResult.stdout || tscResult.stderr || tscResult.killReason || '';
        for (const tsFile of tsFiles) {
          const fileErrors = output.split('\n').filter(line => line.includes(tsFile) && line.includes('error'));
          for (const errLine of fileErrors.slice(0, 5)) issues.push({ file: tsFile, error: errLine.trim(), type: 'type' });
        }
        if (!issues.some(i => i.type === 'type')) {
          const firstError = output.split('\n').find(l => l.includes('error')) || output.split('\n')[0] || 'TypeScript compilation failed';
          issues.push({ file: tsFiles[0], error: firstError.trim(), type: 'type' });
        }
        }
      }
    } catch { /* tsconfig not found */ }
  }
  // Attempt auto-fix for syntax issues
  if (issues.some(i => i.type === 'syntax')) {
    for (const issue of issues.filter(i => i.type === 'syntax')) {
      try {
        const fullPath = resolve(projectRoot, issue.file);
        const content = await readFile(fullPath, 'utf-8');
        const fixed = tryFixSyntax(content);
        if (fixed) { const check = await validateJsSyntax(fixed); if (check.valid) { await writeFile(fullPath, fixed, 'utf-8'); autoFixed++; } }
      } catch { /* auto-fix failed */ }
    }
    if (autoFixed > 0) {
      const remainingSyntax = [];
      for (const issue of issues.filter(i => i.type === 'syntax')) {
        const fullPath = resolve(projectRoot, issue.file);
        try { execFileSync(process.execPath, ['--check', fullPath], { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }); }
        catch (err) { const stderr = err.stderr || err.message || ''; const errorLine = stderr.split('\n').find(l => l.includes('SyntaxError')) || stderr.split('\n')[0] || 'Unknown error'; remainingSyntax.push({ file: issue.file, error: errorLine.trim(), type: 'syntax' }); }
      }
      const nonSyntax = issues.filter(i => i.type !== 'syntax');
      const remaining = [...remainingSyntax, ...nonSyntax];
      return { valid: remaining.length === 0, issues: remaining, autoFixed };
    }
  }
  return { valid: issues.length === 0, issues, autoFixed };
}
