import { titleSearchKey } from "./titleNormalizer.js";
import { mergeAliases } from "./aliasMerger.js";

export function dedupeSourcePositions(positions) {
  const byKey = new Map();
  for (const position of positions) {
    const key = [
      String(position.source || "").toLowerCase(),
      String(position.sourceCode || "").toLowerCase(),
      titleSearchKey(position.canonicalTitle || position.sourceTitle),
    ].join(":");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...position, aliases: mergeAliases(position.aliases, [position.canonicalTitle, position.sourceTitle]) });
      continue;
    }
    byKey.set(key, {
      ...existing,
      aliases: mergeAliases(existing.aliases, position.aliases, [position.canonicalTitle, position.sourceTitle]),
      skillTags: mergePrimitiveArrays(existing.skillTags, position.skillTags),
      knowledgeTags: mergePrimitiveArrays(existing.knowledgeTags, position.knowledgeTags),
      taskTags: mergePrimitiveArrays(existing.taskTags, position.taskTags),
      confidence: Math.max(Number(existing.confidence || 0), Number(position.confidence || 0)),
    });
  }
  return [...byKey.values()];
}

function mergePrimitiveArrays(left = [], right = []) {
  return [...new Set([...left, ...right].filter(Boolean))];
}

