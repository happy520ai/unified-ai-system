/**
 * SessionMemory — Multi-session persistent memory for the agentic loop.
 * Remembers successful patterns, error recovery strategies, and task summaries.
 *
 * @module sessionMemory
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";

const DEFAULT_MEMORY_DIR = ".agent-memory";
const MAX_ENTRIES = 1000;

export function createSessionMemory(options = {}) {
  const memoryDir = options.memoryDir || join(process.cwd(), DEFAULT_MEMORY_DIR);
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;

  // In-memory store
  const entries = [];
  const patterns = new Map(); // pattern key → { count, lastUsed, successRate }

  // Lazy-loaded promise: disk read happens on first access, not at construction.
  // Using a promise instead of a boolean flag prevents TOCTOU races when
  // multiple callers invoke _ensureLoaded() concurrently before I/O completes.
  let _loadPromise = null;

  async function _ensureLoaded() {
    if (!_loadPromise) {
      _loadPromise = (async () => {
        try {
          const memFile = join(memoryDir, "session-memory.json");
          await access(memFile, fsConstants.F_OK);
          const data = JSON.parse(await readFile(memFile, "utf-8"));
          if (Array.isArray(data.entries)) {
            for (const e of data.entries) { entries.push(e); }
          }
          if (data.patterns && typeof data.patterns === "object") {
            for (const [k, v] of Object.entries(data.patterns)) {
              patterns.set(k, v);
            }
          }
        } catch (err) {
          // Memory load failure is non-fatal but should be visible
          if (process.env.DEBUG_AGENT_MEMORY) {
            console.warn(`[sessionMemory] Load failed: ${err?.message || err}`);
          }
        }
      })();
    }
    return _loadPromise;
  }

  async function _saveToDisk() {
    try {
      await mkdir(memoryDir, { recursive: true });
      const data = {
        entries: entries.slice(-maxEntries),
        patterns: Object.fromEntries(patterns),
        savedAt: new Date().toISOString(),
      };
      await writeFile(join(memoryDir, "session-memory.json"), JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      // Memory save failure is non-fatal but should be visible
      if (process.env.DEBUG_AGENT_MEMORY) {
        console.warn(`[sessionMemory] Save failed: ${err?.message || err}`);
      }
    }
  }

  return {
    /**
     * Record a task outcome for future reference.
     */
    async recordOutcome({ goal, status, toolSequence, durationMs, iterationCount, keyFindings }) {
      await _ensureLoaded();
      const entry = {
        id: entries.length + 1,
        goal: goal.slice(0, 200),
        status,
        toolSequence: Array.isArray(toolSequence) ? toolSequence.slice(0, 20) : [],
        durationMs,
        iterationCount,
        keyFindings: Array.isArray(keyFindings) ? keyFindings.slice(0, 10) : [],
        recordedAt: new Date().toISOString(),
      };
      entries.push(entry);

      // Trim if over limit
      while (entries.length > maxEntries) { entries.shift(); }

      // Update pattern tracking
      const patternKey = _extractPattern(goal, toolSequence);
      if (patternKey) {
        const existing = patterns.get(patternKey) || { count: 0, successes: 0, lastUsed: null };
        existing.count++;
        if (status === "completed") existing.successes++;
        existing.lastUsed = new Date().toISOString();
        existing.successRate = existing.count > 0 ? existing.successes / existing.count : 0;
        patterns.set(patternKey, existing);
      }

      return entry;
    },

    /**
     * Recall relevant past experiences for a new goal.
     */
    async recallRelevant(goal, limit = 5) {
      await _ensureLoaded();
      if (entries.length === 0) return [];

      const goalTerms = _tokenize(goal);
      const scored = entries.map(entry => {
        const entryTerms = _tokenize(entry.goal);
        const overlap = goalTerms.filter(t => entryTerms.includes(t)).length;
        const score = overlap / Math.max(goalTerms.length, 1);
        return { entry, score };
      });

      return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => ({
          goal: s.entry.goal,
          status: s.entry.status,
          toolSequence: s.entry.toolSequence,
          relevanceScore: Math.round(s.score * 100) / 100,
        }));
    },

    /**
     * Get the most successful patterns.
     */
    getTopPatterns(limit = 10) {
      return [...patterns.entries()]
        .map(([key, data]) => ({ pattern: key, ...data }))
        .sort((a, b) => (b.successRate || 0) - (a.successRate || 0))
        .slice(0, limit);
    },

    /**
     * Build a memory context prompt to inject into the system prompt.
     */
    async buildMemoryPrompt(goal) {
      await _ensureLoaded();
      const relevant = await this.recallRelevant(goal, 3);
      const topPatterns = this.getTopPatterns(5);

      if (relevant.length === 0 && topPatterns.length === 0) return null;

      let prompt = "## Session Memory\n";
      if (relevant.length > 0) {
        prompt += "Relevant past experiences:\n";
        for (const r of relevant) {
          prompt += `- [${r.status}] "${r.goal}" — tools: ${r.toolSequence.join(", ") || "none"}\n`;
        }
      }
      if (topPatterns.length > 0) {
        prompt += "Successful patterns:\n";
        for (const p of topPatterns) {
          prompt += `- ${p.pattern}: ${p.count} uses, ${Math.round((p.successRate || 0) * 100)}% success\n`;
        }
      }
      return prompt;
    },

    /**
     * Persist current memory to disk.
     */
    async save() {
      await _ensureLoaded();
      await _saveToDisk();
    },

    /**
     * Get memory statistics.
     */
    async getStats() {
      await _ensureLoaded();
      return {
        totalEntries: entries.length,
        totalPatterns: patterns.size,
        maxEntries,
        memoryDir,
      };
    },

    /**
     * Clear all memory.
     */
    clear() {
      entries.length = 0;
      patterns.clear();
    },
  };
}

function _extractPattern(goal, toolSequence) {
  if (!goal || !Array.isArray(toolSequence) || toolSequence.length === 0) return null;
  const goalPrefix = goal.split(" ").slice(0, 3).join(" ").toLowerCase();
  const toolSummary = toolSequence.slice(0, 5).join("→");
  return `${goalPrefix}|${toolSummary}`;
}

function _tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2);
}
