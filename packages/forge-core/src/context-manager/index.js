/**
 * Context Window Manager — intelligently truncates and prioritizes files for LLM prompts.
 *
 * When gathering files for the LLM context, the total may exceed the token limit.
 * This manager sorts files by priority (focus files first, then by relevance),
 * includes them until the budget is exhausted, and truncates the last file if needed.
 *
 * Usage:
 *   const manager = new ContextManager({ maxTokens: 128000, reserveForOutput: 16000 });
 *   const { context, included, excluded, tokenUsage, truncated } = manager.buildContext({
 *     files: [{ path: 'src/index.js', content: '...', relevance: 90 }],
 *     taskType: 'code-generation',
 *     focusFiles: ['src/index.js'],
 *   });
 */

/** Regex matching common config file names. */
const CONFIG_FILE_REGEX = /(?:^|\/)(?:package\.json|tsconfig\.json|tsconfig\.\w+\.json|jsconfig\.json|\.eslintrc(?:\.\w+)?|\.prettierrc(?:\.\w+)?|vite\.config\.\w+|webpack\.config\.\w+|rollup\.config\.\w+|next\.config\.\w+|jest\.config\.\w+|vitest\.config\.\w+)$/;

/** Regex matching test/spec file names. */
const TEST_FILE_REGEX = /\.(?:test|spec)\.(?:js|ts|jsx|tsx|mjs|cjs)$/;

/** Regex matching documentation file extensions. */
const DOC_FILE_REGEX = /\.(?:md|txt|rst|adoc|mdx)$/i;

/** Regex matching source code file extensions. */
const SOURCE_FILE_REGEX = /\.(?:js|ts|jsx|tsx|mjs|cjs|py|rs|go|java|c|cpp|h|hpp|rb|sh|vue|svelte|astro|php|swift|kt|scala|lua)$/;

/** Regex to extract file extension (with dot). */
const EXT_REGEX = /\.[^.]+$/;

/**
 * @typedef {object} FileEntry
 * @property {string} path — file path
 * @property {string} content — file content
 * @property {number} relevance — relevance score 0-100 (higher = more important)
 */

/**
 * @typedef {object} BuildContextResult
 * @property {string} context — formatted context block
 * @property {FileEntry[]} included — files that were included in the context
 * @property {FileEntry[]} excluded — files that were excluded due to budget
 * @property {number} tokenUsage — actual tokens used
 * @property {boolean} truncated — true if any files were excluded or truncated
 */

export class ContextManager {
  /** @type {number} */
  #maxTokens;

  /** @type {number} */
  #reserveForOutput;

  /** @type {function(string): number} */
  #tokenizerFn;

  /** @type {number[]} — token usage per context build (last 20) */
  #tokenHistory;

