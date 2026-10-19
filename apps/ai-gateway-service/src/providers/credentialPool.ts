// =============================================================================
// credentialPool.js — 单 provider 多 Key 池
//
// 一个 provider 可以挂多个 Key；每次出站调用按「余额 × 剩余有效期」加权随机
// 选一个，鉴权失败（401/403）或额度耗尽时换下一个 Key 重试，连续失败的 Key
// 进临时黑名单（默认 10 分钟）。
//
// 设计边界：
// - 不改变 runtimeCredentialStore 的「一 provider 一 Key」语义；池是叠加层。
// - 未配置池的 provider，取 Key 行为与既有代码完全一致（回归保护）。
// - 任何对外输出只给掩码指纹，不给明文 Key。
// =============================================================================

import { createCredentialPoolStore } from "./credentialPoolStore.ts";
import { createPinoLogger } from "../logging/pinoLogger.js";

const logger = createPinoLogger({ app: "credentialPool" });
const MS_PER_DAY = 86_400_000;
const DEFAULT_BENCH_MS = 10 * 60 * 1000;
const MIN_WEIGHT = 0.0001;
const MAX_ENTRIES = 100_000;

export type PoolEntry = {
  key: string;
  balance?: number;
  expire?: string | null;
  label?: string;
};

export type CredentialPoolOptions = {
  env?: Record<string, string | undefined>;
  storagePath?: string;
  now?: () => number;
  random?: () => number;
  benchMs?: number;
};

type InternalEntry = {
  key: string;
  label: string;
  balance: number;
  expire: string | null;
  successes: number;
  failures: number;
  addedAt: string;
};

export type PoolDescription = {
  providerId: string;
  size: number;
  alive: number;
  benched: number;
  exhausted: number;
  expiringWithin3Days: number;
  persisted: boolean;
};

/** 稳定指纹：只用于日志与去重，不可反推 Key。 */
export function fingerprintKey(key: string | null | undefined): string {
  const text = String(key ?? "");
  if (!text) return "";
  // djb2：非密码学用途，仅作日志标识，避免明文 Key 进入任何输出。
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return `${text.slice(0, 3)}…${hash.toString(16).padStart(8, "0")}`;
}

function remainingDays(expire: string | null, now: number): number {
  if (!expire) return Number.POSITIVE_INFINITY;
  const at = new Date(expire).getTime();
  if (!Number.isFinite(at)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (at - now) / MS_PER_DAY);
}

