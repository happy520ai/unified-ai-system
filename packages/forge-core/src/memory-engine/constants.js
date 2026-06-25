/**
 * MemoryEngine — shared constants and utilities.
 */

/** Memory types for categorization. */
export const MemoryType = Object.freeze({
  FILE: 'file',
  PATTERN: 'pattern',
  DECISION: 'decision',
  ERROR: 'error',
  STRATEGY: 'strategy',
  SUMMARY: 'summary',
  ACTION: 'action',
  CONVERSATION: 'conversation',
  OTHER: 'other',
});

/** Memory tiers. */
export const MemoryTier = Object.freeze({
  HOT: 'hot',
  WARM: 'warm',
  COLD: 'cold',
});

export const ALL_TYPES = Object.values(MemoryType);

export const DEFAULT_TOKENIZER = (text) => Math.ceil((text?.length ?? 0) / 4);

let _idCounter = 0;

export function genId() {
  return `mem_${Date.now()}_${++_idCounter}`;
}

/**
 * Default summarizer: concatenates entry contents with headers.
 * @param {object[]} entries
 * @returns {string}
 */
export function defaultSummarizer(entries) {
  if (entries.length === 1) return entries[0].content;

  const type = entries[0].type || 'other';
  const lines = [];
  lines.push(`Consolidated ${type} memories (${entries.length} entries):`);

  for (const entry of entries) {
    const content = entry.content.length > 200
      ? entry.content.slice(0, 197) + '...'
      : entry.content;
    lines.push(`- ${content}`);
  }

  return lines.join('\n');
}
