// =============================================================================
// 真实技能注册表 (Live Skill Registry)
// 管理已注册的神经元技能包，支持注册、查询、执行和吊销
//
// 与 neural-fabric-runtime 的 mock-only skillRegistry 不同，
// 这个注册表支持真实的技能注册、查询、执行和吊销。
// =============================================================================

import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { now } from "./liveSkillRegistry-utils.js";
import { REGISTRY_VERSION, loadRegistry, saveRegistry } from "./liveSkillRegistry-persistence.js";
import {
  registerSkill,
  executeSkill,
  revokeSkill,
  enableSkill,
  disableSkill,
  getStats,
  healthCheck,
} from "./liveSkillRegistry-methods.js";

// ---------------------------------------------------------------------------
// 路径常量
// ---------------------------------------------------------------------------

/** 当前模块所在目录 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 项目根目录（ai-gateway-service）
 * 从 src/capabilities/ 向上两级到达 ai-gateway-service/
 */
const ROOT = resolve(__dirname, "../..");

/** 默认注册表文件路径 */
const DEFAULT_REGISTRY_PATH = join(ROOT, ".data", "capabilities", "registry.json");

/** 默认执行日志文件路径 */
const DEFAULT_EXECUTION_LOG_PATH = join(ROOT, ".data", "capabilities", "execution-log.jsonl");

// ---------------------------------------------------------------------------
// 工厂函数：创建真实技能注册表
// ---------------------------------------------------------------------------

/**
 * 创建真实技能注册表实例
 *
 * @param {Object} [options={}] - 配置选项
 * @param {string} [options.registryPath] - 注册表 JSON 文件路径
 * @param {string} [options.executionLogPath] - 执行日志 JSONL 文件路径
 * @param {string} [options.rootDir] - 项目根目录
 * @param {number} [options.defaultTimeoutMs=30000] - 默认执行超时
 * @returns {Object} 注册表 API 对象
 */
