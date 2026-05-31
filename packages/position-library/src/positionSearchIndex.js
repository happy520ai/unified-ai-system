import { samplePositions } from "./positionLibraryPreview.js";
import { normalizePositionTitle } from "./positionNormalizer.js";

export function searchPositions(query, positions = samplePositions) {
  const normalizedQuery = normalizePositionTitle(query);
  if (!normalizedQuery) return positions.slice(0, 10);
  return positions.filter((position) => {
    const haystack = [
      position.canonicalTitle,
      position.sourceTitle,
      position.occupationGroup,
      position.industryDomain,
      ...position.aliases,
      ...position.skillTags,
      ...position.knowledgeTags,
      ...position.taskTags,
    ].map(normalizePositionTitle).join(" ");
    return haystack.includes(normalizedQuery);
  });
}
