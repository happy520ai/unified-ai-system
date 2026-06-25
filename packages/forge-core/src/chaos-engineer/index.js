/**
 * Chaos Engineer Module — controlled chaos engineering for testing resilience.
 *
 * Enables defining fault-injection experiments against modules, running them
 * in dry-run mode by default (safety first), and building resilience scores
 * based on historical experiment outcomes.
 *
 * Supported fault types:
 *   - latency_injection: add random delay to module calls
 *   - error_injection: randomly fail module calls
 *   - resource_starvation: limit module resources (timeout)
 *   - network_partition: isolate module from communication
 *   - data_corruption: corrupt module input data
 *   - cascade_failure: trigger failures in dependent modules
 *
 * Pure Node.js, no external dependencies.
 *
 * @module chaos-engineer
 */

import {
  FAULT_TYPES as _FAULT_TYPES,
  SUITE_EXPERIMENTS as _SUITE_EXPERIMENTS,
  simulateExperiment as _simulateExperiment,
  executeRealExperiment as _executeRealExperiment,
  filterHistory as _filterHistory,
  computeResilienceScore as _computeResilienceScore,
} from './helpers.js';

// ── ChaosEngineer ───────────────────────────────────────────────────────────

/**
 * Controlled chaos engineering engine for resilience testing.
 *
 * Experiments are defined declaratively and default to dry-run mode.
 * Real fault injection requires explicit opt-in and enforces safety timeouts
 * with automatic rollback.
 *
 * @example
 *   const chaos = new ChaosEngineer({ enabled: true });
 *   chaos.defineExperiment('latency-test', {
 *     target: 'worker-pool',
 *     fault: 'latency_injection',
 *     faultConfig: { delayMs: 2000, jitterMs: 500 },
 *     duration: 30000,
 *     hypothesis: 'System handles 2s latency gracefully',
 *     successCriteria: { maxErrorRate: 0.1, maxLatencyIncrease: 3000 },
 *   });
 *   const result = await chaos.runExperiment('latency-test');
 */
export class ChaosEngineer {
  /** @type {boolean} Global enable flag */
  #enabled;

  /** @type {number} Max concurrent experiments */
  #maxConcurrent;

  /** @type {number} Fraction of traffic/modules affected */
  #blastRadius;

  /** @type {number} Auto-rollback timeout in ms */
  #safetyTimeout;

  /** @type {Map<string, object>} Experiment definitions */
  #experiments = new Map();

  /** @type {Array<object>} Experiment execution history */
  #history = [];

  /** @type {Set<string>} Currently active experiment names */
  #activeExperiments = new Set();

