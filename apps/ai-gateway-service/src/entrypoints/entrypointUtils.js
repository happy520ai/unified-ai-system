// =============================================================================
// entrypointUtils.js — 入口脚本共享工具（逆熵元法则 · 剃刀律）
//
// 本模块消除 entrypoints/ 中 58+ 次 sleep、137+ 次 fetchJson、
// 127+ 次 readJson、130+ 次 writeEvidence 的重复定义。
//
// 所有验证/冒烟脚本必须从此导入，禁止本地重定义。
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── 时间控制 ────────────────────────────────────────────────────────────────

/**
 * 异步等待指定毫秒数
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── HTTP 工具 ───────────────────────────────────────────────────────────────

/**
 * GET 请求并解析 JSON
 * @param {string} url
 * @param {RequestInit} [options]
 */
export async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

/**
 * GET 请求并读取文本
 * @param {string} url
 * @param {RequestInit} [options]
 */
export async function fetchText(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * POST 请求发送 JSON
 * @param {string} url
 * @param {unknown} body
 * @param {RequestInit} [options]
 */
export async function postJson(url, body, options) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...options,
  });
}

// ── 文件工具 ────────────────────────────────────────────────────────────────

/**
 * 读取 JSON 文件，不存在时返回 null
 * @param {string} filePath
 * @returns {Promise<unknown|null>}
 */
export async function readJson(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "EISDIR") return null;
    throw err;
  }
}

/**
 * 同步读取 JSON 文件，不存在时返回 null
 * @param {string} filePath
 */
export function readJsonSync(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * 读取文本文件，不存在时返回 null
 * @param {string} filePath
 */
export async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// ── 写入工具 ────────────────────────────────────────────────────────────────

/**
 * 写入 JSON 文件（自动创建目录）
 * @param {string} filePath
 * @param {unknown} value
 */
export async function writeJson(filePath, value) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

// ── Evidence 工具 ───────────────────────────────────────────────────────────

/**
 * 写入 JSON evidence 文件
 * @param {string} evidenceDir - evidence 目录路径
 * @param {string} filename - 文件名（不含目录）
 * @param {object} body - evidence 内容
 */
export function writeEvidenceJson(evidenceDir, filename, body) {
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }
  const filePath = join(evidenceDir, filename);
  writeFileSync(filePath, JSON.stringify(body, null, 2), "utf8");
  return filePath;
}

/**
 * 生成 evidence Markdown 文本
 * @param {object} fields - key-value 对
 * @returns {string}
 */
export function createEvidenceMarkdown(fields) {
  const lines = ["# Evidence Report", ""];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object") {
      lines.push(`## ${key}`, "", "```json", JSON.stringify(value, null, 2), "```", "");
    } else {
      lines.push(`- **${key}:** ${value}`);
    }
  }
  return lines.join("\n");
}

/**
 * 写入 Markdown evidence 文件
 * @param {string} evidenceDir
 * @param {string} filename
 * @param {object} fields
 */
export function writeEvidenceMarkdown(evidenceDir, filename, fields) {
  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }
  const filePath = join(evidenceDir, filename);
  writeFileSync(filePath, createEvidenceMarkdown(fields), "utf8");
  return filePath;
}

/**
 * 异步写入 evidence JSON + MD 文件对。
 * 各 entrypoint 保留自己的 createEvidenceMarkdown 渲染器，
 * 但共享统一的 mkdir + writeFile 流程。
 * @param {string} evidenceDir - evidence 目录
 * @param {string} jsonPath - JSON 文件完整路径
 * @param {string} mdPath - MD 文件完整路径
 * @param {object} body - evidence 内容
 */
export async function writeEvidencePair(evidenceDir, jsonPath, mdPath, body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(mdPath, createEvidenceMarkdown(body), "utf8");
}

/**
 * 异步写入 evidence JSON + MD 文件对（自定义 MD 渲染器）。
 * @param {string} evidenceDir
 * @param {string} jsonPath
 * @param {string} mdPath
 * @param {object} body
 * @param {(body: object) => string} renderMarkdown - 自定义 MD 渲染函数
 */
export async function writeEvidenceWithRenderer(evidenceDir, jsonPath, mdPath, body, renderMarkdown) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderMarkdown(body), "utf8");
}

/**
 * 同步写入 evidence JSON + MD 文件对（自定义 MD 渲染器）。
 * @param {string} evidenceDir
 * @param {string} jsonPath
 * @param {string} mdPath
 * @param {object} body
 * @param {(body: object) => string} renderMarkdown - 自定义 MD 渲染函数
 */
export function writeEvidenceSync(evidenceDir, jsonPath, mdPath, body, renderMarkdown) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderMarkdown(body), "utf8");
}

/**
 * 同步写入 evidence JSON + MD 文件对。
 * @param {string} evidenceDir - evidence 目录
 * @param {string} jsonPath - JSON 文件完整路径
 * @param {string} mdPath - MD 文件完整路径
 * @param {object} body - evidence 内容
 */
export function writeEvidencePairSync(evidenceDir, jsonPath, mdPath, body) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, createEvidenceMarkdown(body), "utf8");
}

// ── 服务启动辅助 ─────────────────────────────────────────────────────────────

/**
 * 等待服务健康检查通过
 * @param {string} baseUrl - 如 http://127.0.0.1:3100
 * @param {object} [options]
 * @param {number} [options.maxWaitMs=30000]
 * @param {number} [options.intervalMs=1000]
 * @param {string} [options.healthPath=/health/check]
 * @returns {Promise<object>} health 响应
 */
export async function waitForHealth(baseUrl, options = {}) {
  const {
    maxWaitMs = 30_000,
    intervalMs = 1_000,
    healthPath = "/health/check",
  } = options;
  const deadline = Date.now() + maxWaitMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const health = await fetchJson(`${baseUrl}${healthPath}`);
      if (health?.status === "ok" || health?.ready === true) return health;
    } catch (err) {
      lastError = err;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Service at ${baseUrl} did not become healthy within ${maxWaitMs}ms: ${lastError?.message ?? "unknown"}`);
}

// ── 浏览器辅助 ───────────────────────────────────────────────────────────────

/**
 * 查找本地 Chrome/Edge 可执行路径
 * @returns {string|null}
 */
export function findBrowserPath() {
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
          ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

// ── 服务启动/关闭辅助 ─────────────────────────────────────────────────────────

/**
 * 启动 HTTP 服务并等待就绪
 * @param {import("node:http").Server} server
 * @param {number} [port=0]
 * @param {string} [host="127.0.0.1"]
 * @returns {Promise<void>}
 */
export function listen(server, port = 0, host = "127.0.0.1") {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

/**
 * 关闭 HTTP 服务
 * @param {import("node:http").Server} server
 * @returns {Promise<void>}
 */
export function close(server) {
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
}
