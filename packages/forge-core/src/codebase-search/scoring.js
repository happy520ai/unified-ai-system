/**
 * @module codebase-search/scoring
 * @description Highlight building, relevance classification, structural bonus
 * computation, and file chunking utilities for the code search engine.
 */

import { basename } from 'node:path';
import { BONUS } from './constants.js';
import { splitIdentifier } from './tokenize.js';

// ── Highlights ───────────────────────────────────────────────────────────────

/**
 * Build highlight snippets from the file content for matched terms.
 *
 * @param {{ content: string }|undefined} record
 * @param {string[]} matchedTerms
 * @returns {string[]}
 */
export function buildHighlights(record, matchedTerms) {
  if (!record || !record.content || matchedTerms.length === 0) return [];

  const content = record.content;
  const highlights = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length && highlights.length < 5; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    for (const term of matchedTerms) {
      if (lineLower.includes(term)) {
        const trimmed = line.trim();
        if (trimmed.length > 0 && trimmed.length < 200) {
          highlights.push(`L${i + 1}: ${trimmed}`);
          break;
        }
      }
    }
  }

  return highlights;
}

// ── Relevance ────────────────────────────────────────────────────────────────

/**
 * Classify relevance based on score.
 *
 * @param {number} score
 * @returns {string}
 */
export function classifyRelevance(score) {
  if (score >= 10) return 'very-high';
  if (score >= 5) return 'high';
  if (score >= 2) return 'medium';
  if (score >= 0.5) return 'low';
  return 'marginal';
}

// ── Structural bonuses ───────────────────────────────────────────────────────

/**
 * Apply structural bonuses to search scores in-place.
 *
 * @param {Map<string, { score: number, matchedTerms: Set<string> }>} scores
 * @param {Map<string, { path: string, exports: string[], functions: string[], classes: string[], types: string[], importPaths: string[], modifiedAt: number }>} files
 * @param {string[]} queryTokens
 * @param {string} queryLower
 * @param {boolean} boostImports
 * @param {boolean} boostRecent
 */
export function applyStructuralBonuses(scores, files, queryTokens, queryLower, boostImports, boostRecent) {
  for (const [filePath, entry] of scores) {
    const record = files.get(filePath);
    if (!record) continue;

    // File name match bonus
    const baseName = basename(filePath).replace(/\.[^.]+$/, '').toLowerCase();
    const baseNameTokens = splitIdentifier(baseName);
    for (const qt of queryTokens) {
      if (baseNameTokens.includes(qt) || baseName.includes(qt)) {
        entry.score += BONUS.FILE_NAME_MATCH;
        break;
      }
    }

    // Export name match bonus
    for (const exp of record.exports) {
      const expTokens = splitIdentifier(exp);
      for (const qt of queryTokens) {
        if (expTokens.includes(qt)) { entry.score += BONUS.EXPORT_MATCH; break; }
      }
    }

    // Function name match bonus
    for (const fn of record.functions) {
      const fnTokens = splitIdentifier(fn);
      for (const qt of queryTokens) {
        if (fnTokens.includes(qt)) { entry.score += BONUS.FUNCTION_NAME_MATCH; break; }
      }
    }

    // Class name match bonus
    for (const cls of record.classes) {
      const clsTokens = splitIdentifier(cls);
      for (const qt of queryTokens) {
        if (clsTokens.includes(qt)) { entry.score += BONUS.CLASS_NAME_MATCH; break; }
      }
    }

    // Type name match bonus
    for (const tp of record.types) {
      const tpTokens = splitIdentifier(tp);
      for (const qt of queryTokens) {
        if (tpTokens.includes(qt)) { entry.score += BONUS.TYPE_NAME_MATCH; break; }
      }
    }

    // Import path match bonus
    if (boostImports) {
      for (const imp of record.importPaths) {
        if (imp.toLowerCase().includes(queryLower) || queryLower.includes(imp.toLowerCase())) {
          entry.score += BONUS.IMPORT_PATH_MATCH;
          break;
        }
      }
    }

    // Recently modified bonus
    if (boostRecent && record.modifiedAt > 0) {
      const ageMs = Date.now() - record.modifiedAt;
      const oneDayMs = 86_400_000;
      if (ageMs < oneDayMs) {
        entry.score += BONUS.RECENT_MODIFY;
      } else if (ageMs < oneDayMs * 7) {
        entry.score += BONUS.RECENT_MODIFY * 0.5;
      }
    }
  }
}

// ── Chunking utilities ───────────────────────────────────────────────────────

/**
 * Find chunk boundaries based on top-level function and class declarations.
 *
 * @param {string[]} lines
 * @returns {Array<{ start: number, end: number, type: string }>}
 */
export function findChunkBoundaries(lines) {
  const boundaries = [];
  let braceDepth = 0;
  let blockStart = -1;
  let blockType = 'module';

  const classStartRe = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/;
  const funcStartRe = /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+/;
  const arrowFuncRe = /^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\(|[a-zA-Z_$])/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Detect block start
    if (blockStart === -1) {
      if (classStartRe.test(trimmed)) {
        blockStart = i;
        blockType = 'class';
      } else if (funcStartRe.test(trimmed) || arrowFuncRe.test(trimmed)) {
        blockStart = i;
        blockType = 'function';
      }
    }

    // Track brace depth
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
    }

    // Block ends when braces return to 0
    if (blockStart !== -1 && braceDepth === 0 && (line.includes('}') || trimmed === '')) {
      if (i - blockStart >= 3) { // Only record blocks of 3+ lines
        boundaries.push({ start: blockStart, end: i, type: blockType });
      }
      blockStart = -1;
      blockType = 'module';
    }
  }

  return boundaries;
}

/**
 * Fallback: split lines into chunks by character size with overlap.
 *
 * @param {string[]} lines
 * @param {number} maxChunkSize
 * @param {number} overlap
 * @returns {Array<{ content: string, startLine: number, endLine: number, type: 'module' }>}
 */
export function splitBySize(lines, maxChunkSize, overlap) {
  const chunks = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let charCount = 0;

    while (end < lines.length && charCount < maxChunkSize) {
      charCount += lines[end].length + 1;
      end++;
    }

    chunks.push({
      content: lines.slice(start, end).join('\n'),
      startLine: start + 1,
      endLine: end,
      type: 'module',
    });

    // Advance with overlap
    const advance = Math.max(1, end - start - Math.floor(overlap / 40));
    start += advance;
  }

  return chunks;
}

/**
 * Merge small consecutive chunks to reduce fragmentation.
 *
 * @param {Array<{ content: string, startLine: number, endLine: number, type: string }>} chunks
 * @param {number} maxChunkSize
 * @param {number} overlap
 * @returns {Array<{ content: string, startLine: number, endLine: number, type: string }>}
 */
export function mergeSmallChunks(chunks, maxChunkSize, overlap) {
  if (chunks.length <= 1) return chunks;

  const merged = [chunks[0]];

  for (let i = 1; i < chunks.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = chunks[i];

    if (prev.content.length + curr.content.length <= maxChunkSize) {
      // Merge into previous
      merged[merged.length - 1] = {
        content: prev.content + '\n' + curr.content,
        startLine: prev.startLine,
        endLine: curr.endLine,
        type: prev.type === curr.type ? prev.type : 'module',
      };
    } else {
      merged.push(curr);
    }
  }

  return merged;
}