  /** @type {Map<string, Array<object>>} Per-module experiment results for scoring */
  #moduleResults = new Map();

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.enabled=false] — global enable (default: off)
   * @param {number} [opts.maxConcurrentExperiments=1] — concurrency cap
   * @param {number} [opts.blastRadius=0.1] — fraction affected (0-1)
   * @param {number} [opts.safetyTimeout=60000] — auto-rollback timeout ms
   */
  constructor(opts = {}) {
    this.#enabled = opts.enabled ?? false;
    this.#maxConcurrent = opts.maxConcurrentExperiments ?? 1;
    this.#blastRadius = opts.blastRadius ?? 0.1;
    this.#safetyTimeout = opts.safetyTimeout ?? 60000;
  }

  // ── Experiment Definition ───────────────────────────────────────────────

  /**
   * Define a chaos experiment.
   *
   * @param {string} name — unique experiment name
   * @param {object} config
   * @param {string} config.target — target module identifier
   * @param {string} config.fault — fault type (see FAULT_TYPES)
   * @param {object} [config.faultConfig] — fault-specific parameters
   * @param {number} [config.duration] — experiment duration in ms
   * @param {string} config.hypothesis — what you expect to happen
   * @param {object} [config.successCriteria] — pass/fail thresholds
   * @param {Function} [config.rollback] — custom rollback function
   */
  defineExperiment(name, config) {
    if (!config.target) throw new Error('Experiment must specify a target module');
    if (!config.fault) throw new Error('Experiment must specify a fault type');
    if (!_FAULT_TYPES[config.fault]) {
      throw new Error(`Unknown fault type: ${config.fault}. Valid types: ${Object.keys(_FAULT_TYPES).join(', ')}`);
    }
    if (!config.hypothesis) throw new Error('Experiment must include a hypothesis');

    this.#experiments.set(name, {
      name,
      target: config.target,
      fault: config.fault,
      faultConfig: config.faultConfig ?? {},
      duration: config.duration ?? 30000,
      hypothesis: config.hypothesis,
      successCriteria: config.successCriteria ?? {},
      rollback: config.rollback ?? null,
      createdAt: Date.now(),
    });
  }

  // ── Experiment Execution ────────────────────────────────────────────────

  /**
   * Run a defined experiment.
   *
   * In dry-run mode (default), simulates the experiment and predicts outcomes
   * without actually injecting faults. In real mode, applies the fault,
   * monitors for the configured duration, and auto-rolls back on timeout.
   *
   * @param {string} name — experiment name (must be defined first)
   * @param {object} [opts]
   * @param {boolean} [opts.dryRun=true] — simulate only
   * @param {boolean} [opts.recordResults=true] — persist to history
   * @returns {Promise<{ experiment: string, hypothesis: string,
   *   mode: 'dry-run'|'real', passed: boolean|null, metrics: object,
   *   predictions: object, duration: number, error: string|null }>}
   */
  async runExperiment(name, opts = {}) {
    const dryRun = opts.dryRun ?? true;
    const recordResults = opts.recordResults ?? true;

    const experiment = this.#experiments.get(name);
    if (!experiment) {
      throw new Error(`Experiment "${name}" not found. Define it first with defineExperiment().`);
    }

    // Concurrency check
    if (!dryRun && this.#activeExperiments.size >= this.#maxConcurrent) {
      throw new Error(`Max concurrent experiments (${this.#maxConcurrent}) reached. Complete or cancel existing experiments.`);
    }

    // Safety check: must be enabled for real runs
    if (!dryRun && !this.#enabled) {
      throw new Error('ChaosEngineer is disabled. Set enabled=true for real experiments.');
    }

    const startTime = Date.now();
    this.#activeExperiments.add(name);

    try {
      const faultDef = _FAULT_TYPES[experiment.fault];
      const appliedFault = faultDef.apply(experiment.faultConfig);

      let result;

      if (dryRun) {
        // Dry-run: predict what would happen
        result = await _simulateExperiment(experiment, appliedFault, this.#history);
      } else {
        // Real execution: apply fault, wait for duration, then rollback
        result = await _executeRealExperiment(experiment, appliedFault, this.#safetyTimeout, this.#blastRadius);
      }

      const elapsed = Date.now() - startTime;

      const outcome = {
        experiment: name,
        hypothesis: experiment.hypothesis,
        mode: dryRun ? 'dry-run' : 'real',
        target: experiment.target,
        fault: experiment.fault,
        faultState: appliedFault,
        passed: result.passed,
        metrics: result.metrics,
        predictions: result.predictions,
        duration: elapsed,
        timestamp: Date.now(),
        error: null,
      };

      if (recordResults) {
        this.#history.push(outcome);
        if (!this.#moduleResults.has(experiment.target)) {
          this.#moduleResults.set(experiment.target, []);
        }
        this.#moduleResults.get(experiment.target).push(outcome);
      }

      // Apply custom rollback if provided
      if (!dryRun && experiment.rollback) {
        await experiment.rollback();
      }

      // Apply standard rollback
      faultDef.rollback();

      return outcome;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const faultDef = _FAULT_TYPES[experiment.fault];
      faultDef.rollback();
      if (experiment.rollback) await experiment.rollback();

      const errorOutcome = {
        experiment: name,
        hypothesis: experiment.hypothesis,
        mode: dryRun ? 'dry-run' : 'real',
        target: experiment.target,
        fault: experiment.fault,
        passed: false,
        metrics: {},
        predictions: {},
        duration: elapsed,
        timestamp: Date.now(),
        error: err.message,
      };

      if (recordResults) {
        this.#history.push(errorOutcome);
      }

      return errorOutcome;
    } finally {
      this.#activeExperiments.delete(name);
    }
  }

  // ── Resilience Suite ────────────────────────────────────────────────────

  /**
   * Run a standard resilience test suite against a set of modules.
   *
   * For each module, runs:
   *   1. Latency injection at 100ms, 500ms, 2000ms
   *   2. Error injection at 10%, 50%, 100%
   *   3. Resource starvation at 50% timeout reduction
   *
   * @param {string[]} modules — module identifiers to test
   * @param {object} [opts]
   * @param {boolean} [opts.dryRun=true]
   * @returns {Promise<{ modules: Array<{ moduleId: string, experiments: Array, overallResilience: number }> }>}
   */
  async runResilienceSuite(modules, opts = {}) {
    const dryRun = opts.dryRun ?? true;
    const results = [];

    const suiteExperiments = _SUITE_EXPERIMENTS;

    for (const moduleId of modules) {
      const moduleExperiments = [];

      for (const suite of suiteExperiments) {
        const name = `__suite_${moduleId}_${suite.suffix}`;
        this.defineExperiment(name, {
          target: moduleId,
          fault: suite.fault,
          faultConfig: suite.config,
          duration: 10000,
          hypothesis: `Module "${moduleId}" handles ${suite.fault} (${suite.suffix}) gracefully`,
          successCriteria: { maxErrorRate: 0.3 },
        });

        const result = await this.runExperiment(name, { dryRun });
        moduleExperiments.push({
          name: suite.suffix,
          fault: suite.fault,
          passed: result.passed,
          predictions: result.predictions,
          mode: result.mode,
        });

        // Clean up auto-generated experiment
        this.#experiments.delete(name);
      }

      // Calculate resilience score (0-100)
      const passed = moduleExperiments.filter(e => e.passed === true).length;
      const failed = moduleExperiments.filter(e => e.passed === false).length;
      const unknown = moduleExperiments.filter(e => e.passed === null).length;
      // Dry-run nulls count as half-pass for scoring
      const score = Math.round(((passed + unknown * 0.5) / moduleExperiments.length) * 100);

      results.push({
        moduleId,
        experiments: moduleExperiments,
        overallResilience: score,
        summary: { passed, failed, unknown, total: moduleExperiments.length },
      });
    }

    return { modules: results };
  }

  // ── History ─────────────────────────────────────────────────────────────

  /**
   * Get experiment execution history.
   *
   * @param {object} [opts]
   * @param {number} [opts.limit=50] — max entries to return
   * @param {string} [opts.module] — filter by target module
   * @param {string} [opts.fault] — filter by fault type
   * @returns {Array<object>}
   */
  getHistory(opts = {}) {
    return _filterHistory(this.#history, opts);
  }

  // ── Resilience Score ────────────────────────────────────────────────────

  /**
   * Get the resilience score for a module based on past experiment results.
   *
   * @param {string} moduleId
   * @returns {{ score: number, experiments: Array, weakPoints: Array }}
   */
  getResilienceScore(moduleId) {
    return _computeResilienceScore(this.#moduleResults, moduleId, _FAULT_TYPES);
  }

  // ── Status ──────────────────────────────────────────────────────────────

  /**
   * Get current ChaosEngineer status.
   *
   * @returns {{ experimentCount: number, lastRun: number|null,
   *   enabled: boolean, activeExperiments: string[],
   *   definedExperiments: string[], totalResults: number }}
   */
  getStatus() {
    const lastResult = this.#history.length > 0
      ? this.#history[this.#history.length - 1].timestamp
      : null;

    return {
      experimentCount: this.#experiments.size,
      definedExperiments: [...this.#experiments.keys()],
      lastRun: lastResult,
      enabled: this.#enabled,
      activeExperiments: [...this.#activeExperiments],
      totalResults: this.#history.length,
      maxConcurrent: this.#maxConcurrent,
      blastRadius: this.#blastRadius,
      safetyTimeout: this.#safetyTimeout,
      availableFaultTypes: Object.keys(_FAULT_TYPES),
    };
  }
}
