/**
 * @module codebase-search/signature
 * @description Import path extraction and structural signature extraction
 * for the code search engine.
 */

import { basename, extname } from 'node:path';
import {
  IMPORT_ESM_RE,
  IMPORT_CJS_RE,
  IMPORT_DYNAMIC_RE,
  EXPORT_RE,
  CLASS_RE,
  FUNCTION_RE,
  TYPE_RE,
} from './constants.js';

// ── Import extraction ────────────────────────────────────────────────────────

/**
 * Extract all import/require source paths from file content.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function extractImportPaths(content) {
  if (!content) return [];
  const paths = new Set();
  let m;

  for (const re of [IMPORT_ESM_RE, IMPORT_CJS_RE, IMPORT_DYNAMIC_RE]) {
    re.lastIndex = 0;
    while ((m = re.exec(content)) !== null) {
      paths.add(m[1]);
    }
  }

  return [...paths];
}

// ── Structural extraction ────────────────────────────────────────────────────

/**
 * Extract structural signature from file content: exports, classes,
 * functions, types, and import paths.
 *
 * @param {string} content
 * @param {string} filePath
 * @returns {{ exports: string[], classes: string[], functions: string[], types: string[], imports: string[] }}
 */
export function extractSignature(content, filePath) {
  const exports = [];
  const classes = [];
  const functions = [];
  const types = [];
  const imports = extractImportPaths(content);

  if (!content) return { exports, classes, functions, types, imports };

  let m;

  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(content)) !== null) {
    exports.push(m[1]);
  }

  CLASS_RE.lastIndex = 0;
  while ((m = CLASS_RE.exec(content)) !== null) {
    classes.push(m[1]);
  }

  FUNCTION_RE.lastIndex = 0;
  while ((m = FUNCTION_RE.exec(content)) !== null) {
    functions.push(m[1] || m[2]);
  }

  TYPE_RE.lastIndex = 0;
  while ((m = TYPE_RE.exec(content)) !== null) {
    types.push(m[1]);
  }

  return { exports, classes, functions, types, imports };
}
