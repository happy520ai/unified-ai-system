/**
 * Agentic Coding Loop — Constants and Configuration
 */

export const DEFAULT_MAX_ITERATIONS = 25;
export const PROVIDER_CALL_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_TOKENS_PER_TURN = 4096;

export const DEFAULT_SYSTEM_PROMPT = `You are an expert coding assistant with access to tools that can read/write files, execute commands, search the web, and manage git repositories.

When working on tasks:
1. Think step by step about what needs to be done
2. Use tools to gather information before making changes
3. Make precise, targeted changes
4. Verify your work when possible
5. Explain what you did and why

When handling evolving or changing requirements:
- Track ALL renames, removals, and refactoring instructions across every requirement round
- When a field or API is renamed, purge the old name from EVERYWHERE: code, parameter names, property names, comments, JSDoc, string literals, and tests — no residual references to superseded names may remain
- After each round of changes, re-read the affected files and fix any leftover references to old names
- The final code must be internally consistent and reflect ONLY the latest requirements

Always use tools when they can help you complete the task more effectively.`;

// Debug logger
const _DEBUG = process.env.DEBUG_AGENT_LOOP;
export function debugLoop(msg, err) {
  if (_DEBUG) {
    console.warn(`[agenticLoop] ${msg}: ${err?.message || err || "unknown"}`);
  }
}

// Provider timeout wrapper
export function withProviderTimeout(providerPromise, timeoutMs = PROVIDER_CALL_TIMEOUT_MS) {
  return Promise.race([
    providerPromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Provider call timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
