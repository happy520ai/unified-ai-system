import fs from "fs/promises";
import { randomUUID } from "crypto";
import {
  DATA_DIR,
  SESSION_STATUS,
} from "./providerOnboardingConstants.js";
import { isPrivateOrReservedHost } from "./providerOnboardingUtils.js";
import {
  loadOnboardingLog,
  loadProviderState,
  bootstrapFromConfig,
  readProvidersConfig,
  writeProvidersConfig,
  persistOnboardingLog,
  persistProviderState,
} from "./providerOnboardingPersistence.js";
import {
  listProviders as listProvidersQuery,
  getProvider as getProviderQuery,
  getOnboardingStatus as getOnboardingStatusQuery,
  getOnboardingHistory as getOnboardingHistoryQuery,
  findSessionByProvider,
} from "./providerOnboardingQueries.js";

/**
 * Provider Onboarding Service
 *
 * Manages the lifecycle of adding new AI providers to the gateway:
 * credential validation, connection testing, routing policy configuration,
 * activation, health monitoring, and deactivation.
 *
 * Persists onboarding sessions and provider state under `.data/providers/`.
 */

export { SESSION_STATUS };

export class ProviderOnboardingService {
  constructor() {
    /** @type {Map<string, object>} providerId -> provider record */
    this.providers = new Map();

    /** @type {Map<string, object>} sessionId -> onboarding session */
    this.onboardingSessions = new Map();

    /** @type {Map<string, object>} providerId -> last health check result */
    this.healthChecks = new Map();

    /** @type {object[]} Audit log entries */
    this._auditLog = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await loadOnboardingLog(this.onboardingSessions, this._auditLog);

    const loaded = await loadProviderState(this.providers);
    if (!loaded) {
      await bootstrapFromConfig(this.providers);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Onboarding                                                         */
  /* ------------------------------------------------------------------ */

  async startOnboarding(providerConfig) {
    if (!providerConfig?.id) {
      throw new Error("Provider id is required for onboarding.");
    }
    if (!providerConfig?.baseUrl) {
      throw new Error("Provider baseUrl is required for onboarding.");
    }

    if (this.providers.has(providerConfig.id)) {
      const existing = this.providers.get(providerConfig.id);
      if (existing.status === "active") {
        throw new Error(`Provider "${providerConfig.id}" is already active.`);
      }
    }

    const sessionId = randomUUID();
    const session = {
      sessionId,
      providerId: providerConfig.id,
      providerConfig: {
        id: providerConfig.id,
        name: providerConfig.name ?? providerConfig.id,
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey ?? "",
        models: providerConfig.models ?? [],
        defaultModel: providerConfig.defaultModel ?? "",
        free: providerConfig.free ?? false,
        region: providerConfig.region ?? "global",
        category: providerConfig.category ?? "custom",
        openaiCompatible: providerConfig.openaiCompatible ?? true,
      },
      status: SESSION_STATUS.PENDING,
      steps: {
        credentialValidation: { status: "pending", result: null },
        connectionTest: { status: "pending", result: null },
        routingPolicy: { status: "pending", result: null },
        activation: { status: "pending", result: null },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.onboardingSessions.set(sessionId, session);
    this._audit(sessionId, "onboarding_started", { providerId: providerConfig.id });
    await persistOnboardingLog(this.onboardingSessions, this._auditLog);

    return { ...session };
  }

  async validateCredentials(providerId, credentials) {
    const session = findSessionByProvider(this.onboardingSessions, providerId);
    if (!session) throw new Error(`No onboarding session for provider: ${providerId}`);

    session.status = SESSION_STATUS.VALIDATING;
    session.updatedAt = new Date().toISOString();

    const errors = [];

    const apiKey = credentials?.apiKey ?? session.providerConfig.apiKey;
    if (!apiKey) {
      errors.push("API key is missing.");
    } else if (apiKey.length < 8) {
      errors.push("API key appears too short (less than 8 characters).");
    }

    const baseUrl = credentials?.baseUrl ?? session.providerConfig.baseUrl;
    try {
      new URL(baseUrl);
    } catch {
      errors.push(`Invalid baseUrl format: "${baseUrl}".`);
    }

    const valid = errors.length === 0;

    session.steps.credentialValidation = {
      status: valid ? "passed" : "failed",
      result: { valid, errors },
      completedAt: new Date().toISOString(),
    };

    if (valid) {
      session.providerConfig.apiKey = apiKey;
      session.providerConfig.baseUrl = baseUrl;
      session.status = SESSION_STATUS.VALIDATING;
    } else {
      session.status = SESSION_STATUS.FAILED;
    }

    session.updatedAt = new Date().toISOString();
    this._audit(session.sessionId, "credentials_validated", { valid, errors });
    await persistOnboardingLog(this.onboardingSessions, this._auditLog);

    return { valid, errors, sessionId: session.sessionId };
  }

  async testConnection(providerId, testPayload) {
    const session = findSessionByProvider(this.onboardingSessions, providerId);
    if (!session) throw new Error(`No onboarding session for provider: ${providerId}`);

    session.status = SESSION_STATUS.TESTING;
    session.updatedAt = new Date().toISOString();

    const startTime = Date.now();
    let result;

    try {
      const targetUrl = new URL(session.providerConfig.baseUrl);
      if (isPrivateOrReservedHost(targetUrl.hostname)) {
        throw new Error("Connection to private/internal networks is not allowed.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(session.providerConfig.baseUrl, {
        method: "GET",
        signal: controller.signal,
        headers: session.providerConfig.apiKey
          ? { Authorization: `Bearer ${session.providerConfig.apiKey}` }
          : {},
      }).catch((err) => ({ status: 0, statusText: err.message }));

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      const reachable = response.status > 0 && response.status < 500;
      result = {
        reachable,
        statusCode: response.status,
        statusText: response.statusText,
        latencyMs,
        timestamp: new Date().toISOString(),
      };

      session.steps.connectionTest = {
        status: reachable ? "passed" : "failed",
        result,
        completedAt: new Date().toISOString(),
      };

      if (!reachable) {
        session.status = SESSION_STATUS.FAILED;
      }
    } catch (err) {
      result = {
        reachable: false,
        error: err.message,
        latencyMs: Date.now() - startTime,
      };

      session.steps.connectionTest = {
        status: "failed",
        result,
        completedAt: new Date().toISOString(),
      };
      session.status = SESSION_STATUS.FAILED;
    }

    session.updatedAt = new Date().toISOString();
    this._audit(session.sessionId, "connection_tested", { success: result.reachable });
    await persistOnboardingLog(this.onboardingSessions, this._auditLog);

    return result;
  }

  async applyRoutingPolicy(providerId, policy) {
    const session = findSessionByProvider(this.onboardingSessions, providerId);
    if (!session) throw new Error(`No onboarding session for provider: ${providerId}`);

    session.status = SESSION_STATUS.CONFIGURING;
    session.updatedAt = new Date().toISOString();

    const routingPolicy = {
      priority: policy?.priority ?? 100,
      weight: policy?.weight ?? 1.0,
      costTier: policy?.costTier ?? "medium",
      fallbackProvider: policy?.fallbackProvider ?? null,
      maxConcurrency: policy?.maxConcurrency ?? 10,
      enabledModels: policy?.enabledModels ?? session.providerConfig.models,
      appliedAt: new Date().toISOString(),
    };

    session.steps.routingPolicy = {
      status: "passed",
      result: routingPolicy,
      completedAt: routingPolicy.appliedAt,
    };

    session.providerConfig.routingPolicy = routingPolicy;
    session.status = SESSION_STATUS.READY;
    session.updatedAt = new Date().toISOString();

    this._audit(session.sessionId, "routing_policy_applied", routingPolicy);
    await persistOnboardingLog(this.onboardingSessions, this._auditLog);

    return routingPolicy;
  }

  async activateProvider(providerId) {
    const session = findSessionByProvider(this.onboardingSessions, providerId);
    const config = await readProvidersConfig();

    if (!session) {
      throw new Error("Cannot activate: no onboarding session found for this provider. Please complete onboarding first.");
    }
    if (session) {
      const steps = session.steps;
      const allPassed = Object.values(steps).every(
        (s) => s.status === "passed"
      );
      if (!allPassed) {
        throw new Error("Cannot activate: some onboarding steps have not passed.");
      }

      const existingIdx = config.providers.findIndex((p) => p.id === providerId);
      const providerEntry = {
        id: session.providerConfig.id,
        name: session.providerConfig.name,
        nameEn: session.providerConfig.name,
        apiKey: session.providerConfig.apiKey,
        baseUrl: session.providerConfig.baseUrl,
        openaiCompatible: session.providerConfig.openaiCompatible ?? true,
        models: session.providerConfig.models,
        defaultModel: session.providerConfig.defaultModel,
        free: session.providerConfig.free,
        region: session.providerConfig.region,
        category: session.providerConfig.category,
      };

      if (existingIdx >= 0) {
        config.providers[existingIdx] = { ...config.providers[existingIdx], ...providerEntry };
      } else {
        config.providers.push(providerEntry);
      }

      session.status = SESSION_STATUS.ACTIVE;
      session.steps.activation = {
        status: "passed",
        result: { activatedAt: new Date().toISOString() },
        completedAt: new Date().toISOString(),
      };
      session.updatedAt = new Date().toISOString();
    }

    const providerState = this.providers.get(providerId) ?? {};
    providerState.id = providerId;
    providerState.status = "active";
    providerState.active = true;
    providerState.onboardedAt = new Date().toISOString();
    this.providers.set(providerId, providerState);

    await writeProvidersConfig(config);
    await persistProviderState(this.providers);
    await persistOnboardingLog(this.onboardingSessions, this._auditLog);

    this._audit(session?.sessionId ?? "direct", "provider_activated", { providerId });

    return {
      providerId,
      status: "active",
      activatedAt: providerState.onboardedAt,
    };
  }

  async deactivateProvider(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);

    provider.status = "inactive";
    provider.active = false;
    provider.deactivatedAt = new Date().toISOString();
    this.providers.set(providerId, provider);

    await persistProviderState(this.providers);
    this._audit("direct", "provider_deactivated", { providerId });

    return {
      providerId,
      status: "inactive",
      deactivatedAt: provider.deactivatedAt,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Health Checks                                                      */
  /* ------------------------------------------------------------------ */

  async runHealthCheck(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);

    const startTime = Date.now();

    try {
      if (provider.baseUrl) {
        const targetUrl = new URL(provider.baseUrl);
        if (isPrivateOrReservedHost(targetUrl.hostname)) {
          throw new Error("Health check to private/internal networks is not allowed.");
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(provider.baseUrl, {
        method: "GET",
        signal: controller.signal,
      }).catch((err) => ({ status: 0, statusText: err.message }));

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      const result = {
        providerId,
        reachable: response.status > 0 && response.status < 500,
        statusCode: response.status,
        latencyMs,
        timestamp: new Date().toISOString(),
      };

      this.healthChecks.set(providerId, result);
      provider.lastHealthCheck = result;
      this.providers.set(providerId, provider);
      await persistProviderState(this.providers);

      return result;
    } catch (err) {
      const result = {
        providerId,
        reachable: false,
        error: err.message,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      this.healthChecks.set(providerId, result);
      return result;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Queries (delegated)                                                */
  /* ------------------------------------------------------------------ */

  async listProviders() {
    return listProvidersQuery(this.providers);
  }

  async getProvider(providerId) {
    return getProviderQuery(this.providers, this.onboardingSessions, this.healthChecks, providerId);
  }

  getOnboardingStatus(sessionId) {
    return getOnboardingStatusQuery(this.onboardingSessions, sessionId);
  }

  getOnboardingHistory() {
    return getOnboardingHistoryQuery(this.onboardingSessions);
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  _audit(sessionId, action, details = {}) {
    this._auditLog.push({
      sessionId,
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}
