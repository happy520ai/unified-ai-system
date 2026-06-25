/**
 * Helper utilities for the multi-agent review system.
 */

/**
 * Generate a short random identifier.
 * @param {string} [prefix='rule'] — optional prefix
 * @returns {string}
 */
export function uid(prefix = 'rule') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Detect the programming language of a file based on its extension.
 *
 * @param {string} filePath — file path
 * @returns {'js'|'ts'|'python'|'go'|'rust'|'unknown'}
 */
export function detectLanguage(filePath) {
  const ext = filePath.match(/\.(\w+)$/)?.[1]?.toLowerCase() ?? '';
  switch (ext) {
    case 'py': return 'python';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'ts': case 'tsx': case 'mts': return 'ts';
    case 'js': case 'jsx': case 'mjs': case 'cjs': return 'js';
    default: return 'unknown';
  }
}

/**
 * Convert a character offset in content to a 1-based line and 0-based column.
 *
 * @param {string} content
 * @param {number} offset
 * @returns {{ line: number, column: number }}
 */
export function offsetToLineCol(content, offset) {
  const slice = content.slice(0, offset);
  const lines = slice.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length,
  };
}

/**
 * Run all matching rules against content and collect raw issues.
 *
 * @param {string} content — file content to analyse
 * @param {string} path — file path for labelling
 * @param {string[]} focusCategories — categories to include
 * @param {Map<string, object>} rules — all active rules keyed by id
 * @returns {Array<object>}
 */
export function runRules(content, path, focusCategories, rules) {
  const issues = [];
  const language = detectLanguage(path);

  for (const rule of rules.values()) {
    if (!focusCategories.includes(rule.category)) continue;

    // Skip rules that don't apply to this file's language
    const ruleLanguages = rule.languages ?? ['all'];
    if (!ruleLanguages.includes('all') && !ruleLanguages.includes(language)) continue;

    let rawMatches = [];

    if (rule.pattern instanceof RegExp) {
      // Regex-based rule: find all matches
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const pos = offsetToLineCol(content, match.index);
        rawMatches.push({ line: pos.line, column: pos.column, detail: match[0] });
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) regex.lastIndex++;
      }
    } else if (typeof rule.pattern === 'function') {
      // Function-based rule: delegate to the function
      try {
        rawMatches = rule.pattern(content) ?? [];
      } catch {
        // Rule function threw — skip silently
      }
    }

    for (const m of rawMatches) {
      issues.push({
        id: uid('issue'),
        severity: rule.severity,
        category: rule.category,
        path,
        line: m.line ?? 1,
        column: m.column ?? 0,
        message: rule.message,
        suggestion: m.detail ?? undefined,
        fix: rule.fix ?? undefined,
        rule: rule.id,
      });
    }
  }

  return issues;
}
