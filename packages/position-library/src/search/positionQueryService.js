import { buildPositionSearchIndex, searchPositionIndex } from "./positionSearchIndex.js";
import { sourceBackedExpandedSeed } from "../data/sourceBackedExpandedSeed.js";

export function createPositionQueryService(positions = sourceBackedExpandedSeed) {
  const index = buildPositionSearchIndex(positions);
  return {
    index,
    query(query, options = {}) {
      return searchPositionIndex(query, index, options.limit || 10);
    },
  };
}

