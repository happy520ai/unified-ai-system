/**
 * Action execution engine extracted from BaseWorker.
 *
 * Handles the execution of individual LLM-generated actions (write, edit, diff,
 * bash, read) with safety checks, path validation, syntax verification, and
 * auto-fix. Also exports the helper functions for path matching, import
 * validation, and fuzzy edit matching.
 */

import { readFile, writeFile, mkdir, stat, readdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { matchGlob } from './glob.js';
import { validateJsSyntax, tryFixSyntax, autoLint } from './base-syntax-utils.js';

/**
 * Execute a single action (write/edit/diff/bash/read) within the project.
 *
 * @param {object} action — the action object from LLM response
 * @param {string} projectRoot — absolute path to the project root
 * @param {object} task — the task being executed (for allowed_files)
 * @param {object} opts
 * @param {object} opts.logger — ForgeLogger instance
 * @param {object} opts.bashSafety — BashSafety instance
 * @param {object} opts.incrementalEdit — IncrementalEdit instance
 * @param {string[]} opts.tools — available tool names
 * @returns {Promise<object>} — action result
 */
export async function executeAction(action, projectRoot, task, opts) {
  const { logger, bashSafety, incrementalEdit } = opts;
  let fullPath = resolve(projectRoot, action.path || '');
  let relPath = action.path || '';

  // Security: block path traversal for ALL actions
  const resolvedRoot = resolve(projectRoot);
  if (fullPath !== resolvedRoot && !fullPath.startsWith(resolvedRoot + '/') && !fullPath.startsWith(resolvedRoot + '\\')) {
    throw new Error(`Path traversal blocked: ${relPath} resolves outside project root`);
  }

  // Security: only restrict destructive operations (write/edit) to allowed patterns
  const mutatingActions = new Set(['write', 'edit', 'diff']);
  if (action.path && mutatingActions.has(action.type)) {
    const patterns = task.allowed_files || task.allowedFiles;
    if (!isAllowed(relPath, patterns)) {
      const inferred = inferCorrectPath(relPath, patterns);
      if (inferred && isAllowed(inferred, patterns)) {
        logger.info(`Path auto-corrected: ${relPath} → ${inferred} (inferred subdirectory prefix)`);
        action.path = inferred;
        relPath = inferred;
        fullPath = resolve(projectRoot, inferred);
      } else {
        logger.info(`BLOCKED: ${relPath} not in patterns: ${JSON.stringify(patterns?.slice?.(0, 5) || patterns)}`);
        throw new Error(`File ${relPath} is not in allowed patterns`);
      }
    }
  }

  switch (action.type) {
    case 'write': {
      await mkdir(dirname(fullPath), { recursive: true });

      let contentToWrite = action.content;
      if (typeof contentToWrite !== 'string') {
        if (contentToWrite && typeof contentToWrite === 'object') {
          contentToWrite = JSON.stringify(contentToWrite, null, 2);
        } else {
          contentToWrite = String(contentToWrite || '');
        }
        logger.info(`Warning: action.content was not a string, coerced to string for ${relPath}`);
      }

      // Pre-write syntax validation for JS files
      if (relPath.match(/\.m?js$/)) {
        const syntaxCheck = await validateJsSyntax(contentToWrite);
        if (!syntaxCheck.valid) {
          logger.info(`Syntax error in ${relPath} (line ${syntaxCheck.line || '?'}): ${syntaxCheck.error}`);
          const fixed = tryFixSyntax(contentToWrite);
          if (fixed) {
            const retryCheck = await validateJsSyntax(fixed);
            if (retryCheck.valid) {
              logger.info(`Auto-fixed syntax errors in ${relPath}`);
              contentToWrite = fixed;
            } else {
              logger.info(`Auto-fix did not resolve all errors: ${retryCheck.error}`);
            }
          } else {
            logger.info(`Could not auto-fix syntax errors in ${relPath}`);
          }
        }

        // Pre-write import validation
        const importFix = fixAndValidateImports(contentToWrite, fullPath, relPath);
        if (importFix.fixed) {
          logger.info(`Auto-fixed import issues in ${relPath}: ${importFix.fixes.join('; ')}`);
          contentToWrite = importFix.content;
        }
        for (const w of importFix.warnings) {
          logger.info(`Import warning in ${relPath}: ${w}`);
        }
      }

      await writeFile(fullPath, contentToWrite, 'utf-8');
      try {
        await access(fullPath);
        const written = await readFile(fullPath, 'utf-8');
        if (written.length === 0 && contentToWrite.length > 0) {
          throw new Error('File was written but is empty');
        }
      } catch (verifyErr) {
        throw new Error(`Write verification failed for ${relPath}: ${verifyErr.message}`);
      }
      await autoLint(fullPath, relPath, logger);
      return { modified: true, path: relPath, action: 'created' };
    }

    case 'edit': {
      const oldStr = typeof action.oldString === 'string' ? action.oldString : String(action.oldString || '');
      const newStr = typeof action.newString === 'string' ? action.newString : String(action.newString || '');
      const current = await readFile(fullPath, 'utf-8');

      if (!current.includes(oldStr)) {
        // Fuzzy matching: normalize whitespace
        const fuzzyResult = fuzzyMatchEdit(current, oldStr, newStr);
        if (fuzzyResult) {
          await writeFile(fullPath, fuzzyResult.content, 'utf-8');
          try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
          logger.info(fuzzyResult.message);
          return { modified: true, path: relPath, action: 'modified' };
        }

        // Line-based matching
        const lineResult = lineBasedEdit(current, oldStr, newStr);
        if (lineResult) {
          await writeFile(fullPath, lineResult.content, 'utf-8');
          try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
          logger.info(lineResult.message);
          return { modified: true, path: relPath, action: 'modified' };
        }

        const snippet = current.slice(0, 2000);
        throw new Error(`oldString not found in ${relPath}. Actual file content starts with:\n\`\`\`\n${snippet}\n\`\`\``);
      }

      const updated = current.replace(oldStr, newStr);

      // Post-edit syntax validation for JS files
      if (relPath.match(/\.m?js$/)) {
        const editCheck = await validateJsSyntax(updated);
        if (!editCheck.valid) {
          logger.info(`Edit would introduce syntax error in ${relPath} (line ${editCheck.line || '?'}): ${editCheck.error}`);
          const fixed = tryFixSyntax(updated);
          if (fixed) {
            const retryCheck = await validateJsSyntax(fixed);
            if (retryCheck.valid) {
              logger.info(`Auto-fixed post-edit syntax errors in ${relPath}`);
              await writeFile(fullPath, fixed, 'utf-8');
              try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
              return { modified: true, path: relPath, action: 'modified' };
            }
          }
          logger.info(`Proceeding with edit despite syntax warning for ${relPath}`);
        }
      }

      await writeFile(fullPath, updated, 'utf-8');
      try { await access(fullPath); } catch { throw new Error(`Edit verification failed for ${relPath}`); }
      await autoLint(fullPath, relPath, logger);
      return { modified: true, path: relPath, action: 'modified' };
    }

    case 'diff': {
      if (!action.edits || !Array.isArray(action.edits)) {
        throw new Error(`Diff action requires an "edits" array`);
      }
      const diffResult = await incrementalEdit.applyDiffToFile(fullPath, action.edits);
      if (diffResult.errors.length > 0) {
        logger.info(`Diff edit had ${diffResult.errors.length} error(s): ${diffResult.errors.join('; ')}`);
      }
      if (diffResult.applied > 0) {
        if (relPath.match(/\.m?js$/)) {
          await autoLint(fullPath, relPath, logger);
        }
        logger.info(`Diff edit: ${diffResult.applied} edit(s) applied to ${relPath}`);
        return { modified: true, path: relPath, action: 'diff-applied', applied: diffResult.applied, errors: diffResult.errors };
      }
      return { modified: false, path: relPath, errors: diffResult.errors };
    }

    case 'bash': {
      const { SafetyVerdict } = await import('../bash-safety/index.js');
      const safetyCheck = bashSafety.check(action.command);
      if (safetyCheck.verdict === SafetyVerdict.BLOCKED) {
        logger.info(`Bash BLOCKED: "${action.command?.slice(0, 60)}" — ${safetyCheck.reason}`);
        return { modified: false, output: `Command blocked by safety policy: ${safetyCheck.reason}` };
      }
      if (safetyCheck.verdict === SafetyVerdict.NEEDS_REVIEW) {
        logger.info(`Bash NEEDS_REVIEW: "${action.command?.slice(0, 60)}" — skipping in automated mode`);
        return { modified: false, output: `Command requires manual review: ${safetyCheck.reason}` };
      }
      const { execSync } = await import('node:child_process');
      try {
        const output = execSync(action.command, {
          cwd: projectRoot,
          timeout: 60000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { modified: false, output: output.slice(0, 5000) };
      } catch (err) {
        return { modified: false, output: err.stderr?.slice(0, 5000) || err.message };
      }
    }

    case 'read': {
      try {
        const fileStat = await stat(fullPath);
        if (fileStat.isDirectory()) {
          const entries = await readdir(fullPath);
          return { modified: false, output: `Directory: ${entries.join('\n')}` };
        }
        const content = await readFile(fullPath, 'utf-8');
        return { modified: false, output: content.slice(0, 8000) };
      } catch (err) {
        if (err.code === 'ENOENT') {
          return { modified: false, output: `File not found: ${relPath}. Use "write" action to create it.` };
        }
        throw err;
      }
    }

    default:
      return { modified: false };
  }
}

/**
 * Check if a file path matches any of the allowed glob patterns.
 * @param {string} filePath
 * @param {string[]|string} patterns
 * @returns {boolean}
 */
export function isAllowed(filePath, patterns) {
  if (!patterns) return true;
  let pats;
  if (typeof patterns === 'string') {
    try { pats = JSON.parse(patterns); } catch { return true; }
  } else {
    pats = patterns;
  }
  if (!Array.isArray(pats)) return true;
  return pats.some(pat => matchGlob(filePath, pat));
}

/**
 * Validate and auto-fix import statements in generated JS.
 *
 * Catches semantic errors that pass `node --check` but crash on module load:
 *   1. `import { assert } from 'node:test'` — assert is NOT exported by
 *      node:test. Auto-fix: split into separate imports.
 *   2. Local relative imports pointing to non-existent files — logged as warning.
 *
 * @param {string} content — JavaScript source code
 * @param {string} fullPath — absolute file path
 * @param {string} relPath — relative path for logging
 * @returns {{fixed: boolean, content: string, fixes: string[], warnings: string[]}}
 */
export function fixAndValidateImports(content, fullPath, relPath) {
  const result = { fixed: false, content, fixes: [], warnings: [] };
  if (typeof content !== 'string' || !content) return result;
  let out = content;

  // Fix 1: `import { ..., assert, ... } from 'node:test'` → split assert out
  const nodeTestAssert = /import\s*\{([^}]*)\}\s*from\s*['"]node:test['"];?/g;
  let m;
  while ((m = nodeTestAssert.exec(content)) !== null) {
    const specifiers = m[1].split(',').map(s => s.trim()).filter(Boolean);
    const hasAssert = specifiers.some(s => s === 'assert' || s.startsWith('assert '));
    if (!hasAssert) continue;
    const others = specifiers.filter(s => !(s === 'assert' || s.startsWith('assert ')));
    const replacement = others.length > 0
      ? `import { ${others.join(', ')} } from 'node:test';\nimport assert from 'node:assert';`
      : `import assert from 'node:assert';`;
    out = out.replace(m[0], replacement);
    result.fixes.push(`moved 'assert' import from node:test to node:assert`);
  }

  // Fix 2: check local relative imports exist on disk
  const localImport = /(?:import\s*[^;]*?from\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
  while ((m = localImport.exec(out)) !== null) {
    const spec = m[1];
    try {
      const baseDir = dirname(fullPath);
      let candidate = resolve(baseDir, spec);
      const tryPaths = extname(spec) ? [candidate] : [candidate, candidate + '.mjs', candidate + '.js', candidate + '/index.mjs', candidate + '/index.js'];
      const found = tryPaths.some(p => existsSync(p));
      if (!found) {
        result.warnings.push(`local import '${spec}' does not resolve to an existing file (will be created later?)`);
      }
    } catch { /* path resolution is best-effort */ }
  }

  if (out !== content) { result.fixed = true; result.content = out; }
  return result;
}

/**
 * When the LLM forgets a subdirectory prefix, try to infer the correct full
 * path by matching the file's basename against concrete (non-glob) allowed
 * patterns that share the same basename.
 *
 * @param {string} filePath — the file path to correct
 * @param {string[]|string} patterns — allowed file patterns
 * @returns {string|null} — corrected path, or null if ambiguous
 */
export function inferCorrectPath(filePath, patterns) {
  if (!patterns || !filePath) return null;
  let pats;
  if (typeof patterns === 'string') {
    try { pats = JSON.parse(patterns); } catch { return null; }
  } else {
    pats = patterns;
  }
  if (!Array.isArray(pats)) return null;

  const fileBasename = filePath.split(/[\\/]/).pop().toLowerCase();
  const candidates = [];
  for (const pat of pats) {
    if (typeof pat !== 'string') continue;
    if (pat.includes('*') || pat.includes('?')) continue;
    const patBasename = pat.split(/[\\/]/).pop().toLowerCase();
    if (patBasename === fileBasename && pat !== filePath) {
      candidates.push(pat);
    }
  }
  if (candidates.length === 1) return candidates[0];
  return null;
}

/**
 * Fuzzy edit: normalize whitespace and try to find oldStr in current content.
 * @returns {{ content: string, message: string }|null}
 */
function fuzzyMatchEdit(current, oldStr, newStr) {
  const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
  const normalizedCurrent = normalize(current);
  const normalizedOld = normalize(oldStr);

  if (normalizedCurrent.includes(normalizedOld)) {
    const updated = normalizedCurrent.replace(normalizedOld, newStr.replace(/\r\n/g, '\n'));
    return { content: updated, message: 'Fuzzy edit (whitespace normalized) succeeded' };
  }
  return null;
}

/**
 * Line-based fuzzy edit: find the best block of matching lines and replace.
 * @returns {{ content: string, message: string }|null}
 */
function lineBasedEdit(current, oldStr, newStr) {
  const currentLines = current.split('\n');
  const oldLines = oldStr.split('\n').map(l => l.trimEnd());

  if (oldLines.length === 0 || currentLines.length === 0) return null;

  let bestStart = -1;
  let bestScore = 0;

  for (let i = 0; i <= currentLines.length - oldLines.length; i++) {
    let score = 0;
    for (let j = 0; j < oldLines.length; j++) {
      if (currentLines[i + j].trimEnd() === oldLines[j].trimEnd()) score++;
    }
    if (score > bestScore) { bestScore = score; bestStart = i; }
  }

  if (bestStart >= 0 && bestScore / oldLines.length >= 0.6) {
    const newLines = currentLines.slice();
    newLines.splice(bestStart, oldLines.length, ...newStr.split('\n'));
    return {
      content: newLines.join('\n'),
      message: `Fuzzy edit: matched ${bestScore}/${oldLines.length} lines at line ${bestStart + 1}`,
    };
  }
  return null;
}
