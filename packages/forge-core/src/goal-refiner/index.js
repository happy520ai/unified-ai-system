/**
 * Forge Goal Refiner — enhanced goal compiler with deep codebase probing,
 * goal clarity analysis, iterative DAG refinement, and quality scoring.
 *
 * Pipeline:
 *   1. Deep codebase probe: build a CodebaseProfile (frameworks, language,
 *      module system, monorepo detection, entry points, file-type counts).
 *   2. Goal clarity analysis: score specificity, detect conflicts with existing
 *      patterns, assess scope, produce clarification questions (non-blocking).
 *   3. First LLM pass: generate an initial DAG with rich codebase context.
 *   4. Second LLM pass: review the DAG (missing deps, file collisions, missing
 *      test/verify tasks, scope realism) and merge feedback into a refined DAG.
 *   5. Quality scoring: structure, coverage, parallelism, testCoverage, overall.
 *
 * Backward-compatible:
 *   compileGoalV2(store, { goalText, projectRoot }) returns { goalId, taskCount, summary }
 *   just like the original compileGoal.
 */

import { buildDAG } from '../goal-compiler/dag-builder.js';
import { callLLM } from '../llm-client.js';
import {
  probeCodebaseDeep,
  analyzeGoalClarity,
} from './helpers.js';
import {
  buildInitialPrompt,
  buildReviewPrompt,
  parseJsonFromLLM,
  mergeReviewIntoDAG,
  scoreDAG,
  DAG_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
} from './helpers-advanced.js';

// ── GoalRefiner Class ─────────────────────────────────────────────────────

/**
 * Enhanced goal compiler. Produces rich metadata alongside the stored DAG.
 *
 * Usage:
 *   const refiner = new GoalRefiner();
 *   const result = await refiner.refine(store, { goalText, projectRoot });
 */
export class GoalRefiner {
  /** @type {boolean} */
  #enableReview;

  /** @type {number} */
  #maxTokens;

