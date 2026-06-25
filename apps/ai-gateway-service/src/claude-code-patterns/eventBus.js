/**
 * EventBus - 增强型事件总线
 *
 * 从 eventDrivenPipeline.js 拆出的事件总线工厂:
 * - 基于 Node.js EventEmitter
 * - emit 时检查 stopImmediatePropagation
 * - 禁用 maxListeners 警告
 * - 所有事件自动包装为 PipelineEvent
 *
 * @module eventBus
 */

import { EventEmitter as NodeEventEmitter } from "node:events";
import { PipelineEvent } from "./eventTypes.js";

// ============================================================
// 增强型事件总线（借鉴 Claude Code 的 EventEmitter）
// ============================================================

/**
 * 创建增强型事件总线
 *
 * 借鉴 Claude Code 的 EventEmitter 类:
 * - 基于 Node.js EventEmitter
 * - emit 时检查 stopImmediatePropagation
 * - 禁用 maxListeners 警告（React 组件可能大量监听）
 * - 所有事件自动包装为 PipelineEvent
 *
 * @returns {Object} 事件总线实例
 */
export function createEventBus() {
  const emitter = new NodeEventEmitter();
  // 禁用最大监听器限制（借鉴 Claude Code: this.setMaxListeners(0)）
  emitter.setMaxListeners(0);

  /** 事件中间件（在分发前执行） */
  const middlewares = [];

  return {
    /**
     * 订阅事件
     */
    on(type, handler) {
      emitter.on(type, handler);
      return () => emitter.off(type, handler);
    },

    /**
     * 订阅事件（仅执行一次）
     */
    once(type, handler) {
      emitter.once(type, handler);
      return () => emitter.off(type, handler);
    },

    /**
     * 取消订阅
     */
    off(type, handler) {
      emitter.off(type, handler);
    },

    /**
     * 发布事件
     * 借鉴 Claude Code EventEmitter.emit():
     * - 创建 PipelineEvent 包装
     * - 遍历监听器时检查 stopImmediatePropagation
     * - 执行中间件链
     */
    emit(type, data = {}) {
      const event = data instanceof PipelineEvent
        ? data
        : new PipelineEvent(type, data);

      // 执行中间件
      for (const mw of middlewares) {
        try {
          mw(event);
        } catch {
          // 中间件错误不阻止事件传播
        }
        if (event.isImmediatePropagationStopped()) break;
      }

      if (event.isImmediatePropagationStopped()) {
        return false;
      }

      // 借鉴 Claude Code: 遍历监听器，检查 stopImmediatePropagation
      const listeners = emitter.rawListeners(type);
      if (listeners.length === 0) return false;

      for (const listener of listeners) {
        listener.call(emitter, event);
        if (event.isImmediatePropagationStopped()) break;
      }

      return true;
    },

    /**
     * 添加事件中间件（在所有事件分发前执行）
     */
    use(middleware) {
      middlewares.push(middleware);
      return () => {
        const idx = middlewares.indexOf(middleware);
        if (idx >= 0) middlewares.splice(idx, 1);
      };
    },

    /**
     * 获取监听器数量
     */
    listenerCount(type) {
      return emitter.listenerCount(type);
    },

    /**
     * 移除所有监听器
     */
    removeAllListeners(type) {
      emitter.removeAllListeners(type);
    },
  };
}
