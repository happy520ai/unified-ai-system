// =============================================================================
// autoScaler.js — 自动扩缩容引擎
// 基于负载指标自动调整并发、队列、连接池
// =============================================================================

export function createAutoScaler(options = {}) {
  const config = {
    checkIntervalMs: options.checkIntervalMs ?? 10_000,
    scaleUpThreshold: options.scaleUpThreshold ?? 0.8,
    scaleDownThreshold: options.scaleDownThreshold ?? 0.3,
    minInstances: options.minInstances ?? 1,
    maxInstances: options.maxInstances ?? 10,
    cooldownMs: options.cooldownMs ?? 60_000,
  };

  let lastScaleAction = 0;
  let currentInstances = config.minInstances;
  const metrics = { cpu: 0, memory: 0, queueDepth: 0, requestRate: 0, errorRate: 0 };
  const scalingHistory = [];

  function updateMetrics(newMetrics) {
    Object.assign(metrics, newMetrics);
    evaluateScaling();
  }

  function evaluateScaling() {
    const now = Date.now();
    if (now - lastScaleAction < config.cooldownMs) return null;

    const loadScore = calculateLoadScore();

    if (loadScore > config.scaleUpThreshold && currentInstances < config.maxInstances) {
      const newCount = Math.min(currentInstances + 1, config.maxInstances);
      const action = { type: "scale_up", from: currentInstances, to: newCount, loadScore, timestamp: now };
      currentInstances = newCount;
      lastScaleAction = now;
      scalingHistory.push(action);
      if (scalingHistory.length > 100) scalingHistory.shift();
      return action;
    }

    if (loadScore < config.scaleDownThreshold && currentInstances > config.minInstances) {
      const newCount = Math.max(currentInstances - 1, config.minInstances);
      const action = { type: "scale_down", from: currentInstances, to: newCount, loadScore, timestamp: now };
      currentInstances = newCount;
      lastScaleAction = now;
      scalingHistory.push(action);
      if (scalingHistory.length > 100) scalingHistory.shift();
      return action;
    }

    return null;
  }

  function calculateLoadScore() {
    return (
      metrics.cpu * 0.3 +
      metrics.memory * 0.2 +
      (metrics.queueDepth / 100) * 0.2 +
      (metrics.requestRate / 1000) * 0.2 +
      metrics.errorRate * 0.1
    );
  }

  function getRecommendation() {
    const loadScore = calculateLoadScore();
    if (loadScore > config.scaleUpThreshold) return { action: "scale_up", urgency: "high", loadScore };
    if (loadScore > 0.6) return { action: "monitor", urgency: "medium", loadScore };
    if (loadScore < config.scaleDownThreshold) return { action: "scale_down", urgency: "low", loadScore };
    return { action: "none", urgency: "none", loadScore };
  }

  function getStats() {
    return {
      currentInstances,
      minInstances: config.minInstances,
      maxInstances: config.maxInstances,
      loadScore: calculateLoadScore(),
      metrics: { ...metrics },
      scalingActions: scalingHistory.length,
      lastScaleAction,
    };
  }

  function getHealth() {
    const loadScore = calculateLoadScore();
    let status = "healthy";
    if (loadScore > 0.9) status = "critical";
    else if (loadScore > 0.7) status = "warning";
    return { status, currentInstances, loadScore, ...metrics };
  }

  return { updateMetrics, evaluateScaling, getRecommendation, getStats, getHealth };
}
