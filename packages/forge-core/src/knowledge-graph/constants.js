/**
 * Knowledge Graph constants, regex patterns, and utility functions.
 * Extracted from index.js to reduce file size.
 */

import path from 'node:path';

// ── Type definitions ──────────────────────────────────────────────────────

/**
 * @typedef {object} ExportInfo
 * @property {string} name  — exported identifier (or 'default')
 * @property {string} type  — 'class' | 'function' | 'const' | 'default' | 'unknown'
 * @property {number} line  — 1-based line number
 */

/**
 * @typedef {object} ImportInfo
 * @property {string}   source      — raw import specifier (e.g. './utils')
 * @property {string[]} specifiers  — imported names (e.g. ['readFile', 'default'])
 * @property {string}   type        — 'esm' | 'cjs'
 * @property {number}   line        — 1-based line number
 */

/**
 * @typedef {object} DefinitionInfo
 * @property {string}  name     — identifier name
 * @property {string}  type     — 'class' | 'function' | 'const'
 * @property {number}  line     — 1-based line number
 * @property {boolean} exported — whether the definition is exported
 */

/**
 * @typedef {object} GraphNode
 * @property {string}         path        — file path
 * @property {ExportInfo[]}   exports     — exported symbols
 * @property {ImportInfo[]}   imports     — import declarations
 * @property {DefinitionInfo[]} definitions — classes / functions / consts
 * @property {number}         lastModified — epoch ms when the node was added
 */

/**
 * @typedef {object} GraphEdge
 * @property {string} from — importing file
 * @property {string} to   — imported file
 * @property {string} type — 'imports' | 'extends' | 'uses'
 */

// ── Constants ─────────────────────────────────────────────────────────────

/** Default supported file extensions for path resolution. */
export const DEFAULT_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.py', '.go', '.rs'];

/** Default maximum depth for transitive impact traversal. */
export const DEFAULT_MAX_DEPTH = 10;

// ── Regex patterns ────────────────────────────────────────────────────────

/**
 * Matches ESM import statements, including multiline variants.
 * Captures the full statement from `import` to the specifier.
 * @type {RegExp}
 */
export const RE_ESM_IMPORT = /^\s*import\s+(?:(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*)\s+from\s+)?['"]([^'"]+)['"]/gm;

/**
 * Matches CJS require calls: `require('...')` or `require("...")`.
 * @type {RegExp}
 */
export const RE_CJS_REQUIRE = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Matches dynamic import(): `import('...')`.
 * @type {RegExp}
 */
export const RE_DYNAMIC_IMPORT = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Matches ESM export declarations (default, named, class, function, const).
 * @type {RegExp}
 */
export const RE_EXPORT = /^\s*export\s+(default\s+)?(?:(class|function|const|let|var)\s+)?(\w+)?/gm;

/**
 * Matches class definitions (optionally exported).
 * @type {RegExp}
 */
export const RE_CLASS_DEF = /^\s*(?:export\s+(?:default\s+)?)?class\s+(\w+)/gm;

/**
 * Matches function definitions (optionally exported, including async).
 * @type {RegExp}
 */
export const RE_FUNC_DEF = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\*?\s*\w+)/gm;

/**
 * Matches top-level const/let declarations (optionally exported).
 * @type {RegExp}
 */
export const RE_CONST_DEF = /^\s*(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+(\w+)\s*=/gm;

// ── Python regex patterns ─────────────────────────────────────────────────

/**
 * Matches Python `import X` and `import X as Y` statements.
 * @type {RegExp}
 */
export const RE_PY_IMPORT = /^\s*import\s+([\w.]+)(?:\s+as\s+\w+)?/gm;

/**
 * Matches Python `from X import Y` statements (including relative imports).
 * @type {RegExp}
 */
export const RE_PY_FROM_IMPORT = /^\s*from\s+([\w.]+)\s+import\s+(.+)/gm;

/**
 * Matches Python class definitions: `class Name:` or `class Name(Base):`.
 * @type {RegExp}
 */
export const RE_PY_CLASS = /^\s*class\s+(\w+)/gm;

/**
 * Matches Python function definitions including async and decorated methods.
 * @type {RegExp}
 */
export const RE_PY_FUNC = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/gm;

/**
 * Matches Python top-level assignments (module-level constants).
 * @type {RegExp}
 */
export const RE_PY_CONST = /^([A-Z_][A-Z0-9_]*)\s*=/gm;

// ── Go regex patterns ─────────────────────────────────────────────────────

/**
 * Matches Go single-line import: `import "path"`.
 * @type {RegExp}
 */
export const RE_GO_IMPORT_SINGLE = /^\s*import\s+"([^"]+)"/gm;

/**
 * Matches Go grouped imports: `import ( "path1" "path2" )`.
 * @type {RegExp}
 */
export const RE_GO_IMPORT_GROUP = /^\s*import\s*\(([\s\S]*?)\)/gm;

/**
 * Matches Go function and method definitions including receiver methods.
 * @type {RegExp}
 */
export const RE_GO_FUNC = /^\s*func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?(\w+)\s*\(/gm;

/**
 * Matches Go struct type definitions.
 * @type {RegExp}
 */
export const RE_GO_STRUCT = /^\s*type\s+(\w+)\s+struct\b/gm;

/**
 * Matches Go interface type definitions.
 * @type {RegExp}
 */
export const RE_GO_INTERFACE = /^\s*type\s+(\w+)\s+interface\b/gm;

// ── Rust regex patterns ───────────────────────────────────────────────────

/**
 * Matches Rust single-line `use` statements.
 * @type {RegExp}
 */
export const RE_RUST_USE = /^\s*use\s+([\w:]+(?:::\{[^}]+\})?)\s*;/gm;

