/**
 * skillRouter.js
 *
 * The timing/decision layer: decides WHEN a task should use a skill (from the
 * GitHub marketplace) vs. a built-in worker (coder/tester/reviewer/web...).
 *
 * Sits between the goal-compiler (which produces the task DAG) and the
 * agent-pool (which dispatches tasks to workers). For EACH task, it runs four
 * checks and produces a routing decision:
 *
 *   1. CAPABILITY BOUNDARY — does this task need an ability the 7 built-in
 *      workers don't have? (pdf, ocr, excel, email, audio, video, translate...)
 *      → if yes: STRONG signal to find a skill
 *
 *   2. LOCAL SKILL MATCH — is there an already-installed skill that matches?
 *      (fast path — no GitHub search needed)
 *      → if yes: use it directly
 *
 *   3. EFFICIENCY SIGNAL — even if coder COULD do it, would a skill be much
 *      faster/better? (verbs like "parse/convert/extract/send" + specific
 *      file types → skill likely better)
 *      → if yes: MODERATE signal to try a skill first
 *
 *   4. LEARNED FEEDBACK — has history shown this task type is faster with a
 *      skill? (query the learning ledger)
 *      → if yes: boosts the skill signal
 *
 * Output: { route, confidence, reason, skillQuery, suggestions }
 *   route: "builtin" | "local_skill" | "github_skill" | "hybrid"
 */

import { parseSkillManifest } from "./skillManifest.js";

// ── Capability boundary: domains that built-in workers can't handle ───────
// When a task touches these domains, the built-in workers (coder/tester/etc.)
// almost certainly can't do it well — they'd try to write code from scratch
// and likely fail. These are STRONG skill signals.
const CAPABILITY_BOUNDARY_DOMAINS = [
  // domain keywords → suggested skill search query
  { keywords: ["pdf", "document parse", "extract text from pdf"], query: "pdf parser extract" },
  { keywords: ["ocr", "image to text", "recognize text"], query: "ocr image text recognition" },
  { keywords: ["excel", "xlsx", "spreadsheet", "csv export"], query: "excel xlsx spreadsheet" },
  { keywords: ["word", "docx", "document generation"], query: "word docx document" },
  { keywords: ["email", "send mail", "smtp", "notification"], query: "email send smtp" },
  { keywords: ["audio", "mp3", "wav", "transcribe", "speech to text"], query: "audio transcribe speech" },
  { keywords: ["video", "mp4", "ffmpeg", "video processing"], query: "video ffmpeg processing" },
  { keywords: ["image", "resize", "thumbnail", "image processing", "compress image"], query: "image processing resize" },
  { keywords: ["translate", "translation", "i18n", "localize"], query: "translate translation" },
  { keywords: ["qr code", "barcode", "qr generate"], query: "qr code barcode" },
  { keywords: ["chart", "graph", "visualization", "plot"], query: "chart graph visualization" },
  { keywords: ["calendar", "ical", "schedule"], query: "calendar ical schedule" },
  { keywords: ["geocode", "map", "location", "latitude"], query: "geocode map location" },
  { keywords: ["compression", "zip", "gzip", "tar"], query: "compression zip archive" },
  { keywords: ["encryption", "decrypt", "encrypt", "cipher"], query: "encryption cipher" },
  { keywords: ["webhook", "slack", "discord", "notification send"], query: "webhook slack notification" },
  { keywords: ["scrape", "crawl", "spider web"], query: "web scraper crawler" },
  { keywords: ["database migration", "sql import", "data etl"], query: "database migration etl" },
];

// ── Efficiency signals: verbs + file types that favor skills ──────────────
// Even if coder could theoretically do it, a skill is likely 10x faster.
const EFFICIENCY_VERBS = [
  "parse", "extract", "convert", "transform", "export", "import",
  "generate", "render", "compress", "resize", "transcribe",
  "translate", "send", "upload", "download", "sync",
];
const EFFICIENCY_FILE_TYPES = [
  ".pdf", ".xlsx", ".xls", ".docx", ".doc", ".pptx",
  ".mp3", ".wav", ".mp4", ".avi", ".mov",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
  ".csv", ".json", ".xml", ".yaml", ".yml",
  ".zip", ".tar", ".gz",
];

// ── Task types that are ALWAYS built-in (never need skills) ───────────────
// NOTE: "implement" and "refactor" are NOT here — they CAN need a skill if
// the task touches a capability-boundary domain (PDF/OCR/Excel...). Only
// pure-code-exploration types skip skill routing entirely.
const BUILTIN_ONLY_TYPES = new Set([
  "explore", "plan", "debug", "review", "test", "verify",
]);

