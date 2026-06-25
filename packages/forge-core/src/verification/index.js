/**
 * Verification Engine — multi-tier validation for code changes.
 *
 * Tier 1: Static Analysis (type check, lint, import resolution)
 * Tier 2: Unit Tests
 * Tier 3: Integration Tests (start service, API tests)
 * Tier 4: Smoke Verification (app starts, routes reachable)
 * Tier 5: Security Scanning (dependency audit, secrets detection, unsafe patterns)
 *
 * Each tier returns: { tier, name, status, checks: [{ name, status, output, durationMs }] }
 *
 * Two entry points:
 *   verify(goalId, taskId, opts)     — full verification for verify-type tasks
 *   verifyAfterMutation(filesModified) — lightweight auto-check after code mutations
 *
 * Supports auto-fix loop: when tests fail, returns structured failure info
 * that the orchestrator can use to dispatch a Debugger worker or retry the task.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getTraceContext } from '../tracing/index.js';
import {
  buildSummary as _buildSummary,
  analyzeDiff as _analyzeDiff,
  runStaticAnalysis as _runStaticAnalysis,
  runUnitTests as _runUnitTests,
  runIntegrationTests as _runIntegrationTests,
  runSmokeTests as _runSmokeTests,
  runSecurityScan as _runSecurityScan,
} from './helpers.js';

export class VerificationEngine {
  #projectRoot;
  #store;
  #tracing;
  #maxTier = 5;
  #verificationHistory = new Map(); // taskId -> [{ timestamp, overall, failures }]

  constructor(storeOrOpts, projectRoot, tracingManager) {
    // Support both (store, projectRoot) and ({ store, projectRoot, tracingManager }) signatures
    if (projectRoot === undefined && storeOrOpts && typeof storeOrOpts === 'object' && 'store' in storeOrOpts) {
      // Options object form: { store, projectRoot, tracingManager }
      this.#store = storeOrOpts.store;
      this.#projectRoot = storeOrOpts.projectRoot;
      this.#tracing = storeOrOpts.tracingManager || null;
    } else {
      // Positional arguments form (backward-compatible)
      this.#store = storeOrOpts;
      this.#projectRoot = projectRoot;
      this.#tracing = tracingManager || null;
    }
  }

  /**
   * Run all verification tiers and produce an evidence report.
   * @param {string} goalId
   * @param {string} taskId
   * @param {object} options
   * @param {number} options.maxTier — maximum tier to run (default: 5)
   * @param {string[]} options.filesModified — files changed (for diff analysis)
   * @returns {object} — { tiers, overall, failures, summary, diffAnalysis }
   */
  async verify(goalId, taskId, { maxTier = 5, filesModified = [] } = {}) {
    const results = [];
    const failures = [];
    const startTime = Date.now();

    let verifySpan;
    try {
      const ctx = getTraceContext();
      verifySpan = this.#tracing?.startSpan({
        traceId: goalId || ctx.traceId,
        parentSpanId: ctx.parentSpanId,
        operationName: 'verification',
        goalId,
        taskId,
        attributes: {
          'forge.verify.goal_id': goalId,
          'forge.verify.task_id': taskId,
          'forge.verify.max_tier': maxTier || this.#maxTier
        }
      });
    } catch { /* tracing unavailable */ }

    try {
      // Parallel execution for independent tiers (1 & 2: lint + tests)
      const parallelTiers = [];
      for (let tier = 1; tier <= Math.min(2, maxTier); tier++) {
        parallelTiers.push(tier);
      }

      if (parallelTiers.length > 0) {
        console.log(`[forge:verify] Running Tiers ${parallelTiers.join(' & ')} in parallel...`);
        const tierPromises = parallelTiers.map(tier =>
          this.#runTier(tier, filesModified).catch(err => ({
            tier, name: `Tier ${tier}`, status: 'FAIL',
            checks: [{ name: 'execution_error', status: 'FAIL', output: err.message, durationMs: 0 }],
            durationMs: 0,
          }))
        );

        const tierResults = await Promise.allSettled(tierPromises);
        for (const tr of tierResults) {
          const tierResult = tr.status === 'fulfilled' ? tr.value : {
            tier: 0, name: 'Unknown', status: 'FAIL',
            checks: [{ name: 'execution_error', status: 'FAIL', output: tr.reason?.message, durationMs: 0 }],
          };
          results.push(tierResult);

          this.#store.logEvent(goalId, taskId, `verify_tier_${tierResult.tier}`, {
            status: tierResult.status,
            checksPassed: tierResult.checks.filter(c => c.status === 'PASS').length,
            checksTotal: tierResult.checks.length,
          });

          for (const check of tierResult.checks) {
            if (check.status === 'FAIL') {
              failures.push({
                tier: tierResult.tier,
                tierName: tierResult.name,
                checkName: check.name,
                output: check.output,
                durationMs: check.durationMs,
              });
            }
          }
        }
      }

      // Sequential execution for dependent tiers (3+: integration, smoke, security)
      const hasEarlyFailure = results.some(r => r.status === 'FAIL');
      if (!hasEarlyFailure) {
        for (let tier = 3; tier <= maxTier; tier++) {
          console.log(`[forge:verify] Running Tier ${tier}...`);
          const tierResult = await this.#runTier(tier, filesModified);
          results.push(tierResult);

          this.#store.logEvent(goalId, taskId, `verify_tier_${tier}`, {
            status: tierResult.status,
            checksPassed: tierResult.checks.filter(c => c.status === 'PASS').length,
            checksTotal: tierResult.checks.length,
          });

          for (const check of tierResult.checks) {
            if (check.status === 'FAIL') {
              failures.push({
                tier: tierResult.tier,
                tierName: tierResult.name,
                checkName: check.name,
                output: check.output,
                durationMs: check.durationMs,
              });
            }
          }

          if (tierResult.status === 'FAIL') {
            console.log(`[forge:verify] Tier ${tier} FAILED — stopping.`);
            break;
          }
        }
      }

      // Diff analysis (non-blocking, informational)
      let diffAnalysis = null;
      if (filesModified.length > 0) {
        diffAnalysis = await _analyzeDiff(filesModified, this.#projectRoot);
      }

      const overall = results.every(r => r.status === 'PASS' || r.status === 'SKIP') ? 'PASS'
        : results.some(r => r.status === 'FAIL') ? 'FAIL' : 'PARTIAL';

      const durationMs = Date.now() - startTime;
      const summary = _buildSummary(results, failures, diffAnalysis, durationMs);

      // Track verification history
      const history = this.#verificationHistory.get(taskId) || [];
      history.push({ timestamp: new Date().toISOString(), overall, failures: failures.length, summary });
      this.#verificationHistory.set(taskId, history);

      try {
        verifySpan?.end('ok', {
          'forge.verify.overall': overall,
          'forge.verify.failures': failures.length,
          'forge.verify.duration_ms': durationMs
        });
      } catch { /* tracing unavailable */ }

      return { tiers: results, overall, failures, summary, diffAnalysis };
    } catch (err) {
      try { verifySpan?.end('error'); } catch { /* tracing unavailable */ }
      throw err;
    }
  }

  /**
   * Lightweight verification after code mutations.
   * Runs Tiers 1-2 (static analysis + unit tests) by default,
   * plus diff analysis on the modified files.
   *
   * @param {string} goalId
   * @param {string} taskId
   * @param {object} options
   * @param {object[]} options.filesModified — [{ path, action, content? }]
   * @param {number} options.maxTier — max tier to run (default: 2)
   * @returns {object} — { tiers, overall, failures, summary, diffAnalysis }
   */
  async verifyAfterMutation(goalId, taskId, { filesModified = [], maxTier = 2 } = {}) {
    const filePaths = filesModified.map(f => f.path || f);
    return this.verify(goalId, taskId, { maxTier, filesModified: filePaths });
  }

  /**
   * Run a specific tier only (useful for re-verification after fixes).
   */
  async verifyTier(tier, filesModified = []) {
    return this.#runTier(tier, filesModified);
  }

  /**
   * Get verification history for a task.
   */
  getHistory(taskId) {
    return this.#verificationHistory.get(taskId) || [];
  }

  /**
   * Get the current tracing manager status, if available.
   */
  getTracing() {
    return this.#tracing?.getStatus() || null;
  }

  /**
   * Format verification failures into a concise context string
   * that can be injected into a worker's retry prompt.
   */
  formatFailuresForRetry(failures, maxChars = 3000) {
    if (!failures || failures.length === 0) return '';

    const lines = ['=== VERIFICATION FAILURES (fix these) ==='];
    let chars = lines[0].length;

    for (const f of failures) {
      const header = `[Tier ${f.tier}: ${f.tierName}] ${f.checkName}`;
      const output = (f.output || '').trim().slice(0, 1000);
      const entry = `\n${header}\n${output}\n`;
      if (chars + entry.length > maxChars) {
        lines.push(`\n... (${failures.length - lines.length + 1} more failures truncated)`);
        break;
      }
      lines.push(entry);
      chars += entry.length;
    }

    lines.push('=== END FAILURES ===');
    return lines.join('\n');
  }

  // ── Tier Runner ────────────────────────────────────────────────────────

  async #runTier(tier, filesModified = []) {
    let tierSpan;
    try {
      tierSpan = this.#tracing?.startSpan({
        operationName: 'verify_tier',
        attributes: { 'forge.verify.tier': tier }
      });
    } catch { /* tracing unavailable */ }

    try {
      const result = await this.#runTierHandler(tier, filesModified);
      try { tierSpan?.end('ok', { 'forge.verify.tier_status': result.status }); } catch { /* tracing unavailable */ }
      return result;
    } catch (err) {
      try { tierSpan?.end('error'); } catch { /* tracing unavailable */ }
      throw err;
    }
  }

  async #runTierHandler(tier, filesModified) {
    const root = this.#projectRoot;
    switch (tier) {
      case 1: return _runStaticAnalysis(root);
      case 2: return _runUnitTests(root, filesModified);
      case 3: return _runIntegrationTests(root);
      case 4: return _runSmokeTests(root);
      case 5: return _runSecurityScan(root, filesModified);
      default: return { tier, name: 'Unknown', status: 'SKIP', checks: [], reason: 'Unknown tier' };
    }
  }
}
