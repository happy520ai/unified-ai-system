/**
 * toolResultCache.js — LRU-style result cache for read-only tool executions.
 *
 * Split from toolRegistryEngine.js for 分层律 compliance.
 * Prevents redundant tool calls for file_read, glob, grep, web_fetch, etc.
 */

const MAX_CACHE_SIZE = 500;
const CACHEABLE_TOOLS = new Set([
  "file_read", "glob", "grep", "web_fetch", "web_search",
  "git_status", "git_log", "git_diff", "git_branch",
  "image_read", "image_analyze",
  "semantic_search",
  // LSP read tools
  "lsp_hover", "lsp_definition", "lsp_references", "lsp_diagnostics",
]);

function makeCacheKey(toolName, params) {
  const sortedParams = {};
  for (const key of Object.keys(params).sort()) {
    sortedParams[key] = params[key];
  }
  return `${toolName}:${JSON.stringify(sortedParams)}`;
}

/**
 * Create a tool result cache.
 * Returns cache operations bound to an internal Map.
 */
export function createToolResultCache() {
  const cache = new Map();

  return {
    /** Current number of cached entries */
    get size() { return cache.size; },

    /** The set of tool names eligible for caching */
    cacheableTools: CACHEABLE_TOOLS,

    /** Max cache capacity */
    maxSize: MAX_CACHE_SIZE,

    /** Look up a cached result; increments hit counter on match */
    get(toolName, params) {
      if (!CACHEABLE_TOOLS.has(toolName)) return null;
      const key = makeCacheKey(toolName, params);
      const entry = cache.get(key);
      if (entry) {
        entry.hits++;
        return entry.result;
      }
      return null;
    },

    /** Store a result in the cache; evicts oldest if at capacity */
    set(toolName, params, result) {
      if (!CACHEABLE_TOOLS.has(toolName)) return;
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
      const key = makeCacheKey(toolName, params);
      cache.set(key, { result, hits: 0, cachedAt: Date.now() });
    },

    /**
     * Invalidate cached results when a file is modified by a write tool.
     * Removes file_read entries for the same path and glob/grep entries
     * in the same directory.
     */
    invalidateForFileWrite(params) {
      const modifiedPath = params.path || params.filePath || params.file || "";
      if (!modifiedPath) return 0;
      let invalidated = 0;
      for (const [key] of cache) {
        if (key.startsWith("file_read:") && key.includes(modifiedPath)) {
          cache.delete(key);
          invalidated++;
          continue;
        }
        if (key.startsWith("glob:") || key.startsWith("grep:")) {
          cache.delete(key);
          invalidated++;
        }
      }
      return invalidated;
    },

    /** Clear all cached results */
    clear() {
      const size = cache.size;
      cache.clear();
      return { cleared: size };
    },
  };
}
