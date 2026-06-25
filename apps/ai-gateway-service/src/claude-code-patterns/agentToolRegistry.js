/**
 * agentToolRegistry.js — Re-export facade.
 *
 * Split into six modules for 分层律 compliance (single file ≤ 500 lines):
 *   - toolCore.js              — schema factories, tool-use context
 *   - builtInCoreTools.js      — file_read, file_write, shell_exec
 *   - sandboxTools.js          — web_fetch, code_run
 *   - codeIntelligenceTools.js — semantic_search, ast_edit
 *   - developerTools.js        — code_format, generate_test, type_check, createBuiltInTools
 *   - toolRegistryEngine.js    — createAgentToolRegistry, helpers
 */

export { createInputSchema, buildTool, createToolUseContext } from "./toolCore.js";
export { createBuiltInTools } from "./developerTools.js";
export { createAgentToolRegistry } from "./toolRegistryEngine.js";

// Lazy BUILT_IN_TOOLS — avoids TDZ circular dependency from eager evaluation.
// Consumers should prefer createBuiltInTools() directly; this getter is for
// backward compatibility only.
import { createBuiltInTools as _createBuiltInTools } from "./developerTools.js";
let _builtInToolsCache;
export function getBuiltInTools() {
  if (!_builtInToolsCache) _builtInToolsCache = _createBuiltInTools();
  return _builtInToolsCache;
}
