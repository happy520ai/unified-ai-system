/**
 * Helper functions for the Adaptive Context Engine.
 * Extracted from index.js to keep the main class under 500 lines.
 */

// ── Constants ───────────────────────────────────────────────────────────

/** Regex matching CJK characters (Chinese, Japanese Hiragana/Katakana). */
export const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g;

/** Regex matching common code structural elements to preserve during compression. */
export const STRUCTURAL_REGEX = /^\s*(import|export|from|class|function|const|let|var|interface|type|enum|async|public|private|protected|static|def |fn |pub |module)\b/;

/** Regex matching comment lines. */
export const COMMENT_REGEX = /^\s*(\/\/|\/\*|\*|#|--|;;)/;

/** Regex matching blank or whitespace-only lines. */
export const BLANK_LINE_REGEX = /^\s*$/;

/**
 * Priority weights — fraction of total token budget allocated to each band.
 * Must sum to <= 1.0 (the remainder is a safety margin).
 */
export const PRIORITY_WEIGHTS = {
  taskPrompt:       0.04,  // ~4% reserved for the task prompt wrapper
  directFiles:      0.40,  // ~40% for files directly mentioned in the task
  dependencyFiles:  0.20,  // ~20% for files related via imports/exports
  previousResults:  0.15,  // ~15% for prior task summaries
  projectStructure: 0.10,  // ~10% for package.json, entry points
  keyDecisions:     0.08,  // ~8% for decisions and artifacts
  // Total: 0.97 — 3% safety margin
};

// ── Pure utility functions ──────────────────────────────────────────────

/**
 * Estimate the token count for a string.
 *
 * Heuristic:
 *   - CJK characters: ~1.5 chars per token (most CJK chars are 1-2 tokens)
 *   - ASCII / Latin text: ~4 chars per token
 *
 * @param {string} text
 * @returns {number} — estimated token count
 */
export function estimateTokens(text) {
  if (!text) return 0;
  const cjkCount = (text.match(CJK_REGEX) || []).length;
  const asciiCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + asciiCount / 4);
}

/**
 * Compress file content to fit within a token budget.
 *
 * Strategy:
 *   1. Strip comments and blank lines
 *   2. Keep structural lines (imports, exports, function/class signatures)
 *   3. If still over budget, keep first and last N lines with a gap marker
 *
 * @param {string} content — raw file content
 * @param {number} maxTokens — token budget for this file
 * @param {(text: string) => number} tokFn — token estimation function
 * @returns {string} — compressed content
 */
export function compressFile(content, maxTokens, tokFn = estimateTokens) {
  if (!content) return '';
  if (tokFn(content) <= maxTokens) return content;

  const lines = content.split('\n');

  // Phase 1: Strip comments and blank lines
  let filtered = lines.filter(line => !BLANK_LINE_REGEX.test(line) && !COMMENT_REGEX.test(line));
  let result = filtered.join('\n');

  if (tokFn(result) <= maxTokens) return result;

  // Phase 2: Keep only structural lines + surrounding context
  const structuralLines = [];
  for (let i = 0; i < filtered.length; i++) {
    if (STRUCTURAL_REGEX.test(filtered[i])) {
      structuralLines.push(i);
    }
  }

  if (structuralLines.length > 0) {
    // Keep structural lines + 2 lines of context after each
    const keepSet = new Set();
    for (const idx of structuralLines) {
      for (let j = idx; j < Math.min(idx + 3, filtered.length); j++) {
        keepSet.add(j);
      }
    }
    const structural = filtered.filter((_, i) => keepSet.has(i));
    result = structural.join('\n');

    if (tokFn(result) <= maxTokens) return result;
  }

  // Phase 3: Keep first and last N lines with a gap marker
  const halfBudget = Math.floor(maxTokens / 2);
  const keepLines = Math.max(5, Math.floor(halfBudget / 10)); // rough: ~10 tokens per line

  const head = filtered.slice(0, keepLines);
  const tail = filtered.slice(-keepLines);
  const gapCount = filtered.length - head.length - tail.length;

  result = [
    ...head,
    gapCount > 0 ? `  // ... ${gapCount} lines omitted (compressed to fit ${maxTokens} token budget) ...` : '',
    ...tail,
  ].filter(Boolean).join('\n');

  return result;
}

/**
 * Format the task prompt section.
 * @param {object} task
 * @returns {string}
 */
export function formatTaskPrompt(task) {
  const parts = ['## Your Task'];
  if (task.name) parts.push(`**${task.name}**`);
  if (task.prompt) {
    parts.push(task.prompt);
  } else {
    parts.push('(No detailed prompt provided)');
  }
  if (task.type) parts.push(`Task type: ${task.type}`);
  return parts.join('\n');
}

/**
 * Collect file paths that are directly relevant to the task.
 * @param {object} task
 * @param {Set<string>} changedSet
 * @returns {string[]}
 */
