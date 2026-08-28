/**
 * Syntax validation, auto-fix, and auto-lint utilities extracted from BaseWorker.
 *
 * These functions handle JavaScript/TypeScript syntax checking via `node --check`,
 * automatic repair of common syntax errors (unclosed brackets, missing `);`),
 * and basic code formatting (eslint fallback).
 */

import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join as pathJoin, dirname } from 'node:path';

function quotePosixShellArg(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

async function writeFileNoFollow(path, content) {
  const flags = fsConstants.O_WRONLY
    | fsConstants.O_CREAT
    | fsConstants.O_TRUNC
    | (fsConstants.O_NOFOLLOW ?? 0);
  const handle = await open(path, flags, 0o600);
  try { await handle.writeFile(content, 'utf8'); }
  finally { await handle.close(); }
}

/**
 * Validate JavaScript syntax using `node --check` without executing the code.
 * Handles both CommonJS and ESM (import/export) syntax.
 *
 * @param {string} content — JavaScript source code
 * @returns {Promise<{ valid: boolean, error?: string, line?: number }>}
 */
export async function validateJsSyntax(content) {
  if (typeof content !== 'string') {
    return { valid: false, error: 'Content is not a string (type: ' + typeof content + ')', line: null };
  }
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os');

  const tmpFile = pathJoin(os.tmpdir(), `forge-check-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
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
    try { await unlink(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Attempt to fix common JavaScript syntax errors automatically.
 * Currently handles: unclosed brackets/parens, missing closing `);` on
 * describe/it blocks.
 *
 * @param {string} content — JavaScript source code with syntax errors
 * @returns {string|null} — fixed code, or null if unfixable
 */
export function tryFixSyntax(content) {
  if (typeof content !== 'string') return null;
  let fixed = content;

  // Fix 1: Track unclosed brackets/parens using a stack, then close in LIFO order
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

  // Close unclosed brackets in reverse order (LIFO — innermost first)
  if (stack.length > 0) {
    let suffix = '';
    while (stack.length > 0) suffix += stack.pop();
    fixed = fixed.trimEnd() + '\n' + suffix + '\n';
  }

  // Fix 2: describe/it blocks missing ");" — `}` should become `});`
  fixed = fixed.replace(/^(\s*)\}\s*$/gm, (match, indent, offset) => {
    const before = fixed.slice(0, offset).trimEnd();
    const lastLine = before.split('\n').pop()?.trim() || '';
    if (lastLine.match(/\{$/) || lastLine.match(/\{[\s]*$/)) {
      let depth = 0;
      const lines = before.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        for (let j = line.length - 1; j >= 0; j--) {
          if (line[j] === '}') depth++;
          else if (line[j] === '{') depth--;
        }
        if (depth < 0 && line.match(/^(describe|it|test|before|after|beforeEach|afterEach)\s*\(/)) {
          return `${indent}});`;
        }
      }
    }
    return match;
  });

  return fixed !== content ? fixed : null;
}

/**
 * Auto-lint a written JS file: try eslint --fix first, fall back to basic
 * formatting. Non-fatal — logs warnings but doesn't block the write.
 *
 * @param {string} fullPath — absolute file path
 * @param {string} relPath — relative path for logging
 * @param {{ info: function(string): void }} logger — logger with info method
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {object|null} options.sandboxExecutor
 * @param {AbortSignal} [options.signal]
 */
export async function autoLint(fullPath, relPath, logger, options = {}) {
  if (!relPath.match(/\.m?js$/)) return;

  // Project ESLint configuration and plugins are executable code. They may run
  // only inside the attested container boundary; backend failure falls through
  // to the non-executable formatter below.
  if (options.sandboxExecutor && options.projectRoot) {
    const containerPath = String(relPath).replaceAll('\\', '/');
    if (!/[\0\r\n]/.test(containerPath)) {
      const result = await options.sandboxExecutor.execute(
        `npx --no-install eslint --fix -- ${quotePosixShellArg(containerPath)}`,
        {
          cwd: options.projectRoot,
          level: 'full',
          workspaceMode: 'rw',
          timeout: 15_000,
          signal: options.signal,
        },
      );
      if (result.exitCode === 0) {
        logger.info(`sandboxed eslint --fix succeeded for ${relPath}`);
        return;
      }
      logger.info(`Sandboxed eslint unavailable/failed for ${relPath}: ${(result.stderr || result.killReason || '').slice(0, 240)}`);
    }
  } else {
    logger.info(`Sandboxed eslint unavailable for ${relPath}; applying non-executable formatter only.`);
  }

  // Fallback: basic formatting pass
  try {
    const content = await readFile(fullPath, 'utf-8');
    let formatted = content
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t/g, '  ');

    formatted = formatted.trimEnd() + '\n';

    if (formatted !== content) {
      await writeFileNoFollow(fullPath, formatted);
      logger.info(`Basic formatting applied to ${relPath}`);
    }
  } catch (err) {
    logger.info(`Auto-lint skipped for ${relPath}: ${err.message}`);
  }
}
