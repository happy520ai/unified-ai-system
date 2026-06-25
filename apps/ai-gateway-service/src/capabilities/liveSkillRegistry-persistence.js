// =============================================================================
// liveSkillRegistry-persistence.js
// Registry persistence read/write and execution log helpers
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileExists, now } from "./liveSkillRegistry-utils.js";

/** 注册表版本标识 */
export const REGISTRY_VERSION = "live-skill-registry-v1";

/**
 * 确保目录存在（递归创建）
 * @param {string} dirPath - 目标目录路径
 */
async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 从磁盘读取注册表数据
 * @param {string} registryPath - 注册表文件路径
 * @returns {Promise<Object>} 注册表数据对象
 */
export async function loadRegistry(registryPath) {
  if (!(await fileExists(registryPath))) {
    // 注册表不存在时返回空结构
    return {
      version: REGISTRY_VERSION,
      skills: [],
      createdAt: now(),
      updatedAt: now(),
    };
  }

  try {
    const raw = await readFile(registryPath, "utf8");
    const data = JSON.parse(raw);

    // 版本校验
    if (data.version !== REGISTRY_VERSION) {
      console.warn(
        `[liveSkillRegistry] Registry version mismatch: expected "${REGISTRY_VERSION}", got "${data.version}". Migrating...`,
      );
      data.version = REGISTRY_VERSION;
    }

    if (!Array.isArray(data.skills)) {
      data.skills = [];
    }

    return data;
  } catch (error) {
    console.error(`[liveSkillRegistry] Failed to load registry: ${error.message}`);
    // 损坏时返回空结构（不覆盖原文件）
    return {
      version: REGISTRY_VERSION,
      skills: [],
      createdAt: now(),
      updatedAt: now(),
      loadError: error.message,
    };
  }
}

/**
 * 将注册表数据写入磁盘（原子写入：先写临时文件再重命名）
 * @param {string} registryPath - 注册表文件路径
 * @param {Object} data - 注册表数据
 */
export async function saveRegistry(registryPath, data) {
  await ensureDir(dirname(registryPath));
  data.updatedAt = now();
  const json = JSON.stringify(data, null, 2);
  const tmpPath = registryPath + ".tmp";
  await writeFile(tmpPath, json, "utf8");
  // 使用 rename 实现原子写入（在 Windows 上 rename 不是严格原子但足够安全）
  const { rename } = await import("node:fs/promises");
  await rename(tmpPath, registryPath);
}

/**
 * 追加一条执行日志到 JSONL 文件
 * @param {string} logPath - 日志文件路径
 * @param {Object} entry - 日志条目
 */
export async function appendExecutionLog(logPath, entry) {
  await ensureDir(dirname(logPath));
  const line = JSON.stringify(entry) + "\n";
  const { appendFile } = await import("node:fs/promises");
  await appendFile(logPath, line, "utf8");
}