  /**
   * @param {object} [options]
   * @param {number} [options.maxTokens=128000] — total context budget in tokens
   * @param {number} [options.reserveForOutput=16000] — tokens to reserve for output
   * @param {function(string): number} [options.tokenizerFn] — custom tokenizer function
   */
  constructor({ maxTokens = 128_000, reserveForOutput = 16_000, tokenizerFn } = {}) {
    this.#maxTokens = maxTokens;
    this.#reserveForOutput = reserveForOutput;
    this.#tokenizerFn = tokenizerFn ?? ((text) => Math.ceil(text.length / 4));
    this.#tokenHistory = [];
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Build an optimized context block from a list of files.
   *
   * Files are sorted by priority: focusFiles first, then by relevance descending.
   * Files are included until the available token budget is exhausted. The last file
   * that would exceed the budget is truncated with a "... (truncated)" marker.
   *
   * @param {object} params
   * @param {FileEntry[]} params.files — array of files with path, content, and relevance
   * @param {string} [params.taskType] — type of task (for future extension)
   * @param {string[]} [params.focusFiles] — paths being directly modified (highest priority)
   * @returns {BuildContextResult}
   */
  buildContext({ files, taskType, focusFiles = [] }) {
    const availableTokens = this.#maxTokens - this.#reserveForOutput;
    const focusSet = new Set(focusFiles);

    // Sort files: focus files first, then by relevance descending
    const sorted = [...files].sort((a, b) => {
      const aIsFocus = focusSet.has(a.path);
      const bIsFocus = focusSet.has(b.path);

      if (aIsFocus && !bIsFocus) return -1;
      if (!aIsFocus && bIsFocus) return 1;

      return b.relevance - a.relevance;
    });

    const included = [];
    const excluded = [];
    let tokenUsage = 0;
    let truncated = false;

    for (let i = 0; i < sorted.length; i++) {
      const file = sorted[i];
      const fileBlock = `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
      const fileTokens = this.estimateTokens(fileBlock);

      if (tokenUsage + fileTokens <= availableTokens) {
        // File fits completely within the remaining budget
        included.push(file);
        tokenUsage += fileTokens;
      } else {
        // File doesn't fit — attempt to truncate it
        const remainingTokens = availableTokens - tokenUsage;

        if (remainingTokens > 100) {
          // Enough room for a truncated version of this file
          // Reserve ~20 tokens for the wrapper (### path + ```) and ~10 for the marker
          const contentBudget = remainingTokens - 30;
          const truncatedContent = this.#truncateFile(file.content, contentBudget);
          const truncatedEntry = { ...file, content: truncatedContent };
          included.push(truncatedEntry);

          const truncatedBlock = `### ${file.path}\n\`\`\`\n${truncatedContent}\n\`\`\``;
          tokenUsage += this.estimateTokens(truncatedBlock);
        } else {
          // Not enough room even for a truncated version — exclude this file too
          excluded.push(file);
        }

        // Exclude all remaining files after this one
        for (let j = i + 1; j < sorted.length; j++) {
          excluded.push(sorted[j]);
        }

        truncated = true;
        break;
      }
    }

    const context = this.formatContextBlock(included);

    // Track token usage history (last 20 entries)
    this.#tokenHistory.push(tokenUsage);
    if (this.#tokenHistory.length > 20) {
      this.#tokenHistory.shift();
    }

    return {
      context,
      included,
      excluded,
      tokenUsage,
      truncated,
    };
  }

  /**
   * Estimate the token count for a string.
   *
   * Uses the custom tokenizerFn if provided at construction time,
   * otherwise defaults to Math.ceil(text.length / 4).
   *
   * @param {string} text
   * @returns {number} — estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    return this.#tokenizerFn(text);
  }

  /**
   * Calculate a relevance score (0-100) for a file based on its relationship
   * to the current task's focus files.
   *
   * Scoring tiers:
   *   - Focus files (being directly modified):         100
   *   - Files imported by focus files:                  80
   *   - Test files for focus files:                     70
   *   - Config files (package.json, tsconfig, etc.):    60
   *   - Files in same directory as a focus file:        50
   *   - Other source code files:                        30
   *   - README / documentation files:                  10
   *
   * @param {string} filePath — path to the file being scored
   * @param {object} task — task object
   * @param {string[]} [task.focusFiles] — paths being directly modified
   * @param {Array<{path: string, content: string}>} [task.files] — all task files (for import analysis)
   * @param {object} [projectStructure] — optional project structure info
   * @param {Map<string, string[]>} [projectStructure.imports] — map of filePath to imported module paths
   * @returns {number} — relevance score 0-100
   */
  calculateFileRelevance(filePath, task, projectStructure) {
    const focusFiles = task?.focusFiles ?? [];
    const focusSet = new Set(focusFiles);

    // Tier 1: Focus files (being directly modified) — 100
    if (focusSet.has(filePath)) {
      return 100;
    }

    // Tier 2: Files imported by focus files — 80
    if (this.#isImportedByFocusFile(filePath, focusFiles, task, projectStructure)) {
      return 80;
    }

    // Tier 3: Test files for focus files — 70
    if (this.#isTestForFocusFile(filePath, focusFiles)) {
      return 70;
    }

    // Tier 4: Config files — 60
    if (CONFIG_FILE_REGEX.test(filePath)) {
      return 60;
    }

    // Tier 5: Files in same directory as a focus file — 50
    if (this.#isInSameDirectory(filePath, focusFiles)) {
      return 50;
    }

    // Tier 6: Other source code files — 30
    if (SOURCE_FILE_REGEX.test(filePath)) {
      return 30;
    }

    // Tier 7: README / documentation — 10
    if (DOC_FILE_REGEX.test(filePath)) {
      return 10;
    }

    return 10;
  }

  /**
   * Format a list of included files as a markdown context block.
   *
   * Output format per file:
   *   ### path/to/file.js
   *   ```
   *   content
   *   ```
   *
   * @param {FileEntry[]} files — files to include in the context
   * @returns {string} — formatted markdown string
   */
  formatContextBlock(files) {
    const blocks = [];
    for (const file of files) {
      blocks.push(`### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``);
    }
    return blocks.join('\n\n');
  }

  /**
   * Get statistics about context builder usage over time.
   *
   * @returns {{ maxTokens: number, availableTokens: number, avgTokenUsage: number, totalContextsBuilt: number }}
   */
  getStats() {
    const avgTokenUsage = this.#tokenHistory.length > 0
      ? Math.round(this.#tokenHistory.reduce((sum, v) => sum + v, 0) / this.#tokenHistory.length)
      : 0;

    return {
      maxTokens: this.#maxTokens,
      availableTokens: this.#maxTokens - this.#reserveForOutput,
      avgTokenUsage,
      totalContextsBuilt: this.#tokenHistory.length,
    };
  }

  /**
   * Get a lightweight status snapshot with token budget info.
   *
   * @returns {{ maxTokens: number, availableTokens: number }}
   */
  getStatus() {
    return {
      maxTokens: this.#maxTokens,
      availableTokens: this.#maxTokens - this.#reserveForOutput,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Truncate file content to fit within a token budget.
   * Appends a "... (truncated)" marker at the end.
   *
   * @param {string} content — raw file content
   * @param {number} maxTokens — token budget for the content
   * @returns {string} — truncated content with marker
   */
  #truncateFile(content, maxTokens) {
    const lines = content.split('\n');
    const kept = [];
    let used = 0;

    for (const line of lines) {
      const lineTokens = this.estimateTokens(line + '\n');
      if (used + lineTokens > maxTokens - 10) break; // reserve 10 tokens for truncation marker
      kept.push(line);
      used += lineTokens;
    }

    return kept.join('\n') + '\n... (truncated)';
  }

  /**
   * Check whether a file is imported by any of the focus files.
   *
   * Uses projectStructure.imports if available. Falls back to scanning
   * focus file content for import/require statements referencing the target path.
   *
   * @param {string} filePath — candidate file path
   * @param {string[]} focusFiles — list of focus file paths
   * @param {object} [task] — task object (may contain files array for content scanning)
   * @param {object} [projectStructure] — optional project structure
   * @param {Map<string, string[]>} [projectStructure.imports] — pre-computed import map
   * @returns {boolean}
   */
  #isImportedByFocusFile(filePath, focusFiles, task, projectStructure) {
    // Strategy 1: Use pre-computed import map from projectStructure
    if (projectStructure?.imports) {
      const imports = projectStructure.imports;
      const filePathNoExt = filePath.replace(EXT_REGEX, '');

      for (const focusPath of focusFiles) {
        const focusImports = imports.get(focusPath) ?? imports[focusPath];
        if (Array.isArray(focusImports)) {
          for (const imp of focusImports) {
            const impNoExt = imp.replace(EXT_REGEX, '');
            if (imp === filePath || impNoExt === filePathNoExt || filePathNoExt.endsWith(impNoExt) || impNoExt.endsWith(filePathNoExt)) {
              return true;
            }
          }
        }
      }
    }

    // Strategy 2: Scan focus file content for import/require references
    const allFiles = task?.files ?? [];
    const fileContentMap = new Map();
    for (const f of allFiles) {
      if (focusFiles.includes(f.path)) {
        fileContentMap.set(f.path, f.content ?? '');
      }
    }

    if (fileContentMap.size === 0) return false;

    // Derive possible import identifiers from the candidate file path
    const filePathNoExt = filePath.replace(EXT_REGEX, '');
    const fileName = filePath.split('/').pop()?.replace(EXT_REGEX, '') ?? '';

    for (const [, content] of fileContentMap) {
      // Match import ... from '...' and require('...')
      const importMatches = content.matchAll(/(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g);
      for (const m of importMatches) {
        const importPath = m[1];
        if (
          importPath === filePath ||
          importPath === filePathNoExt ||
          importPath.endsWith('/' + fileName) ||
          filePathNoExt.endsWith(importPath) ||
          importPath.includes(fileName)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check whether a file is a test/spec file for any of the focus files.
   *
   * Matches patterns like:
   *   - src/foo.test.js   for focus file src/foo.js
   *   - tests/foo.spec.ts for focus file src/foo.ts
   *   - __tests__/foo.js  for focus file src/foo.js
   *
   * @param {string} filePath
   * @param {string[]} focusFiles
   * @returns {boolean}
   */
  #isTestForFocusFile(filePath, focusFiles) {
    // Must be a test/spec file or in a test directory
    const isTest = TEST_FILE_REGEX.test(filePath) ||
      filePath.includes('__tests__') ||
      filePath.includes('__test__') ||
      filePath.includes('/tests/') ||
      filePath.includes('/test/');

    if (!isTest) return false;

    const filePathLower = filePath.toLowerCase();
    for (const focus of focusFiles) {
      // Extract the base name without extension from the focus file
      const focusBase = focus.replace(EXT_REGEX, '').split('/').pop()?.toLowerCase() ?? '';
      if (focusBase && filePathLower.includes(focusBase)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check whether a file is in the same directory as any focus file.
   *
   * @param {string} filePath
   * @param {string[]} focusFiles
   * @returns {boolean}
   */
  #isInSameDirectory(filePath, focusFiles) {
    for (const focus of focusFiles) {
      const lastSlash = focus.lastIndexOf('/');
      const focusDir = lastSlash >= 0 ? focus.substring(0, lastSlash) : '';

      if (focusDir === '') continue; // root-level focus file — skip directory match

      const fileLastSlash = filePath.lastIndexOf('/');
      const fileDir = fileLastSlash >= 0 ? filePath.substring(0, fileLastSlash) : '';

      if (fileDir === focusDir) {
        return true;
      }
    }

    return false;
  }
}
