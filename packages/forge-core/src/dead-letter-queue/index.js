/**
 * DeadLetterQueue — captures tasks that exhausted all self-loop retries.
 *
 * When the SelfLoopEngine returns an EXHAUSTED decision, the failed task
 * is placed here instead of being silently dropped. This enables:
 *   - Post-mortem analysis of persistent failures
 *   - Manual or automated retry at a later time
 *   - Tagging and categorisation for human review
 *   - Statistical insight into failure patterns
 *
 * The queue uses ring-buffer semantics: when `maxSize` is reached the oldest
 * entry is silently overwritten, keeping memory bounded.
 *
 * Usage:
 *   const dlq = new DeadLetterQueue({ maxSize: 200 });
 *   const { id, position } = dlq.add({ goalId, task, result, ... });
 *   const entry = dlq.get(id);
 *   const retryPayload = dlq.retry(id);
 */

export class DeadLetterQueue {
  /** @type {Map<string, object>} insertion-ordered map of entries */
  #entries = new Map();

  /** @type {number} maximum number of entries before ring-buffer eviction */
  #maxSize;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxSize=100] — max entries in queue (ring buffer behaviour)
   */
  constructor({ maxSize = 100 } = {}) {
    this.#maxSize = Math.max(1, Math.floor(maxSize));
  }

  // ── 1. Add ───────────────────────────────────────────────────────────────

