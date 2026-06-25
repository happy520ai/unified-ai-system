/**
 * CrossSessionMemory -- global memory layer that persists across projects and sessions.
 * Extracts universal knowledge from project-specific memories and makes them
 * available to new projects. See helpers.js for pure utility functions.
 *
 * @module cross-session-memory
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DEFAULT_MAX_GLOBAL_ENTRIES,
  DEFAULT_MAX_PROJECT_ENTRIES,
  DEFAULT_CONSOLIDATION_THRESHOLD,
  DEFAULT_RELEVANCE_DECAY_DAYS,
  normalize,
  keywords,
  pushRing,
  createEntry,
  scoreEntry as _scoreEntry,
  scorePool,
  textScore as _textScore,
  findSimilar as _findSimilar,
  mergeInsight as _mergeInsight,
  mergeErrorFix as _mergeErrorFix,
  mergeStrategy as _mergeStrategy,
  groupInsightsByCategoryTags,
  compactErrorFixes,
  resolveConfidenceKey,
  exportPool,
  processInsightGroup,
  searchPool,
} from './helpers.js';

// =============================================================================
//  CrossSessionMemory
// =============================================================================

export class CrossSessionMemory {
  #insights = [];
  #errorFixes = [];
  #strategies = [];
  #persistencePath;
  #maxGlobalEntries;
  #maxProjectEntries;
  #consolidationThreshold;
  #relevanceDecayDays;
  #lastConsolidation = null;

  /**
   * @param {object} [opts]
   * @param {string} [opts.persistencePath] -- path to JSON persistence file
   * @param {number} [opts.maxGlobalEntries=500] -- max entries per pool
   * @param {number} [opts.maxProjectEntries=100] -- max entries per import
   * @param {number} [opts.consolidationThreshold=10] -- group size trigger
   * @param {number} [opts.relevanceDecayDays=90] -- days before decay
   */
  constructor(opts = {}) {
    this.#persistencePath = opts.persistencePath ?? null;
    this.#maxGlobalEntries = opts.maxGlobalEntries ?? DEFAULT_MAX_GLOBAL_ENTRIES;
    this.#maxProjectEntries = opts.maxProjectEntries ?? DEFAULT_MAX_PROJECT_ENTRIES;
    this.#consolidationThreshold = opts.consolidationThreshold ?? DEFAULT_CONSOLIDATION_THRESHOLD;
    this.#relevanceDecayDays = opts.relevanceDecayDays ?? DEFAULT_RELEVANCE_DECAY_DAYS;
  }

  // ---------------------------------------------------------------------------
  //  Store methods
  // ---------------------------------------------------------------------------

  /**
   * Store a universal insight (not project-specific).
   * @param {object} insight
   * @param {string} insight.content -- the insight text
   * @param {string} [insight.category] -- category label
   * @param {string[]} [insight.tags] -- tag labels
   * @param {object} [insight.source] -- origin metadata
   * @param {number} [insight.confidence] -- initial confidence [0, 100]
   * @returns {string} the entry id
   */
  storeInsight(insight) {
    const entry = createEntry('insight', {
      content: insight.content ?? '',
      category: insight.category ?? 'general',
      tags: insight.tags ?? [],
      source: insight.source ?? {},
      confidence: insight.confidence ?? 50,
    });
    pushRing(this.#insights, entry, this.#maxGlobalEntries);
    return entry.id;
  }

  /**
   * Store a reusable error fix pattern.
   * @param {object} fix
   * @param {string} fix.errorPattern -- normalised error pattern text
   * @param {string} fix.fixDescription -- how to fix it
   * @param {string} [fix.language] -- programming language
   * @param {string[]} [fix.tags] -- tag labels
   * @param {number} [fix.successRate] -- initial success rate [0, 100]
   * @returns {string} the entry id
   */
  storeErrorFix(fix) {
    const entry = createEntry('errorFix', {
      errorPattern: fix.errorPattern ?? '',
      fixDescription: fix.fixDescription ?? '',
      language: fix.language ?? 'unknown',
      tags: fix.tags ?? [],
      successRate: fix.successRate ?? 50,
    });
    pushRing(this.#errorFixes, entry, this.#maxGlobalEntries);
    return entry.id;
  }

  /**
   * Store a successful coding strategy.
   * @param {object} strategy
   * @param {string} strategy.name -- strategy name
   * @param {string} strategy.description -- detailed description
   * @param {string[]} [strategy.applicableTo] -- languages / frameworks
   * @param {string[]} [strategy.tags] -- tag labels
   * @param {number} [strategy.effectiveness] -- initial effectiveness [0, 100]
   * @returns {string} the entry id
   */
  storeStrategy(strategy) {
    const entry = createEntry('strategy', {
      name: strategy.name ?? '',
      description: strategy.description ?? '',
      applicableTo: strategy.applicableTo ?? [],
      tags: strategy.tags ?? [],
      effectiveness: strategy.effectiveness ?? 50,
    });
    pushRing(this.#strategies, entry, this.#maxGlobalEntries);
    return entry.id;
  }

  // ---------------------------------------------------------------------------
  //  Recall
  // ---------------------------------------------------------------------------

  /**
   * Query universal memories relevant to the current context.
   * @param {string} query -- natural language query
   * @param {object} [opts]
   * @param {number} [opts.limit=20] -- max results per pool
   * @param {string[]} [opts.categories] -- filter insight categories
   * @param {string[]} [opts.tags] -- required tags
   * @param {string} [opts.language] -- filter by programming language
   * @param {number} [opts.minConfidence=0] -- minimum confidence threshold
   * @returns {{ insights: object[], errorFixes: object[], strategies: object[], total: number }}
   */
  recall(query, opts = {}) {
    const limit = opts.limit ?? 20;
    const categories = opts.categories ? new Set(opts.categories) : null;
    const tags = opts.tags ? new Set(opts.tags.map(t => t.toLowerCase())) : null;
    const language = opts.language ? opts.language.toLowerCase() : null;
    const minConfidence = opts.minConfidence ?? 0;
    const decay = this.#relevanceDecayDays;

    const queryKeywords = keywords(query);
    const queryLower = (query || '').toLowerCase();

    const scoredInsights = scorePool(
      this.#insights, queryLower, queryKeywords, tags,
      e => {
        if (categories && !categories.has(e.category)) return false;
        if (tags && !e.tags.some(t => tags.has(t.toLowerCase()))) return false;
        if (e.confidence < minConfidence) return false;
        return true;
      },
      e => e.content, limit, decay,
    );

    const scoredFixes = scorePool(
      this.#errorFixes, queryLower, queryKeywords, tags,
      e => {
        if (language && e.language.toLowerCase() !== language) return false;
        if (tags && !e.tags.some(t => tags.has(t.toLowerCase()))) return false;
        if (e.successRate < minConfidence) return false;
        return true;
      },
      e => e.errorPattern, limit, decay,
    );

    const scoredStrategies = scorePool(
      this.#strategies, queryLower, queryKeywords, tags,
      e => {
        if (language && !e.applicableTo.some(a => a.toLowerCase() === language)) return false;
        if (tags && !e.tags.some(t => tags.has(t.toLowerCase()))) return false;
        if (e.effectiveness < minConfidence) return false;
        return true;
      },
      e => e.description, limit, decay,
    );

    return {
      insights: scoredInsights,
      errorFixes: scoredFixes,
      strategies: scoredStrategies,
      total: scoredInsights.length + scoredFixes.length + scoredStrategies.length,
    };
  }

  // ---------------------------------------------------------------------------
  //  Import / Export
  // ---------------------------------------------------------------------------

  /**
   * Import memories from a project's MemoryEngine cold tier.
   * @param {object[]} projectMemories -- array of cold tier entries
   * @param {object} projectContext
   * @param {string} projectContext.projectName -- project name
   * @param {string[]} [projectContext.languages] -- languages used
   * @param {string[]} [projectContext.frameworks] -- frameworks used
   * @returns {{ imported: number, deduped: number }}
   */
  importFromProject(projectMemories, projectContext) {
    let imported = 0;
    let deduped = 0;
    const languages = projectContext.languages ?? [];
    const frameworks = projectContext.frameworks ?? [];

    for (const mem of projectMemories) {
      if (imported + deduped >= this.#maxProjectEntries) break;

      const content = mem.content ?? mem.summary ?? '';
      if (!content) continue;
      const normContent = normalize(content);

      if (mem.type === 'error' || mem.type === 'bugfix') {
        const existing = _findSimilar(this.#errorFixes, normContent, e =>
          normalize(e.errorPattern + ' ' + e.fixDescription));
        if (existing) {
          _mergeErrorFix(existing, mem, languages);
          deduped++;
        } else {
          this.storeErrorFix({
            errorPattern: content,
            fixDescription: mem.fixDescription ?? mem.resolution ?? content,
            language: languages[0] ?? 'unknown',
            tags: [...(mem.tags ?? []), ...frameworks],
            successRate: mem.importance ?? 50,
          });
          imported++;
        }
      } else if (mem.type === 'strategy') {
        const existing = _findSimilar(this.#strategies, normContent, e =>
          normalize(e.name + ' ' + e.description));
        if (existing) {
          _mergeStrategy(existing, mem, languages, frameworks);
          deduped++;
        } else {
          this.storeStrategy({
            name: mem.title ?? content.slice(0, 60),
            description: content,
            applicableTo: [...languages, ...frameworks],
            tags: mem.tags ?? [],
            effectiveness: mem.importance ?? 50,
          });
          imported++;
        }
      } else {
        const existing = _findSimilar(this.#insights, normContent, e =>
          normalize(e.content));
        if (existing) {
          _mergeInsight(existing, mem, projectContext);
          deduped++;
        } else {
          this.storeInsight({
            content,
            category: mem.type ?? 'general',
            tags: mem.tags ?? [],
            source: {
              project: projectContext.projectName,
              goal: mem.goalId ?? null,
              task: mem.taskId ?? null,
            },
            confidence: mem.importance ?? 50,
          });
          imported++;
        }
      }
    }

    return { imported, deduped };
  }

  /**
   * Export universal memories relevant to a new project bootstrap.
   * @param {object} projectContext
   * @param {string[]} [projectContext.languages]
   * @param {string[]} [projectContext.frameworks]
   * @param {string[]} [projectContext.taskTypes]
   * @returns {{ insights: object[], errorFixes: object[], strategies: object[] }}
   */
  exportForProject(projectContext) {
    const languages = (projectContext.languages ?? []).map(l => l.toLowerCase());
    const frameworks = (projectContext.frameworks ?? []).map(f => f.toLowerCase());
    const taskTypes = (projectContext.taskTypes ?? []).map(t => t.toLowerCase());
    const allTerms = new Set([...languages, ...frameworks, ...taskTypes]);

    const insights = exportPool(this.#insights, () => [], allTerms);
    const errorFixes = exportPool(this.#errorFixes, e => [e.language], allTerms);
    const strategies = exportPool(this.#strategies, e => e.applicableTo, allTerms);

    return { insights, errorFixes, strategies };
  }

  // ---------------------------------------------------------------------------
  //  Consolidation
  // ---------------------------------------------------------------------------

  /**
   * Consolidate similar insights into summaries to reduce noise.
   * @returns {{ consolidated: number, removed: number }}
   */
  consolidate() {
    let consolidated = 0;
    let removed = 0;

    const groups = groupInsightsByCategoryTags(this.#insights);

    for (const [category, tagGroups] of groups) {
      for (const group of tagGroups) {
        if (group.length <= this.#consolidationThreshold) continue;
        const result = processInsightGroup(group, category, this.#insights, i => this.storeInsight(i));
        this.#insights = result.newInsights;
        consolidated += result.consolidated;
        removed += result.removed;
      }
    }

    this.#errorFixes = compactErrorFixes(this.#errorFixes);
    this.#lastConsolidation = Date.now();
    return { consolidated, removed };
  }

  // ---------------------------------------------------------------------------
  //  Feedback
  // ---------------------------------------------------------------------------

  /**
   * Update confidence / effectiveness based on usage feedback.
   * @param {string} id -- entry id (across any pool)
   * @param {boolean} helpful -- whether the memory was helpful
   * @returns {boolean} true if the entry was found and updated
   */
  recordFeedback(id, helpful) {
    const entry =
      this.#insights.find(e => e.id === id) ??
      this.#errorFixes.find(e => e.id === id) ??
      this.#strategies.find(e => e.id === id);

    if (!entry) return false;

    if (helpful) {
      entry.feedback.positive++;
    } else {
      entry.feedback.negative++;
    }

    const adjustment = (entry.feedback.positive - entry.feedback.negative) * 2;
    const key = resolveConfidenceKey(entry);

    entry[key] = Math.max(0, Math.min(100, (entry[key] ?? 50) + adjustment));
    entry.updatedAt = Date.now();
    return true;
  }

  // ---------------------------------------------------------------------------
  //  Statistics and search
  // ---------------------------------------------------------------------------

  /**
   * Get memory statistics across all pools.
   * @returns {{ insights: number, errorFixes: number, strategies: number, avgConfidence: number, languages: string[] }}
   */
  getStats() {
    const allConfidences = [
      ...this.#insights.map(e => e.confidence ?? 0),
      ...this.#errorFixes.map(e => e.successRate ?? 0),
      ...this.#strategies.map(e => e.effectiveness ?? 0),
    ];

    const avgConfidence = allConfidences.length > 0
      ? Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length)
      : 0;

    const languages = new Set();
    for (const fix of this.#errorFixes) {
      if (fix.language && fix.language !== 'unknown') languages.add(fix.language);
    }
    for (const strat of this.#strategies) {
      for (const a of strat.applicableTo) languages.add(a);
    }

    return {
      insights: this.#insights.length,
      errorFixes: this.#errorFixes.length,
      strategies: this.#strategies.length,
      avgConfidence,
      languages: [...languages],
    };
  }

  /**
   * Search across all memory types using a free-text query.
   * @param {string} query -- search text
   * @param {object} [opts]
   * @param {number} [opts.limit=20] -- max results
   * @param {string} [opts.type] -- restrict to 'insights' | 'errorFixes' | 'strategies'
   * @returns {{ results: object[], total: number }}
   */
  search(query, opts = {}) {
    const limit = opts.limit ?? 20;
    const type = opts.type ?? null;
    const queryKw = keywords(query);
    const queryLower = (query || '').toLowerCase();
    const results = [];

    if (!type || type === 'insights') {
      results.push(...searchPool(this.#insights, 'insight', queryLower, queryKw, e => e.content));
    }
    if (!type || type === 'errorFixes') {
      results.push(...searchPool(this.#errorFixes, 'errorFix', queryLower, queryKw, e => `${e.errorPattern} ${e.fixDescription}`));
    }
    if (!type || type === 'strategies') {
      results.push(...searchPool(this.#strategies, 'strategy', queryLower, queryKw, e => `${e.name} ${e.description}`));
    }

    results.sort((a, b) => b._score - a._score);
    return { results: results.slice(0, limit), total: results.length };
  }

  /**
   * Get current status of the cross-session memory system.
   * @returns {{ entries: number, byType: object, persistencePath: string|null, lastConsolidation: number|null }}
   */
  getStatus() {
    return {
      entries: this.#insights.length + this.#errorFixes.length + this.#strategies.length,
      byType: {
        insights: this.#insights.length,
        errorFixes: this.#errorFixes.length,
        strategies: this.#strategies.length,
      },
      persistencePath: this.#persistencePath,
      lastConsolidation: this.#lastConsolidation,
    };
  }

  // ---------------------------------------------------------------------------
  //  Lifecycle
  // ---------------------------------------------------------------------------

  /** Clear all global memories across all three pools. */
  clear() {
    this.#insights = [];
    this.#errorFixes = [];
    this.#strategies = [];
    this.#lastConsolidation = null;
  }

  /** Save all pools to the JSON persistence file. */
  async save() {
    if (!this.#persistencePath) return;

    const data = {
      version: 1,
      savedAt: Date.now(),
      lastConsolidation: this.#lastConsolidation,
      insights: this.#insights,
      errorFixes: this.#errorFixes,
      strategies: this.#strategies,
    };

    await mkdir(dirname(this.#persistencePath), { recursive: true });
    await writeFile(this.#persistencePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Load all pools from the JSON persistence file. Silently no-ops if missing. */
  async load() {
    if (!this.#persistencePath) return;

    try {
      const raw = await readFile(this.#persistencePath, 'utf-8');
      const data = JSON.parse(raw);

      this.#insights = Array.isArray(data.insights) ? data.insights : [];
      this.#errorFixes = Array.isArray(data.errorFixes) ? data.errorFixes : [];
      this.#strategies = Array.isArray(data.strategies) ? data.strategies : [];
      this.#lastConsolidation = data.lastConsolidation ?? null;
    } catch {
      // File does not exist or is corrupt -- start fresh
    }
  }
}
