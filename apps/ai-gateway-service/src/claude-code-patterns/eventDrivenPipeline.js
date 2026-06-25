/**
 * EventDrivenPipeline - 事件驱动管线模块
 *
 * 借鉴 Claude Code v2.1.88 的事件系统模式:
 * - EventEmitter: 增强型事件发射器，支持 stopImmediatePropagation()
 * - ClaudeCodeInternalEvent: 结构化事件（event_name, client_timestamp, session_id, model, env）
 * - SdkEvent: 任务生命周期事件（task_started, task_progress, task_notification, session_state_changed）
 * - sdkEventQueue: 有界事件队列（MAX_QUEUE_SIZE），drain 模式批量消费
 *
 * PME 适配:
 * - 定义标准事件类型: request.received, request.classified, model.selected,
 *   model.called, response.scored, response.delivered
 * - 事件总线: 发布/订阅模式，支持 stopImmediatePropagation
 * - 事件持久化: 写入 .data/events/ 目录（JSONL 格式）
 * - 事件回放: 从事件日志重建请求处理流程
 *
 * @module eventDrivenPipeline
 */

import { randomUUID } from "node:crypto";
import { EVENT_TYPES, PipelineEvent } from "./eventTypes.js";
import { createEventBus } from "./eventBus.js";
import { createEventPersistence, createEventReplayer } from "./eventPersistence.js";
import { createEventQueue } from "./eventQueue.js";

// ============================================================
// 事件驱动管线 - 主入口
// ============================================================

/**
 * 创建事件驱动管线
 *
 * 将事件总线、持久化、回放、队列集成为一个统一的管线:
 * - 所有事件自动持久化
 * - 请求生命周期自动追踪
 * - 支持事件回放与统计
 *
 * @param {Object} options
 * @param {string} [options.eventsDir] - 事件存储目录
 * @param {boolean} [options.persistEnabled] - 是否启用持久化
 * @param {boolean} [options.queueEnabled] - 是否启用事件队列
 * @returns {Object} 管线实例
 */
export function createEventDrivenPipeline(options = {}) {
  const {
    eventsDir,
    persistEnabled = true,
    queueEnabled = true,
  } = options;

  // 创建子组件
  const eventBus = createEventBus();
  const persistence = persistEnabled ? createEventPersistence({ eventsDir }) : null;
  const replayer = persistence ? createEventReplayer(persistence) : null;
  const eventQueue = queueEnabled ? createEventQueue() : null;

  // 注册持久化中间件：所有事件自动写入持久化存储
  if (persistence) {
    eventBus.use((event) => {
      persistence.persist(event);
    });
  }

  // 注册队列中间件：所有事件自动入队
  if (eventQueue) {
    eventBus.use((event) => {
      eventQueue.enqueue(event);
    });
  }

  /**
   * 发布管线事件（便捷方法）
   *
   * @param {string} type - 事件类型（使用 EVENT_TYPES 常量）
   * @param {Object} data - 事件数据
   * @param {Object} [meta] - 元数据
   * @param {string} [meta.sessionId] - 会话 ID
   * @param {string} [meta.requestId] - 请求 ID
   * @returns {PipelineEvent} 创建的事件
   */
  function emitPipelineEvent(type, data = {}, meta = {}) {
    const event = new PipelineEvent(type, {
      ...data,
      sessionId: meta.sessionId || data.sessionId || null,
      requestId: meta.requestId || data.requestId || null,
    });
    eventBus.emit(type, event);
    return event;
  }

  /**
   * 创建请求追踪上下文
   * 为一个请求的所有事件共享同一个 requestId 和 sessionId
   */
  function createRequestContext(sessionId) {
    const requestId = randomUUID();
    return {
      requestId,
      sessionId: sessionId || randomUUID(),

      /** 发布此请求的事件 */
      emit(type, data = {}) {
        return emitPipelineEvent(type, data, {
          requestId: this.requestId,
          sessionId: this.sessionId,
        });
      },

      /** 标记请求开始 */
      markReceived(inputData = {}) {
        return this.emit(EVENT_TYPES.REQUEST_RECEIVED, {
          inputPreview: inputData.preview || "",
          inputLength: inputData.length || 0,
        });
      },

      /** 标记请求已分类 */
      markClassified(classification = {}) {
        return this.emit(EVENT_TYPES.REQUEST_CLASSIFIED, classification);
      },

      /** 标记模型已选择 */
      markModelSelected(modelInfo = {}) {
        return this.emit(EVENT_TYPES.MODEL_SELECTED, modelInfo);
      },

      /** 标记模型已调用 */
      markModelCalled(callInfo = {}) {
        return this.emit(EVENT_TYPES.MODEL_CALLED, callInfo);
      },

      /** 标记响应已评分 */
      markResponseScored(scoreInfo = {}) {
        return this.emit(EVENT_TYPES.RESPONSE_SCORED, scoreInfo);
      },

      /** 标记响应已交付 */
      markResponseDelivered(deliveryInfo = {}) {
        return this.emit(EVENT_TYPES.RESPONSE_DELIVERED, deliveryInfo);
      },
    };
  }

  return {
    // 事件总线 API
    eventBus: {
      on: eventBus.on.bind(eventBus),
      once: eventBus.once.bind(eventBus),
      off: eventBus.off.bind(eventBus),
      emit: eventBus.emit.bind(eventBus),
      use: eventBus.use.bind(eventBus),
      listenerCount: eventBus.listenerCount.bind(eventBus),
      removeAllListeners: eventBus.removeAllListeners.bind(eventBus),
    },

    // 管线便捷 API
    emit: emitPipelineEvent,
    createRequestContext,

    // 持久化 API
    persistence: persistence
      ? {
          readEvents: persistence.readEvents.bind(persistence),
          listEventFiles: persistence.listEventFiles.bind(persistence),
          getEventsDir: persistence.getEventsDir.bind(persistence),
        }
      : null,

    // 回放 API
    replayer: replayer
      ? {
          replayRequest: replayer.replayRequest.bind(replayer),
          replaySession: replayer.replaySession.bind(replayer),
          getEventSummary: replayer.getEventSummary.bind(replayer),
        }
      : null,

    // 队列 API
    queue: eventQueue
      ? {
          enqueue: eventQueue.enqueue.bind(eventQueue),
          drain: eventQueue.drain.bind(eventQueue),
          size: eventQueue.size.bind(eventQueue),
          clear: eventQueue.clear.bind(eventQueue),
        }
      : null,

    // 健康状态
    getHealth() {
      return {
        status: "ready",
        persistEnabled: persistence !== null,
        queueEnabled: eventQueue !== null,
        queueSize: eventQueue ? eventQueue.size() : 0,
        eventsDir: persistence ? persistence.getEventsDir() : null,
        eventFiles: persistence ? persistence.listEventFiles().length : 0,
      };
    },
  };
}

// ============================================================
// 公共 API 导出（re-export from sibling modules）
// ============================================================

export { EVENT_TYPES, PipelineEvent } from "./eventTypes.js";
export { createEventBus } from "./eventBus.js";
export { createEventPersistence, createEventReplayer } from "./eventPersistence.js";
export { createEventQueue } from "./eventQueue.js";
