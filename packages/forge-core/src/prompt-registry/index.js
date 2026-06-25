/**
 * PromptRegistry -- versioned prompt management system for LLM workers.
 *
 * Manages prompt templates by role with auto-versioning, metrics, comparison,
 * rollback, and JSON persistence.
 *
 * @module prompt-registry
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DEFAULT_MAX_VERSIONS,
  genId,
  computeStats,
  countTotalVersions,
  enforceMaxVersions,
} from './helpers.js';

/**
 * @typedef {import('./helpers.js').PromptMetric} PromptMetric
 * @typedef {import('./helpers.js').PromptEntry} PromptEntry
 * @typedef {import('./helpers.js').VersionComparison} VersionComparison
 * @typedef {import('./helpers.js').RegistryStatus} RegistryStatus
 */

// =============================================================================
//  PromptRegistry
// =============================================================================

export class PromptRegistry {
  /**
   * All registered prompts organised by role.
   * Map<role, PromptEntry[]>
   * @type {Map<string, PromptEntry[]>}
   */
  #prompts = new Map();

  /**
   * Currently active version number per role.
   * Map<role, number>
   * @type {Map<string, number>}
   */
  #activeVersions = new Map();

  /** @type {string|null} file path for JSON persistence */
  #persistencePath;

  /** @type {number} maximum versions to retain per role */
  #maxVersionsPerRole;

  /**
   * Create a new PromptRegistry.
   *
   * @param {object} [opts]
   * @param {string|null} [opts.persistencePath=null] -- JSON file path for persistence
   * @param {number} [opts.maxVersionsPerRole=50] -- max versions kept per role
   */
  constructor(opts = {}) {
    this.#persistencePath = opts.persistencePath ?? null;
    this.#maxVersionsPerRole = opts.maxVersionsPerRole ?? DEFAULT_MAX_VERSIONS;
  }

  // -- Registration -----------------------------------------------------------

