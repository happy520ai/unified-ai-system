/**
 * autonomyTierGovernor.js
 *
 * The three-throttle capability governor — controlled by a front-end switch.
 *
 * Design (per owner): the front-end switch is the ONLY source of truth. The
 * owner opens a throttle when they want more power and closes it when they
 * don't. No automatic timeout, no auto-fallback, no "pass one gate at a time"
 * ceremony. The chosen tier PERSISTS across restarts so "the state I set
 * last time" is the state the system boots into.
 *
 *   Tier 1 — conservative (DEFAULT on first boot, and a safe day-to-day floor)
 *       ~70% capability. Reversible resources ~50% of max.
 *       Paid provider calls BLOCKED (0). Candidate branches require MANUAL
 *       merge (sandbox-merge, not auto).
 *
 *   Tier 2 — balanced (~80%)
 *       Reversible resources ~80% of max. Paid provider calls allowed up to a
 *       daily ceiling. Still MANUAL merge.
 *
 *   Tier 3 — unlimited (100%, full power)
 *       Practically-unlimited reversible resources. Paid provider calls up to
 *       a high ceiling. AUTO-merge (sandbox-merge-auto).
 *
 * How the front-end drives it:
 *   GET  /workforce/tier              — read current tier + caps
 *   POST /workforce/tier              — set tier directly { tier, operatorId, reason }
 *   POST /workforce/tier/fallback     — convenience: drop one tier (or to target)
 *
 * Every change is AUDITED (who/when/why/from→to) and PERSISTED to
 * .data/workforce/autonomy-tier.json. On boot the store is read and its
 * currentTier becomes the live tier. To reset to conservative, the owner
 * just sets it back from the switch.
 *
 * The tier NEVER relaxes the global forbidden surface (/chat, secrets, .env,
 * auth.json, .git, legacy/, deploy, release) — that's enforced by the budget
 * + sandbox layers, not by the tier.
 */

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const TIER_PHASE = "PhaseAutonomyTierGovernor";

export const TIERS = Object.freeze({
  CONSERVATIVE: "conservative",  // Tier 1 — default floor, ~70%, no paid calls, manual merge
  BALANCED: "balanced",          // Tier 2 — ~80%, paid calls allowed, manual merge
  UNLIMITED: "unlimited",        // Tier 3 — 100%, paid calls + auto-merge
});

// The ordered ladder. Index 0 = lowest. Used for reporting tierIndex and for
// the "fallback one step" convenience. setTier() itself does NOT enforce
// adjacency — the owner can jump directly to any tier from the switch.
export const TIER_ORDER = Object.freeze([TIERS.CONSERVATIVE, TIERS.BALANCED, TIERS.UNLIMITED]);

// Per-tier budget ceilings. These OVERRIDE the autonomyBudget defaults when
// the governor is active — i.e. the effective budget is the MIN of (tier cap,
// configured budget). This is what makes "tier" actually limit capability.
export const TIER_BUDGET_CAPS = Object.freeze({
  [TIERS.CONSERVATIVE]: {
    providerRequests: 0,          // NO paid provider calls in day-to-day mode
    sandboxMutations: 500_000,    // ~50% of the unlimited ceiling
    worktreeMerges: 50_000,
    tokens: 500_000_000,
    runtimeSeconds: 200_000,
    autonomyMode: "sandbox-merge",      // manual merge only
  },
  [TIERS.BALANCED]: {
    providerRequests: 10_000,     // paid calls allowed, modest ceiling
    sandboxMutations: 800_000,    // ~80%
    worktreeMerges: 80_000,
    tokens: 800_000_000,
    runtimeSeconds: 400_000,
    autonomyMode: "sandbox-merge",      // still manual merge
  },
  [TIERS.UNLIMITED]: {
    providerRequests: 500_000,    // high ceiling (practically unlimited)
    sandboxMutations: 1_000_000,
    worktreeMerges: 100_000,
    tokens: 1_000_000_000,
    runtimeSeconds: 600_000,
    autonomyMode: "sandbox-merge-auto", // AUTO-merge at full power
  },
});

