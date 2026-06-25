/**
 * Language-specific parser functions for KnowledgeGraph.
 * Extracted from index.js to reduce file size.
 */

import {
  RE_ESM_IMPORT,
  RE_CJS_REQUIRE,
  RE_DYNAMIC_IMPORT,
  RE_EXPORT,
  RE_CLASS_DEF,
  RE_FUNC_DEF,
  RE_CONST_DEF,
  RE_PY_IMPORT,
  RE_PY_FROM_IMPORT,
  RE_PY_CLASS,
  RE_PY_FUNC,
  RE_PY_CONST,
  RE_GO_IMPORT_SINGLE,
  RE_GO_IMPORT_GROUP,
  RE_GO_FUNC,
  RE_GO_STRUCT,
  RE_GO_INTERFACE,
  RE_RUST_USE,
  RE_RUST_MOD,
  RE_RUST_PUB_FN,
  RE_RUST_PUB_STRUCT,
  RE_RUST_PUB_ENUM,
  RE_RUST_PUB_TRAIT,
  RE_RUST_IMPL,
  getLineNumber,
  extractSpecifiers,
  extractCjsSpecifiers,
} from './constants.js';

/**
 * Parse JavaScript/TypeScript import statements from source lines.
 *
 * @param {string[]} lines — source lines
 * @returns {ImportInfo[]}
 */
export function parseJsImports(lines) {
  const content = lines.join('\n');
  /** @type {ImportInfo[]} */
  const imports = [];

  // ESM imports
  RE_ESM_IMPORT.lastIndex = 0;
  let match;
  while ((match = RE_ESM_IMPORT.exec(content)) !== null) {
    const specifier = match[1];
    const line = getLineNumber(content, match.index);
    const specifiers = extractSpecifiers(match[0]);

    imports.push({
      source: specifier,
      specifiers,
      type: 'esm',
      line,
    });
  }

  // CJS require
  RE_CJS_REQUIRE.lastIndex = 0;
  while ((match = RE_CJS_REQUIRE.exec(content)) !== null) {
    const specifier = match[1];
    const line = getLineNumber(content, match.index);
    const specifiers = extractCjsSpecifiers(match[0]);

    imports.push({
      source: specifier,
      specifiers,
      type: 'cjs',
      line,
    });
  }

  // Dynamic import()
  RE_DYNAMIC_IMPORT.lastIndex = 0;
  while ((match = RE_DYNAMIC_IMPORT.exec(content)) !== null) {
    const specifier = match[1];
    const line = getLineNumber(content, match.index);

    imports.push({
      source: specifier,
      specifiers: [],
      type: 'esm',
      line,
    });
  }

  return imports;
}

/**
 * Parse JavaScript/TypeScript export declarations from source lines.
 *
 * @param {string[]} lines — source lines
 * @returns {ExportInfo[]}
 */
export function parseJsExports(lines) {
  const content = lines.join('\n');
  /** @type {ExportInfo[]} */
  const exports = [];

  RE_EXPORT.lastIndex = 0;
  let match;
  while ((match = RE_EXPORT.exec(content)) !== null) {
    const isDefault = !!match[1];
    const kind = match[2] || 'unknown';
    const name = match[3] || (isDefault ? 'default' : 'unknown');
    const line = getLineNumber(content, match.index);

    exports.push({
      name: isDefault ? 'default' : name,
      type: isDefault ? 'default' : kind,
      line,
    });
  }

  return exports;
}

/**
 * Parse JavaScript/TypeScript class, function, and const definitions from source lines.
 *
 * @param {string[]} lines — source lines
 * @returns {DefinitionInfo[]}
 */
