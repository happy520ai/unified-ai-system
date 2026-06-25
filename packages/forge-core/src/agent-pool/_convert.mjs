/**
 * Comprehensive conversion script: 
 * 1. Replace this.#field with this.#s.field
 * 2. Collapse field declarations into single #s = {}
 * 3. Remove static private fields (replaced by imports)
 * 4. Remove private getters (replaced by direct access)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('E:/AI-Data/AI网关系统/unified-ai-system/packages/forge-core/src/agent-pool/index.js', 'utf8');
let lines = src.split('\n');

// All private instance field names
const fields = [
  'store', 'projectRoot', 'maxConcurrent', 'llmOptions',
  'activeWorkers', 'orphanCheckInterval', 'orphanCheckIntervalMs', 'taskTimeoutMs',
  'queue', 'eventEmitter', 'goalTrackers', 'goalBudgets',
  'shuttingDown', 'fileLocks', 'budget', 'verifier',
  'codeIntel', 'checkpoint', 'options', 'verificationStats',
  'metrics', 'config', 'plugins', 'circuitBreaker',
  'adaptiveTimeout', 'selfLoop', 'evolution', 'tracing',
  'goalSpans', 'rrGoalIndex', 'completedTaskIds', 'costCalculator',
  'deadLetterQueue', 'progressEstimator', 'memoryEngine', 'costAttribution',
  'decisionTrace', 'healthDashboard', 'adaptiveScaling', 'errorPatternLearner',
  'knowledgeGraph', 'semanticMemory', 'promptRegistry', 'multiAgentReview',
  'sandboxExecutor', 'liveStream', 'injectionDefense', 'selfHealing',
  'gracefulDegradation', 'crossSessionMemory', 'configHub', 'contextEngine',
];

let result = src;

// Step 1: Replace this.#fieldName with this.#s.fieldName (word boundary)
for (const f of fields) {
  const regex = new RegExp(`this\\.#${f}(?![a-zA-Z0-9_])`, 'g');
  result = result.replace(regex, `this.#s.${f}`);
}

// Step 2: Replace static private field references with imported constants
result = result.replace(/AgentPoolManager\.#CODE_MUTATING_TYPES/g, 'CODE_MUTATING_TYPES');
result = result.replace(/AgentPoolManager\.#MAX_VERIFY_RETRIES/g, 'MAX_VERIFY_RETRIES');

// Step 3: Remove field declarations (lines that are just `  #fieldName;` or with type annotations)
// Match lines like:   #store;
//                      /** @type {Map<...>} */\n  #activeWorkers = new Map();
// We need to remove both the JSDoc comment AND the declaration

// First, remove simple field declarations: `  #fieldName;` or `  #fieldName = ...;`
for (const f of fields) {
  // Remove the declaration line (with optional initializer)
  const declRegex = new RegExp(`^\\s*#${f}(?:\\s*=\\s*[^;]*)?;\\s*$`, 'gm');
  result = result.replace(declRegex, '');
}

// Remove JSDoc type comments that precede field declarations (now orphaned)
// These are lines like: /** @type {Map<string, ...>} */
// We need to remove them when they appear right before where a field was
// Clean up orphaned JSDoc lines that are just type annotations for removed fields
result = result.replace(/^\s*\/\*\*\s*@type\s*\{[^}]*\}\s*\*\/\s*\n/gm, '');

// Step 4: Remove static private field declarations
result = result.replace(/^\s*static\s+#CODE_MUTATING_TYPES\s*=.*$/m, '');
result = result.replace(/^\s*static\s+#MAX_VERIFY_RETRIES\s*=.*$/m, '');

// Step 5: Remove the private getter methods
// get #maxVerifyRetries() { ... }
result = result.replace(/\s*get\s+#maxVerifyRetries\(\)\s*\{[\s\S]*?\n\s*\}/, '');
// get #verifyMaxTier() { ... }  
result = result.replace(/\s*get\s+#verifyMaxTier\(\)\s*\{[\s\S]*?\n\s*\}/, '');

// Step 6: Add the #s field declaration after the class opening
// Find "export class AgentPoolManager {" and add #s after it
result = result.replace(
  /(export class AgentPoolManager \{)/,
  `$1\n  /** @type {object} Consolidated state object for extraction */\n  #s = {};`
);

// Step 7: Fix the #maxVerifyRetries and #verifyMaxTier references in the code
// These were private getters, now they need to be computed inline or accessed differently
// Replace this.#maxVerifyRetries with (this.#s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)
result = result.replace(/this\.#s\.maxVerifyRetries(?![a-zA-Z0-9_])/g, 
  '(this.#s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)');
// Wait, the original code had this.#maxVerifyRetries which was a getter.
// After step 1, it became this.#s.maxVerifyRetries (because maxVerifyRetries is NOT in the fields list)
// Actually, maxVerifyRetries is NOT in the fields list, so it wasn't converted by step 1.
// Let me check: the getter was `get #maxVerifyRetries()` which accessed `this.#config?.pool?.maxVerifyRetries`
// After step 1, `this.#config` became `this.#s.config`
// After step 5, the getter was removed
// Now references to `this.#maxVerifyRetries` (original) need to become the inline expression
// But step 1 didn't touch `#maxVerifyRetries` because it's not in the fields list
// So we need to replace `this.#maxVerifyRetries` with the inline expression
result = result.replace(/this\.#maxVerifyRetries(?![a-zA-Z0-9_])/g, 
  '(this.#s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES)');
result = result.replace(/this\.#verifyMaxTier(?![a-zA-Z0-9_])/g, 
  '(this.#s.config?.pool?.verifyMaxTier ?? 2)');

// Clean up multiple consecutive blank lines (collapse to max 2)
result = result.replace(/\n{4,}/g, '\n\n\n');

writeFileSync('E:/AI-Data/AI网关系统/unified-ai-system/packages/forge-core/src/agent-pool/_converted.js', result, 'utf8');
console.log('Conversion done. Lines:', result.split('\n').length);
