import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { BaseWorker } from './base.js';

/**
 * Coder Worker — implements code changes (write, edit, refactor).
 * Dynamically detects and matches existing codebase style.
 */
export class CoderWorker extends BaseWorker {
  constructor() {
    super({
      role: 'coder',
      systemPrompt: `You are the Forge Coder Worker — a precise, minimal-change implementation agent.

CRITICAL: Output your JSON actions FIRST, then add any explanation. Do NOT write lengthy reasoning before the JSON. Start your response with the JSON array of actions.

Your job is to implement the requested code changes with the following principles:

1. MINIMAL CHANGES: Only modify what's needed. Don't refactor unrelated code.
2. SAFE EDITS: When editing, your oldString must match EXACTLY (including whitespace). If unsure, read the file first, then use "write" to rewrite the entire file.
3. COMPLETE FILES: Every file you write (new or modified) MUST include ALL necessary import statements, exports, and boilerplate. If you add a reference to a class or function from another file, you MUST add the corresponding import statement at the top.
4. NO SHORTCUTS: Never use "// ... rest of file" or "// existing code" in write actions.
5. ERROR HANDLING: Include proper error handling in new code.
6. PREFER WRITE OVER EDIT: When making substantial changes, use "write" to create the full file rather than "edit" which may fail due to whitespace mismatches.
7. CROSS-FILE CONSISTENCY: When changes span multiple files, ensure all cross-file references (imports, exports, class names) are consistent. If you create a new module (e.g., src/utils.js), every file that uses it must import from it.
8. PROPER FORMATTING: Use proper multi-line formatting with newlines and indentation. Do NOT output code on a single line.
9. NO FAKE IMPORTS: NEVER import JavaScript built-in globals. Map, Set, WeakMap, WeakSet, Array, Promise, Object, Error, JSON, Math, Date, console, RegExp, Symbol, Proxy, Reflect, Buffer, URL, setTimeout, setInterval, clearTimeout, clearInterval, process, and all other JS built-ins are available WITHOUT any import. Writing "import { Map } from 'map'" or similar is a CRITICAL ERROR that will break the code.
10. NO NEW DEPENDENCIES: Only import packages that are ALREADY listed in the project's package.json dependencies. Do NOT add new npm packages unless explicitly instructed. Implement features using built-in Node.js APIs and existing dependencies only.
11. MATCH EXISTING STYLE: Your code MUST match the existing codebase style (module system, indentation, naming conventions, quote style). Check the "Additional Context" section for detected style information.

You output JSON actions:
- {"type": "write", "path": "...", "content": "..."} — create or fully rewrite a file
- {"type": "edit", "path": "...", "oldString": "exact text to find", "newString": "replacement"} — modify part of an existing file
- {"type": "bash", "command": "..."} — run a command (e.g., to install a package)

End with:
---SUMMARY---
Brief description of changes made.
---END---`,
      tools: ['read', 'write', 'edit', 'bash'],
    });
  }

  /**
   * Detect the project's code style and inject style-matching hints into the prompt.
   */
  async _getExtraContext(projectRoot, _task) {
    try {
      const styleInfo = await this.#detectCodeStyle(projectRoot);
      return this.#buildStyleHint(styleInfo);
    } catch {
      return '';
    }
  }

  /**
   * Analyze source files to detect coding style patterns.
   */
  async #detectCodeStyle(projectRoot) {
    const result = {
      moduleSystem: 'esm',   // 'esm' or 'cjs'
      quoteStyle: 'single',  // 'single' or 'double'
      indent: '2 spaces',    // '2 spaces', '4 spaces', 'tabs'
      semicolons: true,      // true or false
      naming: 'camelCase',   // 'camelCase', 'snake_case', 'PascalCase'
      typeAnnotations: false, // TypeScript usage
      sampleFiles: [],
    };

