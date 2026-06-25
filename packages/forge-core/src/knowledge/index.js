import crypto from 'node:crypto';

/**
 * Team Knowledge Base with TF-IDF vector indexing.
 *
 * Enables:
 * - Storing patterns, solutions, decisions, architecture notes
 * - Similarity search via TF-IDF cosine similarity
 * - Cross-user knowledge sharing
 * - Integration with goal execution (workers can query relevant knowledge)
 */
export class KnowledgeBase {
  #store;
  #stopWords;

  constructor(store) {
    this.#store = store;
    // Common English + programming stop words
    this.#stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'it', 'its',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
      'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
      'because', 'but', 'and', 'or', 'if', 'then', 'else', 'for', 'of',
      'in', 'on', 'at', 'to', 'from', 'by', 'with', 'as', 'into', 'about',
      'function', 'class', 'const', 'let', 'var', 'return', 'import', 'export',
      'async', 'await', 'try', 'catch', 'throw', 'new', 'delete', 'typeof',
    ]);
  }

  /**
   * Add a knowledge entry with auto-computed TF-IDF vector.
   *
   * @param {object} params
   * @param {string} params.userId - Owner of the knowledge entry.
   * @param {string} params.title - Human-readable title.
   * @param {string} params.content - Full text body.
   * @param {string} [params.category='general'] - Categorisation bucket.
   * @param {string[]} [params.tags=[]] - Free-form tags for filtering.
   * @param {string[]} [params.relatedGoals=[]] - Goal IDs this entry relates to.
   * @returns {{ id: string, title: string, category: string, tags: string[] }}
   */
  add({ userId, title, content, category = 'general', tags = [], relatedGoals = [] }) {
    const id = crypto.randomUUID();
    const tfidf = this.#computeTFIDF(title + ' ' + content);
    this.#store.addKnowledge({
      id,
      userId,
      title,
      content,
      category,
      tags: JSON.stringify(tags),
      tfidfJson: JSON.stringify(tfidf),
      relatedGoals: JSON.stringify(relatedGoals),
    });
    return { id, title, category, tags };
  }

  /**
   * Search for similar knowledge entries using cosine similarity.
   *
   * @param {string} query - Natural language query.
   * @param {object} [options]
   * @param {string} [options.category] - Restrict search to a single category.
   * @param {string[]} [options.tags] - Require at least one matching tag.
   * @param {number} [options.limit=10] - Maximum number of results.
   * @param {number} [options.threshold=0.1] - Minimum cosine similarity score.
   * @returns {Array<{ id: string, title: string, content: string, category: string, tags: string[], similarity: number, createdAt: string }>}
   */
  search(query, { category, tags, limit = 10, threshold = 0.1 } = {}) {
    const queryVector = this.#computeTFIDF(query);

    // Get all knowledge entries (filtered by category if specified)
    const entries = this.#store.listKnowledge({ category, limit: 1000 });

    // Compute cosine similarity for each entry
    const scored = entries.map(entry => {
      const entryVector = JSON.parse(entry.tfidf_json || '{}');
      const similarity = this.#cosineSimilarity(queryVector, entryVector);
      return { ...entry, similarity };
    });

    // Filter by threshold and optional tags
    let results = scored.filter(e => e.similarity >= threshold);
    if (tags && tags.length > 0) {
      results = results.filter(e => {
        const entryTags = JSON.parse(e.tags || '[]');
        return tags.some(t => entryTags.includes(t));
      });
    }

    // Sort by similarity descending, limit results
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit).map(e => ({
      id: e.id,
      title: e.title,
      content: e.content,
      category: e.category,
      tags: JSON.parse(e.tags || '[]'),
      similarity: e.similarity,
      createdAt: e.created_at,
    }));
  }

  /**
   * Get knowledge relevant to a specific goal's context.
   * Used by workers during execution to learn from past experience.
   *
   * @param {string} goalId - The goal ID to find related knowledge for.
   * @param {object} [options]
   * @param {number} [options.limit=5] - Maximum number of entries to return.
   * @returns {Array<{ id: string, title: string, content: string, category: string }>}
   */
  getRelevantForGoal(goalId, { limit = 5 } = {}) {
    const entries = this.#store.listKnowledge({ limit: 1000 });
    return entries
      .filter(e => {
        const relatedGoals = JSON.parse(e.related_goals || '[]');
        return relatedGoals.includes(goalId);
      })
      .slice(0, limit)
      .map(e => ({
        id: e.id,
        title: e.title,
        content: e.content,
        category: e.category,
      }));
  }

  /**
   * Learn from a completed goal: extract key decisions and patterns.
   * This is called after a goal completes to capture learnings.
   *
   * @param {string} goalId - The goal to extract knowledge from.
   * @param {object} store - The data store that holds goals, tasks, events, and checkpoints.
   * @returns {Promise<Array<{ id: string, title: string, category: string, tags: string[] }>>}
   */
  async learnFromGoal(goalId, store) {
    const goal = store.getGoal(goalId);
    if (!goal) return [];

    const tasks = store.getTasksForGoal(goalId);

    // Extract key decisions from checkpoints
    const checkpoints = store.getCheckpoints(goalId);
    const decisions = [];
    for (const cp of checkpoints) {
      if (cp.key_decisions) {
        try {
          const kd = JSON.parse(cp.key_decisions);
          decisions.push(...kd);
        } catch {
          // Skip malformed checkpoint decisions
        }
      }
    }

    // Create knowledge entries for significant findings
    const learnings = [];

    // 1. Architecture decision from plan tasks
    const planTasks = tasks.filter(t => t.type === 'plan' && t.result_json);
    for (const task of planTasks) {
      learnings.push(this.add({
        userId: 'system',
        title: `Architecture: ${goal.text}`,
        content: task.result_json,
        category: 'architecture',
        tags: ['auto-generated', goalId],
        relatedGoals: [goalId],
      }));
    }

    // 2. Patterns from completed implementation tasks
    const implTasks = tasks.filter(
      t => t.type === 'implement' && t.status === 'completed' && t.result_json,
    );
    if (implTasks.length > 0) {
      learnings.push(this.add({
        userId: 'system',
        title: `Implementation Pattern: ${goal.text}`,
        content: implTasks.map(t => t.result_json).join('\n---\n'),
        category: 'pattern',
        tags: ['auto-generated', goalId],
        relatedGoals: [goalId],
      }));
    }

    // 3. Gotchas from failed-then-fixed tasks
    const failedTasks = tasks.filter(t => t.retry_count > 0 || t.error_message);
    if (failedTasks.length > 0) {
      learnings.push(this.add({
        userId: 'system',
        title: `Gotchas: ${goal.text}`,
        content: failedTasks.map(t =>
          `Task: ${t.name}\nError: ${t.error_message || 'retry needed'}\nRetries: ${t.retry_count}`,
        ).join('\n---\n'),
        category: 'gotcha',
        tags: ['auto-generated', goalId],
        relatedGoals: [goalId],
      }));
    }

    return learnings;
  }

  /**
   * Compute TF-IDF vector for a text.
   * Returns an object mapping each term to its TF-IDF score.
   *
   * @param {string} text
   * @returns {Record<string, number>}
   */
  #computeTFIDF(text) {
    const tokens = this.#tokenize(text);
    const tf = {};

    // Term Frequency
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }

    // Normalize TF and apply simplified IDF
    const total = tokens.length || 1;
    const tfidf = {};
    for (const [term, count] of Object.entries(tf)) {
      // Simple TF-IDF: TF * log(1 + 1/DF) where DF is approximated as the
      // within-document count (single-document approximation).
      tfidf[term] = (count / total) * Math.log(1 + (1 / count));
    }

    return tfidf;
  }

  /**
   * Tokenize text into normalized, stop-word-filtered terms.
   *
   * @param {string} text
   * @returns {string[]}
   */
  #tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !this.#stopWords.has(t));
  }

  /**
   * Compute cosine similarity between two TF-IDF vectors.
   * Returns a value between 0 (completely dissimilar) and 1 (identical).
   *
   * @param {Record<string, number>} vecA
   * @param {Record<string, number>} vecB
   * @returns {number}
   */
  #cosineSimilarity(vecA, vecB) {
    const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const term of allTerms) {
      const a = vecA[term] || 0;
      const b = vecB[term] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Get statistics about the knowledge base.
   *
   * @returns {{ totalEntries: number, categories: Record<string, number>, users: number }}
   */
  getStats() {
    const all = this.#store.listKnowledge({ limit: 10000 });
    const categories = {};
    for (const entry of all) {
      categories[entry.category] = (categories[entry.category] || 0) + 1;
    }
    return {
      totalEntries: all.length,
      categories,
      users: new Set(all.map(e => e.user_id)).size,
    };
  }
}
