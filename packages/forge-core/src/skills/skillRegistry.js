/**
 * skillRegistry.js
 *
 * The unified skill registry — forge's entry point for discovering, installing,
 * and executing skills from GitHub (or locally). This is what makes forge
 * infinitely extensible: instead of being limited to 7 built-in workers,
 * forge can now pull ANY capability from GitHub on demand.
 *
 * API:
 *   const registry = createSkillRegistry({ skillsDir, token });
 *   await registry.search("pdf parser");           // search GitHub
 *   await registry.install(repoUrl);                // install a skill
 *   await registry.list();                          // list installed skills
 *   await registry.execute("pdf-parser", input);    // run a skill
 *   await registry.autoAcquire("parse this PDF");   // search + install + execute in one call
 *
 * The registry caches installed skills in .forge/skills/. On first execute(),
 * the skill module is dynamically imported and its execute() function cached.
 */

import { mkdir, readFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { searchSkills, fetchSkillManifest } from "./githubSkillSearcher.js";
import { installSkill } from "./skillInstaller.js";
import { parseSkillManifest } from "./skillManifest.js";
import { rankCandidates } from "./skillScorer.js";
import { filterByTrust } from "./skillTrustFilter.js";
import { createSkillLearningLedger } from "./skillLearningLedger.js";

/**
 * @param {object} options
 * @param {string} options.skillsDir — where to install skills (usually .forge/skills/)
 * @param {string} [options.token] — GitHub token
 * @param {object} [options.logger]
 */
export function createSkillRegistry(options = {}) {
  const skillsDir = resolve(options.skillsDir || ".forge/skills");
  const token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const log = options.logger || console;

  // In-memory cache of loaded skill modules: name → { module, manifest, path }
  const loaded = new Map();

  // Strategy layer: learning ledger (records which skills worked well)
  const ledger = options.learningLedger || createSkillLearningLedger({
    ledgerPath: resolve(skillsDir, "..", "skill-ledger.json"),
  });

  return {
    getInfo() {
      return { skillsDir, hasToken: Boolean(token), loadedCount: loaded.size };
    },

    /**
     * Search GitHub for skills matching keywords.
     */
    async search(query, opts = {}) {
      const result = await searchSkills({ query, token, limit: opts.limit || 10 });
      return result;
    },

    /**
     * Install a skill from a GitHub repo URL.
     */
    async install(repoUrl, opts = {}) {
      const result = await installSkill({
        repoUrl,
        skillsDir,
        token,
        skillPath: opts.skillPath,
        branch: opts.branch,
        skipScan: opts.skipScan || false,
      });
      if (result.success) {
        log.info?.(`[skills] installed '${result.skillName}' to ${result.skillDir}`);
      }
      return result;
    },

    /**
     * List all locally installed skills (in skillsDir).
     */
    async list() {
      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });
        const skills = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const skillDir = join(skillsDir, entry.name);
          try {
            const md = await readFile(join(skillDir, "SKILL.md"), "utf8");
            const manifest = parseSkillManifest(md);
            skills.push({
              name: manifest.name || entry.name,
              version: manifest.version,
              description: manifest.description,
              category: manifest.category,
              permissions: manifest.permissions,
              installed: true,
              dir: skillDir,
            });
          } catch {
            // dir exists but no valid SKILL.md — skip
          }
        }
        return { skills, count: skills.length };
      } catch {
        return { skills: [], count: 0 };
      }
    },

    /**
     * Execute an installed skill by name.
     * @param {string} skillName — installed skill name
     * @param {object} input — input parameters for the skill
     * @returns {Promise<{success, output, skillName, error}>}
     */
    async execute(skillName, input = {}) {
      // Load the skill module (cached)
      let skillEntry = loaded.get(skillName);
      if (!skillEntry) {
        const skillDir = join(skillsDir, skillName);
        const indexPath = join(skillDir, "index.js");
        try {
          await access(indexPath);
        } catch {
          return { success: false, error: `skill '${skillName}' not found. Install it first.`, skillName };
        }

        // Read manifest
        let manifest;
        try {
          const md = await readFile(join(skillDir, "SKILL.md"), "utf8");
          manifest = parseSkillManifest(md);
        } catch {
          manifest = { name: skillName, valid: false };
        }

        // Dynamically import the skill module
        try {
          const moduleUrl = pathToFileURL(indexPath).href;
          const mod = await import(moduleUrl);
          if (typeof mod.execute !== "function") {
            return { success: false, error: `skill '${skillName}' does not export an execute() function`, skillName };
          }
          skillEntry = { module: mod, manifest, path: skillDir };
          loaded.set(skillName, skillEntry);
        } catch (err) {
          return { success: false, error: `failed to load skill '${skillName}': ${err.message}`, skillName };
        }
      }

      // Validate inputs against manifest
      if (skillEntry.manifest?.inputs?.length > 0) {
        for (const inp of skillEntry.manifest.inputs) {
          if (inp.required && !(inp.name in input)) {
            return { success: false, error: `missing required input: ${inp.name}`, skillName };
          }
        }
      }

      // Execute!
      try {
        const output = await skillEntry.module.execute(input, {
          skillName,
          skillsDir,
          logger: log,
        });
        return { success: true, output, skillName };
      } catch (err) {
        return { success: false, error: `skill '${skillName}' execution failed: ${err.message}`, skillName };
      }
    },

    /**
     * AUTO-ACQUIRE: the killer feature, now with full strategy.
     *
     * Pipeline:
     *   1. Check if already installed locally → execute directly
     *   2. Search GitHub for candidates
     *   3. TRUST FILTER: remove untrusted (spam, no license, too new)
     *   4. SCORE: rank by relevance/stars/recency/license/language/simplicity
     *   5. LEARN: apply learned adjustments (proven skills boost, failed skills penalized)
     *   6. PICK TOP-3 (not just top-1)
     *   7. FALLBACK: try each in order — first that installs + executes wins
     *   8. LEARN: record the outcome for next time
     *
     * @param {object} options
     * @param {string} options.query — what capability is needed
     * @param {object} [options.input] — input to pass to the skill
     * @param {string} [options.preferRepo] — prefer a specific repo
     * @param {number} [options.maxAttempts=3] — how many top candidates to try
     * @returns {Promise<{success, output, skillName, installed, searchResults, strategy}>}
     */
    async autoAcquire(options = {}) {
      const { query, input = {}, preferRepo, maxAttempts = 3 } = options;

      // Step 1: check if already installed locally
      const installed = await this.list();
      const existing = installed.skills.find((s) =>
        s.name === query ||
        s.name.includes(query) ||
        (s.description && s.description.toLowerCase().includes(query.toLowerCase()))
      );
      if (existing) {
        log.info?.(`[skills] '${query}' already installed as '${existing.name}' — executing`);
        const result = await this.execute(existing.name, input);
        // Record outcome in learning ledger
        await ledger.record({
          skillName: existing.name, query, success: result.success,
          error: result.error, qualityScore: result.success ? 70 : null,
        });
        return { ...result, installed: false, autoAcquired: true, strategy: { source: "local_cache" } };
      }

      // Step 2: search GitHub
      log.info?.(`[skills] searching GitHub for: ${query}`);
      const searchResult = await this.search(query, { limit: 10 });
      if (searchResult.error || searchResult.results.length === 0) {
        return { success: false, error: searchResult.error || `no skills found for '${query}'`, searchResults: [] };
      }

      // Step 3: TRUST FILTER — remove untrusted candidates
      const trusted = filterByTrust(searchResult.results, { includeUntrusted: false });
      if (trusted.length === 0) {
        log.info?.(`[skills] all ${searchResult.results.length} candidates failed trust filter`);
        return {
          success: false,
          error: `found ${searchResult.results.length} candidates but none passed trust filter`,
          searchResults: searchResult.results,
          strategy: { source: "github", trustFiltered: 0 },
        };
      }

      // Step 4: SCORE — rank by multi-dimensional score
      let ranked = rankCandidates(trusted, query);

      // Step 5: LEARN — apply learned adjustments
      for (const candidate of ranked) {
        const adjustment = await ledger.getLearnedAdjustment(candidate, query);
        candidate.scoreInfo.score = Math.max(0, Math.min(100, candidate.scoreInfo.score + adjustment));
        candidate.scoreInfo.learnedAdjustment = adjustment;
      }
      // Re-sort after adjustments
      ranked.sort((a, b) => b.scoreInfo.score - a.scoreInfo.score);

      // If preferRepo specified, boost it to the top
      if (preferRepo) {
        const preferred = ranked.find((r) => r.repoUrl === preferRepo || r.repoName === preferRepo);
        if (preferred) {
          ranked = [preferred, ...ranked.filter((r) => r !== preferred)];
        }
      }

      // Step 6: PICK TOP-N
      const topCandidates = ranked.slice(0, maxAttempts);
      log.info?.(`[skills] top ${topCandidates.length} candidates: ` +
        topCandidates.map((c) => `${c.repoName}(${c.scoreInfo.score})`).join(", "));

      // Step 7: FALLBACK — try each candidate in order
      const attempts = [];
      for (const candidate of topCandidates) {
        const attempt = { repoName: candidate.repoName, score: candidate.scoreInfo.score, recommendation: candidate.scoreInfo.recommendation };

        // Install
        log.info?.(`[skills] trying '${candidate.repoName}' (score ${candidate.scoreInfo.score})...`);
        const installResult = await this.install(candidate.repoUrl, { skillPath: candidate.skillPath });
        if (!installResult.success) {
          attempt.status = "install_failed";
          attempt.error = installResult.error;
          attempts.push(attempt);
          log.info?.(`[skills] install failed for '${candidate.repoName}': ${installResult.error}`);
          continue; // try next candidate
        }

        // Execute
        const execResult = await this.execute(installResult.skillName, input);
        attempt.skillName = installResult.skillName;
        attempt.status = execResult.success ? "success" : "exec_failed";
        attempt.error = execResult.error;
        attempts.push(attempt);

        if (execResult.success) {
          // Step 8: LEARN — record success
          log.info?.(`[skills] SUCCESS with '${installResult.skillName}' from '${candidate.repoName}'`);
          await ledger.record({
            skillName: installResult.skillName,
            repoName: candidate.repoName,
            query,
            success: true,
            qualityScore: 75, // default; caller can provide better signal
          });
          return {
            ...execResult,
            installed: true,
            autoAcquired: true,
            searchResults: searchResult.results,
            strategy: {
              source: "github",
              candidatesEvaluated: ranked.length,
              trustFiltered: searchResult.results.length - trusted.length,
              attempts,
              winner: candidate.repoName,
              winnerScore: candidate.scoreInfo.score,
            },
          };
        }

        // Execution failed — record failure and try next
        await ledger.record({
          skillName: installResult.skillName,
          repoName: candidate.repoName,
          query,
          success: false,
          error: execResult.error,
        });
        log.info?.(`[skills] execution failed for '${installResult.skillName}': ${execResult.error}`);
      }

      // All candidates exhausted
      return {
        success: false,
        error: `all ${attempts.length} candidates failed`,
        searchResults: searchResult.results,
        strategy: {
          source: "github",
          candidatesEvaluated: ranked.length,
          trustFiltered: searchResult.results.length - trusted.length,
          attempts,
          winner: null,
        },
      };
    },

    /**
     * Get the learning ledger summary (which skills worked well historically).
     */
    async getLearningSummary() {
      return ledger.getSummary();
    },
  };
}