export function createLiveSkillRegistry(options = {}) {
  const registryPath = options.registryPath || DEFAULT_REGISTRY_PATH;
  const executionLogPath = options.executionLogPath || DEFAULT_EXECUTION_LOG_PATH;
  const rootDir = options.rootDir || ROOT;
  const defaultTimeoutMs = options.defaultTimeoutMs || 30000;

  /**
   * 内存缓存：已加载的技能工厂函数
   * Map<skillId, { factory: Function, module: Object, loadedAt: string }>
   */
  const factoryCache = new Map();

  /**
   * 内存缓存：注册表数据（懒加载）
   * @type {Object|null}
   */
  let registryData = null;

  // -------------------------------------------------------------------------
  // 内部方法
  // -------------------------------------------------------------------------

  /** 确保注册表数据已加载到内存 */
  async function ensureLoaded() {
    if (!registryData) {
      registryData = await loadRegistry(registryPath);
    }
    return registryData;
  }

  /** 将当前内存中的注册表数据持久化到磁盘 */
  async function persist() {
    if (registryData) {
      await saveRegistry(registryPath, registryData);
    }
  }

  /** 根据 skillId 在注册表中查找技能条目 */
  async function findSkill(skillId) {
    const data = await ensureLoaded();
    return data.skills.find((s) => s.skillId === skillId) || null;
  }

  /** 解析代码文件的绝对路径 */
  function resolveCodePath(codePath) {
    if (resolve(codePath) === codePath || codePath.startsWith("\\\\") || codePath.match(/^[A-Za-z]:\\/)) {
      return codePath;
    }
    return join(rootDir, codePath);
  }

  /** 动态加载技能代码模块并提取工厂函数 */
  async function loadSkillModule(absoluteCodePath, skillId) {
    const cached = factoryCache.get(skillId);
    if (cached) {
      return { factory: cached.factory, module: cached.module };
    }

    const fileUrl = pathToFileURL(absoluteCodePath).href;
    const mod = await import(fileUrl);

    let factory = null;
    if (typeof mod.createNeuron === "function") {
      factory = mod.createNeuron;
    } else if (typeof mod.create === "function") {
      factory = mod.create;
    } else if (typeof mod.default === "function") {
      factory = mod.default;
    } else if (typeof mod.execute === "function") {
      factory = () => ({ execute: mod.execute });
    }

    factoryCache.set(skillId, { factory, module: mod, loadedAt: now() });
    return { factory, module: mod };
  }

  /** 更新技能的执行统计信息 */
  async function updateExecutionStats(skillId, executionMs, success) {
    const skill = await findSkill(skillId);
    if (!skill) return;

    skill.executionCount = (skill.executionCount || 0) + 1;
    skill.lastExecutedAt = now();

    if (skill.avgExecutionMs === null || skill.avgExecutionMs === undefined) {
      skill.avgExecutionMs = executionMs;
    } else {
      const n = skill.executionCount;
      skill.avgExecutionMs = Math.round(
        (skill.avgExecutionMs * (n - 1) + executionMs) / n,
      );
    }

    if (!success) {
      skill.errorCount = (skill.errorCount || 0) + 1;
    }

    await persist();
  }

  // -------------------------------------------------------------------------
  // 构建共享上下文（传递给提取的方法模块）
  // -------------------------------------------------------------------------

  const ctx = {
    registryPath,
    executionLogPath,
    rootDir,
    defaultTimeoutMs,
    factoryCache,
    REGISTRY_VERSION,
    dirnameFn: dirname,
    ensureLoaded,
    persist,
    findSkill,
    resolveCodePath,
    loadSkillModule,
    updateExecutionStats,
  };

  // -------------------------------------------------------------------------
  // 公开 API
  // -------------------------------------------------------------------------

  const api = {
    /** 注册表版本标识 */
    version: REGISTRY_VERSION,
    /** 注册表文件路径 */
    registryPath,
    /** 执行日志路径 */
    executionLogPath,
    /** 项目根目录 */
    rootDir,

    /** 注册一个新的神经元技能包 */
    register(def) { return registerSkill(ctx, def); },

    /** 根据 skillId 获取单个技能条目 */
    async get(skillId) {
      if (typeof skillId !== "string" || skillId.trim().length === 0) {
        throw new TypeError("skillId must be a non-empty string");
      }
      const skill = await findSkill(skillId);
      return skill ? { ...skill } : null;
    },

    /** 列出技能，支持按 type 和 status 过滤 */
    async list(filter = {}) {
      const data = await ensureLoaded();
      let results = [...data.skills];
      if (filter.type) results = results.filter((s) => s.type === filter.type);
      if (filter.status) results = results.filter((s) => s.status === filter.status);
      if (filter.admissionStatus) results = results.filter((s) => s.admissionStatus === filter.admissionStatus);
      const total = results.length;
      const offset = filter.offset || 0;
      const limit = filter.limit || 100;
      results = results.slice(offset, offset + limit);
      return {
        skills: results.map((s) => ({ ...s })),
        total,
        filter: { type: filter.type || null, status: filter.status || null, admissionStatus: filter.admissionStatus || null },
        pagination: { offset, limit, total },
      };
    },

    /** 按名称或描述模糊搜索技能 */
    async search(query) {
      if (typeof query !== "string" || query.trim().length === 0) {
        return { skills: [], query: "", matchCount: 0 };
      }
      const data = await ensureLoaded();
      const keyword = query.toLowerCase().trim();
      const matched = data.skills.filter((s) => {
        const searchable = [s.skillId, s.capabilityId, s.type, s.description || ""].join(" ").toLowerCase();
        return searchable.includes(keyword);
      });
      return { skills: matched.map((s) => ({ ...s })), query, matchCount: matched.length };
    },

    /** 执行指定技能 */
    execute(skillId, input, context) { return executeSkill(ctx, skillId, input, context); },

    /** 吊销指定技能 */
    revoke(skillId, reason) { return revokeSkill(ctx, skillId, reason); },

    /** 启用已被禁用的技能 */
    enable(skillId) { return enableSkill(ctx, skillId); },

    /** 禁用技能（可恢复） */
    disable(skillId, reason) { return disableSkill(ctx, skillId, reason); },

    /** 获取注册表整体统计信息 */
    getStats() { return getStats(ctx); },

    /** 注册表健康检查 */
    healthCheck() { return healthCheck(ctx); },

    /** 强制重新加载注册表数据（丢弃内存缓存） */
    async reload() {
      registryData = null;
      factoryCache.clear();
      await ensureLoaded();
    },

    /** 清除所有缓存的模块（用于热更新场景） */
    clearModuleCache() { factoryCache.clear(); },

    /** 获取注册表中所有技能的 ID 列表 */
    async listSkillIds() {
      const data = await ensureLoaded();
      return data.skills.map((s) => s.skillId);
    },

    /** 导出注册表完整数据（只读快照） */
    async exportSnapshot() {
      const data = await ensureLoaded();
      return JSON.parse(JSON.stringify(data));
    },
  };

  return api;
}
