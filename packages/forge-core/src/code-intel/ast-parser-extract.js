/**
 * @module ast-parser-extract
 * @description Symbol extraction and deduplication helpers for the AST parser.
 * These functions use the PATTERNS regex set to classify source-code lines
 * into typed symbol entries.
 */

import { PATTERNS } from './ast-parser-helpers.js';

// ---------------------------------------------------------------------------
// Symbol extraction
// ---------------------------------------------------------------------------

/**
 * @param {string} line
 * @param {string} file
 * @param {number} lineNum
 * @param {import('./codebase-index.js').SymbolEntry[]} symbols
 * @param {import('./codebase-index.js').ExportEntry[]} exports
 */
export function extractSymbols(line, file, lineNum, symbols, exports) {
  const isExported = /^\s*export\s/.test(line);
  let m;

  // Route handlers (check first -- they take priority as a special symbol type)
  m = PATTERNS.routeHandler.exec(line);
  if (m) {
    const method = m.groups.method.toUpperCase();
    const routePath = m.groups.name;
    symbols.push({
      name: `${method} ${routePath}`,
      type: 'route',
      line: lineNum,
      exported: false,
      file,
    });
    return; // A route line is unlikely to also be a class/function declaration
  }

  // Class declaration
  m = PATTERNS.classDeclaration.exec(line);
  if (m) {
    symbols.push({
      name: m.groups.name,
      type: 'class',
      line: lineNum,
      exported: isExported,
      file,
    });
    return;
  }

  // Interface declaration
  m = PATTERNS.interfaceDeclaration.exec(line);
  if (m) {
    symbols.push({
      name: m.groups.name,
      type: 'interface',
      line: lineNum,
      exported: isExported,
      file,
    });
    return;
  }

  // Type alias
  m = PATTERNS.typeAlias.exec(line);
  if (m) {
    symbols.push({
      name: m.groups.name,
      type: 'type',
      line: lineNum,
      exported: isExported,
      file,
    });
    return;
  }

  // Enum declaration
  m = PATTERNS.enumDeclaration.exec(line);
  if (m) {
    symbols.push({
      name: m.groups.name,
      type: 'enum',
      line: lineNum,
      exported: isExported,
      file,
    });
    return;
  }

  // Function declaration
  m = PATTERNS.functionDeclaration.exec(line);
  if (m) {
    symbols.push({
      name: m.groups.name,
      type: 'function',
      line: lineNum,
      exported: isExported,
      file,
    });
    return;
  }

  // Arrow function or function expression assigned to a variable
  m = PATTERNS.arrowOrFunctionExpr.exec(line);
  if (m) {
    // Exclude if already captured as a plain variable
    symbols.push({
      name: m.groups.name,
      type: 'function',
      line: lineNum,
      exported: isExported,
      file,
    });
    return;
  }

  // Variable / constant (catch-all for declarations not already captured)
  m = PATTERNS.variableDeclaration.exec(line);
  if (m) {
    const name = m.groups.name;
    // Skip uppercase names that look like constants
    const type = /^[A-Z_][A-Z0-9_]*$/.test(name) ? 'constant' : 'variable';
    symbols.push({
      name,
      type,
      line: lineNum,
      exported: isExported,
      file,
    });
  }
}

// ---------------------------------------------------------------------------
// Symbol deduplication
// ---------------------------------------------------------------------------

/**
 * Remove duplicate symbols that share the same name+line+file.
 * When the same declaration is matched by multiple patterns, keep the
 * more specific type (e.g. 'function' over 'variable').
 *
 * @param {import('./codebase-index.js').SymbolEntry[]} symbols
 * @returns {import('./codebase-index.js').SymbolEntry[]}
 */
export function deduplicateSymbols(symbols) {
  /** @type {Map<string, import('./codebase-index.js').SymbolEntry>} */
  const seen = new Map();
  const typePriority = {
    route: 0,
    class: 1,
    interface: 2,
    type: 3,
    enum: 4,
    function: 5,
    constant: 6,
    variable: 7,
  };

  for (const sym of symbols) {
    const key = `${sym.file}:${sym.line}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, sym);
    } else {
      // Keep the higher-priority (lower number) type
      const existingPriority = typePriority[existing.type] ?? 99;
      const newPriority = typePriority[sym.type] ?? 99;
      if (newPriority < existingPriority) {
        seen.set(key, sym);
      }
    }
  }

  return [...seen.values()];
}
