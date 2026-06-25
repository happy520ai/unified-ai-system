/**
 * @module ast-parser
 * @description Lightweight, zero-dependency AST parser for JavaScript and
 * TypeScript files. Uses regex-based extraction to build a symbol table
 * covering imports, exports, functions, classes, constants, interfaces,
 * type aliases, enums, and common route handler patterns.
 *
 * Pure helper functions are delegated to `ast-parser-helpers.js`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { CodebaseIndex } from './codebase-index.js';
import {
  computeSkipRanges,
  extractImports,
  extractExports,
  walkDirectory,
  matchesPatterns,
  relPath,
} from './ast-parser-helpers.js';
import {
  extractSymbols,
  deduplicateSymbols,
} from './ast-parser-extract.js';

// ---------------------------------------------------------------------------
// ASTParser
// ---------------------------------------------------------------------------

/**
 * Zero-dependency, regex-based source-code parser for JavaScript and
 * TypeScript files.
 *
 * @example
 * ```js
 * const parser = new ASTParser();
 * const result = parser.parseFile('./src/index.js');
 * const index  = await parser.parseProject('./src');
 * ```
 */
export class ASTParser {
  /** @type {string|null} Project root used to compute relative paths */
  #projectRoot = null;

  /** @type {string[]} Glob-like patterns (simplified) for file discovery */
  #patterns = [];

  /**
   * @param {{ projectRoot?: string }} [options]
   */
  constructor(options = {}) {
    this.#projectRoot = options.projectRoot ?? null;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Parse a single file and extract symbols, imports, and exports.
   *
   * @param {string} filePath - Absolute or relative path to the source file
   * @returns {Promise<import('./codebase-index.js').ParsedFile>}
   */
  async parseFile(filePath) {
    const absPath = path.resolve(filePath);
    let source;
    try {
      source = await fs.readFile(absPath, 'utf-8');
    } catch (err) {
      // Gracefully handle unreadable files
      return {
        file: relPath(absPath, this.#projectRoot),
        symbols: [],
        imports: [],
        exports: [],
        error: err.message,
      };
    }

    const rp = relPath(absPath, this.#projectRoot);
    return parseSource(source, rp);
  }

  /**
   * Parse an entire project directory tree and return a {@link CodebaseIndex}.
   *
   * @param {string} projectRoot - Root directory to scan
   * @param {{ patterns?: string[], ignore?: string[] }} [options]
   * @returns {Promise<CodebaseIndex>}
   */
  async parseProject(projectRoot, options = {}) {
    const {
      patterns = ['src/**/*.js', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.tsx', 'lib/**/*.js', 'lib/**/*.ts'],
      ignore = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'],
    } = options;

    this.#projectRoot = path.resolve(projectRoot);
    this.#patterns = patterns;

    const absRoot = this.#projectRoot;
    const files = await walkDirectory(absRoot, ignore, fs);

    // Filter files against simplified glob patterns
    const matched = files.filter((f) => matchesPatterns(f, absRoot, patterns));

    const parsedFiles = [];
    const errors = [];

    // Parse files in parallel batches to avoid overwhelming the event loop
    const BATCH_SIZE = 50;
    for (let i = 0; i < matched.length; i += BATCH_SIZE) {
      const batch = matched.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (absPath) => {
          try {
            const source = await fs.readFile(absPath, 'utf-8');
            const rp = relPath(absPath, this.#projectRoot);
            return parseSource(source, rp);
          } catch (err) {
            errors.push({ file: relPath(absPath, this.#projectRoot), error: err.message });
            return null;
          }
        }),
      );
      for (const r of results) {
        if (r) parsedFiles.push(r);
      }
    }

    const index = new CodebaseIndex(parsedFiles);

    // Attach errors for diagnostics
    if (errors.length > 0) {
      index._parseErrors = errors;
    }

    return index;
  }
}

// ---------------------------------------------------------------------------
// Source parsing (core engine) — module-level function
// ---------------------------------------------------------------------------

/**
 * Parse raw source text and extract all symbols, imports, and exports.
 *
 * @param {string} source - File source code
 * @param {string} rp - Relative file path for diagnostics
 * @returns {import('./codebase-index.js').ParsedFile}
 */
function parseSource(source, rp) {
  const lines = source.split('\n');
  /** @type {import('./codebase-index.js').SymbolEntry[]} */
  const symbols = [];
  /** @type {import('./codebase-index.js').ImportEntry[]} */
  const imports = [];
  /** @type {import('./codebase-index.js').ExportEntry[]} */
  const exports = [];

  // Track which line ranges are inside block comments
  const skipRanges = computeSkipRanges(source, lines);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1; // 1-based
    const line = lines[i];

    // Skip lines inside block comments
    if (skipRanges.has(i)) continue;

    // Skip single-line comments
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // --- Imports ---
    extractImports(line, rp, lineNum, imports);

    // --- Exports ---
    extractExports(line, rp, lineNum, exports);

    // --- Symbols ---
    extractSymbols(line, rp, lineNum, symbols, exports);
  }

  // Deduplicate symbols (a single declaration may match multiple patterns)
  const dedupedSymbols = deduplicateSymbols(symbols);

  return { file: rp, symbols: dedupedSymbols, imports, exports };
}