/**
 * Create the skill router.
 * @param {object} options
 * @param {object} options.skillRegistry — the skill registry (for local lookup)
 * @param {object} [options.learningLedger] — for learned feedback
 * @param {object} [options.logger]
 */
export function createSkillRouter(options = {}) {
  const registry = options.skillRegistry;
  const ledger = options.learningLedger || null;
  const log = options.logger || console;

  return {
    /**
     * Analyze a single task and decide its route.
     *
     * @param {object} task — { type, prompt, name, agentRole, ... }
     * @returns {Promise<{route, confidence, reason, skillQuery, suggestions}>}
     */
    async analyze(task = {}) {
      const taskText = `${task.name || ""} ${task.prompt || ""} ${task.type || ""}`.toLowerCase();
      const signals = [];

      // ── Check 0: Builtin-only task types → skip skill routing entirely ──
      if (BUILTIN_ONLY_TYPES.has(task.type) && task.type !== "web") {
        return {
          route: "builtin",
          confidence: 90,
          reason: `task type '${task.type}' is a core built-in capability — no skill needed`,
          skillQuery: null,
          suggestions: [],
        };
      }

      // ── Check 1: CAPABILITY BOUNDARY — strong signal ──
      let boundaryMatch = null;
      for (const domain of CAPABILITY_BOUNDARY_DOMAINS) {
        for (const kw of domain.keywords) {
          if (taskText.includes(kw)) {
            boundaryMatch = domain;
            break;
          }
        }
        if (boundaryMatch) break;
      }
      if (boundaryMatch) {
        signals.push({ check: "capability_boundary", strength: "strong", query: boundaryMatch.query });
      }

      // ── Check 2: LOCAL SKILL MATCH — check installed skills ──
      let localMatch = null;
      if (registry) {
        try {
          const installed = await registry.list();
          for (const skill of installed.skills) {
            const skillText = `${skill.name} ${skill.description || ""}`.toLowerCase();
            // Check if the task text mentions the skill name or its keywords
            if (taskText.includes(skill.name.toLowerCase()) ||
                (skill.description && taskText.includes(skill.description.toLowerCase().slice(0, 20)))) {
              localMatch = skill;
              break;
            }
          }
        } catch { /* registry not available — skip */ }
      }
      if (localMatch) {
        signals.push({ check: "local_skill_match", strength: "strong", skillName: localMatch.name });
      }

      // ── Check 3: EFFICIENCY SIGNAL — moderate signal ──
      const hasEfficiencyVerb = EFFICIENCY_VERBS.some((v) => taskText.includes(v));
      const hasEfficiencyFileType = EFFICIENCY_FILE_TYPES.some((ft) => taskText.includes(ft));
      if (hasEfficiencyVerb && hasEfficiencyFileType) {
        // Both a "do X to Y" verb AND a specific file type → skill is likely much faster
        signals.push({ check: "efficiency_signal", strength: "moderate" });
      } else if (hasEfficiencyVerb && (taskText.includes("file") || taskText.includes("data"))) {
        signals.push({ check: "efficiency_signal", strength: "weak" });
      }

      // ── Check 4: LEARNED FEEDBACK — boost from history ──
      let learnedBoost = 0;
      if (ledger) {
        try {
          // Check if similar tasks in the past benefited from skills
          const summary = await ledger.getSummary();
          for (const skillStat of summary.skills) {
            if (skillStat.successRate >= 80 && taskText.includes(skillStat.name.toLowerCase().split("-")[0])) {
              learnedBoost += 1;
              signals.push({ check: "learned_feedback", strength: "moderate", skillName: skillStat.name, successRate: skillStat.successRate });
            }
          }
        } catch { /* ledger not available — skip */ }
      }

      // ── Decision: combine signals into a route ──
      return decideRoute(task, signals, boundaryMatch, localMatch, learnedBoost);
    },

    /**
     * Analyze an entire task DAG — returns routing for each task.
     * Tasks that route to skills get a `skillQuery` field; the orchestrator
     * can then autoAcquire those skills before dispatching.
     *
     * @param {Array} tasks — task DAG from goal-compiler
     * @returns {Promise<{routes, summary}>}
     */
    async analyzeDag(tasks = []) {
      const routes = [];
      for (const task of tasks) {
        const route = await this.analyze(task);
        routes.push({ taskId: task.id, taskName: task.name, ...route });
      }

      const summary = {
        total: tasks.length,
        builtin: routes.filter((r) => r.route === "builtin").length,
        localSkill: routes.filter((r) => r.route === "local_skill").length,
        githubSkill: routes.filter((r) => r.route === "github_skill").length,
        hybrid: routes.filter((r) => r.route === "hybrid").length,
        skillQueries: [...new Set(routes.filter((r) => r.skillQuery).map((r) => r.skillQuery))],
      };

      log.info?.(`[skillRouter] DAG routing: ${summary.builtin} builtin, ${summary.localSkill} local skill, ${summary.githubSkill} github skill, ${summary.hybrid} hybrid`);
      if (summary.skillQueries.length > 0) {
        log.info?.(`[skillRouter] skills to acquire: ${summary.skillQueries.join(", ")}`);
      }

      return { routes, summary };
    },
  };
}

