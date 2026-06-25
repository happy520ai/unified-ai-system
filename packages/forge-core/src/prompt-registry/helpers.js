/**
 * Pure helpers for PromptRegistry -- extracted to keep index.js under 500 lines.
 * @module prompt-registry/helpers
 */

// -- Type definitions ---------------------------------------------------------

/**
 * @typedef {object} PromptMetric
 * @property {string} taskId -- identifier of the task that produced this metric
 * @property {boolean} success -- whether the task completed successfully
 * @property {number} tokenUsage -- total tokens consumed (input + output)
 * @property {number} duration -- wall-clock duration in milliseconds
 * @property {number} quality -- quality score 0-100 from verification
 * @property {number} recordedAt -- epoch ms when the metric was recorded
 */

/**
 * @typedef {object} PromptEntry
 * @property {string} id -- unique identifier for this prompt version
 * @property {string} role -- worker role this prompt belongs to
 * @property {number} version -- auto-incremented version number
 * @property {string} content -- the full prompt text
 * @property {string} description -- human-readable description of this version
 * @property {string} author -- who authored this version
 * @property {string[]} tags -- free-form tags for categorisation
 * @property {number} createdAt -- epoch ms when the version was registered
 * @property {PromptMetric[]} metrics -- recorded usage metrics
 */

/**
 * @typedef {object} VersionComparison
 * @property {number} avgQuality -- average quality score (0-100)
 * @property {number} successRate -- fraction of successful runs (0-1)
 * @property {number} avgTokens -- average token usage per run
 * @property {number} avgDuration -- average duration in ms per run
 * @property {number} uses -- total number of recorded metric entries
 */

/**
 * @typedef {object} RegistryStatus
 * @property {number} roles -- number of registered roles
 * @property {number} totalVersions -- total versions across all roles
 * @property {number} activeVersions -- number of roles with an active version set
 */

// -- Constants ----------------------------------------------------------------

/** Default maximum versions to keep per role. */
export const DEFAULT_MAX_VERSIONS = 50;

/** Counter for unique id generation within this process. */
let _seqId = 0;

/**
 * Generate a unique prompt version identifier.
 * @returns {string}
 */
export function genId() {
  return `pr_${Date.now()}_${++_seqId}`;
}

// -- Pure helpers -------------------------------------------------------------

/**
 * Compute aggregated statistics from an array of metrics.
 *
 * @param {PromptMetric[]} metrics
 * @returns {VersionComparison}
 */
export function computeStats(metrics) {
  const count = metrics.length;
  if (count === 0) {
    return { avgQuality: 0, successRate: 0, avgTokens: 0, avgDuration: 0, uses: 0 };
  }

  let totalQuality = 0;
  let totalSuccess = 0;
  let totalTokens = 0;
  let totalDuration = 0;

  for (const m of metrics) {
    totalQuality += m.quality ?? 0;
    totalSuccess += m.success ? 1 : 0;
    totalTokens += m.tokenUsage ?? 0;
    totalDuration += m.duration ?? 0;
  }

  return {
    avgQuality: totalQuality / count,
    successRate: totalSuccess / count,
    avgTokens: totalTokens / count,
    avgDuration: totalDuration / count,
    uses: count,
  };
}

/**
 * Count total prompt versions across all roles.
 *
 * @param {Map<string, PromptEntry[]>} prompts
 * @returns {number}
 */
export function countTotalVersions(prompts) {
  let total = 0;
  for (const versions of prompts.values()) {
    total += versions.length;
  }
  return total;
}

/**
 * Enforce the maximum number of versions per role by evicting the oldest
 * versions.  The currently active version is never evicted.
 *
 * @param {PromptEntry[]} versions -- mutable array of version entries for one role
 * @param {number|undefined} activeVersion -- version number that must not be evicted
 * @param {number} maxVersionsPerRole -- upper bound on versions to retain
 */
export function enforceMaxVersions(versions, activeVersion, maxVersionsPerRole) {
  if (!versions || versions.length <= maxVersionsPerRole) return;

  // Sort ascending by version (oldest first)
  versions.sort((a, b) => a.version - b.version);

  // Remove oldest versions until we are within the limit, skipping the active one
  while (versions.length > maxVersionsPerRole) {
    const victimIdx = versions.findIndex((v) => v.version !== activeVersion);
    if (victimIdx === -1) break; // all remaining are the active version (edge case)
    versions.splice(victimIdx, 1);
  }
}