/**
 * @module ast-parser-helpers
 * @description Pure helper functions extracted from ASTParser for regex-based
 * source-code symbol extraction. All functions are stateless and receive the
 * data they need as parameters.
 */

import path from 'node:path';

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * All regex patterns used for symbol extraction.
 * Each pattern must expose a named capture group for the symbol `name`.
 * Patterns are tested line-by-line so they can also capture line numbers.
 */
export const PATTERNS = {
  // -- Imports ---------------------------------------------------------------

  /** import Foo from 'bar' */
  importDefault: /^\s*import\s+(?<name>[A-Za-z_$][\w$]*)\s+from\s+['"](?<source>[^'"]+)['"]/,

  /** import { Foo, Bar } from 'bar' */
  importNamed: /^\s*import\s*\{(?<specifiers>[^}]+)\}\s*from\s+['"](?<source>[^'"]+)['"]/,

  /** import * as Foo from 'bar' */
  importNamespace: /^\s*import\s*\*\s*as\s+(?<name>[A-Za-z_$][\w$]*)\s+from\s+['"](?<source>[^'"]+)['"]/,

  /** import 'bar'  (side-effect) */
  importSideEffect: /^\s*import\s+['"](?<source>[^'"]+)['"]/,

  // -- Exports ---------------------------------------------------------------

  /** export default ... */
  exportDefault: /^\s*export\s+default\s+(?:class|function|abstract\s+class)\s+(?<name>[A-Za-z_$][\w$]*)?/,

  /** export { Foo, Bar } */
  exportNamed: /^\s*export\s*\{(?<specifiers>[^}]+)\}/,

  /** export { Foo } from 'bar'  (re-export) */
  exportReexport: /^\s*export\s*\{(?<specifiers>[^}]+)\}\s*from\s+['"](?<source>[^'"]+)['"]/,

  /** export const/let/var NAME */
  exportDeclaration: /^\s*export\s+(?:const|let|var|function|class|abstract\s+class|async\s+function|enum|interface|type)\s+(?<name>[A-Za-z_$][\w$]*)/,

  /** export * from 'bar' */
  exportAll: /^\s*export\s*\*\s*(?:as\s+(?<name>[A-Za-z_$][\w$]*)\s+)?from\s+['"](?<source>[^'"]+)['"]/,

  // -- Functions -------------------------------------------------------------

  /** function foo( or async function foo( */
  functionDeclaration: /^\s*(?:export\s+)?(?:async\s+)?function\s+(?<name>[A-Za-z_$][\w$]*)/,

  /** const foo = (...) => or const foo = function( */
  arrowOrFunctionExpr: /^\s*(?:export\s+)?(?:const|let|var)\s+(?<name>[A-Za-z_$][\w$]*)\s*[:=]\s*(?:<[^>]*>\s*)?(?:async\s+)?(?:\(|[A-Za-z_$][\w$]*\s*=>|function)/,

  // -- Classes ---------------------------------------------------------------

  /** class Foo or export class Foo or abstract class Foo */
  classDeclaration: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(?<name>[A-Za-z_$][\w$]*)/,

  // -- Variables / Constants -------------------------------------------------

  /** const/let/var NAME (that are not already captured as functions) */
  variableDeclaration: /^\s*(?:export\s+)?(?:const|let|var)\s+(?<name>[A-Za-z_$][\w$]*)\s*[:=]/,

  // -- TypeScript interfaces / types / enums ---------------------------------

  /** interface Foo */
  interfaceDeclaration: /^\s*(?:export\s+)?interface\s+(?<name>[A-Za-z_$][\w$]*)/,

  /** type Foo = */
  typeAlias: /^\s*(?:export\s+)?type\s+(?<name>[A-Za-z_$][\w$]*)\s*=?/,

  /** enum Foo */
  enumDeclaration: /^\s*(?:export\s+)?(?:const\s+)?enum\s+(?<name>[A-Za-z_$][\w$]*)/,

  // -- Route handlers (Express / Koa / Fastify / Hono / Hapi) ----------------

  /** router.get('/path', ...) / app.post('/path', ...) etc. */
  routeHandler: /(?:router|app|server|api)\s*\.\s*(?<method>get|post|put|patch|delete|options|head|all|use)\s*\(\s*['"`](?<name>[^'"`]+)['"`]/,

  // -- Methods (inside class bodies) ----------------------------------------

  /** methodName( or async methodName( -- very approximate */
  methodDeclaration: /^\s+(?:async\s+)?(?:static\s+)?(?:get\s+|set\s+)?(?<name>[A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/,
};

/**
 * Extensions we consider parseable.
 */
export const PARSEABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs',
  '.ts', '.mts', '.cts',
  '.jsx', '.tsx',
]);

// ---------------------------------------------------------------------------
// Skip-range computation
// ---------------------------------------------------------------------------

/**
 * Compute line indices that should be skipped (inside block comments).
 * @param {string} source
 * @param {string[]} lines
 * @returns {Set<number>}
 */
export function computeSkipRanges(source, lines) {
  const skip = new Set();
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inBlockComment) {
      skip.add(i);
      if (line.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    // Detect block comment start (only if it doesn't close on the same line)
    const blockStart = line.indexOf('/*');
    if (blockStart !== -1) {
      const blockEnd = line.indexOf('*/', blockStart + 2);
      if (blockEnd === -1) {
        inBlockComment = true;
        skip.add(i);
      }
      // If it closes on the same line, we don't skip (the code before/after may be valid)
    }
  }

  return skip;
}

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

/**
 * @param {string} line
 * @param {string} file
 * @param {number} lineNum
 * @param {import('./codebase-index.js').ImportEntry[]} out
 */
export function extractImports(line, file, lineNum, out) {
  let m;

  // Namespace import: import * as Foo from 'bar'
  m = PATTERNS.importNamespace.exec(line);
  if (m) {
    out.push({
      source: m.groups.source,
      specifiers: [m.groups.name],
      isDefault: false,
      isNamespace: true,
      file,
    });
    return;
  }

  // Named import: import { Foo, Bar as Baz } from 'bar'
  m = PATTERNS.importNamed.exec(line);
  if (m) {
    const specifiers = m.groups.specifiers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        // Handle "Foo as Bar" -- we want the local name (Bar)
        const asMatch = /^(\w+)\s+as\s+(\w+)$/.exec(s);
        return asMatch ? asMatch[2] : s;
      });
    out.push({
      source: m.groups.source,
      specifiers,
      isDefault: false,
      isNamespace: false,
      file,
    });
    return;
  }

  // Default import: import Foo from 'bar'
  m = PATTERNS.importDefault.exec(line);
  if (m) {
    out.push({
      source: m.groups.source,
      specifiers: [m.groups.name],
      isDefault: true,
      isNamespace: false,
      file,
    });
    return;
  }

  // Side-effect import: import 'bar'
  m = PATTERNS.importSideEffect.exec(line);
  if (m) {
    out.push({
      source: m.groups.source,
      specifiers: [],
      isDefault: false,
      isNamespace: false,
      file,
    });
  }
}

// ---------------------------------------------------------------------------
// Export extraction
// ---------------------------------------------------------------------------

/**
 * Parse a comma-separated specifier list like "Foo, Bar as Baz, qux".
 * @param {string} raw
 * @returns {{ local: string, exported: string }[]}
 */
export function parseSpecifierList(raw) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const asMatch = /^(\w+)\s+as\s+(\w+)$/.exec(s);
      if (asMatch) {
        return { local: asMatch[1], exported: asMatch[2] };
      }
      return { local: s, exported: s };
    });
}

/**
 * @param {string} line
 * @param {string} file
 * @param {number} lineNum
 * @param {import('./codebase-index.js').ExportEntry[]} out
 */
export function extractExports(line, file, lineNum, out) {
  let m;

  // Re-exports: export { Foo, Bar } from 'baz'
  m = PATTERNS.exportReexport.exec(line);
  if (m) {
    const specifiers = parseSpecifierList(m.groups.specifiers);
    for (const spec of specifiers) {
      out.push({
        name: spec.exported,
        localName: spec.local,
        source: m.groups.source,
        file,
      });
    }
    return;
  }

  // export * from 'bar'  or  export * as Foo from 'bar'
  m = PATTERNS.exportAll.exec(line);
  if (m) {
    out.push({
      name: m.groups.name ?? '*',
      source: m.groups.source,
      file,
    });
    return;
  }

  // export default class/function Name
  m = PATTERNS.exportDefault.exec(line);
  if (m) {
    out.push({
      name: 'default',
      localName: m.groups.name ?? undefined,
      file,
    });
    return;
  }

  // export { Foo, Bar }
  m = PATTERNS.exportNamed.exec(line);
  if (m) {
    const specifiers = parseSpecifierList(m.groups.specifiers);
    for (const spec of specifiers) {
      out.push({
        name: spec.exported,
        localName: spec.local,
        file,
      });
    }
    return;
  }

  // export const/let/var/function/class NAME
  m = PATTERNS.exportDeclaration.exec(line);
  if (m) {
    out.push({
      name: m.groups.name,
      localName: m.groups.name,
      file,
    });
  }
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Recursively walk a directory and return all files with parseable extensions.
 *
 * @param {string} dir - Absolute directory path
 * @param {string[]} ignore - Directory names to skip
 * @param {import('node:fs/promises')} fs - fs/promises module
 * @returns {Promise<string[]>} Array of absolute file paths
 */
export async function walkDirectory(dir, ignore, fs) {
  const results = [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (ignore.includes(entry.name)) continue;
    // Skip hidden directories and files
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const sub = await walkDirectory(fullPath, ignore, fs);
      results.push(...sub);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (PARSEABLE_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Glob matching
// ---------------------------------------------------------------------------

/**
 * Test whether a file (given as absolute path) matches any of the
 * simplified glob patterns relative to the project root.
 *
 * @param {string} absPath
 * @param {string} root
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function matchesPatterns(absPath, root, patterns) {
  const relPath = path.relative(root, absPath).replace(/\\/g, '/');

  for (const pattern of patterns) {
    if (matchGlob(relPath, pattern)) return true;
  }
  return false;
}

/**
 * Simplified glob matcher supporting `**` and `*` wildcards.
 *
 * @param {string} filePath - Relative path (forward slashes)
 * @param {string} pattern  - Glob pattern
 * @returns {boolean}
 */
export function matchGlob(filePath, pattern) {
  // Convert glob to regex
  let regexStr = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        // ** -- match any number of path segments
        if (pattern[i + 2] === '/') {
          regexStr += '(?:.+/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else {
        // * -- match anything except /
        regexStr += '[^/]*';
        i++;
      }
    } else if (ch === '.') {
      regexStr += '\\.';
      i++;
    } else if (ch === '?') {
      regexStr += '[^/]';
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }
  regexStr += '$';

  try {
    return new RegExp(regexStr).test(filePath);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Compute a relative path from the project root (or cwd).
 * @param {string} absPath
 * @param {string|null} projectRoot
 * @returns {string}
 */
export function relPath(absPath, projectRoot) {
  const root = projectRoot ?? process.cwd();
  return path.relative(root, absPath).replace(/\\/g, '/');
}
