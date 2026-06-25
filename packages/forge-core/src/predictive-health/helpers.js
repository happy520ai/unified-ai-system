/**
 * Helper functions and constants for predictive health analysis.
 * Extracted from index.js to comply with Layering Law (分层律).
 *
 * @module predictive-health/helpers
 */

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Default metric thresholds used for prediction and alerting.
 * Each entry defines the threshold value and whether breaching means
 * going above ('max') or below ('min') the threshold.
 */
export const DEFAULT_THRESHOLDS = {
  successRate: { threshold: 0.8, direction: 'min' },
  avgLatency: { threshold: 30000, direction: 'max' },
  errorRate: { threshold: 0.2, direction: 'max' },
  queueDepth: { threshold: 50, direction: 'max' },
  memoryUsage: { threshold: 0.9, direction: 'max' },
  cpuUsage: { threshold: 0.9, direction: 'max' },
  activeConnections: { threshold: 100, direction: 'max' },
};

// ── Statistical Helpers ─────────────────────────────────────────────────────

/**
 * Simple linear regression returning slope, intercept, and R-squared.
 * @param {number[]} values
 * @returns {{ slope: number, intercept: number, rSquared: number }}
 */
export function linearRegression(values) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  if (n === 1) return { slope: 0, intercept: values[0], rSquared: 1 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
    sumY2 += values[i] * values[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const ssRes = values.reduce((acc, v, i) => acc + (v - (slope * i + intercept)) ** 2, 0);
  const ssTot = values.reduce((acc, v) => acc + (v - sumY / n) ** 2, 0);
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/**
 * Compute mean.
 * @param {number[]} arr
 * @returns {number}
 */
export function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Compute standard deviation.
 * @param {number[]} arr
 * @param {number} [avg] — precomputed mean
 * @returns {number}
 */
export function stdDev(arr, avg) {
  if (arr.length < 2) return 0;
  const m = avg ?? mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Moving average of the last N values.
 * @param {number[]} values
 * @param {number} window
 * @returns {number}
 */
export function movingAverage(values, window) {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return mean(slice);
}

// ── Preventive Action Builders ──────────────────────────────────────────────

/**
 * Build preventive actions from predictions and anomalies.
 * Pure function extracted from PredictiveHealth.suggestPreventiveActions.
 *
 * @param {Array} predictions — from predict()
 * @param {Array} anomalies — from detectAnomalies()
 * @returns {Array<{ action: string, reason: string,
 *   urgency: 'low'|'medium'|'high'|'critical', expectedImpact: string }>}
 */
export function buildPreventiveActions(predictions, anomalies) {
  const actions = [];

  // Handle predicted issues
  for (const pred of predictions) {
    if (pred.timeToThreshold === null) continue;

    switch (pred.metric) {
      case 'successRate':
        actions.push({
          action: 'restart_module',
          reason: `Success rate declining (current: ${(pred.currentValue * 100).toFixed(1)}%, slope: ${pred.slope})`,
          urgency: pred.timeToThreshold < 300000 ? 'critical' : 'high',
          expectedImpact: 'Reset error state and restore normal success rate',
        });
        actions.push({
          action: 'reduce_concurrency',
          reason: 'Declining success rate may indicate overload',
          urgency: 'medium',
          expectedImpact: 'Lower contention and improve success rate',
        });
        break;

      case 'avgLatency':
        actions.push({
          action: 'warm_cache',
          reason: `Latency increasing (current: ${Math.round(pred.currentValue)}ms)`,
          urgency: pred.timeToThreshold < 600000 ? 'high' : 'medium',
          expectedImpact: 'Reduce average latency by pre-computing common paths',
        });
        actions.push({
          action: 'reduce_context_size',
          reason: 'Growing latency may be caused by large context windows',
          urgency: 'medium',
          expectedImpact: 'Faster processing with smaller context payloads',
        });
        break;

      case 'errorRate':
        actions.push({
          action: 'activate_circuit_breaker',
          reason: `Error rate increasing (current: ${(pred.currentValue * 100).toFixed(1)}%)`,
          urgency: pred.timeToThreshold < 300000 ? 'critical' : 'high',
          expectedImpact: 'Prevent cascade failures by short-circuiting failing calls',
        });
        break;

      case 'queueDepth':
        actions.push({
          action: 'scale_up_workers',
          reason: `Queue depth growing (current: ${Math.round(pred.currentValue)})`,
          urgency: pred.timeToThreshold < 600000 ? 'high' : 'medium',
          expectedImpact: 'Process backlog faster with additional workers',
        });
        actions.push({
          action: 'throttle_input',
          reason: 'Queue growing faster than processing capacity',
          urgency: 'medium',
          expectedImpact: 'Stabilize queue depth by rate-limiting incoming work',
        });
        break;

      case 'memoryUsage':
        actions.push({
          action: 'garbage_collect',
          reason: `Memory usage increasing (current: ${(pred.currentValue * 100).toFixed(1)}%)`,
          urgency: pred.timeToThreshold < 300000 ? 'critical' : 'high',
          expectedImpact: 'Free unused memory and prevent OOM',
        });
        actions.push({
          action: 'reduce_cache_size',
          reason: 'Memory growth may be from unbounded caches',
          urgency: 'medium',
          expectedImpact: 'Reduce memory footprint by limiting cache entries',
        });
        break;

      case 'cpuUsage':
        actions.push({
          action: 'reduce_parallelism',
          reason: `CPU usage increasing (current: ${(pred.currentValue * 100).toFixed(1)}%)`,
          urgency: pred.timeToThreshold < 300000 ? 'high' : 'medium',
          expectedImpact: 'Lower CPU pressure by processing fewer items concurrently',
        });
        break;

      case 'activeConnections':
        actions.push({
          action: 'close_idle_connections',
          reason: `Connection count growing (current: ${Math.round(pred.currentValue)})`,
          urgency: pred.timeToThreshold < 600000 ? 'medium' : 'low',
          expectedImpact: 'Free connection slots by closing idle connections',
        });
        break;
    }
  }

  // Handle anomalies
  for (const anomaly of anomalies) {
    if (anomaly.severity === 'critical') {
      actions.push({
        action: 'investigate_anomaly',
        reason: `${anomaly.metric} shows anomalous value (${anomaly.value}, z-score: ${anomaly.zScore})`,
        urgency: 'high',
        expectedImpact: 'Identify root cause of unexpected behavior',
      });
    }
  }

  // Sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => (urgencyOrder[a.urgency] ?? 4) - (urgencyOrder[b.urgency] ?? 4));

  if (actions.length === 0) {
    actions.push({
      action: 'no_action',
      reason: 'All metrics are within normal parameters',
      urgency: 'low',
      expectedImpact: 'Continue monitoring',
    });
  }

  return actions;
}

// ── Anomaly Detection ───────────────────────────────────────────────────────

/**
 * Detect anomalous behavior by comparing recent samples to historical baseline.
 * Pure function extracted from PredictiveHealth.detectAnomalies.
 *
 * @param {Array<{ timestamp: number, metrics: object }>} samples
 * @returns {Array<{ metric: string, value: number, mean: number,
 *   stdDev: number, zScore: number, severity: 'info'|'warning'|'critical' }>}
 */
export function detectAnomaliesFromSamples(samples) {
  if (!samples || samples.length < 5) return [];

  const recent = samples[samples.length - 1];
  const historical = samples.slice(0, -1);
  const anomalies = [];

  for (const metricKey of Object.keys(recent.metrics)) {
    const historicalValues = historical
      .map(s => s.metrics[metricKey])
      .filter(v => typeof v === 'number');

    if (historicalValues.length < 4) continue;

    const currentValue = recent.metrics[metricKey];
    if (typeof currentValue !== 'number') continue;

    const m = mean(historicalValues);
    const sd = stdDev(historicalValues, m);

    if (sd === 0) continue;

    const zScore = (currentValue - m) / sd;
    const absZ = Math.abs(zScore);

    if (absZ > 2) {
      const severity = absZ > 3 ? 'critical' : 'warning';
      anomalies.push({
        metric: metricKey,
        value: +currentValue.toFixed(4),
        mean: +m.toFixed(4),
        stdDev: +sd.toFixed(4),
        zScore: +zScore.toFixed(3),
        severity,
      });
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  anomalies.sort((a, b) => {
    const so = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    if (so !== 0) return so;
    return Math.abs(b.zScore) - Math.abs(a.zScore);
  });

  return anomalies;
}

// ── Prediction Logic ────────────────────────────────────────────────────────

/**
 * Predict future health from samples using linear regression.
 * Pure function extracted from PredictiveHealth.predict.
 *
 * @param {Array<{ timestamp: number, metrics: object }>} samples
 * @param {object} opts
 * @param {number} opts.predictionInterval
 * @param {number} opts.alertThreshold
 * @param {number} opts.degradationRateThreshold
 * @param {number} opts.historyWindow
 * @param {number} [opts.horizonMs=300000]
 * @returns {{ status: 'healthy'|'degrading'|'at_risk'|'critical',
 *   predictions: Array, recommendations: string[] }}
 */
export function predictFromSamples(samples, opts) {
  const { predictionInterval, alertThreshold, degradationRateThreshold, historyWindow, horizonMs = 300000 } = opts;

  if (!samples || samples.length < 3) {
    return {
      status: 'healthy',
      predictions: [],
      recommendations: ['Insufficient data for prediction. Need at least 3 samples.'],
    };
  }

  const predictions = [];
  const recommendations = [];
  let worstStatus = 'healthy';

  for (const [metricKey, thresholdDef] of Object.entries(DEFAULT_THRESHOLDS)) {
    const values = samples.map(s => s.metrics[metricKey]).filter(v => typeof v === 'number');
    if (values.length < 3) continue;

    const reg = linearRegression(values);
    const currentValue = values[values.length - 1];
    const avgSampleInterval = samples.length > 1
      ? (samples[samples.length - 1].timestamp - samples[0].timestamp) / (samples.length - 1)
      : 60000;

    const futureIdx = values.length - 1 + predictionInterval;
    const predictedValue = reg.slope * futureIdx + reg.intercept;

    let timeToThreshold = null;
    const { threshold, direction } = thresholdDef;

    if (direction === 'max' && currentValue < threshold && reg.slope > 0) {
      const samplesToBreach = (threshold - reg.intercept) / reg.slope - (values.length - 1);
      if (samplesToBreach > 0 && samplesToBreach < predictionInterval * 5) {
        timeToThreshold = Math.round(samplesToBreach * avgSampleInterval);
      }
    } else if (direction === 'min' && currentValue > threshold && reg.slope < 0) {
      const samplesToBreach = (reg.intercept - threshold) / (-reg.slope) - (values.length - 1);
      if (samplesToBreach > 0 && samplesToBreach < predictionInterval * 5) {
        timeToThreshold = Math.round(samplesToBreach * avgSampleInterval);
      }
    }

    const confidence = Math.min(1, reg.rSquared * (values.length / historyWindow));

    predictions.push({
      metric: metricKey,
      currentValue: +currentValue.toFixed(4),
      predictedValue: +predictedValue.toFixed(4),
      slope: +reg.slope.toFixed(6),
      timeToThreshold,
      confidence: +confidence.toFixed(3),
    });

    if (timeToThreshold !== null && confidence >= alertThreshold) {
      if (timeToThreshold <= horizonMs * 0.25) {
        worstStatus = 'critical';
        recommendations.push(`${metricKey} will breach threshold within ${Math.round(timeToThreshold / 60000)} minutes. Immediate action required.`);
      } else if (timeToThreshold <= horizonMs) {
        if (worstStatus !== 'critical') worstStatus = 'at_risk';
        recommendations.push(`${metricKey} trending toward threshold breach. Estimated time: ${Math.round(timeToThreshold / 60000)} minutes.`);
      }
    }

    const relativeSlope = Math.abs(reg.slope) / (mean(values) || 1);
    if (relativeSlope > degradationRateThreshold) {
      if (worstStatus === 'healthy') worstStatus = 'degrading';
    }
  }

  return { status: worstStatus, predictions, recommendations };
}

// ── Degradation Timeline ────────────────────────────────────────────────────

/**
 * Get degradation timeline from samples.
 * Pure function extracted from PredictiveHealth.getDegradationTimeline.
 *
 * @param {Array<{ timestamp: number, metrics: object }>} samples
 * @param {object} opts
 * @param {number} opts.degradationRateThreshold
 * @returns {{ startedAt: number|null, rate: number, currentLevel: string,
 *   projectedCritical: number|null, metrics: Array }}
 */
export function getDegradationTimelineFromSamples(samples, opts) {
  const { degradationRateThreshold } = opts;

  if (!samples || samples.length < 3) {
    return { startedAt: null, rate: 0, currentLevel: 'unknown', projectedCritical: null, metrics: [] };
  }

  const metricTimelines = [];
  let earliestDegradation = null;
  let maxRate = 0;

  for (const [metricKey, thresholdDef] of Object.entries(DEFAULT_THRESHOLDS)) {
    const values = samples.map(s => s.metrics[metricKey]).filter(v => typeof v === 'number');
    if (values.length < 3) continue;

    const reg = linearRegression(values);
    const avgVal = mean(values);
    const relativeSlope = avgVal !== 0 ? reg.slope / Math.abs(avgVal) : 0;

    const { direction } = thresholdDef;
    const isDegrading = (direction === 'max' && relativeSlope > degradationRateThreshold) ||
                        (direction === 'min' && relativeSlope < -degradationRateThreshold);

    if (isDegrading) {
      const avgInterval = samples.length > 1
        ? (samples[samples.length - 1].timestamp - samples[0].timestamp) / (samples.length - 1)
        : 60000;

      let degradeStart = null;
      const windowSize = Math.max(3, Math.floor(values.length * 0.3));
      for (let i = windowSize; i < values.length; i++) {
        const windowAvg = movingAverage(values.slice(0, i + 1), windowSize);
        const baseline = movingAverage(values.slice(0, windowSize), windowSize);
        const deviation = direction === 'max'
          ? (windowAvg - baseline) / (baseline || 1)
          : (baseline - windowAvg) / (baseline || 1);
        if (deviation > degradationRateThreshold) {
          degradeStart = samples[i]?.timestamp ?? null;
          break;
        }
      }

      if (degradeStart && (!earliestDegradation || degradeStart < earliestDegradation)) {
        earliestDegradation = degradeStart;
      }

      const absRate = Math.abs(relativeSlope);
      if (absRate > maxRate) maxRate = absRate;

      let projectedCritical = null;
      const currentValue = values[values.length - 1];
      const threshold = thresholdDef.threshold;
      if (direction === 'max' && reg.slope > 0 && currentValue < threshold) {
        const samplesToBreach = (threshold - reg.intercept) / reg.slope - (values.length - 1);
        if (samplesToBreach > 0) {
          projectedCritical = Math.round(samplesToBreach * avgInterval);
        }
      } else if (direction === 'min' && reg.slope < 0 && currentValue > threshold) {
        const samplesToBreach = (reg.intercept - threshold) / (-reg.slope) - (values.length - 1);
        if (samplesToBreach > 0) {
          projectedCritical = Math.round(samplesToBreach * avgInterval);
        }
      }

      metricTimelines.push({
        metric: metricKey,
        degrading: true,
        rate: +relativeSlope.toFixed(6),
        startedAt: degradeStart,
        projectedCriticalMs: projectedCritical,
      });
    }
  }

  const currentLevel = earliestDegradation
    ? (maxRate > 0.1 ? 'critical' : maxRate > 0.05 ? 'degrading' : 'mild')
    : 'healthy';

  return {
    startedAt: earliestDegradation,
    rate: +maxRate.toFixed(6),
    currentLevel,
    projectedCritical: metricTimelines.length > 0
      ? Math.min(...metricTimelines.map(m => m.projectedCriticalMs ?? Infinity).filter(v => v < Infinity))
      : null,
    metrics: metricTimelines,
  };
}

// ── Utility Functions ───────────────────────────────────────────────────────

/**
 * Deduplicate recommendations array.
 * @param {string[]} recommendations
 * @returns {string[]}
 */
export function deduplicateRecommendations(recommendations) {
  const seen = new Set();
  const unique = [];
  for (const rec of recommendations) {
    if (!seen.has(rec)) {
      seen.add(rec);
      unique.push(rec);
    }
  }
  return unique;
}