export function collectDirectFiles(task, changedSet) {
  const files = new Set();

  // Files mentioned in task allowed_files / allowedFiles
  const allowed = task.allowed_files || task.allowedFiles;
  if (Array.isArray(allowed)) {
    for (const f of allowed) files.add(f);
  }

  // Files explicitly listed as relevant
  if (Array.isArray(task.relevantFiles)) {
    for (const f of task.relevantFiles) files.add(f);
  }

  // Files changed by upstream dependencies
  for (const f of changedSet) {
    files.add(f);
  }

  // Extract file paths mentioned in the task prompt
  if (task.prompt) {
    const pathPattern = /(?:^|\s)((?:[\w.-]+\/)*[\w.-]+\.(?:js|ts|jsx|tsx|json|md|css|html|py|rs|go|java|c|cpp|h|hpp|rb|sh|yml|yaml|toml|xml|sql))\b/gm;
    let match;
    while ((match = pathPattern.exec(task.prompt)) !== null) {
      files.add(match[1]);
    }
  }

  return [...files];
}

/**
 * Collect files that have dependency relationships with changed files.
 * Simple heuristic: files that share import/export patterns.
 *
 * @param {Array} allFiles — [{ path, content }]
 * @param {Set<string>} changedSet
 * @param {string[]} directFiles — already included direct files
 * @returns {string[]}
 */
export function collectDependencyFiles(allFiles, changedSet, directFiles) {
  const directSet = new Set(directFiles);
  const changedOrDirect = new Set([...changedSet, ...directFiles]);

  // Extract module identifiers from changed/direct files
  const changedModules = new Set();
  for (const file of allFiles) {
    if (changedOrDirect.has(file.path)) {
      // Extract export names and module path
      const exportMatches = file.content?.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g) || [];
      for (const m of exportMatches) {
        changedModules.add(m[1]);
      }
      // Also use the file's path as a module identifier (without extension)
      const modulePath = file.path.replace(/\.[^.]+$/, '');
      changedModules.add(modulePath);
    }
  }

  // Find files that import from changed modules
  const depFiles = [];
  for (const file of allFiles) {
    if (changedOrDirect.has(file.path)) continue;

    const content = file.content || '';
    // Check if this file imports any of the changed module identifiers
    const imports = content.matchAll(/(?:import|require)\s*\(?\s*['"]([^'"]+)['"]/g);
    for (const m of imports) {
      const importPath = m[1];
      for (const mod of changedModules) {
        if (importPath.includes(mod) || mod.includes(importPath)) {
          depFiles.push(file.path);
          break;
        }
      }
      if (depFiles.includes(file.path)) break;
    }

    // Also check if this file exports something imported by changed files
    if (!depFiles.includes(file.path)) {
      const exports = content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g);
      for (const m of exports) {
        if (changedModules.has(m[1])) {
          depFiles.push(file.path);
          break;
        }
      }
    }
  }

  return depFiles;
}

/**
 * Format a file as a markdown code block, respecting a token budget.
 * @param {string} path
 * @param {string} content
 * @param {number} maxTokens
 * @param {(text: string) => number} tokFn — token estimation function
 * @param {(content: string, maxTokens: number, tokFn?: Function) => string} compressFn — compression function
 * @returns {string}
 */
export function formatFileBlock(path, content, maxTokens, tokFn = estimateTokens, compressFn = compressFile) {
  if (!content) return '';

  let text = `### ${path}\n\`\`\`\n${content}\n\`\`\``;
  if (tokFn(text) <= maxTokens) return text;

  // Compress content to fit
  // Reserve ~20 tokens for the wrapper (### path + ```)
  const contentBudget = Math.max(50, maxTokens - 20);
  const compressed = compressFn(content, contentBudget, tokFn);
  return `### ${path}\n\`\`\`\n${compressed}\n\`\`\``;
}

/**
 * Build a project structure overview from indexed files.
 * Includes package.json, tsconfig.json, README, and entry points.
 *
 * @param {Array} allFiles — [{ path, content }]
 * @returns {string}
 */
