/**
 * @module codebase-index
 * @description In-memory index of a parsed codebase. Provides fast lookups
 * of symbols, exports, entry points, and generates LLM-friendly summaries.
 */

import path from 'node:path';

/**
 * @typedef {Object} SymbolEntry
 * @property {string} name   - Symbol identifier
 * @property {string} type   - One of: function, class, variable, constant, interface, type, enum, route
 * @property {number} line   - 1-based line number of the declaration
 * @property {boolean} exported - Whether the symbol is exported
 * @property {string} file   - Relative file path that owns the symbol
 */

/**
 * @typedef {Object} ImportEntry
 * @property {string} source      - Raw import specifier (e.g. './utils', 'express')
 * @property {string[]} specifiers - Imported names (may be empty for side-effect imports)
 * @property {boolean} isDefault  - Whether this is a default import
 * @property {boolean} isNamespace - Whether this is a namespace import (import * as X)
 * @property {string} file        - Relative file path containing the import
 */

/**
 * @typedef {Object} ExportEntry
 * @property {string} name       - Exported name (or 'default')
 * @property {string} [localName] - Local binding name if different from exported name
 * @property {string} [source]   - Re-export source module, if this is a re-export
 * @property {string} file       - Relative file path containing the export
 */

/**
 * @typedef {Object} ParsedFile
 * @property {string} file       - Relative file path
 * @property {SymbolEntry[]} symbols
 * @property {ImportEntry[]} imports
 * @property {ExportEntry[]} exports
 */

/**
 * An in-memory, queryable index built from the output of {@link ASTParser.parseProject}.
 */
export class CodebaseIndex {
  /** @type {Map<string, ParsedFile>} file path -> parsed data */
  #files;

  /** @type {Map<string, SymbolEntry[]>} symbol name -> list of declarations */
  #symbolIndex;

  /** @type {Map<string, ExportEntry[]>} file path -> exports */
  #exportIndex;

  /** @type {Map<string, string>} exported symbol name -> first file that exports it */
  #exportedBy;

