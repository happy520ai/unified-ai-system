/**
 * Simple glob implementation for file matching within a project root.
 * Supports: **, *, ? patterns.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const IGNORED = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage',
  '.next', '.turbo', '__pycache__', '.cache', '.DS_Store',
]);

/**
 * Find files matching a glob pattern relative to root.
 * @param {string} root — absolute project root
 * @param {string} pattern - glob pattern like "src/xx/x.js"
 * @param {number} maxResults — cap results
 * @returns {string[]} — relative file paths
 */
export async function glob(root, pattern, maxResults = 100) {
  const allFiles = [];
  await walk(root, root, allFiles, 1000);

  return allFiles
    .filter(f => matchGlob(f, pattern))
    .slice(0, maxResults);
}

async function walk(dir, root, results, maxFiles) {
  if (results.length >= maxFiles) return;
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }

  for (const entry of entries) {
    if (results.length >= maxFiles) break;
    if (entry.name.startsWith('.') && IGNORED.has(entry.name)) continue;
    if (IGNORED.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, root, results, maxFiles);
    } else if (entry.isFile()) {
      results.push(relative(root, full).replace(/\\/g, '/'));
    }
  }
}

/**
 * Match a relative path against a glob pattern.
 * Supports ** (any depth), * (single segment), ? (single char).
 */
export function matchGlob(filePath, pattern) {
  // Build regex step by step, handling special chars properly
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      // ** = match anything including /
      regex += '.*';
      i += 2;
      // skip trailing / after **
      if (pattern[i] === '/') i++;
    } else if (c === '*') {
      // * = match anything except /
      regex += '[^/]*';
      i++;
    } else if (c === '?') {
      // ? = match single char except /
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(c)) {
      // escape regex special chars
      regex += '\\' + c;
      i++;
    } else {
      regex += c;
      i++;
    }
  }

  return new RegExp(`^${regex}$`).test(filePath);
}