/**
 * Matches Rust `mod` declarations.
 * @type {RegExp}
 */
export const RE_RUST_MOD = /^\s*(?:pub\s+)?mod\s+(\w+)\s*;/gm;

/**
 * Matches Rust public function definitions.
 * @type {RegExp}
 */
export const RE_RUST_PUB_FN = /^\s*pub\s+(?:async\s+)?fn\s+(\w+)/gm;

/**
 * Matches Rust public struct definitions.
 * @type {RegExp}
 */
export const RE_RUST_PUB_STRUCT = /^\s*pub\s+struct\s+(\w+)/gm;

/**
 * Matches Rust public enum definitions.
 * @type {RegExp}
 */
export const RE_RUST_PUB_ENUM = /^\s*pub\s+enum\s+(\w+)/gm;

/**
 * Matches Rust public trait definitions.
 * @type {RegExp}
 */
export const RE_RUST_PUB_TRAIT = /^\s*pub\s+trait\s+(\w+)/gm;

/**
 * Matches Rust impl blocks (including trait implementations).
 * @type {RegExp}
 */
export const RE_RUST_IMPL = /^\s*impl(?:<[^>]*>)?\s+(?:\w+\s+for\s+)?(\w+)/gm;

// ── Utility functions ─────────────────────────────────────────────────────

/**
 * Compute the 1-based line number for a character offset in content.
 *
 * @param {string} content — full file content
 * @param {number} offset  — character offset
 * @returns {number} 1-based line number
 */
export function getLineNumber(content, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

/**
 * Extract imported specifier names from an ESM import statement.
 *
 * @param {string} statement — full import statement text
 * @returns {string[]} array of imported names
 */
export function extractSpecifiers(statement) {
  /** @type {string[]} */
  const specs = [];

  // Named imports: { a, b as c }
  const braceMatch = statement.match(/\{([^}]+)\}/);
  if (braceMatch) {
    const names = braceMatch[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop().trim());
    specs.push(...names.filter(Boolean));
  }

  // Namespace import: * as name
  const nsMatch = statement.match(/\*\s+as\s+(\w+)/);
  if (nsMatch) {
    specs.push(nsMatch[1]);
  }

  // Default import: import Name from '...'
  const defMatch = statement.match(/import\s+(\w+)\s+from/);
  if (defMatch && defMatch[1] !== 'type') {
    specs.push(defMatch[1]);
  }

  return [...new Set(specs)];
}

/**
 * Extract destructured names from a CJS require statement.
 *
 * @param {string} statement — full require statement text
 * @returns {string[]}
 */
export function extractCjsSpecifiers(statement) {
  /** @type {string[]} */
  const specs = [];

  // Destructured: const { a, b } = require(...)
  const braceMatch = statement.match(/\{([^}]+)\}/);
  if (braceMatch) {
    const names = braceMatch[1].split(',').map((s) => s.trim().split(/\s*:\s*/)[0].trim());
    specs.push(...names.filter(Boolean));
  }

  // Simple: const name = require(...)
  const simpleMatch = statement.match(/(?:const|let|var)\s+(\w+)\s*=/);
  if (simpleMatch && !braceMatch) {
    specs.push(simpleMatch[1]);
  }

  return specs;
}

/**
 * Determine whether a file path is a test file.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isTestFile(filePath) {
  return /\.(test|spec)\.(js|ts|jsx|tsx|mjs|cjs)$/.test(filePath) ||
         /[/\\](?:__tests__|test|tests)[/\\]/.test(filePath) ||
         /(?:^|[/\\])test_[\w.]+\.py$/.test(filePath) ||
         /[/\\]tests?[/\\].*\.go$/.test(filePath) ||
         /#\s*\[cfg\(test\)\]/.test(filePath) ||
         /\.rs$/.test(filePath) && /\/tests?\//.test(filePath);
}

/**
 * Determine whether a file path is a config file.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isConfigFile(filePath) {
  return /\.(config|rc)\.(js|ts|json|cjs|mjs)$/.test(filePath) ||
         /[/\\](?:config|configuration)[/\\]/.test(filePath) ||
         /\b(?:webpack|vite|rollup|eslint|tsconfig|babel|jest|vitest)\b/.test(filePath) ||
         /(?:pyproject|setup)\.(?:toml|cfg|py)$/.test(filePath) ||
         /Cargo\.(?:toml|lock)$/.test(filePath) ||
         /go\.(?:mod|sum)$/.test(filePath);
}

/**
 * Determine whether a file path is a source file (not test, not config).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSourceFile(filePath) {
  return !isTestFile(filePath) && !isConfigFile(filePath);
}

/**
 * Detect the programming language of a file based on its extension and content.
 *
 * @param {string} filePath — file path
 * @param {string} content  — file source text
 * @returns {'javascript'|'typescript'|'python'|'go'|'rust'}
 */
export function detectLanguage(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.py': return 'python';
    case '.go': return 'go';
    case '.rs': return 'rust';
    case '.ts': case '.tsx': case '.mts': return 'typescript';
    default: return 'javascript';
  }
}