/**
 * Combine signals into a routing decision.
 */
function decideRoute(task, signals, boundaryMatch, localMatch, learnedBoost) {
  const strongSignals = signals.filter((s) => s.strength === "strong");
  const moderateSignals = signals.filter((s) => s.strength === "moderate");

  // LOCAL SKILL MATCH is the strongest — we already have the right tool installed
  if (localMatch) {
    return {
      route: "local_skill",
      confidence: 95,
      reason: `local skill '${localMatch.name}' matches this task`,
      skillQuery: null,
      skillName: localMatch.name,
      suggestions: [`Use installed skill '${localMatch.name}' for this task`],
      signals,
    };
  }

  // CAPABILITY BOUNDARY + (efficiency or learned) → definitely find a skill
  if (boundaryMatch && (moderateSignals.length > 0 || learnedBoost > 0)) {
    return {
      route: "github_skill",
      confidence: 85,
      reason: `task requires '${boundaryMatch.query}' which is outside built-in worker capabilities`,
      skillQuery: boundaryMatch.query,
      suggestions: [`autoAcquire('${boundaryMatch.query}') before executing this task`],
      signals,
    };
  }

  // CAPABILITY BOUNDARY alone (strong signal, no boost) → still find a skill
  if (boundaryMatch) {
    return {
      route: "github_skill",
      confidence: 75,
      reason: `task touches '${boundaryMatch.query}' domain — built-in workers likely can't handle this well`,
      skillQuery: boundaryMatch.query,
      suggestions: [`Try autoAcquire('${boundaryMatch.query}') — fall back to builtin worker if no skill found`],
      signals,
    };
  }

  // EFFICIENCY SIGNAL only (moderate) → hybrid: try skill first, fall back to coder
  if (moderateSignals.some((s) => s.check === "efficiency_signal")) {
    // Derive a query from the task text
    const query = deriveQueryFromTask(task);
    return {
      route: "hybrid",
      confidence: 55,
      reason: `task has efficiency signal (specialized verb + file type) — a skill may be faster, but built-in worker can handle it`,
      skillQuery: query,
      suggestions: [`Try autoAcquire('${query}') first; if it fails, use the built-in worker`],
      signals,
    };
  }

  // LEARNED FEEDBACK only → weak hybrid
  if (learnedBoost > 0) {
    const query = deriveQueryFromTask(task);
    return {
      route: "hybrid",
      confidence: 45,
      reason: `learned feedback suggests a skill was effective for similar past tasks`,
      skillQuery: query,
      suggestions: [`Consider autoAcquire('${query}') based on past success`],
      signals,
    };
  }

  // No signals → use built-in worker
  return {
    route: "builtin",
    confidence: 80,
    reason: "no skill signals detected — task is within built-in worker capabilities",
    skillQuery: null,
    suggestions: [],
    signals,
  };
}

/**
 * Derive a skill search query from task text (used when we have efficiency
 * signals but no explicit capability-boundary match).
 */
function deriveQueryFromTask(task) {
  const text = `${task.name || ""} ${task.prompt || ""}`.toLowerCase();
  // Extract the most relevant keywords (nouns + file types)
  const fileTypes = EFFICIENCY_FILE_TYPES.filter((ft) => text.includes(ft));
  const verbs = EFFICIENCY_VERBS.filter((v) => text.includes(v));
  const parts = [...verbs.slice(0, 1), ...fileTypes.slice(0, 1)];
  return parts.length > 0 ? parts.join(" ") : (task.name || task.type || "tool").slice(0, 40);
}
