const SECRET_PATTERNS = [
  /nvapi-/i,
  /sk-/i,
  /Bearer\s+/i,
  /Authorization/i,
  /api-key/i,
  /API_KEY/i,
  /OPENAI_API_KEY/i,
  /NVIDIA_API_KEY/i,
  /MIMO_API_KEY/i,
  /XIAOMI_API_KEY/i,
  /password/i,
  /token=/i,
  /secret/i,
  /\.env/i,
];

export function cleanPublicKnowledgeText(input = {}) {
  const rawText = String(input.rawText ?? input.text ?? "");
  const sourceFamily = input.sourceFamily ?? "unknown";
  const secretLike = SECRET_PATTERNS.some((pattern) => pattern.test(rawText));
  const htmlStripped = rawText
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const gutenbergTrimmed = stripGutenbergBoilerplate(htmlStripped);
  const cleanedText = gutenbergTrimmed
    .replace(/\b(contents|navigation|edit links|external links)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    sourceFamily,
    cleanedText: secretLike ? "" : cleanedText,
    sanitizedPreview: secretLike ? "[secret-like content rejected]" : cleanedText.slice(0, 240),
    rejected: secretLike,
    sanitized: secretLike,
    secretLikeDetected: secretLike,
    llmCleaningCalled: false,
    cleaningMethod: "deterministic-html-whitespace-gutenberg-preview",
    charLength: secretLike ? 0 : cleanedText.length,
  };
}

export function hasSecretLikeContent(value = "") {
  return SECRET_PATTERNS.some((pattern) => pattern.test(String(value ?? "")));
}

function stripGutenbergBoilerplate(text) {
  return String(text ?? "")
    .replace(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i, " ")
    .replace(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*/i, " ");
}
