export function selectNormalModeModel(scoredCandidates = []) {
  const selected = scoredCandidates.find((candidate) => candidate.runtimeEligible) || null;
  return {
    phase: "Phase806",
    normalModeSelectorReady: true,
    selected,
    providerCallsMade: false,
    secretRead: false,
  };
}