export function parseJsDefinitions(lines) {
  const content = lines.join('\n');
  /** @type {DefinitionInfo[]} */
  const definitions = [];

  // Classes
  RE_CLASS_DEF.lastIndex = 0;
  let match;
  while ((match = RE_CLASS_DEF.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    const exported = /^\s*export\s/.test(match[0]);

    definitions.push({ name, type: 'class', line, exported });
  }

  // Functions
  RE_FUNC_DEF.lastIndex = 0;
  while ((match = RE_FUNC_DEF.exec(content)) !== null) {
    const name = match[1].replace(/\s+/g, '');
    const line = getLineNumber(content, match.index);
    const exported = /^\s*export\s/.test(match[0]);

    definitions.push({ name, type: 'function', line, exported });
  }

  // Const / let / var
  RE_CONST_DEF.lastIndex = 0;
  while ((match = RE_CONST_DEF.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    const exported = /^\s*export\s/.test(match[0]);

    definitions.push({ name, type: 'const', line, exported });
  }

  return definitions;
}

/**
 * Parse Python file content to extract imports, exports, and definitions.
 *
 * @param {string} content — Python source text
 * @returns {{ imports: ImportInfo[], exports: ExportInfo[], definitions: DefinitionInfo[] }}
 */
export function parsePython(content) {
  /** @type {ImportInfo[]} */
  const imports = [];
  /** @type {ExportInfo[]} */
  const exports = [];
  /** @type {DefinitionInfo[]} */
  const definitions = [];

  let match;

  // `from X import Y` statements
  RE_PY_FROM_IMPORT.lastIndex = 0;
  while ((match = RE_PY_FROM_IMPORT.exec(content)) !== null) {
    const source = match[1];
    const namesRaw = match[2];
    const line = getLineNumber(content, match.index);
    const specifiers = namesRaw
      .replace(/\\\n/g, '')
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/).pop().trim())
      .filter(Boolean);

    imports.push({
      source,
      specifiers,
      type: 'python',
      line,
    });
  }

  // `import X` / `import X as Y` statements
  RE_PY_IMPORT.lastIndex = 0;
  while ((match = RE_PY_IMPORT.exec(content)) !== null) {
    // Skip lines already captured by from...import
    const lineText = match[0].trim();
    if (lineText.startsWith('from')) continue;

    const source = match[1];
    const line = getLineNumber(content, match.index);

    imports.push({
      source,
      specifiers: [source.split('.').pop()],
      type: 'python',
      line,
    });
  }

  // Class definitions
  RE_PY_CLASS.lastIndex = 0;
  while ((match = RE_PY_CLASS.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    definitions.push({ name, type: 'class', line, exported: true });
    exports.push({ name, type: 'class', line });
  }

  // Function definitions
  RE_PY_FUNC.lastIndex = 0;
  while ((match = RE_PY_FUNC.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    // Leading underscore convention marks private functions in Python
    const exported = !name.startsWith('_');
    definitions.push({ name, type: 'function', line, exported });
    if (exported) {
      exports.push({ name, type: 'function', line });
    }
  }

  // Top-level constant assignments (ALL_CAPS convention)
  RE_PY_CONST.lastIndex = 0;
  while ((match = RE_PY_CONST.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    definitions.push({ name, type: 'const', line, exported: true });
    exports.push({ name, type: 'const', line });
  }

  // `if __name__ == '__main__':` as entry point
  const mainMatch = content.match(/if\s+__name__\s*==\s*['"]__main__['"]\s*:/);
  if (mainMatch) {
    const line = getLineNumber(content, mainMatch.index);
    exports.push({ name: '__main__', type: 'default', line });
  }

  return { imports, exports, definitions };
}

/**
 * Parse Go file content to extract imports, exports, and definitions.
 *
 * @param {string} content — Go source text
 * @returns {{ imports: ImportInfo[], exports: ExportInfo[], definitions: DefinitionInfo[] }}
 */
export function parseGo(content) {
  /** @type {ImportInfo[]} */
  const imports = [];
  /** @type {ExportInfo[]} */
  const exports = [];
  /** @type {DefinitionInfo[]} */
  const definitions = [];

  let match;

  // Single-line imports: `import "path"`
  RE_GO_IMPORT_SINGLE.lastIndex = 0;
  while ((match = RE_GO_IMPORT_SINGLE.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    imports.push({
      source: match[1],
      specifiers: [match[1].split('/').pop()],
      type: 'go',
      line,
    });
  }

  // Grouped imports: `import ( "path1" "path2" )`
  RE_GO_IMPORT_GROUP.lastIndex = 0;
  while ((match = RE_GO_IMPORT_GROUP.exec(content)) !== null) {
    const groupContent = match[1];
    const importRe = /"([^"]+)"/g;
    let importMatch;
    while ((importMatch = importRe.exec(groupContent)) !== null) {
      const offset = match.index + match[0].indexOf(groupContent) + importMatch.index;
      const line = getLineNumber(content, offset);
      imports.push({
        source: importMatch[1],
        specifiers: [importMatch[1].split('/').pop()],
        type: 'go',
        line,
      });
    }
  }

  // Function definitions (including receiver methods)
  RE_GO_FUNC.lastIndex = 0;
  while ((match = RE_GO_FUNC.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    // In Go, exported identifiers start with an uppercase letter
    const exported = /^[A-Z]/.test(name);
    const hasReceiver = /^\s*func\s*\(/.test(match[0]);
    definitions.push({ name, type: 'function', line, exported });
    if (exported && !hasReceiver) {
      exports.push({ name, type: 'function', line });
    }
  }

  // Struct type definitions
  RE_GO_STRUCT.lastIndex = 0;
  while ((match = RE_GO_STRUCT.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    const exported = /^[A-Z]/.test(name);
    definitions.push({ name, type: 'class', line, exported });
    if (exported) {
      exports.push({ name, type: 'class', line });
    }
  }

  // Interface type definitions
  RE_GO_INTERFACE.lastIndex = 0;
  while ((match = RE_GO_INTERFACE.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    const exported = /^[A-Z]/.test(name);
    definitions.push({ name, type: 'class', line, exported });
    if (exported) {
      exports.push({ name, type: 'class', line });
    }
  }

  return { imports, exports, definitions };
}

/**
 * Parse Rust file content to extract imports, exports, and definitions.
 *
 * @param {string} content — Rust source text
 * @returns {{ imports: ImportInfo[], exports: ExportInfo[], definitions: DefinitionInfo[] }}
 */
export function parseRust(content) {
  /** @type {ImportInfo[]} */
  const imports = [];
  /** @type {ExportInfo[]} */
  const exports = [];
  /** @type {DefinitionInfo[]} */
  const definitions = [];

  let match;

  // `use` statements (handles both single paths and grouped `{Y, Z}` imports)
  RE_RUST_USE.lastIndex = 0;
  while ((match = RE_RUST_USE.exec(content)) !== null) {
    const fullPath = match[1];
    const line = getLineNumber(content, match.index);

    // Handle grouped imports: `use X::{Y, Z}`
    const braceMatch = fullPath.match(/^([\w:]+)::\{([^}]+)\}$/);
    if (braceMatch) {
      const basePath = braceMatch[1];
      const names = braceMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
      imports.push({
        source: basePath.replace(/::/g, '/'),
        specifiers: names,
        type: 'rust',
        line,
      });
    } else {
      const parts = fullPath.split('::');
      const name = parts[parts.length - 1];
      imports.push({
        source: fullPath.replace(/::/g, '/'),
        specifiers: [name],
        type: 'rust',
        line,
      });
    }
  }

  // `mod` declarations
  RE_RUST_MOD.lastIndex = 0;
  while ((match = RE_RUST_MOD.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    const exported = /^\s*pub\s/.test(match[0]);
    imports.push({
      source: name,
      specifiers: [name],
      type: 'rust',
      line,
    });
    if (exported) {
      exports.push({ name, type: 'unknown', line });
    }
  }

  // Public function definitions
  RE_RUST_PUB_FN.lastIndex = 0;
  while ((match = RE_RUST_PUB_FN.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    definitions.push({ name, type: 'function', line, exported: true });
    exports.push({ name, type: 'function', line });
  }

  // Public struct definitions
  RE_RUST_PUB_STRUCT.lastIndex = 0;
  while ((match = RE_RUST_PUB_STRUCT.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    definitions.push({ name, type: 'class', line, exported: true });
    exports.push({ name, type: 'class', line });
  }

  // Public enum definitions
  RE_RUST_PUB_ENUM.lastIndex = 0;
  while ((match = RE_RUST_PUB_ENUM.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    definitions.push({ name, type: 'class', line, exported: true });
    exports.push({ name, type: 'class', line });
  }

  // Public trait definitions
  RE_RUST_PUB_TRAIT.lastIndex = 0;
  while ((match = RE_RUST_PUB_TRAIT.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    definitions.push({ name, type: 'class', line, exported: true });
    exports.push({ name, type: 'class', line });
  }

  // impl blocks (not exports, but tracked as definitions)
  RE_RUST_IMPL.lastIndex = 0;
  while ((match = RE_RUST_IMPL.exec(content)) !== null) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    definitions.push({ name, type: 'class', line, exported: false });
  }

  return { imports, exports, definitions };
}
