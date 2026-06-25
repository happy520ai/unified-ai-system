/**
 * EventQueue - 有界事件队列
 *
 * 从 eventDrivenPipeline.js 拆出的有界事件队列:
 * - MAX_QUEUE_SIZE = 1000
 * - enqueue: 入队，超出上限时丢弃最旧的
 * - drain: 批量消费所有事件
 *
 * @module eventQueue
 */

import { randomUUID } from "node:crypto";

// ============================================================
// 有界事件队列（借鉴 Claude Code 的 sdkEventQueue）
// ============================================================

/**
 * 创建有界事件队列
 *
 * 借鉴 Claude Code 的 sdkEventQueue:
 * - MAX_QUEUE_SIZE = 1000
 * - enqueueSdkEvent: 入队，超出上限时丢弃最旧的
 * - drainSdkEvents: 批量消费所有事件
 *
 * @param {Object} options
 * @param {number} [options.maxSize] - 队列最大容量
 * @returns {Object} 事件队列实例
 */
export function createEventQueue(options = {}) {
  const maxSize = options.maxSize || 1000;
  const queue = [];

  return {
    /**
     * 入队事件
     * 借鉴 enqueueSdkEvent: 超出上限时移除最旧条目
     */
    enqueue(event) {
      if (queue.length >= maxSize) {
        queue.shift(); // 丢弃最旧的事件
      }
      queue.push({
        ...event,
        uuid: event.eventId || randomUUID(),
        session_id: event.sessionId || null,
      });
    },

    /**
     * 批量出队所有事件（drain 模式）
     * 借鉴 drainSdkEvents: 一次性取出并清空队列
     */
    drain() {
      if (queue.length === 0) return [];
      return queue.splice(0);
    },

    /**
     * 查看队列当前大小
     */
    size() {
      return queue.length;
    },

    /**
     * 清空队列
     */
    clear() {
      queue.length = 0;
    },
  };
}
