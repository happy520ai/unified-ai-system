import fs from "fs/promises";
import {
  DATA_DIR,
  ONBOARDING_LOG,
  PROVIDER_STATE_FILE,
  PROVIDERS_CONFIG,
  MAX_AUDIT_LOG,
  MAX_SESSIONS,
} from "./providerOnboardingConstants.js";

/**
 * Provider Onboarding — persistence helpers.
 *
 * Extracted from providerOnboardingService.js to keep the service class
 * under the 500-line limit.
 *
 * @module providers/providerOnboardingPersistence
 */

/**
 * Load persisted onboarding log and sessions into memory.
 * @param {Map} onboardingSessions
 * @param {Array} auditLogRef — mutable array reference (this._auditLog)
 * @returns {Promise<void>}
 */
export async function loadOnboardingLog(onboardingSessions, auditLogRef) {
  try {
    const raw = await fs.readFile(ONBOARDING_LOG, "utf-8");
    const data = JSON.parse(raw);

    auditLogRef.length = 0;
    for (const entry of Array.isArray(data.auditLog) ? data.auditLog : []) {
      auditLogRef.push(entry);
    }

    for (const session of data.sessions ?? []) {
      onboardingSessions.set(session.sessionId, session);
    }
  } catch {
    // first run
  }
}

/**
 * Load persisted provider state into memory.
 * @param {Map} providers
 * @returns {Promise<boolean>} true if state was loaded, false if bootstrap is needed
 */
export async function loadProviderState(providers) {
  try {
    const raw = await fs.readFile(PROVIDER_STATE_FILE, "utf-8");
    const data = JSON.parse(raw);

    for (const provider of data.providers ?? []) {
      providers.set(provider.id, provider);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Bootstrap provider state from the main providers-config.json.
 * @param {Map} providers
 * @returns {Promise<void>}
 */
export async function bootstrapFromConfig(providers) {
  try {
    const raw = await fs.readFile(PROVIDERS_CONFIG, "utf-8");
    const config = JSON.parse(raw);

    for (const p of config.providers ?? []) {
      providers.set(p.id, {
        id: p.id,
        name: p.name ?? p.nameEn ?? p.id,
        baseUrl: p.baseUrl ?? "",
        status: p.apiKey ? "configured" : "pending_setup",
        active: false,
        models: p.models ?? [],
        defaultModel: p.defaultModel ?? "",
        free: p.free ?? false,
        region: p.region ?? "global",
        category: p.category ?? "standard",
        routingPolicy: null,
        lastHealthCheck: null,
        onboardedAt: null,
        createdAt: new Date().toISOString(),
      });
    }

    await persistProviderState(providers);
  } catch {
    // No config file found – start empty
  }
}

/**
 * Read providers-config.json, returning an empty skeleton on failure.
 * @returns {Promise<object>}
 */
export async function readProvidersConfig() {
  try {
    const raw = await fs.readFile(PROVIDERS_CONFIG, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { providers: [] };
  }
}

/**
 * Write providers-config.json.
 * @param {object} config
 * @returns {Promise<void>}
 */
export async function writeProvidersConfig(config) {
  await fs.writeFile(PROVIDERS_CONFIG, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Persist onboarding sessions and audit log to disk.
 * Trims sessions to MAX_SESSIONS and audit log to MAX_AUDIT_LOG.
 * @param {Map} onboardingSessions
 * @param {Array} auditLog
 * @returns {Promise<void>}
 */
export async function persistOnboardingLog(onboardingSessions, auditLog) {
  if (onboardingSessions.size > MAX_SESSIONS) {
    const entries = Array.from(onboardingSessions.entries())
      .sort(([, a], [, b]) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_SESSIONS);
    onboardingSessions.clear();
    for (const [key, value] of entries) {
      onboardingSessions.set(key, value);
    }
  }

  const data = {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    sessions: Array.from(onboardingSessions.values()),
    auditLog: auditLog.slice(-MAX_AUDIT_LOG),
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ONBOARDING_LOG, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Persist provider state to disk.
 * @param {Map} providers
 * @returns {Promise<void>}
 */
export async function persistProviderState(providers) {
  const data = {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    providers: Array.from(providers.values()),
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROVIDER_STATE_FILE, JSON.stringify(data, null, 2), "utf-8");
}
