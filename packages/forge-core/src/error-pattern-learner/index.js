/**
 * @fileoverview ErrorPatternLearner — learns from errors and generates preventive instructions.
 *
 * Analyzes errors from DLQ entries, verification failures, and task failures to extract
 * recurring patterns. Generates human-readable preventive instructions that can be injected
 * into LLM system prompts to help avoid known error patterns.
 *
 * Features:
 *   - Automatic error message normalization (strips numbers, paths, hashes)
 *   - Confidence scoring with occurrence-based boosting and time decay
 *   - Feedback loop to reinforce helpful patterns
 *   - Relevance ranking by worker type, task type, and keywords
 *   - JSON-based persistence for patterns across restarts
 *
 * @example
 *   const learner = new ErrorPatternLearner({ persistencePath: './patterns.json' });
 *   learner.recordError({ workerType: 'code-gen', errorType: 'runtime', message: '...' });
 *   learner.learn();
 *   const instructions = learner.getInstructions({ workerType: 'code-gen' });
 *
 * @module error-pattern-learner
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DEFAULT_MAX_PATTERNS, DEFAULT_MIN_OCCURRENCES, DEFAULT_DECAY_HALF_LIFE,
  MAX_INSTRUCTIONS, MAX_RAW_ERRORS, CONFIDENCE_HIGH, CONFIDENCE_MED,
  normalizeMessage as _normalizeMessage,
  generateInstruction as _generateInstruction,
  calculateConfidence as _calculateConfidence,
  mergeWorkerAndTaskTypes as _mergeWorkerAndTaskTypes,
  evictLowestConfidence as _evictLowestConfidence,
} from './helpers.js';

/**
 * Learns from errors and generates preventive instructions to inject into LLM prompts.
 *
 * Errors are recorded individually and batch-processed via {@link ErrorPatternLearner#learn}
 * to extract or update patterns. Patterns are scored by confidence (occurrences, feedback,
 * and time decay) and retrieved as formatted instruction blocks for system prompt injection.
 */
export class ErrorPatternLearner {
  /** @type {number} */ #maxPatterns;
  /** @type {number} */ #minOccurrences;
  /** @type {number} Decay half-life in hours. */ #decayHalfLife;
  /** @type {string|null} */ #persistencePath;
  /** @type {Array<ErrorRecord>} Ring buffer of raw error records. */
  #errors = [];
  /** @type {Map<string, ErrorPattern>} Active learned patterns. */
  #patterns = new Map();
  /** @type {number|null} Epoch ms of last learn() call. */
  #lastLearnedAt = null;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxPatterns=200] — max patterns to retain
   * @param {number} [opts.minOccurrences=2] — min occurrences before creating a pattern
   * @param {number} [opts.decayHalfLife=168] — decay half-life in hours (default 7 days)
   * @param {string} [opts.persistencePath] — path for JSON persistence (optional)
   */
  constructor(opts = {}) {
    this.#maxPatterns = opts.maxPatterns ?? DEFAULT_MAX_PATTERNS;
    this.#minOccurrences = opts.minOccurrences ?? DEFAULT_MIN_OCCURRENCES;
    this.#decayHalfLife = opts.decayHalfLife ?? DEFAULT_DECAY_HALF_LIFE;
    this.#persistencePath = opts.persistencePath ?? null;
  }

  // ── 1. Record Error ─────────────────────────────────────────────────────────

