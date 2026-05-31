import { titleSearchKey } from "../normalize/titleNormalizer.js";

export function buildPositionSearchIndex(positions) {
  return {
    count: positions.length,
    positions,
    documents: positions.map((position) => ({
      positionId: position.positionId,
      text: [
        position.canonicalTitle,
        position.sourceTitle,
        position.sourceCode,
        position.occupationGroup,
        position.industryDomain,
        ...(position.aliases || []),
        ...(position.skillTags || []),
        ...(position.knowledgeTags || []),
        ...(position.taskTags || []),
      ].map(titleSearchKey).join(" "),
    })),
  };
}

export function searchPositionIndex(query, index, limit = 10) {
  const key = titleSearchKey(query);
  if (!key) return index.positions.slice(0, limit);
  return index.documents
    .map((document, order) => ({
      document,
      order,
      score: document.text.includes(key) ? key.length : 0,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((entry) => index.positions.find((position) => position.positionId === entry.document.positionId));
}

