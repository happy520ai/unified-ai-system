/**
 * Provider Onboarding — query helpers.
 *
 * Extracted from providerOnboardingService.js to keep the service class
 * under the 500-line limit.
 *
 * @module providers/providerOnboardingQueries
 */

/**
 * List all providers with their current status.
 * @param {Map} providers
 * @returns {{ total: number, active: number, providers: object[] }}
 */
export function listProviders(providers) {
  const results = [];

  for (const [, provider] of providers) {
    results.push({
      id: provider.id,
      name: provider.name,
      status: provider.status,
      active: provider.active ?? false,
      models: (provider.models ?? []).length,
      region: provider.region ?? "global",
      category: provider.category ?? "standard",
      free: provider.free ?? false,
      lastHealthCheck: provider.lastHealthCheck ?? null,
      onboardedAt: provider.onboardedAt ?? null,
    });
  }

  return {
    total: results.length,
    active: results.filter((p) => p.active).length,
    providers: results,
  };
}

/**
 * Get detailed information about a single provider (secrets stripped).
 * @param {Map} providers
 * @param {Map} onboardingSessions
 * @param {Map} healthChecks
 * @param {string} providerId
 * @returns {object|null}
 */
export function getProvider(providers, onboardingSessions, healthChecks, providerId) {
  const provider = providers.get(providerId);
  if (!provider) return null;

  const session = findSessionByProvider(onboardingSessions, providerId);

  const { apiKey, secretKey, _rawConfig, ...safeProvider } = provider;
  return {
    ...safeProvider,
    onboardingSession: session
      ? {
          sessionId: session.sessionId,
          status: session.status,
          steps: session.steps,
        }
      : null,
    healthCheck: healthChecks.get(providerId) ?? null,
  };
}

/**
 * Get the status of an onboarding session.
 * @param {Map} onboardingSessions
 * @param {string} sessionId
 * @returns {object|null}
 */
export function getOnboardingStatus(onboardingSessions, sessionId) {
  const session = onboardingSessions.get(sessionId);
  if (!session) return null;

  const completedSteps = Object.entries(session.steps)
    .filter(([, v]) => v.status === "passed")
    .map(([k]) => k);
  const totalSteps = Object.keys(session.steps).length;

  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status,
    progress: `${completedSteps.length}/${totalSteps}`,
    completedSteps,
    pendingSteps: Object.entries(session.steps)
      .filter(([, v]) => v.status !== "passed")
      .map(([k]) => k),
    steps: session.steps,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/**
 * Get onboarding history (all sessions), newest first.
 * @param {Map} onboardingSessions
 * @returns {object[]}
 */
export function getOnboardingHistory(onboardingSessions) {
  return Array.from(onboardingSessions.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((s) => ({
      sessionId: s.sessionId,
      providerId: s.providerId,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
}

/**
 * Find the most recent onboarding session for a provider.
 * @param {Map} onboardingSessions
 * @param {string} providerId
 * @returns {object|null}
 */
export function findSessionByProvider(onboardingSessions, providerId) {
  let latest = null;
  for (const session of onboardingSessions.values()) {
    if (session.providerId === providerId) {
      if (!latest || new Date(session.updatedAt) > new Date(latest.updatedAt)) {
        latest = session;
      }
    }
  }
  return latest;
}
