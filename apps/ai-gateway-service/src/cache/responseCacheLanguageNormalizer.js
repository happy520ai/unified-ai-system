export function normalizeCacheQuery(input = {}) {
  const query = String(input.query ?? input.prompt ?? "");
  const queryLanguage = detectQueryLanguage(query);
  const normalizedQuery = query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?!.,;:，。！？；：]/g, "")
    .replace(/\bwhat is\b/g, "what")
    .replace(/\bhow can i\b/g, "how to");

  return {
    query,
    normalizedQuery,
    queryLanguage,
  };
}

export function detectQueryLanguage(query = "") {
  const text = String(query);
  const hasCjk = /[\u3400-\u9fff]/.test(text);
  const hasKana = /[\u3040-\u30ff]/.test(text);
  const hasLatin = /[a-z]/i.test(text);
  if (hasKana && hasCjk) return hasLatin ? "mixed" : "ja";
  if (hasCjk) return hasLatin ? "mixed" : "zh";
  if (hasKana) return hasLatin ? "mixed" : "ja";
  if (hasLatin) return "en";
  return "unknown";
}