export function buildProjectStructure(allFiles) {
  const structureFiles = [];
  const structurePatterns = [
    'package.json',
    'tsconfig.json',
    'README.md',
    '.env.example',
    'src/index.js',
    'src/index.ts',
    'src/main.js',
    'src/main.ts',
    'src/app.js',
    'src/app.ts',
  ];

  for (const file of allFiles) {
    if (structurePatterns.some(p => file.path === p || file.path.endsWith(`/${p}`))) {
      // For package.json, extract only the important fields
      if (file.path === 'package.json') {
        try {
          const pkg = JSON.parse(file.content);
          const summary = {
            name: pkg.name,
            version: pkg.version,
            type: pkg.type,
            main: pkg.main,
            scripts: pkg.scripts,
            dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : undefined,
          };
          structureFiles.push(`### ${file.path}\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``);
        } catch {
          structureFiles.push(`### ${file.path}\n\`\`\`\n${file.content.slice(0, 500)}\n\`\`\``);
        }
      } else if (file.path === 'README.md') {
        // Just the first ~30 lines
        const lines = file.content.split('\n').slice(0, 30).join('\n');
        structureFiles.push(`### ${file.path}\n${lines}`);
      } else {
        structureFiles.push(`### ${file.path}\n\`\`\`\n${file.content.slice(0, 1000)}\n\`\`\``);
      }
    }
  }

  if (structureFiles.length === 0) return '';

  return `## Project Structure\n${structureFiles.join('\n\n')}`;
}

/**
 * Truncate text to fit within a token budget.
 * @param {string} text
 * @param {number} maxTokens
 * @param {(text: string) => number} tokFn — token estimation function
 * @returns {string}
 */
export function truncateToTokens(text, maxTokens, tokFn = estimateTokens) {
  if (tokFn(text) <= maxTokens) return text;

  const lines = text.split('\n');
  const kept = [];
  let used = 0;

  for (const line of lines) {
    const lineTokens = tokFn(line + '\n');
    if (used + lineTokens > maxTokens - 10) break; // reserve 10 tokens for truncation marker
    kept.push(line);
    used += lineTokens;
  }

  return kept.join('\n') + '\n... (truncated)';
}

/**
 * Build a summary from completed task results for downstream tasks.
 *
 * Prioritizes the most recent tasks (last in array). If total exceeds
 * maxTokens, truncates from the oldest tasks first.
 *
 * @param {Array} completedTasks — [{ taskId, name?, summary, filesModified?, keyDecision? }]
 * @param {number} [maxTokens=1000] — token budget for the summary
 * @param {(text: string) => number} tokFn — token estimation function
 * @param {(text: string, maxTokens: number, tokFn?: Function) => string} truncFn — truncation function
 * @returns {string} — formatted summary text
 */
export function summarizeResults(completedTasks, maxTokens = 1000, tokFn = estimateTokens, truncFn = truncateToTokens) {
  if (!completedTasks || completedTasks.length === 0) return '';

  // Build individual summaries, most recent first
  const entries = [];
  const reversed = [...completedTasks].reverse();

  for (const task of reversed) {
    const parts = [];
    parts.push(`[${task.taskId}${task.name ? `: ${task.name}` : ''}]`);
    if (task.summary) parts.push(task.summary);
    if (task.filesModified?.length) {
      parts.push(`  Modified: ${task.filesModified.map(f => f.path || f).join(', ')}`);
    }
    if (task.keyDecision) {
      parts.push(`  Decision: ${task.keyDecision}`);
    }
    entries.push(parts.join('\n'));
  }

  // Include as many recent entries as fit within the budget
  const included = [];
  let usedTokens = 0;

  for (const entry of entries) {
    const entryTokens = tokFn(entry);
    if (usedTokens + entryTokens > maxTokens) break;
    included.push(entry);
    usedTokens += entryTokens;
  }

  if (included.length === 0 && entries.length > 0) {
    // At least include the most recent, truncated
    const first = entries[0];
    const truncated = truncFn(first, maxTokens, tokFn);
    return `## Previous Task Results (truncated)\n${truncated}`;
  }

  const omitted = entries.length - included.length;
  let header = `## Previous Task Results (${included.length} of ${entries.length} tasks)`;
  if (omitted > 0) {
    header += ` — ${omitted} older result(s) omitted`;
  }

  return `${header}\n${included.join('\n\n')}`;
}

/**
 * Extract key decisions from completed task results.
 *
 * @param {Array} completedTasks
 * @param {number} maxTokens
 * @param {(text: string) => number} tokFn — token estimation function
 * @returns {string}
 */
export function extractKeyDecisions(completedTasks, maxTokens, tokFn = estimateTokens) {
  const decisions = [];

  for (const task of completedTasks) {
    if (task.keyDecision) {
      decisions.push(`- [${task.taskId}] ${task.keyDecision}`);
    }
    // Also capture file modification summaries as decisions
    if (task.filesModified?.length) {
      const paths = task.filesModified.map(f => f.path || f).join(', ');
      decisions.push(`- [${task.taskId}] Modified files: ${paths}`);
    }
  }

  if (decisions.length === 0) return '';

  let text = `## Key Decisions & Artifacts\n${decisions.join('\n')}`;
  if (tokFn(text) > maxTokens) {
    // Keep only the most recent decisions
    const recent = [];
    let used = 0;
    const headerTokens = tokFn('## Key Decisions & Artifacts\n');
    used += headerTokens;

    for (let i = decisions.length - 1; i >= 0; i--) {
      const dTokens = tokFn(decisions[i] + '\n');
      if (used + dTokens > maxTokens) break;
      recent.unshift(decisions[i]);
      used += dTokens;
    }

    if (recent.length === 0) return '';
    text = `## Key Decisions & Artifacts\n${recent.join('\n')}`;
  }

  return text;
}
