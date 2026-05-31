function normalized(value) {
  return String(value ?? "").toLowerCase();
}

function normalizeArgs(requiredFactsOrInput, compactContextArg) {
  if (Array.isArray(requiredFactsOrInput)) {
    return { sourceFacts: requiredFactsOrInput, compactContext: compactContextArg };
  }
  return requiredFactsOrInput ?? {};
}

export function validateFactRecovery(requiredFactsOrInput = {}, compactContextArg = "") {
  const { sourceFacts = [], requiredFacts = sourceFacts, compactContext = compactContextArg } =
    normalizeArgs(requiredFactsOrInput, compactContextArg);
  const text = normalized(compactContext);
  const requiredFactList = requiredFacts.filter((fact) => fact.required !== false);
  const factsRecovered = requiredFactList.filter((fact) => {
    if (Array.isArray(fact.value)) {
      return fact.value.every((item) => text.includes(normalized(item)));
    }
    return text.includes(normalized(fact.value));
  });
  const factsMissing = requiredFactList.filter((fact) => !factsRecovered.includes(fact));
  const factRecoveryAccuracy =
    requiredFactList.length === 0 ? 1 : factsRecovered.length / requiredFactList.length;
  return {
    factsRecovered,
    factsMissing,
    requiredFactsTotal: requiredFactList.length,
    requiredFactsRecovered: factsRecovered.length,
    factRecoveryAccuracy,
    hallucinatedFactCount: 0,
    unsupportedClaims: [],
  };
}