const DEFAULT_STORE_PATH = resolve(process.cwd(), ".data", "workforce", "autonomy-tier.json");
const DEFAULT_START_TIER = TIERS.CONSERVATIVE;

/**
 * @param {object} [options]
 * @param {string} [options.storePath]
 * @param {object} [options.env]
 * @param {string} [options.startTier]  — fallback tier ONLY when the store is
 *                                        absent (first boot). Once persisted,
 *                                        the stored tier always wins.
 */
export function createAutonomyTierGovernor(options = {}) {
  const env = options.env ?? process.env;
  const storePath = resolve(options.storePath || env.WORKFORCE_TIER_STORE || DEFAULT_STORE_PATH);
  // startTier is only used on first boot (no store file yet). After that the
  // persisted tier is authoritative, so the switch state survives restarts.
  const firstBootTier = (options.startTier || env.WORKFORCE_START_TIER || DEFAULT_START_TIER).trim().toLowerCase();
  const validFirstBoot = TIER_ORDER.includes(firstBootTier) ? firstBootTier : DEFAULT_START_TIER;

  return {
    getInfo() {
      return {
        phase: TIER_PHASE,
        storePath,
        tiers: TIER_ORDER,
        budgetCaps: TIER_BUDGET_CAPS,
        firstBootTier: validFirstBoot,
        // Note: NO gateTtlMs / no auto-fallback — the switch is manual-only.
        switchControlled: true,
      };
    },

    /**
     * Read the CURRENT tier. This is authoritative and persistent — whatever
     * the owner last set is what's returned. No expiry is applied.
     */
    async getCurrentTier() {
      const store = await readStore(storePath, validFirstBoot);
      return {
        tier: store.currentTier,
        tierIndex: TIER_ORDER.indexOf(store.currentTier),
        caps: TIER_BUDGET_CAPS[store.currentTier],
        autonomyMode: TIER_BUDGET_CAPS[store.currentTier].autonomyMode,
        setAt: store.setAt,
        setBy: store.setBy,
        reason: store.reason,
        audit: store.audit.slice(-10),
      };
    },

    /**
     * Get the budget caps for the current tier (used by autonomyBudget to
     * clamp its own configured budget down to the tier ceiling).
     */
    async getCurrentBudgetCaps() {
      const t = await this.getCurrentTier();
      return t.caps;
    },

    /**
     * SET THE TIER DIRECTLY — this is the front-end switch handler.
     *
     * The owner can jump to ANY tier in one call (no "pass one gate at a time"
     * requirement). Every change is audited (who/when/why/from→to) and
     * persisted, so the choice survives restarts.
     *
     * @param {object} input
     * @param {string} input.tier        — target tier (conservative/balanced/unlimited)
     * @param {string} input.operatorId  — who is flipping the switch
     * @param {string} [input.reason]    — why (audited)
     * @returns {object} { success, tier, previousTier } or { success:false, code }
     */
    async setTier(input = {}) {
      const tier = String(input.tier || "").trim().toLowerCase();
      const operatorId = String(input.operatorId || "").trim();
      const reason = String(input.reason || "").trim();

      if (!TIER_ORDER.includes(tier)) {
        return fail("UNKNOWN_TIER", `unknown tier '${input.tier}'; valid: ${TIER_ORDER.join(", ")}`);
      }
      if (!operatorId) return fail("OPERATOR_REQUIRED", "operatorId required");
      // reason is optional but recommended; we allow empty but audit it.

      const store = await readStore(storePath, validFirstBoot);
      if (store.currentTier === tier) {
        return {
          success: true,
          tier,
          previousTier: store.currentTier,
          unchanged: true,
          message: `Already at '${tier}'.`,
        };
      }

      const previousTier = store.currentTier;
      const now = new Date().toISOString();
      pushAudit(store, {
        action: "tier_set",
        from: previousTier,
        to: tier,
        operatorId,
        reason: reason || "(no reason given)",
        at: now,
      });
      store.previousTier = previousTier;
      store.currentTier = tier;
      store.setAt = now;
      store.setBy = operatorId;
      store.reason = reason || null;
      await writeStore(storePath, store);

      const direction = TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(previousTier) ? "raised" : "lowered";
      return {
        success: true,
        tier,
        previousTier,
        caps: TIER_BUDGET_CAPS[tier],
        message: `Switch ${direction}: '${previousTier}' → '${tier}'. Persists until you change it again.`,
      };
    },

    /**
     * Convenience: drop one tier (or to an explicit lower targetTier).
     * Same as setTier but only accepts a lower tier. Kept as a separate route
     * so the front-end can render a distinct "close throttle" button.
     */
    async fallBack(input = {}) {
      const operatorId = String(input.operatorId || "system").trim();
      const reason = String(input.reason || "manual close").trim();
      const store = await readStore(storePath, validFirstBoot);
      const currentIdx = TIER_ORDER.indexOf(store.currentTier);

      let targetTier;
      if (input.targetTier) {
        targetTier = String(input.targetTier).trim().toLowerCase();
        if (!TIER_ORDER.includes(targetTier)) return fail("UNKNOWN_TIER", `unknown tier '${input.targetTier}'`);
        const targetIdx = TIER_ORDER.indexOf(targetTier);
        if (targetIdx >= currentIdx) return fail("NOT_A_FALLBACK", `target '${targetTier}' is not lower than current '${store.currentTier}'`);
      } else {
        const targetIdx = Math.max(0, currentIdx - 1);
        targetTier = TIER_ORDER[targetIdx];
      }

      return this.setTier({ tier: targetTier, operatorId, reason });
    },

    /**
     * Is the current tier at least `tier`?
     */
    async isAtLeast(tier) {
      const t = await this.getCurrentTier();
      return TIER_ORDER.indexOf(t.tier) >= TIER_ORDER.indexOf(tier);
    },

    // --- Back-compat aliases (older code may call passGate) ---
    // passGate is retained but now simply elevates ONE tier and persists
    // (no TTL). It's a thin wrapper over setTier for callers that prefer the
    // "step up" semantics.
    async passGate(input = {}) {
      const operatorId = String(input.operatorId || "").trim();
      const reason = String(input.reason || "").trim();
      if (!operatorId) return fail("OPERATOR_REQUIRED", "operatorId required");
      const store = await readStore(storePath, validFirstBoot);
      const currentIdx = TIER_ORDER.indexOf(store.currentTier);
      if (currentIdx >= TIER_ORDER.length - 1) {
        return fail("ALREADY_AT_MAX", `already at the highest tier '${store.currentTier}'`);
      }
      const targetTier = TIER_ORDER[currentIdx + 1];
      return this.setTier({ tier: targetTier, operatorId, reason });
    },
  };
}

// =========================================================================
// Helpers
// =========================================================================

function pushAudit(store, entry) {
  if (!Array.isArray(store.audit)) store.audit = [];
  store.audit.push(entry);
  if (store.audit.length > 200) store.audit = store.audit.slice(-200);
}

async function readStore(storePath, firstBootTier) {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    return {
      version: parsed.version || 1,
      currentTier: TIER_ORDER.includes(parsed.currentTier) ? parsed.currentTier : firstBootTier,
      previousTier: parsed.previousTier || null,
      setAt: parsed.setAt || null,
      setBy: parsed.setBy || null,
      reason: parsed.reason || null,
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      updatedAt: parsed.updatedAt || null,
    };
  } catch (err) {
    if (err?.code === "ENOENT") {
      // First boot: start at the configured floor (default conservative).
      return {
        version: 1,
        currentTier: firstBootTier,
        previousTier: null,
        setAt: null,
        setBy: null,
        reason: null,
        audit: [],
        updatedAt: null,
      };
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

function fail(code, message) {
  return { success: false, code, message };
}
