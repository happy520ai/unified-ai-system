import path from "path";

/**
 * Provider Onboarding — shared constants and paths.
 *
 * Extracted from providerOnboardingService.js to keep the service class
 * under the 500-line limit.
 *
 * @module providers/providerOnboardingConstants
 */

export const PROVIDERS_CONFIG = path.join(process.cwd(), "providers-config.json");
export const DATA_DIR = path.join(process.cwd(), ".data", "providers");
export const ONBOARDING_LOG = path.join(DATA_DIR, "onboarding-log.json");
export const PROVIDER_STATE_FILE = path.join(DATA_DIR, "provider-state.json");

/** Maximum audit log entries to persist */
export const MAX_AUDIT_LOG = 500;

/** Maximum onboarding sessions to keep in memory */
export const MAX_SESSIONS = 200;

/** Onboarding session states. */
export const SESSION_STATUS = {
  PENDING: "pending",
  VALIDATING: "validating",
  TESTING: "testing",
  CONFIGURING: "configuring",
  READY: "ready",
  ACTIVE: "active",
  FAILED: "failed",
  CANCELLED: "cancelled",
};
