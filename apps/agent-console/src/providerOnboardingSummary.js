export function buildProviderOnboardingSummary({ providerId, validation }) {
  return {
    providerId,
    validationCode: validation?.code || "not_validated",
    productionEnabled: false,
    nextSteps: ["complete backend governance validation", "run guarded beta check", "keep revoke instructions visible"],
  };
}
