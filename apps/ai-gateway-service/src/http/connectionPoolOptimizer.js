// =============================================================================
// connectionPoolOptimizer.js — 连接池优化器
// HTTP keep-alive 调优、连接复用、背压控制
// =============================================================================

/**
 * 创建连接池优化器
 * @param {Object} options - 配置选项
 * @returns {Object} { getConfig, recordConnection, getStats, shouldThrottle }
 */
export function createConnectionPoolOptimizer(options = {}) {
  const config = {
    // Keep-alive 配置
    keepAliveTimeout: options.keepAliveTimeout ?? 5000,
    keepAliveMaxRequests: options.keepAliveMaxRequests ?? 100,

    // 连接限制
    maxConnections: options.maxConnections ?? 1000,
    maxConnectionsPerHost: options.maxConnectionsPerHost ?? 50,

    // 背压控制
    backpressureThreshold: options.backpressureThreshold ?? 0.8, // 80% 容量时开始限流
    backpressureDelayMs: options.backpressureDelayMs ?? 100,

    // 超时配置
    connectionTimeoutMs: options.connectionTimeoutMs ?? 30000,
    requestTimeoutMs: options.requestTimeoutMs ?? 120000,
  };

  // 连接统计
  const stats = {
    totalConnections: 0,
    activeConnections: 0,
    rejectedConnections: 0,
    backpressureEvents: 0,
    keepAliveReused: 0,
    hostConnections: new Map(), // host -> count
  };

  /**
   * 获取优化后的服务器配置
   * @returns {Object} Node.js HTTP 服务器配置
   */
  function getServerConfig() {
    return {
      keepAliveTimeout: config.keepAliveTimeout,
      headersTimeout: config.keepAliveTimeout + 5000,
      requestTimeout: config.requestTimeoutMs,
      maxHeadersSize: 16384, // 16KB
      noDelay: true, // 禁用 Nagle 算法
    };
  }

  /**
   * 获取优化后的 Agent 配置（用于出站请求）
   * @returns {Object} HTTP Agent 配置
   */
  function getAgentConfig() {
    return {
      keepAlive: true,
      keepAliveMsecs: config.keepAliveTimeout,
      maxSockets: config.maxConnectionsPerHost,
      maxFreeSockets: 10,
      timeout: config.connectionTimeoutMs,
      freeSocketTimeout: 4000, // 空闲 socket 4s 后关闭
    };
  }

  /**
   * 记录新连接
   * @param {string} host - 目标主机
   * @returns {Object} { accepted, reason }
   */
  function recordConnection(host) {
    stats.totalConnections++;
    stats.activeConnections++;

    // 检查总连接数限制
    if (stats.activeConnections > config.maxConnections) {
      stats.rejectedConnections++;
      stats.activeConnections--;
      return { accepted: false, reason: "max_connections_exceeded" };
    }

    // 检查每主机连接数限制
    const hostCount = stats.hostConnections.get(host) ?? 0;
    if (hostCount >= config.maxConnectionsPerHost) {
      stats.rejectedConnections++;
      stats.activeConnections--;
      return { accepted: false, reason: "max_host_connections_exceeded" };
    }

    stats.hostConnections.set(host, hostCount + 1);
    return { accepted: true };
  }

  /**
   * 记录连接关闭
   * @param {string} host - 目标主机
   */
  function recordDisconnection(host) {
    stats.activeConnections = Math.max(0, stats.activeConnections - 1);
    const hostCount = stats.hostConnections.get(host) ?? 0;
    if (hostCount > 0) {
      stats.hostConnections.set(host, hostCount - 1);
    }
  }

  /**
   * 记录 keep-alive 复用
   */
  function recordKeepAliveReuse() {
    stats.keepAliveReused++;
  }

  /**
   * 检查是否应该启用背压
   * @returns {Object} { shouldThrottle, delayMs, reason }
   */
  function shouldThrottle() {
    const utilizationRate = stats.activeConnections / config.maxConnections;

    if (utilizationRate >= config.backpressureThreshold) {
      stats.backpressureEvents++;
      // 线性增加延迟：利用率越高，延迟越大
      const delayFactor = (utilizationRate - config.backpressureThreshold) / (1 - config.backpressureThreshold);
      const delayMs = Math.round(config.backpressureDelayMs * (1 + delayFactor));

      return {
        shouldThrottle: true,
        delayMs,
        reason: "backpressure",
        utilizationRate: Math.round(utilizationRate * 100) / 100,
      };
    }

    return { shouldThrottle: false, delayMs: 0 };
  }

  /**
   * 获取连接池统计
   * @returns {Object}
   */
  function getStats() {
    return {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      rejectedConnections: stats.rejectedConnections,
      backpressureEvents: stats.backpressureEvents,
      keepAliveReused: stats.keepAliveReused,
      utilizationRate: stats.activeConnections / config.maxConnections,
      hostConnectionCounts: Object.fromEntries(stats.hostConnections),
    };
  }

  /**
   * 获取健康状态
   * @returns {Object}
   */
  function getHealth() {
    const utilization = stats.activeConnections / config.maxConnections;
    let status = "healthy";
    if (utilization > 0.9) status = "critical";
    else if (utilization > 0.7) status = "warning";

    return {
      status,
      activeConnections: stats.activeConnections,
      maxConnections: config.maxConnections,
      utilization: Math.round(utilization * 100) / 100,
    };
  }

  return {
    getServerConfig,
    getAgentConfig,
    recordConnection,
    recordDisconnection,
    recordKeepAliveReuse,
    shouldThrottle,
    getStats,
    getHealth,
    config,
  };
}