  /** @type {number} */
  #temperature;

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.enableReview=true]  — run the second "review" LLM pass
   * @param {number}  [opts.maxTokens=16384]
   * @param {number}  [opts.temperature=0.1]
   */
  constructor(opts = {}) {
    this.#enableReview = opts.enableReview !== false;
    this.#maxTokens = opts.maxTokens ?? 16384;
    this.#temperature = opts.temperature ?? 0.1;
  }

  /**
   * Run the full refinement pipeline and persist the DAG in the TaskStore.
   *
   * @param {import('../task-store/index.js').TaskStore} store
   * @param {{ goalText: string, projectRoot: string }} args
   * @returns {Promise<{
   *   goalId: string,
   *   taskCount: number,
   *   summary: string,
   *   codebaseProfile: import('./helpers.js').CodebaseProfile,
   *   clarityScore: number,
   *   qualityScores: import('./helpers.js').QualityScores,
   *   clarifications: string[],
   *   dagVersion: 1|2,
   * }>}
   */
  async refine(store, { goalText, projectRoot }) {
    const goalId = store.createGoal({
      text: goalText, projectRoot, budget: { maxMinutes: 120 },
    });
    store.logEvent(goalId, null, 'goal_created', { text: goalText });

    // ── Step 1: Deep codebase probe ────────────────────────────────────
    console.log('[forge:refiner] Probing codebase (deep)...');
    const profile = await probeCodebaseDeep(projectRoot);
    console.log(`[forge:refiner] Codebase: ${profile.totalFileCount} files, ` +
      `frameworks=[${profile.frameworks.join(',')}], ` +
      `test=[${profile.testFrameworks.join(',')}], ` +
      `moduleSystem=${profile.moduleSystem}, monorepo=${profile.monorepo}`);

    // ── Step 2: Goal clarity analysis ──────────────────────────────────
    const clarity = analyzeGoalClarity(goalText, profile);
    console.log(`[forge:refiner] Clarity score: ${clarity.score}/100 (${clarity.scopeHint})`);
    if (clarity.clarifications.length > 0) {
      console.log('[forge:refiner] Clarification notes:');
      for (const q of clarity.clarifications) console.log(`  - ${q}`);
    }

    // ── Step 3: First LLM pass — initial DAG ───────────────────────────
    console.log('[forge:refiner] Generating initial DAG (LLM pass 1)...');
    const initialUserPrompt = buildInitialPrompt(goalText, profile, clarity);
    const initialRaw = await callLLM(DAG_SYSTEM_PROMPT, initialUserPrompt, {
      maxTokens: this.#maxTokens, temperature: this.#temperature,
    });

    const initialDag = parseJsonFromLLM(initialRaw);
    if (!initialDag || !Array.isArray(initialDag.tasks) || initialDag.tasks.length === 0) {
      store.updateGoalStatus(goalId, 'failed');
      store.logEvent(goalId, null, 'compile_failed', {
        error: 'No parseable DAG in LLM response',
        rawResponse: (initialRaw || '').slice(0, 2000),
      });
      throw new Error(`GoalRefiner: failed to parse initial DAG.\n\nRaw:\n${(initialRaw || '').slice(0, 1000)}`);
    }

    let finalDag = initialDag;
    let dagVersion = /** @type {1|2} */ (1);

    // ── Step 4: Second LLM pass — review + merge ───────────────────────
    if (this.#enableReview) {
      try {
        console.log('[forge:refiner] Reviewing DAG (LLM pass 2)...');
        const reviewPrompt = buildReviewPrompt(goalText, initialDag, profile);
        const reviewRaw = await callLLM(REVIEW_SYSTEM_PROMPT, reviewPrompt, {
          maxTokens: 4096, temperature: 0.1,
        });
        const review = parseJsonFromLLM(reviewRaw);
        if (review) {
          const merged = mergeReviewIntoDAG(initialDag, review);
          finalDag = merged.dag;
          dagVersion = merged.applied > 0 ? 2 : 1;
          console.log(`[forge:refiner] Review verdict=${review.verdict ?? 'unknown'}, ` +
            `issues=${review.issues?.length ?? 0}, applied=${merged.applied}`);
        } else {
          console.log('[forge:refiner] Review pass unparseable — keeping initial DAG.');
        }
      } catch (err) {
        console.log(`[forge:refiner] Review pass failed (${err.message}) — keeping initial DAG.`);
      }
    }

    // ── Step 5: Build DAG (validates, merges, cycle-checks) ────────────
    const { tasks, deps } = buildDAG(finalDag.tasks);

    store.insertTaskDAG(goalId, tasks, deps);
    store.updateGoalStatus(goalId, 'compiled', JSON.stringify(finalDag));
    store.logEvent(goalId, null, 'goal_compiled', {
      taskCount: tasks.length,
      summary: finalDag.summary,
      checkpoints: finalDag.checkpoints,
      clarityScore: clarity.score,
      dagVersion,
    });

    // ── Step 6: Quality scoring ────────────────────────────────────────
    const qualityScores = scoreDAG(finalDag, clarity);
    console.log(`[forge:refiner] Quality: struct=${qualityScores.structure} ` +
      `cover=${qualityScores.coverage} par=${qualityScores.parallelism} ` +
      `test=${qualityScores.testCoverage} overall=${qualityScores.overall}`);

    return {
      goalId,
      taskCount: tasks.length,
      summary: finalDag.summary ?? '',
      codebaseProfile: profile,
      clarityScore: clarity.score,
      qualityScores,
      clarifications: clarity.clarifications,
      dagVersion,
    };
  }
}

// ── Backward-compatible wrapper ───────────────────────────────────────────

/**
 * Drop-in replacement for the original compileGoal.
 * Runs the full GoalRefiner pipeline but returns only the legacy shape:
 * `{ goalId, taskCount, summary }`.
 *
 * @param {import('../task-store/index.js').TaskStore} store
 * @param {{ goalText: string, projectRoot: string }} args
 * @returns {Promise<{ goalId: string, taskCount: number, summary: string }>}
 */
export async function compileGoalV2(store, { goalText, projectRoot }) {
  const refiner = new GoalRefiner();
  const result = await refiner.refine(store, { goalText, projectRoot });
  return {
    goalId: result.goalId,
    taskCount: result.taskCount,
    summary: result.summary,
  };
}

export default GoalRefiner;