    // Read package.json for type field
    try {
      const pkgRaw = await readFile(join(projectRoot, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgRaw);
      if (pkg.type === 'commonjs') result.moduleSystem = 'cjs';
      else if (pkg.type === 'module') result.moduleSystem = 'esm';
    } catch { /* no package.json */ }

    // Sample source files for style analysis
    const srcDirs = ['src', 'lib', 'app'];
    const files = [];
    for (const dir of srcDirs) {
      try {
        const entries = await readdir(join(projectRoot, dir));
        for (const entry of entries) {
          if (entry.match(/\.(js|ts|mjs|cjs)$/)) {
            files.push(join(dir, entry));
          }
        }
        if (files.length >= 3) break;
      } catch { /* dir doesn't exist */ }
    }

    // Analyze up to 5 files
    let importCount = 0, requireCount = 0;
    let singleQuotes = 0, doubleQuotes = 0;
    let space2 = 0, space4 = 0, tabs = 0;
    let semicolonLines = 0, noSemicolonLines = 0;
    let snakeCaseVars = 0, camelCaseVars = 0;

    for (const file of files.slice(0, 5)) {
      try {
        const content = await readFile(join(projectRoot, file), 'utf-8');
        result.sampleFiles.push(file);
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

          // Module system
          if (trimmed.match(/^import\s/) || trimmed.match(/^export\s/)) importCount++;
          if (trimmed.match(/^const\s.*=\s*require\(/) || trimmed.match(/^require\(/)) requireCount++;

          // Quotes (count first quote on line)
          const firstQuote = trimmed.search(/['"]/);
          if (firstQuote >= 0) {
            if (trimmed[firstQuote] === "'") singleQuotes++;
            else doubleQuotes++;
          }

          // Indentation
          if (line.startsWith('    ')) space4++;
          else if (line.startsWith('  ') && !line.startsWith('    ')) space2++;
          else if (line.startsWith('\t')) tabs++;

          // Semicolons
          if (trimmed.match(/[;{}]\s*$/) || trimmed.endsWith(';')) semicolonLines++;
          else if (trimmed.match(/[a-zA-Z0-9'"\)]\s*$/) && !trimmed.endsWith('{') && !trimmed.endsWith(',') && !trimmed.endsWith('(')) {
            noSemicolonLines++;
          }

          // Naming conventions (look for variable declarations)
          const varMatch = trimmed.match(/(?:const|let|var)\s+(\w+)/);
          if (varMatch) {
            const name = varMatch[1];
            if (name.includes('_')) snakeCaseVars++;
            else if (name[0] === name[0]?.toUpperCase() && name.length > 1) { /* PascalCase, likely class */ }
            else camelCaseVars++;
          }
        }

        // TypeScript detection
        if (extname(file) === '.ts' || extname(file) === '.tsx') {
          result.typeAnnotations = true;
        }
      } catch { /* skip */ }
    }

    // Resolve detected values
    result.moduleSystem = requireCount > importCount ? 'cjs' : 'esm';
    result.quoteStyle = doubleQuotes > singleQuotes ? 'double' : 'single';
    if (tabs > space4 && tabs > space2) result.indent = 'tabs';
    else if (space4 > space2) result.indent = '4 spaces';
    else result.indent = '2 spaces';
    result.semicolons = semicolonLines >= noSemicolonLines;
    result.naming = snakeCaseVars > camelCaseVars ? 'snake_case' : 'camelCase';

    return result;
  }

  /**
   * Build the style hint text to inject into the prompt.
   */
  #buildStyleHint(style) {
    const moduleSyntax = style.moduleSystem === 'cjs'
      ? 'CommonJS (const x = require(...), module.exports = ...)'
      : 'ES Modules (import/export)';

    const quote = style.quoteStyle === 'double' ? 'double quotes (")' : "single quotes (')";
    const semi = style.semicolons ? 'USE semicolons at end of statements' : 'DO NOT use semicolons (semicolon-free style)';

    return `## Detected Code Style

Analyze the existing code in this project. The detected style patterns are:

- **Module system**: ${moduleSyntax}
- **Quote style**: ${quote}
- **Indentation**: ${style.indent}
- **Semicolons**: ${semi}
- **Naming**: ${style.naming} for variables/functions
${style.typeAnnotations ? '- **TypeScript**: Project uses TypeScript (.ts files)\n' : ''}
IMPORTANT: Match these conventions EXACTLY in all new or modified code. If the project uses ${style.moduleSystem === 'cjs' ? 'require/module.exports' : 'import/export'}, your code must also use ${style.moduleSystem === 'cjs' ? 'require/module.exports' : 'import/export'}.`;
  }
}

/**
 * Architect Worker — designs approaches and creates implementation plans.
 */
export class ArchitectWorker extends BaseWorker {
  constructor() {
    super({
      role: 'architect',
      systemPrompt: `You are the Forge Architect Worker — a senior software architect who designs implementation approaches.

Your job is to:
1. Analyze the codebase structure and existing patterns
2. Design the implementation approach for the requested feature
3. Identify the exact files that need to be created or modified
4. Specify the order of implementation and dependencies between changes

You output a design document (not code), including:
- Architecture decision and rationale
- List of files to create/modify with descriptions
- Implementation order
- Potential risks and mitigation strategies

End with:
---SUMMARY---
Brief design summary.
---END---`,
      tools: ['read', 'grep', 'glob'],
    });
  }
}

/**
 * Code Archaeologist Worker — explores and explains codebase structure.
 */
export class CodeArchaeologistWorker extends BaseWorker {
  constructor() {
    super({
      role: 'code-archaeologist',
      systemPrompt: `You are the Forge Code Archaeologist — a read-only codebase explorer.

Your job is to:
1. Understand the project structure, frameworks, and patterns
2. Find all relevant files for the task at hand
3. Map out dependencies, routes, modules, and their relationships
4. Produce a clear report of findings

You MUST NOT modify any files. Only use read and search tools.

End with:
---SUMMARY---
Key findings about the codebase relevant to the task.
---END---`,
      tools: ['read', 'grep', 'glob', 'bash'],
    });
  }
}