export function createCredentialPool({
  env = process.env as Record<string, string | undefined>,
  storagePath,
  now = Date.now,
  random = Math.random,
  benchMs = DEFAULT_BENCH_MS,
}: CredentialPoolOptions = {}) {
  const store = createCredentialPoolStore({ env, storagePath });
  const pools = new Map<string, Map<string, InternalEntry>>();
  const benched = new Map<string, Map<string, number>>();

  const allowed = normalizeEntryLimit(env.PME_CREDENTIAL_POOL_MAX_ENTRIES, MAX_ENTRIES);
  for (const record of store.readAll()) {
    const loaded = normalizePoolRecord(record, allowed);
    if (loaded) pools.set(loaded.providerId, loaded.entries);
  }

  function persist() {
    if (!store.enabled) return true;
    const records = Array.from(pools.entries()).map(([providerId, entries]) => ({
      providerId,
      keys: Array.from(entries.values()).map((entry) => ({
        key: entry.key, balance: entry.balance, expire: entry.expire, label: entry.label,
      })),
    }));
    return store.writeAll(records);
  }

  function poolFor(providerId: string, create = false): Map<string, InternalEntry> | null {
    const id = normalizeProviderId(providerId);
    if (!id) return null;
    let entries = pools.get(id);
    if (!entries && create) {
      entries = new Map();
      pools.set(id, entries);
    }
    return entries ?? null;
  }

  function benchMapFor(providerId: string, create = false): Map<string, number> | null {
    let map = benched.get(providerId);
    if (!map && create) {
      map = new Map();
      benched.set(providerId, map);
    }
    return map ?? null;
  }

  function usableEntries(providerId: string): InternalEntry[] {
    const entries = poolFor(providerId);
    if (!entries) return [];
    const bench = benched.get(providerId);
    const ts = now();
    return Array.from(entries.values()).filter((entry) => {
      if (entry.balance <= 0) return false;
      const expireAt = entry.expire ? new Date(entry.expire).getTime() : Number.POSITIVE_INFINITY;
      if (Number.isFinite(expireAt) && expireAt <= ts) return false;
      if (bench?.has(entry.key) && (bench.get(entry.key) ?? 0) > ts) return false;
      return true;
    });
  }

  return {
    /** 池是否存在（与「有没有 Key」区分：空池等于未配置）。 */
    has(providerId: string): boolean {
      const entries = poolFor(providerId);
      return Boolean(entries && entries.size > 0);
    },

    set(providerId: string, entries: PoolEntry[] = []): PoolDescription {
      const id = normalizeProviderId(providerId);
      if (!id) throw poolError("CREDENTIAL_POOL_PROVIDER_ID_REQUIRED", "providerId is required.");
      const normalized = normalizePoolRecord({ providerId: id, keys: entries }, allowed);
      if (!normalized) throw poolError("CREDENTIAL_POOL_ENTRIES_INVALID", "Pool entries must be an array of { key, balance?, expire? }.");
      const previous = pools.get(id);
      pools.set(id, normalized.entries);
      if (!persist()) {
        if (previous) pools.set(id, previous);
        else pools.delete(id);
        throw poolError("CREDENTIAL_POOL_PERSIST_FAILED",
          "Credential pool was not accepted because encrypted persistence failed.");
      }
      return this.describe(id) as PoolDescription;
    },

    clear(providerId: string): boolean {
      const id = normalizeProviderId(providerId);
      const previous = pools.get(id);
      if (!previous) return false;
      pools.delete(id);
      benched.delete(id);
      if (!persist()) {
        pools.set(id, previous);
        return false;
      }
      return true;
    },

    /** 按权重选 Key；无可选 Key 时返回 null，调用方回退到既有单 Key 逻辑。 */
    pick(providerId: string): string | null {
      const entries = usableEntries(providerId);
      if (entries.length === 0) return null;
      if (entries.length === 1) return entries[0].key;
      const ts = now();
      const weights = entries.map((entry) => {
        const days = remainingDays(entry.expire, ts);
        const daysWeight = Number.isFinite(days) ? days : 365;
        return Math.max(MIN_WEIGHT, entry.balance * daysWeight);
      });
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let roll = random() * total;
      for (let i = 0; i < entries.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return entries[i].key;
      }
      return entries[entries.length - 1].key;
    },

    /** 记账一次调用结果；失败且为鉴权/额度类时把该 Key 临时拉黑。 */
    record(providerId: string, key: string, ok: boolean, { benchOnFailure = true }: { benchOnFailure?: boolean } = {}): boolean {
      const entries = poolFor(providerId);
      const entry = entries?.get(key);
      if (!entry) return false;
      entry.successes = ok ? (entry.successes ?? 0) + 1 : entry.successes ?? 0;
      entry.failures = ok ? entry.failures ?? 0 : (entry.failures ?? 0) + 1;
      if (!ok && benchOnFailure) {
        benchMapFor(providerId, true)!.set(key, now() + benchMs);
      } else if (ok) {
        const bmap = benched.get(providerId);
        if (bmap) bmap.delete(key);
      }
      return true;
    },

    describe(providerId: string): PoolDescription | null {
      const id = normalizeProviderId(providerId);
      const entries = poolFor(id);
      if (!entries) return null;
      const ts = now();
      const bench = benched.get(id);
      let alive = 0;
      let benchedCount = 0;
      let exhausted = 0;
      let expiringSoon = 0;
      for (const entry of entries.values()) {
        const expireAt = entry.expire ? new Date(entry.expire).getTime() : Number.POSITIVE_INFINITY;
        const expired = Number.isFinite(expireAt) && expireAt <= ts;
        if (expired || entry.balance <= 0) {
          exhausted += 1;
          continue;
        }
        if (bench?.has(entry.key) && (bench.get(entry.key) ?? 0) > ts) {
          benchedCount += 1;
          continue;
        }
        alive += 1;
        if (Number.isFinite(expireAt) && expireAt - ts < 3 * MS_PER_DAY) expiringSoon += 1;
      }
      return {
        providerId: id,
        size: entries.size,
        alive,
        benched: benchedCount,
        exhausted,
        expiringWithin3Days: expiringSoon,
        persisted: store.enabled,
      };
    },
  };
}

function normalizeProviderId(providerId: unknown): string {
  return String(providerId ?? "").trim().toLowerCase();
}

function normalizeEntryLimit(raw: unknown, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePoolRecord(record: { providerId?: unknown; keys?: unknown } | null | undefined, limit: number): { providerId: string; entries: Map<string, InternalEntry> } | null {
  const providerId = normalizeProviderId(record?.providerId);
  if (!providerId || providerId.length > 128) return null;
  const keys = Array.isArray(record?.keys) ? record.keys : null;
  if (!keys) return null;
  // 去重：同一个 Key 在池里只保留一条（后者覆盖前者）。
  const entries = new Map();
  for (const raw of keys) {
    const key = String(raw?.key ?? "").trim();
    if (!key) continue;
    const balance = Number(raw?.balance);
    entries.set(key, {
      key,
      label: String(raw?.label ?? "").trim(),
      balance: Number.isFinite(balance) && balance > 0 ? balance : 0,
      expire: normalizeExpire(raw?.expire),
      successes: 0,
      failures: 0,
      addedAt: new Date().toISOString(),
    });
    if (entries.size >= limit) break;
  }
  return { providerId, entries };
}

function normalizeExpire(expire: unknown): string | null {
  if (!expire) return null;
  const at = new Date(String(expire)).getTime();
  if (!Number.isFinite(at)) return null;
  return new Date(at).toISOString();
}

function poolError(code: string, message: string): Error & { code: string; category: string; retryable: boolean } {
  const error = new Error(message) as Error & { code: string; category: string; retryable: boolean };
  error.code = code;
  error.category = "validation";
  error.retryable = false;
  return error;
}

export { logger as credentialPoolLogger };
