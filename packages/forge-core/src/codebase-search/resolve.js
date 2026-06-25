/**
 * @module codebase-search/resolve
 * @description Import path resolution for the code search engine.
 * Resolves relative and module-specifier imports to indexed file paths.
 */

import { basename, extname, dirname, join, sep } from 'node:path';

/**
 * Resolve a relative import path against the file's directory.
 *
 * @param {string} fromDir — directory of the importing file (relative)
 * @param {string} importPath — the import specifier
 * @param {Map<string, object>} files — indexed file map
 * @returns {string[]}
 */
export function resolveRelativeImport(fromDir, importPath, files) {
  const normalized = importPath.startsWith('./') ? importPath.slice(2) : importPath;
  const basePath = join(fromDir, normalized).split(sep).join('/');

  const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
                      '/index.js', '/index.ts', '/index.jsx', '/index.tsx'];

  const matches = [];
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (files.has(candidate)) {
      matches.push(candidate);
    }
  }

  // Also try partial match
  if (matches.length === 0) {
    for (const [indexedPath] of files) {
      if (indexedPath.startsWith(basePath) || indexedPath.endsWith(basePath)) {
        matches.push(indexedPath);
      }
    }
  }

  return matches;
}

/**
 * Resolve import paths to actual indexed file paths.
 * Handles relative paths (./foo, ../bar) and module specifiers.
 *
 * @param {{ path: string, importPaths: string[] }} record
 * @param {Map<string, object>} files — indexed file map
 * @returns {string[]}
 */
export function resolveImportPaths(record, files) {
  const resolved = [];
  const fileDir = dirname(record.path);

  for (const imp of record.importPaths) {
    if (imp.startsWith('.') || imp.startsWith('/')) {
      const candidates = resolveRelativeImport(fileDir, imp, files);
      resolved.push(...candidates);
    } else {
      // Module specifier — try exact match in index
      for (const [indexedPath] of files) {
        if (indexedPath.includes(imp) || imp.includes(basename(indexedPath, extname(indexedPath)))) {
          resolved.push(indexedPath);
        }
      }
    }
  }

  return [...new Set(resolved)];
}