  /**
   * @param {ParsedFile[]} parsedFiles - Array of parsed file results
   */
  constructor(parsedFiles) {
    this.#files = new Map();
    this.#symbolIndex = new Map();
    this.#exportIndex = new Map();
    this.#exportedBy = new Map();

    for (const pf of parsedFiles) {
      this.#indexFile(pf);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal indexing
  // ---------------------------------------------------------------------------

  /**
   * Index a single parsed file into all lookup structures.
   * @param {ParsedFile} pf
   */
  #indexFile(pf) {
    this.#files.set(pf.file, pf);

    // Symbol index
    for (const sym of pf.symbols) {
      const bucket = this.#symbolIndex.get(sym.name);
      if (bucket) {
        bucket.push(sym);
      } else {
        this.#symbolIndex.set(sym.name, [sym]);
      }
    }

    // Export index
    this.#exportIndex.set(pf.file, pf.exports);
    for (const exp of pf.exports) {
      if (!this.#exportedBy.has(exp.name)) {
        this.#exportedBy.set(exp.name, pf.file);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public query API
  // ---------------------------------------------------------------------------

  /**
   * Find all declarations of a symbol by name across the entire codebase.
   * @param {string} name - The symbol name to search for
   * @returns {SymbolEntry[]} All matching declarations (may be empty)
   */
  findSymbol(name) {
    return this.#symbolIndex.get(name) ?? [];
  }

  /**
   * Find symbols whose names match a predicate.
   * @param {(name: string) => boolean} predicate
   * @returns {SymbolEntry[]}
   */
  findSymbolsBy(predicate) {
    const results = [];
    for (const [name, entries] of this.#symbolIndex) {
      if (predicate(name)) {
        results.push(...entries);
      }
    }
    return results;
  }

  /**
   * Find symbols of a specific type (e.g. 'function', 'class').
   * @param {string} type
   * @returns {SymbolEntry[]}
   */
  findSymbolsByType(type) {
    const results = [];
    for (const entries of this.#symbolIndex.values()) {
      for (const entry of entries) {
        if (entry.type === type) {
          results.push(entry);
        }
      }
    }
    return results;
  }

  /**
   * Get all exports from a given file.
   * @param {string} filePath - Relative file path
   * @returns {ExportEntry[]}
   */
  getExports(filePath) {
    return this.#exportIndex.get(filePath) ?? [];
  }

  /**
   * Find the first file that exports a given symbol name.
   * @param {string} symbolName
   * @returns {string|null} Relative file path, or null if not found
   */
  findExportingFile(symbolName) {
    return this.#exportedBy.get(symbolName) ?? null;
  }

  /**
   * Find all files that export a given symbol name (handles duplicates).
   * @param {string} symbolName
   * @returns {string[]}
   */
  findAllExportingFiles(symbolName) {
    const results = [];
    for (const [file, exports] of this.#exportIndex) {
      if (exports.some((e) => e.name === symbolName)) {
        results.push(file);
      }
    }
    return results;
  }

  /**
   * Get the parsed file record for a given path.
   * @param {string} filePath
   * @returns {ParsedFile|undefined}
   */
  getFile(filePath) {
    return this.#files.get(filePath);
  }

  /**
   * Get all file paths in the index.
   * @returns {string[]}
   */
  getAllFiles() {
    return [...this.#files.keys()];
  }

  /**
   * Get the total number of indexed files.
   * @returns {number}
   */
  get size() {
    return this.#files.size;
  }

  /**
   * Get all imports across all files.
   * @returns {ImportEntry[]}
   */
  getAllImports() {
    const results = [];
    for (const pf of this.#files.values()) {
      results.push(...pf.imports);
    }
    return results;
  }

  /**
   * Detect the entry points of the project.
   *
   * Heuristics (in priority order):
   * 1. Files named index.{js,ts,mjs,mts} at the top-level or in src/
   * 2. Files named main.{js,ts,mjs,mts}
   * 3. Files named app.{js,ts} or server.{js,ts}
   * 4. Files that are never imported by any other file (leaf entry points)
   *
   * @returns {string[]} Relative file paths considered entry points
   */
  getEntryPoints() {
    const entryNames = new Set([
      'index', 'main', 'app', 'server', 'cli', 'start', 'bootstrap',
    ]);
    const entryExtensions = new Set(['.js', '.ts', '.mjs', '.mts', '.cjs']);

    const namedEntries = [];
    const allImportedSources = new Set();

    for (const pf of this.#files.values()) {
      for (const imp of pf.imports) {
        allImportedSources.add(imp.source);
      }
    }

    for (const filePath of this.#files.keys()) {
      const parsed = path.parse(filePath);
      const baseName = parsed.name.toLowerCase();
      const ext = parsed.ext.toLowerCase();

      if (entryNames.has(baseName) && entryExtensions.has(ext)) {
        // Prefer shallower paths
        const depth = filePath.split('/').length;
        namedEntries.push({ filePath, depth });
      }
    }

    // Sort by depth (shallower first)
    namedEntries.sort((a, b) => a.depth - b.depth);

    if (namedEntries.length > 0) {
      return namedEntries.map((e) => e.filePath);
    }

    // Fallback: files that are never imported by anyone else
    const neverImported = [];
    for (const filePath of this.#files.keys()) {
      if (!this.#isFileImported(filePath, allImportedSources)) {
        neverImported.push(filePath);
      }
    }
    return neverImported;
  }

  /**
   * Check whether a file is imported by any other file.
   * @param {string} filePath
   * @param {Set<string>} allSources
   * @returns {boolean}
   */
  #isFileImported(filePath, allSources) {
    for (const source of allSources) {
      if (this.#resolveImportMatch(source, filePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Simple heuristic match between an import specifier and a file path.
   * @param {string} importSource
   * @param {string} filePath
   * @returns {boolean}
   */
  #resolveImportMatch(importSource, filePath) {
    // Normalize: strip extensions, handle index files
    const normalizedFile = filePath
      .replace(/\.(js|ts|mjs|mts|cjs|jsx|tsx)$/, '')
      .replace(/\/index$/, '');

    const normalizedSource = importSource
      .replace(/\.(js|ts|mjs|mts|cjs|jsx|tsx)$/, '')
      .replace(/\/index$/, '');

    if (normalizedFile === normalizedSource) return true;
    if (normalizedFile.endsWith(normalizedSource)) return true;

    return false;
  }

  /**
   * Build a compact, LLM-friendly summary of the codebase.
   * @param {{ maxFiles?: number, maxSymbolsPerFile?: number }} [options]
   * @returns {string}
   */
  toSummary(options = {}) {
    const { maxFiles = 100, maxSymbolsPerFile = 20 } = options;
    const lines = [];

    lines.push(`# Codebase Index Summary`);
    lines.push('');
    lines.push(`- **Total files**: ${this.#files.size}`);

    const totalSymbols = [...this.#symbolIndex.values()].reduce(
      (acc, arr) => acc + arr.length,
      0,
    );
    lines.push(`- **Total symbols**: ${totalSymbols}`);

    const totalExports = [...this.#exportIndex.values()].reduce(
      (acc, arr) => acc + arr.length,
      0,
    );
    lines.push(`- **Total exports**: ${totalExports}`);
    lines.push('');

    // Entry points
    const entries = this.getEntryPoints();
    if (entries.length > 0) {
      lines.push(`## Entry Points`);
      for (const ep of entries.slice(0, 10)) {
        lines.push(`- ${ep}`);
      }
      lines.push('');
    }

    // Group files by directory
    const dirMap = new Map();
    for (const filePath of this.#files.keys()) {
      const dir = path.dirname(filePath);
      const bucket = dirMap.get(dir);
      if (bucket) {
        bucket.push(filePath);
      } else {
        dirMap.set(dir, [filePath]);
      }
    }

    lines.push('## File Structure');
    let fileCount = 0;
    for (const [dir, files] of dirMap) {
      if (fileCount >= maxFiles) {
        lines.push(`- ... and ${this.#files.size - fileCount} more files`);
        break;
      }
      lines.push(`### ${dir}/`);
      for (const f of files) {
        if (fileCount >= maxFiles) break;
        const pf = this.#files.get(f);
        const exportedNames = pf.exports
          .slice(0, maxSymbolsPerFile)
          .map((e) => e.name)
          .join(', ');
        const extra =
          pf.exports.length > maxSymbolsPerFile
            ? ` (+${pf.exports.length - maxSymbolsPerFile} more)`
            : '';
        const symInfo = exportedNames
          ? ` -> exports: ${exportedNames}${extra}`
          : '';
        lines.push(`- ${path.basename(f)}${symInfo}`);
        fileCount++;
      }
      lines.push('');
    }

    // Key symbols (classes and routes are usually most interesting)
    const keyClasses = this.findSymbolsByType('class');
    const keyRoutes = this.findSymbolsByType('route');
    if (keyClasses.length > 0 || keyRoutes.length > 0) {
      lines.push('## Key Symbols');
      if (keyClasses.length > 0) {
        lines.push('### Classes');
        for (const c of keyClasses.slice(0, 30)) {
          lines.push(`- **${c.name}** (${c.file}:${c.line})${c.exported ? ' [exported]' : ''}`);
        }
      }
      if (keyRoutes.length > 0) {
        lines.push('### Route Handlers');
        for (const r of keyRoutes.slice(0, 30)) {
          lines.push(`- **${r.name}** (${r.file}:${r.line})`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Iterate over all parsed files.
   * @returns {IterableIterator<ParsedFile>}
   */
  [Symbol.iterator]() {
    return this.#files.values();
  }
}
