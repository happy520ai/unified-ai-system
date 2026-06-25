/**
 * @module codebase-search/constants
 * @description Constants, regex patterns, and structural bonuses for the
 * semantic code search engine.
 */

// ── Directory / extension constants ──────────────────────────────────────────

/**
 * Directories to always skip when walking the file tree.
 * @type {Set<string>}
 */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.cache', '.forge', '__pycache__',
  '.venv', 'venv', 'target', 'out', '.output',
]);

/**
 * File extensions considered indexable source code.
 * @type {Set<string>}
 */
export const SOURCE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.rb', '.sh', '.bash', '.zsh',
  '.vue', '.svelte', '.astro',
  '.css', '.scss', '.less',
  '.html', '.htm',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.sql',
  '.md', '.txt',
  '.graphql', '.gql',
  '.proto',
]);

/** Maximum bytes to read per file for indexing (50 KB). */
export const MAX_FILE_BYTES = 50_000;

/**
 * Stop words — common JS/TS keywords and identifiers that carry little
 * semantic weight for search relevance.
 * @type {Set<string>}
 */
export const STOP_WORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
  'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this',
  'class', 'extends', 'super', 'import', 'export', 'from', 'default',
  'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in',
  'of', 'async', 'await', 'yield', 'delete', 'void', 'null', 'undefined',
  'true', 'false', 'with', 'static', 'get', 'set', 'public', 'private',
  'protected', 'abstract', 'interface', 'type', 'enum', 'implements',
  'declare', 'module', 'namespace', 'require', 'as', 'is', 'keyof',
  'readonly', 'string', 'number', 'boolean', 'any', 'never', 'unknown',
  'object', 'symbol', 'bigint', 'array', 'map', 'set', 'promise',
  'the', 'and', 'for', 'not', 'but', 'had', 'has', 'was', 'were',
  'are', 'been', 'will', 'can', 'may', 'use', 'using', 'used',
]);

/** Structural bonuses applied during scoring. */
export const BONUS = {
  FILE_NAME_MATCH: 5,
  EXPORT_MATCH: 3,
  FUNCTION_NAME_MATCH: 2,
  IMPORT_PATH_MATCH: 1,
  CLASS_NAME_MATCH: 2.5,
  TYPE_NAME_MATCH: 2,
  RECENT_MODIFY: 1.5,
};

// ── Regex patterns ───────────────────────────────────────────────────────────

/** Matches ES module import statements. */
export const IMPORT_ESM_RE = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;

/** Matches CommonJS require() calls. */
export const IMPORT_CJS_RE = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Matches dynamic import() calls. */
export const IMPORT_DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Matches export declarations (named and default). */
export const EXPORT_RE = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum|async\s+function)\s+(\w+)/g;

/** Matches class declarations. */
export const CLASS_RE = /(?:^|\s)class\s+(\w+)/g;

/** Matches function declarations (named). */
export const FUNCTION_RE = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/g;

/** Matches TypeScript interface / type declarations. */
export const TYPE_RE = /(?:interface|type)\s+(\w+)/g;
