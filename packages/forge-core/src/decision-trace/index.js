/**
 * DecisionTrace -- structured decision audit log for Forge.
 *
 * Records *why* the LLM made specific decisions during goal execution,
 * enabling post-mortem debugging, pattern analysis, and quality improvement.
 *
 * Each entry captures the decision type, chosen action, reasoning, alternatives
 * that were considered, and the eventual outcome.  Entries are stored in a
 * ring buffer so memory stays bounded even under heavy use.
 *
 * Tracked decision types:
 *   - tool_choice        -- which tool to invoke
 *   - file_modification  -- what file to change and how
 *   - strategy_selection -- which high-level strategy to follow
 *   - error_handling     -- how to respond to an error
 *   - retry_decision     -- whether (and how) to retry
 *
 * Usage:
 *   import { DecisionTrace } from './decision-trace/index.js';
 *
 *   const trace = new DecisionTrace({ maxEntries: 5000 });
 *   const id = trace.record({ goalId, taskId, workerType: 'coder',
 *     decision: 'tool_choice', action: { tool: 'edit' }, reasoning: '...' });
 *   const failures = trace.getFailures();
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DECISION_TYPES as _DECISION_TYPES,
  OUTCOME_VALUES as _OUTCOME_VALUES,
  SEVERITY_VALUES as _SEVERITY_VALUES,
  DEFAULT_MAX_ENTRIES as _DEFAULT_MAX_ENTRIES,
  MAX_ANNOTATIONS_PER_ENTRY as _MAX_ANNOTATIONS_PER_ENTRY,
  mostCommon as _mostCommon,
  toCSV as _toCSV,
  filteredEntries as _filteredEntries,
  timelineFilteredEntries as _timelineFilteredEntries,
  sortAsc as _sortAsc,
  sortDesc as _sortDesc,
  countByField as _countByField,
} from './helpers.js';

// -- DecisionTrace class ────────────────────────────────────────────────────

export class DecisionTrace {
  /** @type {Map<string, DecisionEntry>} insertion-ordered entry store */
  #entries = new Map();

  /** @type {number} ring buffer capacity */
  #maxEntries;

  /** @type {string|null} file path for JSON persistence */
  #persistencePath;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxEntries=5000]       — max entries before ring-buffer eviction
   * @param {string} [opts.persistencePath]       — optional JSON file for save / load
   */
  constructor(opts = {}) {
    this.#maxEntries = Math.max(1, Math.floor(opts.maxEntries ?? _DEFAULT_MAX_ENTRIES));
    this.#persistencePath = opts.persistencePath ?? null;
  }

  // ── 1. Record ────────────────────────────────────────────────────────────

  /**
   * Record a new decision entry.
   *
   * @param {object} entry
   * @param {string}  entry.goalId
   * @param {string}  entry.taskId
   * @param {string}  entry.workerType
   * @param {string}  entry.decision     — one of the recognised decision types
   * @param {object}  entry.action       — the chosen action payload
   * @param {string}  [entry.reasoning='']  — why this decision was made
   * @param {Array<object>} [entry.alternatives=[]] — alternatives considered
   * @param {'success'|'failure'|'partial'|'pending'} [entry.outcome='pending']
   * @param {number}  [entry.confidence=50] — self-assessed confidence (0-100)
   * @param {object}  [entry.context={}]    — arbitrary contextual metadata
   * @param {string[]} [entry.tags=[]]      — free-form classification tags
   * @returns {string} the generated entry id
   */
  record(entry) {
    const id = `dt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Ring-buffer eviction: drop the oldest entry when at capacity
    if (this.#entries.size >= this.#maxEntries) {
      const oldestKey = this.#entries.keys().next().value;
      this.#entries.delete(oldestKey);
    }

    const decision = entry.decision ?? 'tool_choice';
    const outcome = _OUTCOME_VALUES.has(entry.outcome) ? entry.outcome : 'pending';
    const confidence = Math.max(0, Math.min(100, Math.round(entry.confidence ?? 50)));

    /** @type {DecisionEntry} */
    const record = {
      id,
      goalId: entry.goalId ?? null,
      taskId: entry.taskId ?? null,
      workerType: entry.workerType ?? 'unknown',
      timestamp: Date.now(),
      decision: _DECISION_TYPES.has(decision) ? decision : 'tool_choice',
      action: structuredClone(entry.action ?? {}),
      reasoning: entry.reasoning ?? '',
      alternatives: structuredClone(entry.alternatives ?? []),
      outcome,
      confidence,
      context: structuredClone(entry.context ?? {}),
      annotations: [],
      tags: structuredClone(entry.tags ?? []),
    };

    this.#entries.set(id, record);
    return id;
  }

  // ── 2. Query by task ─────────────────────────────────────────────────────

  /**
   * Get all decisions recorded for a specific task.
   *
   * @param {string} taskId
   * @returns {DecisionEntry[]} entries sorted by timestamp ascending
   */
  getTaskDecisions(taskId) {
    const results = [];
    for (const entry of this.#entries.values()) {
      if (entry.taskId === taskId) results.push(entry);
    }
    return _sortAsc(results);
  }

  // ── 3. Query by goal ─────────────────────────────────────────────────────

  /**
   * Get all decisions recorded for a specific goal.
   *
   * @param {string} goalId
   * @returns {DecisionEntry[]} entries sorted by timestamp ascending
   */
  getGoalDecisions(goalId) {
    const results = [];
    for (const entry of this.#entries.values()) {
      if (entry.goalId === goalId) results.push(entry);
    }
    return _sortAsc(results);
  }

  // ── 4. Search ────────────────────────────────────────────────────────────

  /**
   * Search decisions by flexible multi-criteria filtering.
   * All provided criteria are ANDed together; omitted criteria are ignored.
   *
   * @param {SearchCriteria} criteria
   * @returns {DecisionEntry[]} matching entries sorted by timestamp descending
   */
  search(criteria = {}) {
    return _sortDesc(_filteredEntries([...this.#entries.values()], criteria));
  }

  // ── 5. Statistics ────────────────────────────────────────────────────────

  /**
   * Compute aggregate decision statistics.
   *
   * @param {object} [opts]
   * @param {string} [opts.goalId] — scope stats to a single goal
   * @returns {{ total: number, byDecision: Record<string,number>, byOutcome: Record<string,number>, byWorker: Record<string,number>, avgConfidence: number }}
   */
  getStats(opts = {}) {
    let entries = [...this.#entries.values()];
    if (opts.goalId) {
      entries = entries.filter((e) => e.goalId === opts.goalId);
    }

    const total = entries.length;
    if (total === 0) {
      return { total: 0, byDecision: {}, byOutcome: {}, byWorker: {}, avgConfidence: 0 };
    }

    /** @type {Record<string, number>} */
    const byDecision = {};
    let confidenceSum = 0;

    for (const e of entries) {
      byDecision[e.decision] = (byDecision[e.decision] ?? 0) + 1;
      confidenceSum += e.confidence;
    }

    return {
      total,
      byDecision,
      byOutcome: _countByField(entries, 'outcome'),
      byWorker: _countByField(entries, 'workerType'),
      avgConfidence: Math.round((confidenceSum / total) * 100) / 100,
    };
  }

  // ── 6. Timeline ──────────────────────────────────────────────────────────

  /**
   * Get a chronological timeline of decisions with optional filtering.
   *
   * @param {object} [opts]
   * @param {number} [opts.limit]   — max entries to return
   * @param {string} [opts.goalId]  — scope to a specific goal
   * @param {string} [opts.taskId]  — scope to a specific task
   * @param {number} [opts.after]   — entries after this epoch ms
   * @param {number} [opts.before]  — entries before this epoch ms
   * @returns {DecisionEntry[]} entries sorted by timestamp ascending
   */
  getTimeline(opts = {}) {
    let entries = _timelineFilteredEntries([...this.#entries.values()], opts);
    _sortAsc(entries);
    if (opts.limit && opts.limit > 0) {
      entries = entries.slice(0, opts.limit);
    }
    return entries;
  }

  // ── 7. Patterns ──────────────────────────────────────────────────────────

  /**
   * Discover recurring decision patterns (sequences of 2-3 decisions that
   * frequently occur together within the same goal).
   *
   * @returns {DecisionPattern[]} patterns sorted by count descending
   */
  getPatterns() {
    // Group entries by goal and sort chronologically within each goal.
    /** @type {Map<string, DecisionEntry[]>} */
    const byGoal = new Map();
    for (const entry of this.#entries.values()) {
      const key = entry.goalId ?? '__none__';
      if (!byGoal.has(key)) byGoal.set(key, []);
      byGoal.get(key).push(entry);
    }

    /** @type {Map<string, { count: number, outcomes: string[] }>} */
    const patternMap = new Map();

    for (const entries of byGoal.values()) {
      _sortAsc(entries);

      // Extract bigrams (sequences of 2)
      for (let i = 0; i < entries.length - 1; i++) {
        const seq = [entries[i].decision, entries[i + 1].decision];
        const key = seq.join(' -> ');
        const existing = patternMap.get(key);
        if (existing) {
          existing.count++;
          existing.outcomes.push(entries[i + 1].outcome);
        } else {
          patternMap.set(key, { count: 1, outcomes: [entries[i + 1].outcome] });
        }
      }

      // Extract trigrams (sequences of 3)
      for (let i = 0; i < entries.length - 2; i++) {
        const seq = [entries[i].decision, entries[i + 1].decision, entries[i + 2].decision];
        const key = seq.join(' -> ');
        const existing = patternMap.get(key);
        if (existing) {
          existing.count++;
          existing.outcomes.push(entries[i + 2].outcome);
        } else {
          patternMap.set(key, { count: 1, outcomes: [entries[i + 2].outcome] });
        }
      }
    }

    // Convert to sorted array, computing the most common outcome per pattern.
    const patterns = [];
    for (const [key, data] of patternMap) {
      if (data.count < 2) continue; // skip one-off patterns
      patterns.push({
        pattern: key.split(' -> '),
        count: data.count,
        avgOutcome: _mostCommon(data.outcomes),
      });
    }

    return patterns.sort((a, b) => b.count - a.count);
  }

  // ── 8. Failures ──────────────────────────────────────────────────────────

  /**
   * Get decisions that led to failures, sorted by most recent first.
   *
   * @param {object} [opts]
   * @param {number} [opts.limit=50]     — max entries to return
   * @param {string} [opts.workerType]   — filter by worker type
   * @param {string} [opts.goalId]       — filter by goal
   * @returns {DecisionEntry[]}
   */
  getFailures(opts = {}) {
    let entries = _filteredEntries(
      [...this.#entries.values()].filter((e) => e.outcome === 'failure'),
      opts,
    );
    _sortDesc(entries);
    const limit = opts.limit ?? 50;
    if (limit > 0) {
      entries = entries.slice(0, limit);
    }
    return entries;
  }

  // ── 9. Annotate ──────────────────────────────────────────────────────────

  /**
   * Add a post-hoc annotation to an existing decision entry.
   * Useful for debugging sessions where you want to note what went wrong.
   *
   * @param {string} entryId
   * @param {object} annotation
   * @param {string} annotation.note            — free-text observation
   * @param {string} [annotation.correctedAction] — what should have been done
   * @param {'info'|'warning'|'error'} [annotation.severity='info']
   * @returns {boolean} true if the annotation was added, false if entry not found
   */
  annotate(entryId, annotation) {
    const entry = this.#entries.get(entryId);
    if (!entry) return false;

    const severity = _SEVERITY_VALUES.has(annotation.severity)
      ? annotation.severity
      : 'info';

    if (entry.annotations.length >= _MAX_ANNOTATIONS_PER_ENTRY) {
      return false;
    }

    entry.annotations.push({
      note: annotation.note ?? '',
      correctedAction: annotation.correctedAction ?? '',
      severity,
      timestamp: Date.now(),
    });

    return true;
  }

  // ── 10. Export ────────────────────────────────────────────────────────────

  /**
   * Export decision data for external analysis.
   *
   * @param {object} [opts]
   * @param {'json'|'csv'} [opts.format='json'] — output format
   * @param {string} [opts.goalId]  — scope export to a single goal
   * @param {number} [opts.after]   — entries after this epoch ms
   * @param {number} [opts.before]  — entries before this epoch ms
   * @returns {{ format: string, entries: DecisionEntry[]|string, count: number, exportedAt: number }}
   */
  export(opts = {}) {
    const format = opts.format === 'csv' ? 'csv' : 'json';
    let entries = _timelineFilteredEntries([...this.#entries.values()], opts);
    _sortAsc(entries);

    if (format === 'csv') {
      const csv = _toCSV(entries);
      return { format: 'csv', entries: csv, count: entries.length, exportedAt: Date.now() };
    }

    return { format: 'json', entries, count: entries.length, exportedAt: Date.now() };
  }

  // ── 11. Status ────────────────────────────────────────────────────────────

  /**
   * Quick status summary -- useful for health-check endpoints.
   *
   * @returns {{ entries: number, maxEntries: number, byOutcome: Record<string,number>, recent: DecisionEntry[] }}
   */
  getStatus() {
    const all = [...this.#entries.values()];
    const recent = _sortDesc(all).slice(0, 5);

    return {
      entries: this.#entries.size,
      maxEntries: this.#maxEntries,
      byOutcome: _countByField(all, 'outcome'),
      recent,
    };
  }

  // ── 12. Clear ─────────────────────────────────────────────────────────────

  /**
   * Remove all entries from the trace.
   */
  clear() {
    this.#entries.clear();
  }

  // ── 13. Persistence: save ─────────────────────────────────────────────────

  /**
   * Persist all entries to a JSON file (if persistencePath was configured).
   *
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.#persistencePath) return;

    const payload = {
      version: 1,
      maxEntries: this.#maxEntries,
      savedAt: Date.now(),
      entries: [...this.#entries.values()],
    };

    const dir = dirname(this.#persistencePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.#persistencePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  // ── 14. Persistence: load ─────────────────────────────────────────────────

  /**
   * Load entries from a previously saved JSON file.
   * Existing entries are replaced entirely.
   *
   * @returns {Promise<void>}
   */
  async load() {
    if (!this.#persistencePath) return;

    let raw;
    try {
      raw = await readFile(this.#persistencePath, 'utf-8');
    } catch {
      // File does not exist yet -- nothing to load
      return;
    }

    const payload = JSON.parse(raw);

    this.#entries.clear();

    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const maxToLoad = Math.min(entries.length, this.#maxEntries);

    // Load the most recent entries if the file contains more than capacity
    const slice = entries.slice(entries.length - maxToLoad);
    for (const entry of slice) {
      if (entry && entry.id) {
        this.#entries.set(entry.id, entry);
      }
    }
  }
}
