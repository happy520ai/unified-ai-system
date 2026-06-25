/**
 * autonomyModes.js
 *
 * Tiny dependency-free shared constants for the autonomy mode vocabulary.
 * Kept in its own module to avoid a circular import between
 * workforceControlledExecutor.js (which dispatches) and sandboxMergeExecutor.js
 * (which executes sandbox-merge). Both import from here; neither imports the
 * other for these constants.
 *
 * Autonomy modes — default stays dry-run for full backward compatibility.
 *   dry-run           → original controlled pipeline, preview only (DEFAULT)
 *   sandbox-merge     → full-power sandboxed execution, gated merge, auto-rollback
 *   sandbox-merge-auto→ sandbox-merge + auto-advance candidate branch on verify-green
 */

export const AUTONOMY_MODES = Object.freeze({
  DRY_RUN: "dry-run",
  SANDBOX_MERGE: "sandbox-merge",
  SANDBOX_MERGE_AUTO: "sandbox-merge-auto",
});

export const DEFAULT_AUTONOMY_MODE = AUTONOMY_MODES.DRY_RUN;

/**
 * Resolve an autonomy mode from candidate input + env, fail-safe to dry-run.
 */
export function resolveAutonomyModeFrom(candidate, env) {
  const value = (candidate || env?.WORKFORCE_AUTONOMY_MODE || DEFAULT_AUTONOMY_MODE || "")
    .trim()
    .toLowerCase();
  if (value === AUTONOMY_MODES.SANDBOX_MERGE || value === AUTONOMY_MODES.SANDBOX_MERGE_AUTO) {
    return value;
  }
  return AUTONOMY_MODES.DRY_RUN;
}