  /**
   * Add a failed task to the dead-letter queue.
   *
   * @param {object} opts
   * @param {string} opts.goalId — the goal this task belongs to
   * @param {object} opts.task — the original task descriptor
   * @param {object} [opts.result] — worker execution result
   * @param {object} [opts.verifyResult] — verification engine result
   * @param {Array<object>} [opts.strategyHistory] — history of strategies tried
   * @param {number} [opts.loopCount] — how many self-loop iterations were attempted
   * @returns {{ id: string, position: number }} id and zero-based position in queue
   */
  add({ goalId, task, result, verifyResult, strategyHistory, loopCount }) {
    const id = `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Ring-buffer eviction: drop the oldest entry when at capacity
    if (this.#entries.size >= this.#maxSize) {
      const oldestKey = this.#entries.keys().next().value;
      this.#entries.delete(oldestKey);
    }

    const failures = verifyResult?.failures ?? [];
    const retryAttempts = loopCount ?? 0;

    const entry = {
      id,
      goalId,
      task: structuredClone(task ?? {}),
      result: structuredClone(result ?? null),
      verifyResult: structuredClone(verifyResult ?? null),
      failures: structuredClone(failures),
      strategyHistory: structuredClone(strategyHistory ?? []),
      loopCount: loopCount ?? 0,
      retryAttempts,
      exhaustedAt: Date.now(),
      tags: [],
    };

    this.#entries.set(id, entry);

    // Position is the index among current entries (0-based)
    const position = this.#indexOf(id);

    return { id, position };
  }

  // ── 2. Get ───────────────────────────────────────────────────────────────

  /**
   * Retrieve a single dead-letter entry by id.
   *
   * @param {string} id
   * @returns {object|null} the entry, or null if not found
   */
  get(id) {
    return this.#entries.get(id) ?? null;
  }

  // ── 3. List ──────────────────────────────────────────────────────────────

  /**
   * List dead-letter entries with optional filtering and pagination.
   *
   * @param {object} [opts]
   * @param {string} [opts.goalId] — filter to a specific goal
   * @param {number} [opts.limit=20] — max entries to return
   * @param {number} [opts.offset=0] — number of entries to skip
   * @returns {object[]} array of matching entries
   */
  list({ goalId, limit = 20, offset = 0 } = {}) {
    let entries = [...this.#entries.values()];

    if (goalId) {
      entries = entries.filter((e) => e.goalId === goalId);
    }

    return entries.slice(offset, offset + limit);
  }

  // ── 4. Retry ─────────────────────────────────────────────────────────────

  /**
   * Remove an entry from the DLQ and return it formatted for re-enqueue.
   *
   * The returned payload is shaped for the orchestrator to re-submit:
   * ```
   * { goalId, task, context: { previousFailures, strategyHistory } }
   * ```
   * The task object receives a `_dlqRetryOf` field pointing to the original id.
   *
   * @param {string} id
   * @returns {object|null} the retry payload, or null if the entry was not found
   */
  retry(id) {
    const entry = this.#entries.get(id);
    if (!entry) return null;

    this.#entries.delete(id);

    const task = structuredClone(entry.task);
    task._dlqRetryOf = id;

    return {
      goalId: entry.goalId,
      task,
      context: {
        previousFailures: structuredClone(entry.failures),
        strategyHistory: structuredClone(entry.strategyHistory),
      },
    };
  }

  // ── 5. Discard ───────────────────────────────────────────────────────────

  /**
   * Permanently remove an entry from the queue.
   *
   * @param {string} id
   * @returns {boolean} true if the entry existed and was removed
   */
  discard(id) {
    return this.#entries.delete(id);
  }

  // ── 6. Clear ─────────────────────────────────────────────────────────────

  /**
   * Clear all entries, optionally scoped to a specific goal.
   *
   * @param {object} [opts]
   * @param {string} [opts.goalId] — if provided, only entries for this goal are removed
   * @returns {number} the number of entries removed
   */
  clear({ goalId } = {}) {
    if (!goalId) {
      const count = this.#entries.size;
      this.#entries.clear();
      return count;
    }

    let removed = 0;
    for (const [id, entry] of this.#entries) {
      if (entry.goalId === goalId) {
        this.#entries.delete(id);
        removed++;
      }
    }
    return removed;
  }

  // ── 7. Tags ──────────────────────────────────────────────────────────────

  /**
   * Add a tag to an entry (e.g. 'needs-human-review', 'flaky-test').
   * Tags are stored as a de-duplicated array.
   *
   * @param {string} id
   * @param {string} tag
   * @returns {boolean} true if the tag was added, false if entry not found or tag already present
   */
  addTag(id, tag) {
    const entry = this.#entries.get(id);
    if (!entry) return false;

    const tagSet = new Set(entry.tags);
    if (tagSet.has(tag)) return false;

    tagSet.add(tag);
    entry.tags = [...tagSet];
    return true;
  }

  /**
   * Remove a tag from an entry.
   *
   * @param {string} id
   * @param {string} tag
   * @returns {boolean} true if the tag was removed, false if entry not found or tag not present
   */
  removeTag(id, tag) {
    const entry = this.#entries.get(id);
    if (!entry) return false;

    const tagSet = new Set(entry.tags);
    if (!tagSet.has(tag)) return false;

    tagSet.delete(tag);
    entry.tags = [...tagSet];
    return true;
  }

  // ── 8. Statistics ────────────────────────────────────────────────────────

  /**
   * Compute aggregate statistics across all dead-letter entries.
   *
   * @returns {{
   *   total: number,
   *   byGoalId: Record<string, number>,
   *   byTag: Record<string, number>,
   *   avgLoopCount: number,
   *   oldestAt: number|null,
   *   newestAt: number|null,
   * }}
   */
  getStats() {
    const entries = [...this.#entries.values()];
    const total = entries.length;

    if (total === 0) {
      return {
        total: 0,
        byGoalId: {},
        byTag: {},
        avgLoopCount: 0,
        oldestAt: null,
        newestAt: null,
      };
    }

    /** @type {Record<string, number>} */
    const byGoalId = {};
    /** @type {Record<string, number>} */
    const byTag = {};
    let loopSum = 0;
    let oldestAt = Infinity;
    let newestAt = -Infinity;

    for (const entry of entries) {
      // Count by goal
      byGoalId[entry.goalId] = (byGoalId[entry.goalId] ?? 0) + 1;

      // Count by tag
      for (const tag of entry.tags) {
        byTag[tag] = (byTag[tag] ?? 0) + 1;
      }

      loopSum += entry.loopCount;

      if (entry.exhaustedAt < oldestAt) oldestAt = entry.exhaustedAt;
      if (entry.exhaustedAt > newestAt) newestAt = entry.exhaustedAt;
    }

    return {
      total,
      byGoalId,
      byTag,
      avgLoopCount: Math.round((loopSum / total) * 100) / 100,
      oldestAt,
      newestAt,
    };
  }

  // ── 9. Status ────────────────────────────────────────────────────────────

  /**
   * Quick status snapshot — useful for health-check endpoints.
   *
   * @returns {{ total: number, maxSize: number }}
   */
  getStatus() {
    return {
      total: this.#entries.size,
      maxSize: this.#maxSize,
    };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Compute the zero-based position of an entry in insertion order.
   * @param {string} id
   * @returns {number}
   */
  #indexOf(id) {
    let index = 0;
    for (const key of this.#entries.keys()) {
      if (key === id) return index;
      index++;
    }
    return -1;
  }
}
