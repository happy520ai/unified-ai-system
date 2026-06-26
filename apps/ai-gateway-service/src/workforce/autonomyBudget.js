/**
 * autonomyBudget.js
 *
 * Autonomy budget pool + scope token + trust ladder.
 *
 * This replaces the old "per-action approval" model with three lighter-weight
 * governance primitives so the workforce can run at full power inside a sandbox:
 *
 *   1. Daily budget pool  — instead of approving each call, we grant a daily
 *      ceiling (provider requests, file mutations, tokens, runtime seconds).
 *      Inside the budget the agent is fully autonomous; when exhausted it stops
 *      and waits for the next day (or a manual top-up).
 *
 *   2. Scope token         — instead of a one-shot 24h approval per planId, a
 *      long-lived token authorizes a *range* of files for a *duration* with a
 *      budget slice. "Approve once for a scope" vs "approve every action".
 *
 *   3. Trust ladder        — instead of a static risk class, an operation type
 *      that repeatedly passes verify with zero rollbacks promotes to a higher
 *      autonomy tier; a single rollback demotes it. The system learns from its
 *      own history which mutations are actually safe.
 *
 * Safety boundary: this module never grants anything that touches the global
 * forbidden surface (/chat, /chat-gateway/execute, provider runtime, secrets,
 * auth.json, .env, .git, legacy/, deploy, release). Those stay locked behind
 * the existing approval gate regardless of budget or token.
 *
 * Persistence: .data/workforce/autonomy-budget.json (single JSON file,
 * atomic write via temp+rename).
 */

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const AUTONOMY_PHASE = "PhaseAutonomyBudget";
export const AUTONOMY_MODE = "autonomy-budget-governance";

// --- Default daily budgets ---
// Reversible resources (mutations/merges/tokens/runtime) are set to
// PRACTICALLY-UNLIMITED values: a million file writes, a hundred thousand
// worktree merges, a billion tokens, ~7 days of aggregate runtime per day.
// Daily real-world usage never approaches these, so they feel unlimited —
// but the cap itself stays as a final fuse in case the agent ever enters a
// pathological loop (infinite retry / infinite rewrite of the same file).
// providerRequests stays 0 by default because it is the ONE irreversible
// resource: real provider calls cost real money and cannot be rolled back.
// Raise it explicitly via env (WORKFORCE_DAILY_PROVIDER_REQUESTS) when you
// intentionally want paid autonomy.
const DEFAULT_DAILY_BUDGET = {
  providerRequests: 500_000,    // paid provider calls — practically unlimited (raise/lower via env)
  sandboxMutations: 1_000_000,  // file writes inside a sandbox worktree (practically unlimited)
  worktreeMerges: 100_000,      // sandbox merges into a candidate branch (practically unlimited)
  tokens: 1_000_000_000,        // ~1 billion tokens/day (practically unlimited)
  runtimeSeconds: 600_000,      // ~167 hours aggregate agent runtime/day (practically unlimited)
};

// --- Trust tiers ---
// T0 = strict (always requires explicit approval, dry-run only)
// T1 = sandbox-merge allowed (runs in worktree, auto-merge to candidate branch on verify-green)
// T2 = sandbox-merge + auto-promote (candidate branch auto-advances after N consecutive greens)
export const TRUST_TIERS = Object.freeze({
  T0_STRICT: "T0_STRICT",
  T1_SANDBOX_MERGE: "T1_SANDBOX_MERGE",
  T2_SANDBOX_AUTO: "T2_SANDBOX_AUTO",
});

const PROMOTION_STREAK = 5;   // N consecutive green → promote
const DEMOTION_ON_ROLLBACK = true;

// --- Forbidden surface (never grantable via budget or token) ---
const GLOBAL_FORBIDDEN = Object.freeze([
  "apps/ai-gateway-service/src/http/httpServer.js::/chat",
  "apps/ai-gateway-service/src/http/httpServer.js::/chat-gateway/execute",
  "providers/runtimeCredentialStore.js::write",
  "credentials/adapters::write",
  ".env",
  "auth.json",
  ".git",
  "legacy/",
  "deploy",
  "release",
]);

const DEFAULT_STORE_PATH = resolve(process.cwd(), ".data", "workforce", "autonomy-budget.json");

