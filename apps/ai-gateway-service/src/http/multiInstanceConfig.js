// Multi-instance defaults.
//
// AI_GATEWAY_MULTI_INSTANCE=true 声明“同主机多进程部署”（见
// docs/multi-process-deployment.md）。此时需要跨进程一致的状态默认使用
// SQLite 共享文件（限流计数、幂等去重），而不是进程内内存；显式配置的
// store-mode env 永远优先。跨主机多实例请显式配置 postgres 模式。
//
// 共享 HMAC secret：自动 sqlite 路径下若未显式配置 secret，则从专用文件
// 加载或首次生成（64 字节随机、0600），保证多进程签名一致。secret 文件
// 绝不进入日志。

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve as resolvePath } from "node:path";

export const MULTI_INSTANCE_ENV = "AI_GATEWAY_MULTI_INSTANCE";
export const DEFAULT_SHARED_SECRET_PATH = ".data/shared-hmac-secret.key";

export function isMultiInstanceEnabled(env = process.env) {
  return String(env[MULTI_INSTANCE_ENV] ?? "").trim().toLowerCase() === "true";
}

/**
 * 解析 store mode：显式 env > 多实例默认(sqlite) > 组件默认(undefined)。
 */
export function resolveMultiInstanceStoreMode(env = process.env, explicitMode = undefined) {
  if (explicitMode) return explicitMode;
  if (isMultiInstanceEnabled(env)) return "sqlite";
  return undefined;
}

/**
 * 加载或生成共享 HMAC secret（仅自动 sqlite 路径使用）。
 * 返回字符串（≥32 字节）或 null（文件不可用且未启用多实例）。
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   secretPath?: string;
 *   explicitSecret?: string | null;
 * }} [options]
 */
export function loadOrCreateSharedSecret({
  env = process.env,
  secretPath = env.AI_GATEWAY_SHARED_SECRET_PATH || DEFAULT_SHARED_SECRET_PATH,
  explicitSecret = null,
} = {}) {
  if (explicitSecret && Buffer.byteLength(String(explicitSecret)) >= 32) {
    return String(explicitSecret);
  }
  const absolutePath = resolvePath(process.cwd(), secretPath);
  try {
    if (existsSync(absolutePath)) {
      const existing = readFileSync(absolutePath, "utf8").trim();
      if (existing.length >= 64) return existing;
    }
    const generated = randomBytes(48).toString("hex");
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, generated, { encoding: "utf8", mode: 0o600 });
    try {
      chmodSync(absolutePath, 0o600);
    } catch {
      // Windows 等 chmod 尽力而为。
    }
    return generated;
  } catch {
    return null;
  }
}

export function getMultiInstanceStatus(env = process.env) {
  return {
    enabled: isMultiInstanceEnabled(env),
    enabledByEnv: MULTI_INSTANCE_ENV,
    defaultSharedStoreMode: isMultiInstanceEnabled(env) ? "sqlite" : "memory",
    notes: isMultiInstanceEnabled(env)
      ? "Cross-process SQLite defaults active; configure postgres modes explicitly for cross-host instances."
      : "Single-process defaults; set AI_GATEWAY_MULTI_INSTANCE=true for same-host multi-process shared stores.",
  };
}
