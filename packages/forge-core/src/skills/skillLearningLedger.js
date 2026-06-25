/**
 * skillLearningLedger.js
 *
 * The learning layer: records which skills worked well (or didn't) so the
 * strategy improves over time. On every autoAcquire execution, we record:
 *   - skillName + repoName + query
 *   - success/failure
 *   - execution duration
 *   - output quality (if the caller provides a quality signal)
 *
 * On the next search, previously-successful skills for similar queries get a
 * score boost (they've proven themselves); previously-failed skills get
 * penalized or skipped entirely.
 *
 * Persistence: .forge/skill-ledger.json (atomic write, survives restarts).
 */

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";

const DEFAULT_LEDGER_PATH = resolve(process.cwd(), ".forge", "skill-ledger.json");
const MAX_ENTRIES = 500; // keep last 500 records

/**
 * @param {object} [options]
 * @param {string} [options.ledgerPath]
 */
export function createSkillLearningLedger(options = {}) {
  const ledgerPath = resolve(options.ledgerPath || DEFAULT_LEDGER_PATH);

  return {
    getInfo() {
      return { ledgerPath };
    },

    /**
     * Record an execution outcome.
     * @param {object} entry
     * @param {string} entry.skillName
     * @param {string} entry.repoName
     * @param {string} entry.query — original search query
     * @param {boolean} entry.success
     * @param {number} [entry.durationMs]
     * @param {number} [entry.qualityScore] — 0-100, optional caller-provided quality
     * @param {string} [entry.error] — error message if failed
     */
    async record(entry = {}) {
      const store = await readLedger(ledgerPath);
      const record = {
        skillName: entry.skillName || "unknown",
        repoName: entry.repoName || "",
        query: entry.query || "",
        success: Boolean(entry.success),
        durationMs: entry.durationMs || 0,
        qualityScore: entry.qualityScore ?? null,
        error: entry.error || null,
        recordedAt: new Date().toISOString(),
      };
      store.records.push(record);
      // Trim to max
      if (store.records.length > MAX_ENTRIES) {
        store.records = store.records.slice(-MAX_ENTRIES);
      }
      await writeLedger(ledgerPath, store);
      return record;
    },

    /**
     * Get the learned score adjustment for a candidate skill.
     * Returns a number to ADD to the base score (positive = proven good, negative = proven bad).
     * @param {object} candidate — { repoName, skillName? }
     * @param {string} [query] — optional query (used only for additional context, NOT for matching — matching is by repo/skill identity to avoid cross-contamination)
     * @returns {number} — adjustment (-30 to +20)
     */
    async getLearnedAdjustment(candidate, query = "") {
      const store = await readLedger(ledgerPath);
      const repoName = candidate.repoName || "";
      const skillName = candidate.skillName || "";

      // Match ONLY by repo name or skill name (NOT by query) — matching by query
      // would mix outcomes from different skills that happen to answer the same query.
      const relevant = store.records.filter((r) =>
        (repoName && r.repoName === repoName) ||
        (skillName && r.skillName === skillName)
      );

      if (relevant.length === 0) return 0; // no history = neutral

      const successes = relevant.filter((r) => r.success).length;
      const failures = relevant.length - successes;
      const ratio = successes / relevant.length;

      // Calculate adjustment:
      //   100% success → +20 (proven reliable)
      //   50% success → 0 (mixed)
      //   0% success → -30 (proven unreliable, strong penalty)
      let adjustment = Math.round((ratio - 0.5) * 50);
      // Clamp
      adjustment = Math.max(-30, Math.min(20, adjustment));

      // Quality bonus: if we have quality scores, factor them in
      const qualityRecords = relevant.filter((r) => r.qualityScore != null && r.success);
      if (qualityRecords.length > 0) {
        const avgQuality = qualityRecords.reduce((s, r) => s + r.qualityScore, 0) / qualityRecords.length;
        if (avgQuality >= 80) adjustment += 5;
        else if (avgQuality < 40) adjustment -= 5;
      }

      return Math.max(-30, Math.min(25, adjustment));
    },

    /**
     * Get a summary of learned history (for UI / debugging).
     */
    async getSummary() {
      const store = await readLedger(ledgerPath);
      const records = store.records;
      const bySkill = {};
      for (const r of records) {
        const key = r.skillName || r.repoName || "unknown";
        if (!bySkill[key]) bySkill[key] = { name: key, total: 0, success: 0, fail: 0, avgQuality: 0, qualityCount: 0 };
        bySkill[key].total++;
        if (r.success) bySkill[key].success++;
        else bySkill[key].fail++;
        if (r.qualityScore != null && r.success) {
          bySkill[key].avgQuality += r.qualityScore;
          bySkill[key].qualityCount++;
        }
      }
      const summary = Object.values(bySkill).map((s) => ({
        ...s,
        successRate: s.total > 0 ? Math.round((s.success / s.total) * 100) : 0,
        avgQuality: s.qualityCount > 0 ? Math.round(s.avgQuality / s.qualityCount) : null,
      }));
      summary.sort((a, b) => b.total - a.total);
      return { totalRecords: records.length, skills: summary };
    },

    /**
     * Clear all learning history (reset).
     */
    async clear() {
      await writeLedger(ledgerPath, { records: [], version: 1 });
      return { cleared: true };
    },
  };
}

// --- persistence helpers ---

async function readLedger(ledgerPath) {
  try {
    const parsed = JSON.parse(await readFile(ledgerPath, "utf8"));
    return {
      version: parsed.version || 1,
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch (err) {
    if (err?.code === "ENOENT") return { version: 1, records: [] };
    throw err;
  }
}

async function writeLedger(ledgerPath, store) {
  await mkdir(dirname(ledgerPath), { recursive: true });
  store.updatedAt = new Date().toISOString();
  const tmp = `${ledgerPath}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tmp, ledgerPath);
}
