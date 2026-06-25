const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname);
const content = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const lines = content.split(/\r?\n/);

// ── helpers.js content ──────────────────────────────────────────────────────

const faultTypesLines = lines.slice(27, 92);

const helpersParts = [
  '/**',
  ' * Shared helpers for ChaosEngineer module.',
  ' *',
  ' * Extracted constants and pure functions to keep index.js under 500 lines.',
  ' * @module chaos-engineer/helpers',
  ' */',
  '',
  '// -- Fault Definitions ------------------------------------------------------',
  '',
  '/**',
  ' * Pre-defined fault type configurations.',
  ' * Each describes the injection strategy and expected impact.',
  ' * @type {Object<string, { description: string, apply: Function, rollback: Function }>}',
  ' */',
  ...faultTypesLines,
  '',
  '// -- Suite Experiment Definitions -------------------------------------------',
  '',
  '/**',
  ' * Standard resilience suite experiment templates.',
  ' */',
  'export const SUITE_EXPERIMENTS = [',
  "  { suffix: 'latency-100', fault: 'latency_injection', config: { delayMs: 100, jitterMs: 20 } },",
  "  { suffix: 'latency-500', fault: 'latency_injection', config: { delayMs: 500, jitterMs: 100 } },",
  "  { suffix: 'latency-2000', fault: 'latency_injection', config: { delayMs: 2000, jitterMs: 500 } },",
  "  { suffix: 'error-10', fault: 'error_injection', config: { failureRate: 0.1 } },",
  "  { suffix: 'error-50', fault: 'error_injection', config: { failureRate: 0.5 } },",
  "  { suffix: 'error-100', fault: 'error_injection', config: { failureRate: 1.0 } },",
  "  { suffix: 'starvation-50', fault: 'resource_starvation', config: { timeoutReductionRatio: 0.5 } },",
  '];',
  '',
  '// -- Pure Functions ---------------------------------------------------------',
  '',
  '/**',
  ' * Validate experiment configuration before definition.',
  ' * @param {object} config',
  ' * @param {string[]} validFaultTypes',
  ' */',
  'export function validateExperimentConfig(config, validFaultTypes) {',
  "  if (!config.target) throw new Error('Experiment must specify a target module');",
  "  if (!config.fault) throw new Error('Experiment must specify a fault type');",
  '  if (!validFaultTypes.includes(config.fault)) {',
  "    throw new Error(`Unknown fault type: ${config.fault}. Valid types: ${validFaultTypes.join(', ')}`);",
  '  }',
  "  if (!config.hypothesis) throw new Error('Experiment must include a hypothesis');",
  '}',
  '',
  '/**',
  ' * Get past experiment results for a target+fault combination.',
  ' * @param {Array} history',
  ' * @param {string} target',
  ' * @param {string} fault',
  ' * @returns {Array}',
  ' */',
  'export function getPastResults(history, target, fault) {',
  '  return history.filter(r => r.target === target && r.fault === fault);',
  '}',
  '',
  '/**',
  ' * Simulate an experiment in dry-run mode.',
  ' * Predicts outcomes based on the fault type and historical data.',
  ' * @param {object} experiment',
  ' * @param {object} appliedFault',
  ' * @param {Array} history',
  ' * @returns {Promise<object>}',
  ' */',
  'export async function simulateExperiment(experiment, appliedFault, history) {',
  '  const predictions = {};',
  '  const metrics = {};',
  '',
  '  switch (appliedFault.type) {',
  "    case 'latency':",
  '      predictions.expectedLatencyIncrease = appliedFault.delayMs;',
  '      predictions.impact = `Module "${experiment.target}" calls will be delayed by ~${appliedFault.delayMs}ms`;',
  "      predictions.risk = appliedFault.delayMs > 5000 ? 'high' : appliedFault.delayMs > 2000 ? 'medium' : 'low';",
  '      metrics.simulatedDelay = appliedFault.delayMs;',
  '      if (experiment.successCriteria.maxLatencyIncrease) {',
  '        predictions.willPass = appliedFault.delayMs <= experiment.successCriteria.maxLatencyIncrease;',
  '      }',
  '      break;',
  '',
  "    case 'error':",
  '      predictions.expectedFailureRate = appliedFault.failureRate;',
  '      predictions.impact = `${(appliedFault.failureRate * 100).toFixed(0)}% of calls to "${experiment.target}" will fail`;',
  "      predictions.risk = appliedFault.failureRate > 0.5 ? 'high' : appliedFault.failureRate > 0.2 ? 'medium' : 'low';",
  '      metrics.simulatedFailureRate = appliedFault.failureRate;',
  '      if (experiment.successCriteria.maxErrorRate) {',
  '        predictions.willPass = appliedFault.failureRate <= experiment.successCriteria.maxErrorRate;',
  '      }',
  '      break;',
  '',
  "    case 'resource':",
  '      predictions.timeoutMultiplier = appliedFault.timeoutMultiplier;',
  '      predictions.impact = `Timeouts for "${experiment.target}" reduced to ${(appliedFault.timeoutMultiplier * 100).toFixed(0)}% of normal`;',
  "      predictions.risk = appliedFault.timeoutMultiplier < 0.3 ? 'high' : 'medium';",
  '      metrics.simulatedTimeoutMultiplier = appliedFault.timeoutMultiplier;',
  '      break;',
  '',
  "    case 'partition':",
  '      predictions.impact = `Module "${experiment.target}" will be isolated from inter-module communication`;',
  "      predictions.risk = 'high';",
  '      predictions.dependentModulesWillFail = true;',
  '      break;',
  '',
  "    case 'corruption':",
  '      predictions.corruptionRate = appliedFault.corruptionRate;',
  '      predictions.impact = `${(appliedFault.corruptionRate * 100).toFixed(0)}% of inputs to "${experiment.target}" will be corrupted (${appliedFault.corruptionType})`;',
  "      predictions.risk = appliedFault.corruptionRate > 0.3 ? 'high' : 'medium';",
  '      break;',
  '',
  "    case 'cascade':",
  '      predictions.affectedModules = appliedFault.affectedModules;',
  '      predictions.impact = `Failure will cascade from "${experiment.target}" to: ${(appliedFault.affectedModules || []).join(', ')}`;',
  "      predictions.risk = 'high';",
  '      break;',
  '',
  '    default:',
  "      predictions.impact = 'Unknown fault type';",
  "      predictions.risk = 'unknown';",
  '  }',
  '',
  '  const pastResults = getPastResults(history, experiment.target, experiment.fault);',
  '  if (pastResults.length > 0) {',
  '    const pastPassRate = pastResults.filter(r => r.passed).length / pastResults.length;',
  '    predictions.historicalPassRate = +pastPassRate.toFixed(3);',
  '    predictions.historicalRuns = pastResults.length;',
  '  }',
  '',
  '  return {',
  '    passed: predictions.willPass ?? null,',
  '    metrics,',
  '    predictions,',
  '  };',
  '}',
  '',
  '/**',
  ' * Execute a real fault injection experiment with safety timeout.',
  ' * @param {object} experiment',
  ' * @param {object} appliedFault',
  ' * @param {number} safetyTimeout',
  ' * @param {number} blastRadius',
  ' * @returns {Promise<object>}',
  ' */',
  'export async function executeRealExperiment(experiment, appliedFault, safetyTimeout, blastRadius) {',
  '  const duration = Math.min(experiment.duration, safetyTimeout);',
  '',
  '  const metrics = {',
  '    faultApplied: true,',
  '    faultType: appliedFault.type,',
  '    blastRadius,',
  '    durationMs: duration,',
  '    safetyTimeoutMs: safetyTimeout,',
  '    autoRollbackTriggered: false,',
  '  };',
  '',
  '  const waitMs = Math.min(duration, 5000);',
  '  await new Promise(resolve => setTimeout(resolve, waitMs));',
  '',
  '  if (duration >= safetyTimeout) {',
  '    metrics.autoRollbackTriggered = true;',
  '  }',
  '',
  '  let passed = true;',
  '  const criteriaEvaluation = {};',
  '  for (const [criterion, threshold] of Object.entries(experiment.successCriteria)) {',
  '    criteriaEvaluation[criterion] = {',
  '      threshold,',
  '      actual: null,',
  '      passed: true,',
  '    };',
  '  }',
  '',
  '  return {',
  '    passed,',
  '    metrics: { ...metrics, criteriaEvaluation },',
  '    predictions: {},',
  '  };',
  '}',
  '',
  '/**',
  ' * Filter and sort experiment history.',
  ' * @param {Array} history',
  ' * @param {object} opts',
  ' * @returns {Array}',
  ' */',
  'export function filterHistory(history, opts = {}) {',
  '  const limit = opts.limit ?? 50;',
  '  let filtered = [...history];',
  '',
  '  if (opts.module) {',
  '    filtered = filtered.filter(r => r.target === opts.module);',
  '  }',
  '  if (opts.fault) {',
  '    filtered = filtered.filter(r => r.fault === opts.fault);',
  '  }',
  '',
  '  filtered.sort((a, b) => b.timestamp - a.timestamp);',
  '',
  '  return filtered.slice(0, limit);',
  '}',
  '',
  '/**',
  ' * Calculate resilience score for a module.',
  ' * @param {Map} moduleResults',
  ' * @param {string} moduleId',
  ' * @param {Object} faultTypes',
  ' * @returns {object}',
  ' */',
  'export function computeResilienceScore(moduleResults, moduleId, faultTypes) {',
  '  const results = moduleResults.get(moduleId) ?? [];',
  '',
  '  if (results.length === 0) {',
  '    return {',
  '      score: 0,',
  '      experiments: [],',
  "      weakPoints: ['No experiment data available for this module'],",
  '    };',
  '  }',
  '',
  '  const passed = results.filter(r => r.passed === true).length;',
  '  const total = results.length;',
  '  const score = Math.round((passed / total) * 100);',
  '',
  '  const weakPoints = [];',
  '  const faultGroups = new Map();',
  '  for (const r of results) {',
  '    if (!faultGroups.has(r.fault)) faultGroups.set(r.fault, []);',
  '    faultGroups.get(r.fault).push(r);',
  '  }',
  '',
  '  for (const [fault, faultResults] of faultGroups) {',
  '    const faultFailures = faultResults.filter(r => r.passed === false).length;',
  '    const faultFailRate = faultFailures / faultResults.length;',
  '    if (faultFailRate > 0.3) {',
  '      weakPoints.push({',
  '        fault,',
  '        description: faultTypes[fault]?.description ?? fault,',
  '        failureRate: +(faultFailRate * 100).toFixed(1),',
  '        totalRuns: faultResults.length,',
  '      });',
  '    }',
  '  }',
  '',
  '  const experimentSummary = results.map(r => ({',
  '    name: r.experiment,',
  '    fault: r.fault,',
  '    passed: r.passed,',
  '    mode: r.mode,',
  '    timestamp: r.timestamp,',
  '    duration: r.duration,',
  '  }));',
  '',
  '  return { score, experiments: experimentSummary, weakPoints };',
  '}',
  '',
];

