export function scoreProjectMemory({ memoryId, text, updatedAt, queryTerms = [], now = new Date() } = {}) {
  const body = String(text || "").toLowerCase();
  const terms = queryTerms.map((term) => String(term || "").toLowerCase()).filter(Boolean);
  const hitCount = terms.filter((term) => body.includes(term)).length;
  const relevanceScore = terms.length === 0 ? 0.5 : round(hitCount / terms.length);
  const ageDays = Math.max(0, Math.floor((new Date(now).getTime() - new Date(updatedAt || 0).getTime()) / 86_400_000));
  const ageScore = round(Math.max(0, 1 - ageDays / 90));
  const staleScore = round(Math.min(1, ageDays / 90));
  const totalScore = round(relevanceScore * 0.6 + ageScore * 0.3 + (1 - staleScore) * 0.1);
  return {
    memoryId: String(memoryId || ""),
    relevanceScore,
    ageScore,
    staleScore,
    totalScore,
    recommendedAction: totalScore >= 0.55 && staleScore < 0.7 ? "use" : "deprioritize",
    providerCallsMade: false,
    secretRead: false,
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
