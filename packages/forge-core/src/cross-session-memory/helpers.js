/**
 * Pure helpers and constants for CrossSessionMemory.
 * @module cross-session-memory/helpers
 */

// -- Constants ----------------------------------------------------------------

/** Default maximum entries per global pool. */
export const DEFAULT_MAX_GLOBAL_ENTRIES = 500;

/** Default maximum entries imported per project. */
export const DEFAULT_MAX_PROJECT_ENTRIES = 100;

/** Default number of similar entries before consolidation triggers. */
export const DEFAULT_CONSOLIDATION_THRESHOLD = 10;

/** Default number of days before relevance decay begins. */
export const DEFAULT_RELEVANCE_DECAY_DAYS = 90;

/** Similarity threshold for deduplication (0..1). */
export const DEDUP_SIMILARITY_THRESHOLD = 0.8;

/** One day in milliseconds. */
export const MS_PER_DAY = 86_400_000;

// -- Pure helpers -------------------------------------------------------------

let _idSeq = 0;

/** Generate a unique identifier for a memory entry. */
export function genId() {
  return `csm_${Date.now()}_${++_idSeq}`;
}

/** Normalize text for comparison: lowercase, strip whitespace, remove digits. */
export function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\d+/g, '')
    .replace(/[^a-z]/g, '');
}

/**
 * Compute character-level Jaccard similarity between two normalized strings.
 * Uses bigram overlap for a balance of speed and accuracy.
 * @param {string} a
 * @param {string} b
 * @returns {number} similarity in [0, 1]
 */
export function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;

  const bigramsA = new Set();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
  const bigramsB = new Set();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return intersection / Math.max(bigramsA.size, bigramsB.size);
}

/** Extract keywords from text (lowercase, split on non-alpha, filter short). */
export function keywords(text) {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2),
  );
}

/** Compute keyword overlap score between two keyword sets. */
export function keywordOverlap(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const w of a) {
    if (b.has(w)) overlap++;
  }
  return overlap / Math.max(a.size, b.size);
}

/** Deep-clone a plain object via JSON round-trip. */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// -- Converted from private methods -------------------------------------------

/**
 * Push an entry into a ring buffer pool, evicting the oldest if at capacity.
 * @param {Array<object>} pool
 * @param {object} entry
 * @param {number} maxEntries
 */
export function pushRing(pool, entry, maxEntries) {
  while (pool.length >= maxEntries) {
    pool.shift();
  }
  pool.push(entry);
}

/**
 * Create a base entry object with common fields.
 * @param {string} type -- 'insight' | 'errorFix' | 'strategy'
 * @param {object} data -- type-specific fields
 * @returns {object}
 */
export function createEntry(type, data) {
  const base = {
    id: genId(),
    feedback: { positive: 0, negative: 0 },
    timestamp: Date.now(),
    updatedAt: Date.now(),
  };
  if (type === 'insight') {
    return {
      ...base,
      content: data.content ?? '',
      category: data.category ?? 'general',
      tags: data.tags ?? [],
      source: data.source ?? {},
      confidence: data.confidence ?? 50,
    };
  }
  if (type === 'errorFix') {
    return {
      ...base,
      errorPattern: data.errorPattern ?? '',
      fixDescription: data.fixDescription ?? '',
      language: data.language ?? 'unknown',
      tags: data.tags ?? [],
      successRate: data.successRate ?? 50,
    };
  }
  return {
    ...base,
    name: data.name ?? '',
    description: data.description ?? '',
    applicableTo: data.applicableTo ?? [],
    tags: data.tags ?? [],
    effectiveness: data.effectiveness ?? 50,
  };
}

/**
 * Score an entry against a query for recall relevance.
 * @param {object} entry
 * @param {string} queryLower
 * @param {Set<string>} queryKeywords
 * @param {Set<string>|null} filterTags
 * @param {string} [textField]
 * @param {number} relevanceDecayDays
 * @returns {number}
 */
export function scoreEntry(entry, queryLower, queryKeywords, filterTags, textField, relevanceDecayDays) {
  let score = 0;

  if (filterTags && entry.tags) {
    for (const tag of entry.tags) {
      if (filterTags.has(tag.toLowerCase())) score += 30;
    }
  }

  if (entry.category && queryLower.includes(entry.category.toLowerCase())) {
    score += 20;
  }

  const entryText = textField ?? entry.content ?? '';
  const entryKw = keywords(entryText);
  const overlap = keywordOverlap(queryKeywords, entryKw);
  score += Math.round(overlap * 50);

  const conf = entry.confidence ?? entry.successRate ?? entry.effectiveness ?? 50;
  score += Math.round((conf / 100) * 20);

  const ageDays = (Date.now() - (entry.timestamp ?? entry.updatedAt ?? Date.now())) / MS_PER_DAY;
  const recencyFactor = Math.max(0, 1 - ageDays / relevanceDecayDays);
  score += Math.round(recencyFactor * 15);

  return score;
}

