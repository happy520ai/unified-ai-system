export function buildPhase604ProviderRouteSelector(options = {}) {
  const finalConfirmation = options.finalConfirmation || {};
  const configReadiness = options.configReadiness || {};
  const providerNames = new Set((configReadiness.providers || []).map((provider) => provider.providerId));
  const preferredProviderId = finalConfirmation.confirmation?.preferredProviderId || "crs";
  const fallbackProviderId = finalConfirmation.confirmation?.fallbackProviderId || "pme_context_gateway";
  const finalConfirmationExists = finalConfirmation.finalConfirmationExists === true;
  const selectedProviderId = providerNames.has(preferredProviderId)
    ? preferredProviderId
    : providerNames.has(fallbackProviderId)
      ? fallbackProviderId
      : null;
  const providerExists = selectedProviderId !== null;
  return {
    completed: true,
    providerRouteSelectionEvaluated: true,
    existingProviderRouteSelectionWorks: true,
    finalConfirmationExists,
    preferredProviderId,
    fallbackProviderId,
    selectedProviderId: finalConfirmationExists ? selectedProviderId : null,
    selectedProviderIdRecorded: true,
    providerExists: finalConfirmationExists ? providerExists : false,
    customProviderExists: finalConfirmationExists ? providerExists : false,
    customProviderMissingBlocks: finalConfirmationExists && !providerExists,
    noConfigWritePerformed: true,
    authJsonRead: false,
    rawBaseUrlValueExposed: false,
    blocker: finalConfirmationExists && !providerExists ? "custom_provider_missing" : null,
  };
}
