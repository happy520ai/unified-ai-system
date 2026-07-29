export function normalizePositionTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function buildPositionId(source, sourceCode, title) {
  const slug = normalizePositionTitle(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${String(source).toLowerCase()}-${String(sourceCode).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${slug}`;
}

export function normalizePosition(position) {
  return {
    ...position,
    canonicalTitle: position.canonicalTitle || position.sourceTitle,
    aliases: Array.isArray(position.aliases) ? position.aliases : [],
    skillTags: Array.isArray(position.skillTags) ? position.skillTags : [],
    knowledgeTags: Array.isArray(position.knowledgeTags) ? position.knowledgeTags : [],
    taskTags: Array.isArray(position.taskTags) ? position.taskTags : [],
    seniorityApplicability: Array.isArray(position.seniorityApplicability)
      ? position.seniorityApplicability
      : ["junior", "mid", "senior", "principal"],
    confidence: Number(position.confidence ?? 0.7),
    version: position.version || "phase576b-preview",
  };
}
