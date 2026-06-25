/**
 * EventPersistence & EventReplayer - 事件持久化与回放
 *
 * 从 eventDrivenPipeline.js 拆出的持久化与回放模块:
 * - createEventPersistence: JSONL 文件事件持久化
 * - createEventReplayer: 从事件日志重建请求处理流程
 *
 * @module eventPersistence
 */

import { mkdirSync, appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { PipelineEvent } from "./eventTypes.js";

// ============================================================
// 事件持久化（JSONL 文件）
// ============================================================

/**
 * 创建事件持久化器
 *
 * 借鉴 Claude Code 的事件日志模式:
 * - 事件写入 .data/events/ 目录
 * - 按日期分文件（events-YYYY-MM-DD.jsonl）
 * - 每行一个 JSON 事件记录
 * - 支持按日期和请求 ID 回放
 *
 * @param {Object} options
 * @param {string} [options.eventsDir] - 事件存储目录
 * @param {number} [options.maxFileSizeBytes] - 单个文件最大大小
 * @returns {Object} 持久化器实例
 */
export function createEventPersistence(options = {}) {
  const eventsDir = options.eventsDir || resolve(".data/events");
  const maxFileSizeBytes = options.maxFileSizeBytes || 50 * 1024 * 1024; // 50MB

  // 确保目录存在
  if (!existsSync(eventsDir)) {
    mkdirSync(eventsDir, { recursive: true });
  }

  /**
   * 获取当天事件文件路径
   */
  function getEventsFilePath(date) {
    const d = date || new Date();
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    return join(eventsDir, `events-${dateStr}.jsonl`);
  }

  return {
    /**
     * 写入事件到持久化存储
     */
    persist(event) {
      const filePath = getEventsFilePath(
        event.timestamp ? new Date(event.timestamp) : new Date()
      );
      const line = JSON.stringify(event instanceof PipelineEvent ? event.toJSON() : event) + "\n";
      appendFileSync(filePath, line, "utf-8");
    },

    /**
     * 读取指定日期的事件
     *
     * @param {string|Date} [date] - 日期（默认今天）
     * @param {Object} [filter] - 过滤条件
     * @param {string} [filter.requestId] - 按请求 ID 过滤
     * @param {string} [filter.sessionId] - 按会话 ID 过滤
     * @param {string} [filter.type] - 按事件类型过滤
     * @returns {Object[]} 事件数组
     */
    readEvents(date, filter = {}) {
      const filePath = getEventsFilePath(date ? new Date(date) : new Date());
      if (!existsSync(filePath)) return [];

      const content = readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      let events = lines.map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);

      // 应用过滤条件
      if (filter.requestId) {
        events = events.filter((e) => e.requestId === filter.requestId);
      }
      if (filter.sessionId) {
        events = events.filter((e) => e.sessionId === filter.sessionId);
      }
      if (filter.type) {
        events = events.filter((e) => e.type === filter.type || e.type?.startsWith(filter.type + "."));
      }

      return events;
    },

    /**
     * 列出所有事件文件
     */
    listEventFiles() {
      if (!existsSync(eventsDir)) return [];
      return readdirSync(eventsDir)
        .filter((f) => f.startsWith("events-") && f.endsWith(".jsonl"))
        .sort()
        .reverse();
    },

    /**
     * 获取存储目录路径
     */
    getEventsDir() {
      return eventsDir;
    },
  };
}

// ============================================================
// 事件回放器 - 从事件日志重建请求处理流程
// ============================================================

/**
 * 创建事件回放器
 *
 * @param {Object} persistence - 事件持久化器实例
 * @returns {Object} 回放器实例
 */
export function createEventReplayer(persistence) {
  return {
    /**
     * 重建一个请求的完整处理流程
     *
     * @param {string} requestId - 请求 ID
     * @param {Object} [options]
     * @param {string|Date} [options.date] - 日期
     * @returns {Object} 请求处理流程摘要
     */
    replayRequest(requestId, options = {}) {
      const events = persistence.readEvents(options.date, { requestId });
      if (events.length === 0) {
        return { status: "not_found", requestId };
      }

      // 按时间排序
      events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // 提取关键阶段时间戳
      const stages = {};
      for (const event of events) {
        if (!stages[event.type]) {
          stages[event.type] = event.timestamp;
        }
      }

      // 计算各阶段耗时
      const timings = {};
      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];
        const key = `${prev.type} -> ${curr.type}`;
        timings[key] = new Date(curr.timestamp) - new Date(prev.timestamp);
      }

      const firstEvent = events[0];
      const lastEvent = events[events.length - 1];

      return {
        status: "success",
        requestId,
        sessionId: firstEvent.sessionId,
        totalEvents: events.length,
        startTime: firstEvent.timestamp,
        endTime: lastEvent.timestamp,
        totalDurationMs: new Date(lastEvent.timestamp) - new Date(firstEvent.timestamp),
        stages,
        timings,
        events,
      };
    },

    /**
     * 重建一个会话的完整历史
     */
    replaySession(sessionId, options = {}) {
      const events = persistence.readEvents(options.date, { sessionId });
      if (events.length === 0) {
        return { status: "not_found", sessionId };
      }

      events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // 按请求 ID 分组
      const requestGroups = new Map();
      for (const event of events) {
        const rid = event.requestId || "unknown";
        if (!requestGroups.has(rid)) {
          requestGroups.set(rid, []);
        }
        requestGroups.get(rid).push(event);
      }

      return {
        status: "success",
        sessionId,
        totalEvents: events.length,
        requestCount: requestGroups.size,
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
        requests: [...requestGroups.entries()].map(([rid, evts]) => ({
          requestId: rid,
          eventCount: evts.length,
          types: [...new Set(evts.map((e) => e.type))],
        })),
      };
    },

    /**
     * 获取指定日期的事件统计摘要
     */
    getEventSummary(date) {
      const events = persistence.readEvents(date);
      const typeCounts = {};
      for (const event of events) {
        typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
      }
      return {
        date: date || new Date().toISOString().slice(0, 10),
        totalEvents: events.length,
        typeCounts,
        uniqueRequests: new Set(events.map((e) => e.requestId).filter(Boolean)).size,
        uniqueSessions: new Set(events.map((e) => e.sessionId).filter(Boolean)).size,
      };
    },
  };
}
