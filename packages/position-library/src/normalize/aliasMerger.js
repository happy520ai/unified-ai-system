import { titleSearchKey } from "./titleNormalizer.js";

export function mergeAliases(...aliasGroups) {
  const seen = new Set();
  const aliases = [];
  for (const group of aliasGroups) {
    for (const alias of Array.isArray(group) ? group : []) {
      const normalized = titleSearchKey(alias);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      aliases.push(alias);
    }
  }
  return aliases;
}

