// Facade: structured project-state compression now lives in the unified
// context compaction engine (unifiedContextCompactor.ts).
import { compactStructuredContext } from "./unifiedContextCompactor.ts";

export function compressLongContext(input) {
  return compactStructuredContext(input);
}
