/**
 * @module codebase-search/tokenize
 * @description Tokenization helpers and file walking for the code search engine.
 */

import { readdir } from 'node:fs/promises';
import { join, relative, extname, sep } from 'node:path';
import { SKIP_DIRS, SOURCE_EXTENSIONS, STOP_WORDS } from './constants.js';

// ── Tokenization helpers ─────────────────────────────────────────────────────

/**
 * Split a camelCase, PascalCase, or snake_case identifier into sub-tokens.
 *
 * Examples:
 *   'getUserName'    -> ['get', 'user', 'name']
 *   'HTTPResponse'   -> ['http', 'response']
 *   'snake_case_var' -> ['snake', 'case', 'var']
 *
 * @param {string} ident
 * @returns {string[]}
 */
export function splitIdentifier(ident) {
  const spaced = ident
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ');
  return spaced
    .split(/\s+/)
    .map(t => t.toLowerCase())
    .filter(t => t.length >= 2);
}

/**
 * Tokenize a source file's content into weighted tokens.
 *
 * Extracts:
 *   - Identifiers (split on casing boundaries)
 *   - String literal keywords (quoted strings split into words)
 *   - Comment keywords
 *
 * @param {string} content — raw file content
 * @returns {Map<string, number>} token -> raw count
 */
export function tokenizeFile(content) {
  /** @type {Map<string, number>} */
  const tokens = new Map();

  if (!content) return tokens;

  // Strip single-line comments to a separate stream for keyword extraction
  const commentText = [];
  const codeText = content.replace(/\/\/(.*)$/gm, (_, c) => {
    commentText.push(c);
    return '';
  }).replace(/\/\*[\s\S]*?\*\//g, (m) => {
    commentText.push(m);
    return '';
  });

  // 1. Extract identifiers from code (word chars, 2+ length)
  const identRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]+)\b/g;
  let m;
  while ((m = identRe.exec(codeText)) !== null) {
    const raw = m[1];
    if (raw.startsWith('$')) continue; // skip $-prefixed
    const subTokens = splitIdentifier(raw);
    for (const st of subTokens) {
      if (STOP_WORDS.has(st)) continue;
      tokens.set(st, (tokens.get(st) || 0) + 1);
    }
  }

  // 2. Extract string literal keywords (single/double/backtick quoted)
  const strRe = /['"`]([^'"`\n]{2,80})['"`]/g;
  while ((m = strRe.exec(codeText)) !== null) {
    const words = m[1].split(/[\s/\-_.:,@#]+/);
    for (const w of words) {
      const lower = w.toLowerCase();
      if (lower.length >= 2 && !STOP_WORDS.has(lower)) {
        tokens.set(lower, (tokens.get(lower) || 0) + 1);
      }
    }
  }

  // 3. Extract comment keywords
  const commentJoined = commentText.join(' ');
  const wordRe = /\b([a-zA-Z]{2,})\b/g;
  while ((m = wordRe.exec(commentJoined)) !== null) {
    const lower = m[1].toLowerCase();
    if (!STOP_WORDS.has(lower)) {
      tokens.set(lower, (tokens.get(lower) || 0) + 1);
    }
  }

  return tokens;
}

/**
 * Tokenize a natural-language search query.
 * Splits on whitespace and casing, lowercases, removes stop words.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeQuery(query) {
  if (!query) return [];
  const words = query
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  return [...new Set(words)]; // deduplicate
}

// ── File walking ─────────────────────────────────────────────────────────────

/**
 * Recursively walk a directory and collect indexable file paths.
 *
 * @param {string} dir — absolute directory path
 * @param {string} root — project root for relative path computation
 * @param {string[]} [extraSkip] — additional directory names to skip
 * @returns {Promise<Array<{ absPath: string, relPath: string }>>}
 */
export async function walkFiles(dir, root, extraSkip = []) {
  const skipSet = extraSkip.length > 0
    ? new Set([...SKIP_DIRS, ...extraSkip])
    : SKIP_DIRS;

  /** @type {Array<{ absPath: string, relPath: string }>} */
  const results = [];

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const absPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipSet.has(entry.name) || entry.name.startsWith('.')) continue;
      const sub = await walkFiles(absPath, root, extraSkip);
      results.push(...sub);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      // Skip very large files by name heuristic (minified bundles)
      if (entry.name.endsWith('.min.js') || entry.name.endsWith('.bundle.js')) continue;
      const relPath = relative(root, absPath).split(sep).join('/');
      results.push({ absPath, relPath });
    }
  }

  return results;
}
