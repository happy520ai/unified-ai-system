// =============================================================================
// 进化历史管理器 (Evolution History Manager)
// =============================================================================

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeCapabilityId, fileExists, now } from "./selfEvolutionPipelineUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

/** 进化历史记录目录 */
const EVOLUTION_HISTORY_DIR = join(ROOT, ".data", "capabilities", "evolution-history");

/** 进化历史记录索引文件 */
const EVOLUTION_INDEX_PATH = join(ROOT, ".data", "capabilities", "evolution-index.json");

/**
 * 创建进化历史管理器
 * @returns {Object}
 */
export function createEvolutionHistoryManager() {
  /**
   * 内存中的进化索引
   * @type {Object[]|null}
   */
  let indexCache = null;

  /**
   * 加载进化索引
   * @returns {Promise<Object[]>}
   */
  async function loadIndex() {
    if (indexCache) return indexCache;

    if (!(await fileExists(EVOLUTION_INDEX_PATH))) {
      indexCache = [];
      return indexCache;
    }

    try {
      const raw = await readFile(EVOLUTION_INDEX_PATH, "utf8");
      indexCache = JSON.parse(raw);
      if (!Array.isArray(indexCache)) indexCache = [];
    } catch {
      indexCache = [];
    }
    return indexCache;
  }

  /**
   * 保存进化索引
   * @param {Object[]} data
   */
  async function saveIndex(data) {
    await mkdir(dirname(EVOLUTION_INDEX_PATH), { recursive: true });
    await writeFile(EVOLUTION_INDEX_PATH, JSON.stringify(data, null, 2), "utf8");
    indexCache = data;
  }

  return {
    /**
     * 记录一次进化
     * @param {Object} record - 进化记录
     */
    async addRecord(record) {
      const index = await loadIndex();
      index.push(record);
      await saveIndex(index);

      // 同时保存详细记录到独立文件
      await mkdir(EVOLUTION_HISTORY_DIR, { recursive: true });
      const detailPath = join(EVOLUTION_HISTORY_DIR, `${sanitizeCapabilityId(record.capabilityId)}.json`);
      await writeFile(detailPath, JSON.stringify(record, null, 2), "utf8");
    },

    /**
     * 列出所有进化记录
     * @param {Object} [options={}]
     * @param {number} [options.limit=50]
     * @param {string} [options.status] - 按状态过滤
     * @returns {Promise<Object[]>}
     */
    async listRecords({ limit = 50, status } = {}) {
      const index = await loadIndex();
      let results = [...index];

      if (status) {
        results = results.filter((r) => r.status === status);
      }

      // 按时间倒序（最新的在前）
      results.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      return results.slice(0, limit);
    },

    /**
     * 获取单次进化的详细记录
     * @param {string} capabilityId
     * @returns {Promise<Object|null>}
     */
    async getRecord(capabilityId) {
      const detailPath = join(EVOLUTION_HISTORY_DIR, `${sanitizeCapabilityId(capabilityId)}.json`);
      if (!(await fileExists(detailPath))) {
        // 从索引中查找摘要
        const index = await loadIndex();
        return index.find((r) => r.capabilityId === capabilityId) || null;
      }

      try {
        const raw = await readFile(detailPath, "utf8");
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    /**
     * 删除一条进化记录
     * @param {string} capabilityId
     * @returns {Promise<boolean>}
     */
    async removeRecord(capabilityId) {
      const index = await loadIndex();
      const newLen = index.length;
      const filtered = index.filter((r) => r.capabilityId !== capabilityId);

      if (filtered.length === newLen) {
        return false; // 未找到
      }

      await saveIndex(filtered);

      // 删除详细文件
      const detailPath = join(EVOLUTION_HISTORY_DIR, `${capabilityId}.json`);
      if (await fileExists(detailPath)) {
        await rm(detailPath, { force: true });
      }

      return true;
    },

    /**
     * 获取统计信息
     * @returns {Promise<Object>}
     */
    async getStats() {
      const index = await loadIndex();
      const byStatus = {};
      let totalDurationMs = 0;

      for (const r of index) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        if (r.durationMs) totalDurationMs += r.durationMs;
      }

      return {
        totalEvolutions: index.length,
        byStatus,
        avgDurationMs: index.length > 0 ? Math.round(totalDurationMs / index.length) : 0,
        lastEvolutionAt: index.length > 0
          ? index[index.length - 1].startedAt
          : null,
      };
    },

    /**
     * 清除缓存（强制下次从磁盘重新加载）
     */
    clearCache() {
      indexCache = null;
    },
  };
}