  /**
   * Record an error event. Stored in a ring buffer, marked unprocessed until learn().
   * @param {Object} error — { taskId?, goalId?, workerType?, errorType, message, context?, stack?, timestamp? }
   * @returns {string} Unique record identifier.
   */
  recordError(error) {
    const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    this.#errors.push({
      id,
      taskId: error.taskId ?? null,
      goalId: error.goalId ?? null,
      workerType: error.workerType ?? null,
      errorType: error.errorType ?? 'unknown',
      message: error.message ?? '',
      context: error.context ? structuredClone(error.context) : null,
      stack: error.stack ?? null,
      timestamp: error.timestamp ?? Date.now(),
      processed: false,
    });

    if (this.#errors.length > MAX_RAW_ERRORS) {
      this.#errors.shift();
    }

    return id;
  }

  // ── 2. Learn ────────────────────────────────────────────────────────────────

  /**
   * Extract or update patterns from unprocessed errors. Groups by normalised message,
   * promotes to pattern when occurrences >= minOccurrences.
   * @returns {{ newPatterns: number, updatedPatterns: number, totalPatterns: number }}
   */
  learn() {
    const unprocessed = this.#errors.filter(e => !e.processed);
    /** @type {Map<string, Array<ErrorRecord>>} */
    const groups = new Map();

    for (const error of unprocessed) {
      const key = `${error.errorType}::${_normalizeMessage(error.message)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(error);
      error.processed = true;
    }

    let newPatterns = 0;
    let updatedPatterns = 0;

    for (const [key, records] of groups) {
      const [errorType, messagePattern] = key.split('::', 2);
      const existing = this.#findPatternByMessagePattern(messagePattern, errorType);

      if (existing) {
        existing.occurrences += records.length;
        existing.lastSeen = Math.max(existing.lastSeen, ...records.map(r => r.timestamp));
        _mergeWorkerAndTaskTypes(existing, records);
        existing.confidence = _calculateConfidence(existing, this.#decayHalfLife);
        updatedPatterns++;
      } else if (records.length >= this.#minOccurrences) {
        const timestamps = records.map(r => r.timestamp);
        const pattern = {
          id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          errorType,
          messagePattern,
          instruction: _generateInstruction(errorType, messagePattern),
          workerTypes: [...new Set(records.map(r => r.workerType).filter(Boolean))],
          taskTypes: [...new Set(records.map(r => r.context?.taskType).filter(Boolean))],
          occurrences: records.length,
          firstSeen: Math.min(...timestamps),
          lastSeen: Math.max(...timestamps),
          confidence: 0,
          feedback: { helpful: 0, unhelpful: 0 },
        };
        pattern.confidence = _calculateConfidence(pattern, this.#decayHalfLife);

        if (this.#patterns.size >= this.#maxPatterns) _evictLowestConfidence(this.#patterns);
        this.#patterns.set(pattern.id, pattern);
        newPatterns++;
      }
    }

    this.#lastLearnedAt = Date.now();
    return { newPatterns, updatedPatterns, totalPatterns: this.#patterns.size };
  }

  // ── 3. Get Patterns ─────────────────────────────────────────────────────────

  /**
   * Get all active patterns with optional filtering.
   * @param {object} [opts]
   * @param {string} [opts.workerType] — filter by worker type
   * @param {string} [opts.errorType] — filter by error type
   * @param {number} [opts.minConfidence] — minimum confidence threshold
   * @param {number} [opts.limit] — max patterns to return
   * @returns {ErrorPattern[]}
   */
  getPatterns(opts = {}) {
    let patterns = [...this.#patterns.values()];
    for (const p of patterns) p.confidence = _calculateConfidence(p, this.#decayHalfLife);

    if (opts.workerType) patterns = patterns.filter(p => p.workerTypes.includes(opts.workerType));
    if (opts.errorType) patterns = patterns.filter(p => p.errorType === opts.errorType);
    if (opts.minConfidence != null) patterns = patterns.filter(p => p.confidence >= opts.minConfidence);

    patterns.sort((a, b) => b.confidence - a.confidence);
    return opts.limit ? patterns.slice(0, opts.limit) : patterns;
  }

  // ── 4. Get Instructions ─────────────────────────────────────────────────────

  /**
   * Get preventive instructions formatted for injection into a system prompt:
   * ```
   * ## Common Errors to Avoid
   * - [HIGH] Module not found: Always verify import paths exist.
   * - [MED]  Type errors: Check for null/undefined before accessing properties.
   * ```
   * @param {object} [opts]
   * @param {string} [opts.workerType]
   * @param {string} [opts.taskType]
   * @param {Object} [opts.context]
   * @returns {string} Formatted block, or empty string if no relevant patterns.
   */
  getInstructions(opts = {}) {
    const relevant = this.getRelevantPatterns({
      workerType: opts.workerType,
      taskType: opts.taskType,
      limit: MAX_INSTRUCTIONS,
    });
    if (relevant.length === 0) return '';

    const lines = ['## Common Errors to Avoid'];
    for (const p of relevant) {
      const label = p.confidence >= CONFIDENCE_HIGH ? 'HIGH'
        : p.confidence >= CONFIDENCE_MED ? 'MED' : 'LOW';
      lines.push(`- [${label}] ${p.instruction}`);
    }
    return lines.join('\n');
  }

  // ── 5. Get Relevant Patterns ────────────────────────────────────────────────

  /**
   * Get patterns sorted by relevance for a given context.
   * Relevance score = confidence + workerType match (+30) + taskType match (+20) + keyword matches (+10 each).
   * @param {object} [opts]
   * @param {string} [opts.workerType]
   * @param {string} [opts.taskType]
   * @param {string[]} [opts.keywords]
   * @param {number} [opts.limit=10]
   * @returns {ErrorPattern[]}
   */
  getRelevantPatterns(opts = {}) {
    const { workerType, taskType, keywords = [], limit = 10 } = opts;

    const scored = [...this.#patterns.values()].map(pattern => {
      pattern.confidence = _calculateConfidence(pattern, this.#decayHalfLife);
      let score = pattern.confidence;
      if (workerType && pattern.workerTypes.includes(workerType)) score += 30;
      if (taskType && pattern.taskTypes.includes(taskType)) score += 20;
      if (keywords.length > 0) {
        const lp = pattern.messagePattern.toLowerCase();
        for (const kw of keywords) {
          if (lp.includes(kw.toLowerCase())) score += 10;
        }
      }
      return { pattern, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.pattern);
  }

  // ── 6. Get Stats ────────────────────────────────────────────────────────────

  /**
   * Get error statistics.
   * @returns {{ totalErrors, totalPatterns, byType: Object, byWorker: Object, topErrors: ErrorPattern[] }}
   */
  getStats() {
    const byType = {};
    const byWorker = {};
    for (const error of this.#errors) {
      const type = error.errorType || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      const worker = error.workerType || 'unknown';
      byWorker[worker] = (byWorker[worker] || 0) + 1;
    }
    return {
      totalErrors: this.#errors.length,
      totalPatterns: this.#patterns.size,
      byType, byWorker,
      topErrors: this.getTopPatterns({ limit: 5 }),
    };
  }

  // ── 7. Get Top Patterns ─────────────────────────────────────────────────────

  /**
   * Get the most common error patterns sorted by occurrence count.
   * @param {object} [opts]
   * @param {number} [opts.limit=10]
   * @param {string} [opts.workerType]
   * @returns {ErrorPattern[]}
   */
  getTopPatterns(opts = {}) {
    const { limit = 10, workerType } = opts;
    let patterns = [...this.#patterns.values()];
    if (workerType) patterns = patterns.filter(p => p.workerTypes.includes(workerType));
    patterns.sort((a, b) => b.occurrences - a.occurrences);
    return patterns.slice(0, limit);
  }

  // ── 8. Add Pattern ──────────────────────────────────────────────────────────

  /**
   * Manually add or update a pattern. Merges if a matching messagePattern + errorType exists.
   * @param {Object} pattern — { errorType, messagePattern, instruction?, workerTypes?, confidence?, occurrences? }
   * @returns {string} Pattern identifier.
   */
  addPattern(pattern) {
    const existing = this.#findPatternByMessagePattern(pattern.messagePattern, pattern.errorType);

    if (existing) {
      existing.occurrences += pattern.occurrences ?? 1;
      existing.lastSeen = Date.now();
      if (pattern.instruction) existing.instruction = pattern.instruction;
      for (const wt of (pattern.workerTypes ?? [])) {
        if (!existing.workerTypes.includes(wt)) existing.workerTypes.push(wt);
      }
      existing.confidence = _calculateConfidence(existing, this.#decayHalfLife);
      return existing.id;
    }

    const id = `pat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const newPattern = {
      id,
      errorType: pattern.errorType ?? 'unknown',
      messagePattern: pattern.messagePattern ?? '*',
      instruction: pattern.instruction ?? _generateInstruction(
        pattern.errorType ?? 'unknown', pattern.messagePattern ?? '*'),
      workerTypes: pattern.workerTypes ? [...pattern.workerTypes] : [],
      taskTypes: [],
      occurrences: pattern.occurrences ?? 1,
      firstSeen: now, lastSeen: now,
      confidence: 0,
      feedback: { helpful: 0, unhelpful: 0 },
    };
    newPattern.confidence = pattern.confidence != null
      ? Math.max(0, Math.min(100, pattern.confidence))
      : _calculateConfidence(newPattern, this.#decayHalfLife);

    if (this.#patterns.size >= this.#maxPatterns) _evictLowestConfidence(this.#patterns);
    this.#patterns.set(id, newPattern);
    return id;
  }

  // ── 9. Remove Pattern ───────────────────────────────────────────────────────

  /**
   * Manually remove a pattern.
   * @param {string} patternId
   * @returns {boolean} True if existed and removed.
   */
  removePattern(patternId) {
    return this.#patterns.delete(patternId);
  }

  // ── 10. Record Feedback ─────────────────────────────────────────────────────

  /**
   * Record whether an instruction helped. Adjusts confidence: +2 helpful, -5 unhelpful.
   * @param {string} patternId
   * @param {boolean} helpful
   */
  recordFeedback(patternId, helpful) {
    const pattern = this.#patterns.get(patternId);
    if (!pattern) return;
    if (helpful) {
      pattern.feedback.helpful += 1;
    } else {
      pattern.feedback.unhelpful += 1;
    }
    pattern.confidence = _calculateConfidence(pattern, this.#decayHalfLife);
  }

  // ── 11. Export Patterns ─────────────────────────────────────────────────────

  /**
   * Export all patterns for sharing or backup.
   * @returns {{ version: string, exportedAt: number, patterns: ErrorPattern[] }}
   */
  exportPatterns() {
    return {
      version: '1.0',
      exportedAt: Date.now(),
      patterns: [...this.#patterns.values()].map(p => structuredClone(p)),
    };
  }

  // ── 12. Import Patterns ─────────────────────────────────────────────────────

  /**
   * Import patterns from an exported data object. Duplicates are merged.
   * @param {Object} data — { patterns: ErrorPattern[] }
   * @returns {number} Count of patterns imported.
   */
  importPatterns(data) {
    if (!data || !Array.isArray(data.patterns)) return 0;
    let count = 0;

    for (const imported of data.patterns) {
      const existing = this.#findPatternByMessagePattern(imported.messagePattern, imported.errorType);

      if (existing) {
        existing.occurrences += imported.occurrences ?? 1;
        existing.lastSeen = Math.max(existing.lastSeen, imported.lastSeen ?? 0);
        existing.firstSeen = Math.min(existing.firstSeen, imported.firstSeen ?? Infinity);
        existing.feedback.helpful += imported.feedback?.helpful ?? 0;
        existing.feedback.unhelpful += imported.feedback?.unhelpful ?? 0;
        for (const wt of (imported.workerTypes ?? [])) {
          if (!existing.workerTypes.includes(wt)) existing.workerTypes.push(wt);
        }
        for (const tt of (imported.taskTypes ?? [])) {
          if (!existing.taskTypes.includes(tt)) existing.taskTypes.push(tt);
        }
        existing.confidence = _calculateConfidence(existing, this.#decayHalfLife);
      } else {
        if (this.#patterns.size >= this.#maxPatterns) _evictLowestConfidence(this.#patterns);
        const pattern = structuredClone(imported);
        if (!pattern.id) pattern.id = `pat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (!pattern.feedback) pattern.feedback = { helpful: 0, unhelpful: 0 };
        if (!pattern.workerTypes) pattern.workerTypes = [];
        if (!pattern.taskTypes) pattern.taskTypes = [];
        pattern.confidence = _calculateConfidence(pattern, this.#decayHalfLife);
        this.#patterns.set(pattern.id, pattern);
      }
      count++;
    }

    return count;
  }

  // ── 13. Get Status ──────────────────────────────────────────────────────────

  /**
   * Get learner status summary.
   * @returns {{ patterns, errors, lastLearned: number|null, topPattern: ErrorPattern|null }}
   */
  getStatus() {
    const sorted = [...this.#patterns.values()].sort((a, b) => b.confidence - a.confidence);
    return {
      patterns: this.#patterns.size,
      errors: this.#errors.length,
      lastLearned: this.#lastLearnedAt,
      topPattern: sorted.length > 0 ? sorted[0] : null,
    };
  }

  // ── 14. Clear ───────────────────────────────────────────────────────────────

  /** Clear all patterns and error records. */
  clear() {
    this.#errors = [];
    this.#patterns.clear();
    this.#lastLearnedAt = null;
  }

  // ── 15. Save ────────────────────────────────────────────────────────────────

  /**
   * Save patterns to disk as JSON. Creates parent directories if needed.
   * No-op if no persistencePath was configured.
   */
  async save() {
    if (!this.#persistencePath) return;
    const data = {
      version: '1.0',
      savedAt: Date.now(),
      patterns: [...this.#patterns.values()].map(p => structuredClone(p)),
    };
    await mkdir(dirname(this.#persistencePath), { recursive: true });
    await writeFile(this.#persistencePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ── 16. Load ────────────────────────────────────────────────────────────────

  /**
   * Load patterns from disk. Merges with in-memory state.
   * No-op if no persistencePath or file does not exist.
   */
  async load() {
    if (!this.#persistencePath) return;
    try {
      const raw = await readFile(this.#persistencePath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.patterns)) this.importPatterns(data);
    } catch {
      // File missing or corrupt — silently ignore
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Find an existing pattern by normalised message and error type.
   * @private
   * @param {string} messagePattern
   * @param {string} errorType
   * @returns {ErrorPattern|null}
   */
  #findPatternByMessagePattern(messagePattern, errorType) {
    for (const pattern of this.#patterns.values()) {
      if (pattern.messagePattern === messagePattern && pattern.errorType === errorType) {
        return pattern;
      }
    }
    return null;
  }
}