  /**
   * Register a new prompt version for a given role.
   *
   * The version number is auto-incremented based on existing versions for the
   * role.  If `setAsActive` is true (or this is the first version for the role),
   * the new version is automatically made the active one.
   *
   * @param {string} role -- worker role (e.g. "coder", "reviewer")
   * @param {string} content -- the full prompt text
   * @param {object} [opts]
   * @param {string} [opts.description=''] -- human-readable description
   * @param {string} [opts.author=''] -- author of this version
   * @param {string[]} [opts.tags=[]] -- free-form tags
   * @param {boolean} [opts.setAsActive] -- whether to set this as the active version
   * @returns {{ role: string, version: number, id: string }}
   */
  register(role, content, opts = {}) {
    if (!role || typeof role !== 'string') {
      throw new Error('PromptRegistry.register: "role" is required and must be a string');
    }
    if (typeof content !== 'string') {
      throw new Error('PromptRegistry.register: "content" must be a string');
    }

    if (!this.#prompts.has(role)) {
      this.#prompts.set(role, []);
    }

    const versions = this.#prompts.get(role);
    const nextVersion = versions.length > 0
      ? Math.max(...versions.map((v) => v.version)) + 1
      : 1;

    /** @type {PromptEntry} */
    const entry = {
      id: genId(),
      role,
      version: nextVersion,
      content,
      description: opts.description ?? '',
      author: opts.author ?? '',
      tags: Array.isArray(opts.tags) ? opts.tags : [],
      createdAt: Date.now(),
      metrics: [],
    };

    versions.push(entry);

    // Enforce max versions per role (evict oldest, but never the active one)
    enforceMaxVersions(versions, this.#activeVersions.get(role), this.#maxVersionsPerRole);

    // Set as active if requested or if this is the first version
    const setAsActive = opts.setAsActive ?? (versions.length === 1);
    if (setAsActive) {
      this.#activeVersions.set(role, nextVersion);
    }

    return { role, version: nextVersion, id: entry.id };
  }

  // -- Retrieval --------------------------------------------------------------

  /**
   * Get a specific prompt version by role and version number.
   *
   * @param {string} role
   * @param {number} version
   * @returns {PromptEntry|null} the prompt entry, or null if not found
   */
  get(role, version) {
    const versions = this.#prompts.get(role);
    if (!versions) return null;
    return versions.find((v) => v.version === version) ?? null;
  }

  /**
   * Get the currently active prompt for a role.
   *
   * @param {string} role
   * @returns {PromptEntry|null} the active prompt entry, or null
   */
  getActive(role) {
    const activeVersion = this.#activeVersions.get(role);
    if (activeVersion == null) return null;
    return this.get(role, activeVersion);
  }

  /**
   * Set which version is active for a given role.
   *
   * @param {string} role
   * @param {number} version
   * @returns {boolean} true if the version was found and set as active
   */
  setActive(role, version) {
    const entry = this.get(role, version);
    if (!entry) return false;
    this.#activeVersions.set(role, version);
    return true;
  }

  /**
   * List all versions for a role (summary form, without full content).
   *
   * @param {string} role
   * @returns {Array<Omit<PromptEntry, 'content'> & { contentLength: number }>}
   */
  list(role) {
    const versions = this.#prompts.get(role);
    if (!versions) return [];

    return versions.map((v) => ({
      id: v.id,
      role: v.role,
      version: v.version,
      contentLength: v.content.length,
      description: v.description,
      author: v.author,
      tags: v.tags,
      createdAt: v.createdAt,
      metricCount: v.metrics.length,
    }));
  }

  /**
   * List all registered role names.
   *
   * @returns {string[]}
   */
  listRoles() {
    return [...this.#prompts.keys()];
  }

  // -- Metrics ----------------------------------------------------------------

  /**
   * Record a usage metric for a specific prompt version.
   *
   * @param {string} role
   * @param {number} version
   * @param {object} metrics
   * @param {string} [metrics.taskId] -- task that generated this metric
   * @param {boolean} metrics.success -- whether the task succeeded
   * @param {number} [metrics.tokenUsage=0] -- total tokens consumed
   * @param {number} [metrics.duration=0] -- wall-clock duration in ms
   * @param {number} [metrics.quality=0] -- quality score 0-100
   */
  recordMetric(role, version, metrics) {
    const entry = this.get(role, version);
    if (!entry) return;

    /** @type {PromptMetric} */
    const record = {
      taskId: metrics.taskId ?? '',
      success: !!metrics.success,
      tokenUsage: metrics.tokenUsage ?? 0,
      duration: metrics.duration ?? 0,
      quality: metrics.quality ?? 0,
      recordedAt: Date.now(),
    };

    entry.metrics.push(record);
  }

  /**
   * Compare aggregated metrics between two versions of the same role.
   *
   * @param {string} role
   * @param {number} v1 -- first version number
   * @param {number} v2 -- second version number
   * @returns {{ v1: VersionComparison|null, v2: VersionComparison|null }}
   */
  compareVersions(role, v1, v2) {
    const entry1 = this.get(role, v1);
    const entry2 = this.get(role, v2);

    return {
      v1: entry1 ? computeStats(entry1.metrics) : null,
      v2: entry2 ? computeStats(entry2.metrics) : null,
    };
  }

  /**
   * Get the best performing version for a role based on a chosen metric.
   *
   * Supported metric keys: 'quality', 'successRate', 'tokens' (lower is better),
   * 'duration' (lower is better).
   *
   * @param {string} role
   * @param {string} [metric='quality'] -- the metric to rank by
   * @returns {PromptEntry|null} the best version, or null if no versions have metrics
   */
  getBestVersion(role, metric = 'quality') {
    const versions = this.#prompts.get(role);
    if (!versions || versions.length === 0) return null;

    let bestEntry = null;
    let bestValue = -Infinity;
    const lowerIsBetter = metric === 'tokens' || metric === 'duration';

    if (lowerIsBetter) bestValue = Infinity;

    for (const entry of versions) {
      if (entry.metrics.length === 0) continue;

      const stats = computeStats(entry.metrics);
      let value;

      switch (metric) {
        case 'quality':
          value = stats.avgQuality;
          break;
        case 'successRate':
          value = stats.successRate;
          break;
        case 'tokens':
          value = stats.avgTokens;
          break;
        case 'duration':
          value = stats.avgDuration;
          break;
        default:
          value = stats.avgQuality;
      }

      if (lowerIsBetter ? value < bestValue : value > bestValue) {
        bestValue = value;
        bestEntry = entry;
      }
    }

    return bestEntry;
  }

  // -- Lifecycle --------------------------------------------------------------

  /**
   * Delete a specific prompt version.
   *
   * If the deleted version was the active one, the active pointer is cleared
   * (no automatic re-selection).
   *
   * @param {string} role
   * @param {number} version
   * @returns {boolean} true if the version was found and deleted
   */
  delete(role, version) {
    const versions = this.#prompts.get(role);
    if (!versions) return false;

    const idx = versions.findIndex((v) => v.version === version);
    if (idx === -1) return false;

    versions.splice(idx, 1);

    // Clear active pointer if we just deleted the active version
    if (this.#activeVersions.get(role) === version) {
      this.#activeVersions.delete(role);
    }

    // Clean up empty roles
    if (versions.length === 0) {
      this.#prompts.delete(role);
      this.#activeVersions.delete(role);
    }

    return true;
  }

  /**
   * Rollback to the previous version for a role.
   *
   * Finds the version registered immediately before the current active version
   * and sets it as active.  If there is no previous version, returns null.
   *
   * @param {string} role
   * @returns {PromptEntry|null} the newly activated entry, or null
   */
  rollback(role) {
    const versions = this.#prompts.get(role);
    if (!versions || versions.length < 2) return null;

    const currentActive = this.#activeVersions.get(role);
    if (currentActive == null) return null;

    // Sort by version descending to find the one just before current
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    const currentIdx = sorted.findIndex((v) => v.version === currentActive);

    // Pick the next-older version (the one after current in descending order)
    const prevIdx = currentIdx + 1;
    if (prevIdx >= sorted.length) return null;

    const prev = sorted[prevIdx];
    this.#activeVersions.set(role, prev.version);
    return prev;
  }

  // -- Persistence ------------------------------------------------------------

  /**
   * Save the full registry state to the configured JSON file.
   *
   * Parent directories are created automatically.  If no persistence path was
   * configured the method is a no-op.
   *
   * @returns {Promise<{ saved: boolean, path: string|null }>}
   */
  async save() {
    if (!this.#persistencePath) {
      return { saved: false, path: null };
    }

    try {
      await mkdir(dirname(this.#persistencePath), { recursive: true });

      // Serialize prompts: convert Map to a plain object keyed by role
      const promptsObj = {};
      for (const [role, entries] of this.#prompts) {
        promptsObj[role] = entries.map((e) => ({
          id: e.id,
          role: e.role,
          version: e.version,
          content: e.content,
          description: e.description,
          author: e.author,
          tags: e.tags,
          createdAt: e.createdAt,
          metrics: e.metrics,
        }));
      }

      const payload = {
        prompts: promptsObj,
        activeVersions: Object.fromEntries(this.#activeVersions),
        savedAt: new Date().toISOString(),
      };

      await writeFile(this.#persistencePath, JSON.stringify(payload, null, 2), 'utf8');
      return { saved: true, path: this.#persistencePath };
    } catch {
      return { saved: false, path: this.#persistencePath };
    }
  }

  /**
   * Load registry state from the configured JSON file.
   *
   * If the file does not exist or is corrupt the current (empty) state is kept
   * and the method returns silently.
   *
   * @returns {Promise<{ loaded: boolean, entries: number }>}
   */
  async load() {
    if (!this.#persistencePath) {
      return { loaded: false, entries: 0 };
    }

    try {
      const raw = await readFile(this.#persistencePath, 'utf8');
      const data = JSON.parse(raw);

      // Restore prompts
      if (data.prompts && typeof data.prompts === 'object') {
        this.#prompts.clear();
        for (const [role, entries] of Object.entries(data.prompts)) {
          if (!Array.isArray(entries)) continue;
          const restored = entries.map((e) => ({
            id: e.id ?? genId(),
            role: e.role ?? role,
            version: e.version ?? 1,
            content: e.content ?? '',
            description: e.description ?? '',
            author: e.author ?? '',
            tags: Array.isArray(e.tags) ? e.tags : [],
            createdAt: e.createdAt ?? 0,
            metrics: Array.isArray(e.metrics) ? e.metrics : [],
          }));
          this.#prompts.set(role, restored);
        }
      }

      // Restore active versions
      if (data.activeVersions && typeof data.activeVersions === 'object') {
        this.#activeVersions.clear();
        for (const [role, version] of Object.entries(data.activeVersions)) {
          this.#activeVersions.set(role, version);
        }
      }

      const totalVersions = countTotalVersions(this.#prompts);
      return { loaded: true, entries: totalVersions };
    } catch {
      // File missing, unreadable, or corrupt JSON -- silently continue
      return { loaded: false, entries: 0 };
    }
  }

  // -- Status -----------------------------------------------------------------

  /**
   * Get overall registry statistics.
   *
   * @returns {RegistryStatus}
   */
  getStatus() {
    const roles = this.#prompts.size;
    const totalVersions = countTotalVersions(this.#prompts);
    const activeVersions = this.#activeVersions.size;

    return { roles, totalVersions, activeVersions };
  }

  /**
   * The configured persistence file path, or `null` if persistence is disabled.
   * @returns {string|null}
   */
  get persistencePath() {
    return this.#persistencePath;
  }
}