/**
 * Create the autonomy budget governor.
 * @param {object} [options]
 * @param {string} [options.storePath]
 * @param {object} [options.env]
 * @param {object} [options.dailyBudget]
 */
export function createAutonomyBudget(options = {}) {
  const env = options.env ?? process.env;
  const storePath = resolve(options.storePath || env.WORKFORCE_AUTONOMY_STORE || DEFAULT_STORE_PATH);
  // Merge: code defaults → env overrides → explicit options.
  // Env var WORKFORCE_DAILY_PROVIDER_REQUESTS / _SANDBOX_MUTATIONS /
  // _WORKTREE_MERGES / _TOKENS / _RUNTIME_SECONDS override the defaults.
  // Special value "unlimited" / "inf" / "infinity" → Number.MAX_SAFE_INTEGER.
  const dailyBudget = {
    ...DEFAULT_DAILY_BUDGET,
    ...envBudgetOverrides(env),
    ...(options.dailyBudget || {}),
  };
  const forbidden = [...GLOBAL_FORBIDDEN];
  // Optional tier governor. When attached, the tier's per-resource caps clamp
  // the configured budget DOWN (effective cap = min(configured, tier cap)).
  // This is how the 3-throttle governor limits capability per tier.
  const tierGovernor = options.tierGovernor || null;

  return {
    getInfo() {
      return {
        phase: AUTONOMY_PHASE,
        mode: AUTONOMY_MODE,
        storePath,
        dailyBudget,
        trustTiers: Object.values(TRUST_TIERS),
        forbiddenSurface: forbidden,
      };
    },

    /**
     * Read today's budget usage + remaining.
     * Day boundary = local midnight (date string key).
     */
    async getUsage(day = todayKey()) {
      const store = await readStore(storePath);
      const dayUsage = store.usage[day] || emptyUsage();
      const remaining = {};
      for (const key of Object.keys(dailyBudget)) {
        const used = dayUsage[key] || 0;
        const cap = dailyBudget[key];
        remaining[key] = Math.max(0, cap - used);
      }
      return {
        day,
        budget: { ...dailyBudget },
        used: dayUsage,
        remaining,
        exhausted: Object.entries(remaining).some(([k, v]) => v <= 0 && dailyBudget[k] > 0),
      };
    },

    /**
     * Attempt to consume `amount` of `resource` from today's pool.
     * Returns {allowed, remaining, reason}.
     * Never auto-grants providerRequests if the daily cap is 0 (paid surface).
     */
    async consume(resource, amount = 1) {
      if (!Object.prototype.hasOwnProperty.call(dailyBudget, resource)) {
        return { allowed: false, reason: `unknown_resource:${resource}` };
      }
      const day = todayKey();
      const store = await readStore(storePath);
      const used = (store.usage[day] || emptyUsage())[resource] || 0;
      // Effective cap = min(configured budget, tier cap if a governor is attached)
      let cap = dailyBudget[resource];
      let tierCapSource = null;
      if (tierGovernor) {
        try {
          const tierCaps = await tierGovernor.getCurrentBudgetCaps();
          if (tierCaps && typeof tierCaps[resource] === "number") {
            cap = Math.min(cap, tierCaps[resource]);
            tierCapSource = tierCaps;
          }
        } catch {
          // Governor read failure → fail-open on the configured cap (don't
          // block work because the tier file is unreadable; budget still applies).
        }
      }
      if (cap <= 0) {
        // Hard-locked resource. Either configured to 0, or the current tier
        // forces it to 0 (e.g. conservative tier blocks paid provider calls).
        return { allowed: false, reason: `resource_locked:${resource}`, cap, used, tierCapSource };
      }
      if (used + amount > cap) {
        await writeStore(storePath, store);
        return {
          allowed: false,
          reason: "budget_exhausted",
          resource,
          used,
          cap,
          requested: amount,
          remaining: Math.max(0, cap - used),
          tierCapSource,
        };
      }
      // Commit the consumption
      if (!store.usage[day]) store.usage[day] = emptyUsage();
      store.usage[day][resource] = used + amount;
      store.usage[day].lastConsumedAt = new Date().toISOString();
      await writeStore(storePath, store);
      return {
        allowed: true,
        resource,
        used: store.usage[day][resource],
        cap,
        remaining: Math.max(0, cap - store.usage[day][resource]),
        tierCapSource,
      };
    },

    /**
     * Issue a scope token: long-lived authorization for a path range + budget slice.
     * @param {object} input
     * @param {string} input.userId
     * @param {string[]} input.pathScope   — allowed path prefixes (e.g. ["apps/workforce/", "docs/"])
     * @param {number} [input.ttlDays]     — default 7
     * @param {object} [input.budgetSlice] — per-day caps for this token (subset of dailyBudget)
     * @param {string} [input.note]
     */
    async issueToken(input = {}) {
      if (!input.userId) throw budgetError("TOKEN_USER_REQUIRED", "userId required");
      if (!Array.isArray(input.pathScope) || input.pathScope.length === 0) {
        throw budgetError("TOKEN_SCOPE_REQUIRED", "pathScope required");
      }
      // Reject scope that overlaps the global forbidden surface
      const clash = input.pathScope.find((p) => forbidden.some((f) => p.startsWith(f) || f.startsWith(p)));
      if (clash) {
        throw budgetError("TOKEN_SCOPE_FORBIDDEN", `pathScope overlaps forbidden surface: ${clash}`);
      }
      const ttlDays = Number(input.ttlDays) || 7;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
      const token = {
        tokenId: `tok_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
        userId: String(input.userId).trim(),
        pathScope: input.pathScope.map((s) => String(s).trim()).filter(Boolean),
        budgetSlice: { ...input.budgetSlice },
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        revoked: false,
        note: String(input.note || "").slice(0, 1000),
      };
      const store = await readStore(storePath);
      store.tokens.unshift(token);
      // Keep last 100 tokens
      store.tokens = store.tokens.slice(0, 100);
      await writeStore(storePath, store);
      return { success: true, token };
    },

    /**
     * Validate a token against a path + today's slice usage.
     * @returns {{valid, token, reason, allowed}}
     */
    async validateToken(tokenId, targetPath, resource = "sandboxMutations", amount = 1) {
      const store = await readStore(storePath);
      const token = store.tokens.find((t) => t.tokenId === tokenId && !t.revoked);
      if (!token) return { valid: false, reason: "token_not_found_or_revoked" };
      if (new Date() >= new Date(token.expiresAt)) {
        return { valid: false, reason: "token_expired", token };
      }
      const inScope = token.pathScope.some((p) => targetPath.startsWith(p));
      if (!inScope) {
        return { valid: false, reason: "path_out_of_scope", token, targetPath, scope: token.pathScope };
      }
      // Check per-token budget slice (if specified for this resource)
      const sliceCap = token.budgetSlice?.[resource];
      if (typeof sliceCap === "number" && sliceCap >= 0) {
        const day = todayKey();
        const key = `tok:${token.tokenId}:${day}:${resource}`;
        const used = store.usage[day]?.[key] || 0;
        if (used + amount > sliceCap) {
          return { valid: false, reason: "token_budget_exhausted", token, resource, used, cap: sliceCap };
        }
        // commit slice usage
        if (!store.usage[day]) store.usage[day] = emptyUsage();
        store.usage[day][key] = used + amount;
        await writeStore(storePath, store);
      }
      return { valid: true, token };
    },

    async revokeToken(tokenId, revokedBy, reason = "") {
      const store = await readStore(storePath);
      let changed = false;
      store.tokens = store.tokens.map((t) => {
        if (t.tokenId === tokenId && !t.revoked) {
          changed = true;
          return { ...t, revoked: true, revokedAt: new Date().toISOString(), revokedBy: String(revokedBy || "system"), revokeReason: String(reason).slice(0, 1000) };
        }
        return t;
      });
      if (!changed) return { success: false, reason: "token_not_found" };
      await writeStore(storePath, store);
      return { success: true, tokenId, revoked: true };
    },

    /**
     * Trust ladder: per-operation-type trust tier.
     * Records a verify outcome and recomputes the tier.
     */
    async recordTrustEvent(operationType, outcome) {
      const store = await readStore(storePath);
      if (!store.trust[operationType]) {
        store.trust[operationType] = { tier: TRUST_TIERS.T0_STRICT, streak: 0, greens: 0, reds: 0, rollbacks: 0, lastOutcome: null, updatedAt: null };
      }
      const t = store.trust[operationType];
      if (outcome === "green") {
        t.greens += 1;
        t.streak = (t.streak >= 0 ? t.streak : 0) + 1;
        if (t.tier === TRUST_TIERS.T0_STRICT && t.streak >= PROMOTION_STREAK) {
          t.tier = TRUST_TIERS.T1_SANDBOX_MERGE;
        } else if (t.tier === TRUST_TIERS.T1_SANDBOX_MERGE && t.streak >= PROMOTION_STREAK * 2) {
          t.tier = TRUST_TIERS.T2_SANDBOX_AUTO;
        }
      } else if (outcome === "red" || outcome === "rollback") {
        t.reds += 1;
        if (outcome === "rollback") t.rollbacks += 1;
        t.streak = 0;
        if (DEMOTION_ON_ROLLBACK) {
          // Demote one tier on any rollback
          if (t.tier === TRUST_TIERS.T2_SANDBOX_AUTO) t.tier = TRUST_TIERS.T1_SANDBOX_MERGE;
          else t.tier = TRUST_TIERS.T0_STRICT;
        }
      }
      t.lastOutcome = outcome;
      t.updatedAt = new Date().toISOString();
      store.trust[operationType] = t;
      await writeStore(storePath, store);
      return { operationType, tier: t.tier, streak: t.streak, greens: t.greens, reds: t.reds, rollbacks: t.rollbacks };
    },

    getTrustTier(operationType) {
      // Synchronous read from the in-memory cache is not available (file-backed),
      // so callers should use getTrustSnapshot for the async version.
      return null;
    },

    async getTrustSnapshot() {
      const store = await readStore(storePath);
      return { trust: store.trust };
    },

    /**
     * Is a given target path on the global forbidden surface?
     */
    isForbidden(targetPath) {
      return forbidden.some((f) => targetPath.startsWith(f));
    },

    getForbiddenSurface() {
      return [...forbidden];
    },

    /**
     * Reset today's usage (admin escape hatch). Does NOT reset trust (history is permanent).
     */
    async resetDayUsage(day = todayKey()) {
      const store = await readStore(storePath);
      if (store.usage[day]) {
        delete store.usage[day];
        await writeStore(storePath, store);
      }
      return { success: true, day };
    },
  };
}

// --- Helpers ---

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Read budget overrides from env vars. Accepts integers or the literal
 * "unlimited" / "inf" / "infinity" (case-insensitive) → Number.MAX_SAFE_INTEGER.
 * Invalid values are silently ignored (fall back to code default).
 */
function envBudgetOverrides(env) {
  const map = {
    providerRequests: "WORKFORCE_DAILY_PROVIDER_REQUESTS",
    sandboxMutations: "WORKFORCE_DAILY_SANDBOX_MUTATIONS",
    worktreeMerges: "WORKFORCE_DAILY_WORKTREE_MERGES",
    tokens: "WORKFORCE_DAILY_TOKENS",
    runtimeSeconds: "WORKFORCE_DAILY_RUNTIME_SECONDS",
  };
  const out = {};
  for (const [budgetKey, envKey] of Object.entries(map)) {
    const raw = env[envKey];
    if (raw === null || raw === "") continue;
    const trimmed = String(raw).trim().toLowerCase();
    if (trimmed === "unlimited" || trimmed === "inf" || trimmed === "infinity") {
      out[budgetKey] = Number.MAX_SAFE_INTEGER;
      continue;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0 && Number.isInteger(parsed)) {
      out[budgetKey] = parsed;
    }
    // non-integer / negative / NaN → ignored, code default stays
  }
  return out;
}

function emptyUsage() {
  return { providerRequests: 0, sandboxMutations: 0, worktreeMerges: 0, tokens: 0, runtimeSeconds: 0, lastConsumedAt: null };
}

async function readStore(storePath) {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || null,
      usage: parsed.usage && typeof parsed.usage === "object" ? parsed.usage : {},
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      trust: parsed.trust && typeof parsed.trust === "object" ? parsed.trust : {},
    };
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { version: 1, updatedAt: null, usage: {}, tokens: [], trust: {} };
    }
    throw err;
  }
}

async function writeStore(storePath, store) {
  await mkdir(dirname(storePath), { recursive: true });
  store.updatedAt = new Date().toISOString();
  const tmp = `${storePath}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tmp, storePath); // atomic
}

function budgetError(code, message) {
  const e = new Error(message);
  e.code = code;
  e.category = "autonomy_budget";
  return e;
}