const helpersContent = helpersParts.join('\n');

// ── index.js content ────────────────────────────────────────────────────────

const importBlock = [
  'import {',
  '  FAULT_TYPES as _FAULT_TYPES,',
  '  SUITE_EXPERIMENTS as _SUITE_EXPERIMENTS,',
  '  validateExperimentConfig as _validateExperimentConfig,',
  '  simulateExperiment as _simulateExperiment,',
  '  executeRealExperiment as _executeRealExperiment,',
  '  getPastResults as _getPastResults,',
  '  filterHistory as _filterHistory,',
  '  computeResilienceScore as _computeResilienceScore,',
  "} from './helpers.js';",
  '',
].join('\n');

// Section A: module JSDoc (lines 1-27, 0-indexed 0-26)
const sectionA = lines.slice(0, 27);

// Section B: ChaosEngineer header + fields + constructor + defineExperiment (lines 94-188, 0-indexed 93-187)
let sectionB = lines.slice(93, 188).join('\n');
sectionB = sectionB.replace(/\bFAULT_TYPES\b/g, '_FAULT_TYPES');

// Section C: Experiment Execution header + runExperiment (lines 189-306, 0-indexed 188-305)
let sectionC = lines.slice(188, 306).join('\n');
sectionC = sectionC.replace(/\bFAULT_TYPES\b/g, '_FAULT_TYPES');
sectionC = sectionC.replace(/this\.#simulateExperiment\(/g, '_simulateExperiment(');
sectionC = sectionC.replace(/this\.#executeRealExperiment\(/g, '_executeRealExperiment(');
sectionC = sectionC.replace(
  /await _simulateExperiment\(experiment, appliedFault\)/g,
  'await _simulateExperiment(experiment, appliedFault, this.#history)'
);
sectionC = sectionC.replace(
  /await _executeRealExperiment\(experiment, appliedFault\)/g,
  'await _executeRealExperiment(experiment, appliedFault, this.#safetyTimeout, this.#blastRadius)'
);

// Section D: Resilience Suite + runResilienceSuite (lines 446-522, 0-indexed 445-521)
let sectionD = lines.slice(445, 522).join('\n');
sectionD = sectionD.replace(/const suiteExperiments = \[[\s\S]*?\];/, 'const suiteExperiments = _SUITE_EXPERIMENTS;');

// Delegation methods
const getHistoryDel = [
  '  getHistory(opts = {}) {',
  '    return _filterHistory(this.#history, opts);',
  '  }',
].join('\n');

const getResilienceScoreDel = [
  '  getResilienceScore(moduleId) {',
  '    return _computeResilienceScore(this.#moduleResults, moduleId, _FAULT_TYPES);',
  '  }',
].join('\n');

// Section E: Status section (lines 610-638, 0-indexed 609-637)
let sectionE = lines.slice(609).join('\n');
sectionE = sectionE.replace(/\bFAULT_TYPES\b/g, '_FAULT_TYPES');

// Assemble final index.js
const finalParts = [
  sectionA.join('\n'),
  importBlock,
  sectionB,
  sectionC,
  sectionD,
  getHistoryDel,
  '',
  getResilienceScoreDel,
  '',
  sectionE,
];

let finalContent = finalParts.join('\n');

// ── Write files ─────────────────────────────────────────────────────────────

fs.writeFileSync(path.join(dir, 'helpers.js'), helpersContent, 'utf8');
fs.writeFileSync(path.join(dir, 'index.js'), finalContent, 'utf8');

const helpersLineCount = helpersContent.split(/\r?\n/).length;
const indexLineCount = finalContent.split(/\r?\n/).length;
console.log('helpers.js lines:', helpersLineCount);
console.log('index.js lines:', indexLineCount);
console.log('Files written successfully.');