/**
 * Score, filter, sort, and slice a pool of entries for recall.
 * @param {object[]} entries
 * @param {string} queryLower
 * @param {Set<string>} queryKeywords
 * @param {Set<string>|null} filterTags
 * @param {function} filterFn -- (entry) => boolean
 * @param {function} textExtractor -- (entry) => string
 * @param {number} limit
 * @param {number} relevanceDecayDays
 * @returns {object[]}
 */
export function scorePool(entries, queryLower, queryKeywords, filterTags, filterFn, textExtractor, limit, relevanceDecayDays) {
  return entries
    .filter(filterFn)
    .map(e => ({
      entry: e,
      score: scoreEntry(e, queryLower, queryKeywords, filterTags, textExtractor(e), relevanceDecayDays),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry);
}

/**
 * Compute a simple text relevance score (for search).
 * @param {string} text
 * @param {string} queryLower
 * @param {Set<string>} queryKw
 * @returns {number}
 */
export function textScore(text, queryLower, queryKw) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  if (lower.includes(queryLower)) score += 30;
  const entryKw = keywords(text);
  score += Math.round(keywordOverlap(queryKw, entryKw) * 50);
  return score;
}

/**
 * Find a similar entry in a pool using normalized text comparison.
 * @param {Array<object>} pool
 * @param {string} normQuery
 * @param {function} extractor
 * @returns {object|null}
 */
export function findSimilar(pool, normQuery, extractor) {
  let best = null;
  let bestSim = 0;
  for (const entry of pool) {
    const sim = similarity(normQuery, extractor(entry));
    if (sim > bestSim) {
      bestSim = sim;
      best = entry;
    }
  }
  return bestSim >= DEDUP_SIMILARITY_THRESHOLD ? best : null;
}

/** Merge a project memory into an existing insight entry. */
export function mergeInsight(existing, mem, projectContext) {
  const newTags = (mem.tags ?? []).filter(t => !existing.tags.includes(t));
  existing.tags.push(...newTags);
  existing.confidence = Math.min(100, existing.confidence + 3);
  existing.updatedAt = Date.now();
  if (!existing.sources) existing.sources = [existing.source];
  existing.sources.push({
    project: projectContext.projectName,
    goal: mem.goalId ?? null,
    task: mem.taskId ?? null,
  });
}

/** Merge a project memory into an existing error fix entry. */
export function mergeErrorFix(existing, mem, languages) {
  const newTags = (mem.tags ?? []).filter(t => !existing.tags.includes(t));
  existing.tags.push(...newTags);
  existing.successRate = Math.min(100, existing.successRate + 3);
  existing.updatedAt = Date.now();
  for (const lang of languages) {
    if (lang && !existing.language.includes(lang)) {
      existing.language = existing.language === 'unknown' ? lang : existing.language;
    }
  }
}

/** Merge a project memory into an existing strategy entry. */
export function mergeStrategy(existing, mem, languages, frameworks) {
  const newTags = (mem.tags ?? []).filter(t => !existing.tags.includes(t));
  existing.tags.push(...newTags);
  existing.effectiveness = Math.min(100, existing.effectiveness + 3);
  existing.updatedAt = Date.now();
  for (const item of [...languages, ...frameworks]) {
    if (item && !existing.applicableTo.includes(item)) {
      existing.applicableTo.push(item);
    }
  }
}

/**
 * Group insight entries by category, then sub-group by tag overlap.
 * @param {object[]} entries
 * @returns {Map<string, object[][]>}
 */
export function groupInsightsByCategoryTags(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const result = new Map();
  for (const [category, catEntries] of groups) {
    result.set(category, groupByTags(catEntries));
  }
  return result;
}

/**
 * Compact error fixes by merging entries with identical normalized error patterns.
 * @param {object[]} fixes
 * @returns {object[]} filtered array (originals mutated in place)
 */
export function compactErrorFixes(fixes) {
  const fixMap = new Map();
  for (const fix of fixes) {
    const norm = normalize(fix.errorPattern);
    if (fixMap.has(norm)) {
      const existing = fixMap.get(norm);
      existing.fixDescription += ` | ${fix.fixDescription}`;
      existing.tags = [...new Set([...existing.tags, ...fix.tags])];
      existing.successRate = Math.max(existing.successRate, fix.successRate);
      existing.updatedAt = Date.now();
      fix._remove = true;
    } else {
      fixMap.set(norm, fix);
    }
  }
  return fixes.filter(e => !e._remove);
}

/**
 * Group entries by tag overlap. Two entries belong to the same group
 * if they share at least one tag.
 * @param {object[]} entries
 * @returns {object[][]}
 */
export function groupByTags(entries) {
  const visited = new Set();
  const groups = [];
  for (let i = 0; i < entries.length; i++) {
    if (visited.has(entries[i].id)) continue;
    const group = [entries[i]];
    visited.add(entries[i].id);
    const groupTags = new Set(entries[i].tags.map(t => t.toLowerCase()));
    for (let j = i + 1; j < entries.length; j++) {
      if (visited.has(entries[j].id)) continue;
      const entryTags = entries[j].tags.map(t => t.toLowerCase());
      if (entryTags.some(t => groupTags.has(t))) {
        group.push(entries[j]);
        visited.add(entries[j].id);
        for (const t of entryTags) groupTags.add(t);
      }
    }
    groups.push(group);
  }
  return groups;
}

// -- Extracted from CrossSessionMemory class ----------------------------------

/**
 * Resolve which confidence-like key an entry uses.
 * @param {object} entry
 * @returns {string}
 */
export function resolveConfidenceKey(entry) {
  if ('confidence' in entry) return 'confidence';
  if ('successRate' in entry) return 'successRate';
  return 'effectiveness';
}

/**
 * Score an entry's relevance to a project context based on term overlap.
 * @param {string[]} applicable -- applicable languages/frameworks
 * @param {string[]} entryTags -- entry tags
 * @param {Set<string>} allTerms -- lowercased project terms
 * @returns {number}
 */
export function relevanceScore(applicable, entryTags, allTerms) {
  let score = 0;
  for (const a of applicable) {
    if (allTerms.has(a.toLowerCase())) score += 20;
  }
  for (const t of entryTags) {
    if (allTerms.has(t.toLowerCase())) score += 10;
  }
  return score;
}

/**
 * Score, sort, slice, and deep-clone a pool for project export.
 * @param {object[]} pool
 * @param {function} applicableFn -- (entry) => string[]
 * @param {Set<string>} allTerms
 * @param {number} [limit=50]
 * @returns {object[]}
 */
export function exportPool(pool, applicableFn, allTerms, limit = 50) {
  return pool
    .map(e => ({ entry: e, score: relevanceScore(applicableFn(e), e.tags, allTerms) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => deepClone(s.entry));
}

/**
 * Process one insight consolidation group: create a merged entry, remove originals.
 * Mutates the provided insights array (replacement) and store (via storeFn).
 * @param {object[]} group
 * @param {string} category
 * @param {object[]} insights -- current insights array reference
 * @param {function} storeFn -- (insight) => void
 * @returns {{ newInsights: object[], consolidated: number, removed: number }}
 */
export function processInsightGroup(group, category, insights, storeFn) {
  const allContent = group.map(e => e.content).join('; ');
  const allTags = [...new Set(group.flatMap(e => e.tags))];
  const avgConfidence = group.reduce((sum, e) => sum + e.confidence, 0) / group.length;

  storeFn({
    content: `[Consolidated: ${group.length} entries] ${allContent.slice(0, 500)}`,
    category,
    tags: allTags,
    confidence: Math.round(avgConfidence),
  });

  const idsToRemove = new Set(group.map(e => e.id));
  const before = insights.length;
  const filtered = insights.filter(e => !idsToRemove.has(e.id));
  return { newInsights: filtered, consolidated: 1, removed: before - filtered.length };
}

/**
 * Score entries from a pool for free-text search.
 * @param {object[]} pool
 * @param {string} typeLabel -- '_type' value
 * @param {string} queryLower
 * @param {Set<string>} queryKw
 * @param {function} textFn -- (entry) => string
 * @returns {object[]}
 */
export function searchPool(pool, typeLabel, queryLower, queryKw, textFn) {
  const results = [];
  for (const entry of pool) {
    const score = textScore(textFn(entry), queryLower, queryKw);
    if (score > 0) results.push({ ...entry, _type: typeLabel, _score: score });
  }
  return results;
}
