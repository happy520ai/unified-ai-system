/**
 * buildContext — builds an LLM prompt context block from memory entries.
 * Extracted from MemoryEngine to keep the orchestrator under 500 lines.
 */

import { MemoryTier } from './constants.js';

/**
 * Build an LLM context block from memories.
 *
 * Combines relevant memories into a formatted prompt section, respecting
 * a token budget. Includes hot memories first (most recent context),
 * then warm (consolidated knowledge), then cold (historical).
 *
 * @param {object} opts
 * @param {string} [opts.query] — what the LLM is working on
 * @param {number} [opts.tokenBudget=16000] — max tokens for context
 * @param {string[]} [opts.types] — filter memory types
 * @param {string[]} [opts.tags] — filter tags
 * @param {Array<{path: string, content: string}>} [opts.files] — files to include
 * @param {string} [opts.prevSummary] — previous task summary
 * @param {function} recallFn — (query, opts) => { entries, totalTokens, byTier }
 * @param {function} tokenizerFn — token estimator
 * @returns {object} { context, entries, tokenUsage, byTier }
 */
export function buildContext(opts, recallFn, tokenizerFn) {
  const query = opts.query || '';
  const tokenBudget = opts.tokenBudget ?? 16000;

  // Recall relevant memories
  const { entries, byTier } = recallFn(query, {
    tokenBudget: Math.floor(tokenBudget * 0.6), // 60% for memories
    types: opts.types,
    tags: opts.tags,
  });

  // Build context string
  let context = '';
  let tokenUsage = 0;

  // Previous task results
  if (opts.prevSummary) {
    const prevBlock = `## Previous Task Results\n${opts.prevSummary}\n\n`;
    const prevTokens = tokenizerFn(prevBlock);
    context += prevBlock;
    tokenUsage += prevTokens;
  }

  // File context (if provided)
  if (opts.files && opts.files.length > 0) {
    const fileBudget = Math.floor(tokenBudget * 0.3); // 30% for files
    let fileBlock = '## Relevant Files\n';
    let fileTokens = tokenizerFn(fileBlock);

    for (const file of opts.files.slice(0, 15)) {
      const entry = `\n### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
      const entryTokens = tokenizerFn(entry);
      if (fileTokens + entryTokens > fileBudget) break;
      fileBlock += entry;
      fileTokens += entryTokens;
    }

    context += fileBlock + '\n';
    tokenUsage += fileTokens;
  }

  // Memory context
  if (entries.length > 0) {
    let memBlock = '## Relevant Memories\n';
    let memTokens = tokenizerFn(memBlock);

    // Group by tier for organized display
    const hotEntries = entries.filter(e => e._tier === MemoryTier.HOT);
    const warmEntries = entries.filter(e => e._tier === MemoryTier.WARM);
    const coldEntries = entries.filter(e => e._tier === MemoryTier.COLD);

    if (hotEntries.length > 0) {
      memBlock += '### Recent Context\n';
      for (const entry of hotEntries) {
        const line = `- [${entry.type}] ${entry.content}\n`;
        const lineTokens = tokenizerFn(line);
        if (memTokens + lineTokens > Math.floor(tokenBudget * 0.6)) break;
        memBlock += line;
        memTokens += lineTokens;
      }
    }

    if (warmEntries.length > 0) {
      memBlock += '### Learned Knowledge\n';
      for (const entry of warmEntries) {
        const line = `- [${entry.type}] ${entry.content}\n`;
        const lineTokens = tokenizerFn(line);
        if (memTokens + lineTokens > Math.floor(tokenBudget * 0.6)) break;
        memBlock += line;
        memTokens += lineTokens;
      }
    }

    if (coldEntries.length > 0) {
      memBlock += '### Historical Context\n';
      for (const entry of coldEntries) {
        const line = `- [${entry.type}] ${entry.content}\n`;
        const lineTokens = tokenizerFn(line);
        if (memTokens + lineTokens > Math.floor(tokenBudget * 0.6)) break;
        memBlock += line;
        memTokens += lineTokens;
      }
    }

    context += memBlock + '\n';
    tokenUsage += memTokens;
  }

  return { context, entries, tokenUsage, byTier };
}
